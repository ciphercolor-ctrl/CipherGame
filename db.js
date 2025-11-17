const { Pool, types } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

dotenv.config();

// Override the default timestamp parser to return timestamps as strings
// This prevents node-postgres from converting them to local time
types.setTypeParser(1114, (stringValue) => {
    return stringValue; // Return as is
});

// Determine database configuration based on environment variables
let dbConfig;

if (process.env.DATABASE_URL) {
    // Use DATABASE_URL if it exists (common for hosting providers like Render)
    dbConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Render's managed databases
        },
        // Optimized connection pool settings
        max: process.env.NODE_ENV === 'production' ? 30 : 10,
        min: process.env.NODE_ENV === 'production' ? 5 : 2,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 10000,
        maxUses: 10000,
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 30000,
        createRetryIntervalMillis: 200,
        reapIntervalMillis: 1000,
        allowExitOnIdle: false,
    };
} else {
    // Fallback to individual PG_* variables for local development
    dbConfig = {
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        password: process.env.PG_PASSWORD,
        port: process.env.PG_PORT,
        database: process.env.PG_DATABASE,
        // Optimized connection pool settings
        max: process.env.NODE_ENV === 'production' ? 30 : 10, // More connections in production
        min: process.env.NODE_ENV === 'production' ? 5 : 2,   // Minimum connections
        idleTimeoutMillis: 20000, // Close idle clients after 20 seconds (reduced from 30s)
        connectionTimeoutMillis: 10000, // Faster connection timeout (reduced from 2s)
        maxUses: 10000, // Increased from 7500
        acquireTimeoutMillis: 60000, // 60 seconds to acquire connection
        createTimeoutMillis: 30000,  // 30 seconds to create new connection
        createRetryIntervalMillis: 200, // Retry interval for connection creation
        reapIntervalMillis: 1000, // Check for idle connections every second
        allowExitOnIdle: false, // Don't exit when pool is idle
    };
    
    // Add SSL configuration only when PGSSLMODE is set (like on Render)
    if (process.env.PGSSLMODE === 'require') {
        dbConfig.ssl = { rejectUnauthorized: false };
    }
}
   
const pool = new Pool(dbConfig);

let isPoolClosing = false; // Add this line near the top, after 'const pool = new Pool(dbConfig);'

// Add event listeners to the pool for monitoring
pool.on('error', (err, client) => {
    logger.error('💥 Unexpected error on idle client', {
        error: err.message,
        stack: err.stack,
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    });
    // Don't exit the process, just log the error and let the pool handle reconnection
});

pool.on('connect', (client) => {
    logger.debug('🔗 New client connected to database', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    });
});

pool.on('acquire', (client) => {
    logger.debug('📤 Client acquired from pool', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    });
});

pool.on('remove', (client) => {
    logger.debug('🗑️ Client removed from pool', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    });
});

// Pool statistics monitoring (only in development)
if (process.env.NODE_ENV !== 'production') {
    setInterval(() => {
        if (pool.totalCount > 0) {
            logger.debug('📊 Pool Statistics', {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount
            });
        }
    }, 30000); // Every 30 seconds
}

async function initializeDatabase() {
    let client;
    try {
        client = await pool.connect();
        logger.info(`📊 Connected to PostgreSQL database: ${client.database}`, {
            database: client.database,
            host: client.host,
            port: client.port
        });

        // Create tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                country VARCHAR(255) NOT NULL,
                avatarUrl VARCHAR(255) DEFAULT 'assets/logo.jpg',
                createdAt TIMESTAMP NOT NULL,
                level INTEGER DEFAULT 0,
                gameCount INTEGER DEFAULT 0,
                highestScore INTEGER DEFAULT 0
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_players_country ON players (country);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_players_username_lower ON players (LOWER(username));`);
        
        // Additional player indexes for better performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_players_level ON players (level DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_players_highest_score ON players (highestScore DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_players_game_count ON players (gameCount DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_players_created_at ON players (createdAt DESC);`);

        // Ensure level column exists (idempotent)
        const levelColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='players' AND column_name='level';
        `);
        if (levelColumnCheck.rowCount === 0) {
            await client.query(`ALTER TABLE players ADD COLUMN level INTEGER DEFAULT 0`);
            logger.info('✅ Added level column to players table.');
        }

        // Ensure autoSolverPermission column exists (idempotent)
        const autoSolverColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='players' AND column_name='autosolverpermission';
        `);
        if (autoSolverColumnCheck.rowCount === 0) {
            await client.query(`ALTER TABLE players ADD COLUMN autoSolverPermission BOOLEAN DEFAULT FALSE`);
            logger.info('✅ Added autoSolverPermission column to players table.');
        } else {
            logger.info('✅ autoSolverPermission column already exists in players table.');
        }

        // Ensure is_influencer column exists (idempotent)
        const influencerColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='players' AND column_name='is_influencer';
        `);
        if (influencerColumnCheck.rowCount === 0) {
            await client.query(`ALTER TABLE players ADD COLUMN is_influencer BOOLEAN DEFAULT FALSE`);
            logger.info('✅ Added is_influencer column to players table.');
        } else {
            logger.info('✅ is_influencer column already exists in players table.');
        }

        await client.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id VARCHAR(255) PRIMARY KEY,
                playerId VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                mode VARCHAR(255) NOT NULL,
                memoryTime DOUBLE PRECISION,
                matchingTime DOUBLE PRECISION,
                timestamp TIMESTAMP NOT NULL,
                FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_scores_playerid_score_timestamp ON scores (playerId, score DESC, timestamp DESC);`);
        
        // Additional performance indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores (timestamp DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_scores_score_desc ON scores (score DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_scores_mode ON scores (mode);`);
        
        // Partial index for high scores (better performance for leaderboards)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_scores_high_scores ON scores (score DESC, timestamp DESC) WHERE score > 1000;`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id VARCHAR(255) PRIMARY KEY,
                senderId VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                message TEXT,
                type VARCHAR(255) NOT NULL DEFAULT 'text',
                timestamp TIMESTAMP NOT NULL,
                room VARCHAR(255) NOT NULL DEFAULT 'Global',
                imageUrl VARCHAR(255),
                replyto VARCHAR(255) DEFAULT NULL,
                FOREIGN KEY (senderId) REFERENCES players(id) ON DELETE CASCADE
            );
        `);

        // Add replyto column if it doesn't exist
        const replyToColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns
            WHERE table_name='messages' AND column_name='replyto';
        `);
        if (replyToColumnCheck.rowCount === 0) {
            await client.query(`ALTER TABLE messages ADD COLUMN replyto VARCHAR(255) DEFAULT NULL;`);
            logger.info('✅ Added replyto column to messages table.');
        }
        
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages (room, timestamp DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_senderid ON messages (senderId);`);
        
        // Additional message indexes for better chat performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_senderid_timestamp ON messages (senderId, timestamp DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_type ON messages (type);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_username ON messages (username);`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT
            );
        `);

        // Refresh tokens table for JWT security
        await client.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expiresAt TIMESTAMP NOT NULL,
                createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
                isRevoked BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (userId) REFERENCES players(id) ON DELETE CASCADE
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (userId);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token);`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS casual_scores (
                id VARCHAR(255) PRIMARY KEY,
                game_name VARCHAR(50) NOT NULL,
                username VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_casual_scores_game_score ON casual_scores (game_name, score DESC);`);

        // --- Influencer Management System Tables ---

        // Table to store core influencer data
        await client.query(`
            CREATE TABLE IF NOT EXISTS influencers (
                id VARCHAR(255) PRIMARY KEY,
                player_id VARCHAR(255) NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
                solana_wallet_address VARCHAR(255),
                twitter_handle VARCHAR(255),
                status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., pending, active, completed, rejected
                referral_code VARCHAR(255) UNIQUE,
                total_referrals INTEGER DEFAULT 0,
                created_at TIMESTAMP NOT NULL
            );
        `);
        logger.info('✅ Checked/Created influencers table.');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_influencers_player_id ON influencers (player_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers (status);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_influencers_referral_code ON influencers (referral_code);`);

        // Table to track successful referrals
        await client.query(`
            CREATE TABLE IF NOT EXISTS influencer_referrals (
                id VARCHAR(255) PRIMARY KEY,
                influencer_id VARCHAR(255) NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
                referred_user_id VARCHAR(255) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                created_at TIMESTAMP NOT NULL
            );
        `);
        logger.info('✅ Checked/Created influencer_referrals table.');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_influencer_referrals_influencer_id ON influencer_referrals (influencer_id);`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_referrals_referred_user_id ON influencer_referrals (referred_user_id);`);

        // Table to store and verify content submitted by influencers
        await client.query(`
            CREATE TABLE IF NOT EXISTS influencer_content (
                id VARCHAR(255) PRIMARY KEY,
                influencer_id VARCHAR(255) NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
                content_url TEXT NOT NULL,
                submitted_at TIMESTAMP NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                verification_date TIMESTAMP
            );
        `);
        logger.info('✅ Checked/Created influencer_content table.');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_influencer_content_influencer_id ON influencer_content (influencer_id);`);

        // Table to store final campaign results and rewards
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaign_results (
                id VARCHAR(255) PRIMARY KEY,
                influencer_id VARCHAR(255) NOT NULL REFERENCES influencers(id),
                player_id VARCHAR(255) NOT NULL REFERENCES players(id),
                username VARCHAR(255) NOT NULL,
                final_rank INTEGER NOT NULL,
                total_referrals INTEGER NOT NULL,
                base_reward_amount NUMERIC(12, 2) NOT NULL,
                bonus_reward_amount NUMERIC(12, 2) NOT NULL,
                total_reward_amount NUMERIC(12, 2) NOT NULL,
                payout_date TIMESTAMP NOT NULL,
                payout_transaction_id VARCHAR(255)
            );
        `);
        logger.info('✅ Checked/Created campaign_results table.');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_campaign_results_influencer_id ON campaign_results (influencer_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_campaign_results_payout_date ON campaign_results (payout_date);`);

        // Insert default settings if they don't exist
        await client.query(`INSERT INTO settings (key, value) VALUES ('siteTitle', 'CIPHER Game') ON CONFLICT (key) DO NOTHING`);
        await client.query(`INSERT INTO settings (key, value) VALUES ('welcomeMessage', 'Welcome to CIPHER!') ON CONFLICT (key) DO NOTHING`);
        await client.query(`INSERT INTO settings (key, value) VALUES ('chatMessageCooldown', '2000') ON CONFLICT (key) DO NOTHING`);
        await client.query(`INSERT INTO settings (key, value) VALUES ('defaultAvatarUrl', 'assets/logo.jpg') ON CONFLICT (key) DO NOTHING`);

        // Check if admin user exists, if not, create one
        const { rows } = await client.query(`SELECT 1 FROM admins LIMIT 1`);
        if (rows.length === 0) {
            const defaultAdminUsername = process.env.ADMIN_USERNAME || 'admin';
            const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'adminpass';
            const hashedAdminPassword = await bcrypt.hash(defaultAdminPassword, 10);
            const adminId = `admin_${Date.now()}`;
            const createdAt = new Date().toISOString();
            await client.query(`INSERT INTO admins (id, username, password, createdAt) VALUES ($1, $2, $3, $4)`,
                [adminId, defaultAdminUsername, hashedAdminPassword, createdAt]);
            logger.info('👤 Default admin user created.', {
                adminId: adminId,
                username: defaultAdminUsername
            });
        }
        
        logger.info('✅ Database is ready.');

    } catch (err) {
        logger.error('Database initialization failed!', {
            error: err.message,
            stack: err.stack
        });
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
    }
}

// This function will be called from server.js to ensure DB is ready
async function connect() {
    await initializeDatabase();
}

// Graceful shutdown function
async function closePool() {
    if (isPoolClosing) {
        return; // Already in the process of closing
    }
    isPoolClosing = true; // Set the flag to true

    try {
        await pool.end();
        logger.info('🔌 Database pool closed gracefully');
    } catch (err) {
        logger.error('Error closing database pool:', {
            error: err.message,
            stack: err.stack
        });
    }
}



module.exports = {
    connect,
    // The query function now directly uses the main pool
    query: (text, params) => pool.query(text, params),
    // The getClient function for transactions also uses the main pool
    getClient: () => pool.connect(),
    // Export the pool itself if needed elsewhere (e.g., for graceful shutdown)
    pool,
    closePool
};
