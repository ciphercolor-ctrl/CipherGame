const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../logger');
const os = require('os');

// Basic health check
router.get('/health', async (req, res) => {
    try {
        // Test database connection
        const dbStart = Date.now();
        await db.query('SELECT 1');
        const dbResponseTime = Date.now() - dbStart;

        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: {
                status: 'connected',
                responseTime: `${dbResponseTime}ms`
            },
            memory: {
                used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
                total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
                external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                loadAverage: os.loadavg()
            }
        };

        res.status(200).json(healthData);
    } catch (error) {
        logger.error('❌ Health check failed', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Detailed system metrics (admin only)
router.get('/metrics', async (req, res) => {
    try {
        // Database pool statistics
        const poolStats = {
            totalCount: db.pool.totalCount,
            idleCount: db.pool.idleCount,
            waitingCount: db.pool.waitingCount
        };

        // Get basic database stats
        const dbStats = await Promise.all([
            db.query('SELECT COUNT(*) as player_count FROM players'),
            db.query('SELECT COUNT(*) as score_count FROM scores'),
            db.query('SELECT COUNT(*) as message_count FROM messages'),
            db.query('SELECT COUNT(*) as active_tokens FROM refresh_tokens WHERE isRevoked = FALSE AND expiresAt > NOW()')
        ]);

        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                heapUsed: process.memoryUsage().heapUsed,
                heapTotal: process.memoryUsage().heapTotal,
                external: process.memoryUsage().external,
                rss: process.memoryUsage().rss
            },
            cpu: {
                usage: process.cpuUsage(),
                loadAverage: os.loadavg()
            },
            database: {
                pool: poolStats,
                stats: {
                    players: parseInt(dbStats[0].rows[0].player_count),
                    scores: parseInt(dbStats[1].rows[0].score_count),
                    messages: parseInt(dbStats[2].rows[0].message_count),
                    activeTokens: parseInt(dbStats[3].rows[0].active_tokens)
                }
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                nodeVersion: process.version,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                networkInterfaces: Object.keys(os.networkInterfaces())
            }
        };

        res.status(200).json(metrics);
    } catch (error) {
        logger.error('❌ Metrics collection failed', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            error: 'Failed to collect metrics',
            timestamp: new Date().toISOString()
        });
    }
});

// Readiness check (for Kubernetes/Docker)
router.get('/ready', async (req, res) => {
    try {
        // Check if database is ready
        await db.query('SELECT 1');
        
        // Check if leaderboard view exists
        const viewCheck = await db.query(`
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'leaderboard_materialized_view'
        `);

        if (viewCheck.rows.length === 0) {
            return res.status(503).json({
                status: 'not ready',
                reason: 'Leaderboard view not initialized',
                timestamp: new Date().toISOString()
            });
        }

        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('❌ Readiness check failed', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(503).json({
            status: 'not ready',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Liveness check (for Kubernetes/Docker)
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;
