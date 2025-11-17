const nodeFetch = require('node-fetch');
const logger = require('../logger');

// Ensure fetch is globally available, especially for older Node.js versions or specific environments
if (typeof global.fetch === 'undefined') {
    global.fetch = nodeFetch;
}

// --- Configuration ---
// TODO: Replace with the actual $CIPHER token contract address
const CIPHER_TOKEN_CONTRACT_ADDRESS = process.env.CIPHER_TOKEN_CONTRACT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Fallback to USDC placeholder
const COINGECKO_API_URL = `https://api.coingecko.com/api/v3/coins/solana/contract/${CIPHER_TOKEN_CONTRACT_ADDRESS}`;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const TARGET_MARKET_CAP = parseFloat(process.env.TARGET_MARKET_CAP || '100000000'); // Default to $100M

// --- In-Memory Cache ---
let lastMarketCapData = null;
let lastFetchTime = 0;

/**
 * Fetches the latest market cap data from CoinGecko API.
 */
async function fetchMarketCapFromAPI() {
    logger.debug('Fetching latest market cap data from CoinGecko...');
    try {
        const response = await fetch(COINGECKO_API_URL);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`CoinGecko API request failed with status ${response.status}: ${errorBody}`);
        }
        const data = await response.json();

        // The market cap is usually in market_data.market_cap.usd
        if (data && data.market_data && data.market_data.market_cap && typeof data.market_data.market_cap.usd === 'number') {
            const marketCap = data.market_data.market_cap.usd;
            const price = data.market_data.current_price.usd; // Assuming price is also available here
            
            lastMarketCapData = {
                marketCap: marketCap,
                price: price,
                targetMarketCap: TARGET_MARKET_CAP,
                remainingToTarget: Math.max(0, TARGET_MARKET_CAP - marketCap),
                targetReached: marketCap >= TARGET_MARKET_CAP
            };
            lastFetchTime = Date.now();
            
            logger.info(`Successfully fetched market cap: $${marketCap.toLocaleString()}`);
        } else {
            logger.warn('CoinGecko API response did not contain the expected market cap data structure.', { response: data });
        }
    } catch (error) {
        logger.error('Failed to fetch market cap from CoinGecko API:', {
            error: error.message,
            stack: error.stack,
        });
        // In case of an error, we don't update the timestamp, so it will try again on the next request.
    }
}

/**
 * Gets the market cap data, using a cache to avoid excessive API calls.
 * @returns {Promise<{marketCap: number, price: number, targetMarketCap: number, remainingToTarget: number, targetReached: boolean}>}
 */
async function getMarketCap() {
    const now = Date.now();
    if (!lastMarketCapData || (now - lastFetchTime > CACHE_DURATION_MS)) {
        // Cache is stale or empty, fetch new data
        await fetchMarketCapFromAPI(); // Await here to ensure data is fresh before returning
    }
    
    // Return the currently cached data immediately
    return lastMarketCapData || { marketCap: 0, price: 0, targetMarketCap: TARGET_MARKET_CAP, remainingToTarget: TARGET_MARKET_CAP, targetReached: false };
}

// --- Initial Fetch & Periodic Refresh ---
// Perform an initial fetch on startup
fetchMarketCapFromAPI().catch(error => logger.error('Initial fetchMarketCapFromAPI failed:', { error: error.message, stack: error.stack }));

// Set up a periodic refresh every 5 minutes
setInterval(() => {
    fetchMarketCapFromAPI().catch(error => logger.error('Periodic fetchMarketCapFromAPI failed:', { error: error.message, stack: error.stack }));
}, CACHE_DURATION_MS);

logger.info('Market Cap Service initialized. Will refresh every 5 minutes.');

module.exports = {
    getMarketCap,
    CIPHER_TOKEN_ID: CIPHER_TOKEN_CONTRACT_ADDRESS, // Renamed for clarity
    TARGET_MARKET_CAP
};