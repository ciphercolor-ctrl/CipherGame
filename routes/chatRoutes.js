module.exports = (io) => {
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { MESSAGE_MAX_LENGTH } = require('../constants');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { t } = require('../i18n');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Rate limiting for chat operations
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 chat operations per minute
    message: t('en', 'errorSocketMessageRateLimit'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Edit a chat message
router.put('/messages/:id', chatLimiter, authenticateToken, async (req, res) => {
    const { id } = req.params;
    let { message } = req.body;
    const senderId = req.user.id;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ message: t(lang, 'errorChatMessageEmpty') });
    }
    if (message.length > MESSAGE_MAX_LENGTH) {
        return res.status(400).json({ message: t(lang, 'errorChatMessageTooLong', { maxLength: MESSAGE_MAX_LENGTH }) });
    }

    // Sanitize the message to prevent XSS attacks
    message = DOMPurify.sanitize(message);

    try {
        const result = await db.query(`SELECT senderId, room FROM messages WHERE id = $1`, [id]);
        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ message: t(lang, 'errorChatMessageNotFound') });
        }
        if (String(row.senderid) !== String(senderId)) {
            return res.status(403).json({ message: t(lang, 'errorChatDeletePermission') });
        }

        const room = row.room;
        const timestamp = new Date().toISOString();

        const updateResult = await db.query(`UPDATE messages SET message = $1, timestamp = $2 WHERE id = $3`, [message, timestamp, id]);
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: t(lang, 'errorChatMessageNotFound') });
        }
        io.to(room).emit('messageUpdated', { id, message, timestamp }); // Socket.io handled in server.js
        res.json({ message: t(lang, 'successChatMessageUpdated'), id, message, timestamp });
    } catch (err) {
        console.error('Chat message update error:', err);
        return res.status(500).json({ message: t(lang, 'errorChatEdit') });
    }
});

// Delete a chat message
router.delete('/messages/:id', chatLimiter, authenticateToken, async (req, res) => {
    const { id } = req.params;
    const senderId = req.user.id;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    try {
        const result = await db.query(`SELECT senderId, room FROM messages WHERE id = $1`, [id]);
        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ message: t(lang, 'errorChatMessageNotFound') });
        }
        if (String(row.senderid) !== String(senderId)) {
            return res.status(403).json({ message: t(lang, 'errorChatDeletePermission') });
        }

        const room = row.room;

        const deleteResult = await db.query(`DELETE FROM messages WHERE id = $1`, [id]);
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: t(lang, 'errorChatMessageNotFound') });
        }
        io.to(room).emit('messageDeleted', { id }); // Socket.io handled in server.js
        res.json({ message: t(lang, 'successChatMessageDeleted'), id });
    } catch (err) {
        console.error('Chat message delete error:', err);
        return res.status(500).json({ message: t(lang, 'errorChatDelete') });
    }
});

// Get chat history
router.get('/history/:room', authenticateToken, async (req, res) => {
    const room = req.params.room;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    try {
        const result = await db.query(`
            SELECT 
                m.id, 
                m.senderId AS "senderId", 
                m.username, 
                m.message, 
                m.type, 
                m.timestamp, 
                m.room, 
                m.replyto,
                p.avatarurl AS "avatarUrl", 
                p.level,
                replied.username AS "replyToUsername",
                replied.message AS "replyToMessage"
            FROM messages m
            JOIN players p ON m.senderId = p.id
            LEFT JOIN messages replied ON m.replyto = replied.id
            WHERE m.room = $1
            ORDER BY m.timestamp DESC
            LIMIT $2 OFFSET $3
        `, [room, limit, offset]);

        const rows = result.rows.map(row => {
            if (row.timestamp && typeof row.timestamp === 'string') {
                row.timestamp = row.timestamp.replace(' ', 'T') + 'Z';
            }
            
            let replyToObject = null;
            if (row.replyto) {
                replyToObject = {
                    id: row.replyto,
                    username: row.replyToUsername,
                    message: row.replyToMessage
                };
            }

            return {
                id: row.id,
                senderId: row.senderId,
                username: row.username,
                message: row.message,
                type: row.type,
                timestamp: row.timestamp,
                room: row.room,
                avatarUrl: row.avatarUrl,
                level: row.level,
                replyTo: replyToObject
            };
        });

        res.json(rows.reverse());
    } catch (err) {
        console.error('Chat history fetch error:', err);
        return res.status(500).json({ message: t(lang, 'failedToLoadChatHistory') });
    }
});

// Get distinct chat rooms
router.get('/rooms', authenticateToken, async (req, res) => {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    try {
        const result = await db.query(`SELECT DISTINCT room FROM messages`);
        const rooms = result.rows.map(row => row.room.trim());
        res.json(rooms);
    } catch (err) {
        console.error('Chat rooms fetch error:', err);
        return res.status(500).json({ message: t(lang, 'failedToLoadChatRooms') });
    }
});

return router;
};
