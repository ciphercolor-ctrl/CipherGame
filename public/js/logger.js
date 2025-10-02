// Client-side logging utility
// Production'da console.log'ları devre dışı bırakır

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

const logger = {
    log: (...args) => {
        if (!isProduction) {
            console.log(...args);
        }
    },
    
    error: (...args) => {
        // Error'ları her zaman göster (production'da da)
        console.error(...args);
    },
    
    warn: (...args) => {
        if (!isProduction) {
            console.warn(...args);
        }
    },
    
    info: (...args) => {
        if (!isProduction) {
            console.info(...args);
        }
    },
    
    debug: (...args) => {
        if (!isProduction) {
            console.debug(...args);
        }
    }
};

// Global olarak erişilebilir yap
window.logger = logger;


