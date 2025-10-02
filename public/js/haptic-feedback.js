/**
 * Haptic Feedback System for Casual Games
 * Provides vibration feedback for better mobile gaming experience
 */

class HapticFeedback {
    constructor() {
        this.isSupported = 'vibrate' in navigator;
        this.isEnabled = this.isSupported && this.getStoredPreference();
        this.intensities = {
            light: 50,
            medium: 100,
            heavy: 200,
            success: [50, 50, 50],
            error: [100, 50, 100],
            achievement: [50, 100, 50, 100, 50]
        };
    }

    /**
     * Get stored haptic preference from localStorage
     */
    getStoredPreference() {
        const stored = localStorage.getItem('hapticEnabled');
        return stored !== null ? stored === 'true' : true; // Default enabled
    }

    /**
     * Save haptic preference to localStorage
     */
    savePreference(enabled) {
        localStorage.setItem('hapticEnabled', enabled.toString());
        this.isEnabled = enabled && this.isSupported;
    }

    /**
     * Trigger haptic feedback
     */
    vibrate(pattern = 'medium') {
        if (!this.isEnabled || !this.isSupported) return;

        try {
            if (typeof pattern === 'string') {
                navigator.vibrate(this.intensities[pattern] || this.intensities.medium);
            } else if (Array.isArray(pattern)) {
                navigator.vibrate(pattern);
            } else {
                navigator.vibrate(pattern);
            }
        } catch (error) {
            console.warn('Haptic feedback failed:', error);
        }
    }

    /**
     * Game-specific haptic patterns
     */
    gameStart() {
        this.vibrate('success');
    }

    gameOver() {
        this.vibrate('error');
    }

    scorePoint() {
        this.vibrate('light');
    }

    achievement() {
        this.vibrate('achievement');
    }

    buttonPress() {
        this.vibrate('light');
    }

    collision() {
        this.vibrate('medium');
    }

    powerUp() {
        this.vibrate('success');
    }
}

// Global haptic instance
window.hapticFeedback = new HapticFeedback();

/**
 * Enhanced Touch Controls with Haptic Feedback
 */
class EnhancedTouchControls {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            sensitivity: 1.0,
            deadZone: 10,
            hapticEnabled: true,
            ...options
        };
        
        this.isActive = false;
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.callbacks = {
            onStart: null,
            onMove: null,
            onEnd: null,
            onSwipe: null
        };

        this.init();
    }

    init() {
        this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    }

    handleTouchStart(e) {
        if (this.options.hapticEnabled) {
            window.hapticFeedback.buttonPress();
        }
        
        this.isActive = true;
        const touch = e.touches[0];
        this.startPos = { x: touch.clientX, y: touch.clientY };
        this.currentPos = { x: touch.clientX, y: touch.clientY };
        
        if (this.callbacks.onStart) {
            this.callbacks.onStart(this.startPos, e);
        }
    }

    handleTouchMove(e) {
        if (!this.isActive) return;
        
        const touch = e.touches[0];
        this.currentPos = { x: touch.clientX, y: touch.clientY };
        
        const deltaX = (this.currentPos.x - this.startPos.x) * this.options.sensitivity;
        const deltaY = (this.currentPos.y - this.startPos.y) * this.options.sensitivity;
        
        if (Math.abs(deltaX) > this.options.deadZone || Math.abs(deltaY) > this.options.deadZone) {
            if (this.callbacks.onMove) {
                this.callbacks.onMove({ deltaX, deltaY, current: this.currentPos, start: this.startPos }, e);
            }
        }
    }

    handleTouchEnd(e) {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        const deltaX = (this.currentPos.x - this.startPos.x) * this.options.sensitivity;
        const deltaY = (this.currentPos.y - this.startPos.y) * this.options.sensitivity;
        
        // Detect swipe
        if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
            const direction = this.getSwipeDirection(deltaX, deltaY);
            if (this.callbacks.onSwipe) {
                this.callbacks.onSwipe(direction, { deltaX, deltaY });
            }
        }
        
        if (this.callbacks.onEnd) {
            this.callbacks.onEnd({ deltaX, deltaY }, e);
        }
    }

    getSwipeDirection(deltaX, deltaY) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (absX > absY) {
            return deltaX > 0 ? 'right' : 'left';
        } else {
            return deltaY > 0 ? 'down' : 'up';
        }
    }

    on(event, callback) {
        this.callbacks[event] = callback;
        return this;
    }

    destroy() {
        this.element.removeEventListener('touchstart', this.handleTouchStart);
        this.element.removeEventListener('touchmove', this.handleTouchMove);
        this.element.removeEventListener('touchend', this.handleTouchEnd);
    }
}

// Export for global use
window.EnhancedTouchControls = EnhancedTouchControls;

