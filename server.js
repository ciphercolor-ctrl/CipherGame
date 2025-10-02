require('dotenv').config();
const { continentMap, countries, getContinentByCountryCode, DEFAULT_CHAT_ROOM, CHAT_MESSAGE_COOLDOWN } = require('./constants');
const PORT = process.env.PORT || 3000;
const path = require('path');
const express = require('express');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { t } = require('./i18n');
const logger = require('./logger');

const { authenticateToken, authenticateAdminToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [process.env.APP_URL, "http://localhost:3000", "http://127.0.0.1:3000"].filter(Boolean),
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "Accept-Language"],
        optionsSuccessStatus: 200 // For legacy browser support
    },
    // Additional Socket.IO security
    allowEIO3: false, // Disable Engine.IO v3 support
    transports: ['websocket', 'polling'], // Explicitly define transports
    upgradeTimeout: 30000, // 30 seconds
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000 // 25 seconds
});

// Initialize Socket.IO handlers
require('./socket/chatHandler')(io);
const scoreHandler = require('./socket/scoreHandler')(io);

// Make scoreHandler available globally for routes
global.scoreHandler = scoreHandler;


// --- Middleware ---
// Enhanced security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "https://cdn.jsdelivr.net", 
                "https://cdnjs.cloudflare.com",
                "'unsafe-eval'" // Only for development, remove in production if possible
            ],
            scriptSrcElem: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: [
                "'self'", 
                "'unsafe-inline'", // Needed for dynamic styles
                "https://cdnjs.cloudflare.com", 
                "https://fonts.googleapis.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://res.cloudinary.com",
                "https://*.cloudinary.com", // Allow all cloudinary subdomains
                "https://*.githubusercontent.com"
            ],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            connectSrc: [
                "'self'",
                "ws:",
                "wss:",
                "https://ipapi.co",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                process.env.APP_URL || "https://cipher-global.online" // Allow self-hosted socket connections
            ],
            frameSrc: ["'none'"], // Prevent iframe embedding
            objectSrc: ["'none'"], // Prevent object/embed/applet
            mediaSrc: ["'self'"], // Only allow media from same origin
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
        reportOnly: false // Set to true during development to test CSP
    },
    crossOriginEmbedderPolicy: false, // Disable if causing issues with third-party resources
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// General rate limiting - Disabled in development
if (process.env.NODE_ENV === 'production') {
    const generalLimiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 1000 requests per 15 minutes
        message: (req, res) => {
            const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
            return t(lang, 'errorTooManyRequests');
        },
        standardHeaders: true,
        legacyHeaders: false,
        // Skip rate limiting for static files (uploads path removed)
        skip: (req) => {
            return req.path.includes('/favicon.ico') || 
                   req.path.includes('/assets/') || 
                   req.path.includes('/css/') || 
                   req.path.includes('/js/');
        }
    });
    app.use(generalLimiter);
} else {
    logger.debug('🛡️ Rate limiting disabled in development mode');
}

// Response time tracking middleware
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        
        // Log slow requests (over 1 second)
        if (duration > 1000) {
            logger.warn('🐌 Slow request detected', {
                method: req.method,
                url: req.originalUrl,
                duration: `${duration}ms`,
                statusCode: statusCode,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
        }
        
        // Log all requests in debug mode
        logger.debug('📊 Request completed', {
            method: req.method,
            url: req.originalUrl,
            duration: `${duration}ms`,
            statusCode: statusCode,
            ip: req.ip
        });
    });
    
    next();
});

app.use(express.json());
// Serve static files based on environment
const staticDir = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, 'dist') 
    : path.join(__dirname, 'public');

app.use(express.static(staticDir));
logger.info(`🚀 Serving static files from: ${staticDir}`);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploads directory

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { router: scoreRouter } = require('./routes/scoreRoutes');
const { router: adminRouter } = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes')(io);
const healthRoutes = require('./routes/healthRoutes');
const casualGameRoutes = require('./routes/casualGameRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/scores', scoreRouter);
app.use('/api/leaderboard', scoreRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRoutes);
app.use('/api/casual-scores', casualGameRoutes);
app.use('/api', healthRoutes); // Health check endpoints

// Catch-all for client-side routing (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
});

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    res.status(err.statusCode || 500).json({
        message: err.message || t(lang, 'errorUnexpected'),
        error: process.env.NODE_ENV === 'production' ? {} : err.stack // Don't expose stack in production
    });
});

module.exports = { app, server, io };

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
    logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);

    let shutdownComplete = false;

    try {
        // Set a timeout for forced shutdown
        const forceShutdownTimer = setTimeout(() => {
            if (!shutdownComplete) {
                logger.error('⚠️ Graceful shutdown timeout. Forcing exit...');
                process.exit(1);
            }
        }, 10000); // 10 seconds timeout

        // Close Socket.IO server
        logger.info('🔌 Closing Socket.IO connections...');
        io.close(() => {
            logger.info('✅ Socket.IO server closed.');
        });

        // Stop accepting new connections
        logger.info('🌐 Closing HTTP server...');
        server.close(async (err) => {
            if (err) {
                logger.error('❌ Error closing HTTP server:', err);
                process.exit(1);
                return;
            }
            
            logger.info('✅ HTTP server closed.');
            
            // Close database pool
            try {
                logger.info('🗄️ Closing database connections...');
                await db.closePool();
                logger.info('✅ Database pool closed successfully.');
                
                // Close logger last
                logger.info('🎉 Graceful shutdown completed successfully.');
                if (logger.shutdown) {
                    logger.shutdown();
                }
                
                clearTimeout(forceShutdownTimer);
                shutdownComplete = true;
                process.exit(0);
            } catch (dbErr) {
                logger.error('❌ Error closing database pool:', dbErr);
                if (logger.shutdown) {
                    logger.shutdown();
                }
                clearTimeout(forceShutdownTimer);
                process.exit(1);
            }
        });
        
    } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown on SIGINT (Ctrl+C) and SIGTERM
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception:', {
        error: err.message,
        stack: err.stack
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection:', {
        reason: reason,
        promise: promise
    });
    gracefulShutdown('UNHANDLED_REJECTION');
});


if (require.main === module) {
    (async () => { // Use an async IIFE to await db.connect()
        // Always show startup message regardless of environment
        console.log('🚀 Starting CIPHER server initialization...');
        logger.info('🚀 Starting CIPHER server initialization...');
        
        try {
            console.log('📊 Connecting to database...');
            await db.connect();
            console.log('✅ Database connected successfully');
            logger.info('✅ Database connected successfully');

            const { updateLeaderboardView } = require('./update_leaderboard_view');
            logger.info('📊 Loading leaderboard module...');
            
            await updateLeaderboardView(); // Update the materialized view on startup
            logger.info('✅ Initial leaderboard view updated');

            // Periodically refresh the materialized view every 5 minutes
            setInterval(async () => {
                logger.debug('🔄 Periodically refreshing leaderboard view...');
                await updateLeaderboardView();
            }, 300000); // 300000 ms = 5 minutes
            logger.info('⏰ Set up periodic leaderboard refresh (5 minutes)');

            server.listen(PORT, () => {
                // Always show success message regardless of environment
                console.log(`🎉 CIPHER Server is running successfully on port ${PORT}!`);
                logger.info(`🎉 CIPHER Server is running successfully!`, {
                    environment: process.env.NODE_ENV,
                    port: PORT,
                    timestamp: new Date().toISOString()
                });
            });
            
        } catch (error) {
            logger.error('💥 Server initialization failed:', {
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    })();
}
