/**
 * Score Socket Handler
 * Handles real-time score updates and leaderboard notifications
 */

class ScoreSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.lastLeaderboardRefresh = 0;
        this.notificationQueue = [];
        this.maxNotifications = 3; // Maximum concurrent notifications
    }

    // Initialize socket connection for score updates
    init() {
        console.log('[ScoreSocket] Initializing score socket...');
        console.log('[ScoreSocket] Current gameState:', {
            isLoggedIn: gameState?.isLoggedIn,
            playerId: gameState?.playerId,
            username: gameState?.username
        });
        
        // Prevent multiple socket connections
        if (this.socket && this.isConnected) {
            console.log('[ScoreSocket] Already connected, skipping initialization');
            return;
        }

        if (!gameState || !gameState.isLoggedIn) {
            console.warn('[ScoreSocket] User not logged in, cannot initialize');
            return;
        }

        try {
            // Connect to score room with enhanced configuration
            console.log('[ScoreSocket] Creating socket connection...');
            this.socket = io({
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 10000,
                forceNew: false
            });
            window.socket = this.socket; // Expose socket globally

            // Notify other scripts that the socket is ready
            document.dispatchEvent(new Event('socketReady'));
            
            this.setupEventListeners();
            this.connectToScoreRoom();
            
            console.log('[ScoreSocket] Score socket initialization completed');
        } catch (error) {
            console.error('[ScoreSocket] Failed to initialize:', error);
            this.handleConnectionError(error);
        }
    }

    // Setup socket event listeners
    setupEventListeners() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('[ScoreSocket] ✅ Connected to server');
            
            // Rejoin score room on reconnection
            this.connectToScoreRoom();
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.log('[ScoreSocket] ❌ Disconnected from server');
        });

        this.socket.on('connect_error', (error) => {
            console.error('[ScoreSocket] Connection error:', error);
            this.handleReconnection();
        });

        // Listen for new score updates
        this.socket.on('newScore', (data) => {
            console.log('[ScoreSocket] 🎯 New score received:', data);
            this.handleNewScore(data);
        });

        // Listen for leaderboard updates
        this.socket.on('leaderboardUpdate', (data) => {
            console.log('[ScoreSocket] 📊 Leaderboard update received:', data);
            this.handleLeaderboardUpdate(data);
        });

        // Listen for score errors with enhanced handling
        this.socket.on('scoreError', (data) => {
            console.error('[ScoreSocket] Score error:', data);
            
            // Show user-friendly error message
            const errorMessage = this.getErrorMessage(data);
            this.showScoreNotification(errorMessage, 'error', 5000);
            
            // Log error for debugging
            if (window.IS_DEVELOPMENT) {
                logger.error('[ScoreSocket] Score error details:', data);
            }
        });

        // Listen for connection errors
        this.socket.on('connect_error', (error) => {
            console.error('[ScoreSocket] Connection error:', error);
            this.handleConnectionError(error);
        });

        // Listen for reconnection attempts
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`[ScoreSocket] Reconnection attempt ${attemptNumber}`);
            this.showScoreNotification(`Yeniden bağlanılıyor... (${attemptNumber}/5)`, 'info', 2000);
        });

        // Listen for successful reconnection
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`[ScoreSocket] Successfully reconnected after ${attemptNumber} attempts`);
            this.showScoreNotification('Bağlantı yeniden kuruldu! 🎉', 'success', 3000);
        });
    }

    // Connect to score room
    connectToScoreRoom() {
        if (!this.socket || !this.isConnected || !gameState.isLoggedIn) {
            console.log('[ScoreSocket] Cannot join score room:', {
                socket: !!this.socket,
                connected: this.isConnected,
                loggedIn: gameState.isLoggedIn
            });
            return;
        }

        try {
            console.log('[ScoreSocket] Joining score room with:', {
                playerId: gameState.playerId,
                username: gameState.username
            });
            
            this.socket.emit('joinScoreRoom', {
                playerId: gameState.playerId,
                username: gameState.username
            });
            
            console.log('[ScoreSocket] ✅ Joined score room');
        } catch (error) {
            console.error('[ScoreSocket] Failed to join score room:', error);
        }
    }

    // Handle new score updates from other players
    handleNewScore(data) {
        try {
            // Log score update for monitoring
            this.logScoreUpdate('received', data);

            if (window.IS_DEVELOPMENT) {
                logger.debug('[ScoreSocket] New score received:', data);
            }

            // Don't show notifications for own scores
            if (data.playerId === gameState.playerId) {
                return;
            }

            // Smart notification system
            if (data.score >= 1000) {
                const message = `🏆 ${data.username} achieved ${data.score.toLocaleString()} points!`;
                this.showScoreNotification(message, 'success', 4000);
            } else if (data.score >= 500) {
                const message = `🎯 ${data.username} scored ${data.score.toLocaleString()} points`;
                this.showScoreNotification(message, 'info', 3000);
            }

            // Refresh casual leaderboards if the modal is open
            const casualGameModes = ['snake', 'cong', 'cetris'];
            if (casualGameModes.includes(data.mode)) {
                const casualGamesModal = document.getElementById('casualGamesModal');
                if (casualGamesModal && casualGamesModal.style.display === 'block') {
                    if (typeof window.refreshCasualLeaderboard === 'function') {
                        window.refreshCasualLeaderboard(data.mode);
                    }
                }
            }

            // Refresh main leaderboard modal if it's visible
            this.refreshLeaderboard();

            // Trigger the single, centralized function for preview updates
            if (typeof window.updateLeaderboardPreviewRealtime === 'function') {
                window.updateLeaderboardPreviewRealtime(data);
            }

            // Also trigger the refresh for the main individual leaderboard
            if (typeof window.refreshIndividualLeaderboard === 'function') {
                window.refreshIndividualLeaderboard();
            }

        } catch (error) {
            logger.error('[ScoreSocket] Error handling new score:', error);
            this.logScoreUpdate('error', { error: error.message, data });
        }
    }

    // Handle leaderboard updates
    handleLeaderboardUpdate(data) {
        try {
            if (window.IS_DEVELOPMENT) {
                logger.debug('[ScoreSocket] Leaderboard update received:', data);
            }

            // Refresh leaderboard if it's currently visible
            if (document.getElementById('leaderboardModal') && 
                document.getElementById('leaderboardModal').style.display !== 'none') {
                this.refreshLeaderboard();
            }

            // Trigger the single, centralized function for preview updates
            if (typeof window.updateLeaderboardPreviewRealtime === 'function') {
                window.updateLeaderboardPreviewRealtime(data);
            }

            // Also trigger the refresh for the main individual leaderboard
            if (typeof window.refreshIndividualLeaderboard === 'function') {
                window.refreshIndividualLeaderboard();
            }

        } catch (error) {
            logger.error('[ScoreSocket] Error handling leaderboard update:', error);
        }
    }

    // Enhanced leaderboard refresh with throttling
    refreshLeaderboard() {
        // Throttle leaderboard updates to prevent excessive calls
        if (this.lastLeaderboardRefresh && Date.now() - this.lastLeaderboardRefresh < 1000) {
            return; // Skip if refreshed less than 1 second ago
        }
        
        this.lastLeaderboardRefresh = Date.now();
        
        try {
            // Use requestAnimationFrame for smooth updates
            requestAnimationFrame(() => {
            // Refresh individual leaderboard if active
            if (document.querySelector('.tab-btn.active')?.dataset.tabType === 'individual') {
                if (typeof showIndividualLeaderboard === 'function') {
                    showIndividualLeaderboard();
                }
            }
            // Refresh country leaderboard if active
            else if (document.querySelector('.tab-btn.active')?.dataset.tabType === 'country') {
                if (typeof showCountryLeaderboard === 'function') {
                    showCountryLeaderboard();
                }
            }

            if (window.IS_DEVELOPMENT) {
                logger.debug('[ScoreSocket] Leaderboard refreshed');
            }
            });
        } catch (error) {
            logger.error('[ScoreSocket] Error refreshing leaderboard:', error);
        }
    }

    // Request leaderboard update from server
    requestLeaderboardUpdate() {
        if (this.socket && this.isConnected) {
            this.socket.emit('requestLeaderboardUpdate');
        }
    }

    // Handle reconnection attempts
    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                if (window.IS_DEVELOPMENT) {
                    logger.debug(`[ScoreSocket] Reconnection attempt ${this.reconnectAttempts}`);
                }
                this.socket.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            logger.error('[ScoreSocket] Max reconnection attempts reached');
        }
    }

    // Enhanced notification system with queue management
    showScoreNotification(message, type = 'info', duration = 3000) {
        // Check if we have too many notifications
        const existingNotifications = document.querySelectorAll('.score-notification');
        if (existingNotifications.length >= this.maxNotifications) {
            // Remove oldest notification
            const oldestNotification = existingNotifications[0];
            oldestNotification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => oldestNotification.remove(), 300);
        }

        // Create notification element with enhanced styling
        const notification = document.createElement('div');
        notification.className = `score-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    ${type === 'success' ? '🏆' : type === 'error' ? '❌' : 'ℹ️'}
                </div>
                <div class="notification-text">${message}</div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add to page with smooth animation
        document.body.appendChild(notification);

        // Auto remove after duration with smooth animation
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);

        // Add to queue for tracking
        this.notificationQueue.push({
            element: notification,
            timestamp: Date.now(),
            type: type
        });

        // Clean up old queue entries
        this.notificationQueue = this.notificationQueue.filter(item => 
            item.element.parentElement && Date.now() - item.timestamp < duration + 1000
        );
    }

    // Log score updates for monitoring and analytics
    logScoreUpdate(action, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: action,
            playerId: data.playerId || gameState?.playerId,
            username: data.username || gameState?.username,
            score: data.score,
            mode: data.mode,
            newLevel: data.newLevel,
            connectionState: this.isConnected,
            reconnectAttempts: this.reconnectAttempts
        };

        // Store in localStorage for debugging (development only)
        if (window.IS_DEVELOPMENT) {
            try {
                const logs = JSON.parse(localStorage.getItem('scoreSocketLogs') || '[]');
                logs.push(logEntry);
                
                // Keep only last 100 entries
                if (logs.length > 100) {
                    logs.splice(0, logs.length - 100);
                }
                
                localStorage.setItem('scoreSocketLogs', JSON.stringify(logs));
            } catch (error) {
                console.warn('[ScoreSocket] Failed to log to localStorage:', error);
            }
        }

        // Log to console in development
        if (window.IS_DEVELOPMENT) {
            console.log(`[ScoreSocket] ${action}:`, logEntry);
        }
    }

    // Get system status for debugging
    getSystemStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            lastLeaderboardRefresh: this.lastLeaderboardRefresh,
            activeNotifications: document.querySelectorAll('.score-notification').length,
            notificationQueue: this.notificationQueue.length,
            socketId: this.socket?.id,
            playerId: gameState?.playerId,
            username: gameState?.username
        };
    }

    // Get user-friendly error message
    getErrorMessage(errorData) {
        const errorMessages = {
            'Player not found': 'Oyuncu bulunamadı',
            'Failed to join score room': 'Skor odasına katılım başarısız',
            'Score update error': 'Skor güncelleme hatası',
            'Connection timeout': 'Bağlantı zaman aşımı',
            'Network error': 'Ağ hatası'
        };
        
        return errorMessages[errorData.message] || errorData.message || 'Bilinmeyen hata oluştu';
    }

    // Enhanced connection error handling
    handleConnectionError(error) {
        console.error('[ScoreSocket] Connection error:', error);
        this.isConnected = false;
        
        // Show user-friendly error message
        this.showScoreNotification(getTranslation('connectionErrorReconnecting'), 'error', 3000);
        
        // Attempt reconnection after delay
        setTimeout(() => {
            if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log('[ScoreSocket] Attempting reconnection...');
                this.init();
            }
        }, this.reconnectDelay * 2);
    }

    // Enhanced disconnect with cleanup
    disconnect() {
        if (this.socket) {
            console.log('[ScoreSocket] Disconnecting socket...');
            
            // Remove all event listeners to prevent memory leaks
            this.socket.removeAllListeners();
            
            // Disconnect socket
            this.socket.disconnect();
            
            // Clean up references
            this.socket = null;
            this.isConnected = false;
            this.reconnectAttempts = 0;
            
            console.log('[ScoreSocket] Socket disconnected and cleaned up');
        }
    }
}

// Create global instance
window.scoreSocketManager = new ScoreSocketManager();

// Expose debugging functions in development
if (window.IS_DEVELOPMENT) {
    window.debugScoreSocket = {
        getStatus: () => window.scoreSocketManager.getSystemStatus(),
        getLogs: () => JSON.parse(localStorage.getItem('scoreSocketLogs') || '[]'),
        clearLogs: () => localStorage.removeItem('scoreSocketLogs'),
        reconnect: () => window.scoreSocketManager.init(),
        disconnect: () => window.scoreSocketManager.disconnect()
    };
    
    console.log('[ScoreSocket] Debug functions available: window.debugScoreSocket');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('[ScoreSocket] DOM loaded, checking login status...');
    
    // Wait a bit for gameState to be initialized
    setTimeout(() => {
        if (gameState && gameState.isLoggedIn) {
            console.log('[ScoreSocket] User is logged in, initializing...');
            window.scoreSocketManager.init();
        } else {
            console.log('[ScoreSocket] User not logged in, waiting for login...');
        }
    }, 1000);
});

// Re-initialize when user logs in
document.addEventListener('userLoggedIn', () => {
    console.log('[ScoreSocket] User logged in event received, initializing...');
    window.scoreSocketManager.init();
});

// Disconnect when user logs out
document.addEventListener('userLoggedOut', () => {
    console.log('[ScoreSocket] User logged out event received, disconnecting...');
    window.scoreSocketManager.disconnect();
});

// Also try to initialize when gameState changes (fallback)
let lastLoginState = false;
setInterval(() => {
    if (gameState && gameState.isLoggedIn !== lastLoginState) {
        lastLoginState = gameState.isLoggedIn;
        if (gameState.isLoggedIn) {
            console.log('[ScoreSocket] Login state changed to logged in, initializing...');
            window.scoreSocketManager.init();
        } else {
            console.log('[ScoreSocket] Login state changed to logged out, disconnecting...');
            window.scoreSocketManager.disconnect();
        }
    }
}, 2000);
