const fs = require('fs');
const path = require('path');

const locales = {};
const localesDir = path.join(__dirname, 'public', 'locales');

// Load all translation files into memory
fs.readdirSync(localesDir).forEach(file => {
    if (file.endsWith('.json')) {
        const lang = file.split('.')[0];
        const data = fs.readFileSync(path.join(localesDir, file), 'utf8');
        locales[lang] = JSON.parse(data);
    }
});

/**
 * Gets a translation for a given key and language.
 * @param {string} lang - The language code (e.g., 'en', 'tr').
 * @param {string} key - The translation key.
 * @param {object} [options] - An object containing values to replace placeholders.
 * @returns {string} The translated string.
 */
function t(lang, key, options = {}) {
    // Fallback to English if the language or key doesn't exist
    const langToUse = locales[lang] ? lang : 'en';
    let translation = locales[langToUse][key] || key;

    // Replace placeholders like {placeholder}
    for (const placeholder in options) {
        translation = translation.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), options[placeholder]);
    }

    return translation;
}

module.exports = { t };
