const cron = require('node-cron');
const logger = require('../logger');
const { executePayoutLogic } = require('../services/payoutService');

/**
 * Initializes a cron job to periodically check for and execute the influencer payout logic.
 */
function initializePayoutCron() {
    // Schedule the task to run every 10 minutes.
    // This interval is a balance between responsiveness and not overloading the services.
    cron.schedule('*/10 * * * *', async () => {
        logger.info('Cron job triggered: Running executePayoutLogic...');
        try {
            await executePayoutLogic();
        } catch (error) {
            logger.error('An unexpected error occurred during the scheduled payout execution.', {
                error: error.message,
                stack: error.stack
            });
        }
    });

    logger.info('Payout cron job initialized. The payout logic will be checked every 10 minutes.');
}

module.exports = {
    initializePayoutCron
};
