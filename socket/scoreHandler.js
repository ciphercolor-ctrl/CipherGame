const db = require('../db');
const logger = require('../logger');
const { t } = require('../i18n');

/**
 * Socket.IO Score Handler
 * Handles real-time score updates and leaderboard notifications
 */
module.exports = function(io) {
    // Store connected users for score updates
    const connectedUsers = new Map(); // Map<socket.id, { playerId, username, room }>

    io.on('connection', (socket) => {
        const lang = socket.handshake.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
        logger.debug('🔌 User connected to score system', {
            socketId: socket.id,
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent'],
            timestamp: new Date().toISOString()
        });

        // User joins score tracking room
        socket.on('joinScoreRoom', async ({ playerId, username }) => {
            try {
                console.log(`[ScoreHandler] User ${username} (${playerId}) attempting to join score room`);
                
                // Verify user exists in database
                const playerResult = await db.query('SELECT id, username, level, country, avatarUrl FROM players WHERE id = $1', [playerId]);
                if (playerResult.rows.length === 0) {
                    console.log(`[ScoreHandler] ❌ Player ${playerId} not found in database`);
                    logger.warn('Score room join failed: Player not found', {
                        playerId: playerId,
                        socketId: socket.id
                    });
                    socket.emit('scoreError', { message: t(lang, 'errorPlayerNotFound') });
                    return;
                }

                const playerData = playerResult.rows[0];
                
                // Join global score room for all score updates
                socket.join('scoreUpdates');
                
                // Store user connection
                connectedUsers.set(socket.id, {
                    playerId: playerId,
                    username: username,
                    room: 'scoreUpdates'
                });

                socket.playerId = playerId;
                socket.username = username;

                console.log(`[ScoreHandler] ✅ User ${username} (${playerId}) joined score room`);
                logger.info('User joined score room', {
                    username: username,
                    playerId: playerId,
                    socketId: socket.id
                });

                // Send current leaderboard data to newly connected user
                socket.emit('leaderboardUpdate', {
                    type: 'initial',
                    message: t(lang, 'infoConnectedToLiveScores')
                });

            } catch (err) {
                console.error('[ScoreHandler] Error during joinScoreRoom:', err);
                logger.error('Error during joinScoreRoom', {
                    error: err.message,
                    stack: err.stack,
                    socketId: socket.id
                });
                socket.emit('scoreError', { message: t(lang, 'errorFailedToJoinScoreRoom') });
            }
        });



        // Handle leaderboard refresh requests
        socket.on('requestLeaderboardUpdate', async () => {
            try {
                logger.debug('Leaderboard update requested', {
                    socketId: socket.id,
                    playerId: socket.playerId
                });

                // Broadcast leaderboard refresh to all users
                io.to('scoreUpdates').emit('leaderboardUpdate', {
                    type: 'refresh',
                    message: t(lang, 'infoLeaderboardUpdated'),
                    timestamp: new Date().toISOString()
                });

            } catch (err) {
                logger.error('Error handling leaderboard update request', {
                    error: err.message,
                    stack: err.stack,
                    socketId: socket.id
                });
            }
        });

        // Handle user disconnection
        socket.on('disconnect', (reason) => {
            logger.debug('User disconnected from score system', {
                socketId: socket.id,
                username: socket.username || 'unknown',
                reason: reason,
                timestamp: new Date().toISOString()
            });
            
            connectedUsers.delete(socket.id);
        });

        // Handle connection errors
        socket.on('error', (error) => {
            logger.error('Socket error in score system', {
                socketId: socket.id,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        });
    });

    // Function to broadcast score updates (called from score routes)
    function broadcastScoreUpdate(scoreData) {
        try {
            console.log(`[ScoreHandler] 📡 Broadcasting score update: ${scoreData.username} scored ${scoreData.score}`);
            
            io.to('scoreUpdates').emit('newScore', {
                playerId: scoreData.playerId,
                username: scoreData.username,
                score: scoreData.score,
                mode: scoreData.mode,
                newLevel: scoreData.newLevel,
                timestamp: new Date().toISOString()
            });



            console.log(`[ScoreHandler] ✅ Score update broadcasted to score room`);
            logger.debug('Score update broadcasted', {
                playerId: scoreData.playerId,
                score: scoreData.score
            });

        } catch (err) {
            console.error('[ScoreHandler] Error broadcasting score update:', err);
            logger.error('Error broadcasting score update', {
                error: err.message,
                stack: err.stack
            });
        }
    }

    // Function to broadcast leaderboard refresh
    function broadcastLeaderboardRefresh() {
        try {
            io.to('scoreUpdates').emit('leaderboardUpdate', {
                type: 'refresh',
                message: t('en', 'infoLeaderboardRefreshed'),
                timestamp: new Date().toISOString()
            });

            logger.debug('Leaderboard refresh broadcasted');

        } catch (err) {
            logger.error('Error broadcasting leaderboard refresh', {
                error: err.message,
                stack: err.stack
            });
        }
    }

    // Export functions for use in other modules
    return {
        broadcastScoreUpdate,
        broadcastLeaderboardRefresh
    };
};
