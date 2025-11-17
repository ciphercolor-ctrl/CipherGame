const cron = require('node-cron');
const db = require('../db');
const logger = require('../logger');
const marketCapService = require('../services/marketCapService');
const solanaPaymentService = require('../services/solanaPaymentService');

// --- Reward Constants (from the agreement) ---
const REWARDS_USD = {
    STANDARD: 3000,
    BONUS_1ST: 30000,
    BONUS_2ND: 15000,
    BONUS_3RD: 7500,
};

/**
 * Checks if the campaign payout has already been processed.
 * @returns {Promise<boolean>}
 */
async function isCampaignAlreadyCompleted() {
    try {
        const result = await db.query("SELECT 1 FROM settings WHERE key = 'campaign_payout_completed_at'");
        return result.rowCount > 0;
    } catch (error) {
        logger.error('Failed to check campaign completion status:', { error });
        return false; // Assume not completed on error to be safe
    }
}

/**
 * Fetches all influencers who are eligible for a payout.
 * Eligibility: Status is 'active' AND they have at least one verified piece of content.
 * @returns {Promise<Array<Object>>}
 */
async function getEligibleInfluencers() {
    const query = `
        SELECT
            i.id AS influencer_id,
            i.player_id,
            p.username,
            i.solana_wallet_address,
            i.total_referrals
        FROM influencers i
        JOIN players p ON i.player_id = p.id
        WHERE
            i.status = 'active'
            AND i.solana_wallet_address IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM influencer_content ic
                WHERE ic.influencer_id = i.id AND ic.is_verified = TRUE
            )
        ORDER BY
            i.total_referrals DESC, p.createdAt ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * The main logic for checking and processing the campaign payout.
 */
async function checkAndProcessCampaignPayout() {
    logger.debug('Starting campaign payout check...');

    if (await isCampaignAlreadyCompleted()) {
        logger.info('Campaign payout has already been completed. No action needed.');
        // Optional: Stop the cron job itself if it's completed.
        // For now, we'll just let it check and exit.
        return;
    }

    const marketData = await marketCapService.getMarketCap();

    if (!marketData || !marketData.targetReached) {
        logger.info(`Market cap target not reached. Current: $${marketData.marketCap.toLocaleString()} / Target: $${marketData.targetMarketCap.toLocaleString()}`);
        return;
    }

    logger.info('🚀 Market Cap Target Reached! Starting payout process...');

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const influencers = await getEligibleInfluencers();

        if (influencers.length === 0) {
            logger.warn('Market cap target reached, but no eligible influencers found. No payouts processed.');
            // We still mark as complete to prevent re-running this heavy logic.
            await client.query("INSERT INTO settings (key, value) VALUES ('campaign_payout_completed_at', $1)", [new Date().toISOString()]);
            await client.query('COMMIT');
            return;
        }

        logger.info(`Found ${influencers.length} eligible influencers. Calculating rewards...`);

        const { price: cipherPrice } = marketData;
        if (!cipherPrice || cipherPrice <= 0) {
            throw new Error(`Invalid $CIPHER price for calculation: ${cipherPrice}`);
        }

        const transactions = [];
        const campaignResults = [];

        for (let i = 0; i < influencers.length; i++) {
            const influencer = influencers[i];
            const rank = i + 1;

            let baseReward = REWARDS_USD.STANDARD;
            let bonusReward = 0;

            if (rank === 1) bonusReward = REWARDS_USD.BONUS_1ST;
            else if (rank === 2) bonusReward = REWARDS_USD.BONUS_2ND;
            else if (rank === 3) bonusReward = REWARDS_USD.BONUS_3RD;

            const totalRewardUSD = baseReward + bonusReward;
            const totalRewardTokens = totalRewardUSD / cipherPrice;

            transactions.push({
                influencerId: influencer.influencer_id,
                walletAddress: influencer.solana_wallet_address,
                amount: totalRewardTokens,
            });

            campaignResults.push({
                id: `cr_${Date.now()}_${influencer.influencer_id}`,
                influencer_id: influencer.influencer_id,
                player_id: influencer.player_id,
                username: influencer.username,
                final_rank: rank,
                total_referrals: influencer.total_referrals,
                base_reward_amount: baseReward,
                bonus_reward_amount: bonusReward,
                total_reward_amount: totalRewardUSD,
            });
        }

        logger.info('Simulating Solana payouts...');
        const payoutResults = await solanaPaymentService.sendRewards(transactions);

        const payoutMap = new Map(payoutResults.map(r => [r.influencerId, r]));

        logger.info('Saving campaign results to database...');
        for (const result of campaignResults) {
            const payout = payoutMap.get(result.influencer_id);
            if (payout && payout.status === 'success') {
                await client.query(`
                    INSERT INTO campaign_results (id, influencer_id, player_id, username, final_rank, total_referrals, base_reward_amount, bonus_reward_amount, total_reward_amount, payout_date, payout_transaction_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    result.id, result.influencer_id, result.player_id, result.username,
                    result.final_rank, result.total_referrals, result.base_reward_amount,
                    result.bonus_reward_amount, result.total_reward_amount,
                    new Date().toISOString(), payout.transactionId
                ]);
            } else {
                 logger.error('Skipping db insert for failed transaction', { influencerId: result.influencer_id });
            }
        }

        // Mark the campaign as completed
        await client.query("INSERT INTO settings (key, value) VALUES ('campaign_payout_completed_at', $1)", [new Date().toISOString()]);

        await client.query('COMMIT');
        logger.info('✅ Campaign payout process completed successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to process campaign payout. Transaction rolled back.', {
            error: error.message,
            stack: error.stack,
        });
    } finally {
        client.release();
    }
}

/**
 * Starts the cron job for checking campaign payouts.
 */
function start() {
    // Schedule to run every 10 minutes.
    cron.schedule('*/10 * * * *', async () => {
        logger.info('CRON: Running campaign payout check...');
        try {
            await checkAndProcessCampaignPayout();
        } catch (error) {
            logger.error('CRON: Unhandled error in checkAndProcessCampaignPayout', {
                 error: error.message,
                 stack: error.stack,
            });
        }
    });

    logger.info('✅ Campaign Payout Cron Job scheduled to run every 10 minutes.');
}

module.exports = {
    start,
    checkAndProcessCampaignPayout // Export for manual triggering/testing
};
