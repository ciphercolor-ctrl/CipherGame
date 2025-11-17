const db = require('../db');
const logger = require('../logger');
const marketCapService = require('./marketCapService');
const solanaPaymentService = require('./solanaPaymentService');

const PAYOUT_COMPLETED_KEY = 'campaign_payout_completed_at';

// Reward constants (in USD)
const BASE_REWARD = 3000;
const BONUS_REWARDS = {
    1: 30000, // 1st place
    2: 15000, // 2nd place
    3: 7500   // 3rd place
};

/**
 * Executes the main payout logic for the influencer campaign.
 * 1. Checks if the payout has already been done.
 * 2. Checks if the market cap target has been reached.
 * 3. Finds all eligible influencers.
 * 4. Calculates their rewards.
 * 5. Triggers the (simulated) payment process.
 * 6. Records the results in the database.
 */
async function executePayoutLogic() {
    logger.info('Starting payout logic check...');

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // 1. Check if payout has already been completed
        const payoutCheck = await client.query('SELECT value FROM settings WHERE key = $1', [PAYOUT_COMPLETED_KEY]);
        if (payoutCheck.rowCount > 0) {
            logger.info(`Payout has already been completed on ${payoutCheck.rows[0].value}. Aborting.`);
            await client.query('COMMIT');
            client.release();
            return;
        }

        // 2. Check if market cap target is reached
        const marketCapData = await marketCapService.getMarketCap();
        if (!marketCapData || !marketCapData.targetReached) {
            logger.info(`Market cap target of $${marketCapService.TARGET_MARKET_CAP.toLocaleString()} not reached. Current: $${(marketCapData.marketCap || 0).toLocaleString()}. Aborting.`);
            await client.query('COMMIT');
            client.release();
            return;
        }

        logger.info('Market cap target reached! Proceeding with payout logic.');

        // 3. Find eligible influencers
        const eligibleInfluencersQuery = `
            SELECT 
                i.id as influencer_id, 
                i.player_id, 
                i.solana_wallet_address, 
                i.total_referrals,
                p.username
            FROM influencers i
            JOIN players p ON i.player_id = p.id
            WHERE 
                i.status = 'active'
                AND i.solana_wallet_address IS NOT NULL 
                AND i.solana_wallet_address != ''
                AND EXISTS (
                    SELECT 1 FROM influencer_content ic 
                    WHERE ic.influencer_id = i.id AND ic.is_verified = TRUE
                )
            ORDER BY i.total_referrals DESC, i.created_at ASC;
        `;
        const influencersResult = await client.query(eligibleInfluencersQuery);
        const eligibleInfluencers = influencersResult.rows;

        if (eligibleInfluencers.length === 0) {
            logger.warn('Market cap target reached, but no eligible influencers found. Aborting.');
            await client.query('COMMIT');
            client.release();
            return;
        }

        logger.info(`Found ${eligibleInfluencers.length} eligible influencers for payout.`);

        // 4. Calculate rewards and prepare transactions
        const transactions = eligibleInfluencers.map((influencer, index) => {
            const rank = index + 1;
            const baseReward = BASE_REWARD;
            const bonusReward = BONUS_REWARDS[rank] || 0;
            const totalReward = baseReward + bonusReward;

            // NOTE: The `amount` here is in USD value as per the agreement.
            // The actual conversion to $CIPHER tokens would happen either here (if we have a price feed)
            // or within the solanaPaymentService.
            return {
                influencerId: influencer.influencer_id,
                walletAddress: influencer.solana_wallet_address,
                amount: totalReward, // This is the USD value to be paid in $CIPHER
                // Store details for recording later
                details: {
                    ...influencer,
                    rank,
                    baseReward,
                    bonusReward,
                    totalReward
                }
            };
        });

        // 5. Execute (simulated) payouts
        const paymentResults = await solanaPaymentService.sendRewards(transactions);

        // 6. Record results
        for (const result of paymentResults) {
            if (result.status === 'success') {
                const txDetails = transactions.find(t => t.influencerId === result.influencerId).details;
                
                // Insert into campaign_results
                const resultId = `result_${Date.now()}_${txDetails.influencer_id}`;
                await client.query(
                    `INSERT INTO campaign_results (id, influencer_id, player_id, username, final_rank, total_referrals, base_reward_amount, bonus_reward_amount, total_reward_amount, payout_date, payout_transaction_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`, 
                    [
                        resultId, txDetails.influencer_id, txDetails.player_id, txDetails.username, 
                        txDetails.rank, txDetails.total_referrals, txDetails.baseReward, txDetails.bonusReward, 
                        txDetails.totalReward, result.transactionId
                    ]
                );

                // Update influencer status to 'completed'
                await client.query('UPDATE influencers SET status = $1 WHERE id = $2', ['completed', txDetails.influencer_id]);
                logger.info(`Successfully recorded payout for influencer ${txDetails.influencer_id} (Rank #${txDetails.rank})`);
            } else {
                logger.error(`Payout failed for influencer ${result.influencerId}. Error: ${result.error}. Not recording result.`);
            }
        }

        // 7. Mark payout as complete
        await client.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [PAYOUT_COMPLETED_KEY, new Date().toISOString()]);
        logger.info('Payout process completed successfully. A marker has been set to prevent re-runs.');

        await client.query('COMMIT');
        logger.info('Database transaction committed.');

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
            logger.error('Error during payout logic. Transaction rolled back.', { error: error.message, stack: error.stack });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
}

module.exports = {
    executePayoutLogic
};
