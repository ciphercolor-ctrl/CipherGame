let previousRanks = {
    individual: [], // Stores an array of player IDs
    country: []     // Stores an array of country codes
};

function isMobile() {
    return window.innerWidth <= 768; // Adjust breakpoint as needed
}

async function showLeaderboard() {
    // Hide the game result overlay which might be capturing mouse events.
    const gameResultOverlay = document.getElementById('gameResultOverlay');
    if (gameResultOverlay) {
        gameResultOverlay.style.display = 'none';
        // Also remove classes just in case they have lingering visual effects
        gameResultOverlay.classList.remove('win-active', 'lose-active');
    }

    // Find the game container and hide its scrollbar to prevent nested scrolling issues.
    const gameContainer = document.querySelector('#gameModal .game-container');
    if (gameContainer) {
        gameContainer.style.overflowY = 'hidden';
    }

    showScreen('leaderboardScreen');

    // Rescan for simulations to manage newly visible elements
    if (window.rescanForFakeScores) {
        setTimeout(window.rescanForFakeScores, 200);
    }
    if (window.rescanForPlayerScores) {
        setTimeout(window.rescanForPlayerScores, 200);
    }
    
    // Add event listeners for tab buttons using event delegation
    const leaderboardTabs = document.querySelector('#leaderboardScreen .leaderboard-tabs');
    if (leaderboardTabs) {
        // Use a persistent listener if it might be called multiple times
        if (!leaderboardTabs.hasAttribute('data-listener-added')) {
            leaderboardTabs.addEventListener('click', (event) => {
                const clickedBtn = event.target.closest('.tab-btn');
                if (clickedBtn) {
                    const tabType = clickedBtn.dataset.tabType;
                    showLeaderboardTab(tabType);
                }
            });
            leaderboardTabs.setAttribute('data-listener-added', 'true');
        }
    }
    await showLeaderboardTab('country');
}

async function showLeaderboardTab(tabType) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tabType === tabType) {
            btn.classList.add('active');
        }
    });

    const leaderboardList = document.getElementById('leaderboardList');
    const loadingTaskId = `leaderboard-${tabType}`;

    // Show loading animation
    if (window.loadingAnimation) {
        window.loadingAnimation.addLoadingTask(loadingTaskId, 'loadingLeaderboard');
    }
    leaderboardList.classList.add('loading');

    try {
        if (tabType === 'country') {
            await showCountryLeaderboard();
        } else {
            await showIndividualLeaderboard();
        }
        // After rendering, rescan for simulations to initialize state from new DOM elements
        if (window.rescanForFakeScores) {
            window.rescanForFakeScores();
        }
        if (window.rescanForPlayerScores) {
            window.rescanForPlayerScores();
        }
    } catch (error) {
        logger.error('Could not load leaderboard:', error);
        leaderboardList.innerHTML = `<div class="error">${getTranslation('leaderboard_load_error')}</div>`;
    } finally {
        // Hide loading animation
        if (window.loadingAnimation) {
            window.loadingAnimation.removeLoadingTask(loadingTaskId);
        }
        leaderboardList.classList.remove('loading');
    }
}

async function showCountryLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const data = await apiRequest('/api/leaderboard/country');
    if (window.IS_DEVELOPMENT) {
        logger.debug('Country Leaderboard Data:', data);
    }

    // --- Rank Change Logic ---
    const newOrder = data.map(entry => entry.countryCode);
    const oldOrder = previousRanks.country;
    const rankChanges = {}; // { countryCode: 'up' | 'down' }

    if (oldOrder.length > 0) {
        newOrder.forEach((code, newIndex) => {
            const oldIndex = oldOrder.indexOf(code);
            if (oldIndex !== -1) { // If the country existed before
                if (newIndex < oldIndex) {
                    rankChanges[code] = 'up';
                } 
            }
        });
    }
    previousRanks.country = newOrder;
    // --- End Rank Change Logic ---

    leaderboardList.innerHTML = '';

    if (data.length === 0) {
        leaderboardList.innerHTML = '<div class="no-data">No country data yet. Be the first to play!</div>';
        return;
    }

    data.forEach((entry, index) => {
        const flagPath = entry.flag;
        let countryDisplayName = getTranslation('country_' + entry.countryCode.toLowerCase());
        if (isMobile() && countryDisplayName.length > 9) {
            countryDisplayName = countryDisplayName.substring(0, 9) + '...';
        }
        const item = document.createElement('div');
        
        let rankClass = 'leaderboard-item country-item';
        if (index === 0) rankClass += ' rank-1';
        else if (index === 1) rankClass += ' rank-2';
        else if (index === 2) rankClass += ' rank-3';

        // Add rank change class
        const change = rankChanges[entry.countryCode];
        if (change === 'up') {
            rankClass += ' rank-up';
        } else if (change === 'down') {
            rankClass += ' rank-down';
        }

        item.className = rankClass;
        item.dataset.countryCode = entry.countryCode; // Add data attribute for fake score targeting

        const scoreToDisplay = (window.isFakeScoresRunning && window.fakeScores.countries && window.fakeScores.countries[entry.countryCode])
            ? window.fakeScores.countries[entry.countryCode]
            : entry.averageScore;

        item.innerHTML = `
            <div class="leaderboard-left-group">
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-info">
                    <span class="country-flag"><img src="${flagPath}" alt="${countryDisplayName} Flag" class="flag-icon"></span>
                    <span class="leaderboard-name">${countryDisplayName}</span>
                    <span class="leaderboard-player-count">(${entry.playerCount} ${getTranslation('leaderboard_players')})</span>
                </div>
            </div>
            <div class="leaderboard-score" data-country-code="${entry.countryCode}">${scoreToDisplay.toLocaleString()} ${getTranslation('leaderboard_pts')}</div>
        `;
        leaderboardList.appendChild(item);

        // Remove animation class after a delay
        if (change) {
            setTimeout(() => {
                item.classList.remove('rank-up');
            }, 3000);
        }
    });

    if (window.rescanForFakeScores) {
        window.rescanForFakeScores();
    }
}

async function showIndividualLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const data = await apiRequest('/api/leaderboard/individual');
    if (window.IS_DEVELOPMENT) {
        logger.debug('Individual Leaderboard Data:', data);
    }

    // --- Rank Change Logic ---
    const newOrder = data.map(p => p.playerid);
    const oldOrder = previousRanks.individual;
    const rankChanges = {}; // { playerId: 'up' | 'down' }

    if (oldOrder.length > 0) {
        newOrder.forEach((id, newIndex) => {
            const oldIndex = oldOrder.indexOf(id);
            if (oldIndex !== -1) { // If the player existed before
                if (newIndex < oldIndex) {
                    rankChanges[id] = 'up';
                }
            }
        });
    }
    previousRanks.individual = newOrder;
    // --- End Rank Change Logic ---

    // --- Simulation Score Injection ---
    if (window.isFakeScoresRunning && window.fakeScores && window.fakeScores.players) {
        data.forEach(player => {
            if (window.fakeScores.players[player.playerid]) {
                player.score = window.fakeScores.players[player.playerid];
            }
        });
        // Re-sort data based on fake scores
        data.sort((a, b) => b.score - a.score);
    }
    // --- End Simulation Score Injection ---

    leaderboardList.innerHTML = '';

    if (data.length === 0) {
        leaderboardList.innerHTML = '<div class="no-data">No scores yet. Be the first to play!</div>';
        return;
    }

    data.forEach((score, index) => {
        if (window.IS_DEVELOPMENT) {
            logger.debug(`Leaderboard player: ${score.name}, Level: ${score.level}, Score: ${score.score}`);
        }
        const countryCode = score.country;
        const flagPath = countries[countryCode] ? countries[countryCode].flag : '';
        let countryDisplayName = getTranslation('country_' + countryCode.toLowerCase());
        if (isMobile() && countryDisplayName.length > 9) {
            countryDisplayName = countryDisplayName.substring(0, 9) + '...';
        }
        const item = document.createElement('div');
        let rankClass = 'leaderboard-item';
        if (index === 0) rankClass += ' rank-1';
        else if (index === 1) rankClass += ' rank-2';
        else if (index === 2) rankClass += ' rank-3';

        const change = rankChanges[score.playerid];
        if (change === 'up') {
            rankClass += ' rank-up';
        }

        item.className = rankClass;
        item.dataset.playerId = score.playerid;

        const levelClass = score.level > 0 ? ` level-${score.level}-border` : ' no-border';

        // Use the potentially updated score
        const scoreToDisplay = score.score;

        item.innerHTML = `
            <div class="leaderboard-left-group">
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-info">
                    <img src="${score.avatarUrl || 'assets/logo.jpg'}" alt="Avatar" class="leaderboard-avatar${levelClass} clickable-avatar">
                    <span class="country-flag"><img src="${flagPath}" alt="${countryDisplayName} Flag" class="flag-icon"></span>
                    <span class="leaderboard-name">${isMobile() && score.name.length > 9 ? score.name.substring(0, 9) + '...' : score.name}</span>
                    <span class="leaderboard-mode">(${score.mode})</span>
                </div>
            </div>
            <div class="leaderboard-score" data-player-id="${score.playerid}">${scoreToDisplay.toLocaleString()} ${getTranslation('leaderboard_pts')}</div>
        `;
        leaderboardList.appendChild(item);

        if (change) {
            setTimeout(() => {
                item.classList.remove('rank-up');
            }, 4000);
        }
    });

    if (window.rescanForPlayerScores) {
        window.rescanForPlayerScores();
    }

    if (!leaderboardList.hasAttribute('data-click-listener-added')) {
        leaderboardList.addEventListener('click', (event) => {
            const clickedItem = event.target.closest('.leaderboard-item');
            const isAvatarClick = event.target.closest('.clickable-avatar');

            if (isAvatarClick) {
                return;
            }

            if (clickedItem && clickedItem.dataset.playerId) {
                showPlayerProfile(clickedItem.dataset.playerId);
            }
        });
        leaderboardList.setAttribute('data-click-listener-added', 'true');
    }
}

// --- Real-time Refresh Function ---
function refreshIndividualLeaderboard() {
    const leaderboardScreen = document.getElementById('leaderboardScreen');
    const individualTab = document.querySelector('.tab-btn[data-tab-type="individual"]');

    // Only refresh if the leaderboard is visible and the individual tab is active
    if (leaderboardScreen.classList.contains('active') && individualTab && individualTab.classList.contains('active')) {
        if (window.IS_DEVELOPMENT) {
            logger.debug('Refreshing individual leaderboard due to real-time update.');
        }
        showIndividualLeaderboard();
    }
}

// Expose the refresh function to the global scope so the score handler can call it
window.refreshIndividualLeaderboard = refreshIndividualLeaderboard;