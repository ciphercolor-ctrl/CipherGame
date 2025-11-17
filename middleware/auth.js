const jwt = require('jsonwebtoken');
const db = require('../db');
const { t } = require('../i18n');
const logger = require('../logger'); // logger modülünü import et

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set. Please set it for security.');
    process.exit(1);
}

function authenticateToken(req, res, next) {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
         return res.status(401).json({ message: t(lang, 'errorAuthInvalidToken') });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: t(lang, 'errorAuthInvalidToken') });
        }
        req.user = user;
        next();
    });
}

function authenticateAdminToken(req, res, next) {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: t(lang, 'errorAuthInvalidToken') });
    }

    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
        return res.status(401).json({ message: t(lang, 'errorAuthInvalidToken') });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn('Invalid admin token attempt', { ip: req.ip, userAgent: req.headers['user-agent'], timestamp: new Date().toISOString() });
            return res.status(403).json({ message: t(lang, 'errorAuthInvalidToken') });
        }

        if (user.role !== 'admin') {
            console.warn('Unauthorized admin access attempt', { userId: user.id, role: user.role, ip: req.ip, userAgent: req.headers['user-agent'], timestamp: new Date().toISOString() });
            return res.status(403).json({ message: t(lang, 'errorAuthInvalidToken') });
        }

        req.user = user;
        next();
    });
}

function softAuthenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        req.user = { isGuest: true };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = { isGuest: true };
        } else {
            req.user = user;
        }
        next();
    });
}

async function checkInfluencer(req, res, next) {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    if (!req.user || !req.user.id) {
        logger.warn('checkInfluencer: No user ID in token.', { ip: req.ip });
        return res.status(401).json({ message: t(lang, 'errorAuthInvalidToken') });
    }

    logger.debug(`checkInfluencer: Checking user ID ${req.user.id} for influencer status.`);

    try {
        const result = await db.query('SELECT id, status FROM influencers WHERE player_id = $1 AND status = \'active\'', [req.user.id]);
        
        if (result.rows.length === 0) {
            logger.warn(`checkInfluencer: User ID ${req.user.id} is not an active influencer.`, { dbResult: result.rows });
            return res.status(403).json({ message: 'Access forbidden: Active influencer privileges required.' });
        }

        // Attach influencer-specific ID to the request for later use
        req.influencer = { id: result.rows[0].id }; 
        logger.debug(`checkInfluencer: User ID ${req.user.id} is an active influencer. Influencer ID: ${req.influencer.id}`);
        next();
    } catch (error) {
        logger.error('Error in checkInfluencer middleware:', { 
            error: error.message,
            stack: error.stack,
            userId: req.user.id,
            ip: req.ip
        });
        res.status(500).json({ message: 'Internal server error during authorization check.' });
    }
}

module.exports = { authenticateToken, authenticateAdminToken, softAuthenticateToken, checkInfluencer };