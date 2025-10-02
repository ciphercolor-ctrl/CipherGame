const db = require('./db');
const logger = require('./logger');

async function updateLeaderboardView() {
    let client;
    try {
        client = await db.getClient();
        logger.debug('🔄 Refreshing leaderboard view...');

        // Create the materialized view if it doesn't exist. This definition now includes the 'mode'.
        await client.query(`
            CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_materialized_view AS
            WITH RankedScores AS (
                SELECT
                    s.playerId,
                    s.score,
                    s.mode,
                    ROW_NUMBER() OVER(PARTITION BY s.playerId ORDER BY s.score DESC, s.timestamp DESC) as rn
                FROM scores s
            )
            SELECT
                p.id AS playerId,
                p.username,
                p.country,
                p.avatarurl,
                p.level,
                rs.score AS highestScore,
                p.gameCount,
                rs.mode
            FROM players p
            JOIN RankedScores rs ON p.id = rs.playerId
            WHERE rs.rn = 1
            ORDER BY rs.score DESC;
        `);

        // Create a unique index for concurrent refreshing
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_playerid ON leaderboard_materialized_view (playerId);
        `);

        // Refresh the materialized view
        await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_materialized_view;');
        
        logger.debug('✅ Leaderboard view refreshed successfully');

    } catch (err) {
        if (err.message.includes('cannot refresh materialized view "leaderboard_materialized_view" concurrently')) {
            logger.warn('⚠️ Could not refresh materialized view concurrently, refreshing normally...');
            await client.query('REFRESH MATERIALIZED VIEW leaderboard_materialized_view;');
        } else if (err.message.includes('already exists')) {
            // This is fine, it means the view is already created. We can proceed to refresh.
            await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_materialized_view;');
        } else {
            console.error('Failed to refresh leaderboard_materialized_view:', err);
        }
    } finally {
        if (client) {
            client.release();
        }
    }
}

module.exports = { updateLeaderboardView };
