// updateLevels.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Helper function to calculate level based on game count (must match scoreRoutes.js)
function calculateLevel(gameCount) {
    // 30 games = level 1, 60 games = level 2, etc.
    const level = Math.floor(gameCount / 30);
    return Math.min(level, 10); // Cap the level at 10
}

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

async function updateAllPlayerLevels() {
    let client;
    try {
        console.log('Attempting to connect to the database...');
        client = await pool.connect();
        console.log('Database connection successful.');

        await client.query('BEGIN');
        console.log('Transaction started.');

        // Get all players and their game counts
        console.log('Fetching player data...');
        const playersResult = await client.query(`
            SELECT 
                p.id, 
                p.username,
                p.level as old_level,
                COALESCE(s.game_count, 0) as game_count
            FROM 
                players p
            LEFT JOIN 
                (SELECT playerId, COUNT(id) as game_count FROM scores GROUP BY playerId) s 
            ON 
                p.id = s.playerId;
        `);

        const players = playersResult.rows;
        console.log(`Found ${players.length} players to process.\n`);
        console.log('--- Player Level Analysis ---');

        let updatedCount = 0;
        for (const player of players) {
            const gameCount = parseInt(player.game_count, 10);
            const newLevel = calculateLevel(gameCount);
            
            // Log analysis for every player
            console.log(
                `- Player: ${player.username}, Games: ${gameCount}, Old Level: ${player.old_level}, Calculated New Level: ${newLevel}`
            );

            if (newLevel !== player.old_level) {
                await client.query(
                    'UPDATE players SET level = $1 WHERE id = $2',
                    [newLevel, player.id]
                );
                console.log(`  -> LEVEL UPDATED in DB.`);
                updatedCount++;
            }
        }
        console.log('--- Analysis Complete ---\n');

        await client.query('COMMIT');
        console.log('Transaction committed successfully.');
        console.log(`Update complete. ${updatedCount} player(s) had their levels updated.`);

    } catch (error) {
        console.error('An error occurred during the update process:', error);
        if (client) {
            try {
                await client.query('ROLLBACK');
                console.log('Transaction was rolled back.');
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }
    } finally {
        if (client) {
            client.release();
            console.log('Database client released.');
        }
        await pool.end();
        console.log('Database pool has ended.');
    }
}

updateAllPlayerLevels();
