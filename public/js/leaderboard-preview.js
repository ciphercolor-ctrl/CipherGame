// Function to fetch and render TOP PLAYERS leaderboard preview
async function fetchAndRenderLeaderboardPreview() {
    const container = document.getElementById('player-leaderboard-cards-container');
    if (!container) return;

    // Add loading indicator
    container.innerHTML = '<div class="preview-loading">Loading...</div>';

    try {
        // Corrected API endpoint
        const topPlayers = await apiRequest('/api/leaderboard/individual', 'GET');

        // --- Simulation Score Injection for Preview ---
        if (window.isFakeScoresRunning && window.fakeScores && window.fakeScores.players) {
            topPlayers.forEach(player => {
                if (window.fakeScores.players[player.playerid]) {
                    player.score = window.fakeScores.players[player.playerid];
                }
            });
            // Re-sort data based on fake scores to get the correct top 3
            topPlayers.sort((a, b) => b.score - a.score);
        }
        // --- End Simulation Score Injection ---

        if (topPlayers.length === 0) {
            container.innerHTML = '<p style="color: #A0A0B0;">No players on the leaderboard yet.</p>';
            return;
        }

        container.innerHTML = ''; // Clear loading

        topPlayers.slice(0, 3).forEach((player, index) => {
            const rank = index + 1;
            const card = document.createElement('div');
            card.className = `leaderboard-card rank-${rank}`;
            card.dataset.playerId = player.playerid || player.name; // Add player ID for real-time updates
            let rankContent = `<span class="rank">#${rank}</span>`;
            const levelClass = player.level > 0 ? ` level-${player.level}-border` : ' no-border';
            card.innerHTML = `
                ${rankContent}
                <span class="player-name-above-avatar">${player.name}</span>
                <img src="${player.avatarUrl || 'assets/logo.jpg'}" alt="${player.name}'s Avatar" class="leaderboard-preview-avatar${levelClass} clickable-avatar">
                <img src="assets/flags/${player.country.toLowerCase()}.png" alt="${getTranslation('country_' + player.country.toLowerCase())} Flag" class="flag-icon">
                <span class="score" data-player-id="${player.playerid || player.name}">${player.score.toLocaleString()}</span>
                <span class="game-mode">${player.mode}</span>
                <span class="realtime-indicator"></span>
            `;
            container.appendChild(card);
        });

        // Store current data for real-time updates
        window.currentLeaderboardPreviewData = topPlayers.slice(0, 3);

    } catch (error) {
        logger.error('Failed to fetch top players preview:', error);
        container.innerHTML = '<p style="color: #A0A0B0;">Leaderboard could not be loaded.</p>';
    }
}

// Function to fetch and render BY COUNTRY leaderboard preview
async function fetchAndRenderCountryLeaderboardPreview() {
    const container = document.getElementById('country-leaderboard-cards-container');
    if (!container) return;

    // Add loading indicator
    container.innerHTML = '<div class="preview-loading">Loading...</div>';

    try {
        const countryScores = await apiRequest('/api/scores/country', 'GET');

        if (countryScores.length === 0) {
            container.innerHTML = '<p style="color: #A0A0B0;">No country data available yet.</p>';
            return;
        }

        container.innerHTML = ''; // Clear loading

        countryScores.slice(0, 3).forEach((country, index) => {
            const rank = index + 1;
            const card = document.createElement('div');
            card.className = `leaderboard-card rank-${rank}`;
            card.dataset.countryCode = country.countryCode; // Add country code for real-time updates
            let rankContent = `<span class="rank">#${rank}</span>`;
            // Note: The country card structure is slightly different
            card.innerHTML = `
                ${rankContent}
                <span class="player-name-above-avatar">${getTranslation('country_' + country.countryCode.toLowerCase())}</span>
                <div class="country-flag-container">
                    <img src="assets/flags/${country.countryCode.toLowerCase()}.png" alt="${getTranslation('country_' + country.countryCode.toLowerCase())}" class="country-flag-large">
                </div>
                <span class="score" data-country-code="${country.countryCode}">${parseInt(country.averageScore).toLocaleString()}</span>
                <div class="player-count-container">
                    <i class="fas fa-users"></i>
                    <span class="player-count">${country.playerCount.toLocaleString()}</span>
                </div>
                <span class="realtime-indicator"></span>
            `;
            container.appendChild(card);
        });

        // Store current data for real-time updates
        window.currentCountryPreviewData = countryScores.slice(0, 3);

    } catch (error) {
        logger.error('Failed to fetch country leaderboard preview:', error);
        container.innerHTML = '<p style="color: #A0A0B0;">Leaderboard could not be loaded.</p>';
    }
}

function initializeLeaderboardPreviews() {
    fetchAndRenderLeaderboardPreview();
    fetchAndRenderCountryLeaderboardPreview();
}

window.initializeLeaderboardPreviews = initializeLeaderboardPreviews;

document.addEventListener('DOMContentLoaded', () => {
    // Use querySelectorAll to handle multiple buttons
    const viewFullLeaderboardBtns = document.querySelectorAll('.view-full-leaderboard-btn');
    
    if (viewFullLeaderboardBtns.length > 0) {
        viewFullLeaderboardBtns.forEach(btn => {
            // The showLeaderboard function is likely in ui.js or main.js and attached to window
            btn.addEventListener('click', () => {
                if (window.showLeaderboard) {
                    window.showLeaderboard();
                } else {
                    logger.warn('showLeaderboard function not found');
                }
            });
        });
    }
});

document.addEventListener('languageChanged', initializeLeaderboardPreviews);

// Real-time update functions for leaderboard previews
async function updateLeaderboardPreviewRealtime(scoreData) {
    console.log('Updating leaderboard preview with new score:', scoreData);
    
    const casualGames = ['snake', 'pong', 'cetris'];
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (casualGames.includes(scoreData.mode)) {
        await updateCasualGamePreviewRealtime(scoreData);
    } else {
        // For main game, both individual and country previews might need updates.
        const individualRefreshNeeded = await updateIndividualPreviewRealtime(scoreData);
        await updateCountryPreviewRealtime(scoreData);

        if (individualRefreshNeeded) {
            await fetchAndRenderLeaderboardPreview();
        }
    }

    window.scrollTo(0, currentScrollTop);
}

function updateIndividualPreviewRealtime(scoreData) {
    return new Promise(resolve => {
        const container = document.getElementById('player-leaderboard-cards-container');
        if (!container) return resolve(false);

        const playerCard = container.querySelector(`[data-player-id="${scoreData.playerId}"]`);
        if (!playerCard) {
            console.log(`Player ${scoreData.playerId} not found in preview, signaling full refresh.`);
            return resolve(true); // Signal that a full refresh is needed
        }

        const scoreElement = playerCard.querySelector('.score[data-player-id]');
        if (!scoreElement) return resolve(false);

        const currentScore = parseInt(scoreElement.textContent.replace(/[^\d]/g, ''));

        if (scoreData.score > currentScore) {
            scoreElement.classList.add('score-updating');
            playerCard.classList.add('player-updated');
            animatePreviewScoreChange(scoreElement, currentScore, scoreData.score);

            setTimeout(() => {
                scoreElement.classList.remove('score-updating');
                playerCard.classList.remove('player-updated');
                console.log(`Updated preview score for ${scoreData.username}: ${currentScore} → ${scoreData.score}`);
                resolve(false); // No full refresh needed, smooth update applied
            }, 2500);
        } else {
            resolve(false); // No update needed
        }
    });
}

async function updateCountryPreviewRealtime(scoreData) {
    // Country scores are complex, so a full refresh is acceptable,
    // but it must be awaited.
    console.log('Country preview update needed - refreshing');
    await fetchAndRenderCountryLeaderboardPreview();
}

async function updateCasualGamePreviewRealtime(scoreData) {
    console.log(`Casual game ${scoreData.mode} score update - refreshing preview`);
    showCasualGameUpdateNotification(scoreData);
    // For casual games, rankings might change, so we refresh both previews.
    // This must be awaited.
    await Promise.all([
        fetchAndRenderLeaderboardPreview(),
        fetchAndRenderCountryLeaderboardPreview()
    ]);
}

// Show casual game update notification
function showCasualGameUpdateNotification(scoreData) {
    // Remove any existing casual game notifications
    const existingNotifications = document.querySelectorAll('.casual-game-update');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'casual-game-update';
    
    const gameNames = {
        'snake': '🐍 Snake',
        'pong': '🏓 Pong',
        'cetris': '🧩 Tetris'
    };
    
    const gameName = gameNames[scoreData.mode] || scoreData.mode;
    notification.innerHTML = `
        <div>${gameName} Score Update!</div>
        <div style="font-size: 14px; margin-top: 5px;">${scoreData.username}: ${scoreData.score.toLocaleString()}</div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after animation
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

function animatePreviewScoreChange(element, oldScore, newScore) {
    const duration = 800;
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const currentScore = Math.round(oldScore + (newScore - oldScore) * easeOut);
        element.textContent = `${currentScore.toLocaleString()}`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = `${newScore.toLocaleString()}`;
        }
    };
    
    animate();
}

// Make functions globally available
window.updateLeaderboardPreviewRealtime = updateLeaderboardPreviewRealtime;

// Manual initialization function for debugging
window.initScoreSocket = () => {
    console.log('[ScoreSocket] Manual initialization called');
    if (window.scoreSocketManager) {
        window.scoreSocketManager.init();
    } else {
        console.error('[ScoreSocket] ScoreSocketManager not found');
    }
};

// Debug function to check status
window.checkScoreSocketStatus = () => {
    console.log('[ScoreSocket] Status check:', {
        manager: !!window.scoreSocketManager,
        socket: !!(window.scoreSocketManager && window.scoreSocketManager.socket),
        connected: !!(window.scoreSocketManager && window.scoreSocketManager.isConnected),
        gameState: {
            isLoggedIn: gameState?.isLoggedIn,
            playerId: gameState?.playerId,
            username: gameState?.username
        }
    });
};