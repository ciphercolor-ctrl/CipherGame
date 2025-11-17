const { DEFAULT_CHAT_ROOM, CHAT_MESSAGE_COOLDOWN, isValidChatRoom } = require('../constants');
const db = require('../db');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { t } = require('../i18n');
const logger = require('../logger');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Store connected users and their rooms
const connectedUsers = new Map(); // Map<socket.id, { playerId, username, country, avatarUrl, room }>
const typingUsers = new Map(); // Map<room, Set<username>>
const lastMessageTime = new Map();

// NEW: Function to get fake chat language from settings
async function getFakeChatLangSetting() {
    try {
        const result = await db.query(`SELECT value FROM settings WHERE key = 'fakeChatLang'`);
        if (result.rows.length > 0) {
            return result.rows[0].value;
        }
    } catch (error) {
        logger.error('Error fetching fakeChatLang setting:', { error: error.message });
    }
    return 'en'; // Default to English if not found or error
}

module.exports = function(io) {
    io.on('connection', async (socket) => {
        socket.lang = await getFakeChatLangSetting(); // NEW: Get fake chat language from DB

        logger.debug('🔌 User connected to chat', {
            socketId: socket.id,
            ip: socket.handshake.address,
            initialLang: socket.lang // Log the language being used
        });

        // Store user's current room
        let currentRoom = DEFAULT_CHAT_ROOM; // Default room

        socket.on('joinRoom', async ({ playerId, username, room }) => { // avatarUrl removed from client payload
            try {
                // --- SERVER-SIDE AUTHENTICATION OF PLAYER DATA ---
                const playerResult = await db.query('SELECT level, country, avatarurl FROM players WHERE id = $1', [playerId]);
                if (playerResult.rows.length === 0) {
                    logger.warn('Authentication failed: Player not found', {
                        playerId: playerId,
                        socketId: socket.id
                    });
                    socket.emit('error', { message: t(lang, 'errorPlayerNotFound') });
                    return;
                }
                const { level, country, avatarurl } = playerResult.rows[0];
                logger.debug('User attempting to join room', {
                    username: username,
                    level: level,
                    room: room,
                    socketId: socket.id
                });
                // --- END SERVER-SIDE AUTHENTICATION ---

                const oldRoom = socket.currentRoom;
                const targetRoom = room || DEFAULT_CHAT_ROOM;

                // If user is already in the target room, do nothing.
                if (oldRoom === targetRoom) {
                    logger.debug('User already in room', { username, room: targetRoom });
                    return;
                }

                if (!isValidChatRoom(targetRoom)) {
                    logger.warn('Invalid room attempt', {
                        room: targetRoom,
                        username: username,
                        socketId: socket.id
                    });
                    socket.emit('error', { message: t(lang, 'errorInvalidRoom') });
                    return;
                }

                // Leave the old room and notify its members
                if (oldRoom) {
                    socket.leave(oldRoom);
                    if (typingUsers.has(oldRoom)) {
                        typingUsers.get(oldRoom).delete(username);
                        io.to(oldRoom).emit('typingUpdate', Array.from(typingUsers.get(oldRoom)));
                    }
                    // Get the user list for the old room, making sure to exclude the user who is leaving.
                    const usersInOldRoom = Array.from(connectedUsers.values())
                        .filter(user => user.room === oldRoom && user.playerId !== playerId)
                        .map(({ playerId, username, country, avatarUrl, level }) => ({ playerId, username, country, avatarUrl, level }));
                    io.to(oldRoom).emit('userListUpdate', usersInOldRoom);
                }

                // Join the new room and update the user's state
                socket.join(targetRoom);
                socket.currentRoom = targetRoom;
                socket.playerId = playerId;
                socket.username = username;
                socket.avatarUrl = avatarurl; // Use avatarurl from DB
                socket.level = level; // Use level from DB
                socket.country = country; // Use country from DB

                const newUser = { playerId, username, avatarUrl: avatarurl, room: targetRoom, level: socket.level, country: socket.country };
                connectedUsers.set(socket.id, newUser);
                logger.info('User joined/switched room', {
                    username: username,
                    from: oldRoom || 'N/A',
                    to: targetRoom,
                    socketId: socket.id
                });

                // Notify the new room with the full user list
                const usersInNewRoom = Array.from(connectedUsers.values())
                    .filter(user => user.room === targetRoom)
                    .map(({ playerId, username, country, avatarUrl, level }) => ({ playerId, username, country, avatarUrl, level }));

                io.to(targetRoom).emit('userListUpdate', usersInNewRoom);

            } catch (err) {
                logger.error('Error during joinRoom', {
                    error: err.message,
                    stack: err.stack,
                    socketId: socket.id
                });
                socket.emit('error', { message: t(lang, 'errorJoinRoom') });
            }
        });

        socket.on('sendMessage', async (msg) => {
            const { text, username, playerId, replyTo } = msg; // Added replyTo
            const room = socket.currentRoom || DEFAULT_CHAT_ROOM;
            logger.debug('Message sent to room', {
                room: room,
                username: username,
                messageLength: text.length,
                replyTo: replyTo
            });

            if (typingUsers.has(room)) {
                typingUsers.get(room).delete(username);
                io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
            }

            const now = Date.now();
            if (lastMessageTime.has(playerId) && (now - lastMessageTime.get(playerId) < CHAT_MESSAGE_COOLDOWN)) {
                socket.emit('message', { username: 'System', message: t(lang, 'errorSocketMessageRateLimit'), timestamp: new Date().toISOString(), isSystem: true });
                return;
            }
            lastMessageTime.set(playerId, now);

            if (!text || !username || !playerId) {
                return;
            }

            const messageType = 'text';

            try {
                const avatarUrl = socket.avatarUrl || 'assets/logo.jpg';
                const level = socket.level || 1;
                const timestamp = new Date().toISOString();
                const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const sanitizedText = DOMPurify.sanitize(text);

                const messageData = {
                    id: messageId,
                    senderId: playerId,
                    username,
                    message: sanitizedText,
                    timestamp,
                    room,
                    avatarUrl,
                    type: messageType,
                    level,
                    replyTo: null // Initialize replyTo as null
                };

                // If it's a reply, fetch the original message to include in the broadcast
                if (replyTo) {
                    const repliedMessageResult = await db.query('SELECT id, username, message FROM messages WHERE id = $1', [replyTo]);
                    if (repliedMessageResult.rows.length > 0) {
                        messageData.replyTo = repliedMessageResult.rows[0];
                    }
                }

                // Save the message to the database, including the replyTo ID
                await db.query(
                    `INSERT INTO messages (id, senderId, username, message, type, timestamp, room, replyto) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [messageId, playerId, username, sanitizedText, messageType, timestamp, room, replyTo || null]
                );

                // Emit the complete message data (with replied message object) to the room
                io.to(room).emit('message', messageData);
                logger.debug('Message broadcasted to room', {
                    room: room,
                    username: username,
                    messageId: messageId
                });

            } catch (err) {
                logger.error('Socket.IO sendMessage error', {
                    error: err.message,
                    stack: err.stack,
                    socketId: socket.id,
                    room: room
                });
                socket.emit('message', {
                    isSystem: true,
                    username: 'System',
                    message: t(lang, 'errorSocketSend'),
                    timestamp: new Date().toISOString(),
                    room: room
                });
            }
        });

        socket.on('typing', ({ username, room }) => {
            if (!typingUsers.has(room)) {
                typingUsers.set(room, new Set());
            }
            typingUsers.get(room).add(username);
            io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
        });

        socket.on('stopTyping', ({ username, room }) => {
            if (typingUsers.has(room)) {
                typingUsers.get(room).delete(username);
                io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
            }
        });

        socket.on('avatarUpdated', ({ avatarUrl }) => {
            const user = connectedUsers.get(socket.id);
            if (user) {
                user.avatarUrl = avatarUrl;
                socket.avatarUrl = avatarUrl; // Also update it on the socket object itself
                connectedUsers.set(socket.id, user);
                // Broadcast the specific update to the room
                io.to(user.room).emit('userProfileUpdated', { 
                    playerId: user.playerId, 
                    avatarUrl: user.avatarUrl, 
                    level: user.level // Include other fields that might change
                });
                logger.info('User updated avatar', {
                    username: user.username,
                    socketId: socket.id,
                    newAvatarUrl: avatarUrl
                });
            }
        });

        socket.on('disconnect', () => {
            logger.debug('User disconnected from chat', {
                socketId: socket.id,
                username: socket.username || 'unknown'
            });
            const user = connectedUsers.get(socket.id);
            if (user) {
                const room = user.room;
                connectedUsers.delete(socket.id);

                if (typingUsers.has(room)) {
                    typingUsers.get(room).delete(user.username);
                    io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
                }

                const usersInRoom = Array.from(connectedUsers.values())
                    .filter(u => u.room === room)
                    .map(({ playerId, username, country, avatarUrl, level }) => ({ playerId, username, country, avatarUrl, level }));

                io.to(room).emit('userListUpdate', usersInRoom);
            }
        });

        socket.on('leaveRoom', () => {
            const user = connectedUsers.get(socket.id);
            if (user && user.room) { // Check if user exists and is actually in a room
                const room = user.room;
                logger.info('User left room', {
                    username: user.username,
                    room: room,
                    socketId: socket.id
                });

                // Update the user's state to show they are not in a room
                user.room = null;
                connectedUsers.set(socket.id, user);
                socket.currentRoom = null; // Also update the socket's own state
                socket.leave(room);

                if (typingUsers.has(room)) {
                    typingUsers.get(room).delete(user.username);
                    io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
                }

                // Notify the room that the user has left by sending the new list
                const usersInRoom = Array.from(connectedUsers.values())
                    .filter(u => u.room === room)
                    .map(({ playerId, username, country, avatarUrl, level }) => ({ playerId, username, country, avatarUrl, level }));

                io.to(room).emit('userListUpdate', usersInRoom);
            }
        });
    });
};
