/**
 * Scroll-Triggered Animations System
 * Handles intersection observer for smooth scroll animations
 */

class ScrollAnimations {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        // Check if Intersection Observer is supported
        if (!('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver not supported, falling back to immediate animation');
            this.fallbackAnimation();
            return;
        }

        // Create intersection observer with optimized settings
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: null,
                rootMargin: '0px 0px -100px 0px', // Trigger when element is 100px from viewport
                threshold: 0.05 // Lower threshold for earlier triggering
            }
        );

        // Observe all elements with animation classes
        this.observeElements();
    }

    observeElements() {
        const selectors = [
            '.scroll-animate',
            '.scroll-animate-fade',
            '.scroll-animate-slide-up',
            '.scroll-animate-slide-left',
            '.scroll-animate-slide-right',
            '.scroll-animate-scale',
            '.scroll-animate-stagger',
            '.about-text h3',
            '.about-text p',
            '.about-text ul',
            '.about-text li',
            '.token-key-data',
            '.data-item',
            '.tokenomics-text',
            '.chart-container',
            '.vesting-text',
            '.vesting-table-wrapper',
            '.roadmap-timeline-container',
            '.roadmap-item',
            '.gallery-grid',
            '.gallery-item',
            '.social-grid',
            '.social-item',
            '.leaderboard-previews-container'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                this.observer.observe(element);
            });
        });
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                this.animateElement(entry.target);
            }
        });
    }

    animateElement(element) {
        // Add animate-in class
        element.classList.add('animate-in');

        // Handle staggered animations for lists
        if (element.classList.contains('about-text') || 
            element.classList.contains('token-key-data')) {
            this.animateChildren(element);
        }

        // Stop observing this element to prevent re-triggering
        this.observer.unobserve(element);
    }

    animateChildren(parentElement) {
        const children = parentElement.children;
        
        // For about text lists
        if (parentElement.classList.contains('about-text')) {
            const lists = parentElement.querySelectorAll('ul');
            lists.forEach((list, listIndex) => {
                const listItems = list.querySelectorAll('li');
                listItems.forEach((item, itemIndex) => {
                    setTimeout(() => {
                        item.classList.add('animate-in');
                    }, (listIndex * 200) + (itemIndex * 100));
                });
            });
        }
        
        // For tokenomics data items
        else if (parentElement.classList.contains('token-key-data')) {
            const dataItems = parentElement.querySelectorAll('.data-item');
            dataItems.forEach((item, index) => {
                setTimeout(() => {
                    item.classList.add('animate-in');
                }, index * 150);
            });
        }
        
    }

    fallbackAnimation() {
        // Fallback for browsers without Intersection Observer
        const animatedElements = document.querySelectorAll('.scroll-animate, .scroll-animate-fade, .scroll-animate-slide-up, .scroll-animate-slide-left, .scroll-animate-slide-right, .scroll-animate-scale, .scroll-animate-stagger');
        
        animatedElements.forEach((element, index) => {
            setTimeout(() => {
                element.classList.add('animate-in');
            }, index * 100);
        });
    }

    // Method to manually trigger animations (useful for dynamic content)
    triggerAnimation(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (!element.classList.contains('animate-in')) {
                element.classList.add('animate-in');
            }
        });
    }

    // Method to reset animations (useful for testing)
    resetAnimations() {
        const animatedElements = document.querySelectorAll('.animate-in');
        animatedElements.forEach(element => {
            element.classList.remove('animate-in');
        });
        
        // Re-observe elements
        this.observeElements();
    }

    // Method to destroy the observer
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// Initialize scroll animations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all content is loaded
    setTimeout(() => {
        window.scrollAnimations = new ScrollAnimations();
    }, 100);
});

// Handle dynamic content loading (for gallery images, etc.)
function reinitializeScrollAnimations() {
    if (window.scrollAnimations) {
        window.scrollAnimations.observeElements();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollAnimations;
}
