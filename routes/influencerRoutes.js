const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, checkInfluencer } = require('../middleware/auth');
const logger = require('../logger');
const marketCapService = require('../services/marketCapService');

// @route   GET /api/influencer/panel-data
// @desc    Get data for the influencer panel (list of influencers, market cap, self-performance)
// @access  Private (Influencers only)
router.get('/panel-data', [authenticateToken, checkInfluencer], async (req, res) => {
    try {
        // Fetch all active influencers for the public list
        const allInfluencersQuery = `
            SELECT p.username, p.avatarurl, p.country, i.total_referrals
            FROM influencers i
            JOIN players p ON i.player_id = p.id
            WHERE i.status = 'active'
            ORDER BY i.total_referrals DESC;
        `;
        const allInfluencersResult = await db.query(allInfluencersQuery);

        // Get market cap data
        const marketCapData = await marketCapService.getMarketCap();

        // Get performance data for the logged-in influencer
        const selfInfluencerId = req.influencer.id;
        const selfPerformanceQuery = 'SELECT total_referrals, referral_code, status, solana_wallet_address, twitter_handle FROM influencers WHERE id = $1';
        const selfPerformanceResult = await db.query(selfPerformanceQuery, [selfInfluencerId]);

        // Get submitted content for the logged-in influencer
        const selfContentQuery = 'SELECT content_url, submitted_at, is_verified FROM influencer_content WHERE influencer_id = $1 ORDER BY submitted_at DESC';
        const selfContentResult = await db.query(selfContentQuery, [selfInfluencerId]);

        res.json({
            allInfluencers: allInfluencersResult.rows,
            marketCap: marketCapData,
            myPerformance: {
                ...selfPerformanceResult.rows[0],
                submittedContent: selfContentResult.rows
            }
        });

    } catch (error) {
        logger.error('Failed to fetch influencer panel data:', {
            error: error.message,
            stack: error.stack,
            userId: req.user.id
        });
        res.status(500).json({ message: 'Failed to retrieve influencer panel data.' });
    }
});

// @route   POST /api/influencer/content
// @desc    Submit a new piece of content for tracking
// @access  Private (Influencers only)
router.post('/content', [authenticateToken, checkInfluencer], async (req, res) => {
    const { contentUrl } = req.body;
    const influencerId = req.influencer.id; // ID from checkInfluencer middleware

    if (!contentUrl) {
        return res.status(400).json({ message: 'Content URL is required.' });
    }
    try {
        new URL(contentUrl); // Basic URL validation
    } catch (_) {
        return res.status(400).json({ message: 'Invalid URL format.' });
    }

    try {
        const submissionId = `content_${Date.now()}`;
        const submittedAt = new Date().toISOString();

        await db.query(
            `INSERT INTO influencer_content (id, influencer_id, content_url, submitted_at)
             VALUES ($1, $2, $3, $4)`,
            [submissionId, influencerId, contentUrl, submittedAt]
        );

        logger.info('Influencer content submitted successfully', { submissionId, influencerId, contentUrl });
        res.status(201).json({ message: 'Content submitted successfully.' });

    } catch (error) {
        logger.error('Failed to submit influencer content:', {
            error: error.message,
            stack: error.stack,
            userId: req.user.id,
            contentUrl,
        });
        res.status(500).json({ message: 'Failed to submit content.' });
    }
});

// @route   GET /api/influencer/content
// @desc    Get all content submissions for the logged-in influencer
// @access  Private (Influencers only)
router.get('/content', [authenticateToken, checkInfluencer], async (req, res) => {
    const influencerId = req.user.id;

    try {
        const result = await db.query(
            `SELECT content_url, likes, views, submitted_at, is_verified 
             FROM influencer_content 
             WHERE influencer_id = $1 
             ORDER BY submitted_at DESC`,
            [influencerId]
        );

        res.json(result.rows);

    } catch (error) {
        logger.error('Failed to fetch influencer content list:', {
            error: error.message,
            stack: error.stack,
            userId: req.user.id,
        });
        res.status(500).json({ message: 'Failed to retrieve content list.' });
    }
});

// @route   PUT /api/influencer/details
// @desc    Update influencer's own details (wallet, twitter)
// @access  Private (Influencers only)
router.put('/details', [authenticateToken, checkInfluencer], async (req, res) => {
    const { solanaWalletAddress, twitterHandle } = req.body;
    const influencerId = req.influencer.id;

    if (!solanaWalletAddress && !twitterHandle) {
        return res.status(400).json({ message: 'At least one field (solanaWalletAddress or twitterHandle) must be provided.' });
    }

    const updates = [];
    const values = [];
    let queryIndex = 1;

    if (solanaWalletAddress) {
        updates.push(`solana_wallet_address = $${queryIndex++}`);
        values.push(solanaWalletAddress);
    }

    if (twitterHandle) {
        updates.push(`twitter_handle = $${queryIndex++}`);
        values.push(twitterHandle);
    }

    values.push(influencerId);

    const updateQuery = `
        UPDATE influencers
        SET ${updates.join(', ')}
        WHERE id = $${queryIndex}
    `;

    try {
        await db.query(updateQuery, values);
        logger.info('Influencer details updated successfully', { influencerId, solanaWalletAddress, twitterHandle });
        res.json({ message: 'Your details have been updated successfully.' });
    } catch (error) {
        logger.error('Failed to update influencer details:', {
            error: error.message,
            stack: error.stack,
            influencerId,
        });
        res.status(500).json({ message: 'Failed to update your details.' });
    }
});

// @route   GET /api/influencer/campaign-status
// @desc    Check if the influencer campaign has been completed and paid out
// @access  Private (Influencers only)
router.get('/campaign-status', [authenticateToken, checkInfluencer], async (req, res) => {
    try {
        const result = await db.query("SELECT 1 FROM settings WHERE key = 'campaign_payout_completed_at'");
        res.json({ isCompleted: result.rowCount > 0 });
    } catch (error) {
        logger.error('Failed to fetch campaign status:', { error: error.message });
        res.status(500).json({ message: 'Failed to retrieve campaign status.' });
    }
});

// @route   GET /api/influencer/campaign-results
// @desc    Get the final results of the influencer campaign
// @access  Private (Influencers only)
router.get('/campaign-results', [authenticateToken, checkInfluencer], async (req, res) => {
    try {
        const result = await db.query(`
            SELECT final_rank, username, total_referrals, total_reward_amount
            FROM campaign_results
            ORDER BY final_rank ASC
        `);
        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to fetch campaign results:', { error: error.message });
        res.status(500).json({ message: 'Failed to retrieve campaign results.' });
    }
});

module.exports = router;
