const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Log format tanımları
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Winston logger yapılandırması
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    format: logFormat,
    defaultMeta: { service: 'cipher-app' },
    exitOnError: false,
    transports: [
        // Error logları için ayrı dosya
        new DailyRotateFile({
            filename: path.join('logs', 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true
        }),
        
        // Tüm loglar için genel dosya
        new DailyRotateFile({
            filename: path.join('logs', 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '7d',
            zippedArchive: true
        })
    ],
    
    // Exception ve rejection handling - disabled to prevent winston exit issues
    // exceptionHandlers: [
    //     new DailyRotateFile({
    //         filename: path.join('logs', 'exceptions-%DATE%.log'),
    //         datePattern: 'YYYY-MM-DD',
    //         maxSize: '20m',
    //         maxFiles: '14d',
    //         zippedArchive: true
    //     })
    // ],
    
    // rejectionHandlers: [
    //     new DailyRotateFile({
    //         filename: path.join('logs', 'rejections-%DATE%.log'),
    //         datePattern: 'YYYY-MM-DD',
    //         maxSize: '20m',
    //         maxFiles: '14d',
    //         zippedArchive: true
    //     })
    // ]
});

// Development ortamında console'a da yazdır
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}

// Production ortamında sadece önemli mesajları console'a yazdır
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.simple()
        ),
        level: 'warn' // Sadece warning ve error'ları console'a yazdır
    }));
}

// Logger shutdown function (called from main server)
const shutdownLogger = () => {
    try {
        if (logger && !logger.destroyed) {
            logger.end();
        }
    } catch (error) {
        // Silently ignore logger shutdown errors
        console.error('Logger shutdown error (ignored):', error.message);
    }
};

// Export shutdown function
logger.shutdown = shutdownLogger;

module.exports = logger;


