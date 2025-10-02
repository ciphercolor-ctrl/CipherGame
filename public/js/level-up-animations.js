/**
 * Premium Level Up Animations System
 * Eşsiz kalitede, profesyonel seviyede animasyonlar
 */

class PremiumLevelUpAnimations {
    constructor() {
        this.overlay = null;
        this.container = null;
        this.badge = null;
        this.particlesContainer = null;
        this.isAnimating = false;
        this.animationQueue = [];
        this.currentAnimation = null;
        this.init();
    }

    init() {
        this.createOverlay();
        this.bindEvents();
        this.preloadAssets();
    }

    createOverlay() {
        // Premium overlay oluştur
        this.overlay = document.createElement('div');
        this.overlay.className = 'premium-level-up-overlay';
        this.overlay.innerHTML = `
            <div class="premium-level-up-container">
                <div class="premium-level-badge">
                    <div class="badge-inner">
                        <div class="level-number"></div>
                        <div class="level-text">LEVEL UP</div>
                    </div>
                    <div class="badge-glow"></div>
                    <div class="badge-ring"></div>
                    <div class="badge-ring-2"></div>
                </div>
                <div class="premium-particles-container"></div>
                <div class="celebration-effects"></div>
                <div class="sound-waves"></div>
            </div>
        `;

        this.container = this.overlay.querySelector('.premium-level-up-container');
        this.badge = this.overlay.querySelector('.premium-level-badge');
        this.particlesContainer = this.overlay.querySelector('.premium-particles-container');
        this.celebrationEffects = this.overlay.querySelector('.celebration-effects');
        this.soundWaves = this.overlay.querySelector('.sound-waves');

        document.body.appendChild(this.overlay);
    }

    bindEvents() {
        // Overlay'e tıklandığında kapat
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // ESC tuşu ile kapat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isAnimating) {
                this.hide();
            }

        });
    }

    preloadAssets() {
        // Ses dosyalarını önceden yükle
        this.soundCache = {};
        for (let i = 1; i <= 10; i++) {
            const audio = new Audio(`assets/level${i}.mp3`);
            audio.preload = 'auto';
            this.soundCache[i] = audio;
        }
    }

    /**
     * Premium level up animasyonunu tetikler
     * @param {number} newLevel - Yeni level numarası (1-10)
     * @param {Object} options - Animasyon seçenekleri
     */
    show(newLevel, options = {}) {
        if (this.isAnimating) {
            // Animasyon kuyruğuna ekle
            this.animationQueue.push({ level: newLevel, options });
            return;
        }

        // Level 1-10 arasında olmalı
        if (newLevel < 1 || newLevel > 10) {
            console.warn('Level must be between 1 and 10');
            return;
        }

        this.isAnimating = true;
        this.currentAnimation = { level: newLevel, options };
        
        this.setupPremiumLevel(newLevel);
        this.createPremiumParticles(newLevel);
        this.createCelebrationEffects(newLevel);
        this.createSoundWaves(newLevel);
        this.playPremiumSound(newLevel);

        // Overlay'i göster
        this.overlay.classList.add('show');

        // Animasyon süresi sonunda otomatik kapat
        const duration = this.getPremiumAnimationDuration(newLevel);
        setTimeout(() => {
            this.hide();
        }, duration);

        // Custom event tetikle
        this.dispatchLevelUpEvent(newLevel, options);
    }

    setupPremiumLevel(level) {
        // Container'a level class'ı ekle
        this.container.className = `premium-level-up-container level-${level}`;
        
        // Level numarasını ve metnini güncelle
        const levelNumber = this.badge.querySelector('.level-number');
        const levelText = this.badge.querySelector('.level-text');
        
        levelNumber.textContent = level;
        
        // Level'e göre özel metin
        const levelTexts = {
            1: 'BEGINNER',
            2: 'APPRENTICE',
            3: 'JOURNEYMAN',
            4: 'ADEPT',
            5: 'EXPERT',
            6: 'MASTER',
            7: 'GRANDMASTER',
            8: 'LEGEND',
            9: 'MYTHIC',
            10: 'TRANSCENDENT'
        };
        
        levelText.textContent = levelTexts[level] || 'LEVEL UP';

        // Level'e göre özel efektler
        this.applyPremiumLevelEffects(level);
    }

    applyPremiumLevelEffects(level) {
        // Premium efektleri kaldırdık - sadece badge animasyonu
        // Level'e göre sadece badge rengi ve stil değişiyor
    }

    createPremiumParticles(level) {
        // Parçacık oluşturmayı tamamen kaldırdık - sadece badge animasyonu
        this.particlesContainer.innerHTML = '';
    }

    createMainParticle(level, index) {
            const particle = document.createElement('div');
        particle.className = `main-particle particle-${level}`;
            
            // Rastgele pozisyon ve gecikme
        const randomX = (Math.random() - 0.5) * 400;
        const randomY = (Math.random() - 0.5) * 400;
        const delay = Math.random() * 0.8;
        const size = Math.random() * 8 + 4;
            
            particle.style.setProperty('--random-x', `${randomX}px`);
            particle.style.setProperty('--random-y', `${randomY}px`);
        particle.style.setProperty('--particle-size', `${size}px`);
            particle.style.animationDelay = `${delay}s`;
            
            this.particlesContainer.appendChild(particle);
        }

    createSecondaryParticle(level, index) {
        const particle = document.createElement('div');
        particle.className = `secondary-particle particle-${level}`;
        
        const randomX = (Math.random() - 0.5) * 600;
        const randomY = (Math.random() - 0.5) * 600;
        const delay = Math.random() * 1.2;
        const size = Math.random() * 6 + 2;
        
        particle.style.setProperty('--random-x', `${randomX}px`);
        particle.style.setProperty('--random-y', `${randomY}px`);
        particle.style.setProperty('--particle-size', `${size}px`);
        particle.style.animationDelay = `${delay}s`;
        
        this.particlesContainer.appendChild(particle);
    }

    createSpecialParticle(level, index) {
            const particle = document.createElement('div');
        particle.className = `special-particle particle-${level}`;
        
        const randomX = (Math.random() - 0.5) * 800;
        const randomY = (Math.random() - 0.5) * 800;
        const delay = Math.random() * 1.5;
        const size = Math.random() * 12 + 8;
            
            particle.style.setProperty('--random-x', `${randomX}px`);
            particle.style.setProperty('--random-y', `${randomY}px`);
        particle.style.setProperty('--particle-size', `${size}px`);
            particle.style.animationDelay = `${delay}s`;
            
            this.particlesContainer.appendChild(particle);
        }

    getParticleConfig(level) {
        // Parçacıkları tamamen kaldırdık - sadece badge animasyonu
        return { mainParticles: 0, secondaryParticles: 0, specialParticles: 0 };
    }

    createCelebrationEffects(level) {
        // Kutlama efektlerini tamamen kaldırdık - sadece badge animasyonu
        this.celebrationEffects.innerHTML = '';
    }

    addFireworks() {
        // 7+ seviyeler için çok az havai fişek
        for (let i = 0; i < 2; i++) {
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.cssText = `
                position: absolute;
                width: 3px;
                height: 3px;
                background: radial-gradient(circle, #fff 0%, transparent 70%);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: fireworkExplosion 1s ease-out forwards;
                animation-delay: ${Math.random() * 0.3}s;
            `;
            this.celebrationEffects.appendChild(firework);
        }
    }

    addLightning() {
        // 7+ seviyeler için çok az şimşek
        for (let i = 0; i < 1; i++) {
            const lightning = document.createElement('div');
            lightning.className = 'lightning';
            lightning.style.cssText = `
                position: absolute;
                width: 2px;
                height: 100px;
                background: linear-gradient(to bottom, #fff 0%, #00f 50%, transparent 100%);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 50}%;
                animation: lightningStrike 1s ease-out forwards;
                animation-delay: ${Math.random() * 0.3}s;
                opacity: 0;
            `;
            this.celebrationEffects.appendChild(lightning);
        }
    }

    addEnergyBurst() {
        const burst = document.createElement('div');
        burst.className = 'energy-burst';
        burst.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 200px;
            height: 200px;
            margin: -100px 0 0 -100px;
            border: 1px solid #0ff;
            border-radius: 50%;
            animation: energyBurstExpand 1s ease-out forwards;
        `;
        this.celebrationEffects.appendChild(burst);
    }

    addRealityCrack() {
        // 7+ seviyeler için çok az çatlak
        for (let i = 0; i < 1; i++) {
            const crack = document.createElement('div');
            crack.className = 'reality-crack';
            crack.style.cssText = `
                position: absolute;
                width: 1px;
                height: 150px;
                background: linear-gradient(to bottom, #f00 0%, #0f0 50%, #00f 100%);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 50}%;
                animation: realityCrack 1.5s ease-out forwards;
                animation-delay: ${Math.random() * 0.5}s;
                opacity: 0;
            `;
            this.celebrationEffects.appendChild(crack);
        }
    }

    addUniverseExplosion() {
        const explosion = document.createElement('div');
        explosion.className = 'universe-explosion';
        explosion.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 250px;
            height: 250px;
            margin: -125px 0 0 -125px;
            background: radial-gradient(circle, rgba(255,0,255,0.4) 0%, rgba(0,255,255,0.2) 50%, transparent 100%);
            border-radius: 50%;
            animation: universeExplosion 1.5s ease-out forwards;
        `;
        this.celebrationEffects.appendChild(explosion);
    }

    createSoundWaves(level) {
        // Ses dalgalarını tamamen kaldırdık - sadece badge animasyonu
        this.soundWaves.innerHTML = '';
    }

    addScreenDistortion() {
        document.body.style.filter = 'hue-rotate(180deg) saturate(1.5)';
        setTimeout(() => {
            document.body.style.filter = '';
        }, 1000);
    }

    addHolographicEffect() {
        const hologram = document.createElement('div');
        hologram.className = 'holographic-effect';
        hologram.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(45deg, rgba(255,0,255,0.1) 0%, rgba(0,255,255,0.1) 100%);
            z-index: 9998;
            pointer-events: none;
            animation: holographicScan 2s ease-out forwards;
        `;
        document.body.appendChild(hologram);
        
        setTimeout(() => {
            document.body.removeChild(hologram);
        }, 2000);
    }

    addRealityWarp() {
        this.container.style.transform = 'perspective(1000px) rotateX(10deg) rotateY(10deg)';
        setTimeout(() => {
            this.container.style.transform = '';
        }, 1500);
    }

    addCosmicRipple() {
        const ripple = document.createElement('div');
        ripple.className = 'cosmic-ripple';
        ripple.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 400px;
            height: 400px;
            margin: -200px 0 0 -200px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            animation: cosmicRipple 2s ease-out forwards;
        `;
        this.container.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 2000);
    }

    addTranscendenceEffect() {
        document.body.style.background = 'linear-gradient(45deg, #000 0%, #111 50%, #000 100%)';
        setTimeout(() => {
            document.body.style.background = '';
        }, 2000);
    }

    addUniverseShift() {
        const universe = document.createElement('div');
        universe.className = 'universe-shift';
        universe.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, rgba(255,0,255,0.3) 0%, rgba(0,0,0,0.8) 100%);
            z-index: 9997;
            pointer-events: none;
            animation: universeShift 4s ease-out forwards;
        `;
        document.body.appendChild(universe);
        
        setTimeout(() => {
            document.body.removeChild(universe);
        }, 4000);
    }

    playPremiumSound(level) {
        try {
            const audio = this.soundCache[level];
            if (audio) {
                audio.currentTime = 0;
                audio.volume = Math.min(0.8, 0.3 + (level * 0.05));
                audio.play().catch(e => {
                    console.log('Premium level up sound could not be played:', e);
                });
            }
        } catch (e) {
            console.log('Premium level up sound error:', e);
        }
    }

    getPremiumAnimationDuration(level) {
        const durations = {
            1: 4000, 2: 4500, 3: 5000, 4: 5500, 5: 6000,
            6: 6500, 7: 7000, 8: 7500, 9: 8000, 10: 9000
        };
        return durations[level] || 4000;
    }

    hide() {
        if (!this.isAnimating) return;
        
        this.overlay.classList.remove('show');
        this.isAnimating = false;
        
        // Container class'ını temizle
        this.container.className = 'premium-level-up-container';
        
        // Tüm efektleri temizle - performance için
        this.cleanupEffects();
        
        // Memory cleanup
        this.currentAnimation = null;
        
        // Bir sonraki animasyonu kontrol et
        if (this.animationQueue.length > 0) {
            const next = this.animationQueue.shift();
            setTimeout(() => {
                this.show(next.level, next.options);
            }, 500);
        }
    }

    cleanupEffects() {
        // Efficient cleanup
        this.particlesContainer.innerHTML = '';
        this.celebrationEffects.innerHTML = '';
        this.soundWaves.innerHTML = '';
        
        // Remove any dynamically added elements
        const dynamicElements = document.querySelectorAll('.holographic-effect, .cosmic-ripple, .universe-shift');
        dynamicElements.forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        
        // Reset body styles
        document.body.style.filter = '';
        document.body.style.background = '';
        this.container.style.transform = '';
    }

    dispatchLevelUpEvent(level, options) {
        const event = new CustomEvent('premiumLevelUp', {
            detail: {
                level: level,
                timestamp: Date.now(),
                options: options,
                type: 'premium'
            }
        });
        
        document.dispatchEvent(event);
    }

    // Public API methods
    static trigger(level, options = {}) {
        if (!window.premiumLevelUpAnimations) {
            window.premiumLevelUpAnimations = new PremiumLevelUpAnimations();
        }
        window.premiumLevelUpAnimations.show(level, options);
    }

    static hide() {
        if (window.premiumLevelUpAnimations) {
            window.premiumLevelUpAnimations.hide();
        }
    }

    // Queue management
    static clearQueue() {
        if (window.premiumLevelUpAnimations) {
            window.premiumLevelUpAnimations.animationQueue = [];
        }
    }

    static getQueueLength() {
        return window.premiumLevelUpAnimations ? window.premiumLevelUpAnimations.animationQueue.length : 0;
    }
}

// CSS animasyonları için ek stiller
const premiumStyles = `
    @keyframes fireworkExplosion {
        0% { transform: scale(0) rotate(0deg); opacity: 1; }
        50% { transform: scale(3) rotate(180deg); opacity: 0.8; }
        100% { transform: scale(6) rotate(360deg); opacity: 0; }
    }

    @keyframes lightningStrike {
        0%, 90% { opacity: 0; transform: scaleY(0); }
        5%, 85% { opacity: 1; transform: scaleY(1); }
        100% { opacity: 0; transform: scaleY(0); }
    }

    @keyframes energyBurstExpand {
        0% { transform: scale(0); opacity: 1; }
        50% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(2); opacity: 0; }
    }

    @keyframes realityCrack {
        0%, 80% { opacity: 0; transform: scaleY(0) rotate(0deg); }
        10%, 70% { opacity: 1; transform: scaleY(1) rotate(45deg); }
        100% { opacity: 0; transform: scaleY(0) rotate(90deg); }
    }

    @keyframes universeExplosion {
        0% { transform: scale(0); opacity: 1; }
        50% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(3); opacity: 0; }
    }

    @keyframes soundWaveExpand {
        0% { transform: scale(0); opacity: 1; }
        50% { transform: scale(1); opacity: 0.6; }
        100% { transform: scale(2); opacity: 0; }
    }

    @keyframes holographicScan {
        0% { transform: translateY(-100%); opacity: 1; }
        50% { transform: translateY(0); opacity: 0.8; }
        100% { transform: translateY(100%); opacity: 0; }
    }

    @keyframes cosmicRipple {
        0% { transform: scale(0); opacity: 1; }
        50% { transform: scale(0.5); opacity: 0.6; }
        100% { transform: scale(1); opacity: 0; }
    }

    @keyframes universeShift {
        0% { transform: scale(0) rotate(0deg); opacity: 1; }
        50% { transform: scale(1) rotate(180deg); opacity: 0.8; }
        100% { transform: scale(2) rotate(360deg); opacity: 0; }
    }
`;

// CSS stillerini ekle
const premiumStyleSheet = document.createElement('style');
premiumStyleSheet.textContent = premiumStyles;
document.head.appendChild(premiumStyleSheet);