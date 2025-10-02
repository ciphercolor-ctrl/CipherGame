let translations = {};

async function fetchTranslations(lang) {
    try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        translations = await response.json();
        applyTranslations();
    } catch (error) {
        logger.error('Error fetching translations:', error);
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[key]) {
            const textNode = Array.from(element.childNodes).find(node => 
                node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
            );
            if (textNode) {
                const leadingSpace = textNode.textContent.startsWith(' ') ? ' ' : '';
                const trailingSpace = textNode.textContent.endsWith(' ') ? ' ' : '';
                textNode.textContent = leadingSpace + translations[key] + trailingSpace;
            } else if (element.children.length > 0 && element.hasAttribute('data-i18n-target')) {
                const targetElement = element.querySelector(element.getAttribute('data-i18n-target'));
                if(targetElement) targetElement.textContent = translations[key];
            }
            else {
                element.textContent = translations[key];
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[key]) {
            element.placeholder = translations[key];
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (translations[key]) {
            element.title = translations[key];
        }
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(element => {
        const key = element.getAttribute('data-i18n-alt');
        if (translations[key]) {
            element.alt = translations[key];
        }
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria-label');
        if (translations[key]) {
            element.setAttribute('aria-label', translations[key]);
        }
    });

    // NEW: Handle data-i18n-label attribute for responsive table labels
    document.querySelectorAll('[data-i18n-label]').forEach(element => {
        const key = element.getAttribute('data-i18n-label');
        if (translations[key]) {
            element.setAttribute('data-label', translations[key]);
        }
    });

    // After applying translations, reposition the dynamic island elements
    // This fixes the layout shift bug caused by i18n text loading after initial positioning
    if (typeof positionPlayGameButton === 'function') {
        positionPlayGameButton();
    }
    if (typeof positionLogo === 'function') {
        positionLogo();
    }
}

function getTranslation(key, ...args) {
    let translation = translations[key] || key;
    if (args.length > 0) {
        args.forEach((arg, index) => {
            translation = translation.replace(`{${index}}`, arg);
        });
    }
    return translation;
}

function initializeLanguageSwitcher() {
    const languageButtons = {
        mobile: document.getElementById('mobileLanguageBtn')
    };
    const languageDropdowns = {
        mobile: document.getElementById('mobileLanguageDropdown')
    };
    const currentFlags = {
        mobile: document.getElementById('mobileCurrentFlag')
    };

    const setupSwitcher = (type) => {
        const btn = languageButtons[type];
        const dropdown = languageDropdowns[type];
        if (!btn || !dropdown) return;

        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        if (!isTouchDevice) {
            let timeoutId;

            const showDropdown = () => {
                clearTimeout(timeoutId);
                btn.classList.add('active');
                dropdown.classList.add('show');
            };

            const hideDropdown = () => {
                timeoutId = setTimeout(() => {
                    btn.classList.remove('active');
                    dropdown.classList.remove('show');
                }, 200);
            };

            btn.addEventListener('mouseenter', showDropdown);
            btn.addEventListener('mouseleave', hideDropdown);
            dropdown.addEventListener('mouseenter', () => clearTimeout(timeoutId));
            dropdown.addEventListener('mouseleave', hideDropdown);
        }

        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const isShown = dropdown.classList.contains('show');
            if (isShown) {
                btn.classList.remove('active');
                dropdown.classList.remove('show');
            } else {
                btn.classList.add('active');
                dropdown.classList.add('show');
            }
        });

        document.addEventListener('click', (event) => {
            if (!dropdown.contains(event.target) && !btn.contains(event.target)) {
                btn.classList.remove('active');
                dropdown.classList.remove('show');
            }
        });

        dropdown.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', async (event) => {
                event.preventDefault();
                const newLang = option.getAttribute('data-lang');
                const currentLang = localStorage.getItem('selectedLanguage') || 'en';

                if (newLang !== currentLang) {
                    localStorage.setItem('selectedLanguage', newLang);
                    document.documentElement.lang = newLang;
                    await fetchTranslations(newLang);
                    updateFlag(newLang);

                    // Dispatch a custom event to notify other parts of the app
                    document.dispatchEvent(new CustomEvent('languageChanged'));
                }
                
                btn.classList.remove('active');
                dropdown.classList.remove('show');
            });
        });
    };

    setupSwitcher('mobile');

    const savedLanguage = localStorage.getItem('selectedLanguage') || 'en';
    updateFlag(savedLanguage);
}

async function initializeLanguage() {
    let selectedLanguage = localStorage.getItem('selectedLanguage');

    if (!selectedLanguage) {
        const browserLang = navigator.language.split('-')[0];
        const supportedLanguages = ['en', 'tr', 'de', 'ko', 'ar', 'es', 'fr', 'it', 'ja', 'ru', 'zh', 'zh-TW', 'hi', 'pt', 'bn', 'id', 'ur', 'vi', 'pl', 'nl', 'th', 'fa', 'sw', 'ms', 'ro', 'el', 'cs', 'hu', 'sv', 'no', 'da']; 
        if (supportedLanguages.includes(browserLang)) {
            selectedLanguage = browserLang;
        } else {
            selectedLanguage = 'en';
        }
        localStorage.setItem('selectedLanguage', selectedLanguage);
    }

    document.documentElement.lang = selectedLanguage;
    
    await fetchTranslations(selectedLanguage);
    updateFlag(selectedLanguage);
}

function updateFlag(lang) {
    const currentFlags = {
        mobile: document.getElementById('mobileCurrentFlag'),
        hero: document.getElementById('hero-language-flag-img') // Add hero flag
    };
    const option = document.querySelector(`.language-option[data-lang='${lang}']`);
    if (option) {
        const flagSrc = option.querySelector('img').src;
        const flagAlt = option.querySelector('img').alt;
        if (currentFlags.mobile) {
            currentFlags.mobile.src = flagSrc;
            currentFlags.mobile.alt = flagAlt;
        }
        if (currentFlags.hero) { // Update hero flag
            currentFlags.hero.src = flagSrc;
            currentFlags.hero.alt = flagAlt;
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initializeLanguageSwitcher();
    initializeLanguage().then(() => {
        if (typeof updateProfileDisplay === 'function') {
            updateProfileDisplay(gameState.level);
        }
        if (typeof initializeLeaderboardPreviews === 'function') {
            initializeLeaderboardPreviews();
        }
    });
});

window.getTranslation = getTranslation;
window.fetchTranslations = fetchTranslations;
window.applyTranslations = applyTranslations;
window.initializeLanguage = initializeLanguage;