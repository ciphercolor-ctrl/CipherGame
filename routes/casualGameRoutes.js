const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../logger');
const { t } = require('../i18n');

// POST a new casual game score
router.post('/', authenticateToken, async (req, res) => {
    const { game_name, score } = req.body;
    const username = req.user.username;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    logger.info('Attempting to save casual score.', { game_name, score, username, ip: req.ip });

    if (!game_name || typeof score === 'undefined' || !username) {
        logger.warn('Invalid casual score submission.', { body: req.body, username, ip: req.ip });
        return res.status(400).json({ message: t(lang, 'errorCasualGameParamsRequired') });
    }

    const id = uuidv4();
    const createdAt = new Date();

    try {
        const existingScoreResult = await db.query(
            'SELECT score FROM casual_scores WHERE game_name = $1 AND username = $2 ORDER BY score DESC LIMIT 1',
            [game_name, username]
        );

        const existingScore = existingScoreResult.rows[0];
        logger.debug('Checked for existing score.', { username, game_name, existingScore });

        if (existingScore && score <= existingScore.score) {
            logger.info('New score is not higher than existing high score. Not saving.', { username, game_name, newScore: score, oldHighScore: existingScore.score });
            return res.status(200).json({ message: t(lang, 'infoCasualGameScoreNotHigher'), newScore: false });
        }
        
        logger.info('New high score! Saving to database.', { username, game_name, score });
        const newScoreResult = await db.query(
            'INSERT INTO casual_scores (id, game_name, username, score, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, game_name, username, score, createdAt]
        );
        
        logger.info('Successfully saved new casual score.', { newScore: newScoreResult.rows[0] });

        // Broadcast casual game score update via Socket.IO
        if (global.scoreHandler) {
            global.scoreHandler.broadcastScoreUpdate({
                playerId: req.user.id, // Use the actual player ID for consistency
                username: username,
                score: score,
                mode: game_name,
                newLevel: null // Casual games don't have levels
            });
        }

        res.status(201).json({ message: t(lang, 'successCasualGameScoreSaved'), newScore: true, data: newScoreResult.rows[0] });

    } catch (error) {
        logger.error('Failed to save casual score:', { error: error.message, stack: error.stack, username, game_name });
        res.status(500).json({ message: t(lang, 'errorCasualGameSaveFailed') });
    }
});

// GET top 3 leaderboard for a specific casual game
router.get('/:gameName', async (req, res) => {
    const { gameName } = req.params;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    logger.info(`Fetching leaderboard for game: ${gameName}`);

    if (!gameName) {
        logger.warn('Game name not provided for leaderboard fetch.');
        return res.status(400).json({ message: t(lang, 'errorCasualGameNameRequired') });
    }

    try {
        const query = `
            WITH ranked_scores AS (
                SELECT 
                    cs.username,
                    cs.score,
                    p.avatarUrl,
                    p.country,
                    p.level,
                    ROW_NUMBER() OVER(PARTITION BY cs.username ORDER BY cs.score DESC) as rn
                FROM casual_scores cs
                JOIN players p ON cs.username = p.username
                WHERE cs.game_name = $1
            )
            SELECT username, score, avatarUrl, country, level
            FROM ranked_scores
            WHERE rn = 1
            ORDER BY score DESC
            LIMIT 3;
        `;
        
        logger.debug('Executing leaderboard query', { gameName, query });
        const leaderboard = await db.query(query, [gameName]);
        
        logger.info(`Found ${leaderboard.rowCount} rows for ${gameName} leaderboard.`, { rows: leaderboard.rows });
        res.status(200).json(leaderboard.rows);
    } catch (error) {
        logger.error(`Failed to fetch leaderboard for ${gameName}:`, { error: error.message, stack: error.stack });
        res.status(500).json({ message: t(lang, 'errorCasualGameLeaderboardFailed') });
    }
});

module.exports = router;
