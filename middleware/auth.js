const jwt = require('jsonwebtoken');
const { t } = require('../i18n');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set. Please set it for security.');
    process.exit(1);
}

function authenticateToken(req, res, next) {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: t(lang, 'errorAuthInvalidToken') });
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

    // Additional security: Check token format
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
        return res.status(401).json({ message: t(lang, 'errorAuthInvalidToken') });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Log invalid token attempts
            console.warn('Invalid admin token attempt', {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString()
            });
            return res.status(403).json({ message: t(lang, 'errorAuthInvalidToken') });
        }
        
        if (user.role !== 'admin') {
            // Log unauthorized access attempts
            console.warn('Unauthorized admin access attempt', {
                userId: user.id,
                role: user.role,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString()
            });
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

module.exports = { authenticateToken, authenticateAdminToken, softAuthenticateToken };

