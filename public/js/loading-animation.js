/**
 * Loading Animation Controller
 * Manages loading states, network monitoring, and user experience
 */

class LoadingAnimation {
    constructor() {
        this.overlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.isVisible = false;
        this.loadingQueue = new Set();
        this.networkStatus = 'online';
        this.slowConnectionThreshold = 2000; // 2 seconds
        this.connectionCheckInterval = null;
        this.animation3DReady = false;
        this.domReady = false;
        this.windowLoaded = false;
        this.scrollFixInterval = null; // For the layout bug fix
        
        // Loading is already shown in HTML, but we need to call show() for translation
        this.init();
        
        // Wait for translation system to be ready, then call show()
        this.waitForTranslationAndShow();
    }

    init() {
        this.overlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        
        if (!this.overlay || !this.loadingText) {
            console.error('Loading animation elements not found');
            return;
        }
        
        // Translation will be handled by show() function
        
        this.setupNetworkMonitoring();
        this.setupPageLoadHandling();
        this.setupApiInterceptors();
    }

    /**
     * Show loading animation with custom message
     * @param {string} message - Loading message to display (can be translation key)
     * @param {string} type - Type of loading (normal, network-error, slow-connection)
     */
    show(message = 'loading', type = 'normal') {
        if (!this.overlay || !this.loadingText) return;

        // Try to get translation, fallback to original message
        const translatedMessage = this.getTranslation(message);
        
        // Only update text if translation is found (not the key itself)
        if (translatedMessage !== message && translatedMessage.length > 0) {
            this.loadingText.textContent = translatedMessage;
        }
        
        this.overlay.className = `loading-overlay show ${type}`;
        this.isVisible = true;

        // Log loading state for debugging
        if (window.logger) {
            window.logger.debug(`Loading animation shown: ${translatedMessage}`);
        }
    }

    /**
     * Hide loading animation
     */
    hide() {
        // Stop the continuous scroll fix
        if (this.scrollFixInterval) {
            clearInterval(this.scrollFixInterval);
            this.scrollFixInterval = null;
        }

        if (!this.overlay) return;

        this.overlay.classList.remove('show');
        this.isVisible = false;

        // Reset overlay class after animation
        setTimeout(() => {
            this.overlay.className = 'loading-overlay';
        }, 300);

        // Start prism beam animation when loading ends
        if (typeof window.startPrismBeamAnimation === 'function') {
            console.log('Loading ended - starting prism beam animation');
            window.startPrismBeamAnimation();
        }

        if (window.logger) {
            window.logger.debug('Loading animation hidden');
        }
    }

    /**
     * Add a loading task to the queue
     * @param {string} taskId - Unique identifier for the task
     * @param {string} message - Loading message
     */
    addLoadingTask(taskId, message = 'Loading...') {
        this.loadingQueue.add(taskId);
        
        if (this.loadingQueue.size === 1) {
            this.show(message);
        }
    }

    /**
     * Remove a loading task from the queue
     * @param {string} taskId - Unique identifier for the task
     */
    removeLoadingTask(taskId) {
        this.loadingQueue.delete(taskId);
        
        if (this.loadingQueue.size === 0) {
            this.hide();
        }
    }

    /**
     * Setup network monitoring
     */
    setupNetworkMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.networkStatus = 'online';
            this.hide();
            if (window.logger) {
                window.logger.info('Network connection restored');
            }
        });

        window.addEventListener('offline', () => {
            this.networkStatus = 'offline';
            this.show('noInternetConnection', 'network-error');
            if (window.logger) {
                window.logger.warn('Network connection lost');
            }
            // Don't hide automatically - wait for connection to be restored
        });

        // Monitor connection quality
        this.startConnectionQualityMonitoring();
    }

    /**
     * Start monitoring connection quality
     */
    startConnectionQualityMonitoring() {
        this.connectionCheckInterval = setInterval(() => {
            this.checkConnectionQuality();
        }, 5000); // Check every 5 seconds
    }

    /**
     * Check connection quality by making a small request
     */
    async checkConnectionQuality() {
        if (this.networkStatus === 'offline') return;

        const startTime = Date.now();
        
        try {
            // Make a small request to check connection speed
            const response = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            if (responseTime > this.slowConnectionThreshold) {
                if (this.isVisible && !this.overlay.classList.contains('slow-connection')) {
                    this.show('slowConnectionDetected', 'slow-connection');
                }
            }
        } catch (error) {
            // Connection issues
            if (this.networkStatus === 'online') {
                this.networkStatus = 'offline';
                this.show('connectionProblems', 'network-error');
                // Don't hide automatically - wait for connection to be restored
            }
        }
    }

    /**
     * Setup page load handling
     */
    setupPageLoadHandling() {
        // Enhanced page load detection
        this.setupInitialPageLoading();

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.hide();
            }
        });
    }

    /**
     * Setup enhanced initial page loading detection
     */
    setupInitialPageLoading() {
        const self = this;
        
        // DOM ready - always set to true since we're already in DOMContentLoaded
        console.log('DOM already ready');
        this.domReady = true;
        
        // Window load
        window.addEventListener('load', () => {
            console.log('Window load event fired');
            self.windowLoaded = true;
            self.checkInitialLoadingComplete();
        });
        
        // Fallback timeout (max 3 seconds)
        setTimeout(() => {
            console.log('Fallback timeout - hiding loading animation');
            self.hide();
        }, 3000);
    }

    /**
     * Setup API interceptors for automatic loading management
     */
    setupApiInterceptors() {
        // Intercept fetch requests - but only for important operations
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = function(...args) {
            const url = args[0];
            const options = args[1] || {};
            
            // Skip loading animation for certain requests
            if (self.shouldSkipLoading(url)) {
                return originalFetch.apply(this, args);
            }

            // Only show loading for important operations
            const importantPatterns = [
                '/api/auth/login',
                '/api/auth/register',
                '/api/profile/update',
                '/api/profile/avatar',
                '/api/score/save',
                '/api/game/start',
                '/api/game/end'
            ];

            if (!importantPatterns.some(pattern => url.includes(pattern))) {
                return originalFetch.apply(this, args);
            }

            const taskId = `fetch_${Date.now()}_${Math.random()}`;
            const loadingMessage = self.getLoadingMessage(url);
            
            self.addLoadingTask(taskId, loadingMessage);

            return originalFetch.apply(this, args)
                .then(response => {
                    self.removeLoadingTask(taskId);
                    return response;
                })
                .catch(error => {
                    self.removeLoadingTask(taskId);
                    throw error;
                });
        };

        // Intercept XMLHttpRequest if available
        if (window.XMLHttpRequest) {
            const originalXHR = window.XMLHttpRequest;
            const originalOpen = originalXHR.prototype.open;
            const originalSend = originalXHR.prototype.send;

            originalXHR.prototype.open = function(method, url, ...args) {
                this._url = url;
                this._method = method;
                return originalOpen.apply(this, [method, url, ...args]);
            };

            originalXHR.prototype.send = function(...args) {
                if (!self.shouldSkipLoading(this._url)) {
                    // Only show loading for important operations
                    const importantPatterns = [
                        '/api/auth/login',
                        '/api/auth/register',
                        '/api/profile/update',
                        '/api/profile/avatar',
                        '/api/score/save',
                        '/api/game/start',
                        '/api/game/end'
                    ];

                    if (importantPatterns.some(pattern => this._url.includes(pattern))) {
                        const taskId = `xhr_${Date.now()}_${Math.random()}`;
                        const loadingMessage = self.getLoadingMessage(this._url);
                        
                        self.addLoadingTask(taskId, loadingMessage);

                        this.addEventListener('loadend', () => {
                            self.removeLoadingTask(taskId);
                        });
                    }
                }

                return originalSend.apply(this, args);
            };
        }
    }

    /**
     * Check if loading animation should be skipped for this URL
     * @param {string} url - Request URL
     * @returns {boolean}
     */
    shouldSkipLoading(url) {
        if (!url) return true;
        
        const skipPatterns = [
            '/socket.io/',
            '/api/health',
            '/favicon.ico',
            '.css',
            '.js',
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.svg',
            '.woff',
            '.woff2',
            '.ttf',
            '.mp3',
            '.wav',
            // Skip frequent/lightweight operations
            '/api/leaderboard/preview',
            '/api/chat/rooms',
            '/api/chat/users',
            '/api/chat/messages',
            '/api/profile/preview'
        ];

        // Only show loading for important operations
        const importantPatterns = [
            '/api/auth/login',
            '/api/auth/register',
            '/api/profile/update',
            '/api/profile/avatar',
            '/api/score/save',
            '/api/game/start',
            '/api/game/end'
        ];

        // If it's not an important operation, skip it
        if (!importantPatterns.some(pattern => url.includes(pattern))) {
            return true;
        }

        return skipPatterns.some(pattern => url.includes(pattern));
    }

    /**
     * Get appropriate loading message based on URL
     * @param {string} url - Request URL
     * @returns {string}
     */
    getLoadingMessage(url) {
        if (!url) return 'loading';

        if (url.includes('/api/auth/login')) return 'loggingIn';
        if (url.includes('/api/auth/register')) return 'creatingAccount';
        if (url.includes('/api/profile')) return 'loadingProfile';
        if (url.includes('/api/leaderboard')) return 'loadingLeaderboard';
        if (url.includes('/api/chat')) return 'connectingToChat';
        if (url.includes('/api/game')) return 'loadingGame';
        if (url.includes('/api/score')) return 'savingScore';
        
        return 'loading';
    }

    /**
     * Show loading for a specific duration
     * @param {number} duration - Duration in milliseconds
     * @param {string} message - Loading message
     */
    showForDuration(duration, message = 'Loading...') {
        this.show(message);
        setTimeout(() => {
            this.hide();
        }, duration);
    }

    /**
     * Signal that 3D animation is ready
     */
    signal3DAnimationReady() {
        console.log('3D Animation ready signal received');
        this.animation3DReady = true;
        this.checkInitialLoadingComplete();
    }

    /**
     * Check if initial loading is complete
     */
    checkInitialLoadingComplete() {
        console.log('Checking loading complete:', {
            domReady: this.domReady,
            windowLoaded: this.windowLoaded,
            animation3DReady: this.animation3DReady
        });
        
        // Simplified: only wait for window load
        if (this.windowLoaded) {
            console.log('Window loaded - hiding loading animation');
            setTimeout(() => {
                this.hide();
            }, 1500); // Give 1.5 seconds for 3D animation to render
        }
    }


    /**
     * Wait for translation system to be ready, then show loading with translation
     */
    waitForTranslationAndShow() {
        const checkTranslation = () => {
            // Try to get translation
            const translatedText = this.getTranslation('loadingPage');
            
            // If translation system is ready and working (translation is NOT the key itself)
            if (translatedText !== 'loadingPage' && translatedText.length > 0) {
                // Translation is ready, call show()
                this.show('loadingPage', 'initial-loading');

                // Continuously apply the fix until the loading is hidden
                if (this.scrollFixInterval) {
                    clearInterval(this.scrollFixInterval);
                }
                this.scrollFixInterval = setInterval(() => {
                    window.scrollTo(0, 1);
                    window.scrollTo(0, 0);
                }, 100);
                
                return;
            }
            
            // Translation not ready yet, try again after 100ms
            setTimeout(checkTranslation, 100);
        };
        
        // Start checking
        checkTranslation();
    }

    /**
     * Get translation for loading messages
     * @param {string} key - Translation key
     * @returns {string} - Translated text or original key if translation not found
     */
    getTranslation(key) {
        // Try to use existing translation function if available
        if (typeof window.getTranslation === 'function') {
            return window.getTranslation(key);
        }
        
        // Fallback to direct translation lookup
        if (window.currentLanguage && window.translations && window.translations[window.currentLanguage]) {
            const translation = window.translations[window.currentLanguage][key];
            if (translation) {
                return translation;
            }
        }
        
        // Return original key if no translation found
        return key;
    }

    /**
     * Cleanup method
     */
    destroy() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        this.loadingQueue.clear();
        this.hide();
    }
}

// Initialize loading animation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.loadingAnimation = new LoadingAnimation();
});

// Export for global access
window.LoadingAnimation = LoadingAnimation;