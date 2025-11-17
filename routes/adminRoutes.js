const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticateAdminToken } = require('../middleware/auth');
const { calculateLevel } = require('./scoreRoutes');
const { updateLeaderboardView } = require('../update_leaderboard_view');
const logger = require('../logger');

// Admin activity logging function
const logAdminActivity = (adminId, action, details, req) => {
    logger.info('Admin Activity', {
        adminId,
        adminUsername: req.user?.username,
        action,
        details,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
};

// Admin login rate limiting - Very strict for security
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: {
        error: 'Too many admin login attempts. Please try again in 15 minutes.',
        retryAfter: 15 * 60 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in test environment
    skip: (req) => process.env.NODE_ENV === 'test'
});

// General admin operations rate limiting
const adminOperationsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
        error: 'Too many admin operations. Please slow down.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in test environment
    skip: (req) => process.env.NODE_ENV === 'test'
});

// Admin Login
router.post('/login', adminLoginLimiter, async (req, res) => {
    const { username, password } = req.body;

    // Enhanced validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    // Input sanitization
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Invalid input format' });
    }

    // Length validation
    if (username.length > 50 || password.length > 100) {
        return res.status(400).json({ message: 'Invalid input length' });
    }

    try {
        const result = await db.query(`SELECT * FROM admins WHERE username ILIKE $1`, [username]);
        const admin = result.rows[0];
        
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            // Log failed login attempt
            logger.warn('Admin login failed', {
                username: username,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString()
            });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Log successful login
        logger.info('Admin login successful', {
            adminId: admin.id,
            adminUsername: admin.username,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        });

        // Create tokens with longer expiry for admin
        const token = jwt.sign({ 
            id: admin.id, 
            username: admin.username, 
            role: 'admin' 
        }, process.env.JWT_SECRET, { 
            expiresIn: '8h' // Increased from 1h to 8h for better UX
        });

        res.json({ 
            token,
            expiresIn: '8h',
            admin: {
                id: admin.id,
                username: admin.username
            }
        });
    } catch (error) {
        logger.error('Admin login error', {
            error: error.message,
            username: username,
            ip: req.ip,
            timestamp: new Date().toISOString()
        });
        // Don't expose internal error details
        res.status(500).json({ message: 'An unexpected error occurred during login.' });
    }
});

// Admin: Get all users
router.get('/users', adminOperationsLimiter, authenticateAdminToken, async (req, res) => {
    try {
        let { sortBy = 'createdAt', order = 'desc' } = req.query;

        // Whitelist for sortBy to prevent SQL injection
        const allowedSortBy = {
            'username': 'username',
            'country': 'country',
            'createdAt': 'createdat',
            'level': 'level',
            'gameCount': 'gameCount'
        };

        if (!Object.keys(allowedSortBy).includes(sortBy)) {
            return res.status(400).json({ message: 'Invalid sort parameter' });
        }

        // Whitelist for order
        order = order.toLowerCase();
        if (order !== 'asc' && order !== 'desc') {
            return res.status(400).json({ message: 'Invalid order parameter' });
        }

        const query = `
            SELECT id, username, country, avatarurl, createdat, level, gameCount, autoSolverPermission, is_influencer
            FROM players
            ORDER BY ${allowedSortBy[sortBy]} ${order.toUpperCase()}
        `;

        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get users error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching users.' });
    }
});

// Admin: Get a single user by ID
router.get('/users/:id', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(`SELECT id, username, country, avatarurl FROM players WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Admin get user error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching user data.' });
    }
});

// Admin: Update a user
router.put('/users/:id', adminOperationsLimiter, authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    const { username, country, avatarUrl } = req.body;

    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        const result = await db.query(
            `UPDATE players SET username = $1, country = $2, avatarurl = $3 WHERE id = $4 RETURNING *`,
            [username, country, avatarUrl, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        await updateLeaderboardView(); // Refresh leaderboard view after user update
        
        // Log admin activity
        logAdminActivity(req.user.id, 'UPDATE_USER', {
            userId: id,
            username: username,
            country: country,
            avatarUrl: avatarUrl
        }, req);
        
        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (err) {
        console.error('Admin update user error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating user.' });
    }
});

// Admin: Delete a user
router.delete('/users/:id', adminOperationsLimiter, authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(`DELETE FROM players WHERE id = $1`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
        await updateLeaderboardView(); // Refresh leaderboard view after user deletion
        
        // Log admin activity
        logAdminActivity(req.user.id, 'DELETE_USER', {
            userId: id
        }, req);
        
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while deleting user.' });
    }
});

// Admin: Get general statistics
router.get('/stats', authenticateAdminToken, async (req, res) => {
    try {
        const totalPlayersResult = await db.query(`SELECT COUNT(*) as total_players FROM players`);
        const totalGamesPlayedResult = await db.query(`SELECT COUNT(*) as total_games_played FROM scores`);
        const averageScoreResult = await db.query(`SELECT AVG(score) as average_score FROM scores`);

        const stats = {
            totalPlayers: parseInt(totalPlayersResult.rows[0].total_players, 10) || 0,
            totalGamesPlayed: parseInt(totalGamesPlayedResult.rows[0].total_games_played, 10) || 0,
            averageScore: parseFloat(averageScoreResult.rows[0].average_score) || 0
        };

        res.json(stats);
    } catch (err) {
        console.error('Admin stats error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching statistics.' });
    }
});

// Admin: Get all settings
router.get('/settings', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`SELECT key, value FROM settings`);
        const rows = result.rows;
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (err) {
        console.error('Admin get settings error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching settings.' });
    }
});

// Admin: Update a setting
router.put('/settings/:key', authenticateAdminToken, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
        return res.status(400).json({ message: 'Value is required' });
    }

    try {
        await db.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value]);
        res.json({ message: `Setting ${key} updated successfully` });
    } catch (err) {
        console.error('Admin update setting error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating setting.' });
    }
});

// Admin: Update a player's game count for testing levels
router.put('/player/:id/gamecount', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    const { targetGameCount } = req.body;

    if (targetGameCount === undefined || targetGameCount < 0) {
        return res.status(400).json({ message: 'Target game count is required and must be a non-negative number.' });
    }

    try {
        // 1. Delete all existing 'admin_added' scores for this player
        await db.query(`DELETE FROM scores WHERE playerId = $1 AND mode = 'admin_added'`, [id]);

        // 2. Insert 'targetGameCount' number of new 'admin_added' scores
        for (let i = 0; i < targetGameCount; i++) {
            const scoreId = `admin_added_score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const timestamp = new Date().toISOString();
            await db.query(`INSERT INTO scores (id, playerId, score, mode, timestamp) VALUES ($1, $2, $3, $4, $5)`,
                [scoreId, id, 1, 'admin_added', timestamp]);
        }

        // 3. Recalculate the total game count for the player
        const totalGameCountResult = await db.query(`SELECT COUNT(*) as totalGameCount FROM scores WHERE playerId = $1`, [id]);
        const totalGameCount = parseInt(totalGameCountResult.rows[0].totalGameCount, 10) || 0;

        // 4. Update the player's level and gameCount
        const newLevel = calculateLevel(totalGameCount);
        await db.query(`UPDATE players SET level = $1, gameCount = $2 WHERE id = $3`, [newLevel, totalGameCount, id]);
        await updateLeaderboardView();

        // Log admin activity
        logAdminActivity(req.user.id, 'UPDATE_GAME_COUNT', {
            userId: id,
            targetGameCount: targetGameCount,
            newLevel: newLevel
        }, req);

        res.json({ message: `Player ${id}'s game count updated to ${totalGameCount}. Level set to ${newLevel}.` });

    } catch (err) {
        console.error('Admin update game count error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating game count.' });
    }
});

// Admin: Reset a player's game count to original
router.post('/player/:id/gamecount/reset', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await db.query(`DELETE FROM scores WHERE playerId = $1 AND (mode = 'dummy' OR mode = 'admin_added')`, [id]);

        const gameCountResult = await db.query(`SELECT COUNT(*) as gameCount FROM scores WHERE playerId = $1`, [id]);
        const gameCount = parseInt(gameCountResult.rows[0].gameCount, 10) || 0;
        const newLevel = calculateLevel(gameCount);

        await db.query(`UPDATE players SET level = $1, gameCount = $2 WHERE id = $3`, [newLevel, gameCount, id]);
        await updateLeaderboardView();

        console.log(`[DEBUG] Admin reset: Player ${id} level reset to ${newLevel} based on ${gameCount} remaining games.`);

        res.json({ message: `Removed ${deleteResult.rowCount} dummy games for player ${id}. Level reset to ${newLevel}.` });
    } catch (err) {
        console.error('Admin reset game count error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while resetting game count.' });
    }
});

// Admin: Update player's auto solver permission
router.put('/player/:id/auto-solver', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    const { autoSolverPermission } = req.body;

    if (typeof autoSolverPermission !== 'boolean') {
        return res.status(400).json({ message: 'Auto solver permission must be a boolean value.' });
    }

    try {
        const result = await db.query(
            `UPDATE players SET autoSolverPermission = $1 WHERE id = $2 RETURNING username, autoSolverPermission`,
            [autoSolverPermission, id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];
        const status = autoSolverPermission ? 'granted' : 'revoked';
        res.json({ 
            message: `Auto solver permission ${status} for ${user.username}.`,
            autoSolverPermission: user.autosolverpermission
        });
    } catch (err) {
        console.error('Admin update auto solver permission error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating auto solver permission.' });
    }
});

// Admin: Clear all chat messages
router.delete('/chat/messages', authenticateAdminToken, async (req, res) => {
    try {
        await db.query('DELETE FROM messages');
        res.json({ message: 'All chat messages have been deleted successfully.' });
    } catch (err) {
        console.error('Admin clear chat error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while clearing chat messages.' });
    }
});

// Admin: Clear chat messages for a specific room
router.delete('/chat/messages/:room', authenticateAdminToken, async (req, res) => {
    const { room } = req.params;
    try {
        await db.query('DELETE FROM messages WHERE room = $1', [room]);
        res.json({ message: `Chat messages for room '${room}' have been deleted successfully.` });
    } catch (err) {
        console.error(`Admin clear chat room '${room}' error:`, err);
        return res.status(500).json({ message: `An unexpected error occurred while clearing chat messages for room '${room}'.` });
    }
});

// Admin: Get player growth chart data
router.get('/stats/player-growth', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                DATE_TRUNC('day', createdat) as date,
                COUNT(*) as new_players
            FROM players 
            WHERE createdat >= NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', createdat)
            ORDER BY date ASC
        `);
        
        const data = result.rows.map(row => ({
            date: new Date(row.date).toISOString().split('T')[0],
            players: parseInt(row.new_players)
        }));
        
        res.json(data);
    } catch (err) {
        console.error('Player growth chart error:', err);
        res.status(500).json({ message: 'Error fetching player growth data' });
    }
});

// Admin: Get game activity chart data
router.get('/stats/game-activity', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                DATE_TRUNC('day', timestamp) as date,
                COUNT(*) as games_played
            FROM scores 
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            AND mode != 'admin_added'
            GROUP BY DATE_TRUNC('day', timestamp)
            ORDER BY date ASC
        `);
        
        const data = result.rows.map(row => ({
            date: new Date(row.date).toISOString().split('T')[0],
            games: parseInt(row.games_played)
        }));
        
        res.json(data);
    } catch (err) {
        console.error('Game activity chart error:', err);
        res.status(500).json({ message: 'Error fetching game activity data' });
    }
});

// Admin: Get score distribution chart data
router.get('/stats/score-distribution', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`
            WITH score_ranges AS (
                SELECT 
                    CASE 
                        WHEN score < 100 THEN '0-99'
                        WHEN score < 500 THEN '100-499'
                        WHEN score < 1000 THEN '500-999'
                        WHEN score < 2000 THEN '1000-1999'
                        WHEN score < 5000 THEN '2000-4999'
                        ELSE '5000+'
                    END as score_range
                FROM scores 
                WHERE mode != 'admin_added'
            )
            SELECT 
                score_range,
                COUNT(*) as count
            FROM score_ranges
            GROUP BY score_range
            ORDER BY 
                CASE score_range
                    WHEN '0-99' THEN 1
                    WHEN '100-499' THEN 2
                    WHEN '500-999' THEN 3
                    WHEN '1000-1999' THEN 4
                    WHEN '2000-4999' THEN 5
                    WHEN '5000+' THEN 6
                END
        `);
        
        const data = result.rows.map(row => ({
            range: row.score_range,
            count: parseInt(row.count)
        }));
        
        res.json(data);
    } catch (err) {
        console.error('Score distribution chart error:', err);
        res.status(500).json({ message: 'Error fetching score distribution data' });
    }
});

// Admin: Get top countries chart data
router.get('/stats/top-countries', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                country,
                COUNT(*) as player_count
            FROM players 
            WHERE country IS NOT NULL AND country != ''
            GROUP BY country
            ORDER BY player_count DESC
            LIMIT 10
        `);
        
        const data = result.rows.map(row => ({
            country: row.country,
            players: parseInt(row.player_count)
        }));
        
        res.json(data);
    } catch (err) {
        console.error('Top countries chart error:', err);
        res.status(500).json({ message: 'Error fetching top countries data' });
    }
});

// Admin: Toggle influencer status for a player
router.put('/player/:id/toggle-influencer', authenticateAdminToken, async (req, res) => {
    const { id: playerId } = req.params;
    const { isInfluencer } = req.body;

    if (typeof isInfluencer !== 'boolean') {
        return res.status(400).json({ message: 'isInfluencer must be a boolean value.' });
    }

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // Check if player exists
        const playerResult = await client.query('SELECT username FROM players WHERE id = $1', [playerId]);
        if (playerResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Player not found.' });
        }
        const username = playerResult.rows[0].username;

        if (isInfluencer) {
            // Try to insert or update as active influencer
            const existingInfluencer = await client.query('SELECT id FROM influencers WHERE player_id = $1', [playerId]);
            if (existingInfluencer.rowCount === 0) {
                // Insert new influencer
                const newInfluencerId = `influencer_${Date.now()}`;
                const referralCode = username.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.random().toString(36).substring(2, 6);
                const createdAt = new Date().toISOString();

                await client.query(
                    `INSERT INTO influencers (id, player_id, status, referral_code, created_at) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [newInfluencerId, playerId, 'active', referralCode, createdAt]
                );
                logger.info(`Player ${username} (${playerId}) promoted to active influencer.`, { influencerId: newInfluencerId });
            } else {
                // Update existing influencer to active
                await client.query('UPDATE influencers SET status = $1 WHERE player_id = $2', ['active', playerId]);
                logger.info(`Influencer status for ${username} (${playerId}) set to active.`, { influencerId: existingInfluencer.rows[0].id });
            }
        } else {
            // Set influencer status to inactive or delete
            // Choosing to set to inactive to retain historical data
            const existingInfluencer = await client.query('SELECT id FROM influencers WHERE player_id = $1', [playerId]);
            if (existingInfluencer.rowCount > 0) {
                await client.query('UPDATE influencers SET status = $1 WHERE player_id = $2', ['inactive', playerId]);
                logger.info(`Influencer status for ${username} (${playerId}) set to inactive.`, { influencerId: existingInfluencer.rows[0].id });
            } else {
                logger.warn(`Attempted to revoke influencer status for ${username} (${playerId}), but no existing influencer record found.`, { playerId });
            }
        }

        await client.query('COMMIT');
        
        logAdminActivity(req.user.id, 'TOGGLE_INFLUENCER', {
            userId: playerId,
            status: isInfluencer ? 'active' : 'inactive'
        }, req);

        res.json({ 
            message: `Influencer status for ${username} ${isInfluencer ? 'granted' : 'revoked'}.`,
            isInfluencer: isInfluencer // Reflect the requested state
        });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        logger.error('Admin toggle influencer status error:', { 
            error: err.message,
            stack: err.stack,
            playerId: playerId,
            isInfluencer: isInfluencer
        });
        res.status(500).json({ message: 'An unexpected error occurred while updating influencer status.' });
    } finally {
        if (client) client.release();
    }
});

// Admin: Get all submitted influencer content
router.get('/content', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                ic.id, 
                ic.content_url, 
                ic.submitted_at, 
                ic.is_verified,
                p.username as influencer_username
            FROM 
                influencer_content ic
            JOIN 
                influencers i ON ic.influencer_id = i.id
            JOIN 
                players p ON i.player_id = p.id
            ORDER BY 
                ic.submitted_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        logger.error('Admin get content error:', { error: err.message, stack: err.stack });
        return res.status(500).json({ message: 'An unexpected error occurred while fetching content.' });
    }
});

// Admin: Verify a piece of content
router.put('/content/:id/verify', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            `UPDATE influencer_content SET is_verified = TRUE WHERE id = $1 RETURNING id`,
            [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Content submission not found' });
        }
        logAdminActivity(req.user.id, 'VERIFY_CONTENT', { contentId: id }, req);
        res.json({ message: 'Content verified successfully' });
    } catch (err) {
        logger.error('Admin verify content error:', { error: err.message, stack: err.stack });
        return res.status(500).json({ message: 'An unexpected error occurred while verifying content.' });
    }
});

// --- Influencer Management API ---

// Admin: Add a player as an influencer
router.post('/influencers', adminOperationsLimiter, authenticateAdminToken, async (req, res) => {
    const { playerId, solanaWalletAddress, twitterHandle } = req.body;

    if (!playerId) {
        return res.status(400).json({ message: 'Player ID is required.' });
    }

    try {
        // Check if the player exists
        const playerResult = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
        if (playerResult.rowCount === 0) {
            return res.status(404).json({ message: 'Player not found.' });
        }

        // Check if they are already an influencer
        const existingInfluencer = await db.query('SELECT * FROM influencers WHERE player_id = $1', [playerId]);
        if (existingInfluencer.rowCount > 0) {
            return res.status(409).json({ message: 'This player is already registered as an influencer.' });
        }

        const newInfluencerId = `influencer_${Date.now()}`;
        const referralCode = playerResult.rows[0].username.toLowerCase() + Math.random().toString(36).substring(2, 6);
        const createdAt = new Date().toISOString();

        const result = await db.query(
            `INSERT INTO influencers (id, player_id, solana_wallet_address, twitter_handle, referral_code, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [newInfluencerId, playerId, solanaWalletAddress, twitterHandle, referralCode, createdAt]
        );

        logAdminActivity(req.user.id, 'ADD_INFLUENCER', { influencerId: newInfluencerId, playerId }, req);

        res.status(201).json({ message: 'Influencer added successfully.', influencer: result.rows[0] });
    } catch (err) {
        logger.error('Admin add influencer error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'An unexpected error occurred while adding the influencer.' });
    }
});

// Admin: Get all influencers
router.get('/influencers', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                i.id, i.player_id, i.solana_wallet_address, i.twitter_handle, i.status, i.referral_code, i.total_referrals, i.created_at,
                p.username, p.country, p.avatarurl
            FROM influencers i
            JOIN players p ON i.player_id = p.id
            ORDER BY i.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        logger.error('Admin get influencers error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'An unexpected error occurred while fetching influencers.' });
    }
});

// Admin: Update an influencer
router.put('/influencers/:id', adminOperationsLimiter, authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    const { solanaWalletAddress, twitterHandle, status } = req.body;

    try {
        const result = await db.query(
            `UPDATE influencers 
             SET solana_wallet_address = $1, twitter_handle = $2, status = $3 
             WHERE id = $4 RETURNING *`,
            [solanaWalletAddress, twitterHandle, status, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Influencer not found.' });
        }

        logAdminActivity(req.user.id, 'UPDATE_INFLUENCER', { influencerId: id, ...req.body }, req);

        res.json({ message: 'Influencer updated successfully.', influencer: result.rows[0] });
    } catch (err) {
        logger.error('Admin update influencer error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'An unexpected error occurred while updating the influencer.' });
    }
});

// Admin: Delete an influencer
router.delete('/influencers/:id', adminOperationsLimiter, authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        // We only need to delete from the 'influencers' table. The 'ON DELETE CASCADE' will handle the rest.
        const result = await db.query('DELETE FROM influencers WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Influencer not found.' });
        }

        logAdminActivity(req.user.id, 'DELETE_INFLUENCER', { influencerId: id }, req);

        res.json({ message: 'Influencer deleted successfully.' });
    } catch (err) {
        logger.error('Admin delete influencer error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'An unexpected error occurred while deleting the influencer.' });
    }
});

module.exports = { router };