const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { countries } = require('../constants');
const { t } = require('../i18n');
const logger = require('../logger');
const { updateLeaderboardView } = require('../update_leaderboard_view');

// Rate limiting for score submission
const scoreSubmissionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 score submissions per minute
    message: t('en', 'errorTooManyRequests'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Helper function to calculate level based on game count
function calculateLevel(gameCount) {
    // 30 games = level 1, 60 games = level 2, etc.
    const level = Math.floor(gameCount / 30);
    return Math.min(level, 10); // Cap the level at 10
}

// Submit a score (protected)
router.post('/', scoreSubmissionLimiter, authenticateToken, async (req, res) => {
    const { score, memoryTime, matchingTime, clientGameId } = req.body; // Added clientGameId
    const mode = req.body.mode || 'normal';
    const playerId = req.user.id;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    if (score === undefined || !mode || !clientGameId) {
        return res.status(400).json({ message: t(lang, 'errorScoreInvalidData') });
    }

    // --- Basic Anti-Cheat ---
    // 1. Validate score format and range
    const parsedScore = parseInt(score, 10);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100000) { // Example max score
        logger.warn('Invalid score format or out of range', {
            playerId: playerId,
            score: score,
            ip: req.ip
        });
        return res.status(400).json({ message: t(lang, 'errorScoreInvalidData') });
    }

    // 2. Check for duplicate submissions for the same game
    try {
        const existingScore = await db.query('SELECT id FROM scores WHERE playerId = $1 AND id = $2', [playerId, clientGameId]);
        if (existingScore.rows.length > 0) {
            logger.warn('Duplicate score submission detected', {
                clientGameId: clientGameId,
                playerId: playerId,
                ip: req.ip
            });
            return res.status(409).json({ message: t(lang, 'infoScoreDuplicate') });
        }
    } catch (err) {
        logger.error('Error checking for duplicate score', {
            error: err.message,
            stack: err.stack,
            playerId: playerId
        });
        return res.status(500).json({ message: t(lang, 'errorScoreSave') });
    }
    // --- End Anti-Cheat ---

    const timestamp = new Date().toISOString();
    const client = await db.getClient(); // Get a single client for the transaction

    try {
        await client.query('BEGIN');

        
        

        

        // Check if user exists and get current level before inserting score
        const userCheck = await client.query('SELECT id, level FROM players WHERE id = $1', [playerId]);
        
        if (userCheck.rows.length === 0) {
            logger.warn(`User ${playerId} not found in database, skipping score submission`);
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                message: t(lang, 'errorUserNotFoundRelogin'),
                code: 'USER_NOT_FOUND'
            });
        }

        // The score is already adjusted on the client-side. The backend will trust the incoming score.
        const adjustedScore = parsedScore;

        // Always insert the adjusted score
        await client.query(
            `INSERT INTO scores (id, playerId, score, mode, memoryTime, matchingTime, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [clientGameId, playerId, adjustedScore, mode, memoryTime, matchingTime, timestamp]
        );

        // After inserting the score, get the new stats for the player
        const statsQuery = `
            SELECT
                COUNT(id) AS gamecount,
                COALESCE(MAX(score), 0) AS highestscore
            FROM scores
            WHERE playerId = $1;
        `;
        const statsResult = await client.query(statsQuery, [playerId]);
        const { gamecount, highestscore } = statsResult.rows[0];

        const newLevel = calculateLevel(gamecount);

        // Update the players table with all new stats in one go
        await client.query(
            `UPDATE players SET level = $1, gameCount = $2, highestScore = $3 WHERE id = $4`,
            [newLevel, gamecount, highestscore, playerId]
        );

        await client.query('COMMIT');

        // Get player username for socket broadcast
        const playerResult = await db.query('SELECT username FROM players WHERE id = $1', [playerId]);
        const username = playerResult.rows[0]?.username || 'Unknown';

        // Broadcast score update via Socket.IO
        if (global.scoreHandler) {
            global.scoreHandler.broadcastScoreUpdate({
                playerId: playerId,
                username: username,
                score: adjustedScore,
                mode: mode,
                newLevel: newLevel
            });
        }

        // Refresh the materialized view and wait for it to complete
        await updateLeaderboardView();

        res.status(201).json({ id: clientGameId, newLevel: newLevel });

    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            logger.error('❌ Rollback failed during score submission', {
                originalError: err.message,
                rollbackError: rollbackError.message,
                playerId: playerId,
                score: parsedScore
            });
        }

        // Detailed error logging with context
        logger.error('💥 Score submission failed', {
            error: err.message,
            stack: err.stack,
            code: err.code,
            playerId: playerId,
            score: parsedScore,
            mode: mode,
            clientGameId: clientGameId,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Different error responses based on error type
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ 
                message: t(lang, 'infoScoreDuplicate'),
                code: 'DUPLICATE_SCORE'
            });
        } else if (err.code === '23503') { // Foreign key violation
            return res.status(400).json({ 
                message: t(lang, 'errorUserNotFoundRelogin'),
                code: 'USER_NOT_FOUND'
            });
        } else if (err.message.includes('timeout')) {
            return res.status(503).json({ 
                message: t(lang, 'errorDatabaseTimeout'),
                code: 'DATABASE_TIMEOUT'
            });
        } else {
            return res.status(500).json({ 
                message: t(lang, 'errorScoreSave'),
                code: 'INTERNAL_ERROR'
            });
        }
    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                logger.error('❌ Failed to release database client', {
                    error: releaseError.message,
                    playerId: playerId
                });
            }
        }
    }
});

// Get individual leaderboard
router.get('/individual', async (req, res) => {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    try {
        const result = await db.query(`SELECT * FROM leaderboard_materialized_view ORDER BY highestscore DESC LIMIT 20`);
        
        const rows = result.rows;
        
        const leaderboard = rows.map(row => ({
            name: row.username,
            country: row.country,
            flag: countries[row.country] ? countries[row.country].flag : '🏳️',
            score: row.highestscore,
            playerid: row.playerid,
            avatarUrl: row.avatarurl,
            level: row.level,
            mode: row.mode // Add the mode from the view
        }));

        res.json(leaderboard);
    } catch (err) {
        logger.error('Individual leaderboard error', {
            error: err.message,
            stack: err.stack
        });
        return res.status(500).json({ message: t(lang, 'errorServerError') });
    }
});

router.get('/country', async (req, res) => {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    try {
        const result = await db.query(`
            SELECT 
                p.country, 
                COALESCE(SUM(s.score), 0) as totalScore, 
                COUNT(DISTINCT p.id) as playerCount
            FROM 
                players p
            LEFT JOIN 
                scores s ON p.id = s.playerId
            WHERE 
                p.country IS NOT NULL AND p.country != ''
            GROUP BY 
                p.country
            ORDER BY 
                totalScore DESC
        `);
        const rows = result.rows;
        const leaderboard = rows.map(row => {
            const countryCode = row.country;
            const countryData = countries[countryCode];
            
            return {
                countryCode: countryCode,
                countryName: countryData ? countryData.name : countryCode, // Fallback to code if not found
                flag: countryData ? countryData.flag : '🏳️',
                averageScore: parseInt(row.totalscore, 10),
                playerCount: parseInt(row.playercount, 10)
            };
        });
        res.json(leaderboard);
    } catch (err) {
        logger.error('Country leaderboard error', {
            error: err.message,
            stack: err.stack
        });
        return res.status(500).json({ message: t(lang, 'errorServerError') });
    }
});

// Get top players for homepage preview (no authentication required)
router.get('/top-preview', async (req, res) => {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    try {
        const result = await db.query(`
            WITH RankedScores AS (
                SELECT
                    s.playerId,
                    s.score,
                    s.mode,
                    ROW_NUMBER() OVER(PARTITION BY s.playerId ORDER BY s.score DESC, s.timestamp DESC) as rn
                FROM scores s
            )
            SELECT
                p.username,
                p.country,
                p.avatarUrl,
                p.level,
                rs.score,
                rs.mode
            FROM players p
            JOIN RankedScores rs ON p.id = rs.playerId
            WHERE rs.rn = 1
            ORDER BY rs.score DESC
            LIMIT 5;
        `);
        const rows = result.rows;
        const leaderboard = rows.map(row => ({
            name: row.username,
            country: row.country,
            flag: countries[row.country] ? countries[row.country].flag : '🏳️',
            score: row.score,
            mode: row.mode, // Added mode here
            avatarUrl: row.avatarurl,
            level: row.level
        }));
        res.json(leaderboard);
    } catch (err) {
        logger.error('Top players preview leaderboard error', {
            error: err.message,
            stack: err.stack
        });
        return res.status(500).json({ message: t(lang, 'errorServerError') });
    }
});

module.exports = { router, calculateLevel };
