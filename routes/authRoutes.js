const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const rateLimit = require('express-rate-limit');
const { DEFAULT_AVATAR_URL, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } = require('../constants');
const { t } = require('../i18n');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET + '_refresh';

// JWT utility functions
const generateTokens = (payload) => {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' }); // Short-lived access token
    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' }); // Long-lived refresh token
    return { accessToken, refreshToken };
};

const saveRefreshToken = async (userId, refreshToken) => {
    const tokenId = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await db.query(
        `INSERT INTO refresh_tokens (id, userId, token, expiresAt) VALUES ($1, $2, $3, $4)`,
        [tokenId, userId, refreshToken, expiresAt]
    );
    
    // Clean up old refresh tokens for this user (keep only last 5)
    await db.query(
        `DELETE FROM refresh_tokens WHERE userId = $1 AND id NOT IN (
            SELECT id FROM refresh_tokens WHERE userId = $1 ORDER BY createdAt DESC LIMIT 5
        )`,
        [userId]
    );
};

// Disable rate limiting in test environment
const noopLimiter = (req, res, next) => next();

const loginLimiter = process.env.NODE_ENV === 'test' ? noopLimiter : rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login requests per windowMs
    message: t('en', 'errorAuthTooManyAttempts'),
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = process.env.NODE_ENV === 'test' ? noopLimiter : rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 register requests per windowMs
    message: t('en', 'errorAuthTooManyAttempts'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Register
router.post('/register', registerLimiter, async (req, res) => {
    const { username, password, country } = req.body;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    // Input validation
    if (!username || !password || !country) {
        return res.status(400).json({ message: t(lang, 'errorAuthAllFieldsRequired') });
    }
    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        return res.status(400).json({ message: t(lang, 'errorProfileUsernameLength') });
    }
    if (!/^[\p{L}0-9_]+$/u.test(username)) {
        return res.status(400).json({ message: t(lang, 'errorUsernameInvalidChars') });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ message: t(lang, 'errorAuthPasswordLength') });
    }
    // Basic country code validation (you might want a more robust list)
    if (country.length !== 2 || !/^[A-Z]{2}$/.test(country)) {
        return res.status(400).json({ message: t(lang, 'errorAuthInvalidCountryCode') });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const playerId = `player_${Date.now()}`;
        const createdAt = new Date().toISOString();
        const defaultAvatar = DEFAULT_AVATAR_URL;

        await db.query(`INSERT INTO players (id, username, password, country, avatarUrl, createdAt, level) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
            [playerId, username, hashedPassword, country, defaultAvatar, createdAt, 0]);
            
        const { accessToken, refreshToken } = generateTokens({ id: playerId, username: username });
        await saveRefreshToken(playerId, refreshToken);
        
        res.status(201).json({ 
            message: t(lang, 'registrationSuccess'), 
            token: accessToken, 
            refreshToken,
            playerId, 
            username, 
            country, 
            avatarUrl: defaultAvatar, 
            level: 1 
        });
    } catch (error) {
        logger.error('Registration error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            username: req.body.username
        });
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ message: t(lang, 'errorAuthUsernameExists') });
        }
        res.status(500).json({ message: t(lang, 'errorAuthRegistration') });
    }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    if (!username || !password) {
        return res.status(400).json({ message: t(lang, 'errorAuthAllFieldsRequired') });
    }
    // Basic validation for login (username and password presence)
    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        return res.status(400).json({ message: t(lang, 'errorInvalidCredentials') });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ message: t(lang, 'errorInvalidCredentials') });
    }
    try {
        const result = await db.query(`SELECT * FROM players WHERE username = $1`, [username]);
        const player = result.rows[0];
        if (!player || !await bcrypt.compare(password, player.password)) {
            return res.status(401).json({ message: t(lang, 'errorInvalidCredentials') });
        }
        const { accessToken, refreshToken } = generateTokens({ id: player.id, username: player.username });
        await saveRefreshToken(player.id, refreshToken);
        
        res.json({ 
            message: t(lang, 'loginSuccess'), 
            token: accessToken, 
            refreshToken,
            playerId: player.id, 
            username: player.username, 
            country: player.country, 
            avatarUrl: player.avatarurl, 
            level: player.level 
        });
    } catch (error) {
        logger.error('Login error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            username: req.body.username
        });
        res.status(500).json({ message: t(lang, 'errorAuthLogin') });
    }
});

router.post('/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    if (!username || !password) {
        return res.status(400).json({ message: t(lang, 'errorAuthAllFieldsRequired') });
    }
    try {
        const result = await db.query(`SELECT * FROM admins WHERE username = $1`, [username]);
        const admin = result.rows[0];
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            return res.status(401).json({ message: t(lang, 'errorInvalidCredentials') });
        }
        const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: t(lang, 'adminLoginSuccess'), token });
    } catch (error) {
        logger.error('Admin login error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            username: req.body.username
        });
        res.status(500).json({ message: t(lang, 'errorAuthLogin') });
    }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    if (!refreshToken) {
        return res.status(401).json({ message: t(lang, 'errorAuthRefreshTokenRequired') });
    }

    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        
        // Check if refresh token exists and is not revoked
        const tokenResult = await db.query(
            `SELECT * FROM refresh_tokens WHERE token = $1 AND userId = $2 AND isRevoked = FALSE AND expiresAt > NOW()`,
            [refreshToken, decoded.id]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(401).json({ message: t(lang, 'errorAuthInvalidRefreshToken') });
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens({ 
            id: decoded.id, 
            username: decoded.username 
        });

        // Save new refresh token and revoke old one
        await db.query('UPDATE refresh_tokens SET isRevoked = TRUE WHERE token = $1', [refreshToken]);
        await saveRefreshToken(decoded.id, newRefreshToken);

        res.json({ 
            token: accessToken, 
            refreshToken: newRefreshToken 
        });

    } catch (error) {
        logger.error('Refresh token error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });
        res.status(401).json({ message: t(lang, 'errorAuthRefreshTokenInvalid') });
    }
});

// Logout endpoint (revoke refresh token)
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
        try {
            await db.query('UPDATE refresh_tokens SET isRevoked = TRUE WHERE token = $1', [refreshToken]);
        } catch (error) {
            logger.error('Logout error', {
                error: error.message,
                stack: error.stack,
                ip: req.ip
            });
        }
    }
    
    res.json({ message: t(lang, 'successLogout') });
});

module.exports = router;
