/**
 * Real-time Leaderboard Manager
 * Handles smooth real-time updates for leaderboard without full reload
 */

class RealtimeLeaderboardManager {
    constructor() {
        this.currentLeaderboardData = [];
        this.updateQueue = [];
        this.isUpdating = false;
        this.lastUpdateTime = 0;
        this.updateThrottle = 1000; // 1 second throttle
    }

    // Initialize real-time leaderboard
    init() {
        // Listen for score updates from socket
        if (window.scoreSocketManager && window.scoreSocketManager.socket) {
            window.scoreSocketManager.socket.on('newScore', (data) => {
                this.handleNewScore(data);
            });

            window.scoreSocketManager.socket.on('leaderboardUpdate', (data) => {
                this.handleLeaderboardUpdate(data);
            });
        }
    }

    // Handle new score from socket
    handleNewScore(scoreData) {
        console.log('New score received for real-time update:', scoreData);
        
        // Update leaderboard previews immediately (no throttling for previews)
        if (typeof window.updateLeaderboardPreviewRealtime === 'function') {
            window.updateLeaderboardPreviewRealtime(scoreData);
        }
        
        // Add to update queue for main leaderboard
        this.updateQueue.push({
            type: 'newScore',
            data: scoreData,
            timestamp: Date.now()
        });

        // Process updates with throttling
        this.processUpdateQueue();
    }

    // Handle leaderboard update from socket
    handleLeaderboardUpdate(updateData) {
        console.log('Leaderboard update received:', updateData);
        
        this.updateQueue.push({
            type: 'leaderboardRefresh',
            data: updateData,
            timestamp: Date.now()
        });

        this.processUpdateQueue();
    }

    // Process update queue with throttling
    processUpdateQueue() {
        const now = Date.now();
        
        // Throttle updates to prevent too frequent refreshes
        if (now - this.lastUpdateTime < this.updateThrottle) {
            setTimeout(() => this.processUpdateQueue(), this.updateThrottle);
            return;
        }

        if (this.isUpdating || this.updateQueue.length === 0) {
            return;
        }

        this.isUpdating = true;
        this.lastUpdateTime = now;

        // Process all queued updates
        while (this.updateQueue.length > 0) {
            const update = this.updateQueue.shift();
            this.applyUpdate(update);
        }

        this.isUpdating = false;
    }

    // Apply individual update
    applyUpdate(update) {
        switch (update.type) {
            case 'newScore':
                this.applyNewScore(update.data);
                break;
            case 'leaderboardRefresh':
                this.refreshLeaderboard();
                break;
        }
    }

    // Apply new score update smoothly
    applyNewScore(scoreData) {
        console.log('Applying new score update:', scoreData);
        
        // Check if leaderboard is currently visible
        const leaderboardModal = document.getElementById('leaderboardModal');
        const isLeaderboardVisible = leaderboardModal && 
            leaderboardModal.style.display !== 'none';

        if (!isLeaderboardVisible) {
            console.log('Leaderboard not visible, skipping smooth update');
            return;
        }

        // Get current leaderboard data
        this.getCurrentLeaderboardData().then(currentData => {
            // Simulate the new score being added
            const updatedData = this.simulateScoreAddition(currentData, scoreData);
            
            // Apply smooth updates
            this.applySmoothLeaderboardUpdate(currentData, updatedData);
        }).catch(error => {
            console.error('Error applying new score update:', error);
            // Fallback to full refresh
            this.refreshLeaderboard();
        });
    }

    // Get current leaderboard data from DOM
    async getCurrentLeaderboardData() {
        try {
            // Determine which leaderboard is active
            const activeTab = document.querySelector('.tab-btn.active');
            const tabType = activeTab?.dataset.tabType;
            
            if (tabType === 'individual') {
                const response = await apiRequest('/api/leaderboard/individual');
                return response || [];
            } else if (tabType === 'country') {
                const response = await apiRequest('/api/leaderboard/country');
                return response || [];
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching current leaderboard data:', error);
            return [];
        }
    }

    // Simulate score addition to current data
    simulateScoreAddition(currentData, scoreData) {
        // This is a simplified simulation - in reality, we'd need to:
        // 1. Check if the player already exists
        // 2. Update their score if it's higher
        // 3. Re-sort the leaderboard
        // 4. Handle new players
        
        const updatedData = [...currentData];
        
        // Find existing player or add new one
        let playerIndex = updatedData.findIndex(player => 
            player.playerid === scoreData.playerId || player.name === scoreData.username
        );

        if (playerIndex !== -1) {
            // Update existing player's score if new score is higher
            const currentScore = updatedData[playerIndex].score || 0;
            if (scoreData.score > currentScore) {
                updatedData[playerIndex].score = scoreData.score;
                updatedData[playerIndex].level = scoreData.newLevel || updatedData[playerIndex].level;
                
                // Add visual indicator for updated player
                this.highlightPlayerUpdate(scoreData.playerId || scoreData.username);
            }
        } else {
            // Add new player (simplified - would need proper API call)
            console.log('New player detected, full refresh needed');
            return null; // Trigger full refresh for new players
        }

        // Sort by score
        updatedData.sort((a, b) => (b.score || 0) - (a.score || 0));

        return updatedData;
    }

    // Apply smooth leaderboard update
    applySmoothLeaderboardUpdate(oldData, newData) {
        if (!newData) {
            // Fallback to full refresh
            this.refreshLeaderboard();
            return;
        }

        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;

        // Compare old and new data to find changes
        const changes = this.findLeaderboardChanges(oldData, newData);
        
        if (changes.length === 0) {
            console.log('No changes detected in leaderboard');
            return;
        }

        console.log('Applying smooth leaderboard changes:', changes);

        // Apply changes with animations
        changes.forEach(change => {
            this.applyLeaderboardChange(change);
        });
    }

    // Find changes between old and new leaderboard data
    findLeaderboardChanges(oldData, newData) {
        const changes = [];

        // Check for rank changes and score updates
        for (let i = 0; i < Math.max(oldData.length, newData.length); i++) {
            const oldPlayer = oldData[i];
            const newPlayer = newData[i];

            if (!oldPlayer && newPlayer) {
                // New player added
                changes.push({
                    type: 'playerAdded',
                    player: newPlayer,
                    index: i
                });
            } else if (oldPlayer && !newPlayer) {
                // Player removed
                changes.push({
                    type: 'playerRemoved',
                    player: oldPlayer,
                    index: i
                });
            } else if (oldPlayer && newPlayer) {
                // Check for rank or score changes
                const oldRank = i + 1;
                const newRank = newData.findIndex(p => p.playerid === oldPlayer.playerid) + 1;
                
                if (oldRank !== newRank) {
                    changes.push({
                        type: 'rankChanged',
                        player: newPlayer,
                        oldIndex: i,
                        newIndex: newRank - 1
                    });
                }

                if (oldPlayer.score !== newPlayer.score) {
                    changes.push({
                        type: 'scoreUpdated',
                        player: newPlayer,
                        index: i,
                        oldScore: oldPlayer.score,
                        newScore: newPlayer.score
                    });
                }
            }
        }

        return changes;
    }

    // Apply individual leaderboard change
    applyLeaderboardChange(change) {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;

        switch (change.type) {
            case 'scoreUpdated':
                this.updatePlayerScore(change.player, change.oldScore, change.newScore);
                break;
            case 'rankChanged':
                this.movePlayerRank(change.player, change.oldIndex, change.newIndex);
                break;
            case 'playerAdded':
                this.addNewPlayer(change.player, change.index);
                break;
        }
    }

    // Update player score with animation
    updatePlayerScore(player, oldScore, newScore) {
        const playerElement = this.findPlayerElement(player.playerid || player.name);
        if (!playerElement) return;

        const scoreElement = playerElement.querySelector('.leaderboard-score');
        if (!scoreElement) return;

        // Add update animation
        scoreElement.classList.add('score-updating');
        
        // Animate score change
        this.animateScoreChange(scoreElement, oldScore, newScore);
        
        // Remove animation class after animation
        setTimeout(() => {
            scoreElement.classList.remove('score-updating');
        }, 1200);
    }

    // Animate score change
    animateScoreChange(element, oldScore, newScore) {
        const duration = 500;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const currentScore = Math.round(oldScore + (newScore - oldScore) * easeOut);
            element.textContent = `${currentScore.toLocaleString()} ${getTranslation('leaderboard_pts')}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.textContent = `${newScore.toLocaleString()} ${getTranslation('leaderboard_pts')}`;
            }
        };
        
        animate();
    }

    // Move player to new rank with animation
    movePlayerRank(player, oldIndex, newIndex) {
        const playerElement = this.findPlayerElement(player.playerid || player.name);
        if (!playerElement) return;

        // Add movement animation
        playerElement.style.transition = 'all 0.5s ease';
        playerElement.style.transform = 'translateY(0)';
        
        // Update rank number
        const rankElement = playerElement.querySelector('.leaderboard-rank');
        if (rankElement) {
            rankElement.textContent = `#${newIndex + 1}`;
        }

        // Remove animation after completion
        setTimeout(() => {
            playerElement.style.transition = '';
            playerElement.style.transform = '';
        }, 500);
    }

    // Add new player with animation
    addNewPlayer(player, index) {
        // For new players, we'll do a full refresh as it's complex to insert
        this.refreshLeaderboard();
    }

    // Find player element in DOM
    findPlayerElement(playerId) {
        return document.querySelector(`[data-player-id="${playerId}"]`) ||
               document.querySelector(`[data-playerid="${playerId}"]`);
    }

    // Highlight player update
    highlightPlayerUpdate(playerId) {
        const playerElement = this.findPlayerElement(playerId);
        if (playerElement) {
            playerElement.classList.add('player-updated');
            setTimeout(() => {
                playerElement.classList.remove('player-updated');
            }, 2500);
        }
    }

    // Fallback to full leaderboard refresh
    refreshLeaderboard() {
        console.log('Performing full leaderboard refresh');
        
        // Check which leaderboard is active and refresh accordingly
        const activeTab = document.querySelector('.tab-btn.active');
        const tabType = activeTab?.dataset.tabType;
        
        if (tabType === 'individual') {
            if (typeof showIndividualLeaderboard === 'function') {
                showIndividualLeaderboard();
            }
        } else if (tabType === 'country') {
            if (typeof showCountryLeaderboard === 'function') {
                showCountryLeaderboard();
            }
        }
    }
}

// Create global instance
window.realtimeLeaderboardManager = new RealtimeLeaderboardManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.scoreSocketManager) {
        window.realtimeLeaderboardManager.init();
    }

    // --- Fake Score Simulation ---
    if (localStorage.getItem('fakeScoresActive') === 'true') {
        setTimeout(startFakeScoresSimulation, 3000);
    }
});

// --- NEW PROFESSIONAL ARCHITECTURE FOR FAKE SCORES ---

// --- Casual Game Simulation Configuration ---
const casualGameSimulationConfig = {
    snake: {
        baseScore: 50,
        maxScore: 1500,
        skillMultiplier: 10, // How much skill affects score
        minIncrease: 5,
        maxIncrease: 50,
        surgeChance: 0.1, // Chance for a larger score jump
        surgeAmount: 200,
    },
    cong: {
        baseScore: 10, // Winning score is around 10-15
        maxScore: 25,
        skillMultiplier: 0.5, // Skill affects score difference
        minIncrease: 1,
        maxIncrease: 3,
        winChance: 0.7, // Chance for a simulated player to win
        winningScore: 10, // Define the winning score
    },
    cetris: {
        baseScore: 1000,
        maxScore: 50000,
        skillMultiplier: 500, // How much skill affects score
        minIncrease: 50,
        maxIncrease: 500,
        levelUpChance: 0.05, // Chance to simulate a level up
        levelScoreBonus: 1000,
    }
};

/**
 * Generates a realistic casual game score based on game mechanics and simulated player skill.
 * @param {string} gameName - The name of the casual game ('snake', 'cong', 'cetris').
 * @param {number} playerSkill - A value from 0 to 1 representing the simulated player's skill.
 * @param {number} currentScore - The current score of the game for this simulation.
 * @returns {number} The new simulated score.
 */
function generateCasualGameScore(gameName, playerState, currentScore) {
    const config = casualGameSimulationConfig[gameName];
    if (!config) {
        console.warn(`No simulation config for game: ${gameName}`);
        return currentScore;
    }

    // Handle Stumbles: If a player is stumbling, their score does not increase for this round.
    if (playerState.isStumbling) {
        return currentScore;
    }

    let scoreIncrease = 0;
    const playerSkill = playerState.skill;

    switch (gameName) {
        case 'snake':
        case 'cetris':
            // Base score increase logic
            scoreIncrease = Math.floor(Math.random() * (config.maxIncrease - config.minIncrease + 1)) + config.minIncrease;
            scoreIncrease += Math.floor(playerSkill * config.skillMultiplier);

            // Game-specific bonuses
            if (gameName === 'snake' && Math.random() < config.surgeChance * playerSkill) {
                scoreIncrease += Math.floor(Math.random() * config.surgeAmount);
            }
            if (gameName === 'cetris' && Math.random() < config.levelUpChance * playerSkill) {
                scoreIncrease += config.levelScoreBonus;
            }

            // Apply Momentum: Give a bonus to the score increase if the player has momentum.
            if (playerState.momentum > 0) {
                scoreIncrease *= 1.5; // 50% score bonus on momentum
            }

            let newScore = currentScore + Math.floor(scoreIncrease);

            // Cap score based on skill to prevent runaway scores
            if (newScore > config.maxScore * (0.5 + playerSkill * 0.5)) {
                newScore = currentScore;
            }
            
            // Ensure score never decreases and does not exceed the absolute max
            return Math.max(currentScore, Math.min(newScore, config.maxScore));

        case 'cong':
            // For Cong, momentum increases win chance. A stumble is effectively a loss.
            let winChance = config.winChance;
            if (playerState.momentum > 0) {
                winChance += 0.15; // 15% higher win chance on momentum
            }

            if (Math.random() < winChance + (playerSkill * 0.2)) {
                const playerScore = Math.floor(config.winningScore + (Math.random() * config.maxIncrease * playerSkill));
                const aiScore = Math.floor(config.winningScore - (Math.random() * config.minIncrease * (1 - playerSkill)));
                return Math.min(config.baseScore + (playerScore - aiScore), config.maxScore);
            } else {
                return 0; // A loss results in a score of 0 for that game, not a decrease.
            }

        default:
            return currentScore;
    }
}

window.isFakeScoresRunning = false;
// Centralized state for fake scores
window.fakeScores = {
    countries: {},
    casual: {}, // Deprecated in favor of fakeCasualGames
    users: {}
};

// --- NEW: Professional Casual Game Simulation State ---
window.fakeCasualGames = {
    snake: [],
    cetris: [],
    cong: []
};

const SIMULATED_CASUAL_PLAYERS = 5;

let scoreUpdateInterval = null; // Updates the in-memory state
let renderInterval = null;      // Renders the state to the DOM

function updateFakeScoreState() {
    if (!window.isFakeScoresRunning) return;

    // --- PROFESSIONAL UPDATE: Score Surge Logic ---
    if (Math.random() < 0.15) {
        const countryCodes = Object.keys(window.fakeScores.countries);
        if (countryCodes.length > 0) {
            const numToUpdate = Math.floor(Math.random() * 3) + 1;
            const shuffledCountries = [...countryCodes].sort(() => 0.5 - Math.random());
            const countriesToUpdate = shuffledCountries.slice(0, numToUpdate);
            countriesToUpdate.forEach(code => {
                const surgeAmount = Math.floor(Math.random() * 29001) + 1000;
                window.fakeScores.countries[code] += surgeAmount;
            });
        }
    }

    // --- Original Logic: Small, continuous updates ---
    Object.keys(window.fakeScores.countries).forEach(countryCode => {
        if (Math.random() < 0.7) {
            window.fakeScores.countries[countryCode] += Math.floor(Math.random() * 150) + 10;
        }
    });

    // --- NEW: Professional Casual Game Score Update ---
    Object.keys(window.fakeCasualGames).forEach(gameName => {
        const players = window.fakeCasualGames[gameName];
        const config = casualGameSimulationConfig[gameName];
        const userPool = window.simulationUserList;
        if (!config || !players || userPool.length === 0) return;

        // Update scores for existing players
        players.forEach(player => {
            // --- Manage Momentum and Stumbles State ---
            player.isStumbling = false;
            const stumbleChance = Math.max(0.01, 0.1 * (1 - player.skill)); // 10% base chance, reduced by skill
            if (Math.random() < stumbleChance) {
                player.isStumbling = true;
                player.momentum = 0; // Stumbling breaks momentum
            }

            if (player.momentum > 0) {
                player.momentum--;
            } else if (!player.isStumbling && Math.random() < 0.05) { // 5% chance to start a new streak
                player.momentum = 3; // Momentum lasts for 3 rounds
            }

            // --- Generate Score based on State ---
            player.score = generateCasualGameScore(gameName, player, player.score);
        });

        // Logic to replace players who have "finished"
        for (let i = 0; i < players.length; i++) {
            if (players[i].score >= config.maxScore || Math.random() < 0.02) { // 2% chance to be replaced
                const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
                const skill = Math.random();
                let initialScore = config.baseScore + (skill * (config.maxScore / 10));
                initialScore = generateCasualGameScore(gameName, { skill, momentum: 0, isStumbling: false }, initialScore);

                players[i] = {
                    playerId: randomUser.id,
                    username: randomUser.username,
                    avatarurl: randomUser.avatarurl,
                    countrycode: randomUser.countrycode,
                    score: Math.floor(initialScore),
                    skill: skill,
                    momentum: 0,
                    isStumbling: false,
                    displayScore: Math.floor(initialScore),
                    animationStartTime: 0,
                    animationStartScore: Math.floor(initialScore)
                };
            }
        }

        players.sort((a, b) => b.score - a.score);
    });
}

// 2. The function that reads the central state and renders it to the DOM
function renderFakeScores() {
    if (!window.isFakeScoresRunning) return;

    const leaderboardContainer = document.getElementById('leaderboardList');
    const isMainLeaderboardVisible = leaderboardContainer && leaderboardContainer.offsetParent !== null;

    // --- Render Country Scores (Main Leaderboard) with Sorting ---
    if (isMainLeaderboardVisible) {
        const mainLeaderboardSelector = '.leaderboard-item.country-item'; // Select the whole item
        const items = Array.from(leaderboardContainer.querySelectorAll(mainLeaderboardSelector));

        const oldOrder = items.map(item => item.dataset.countryCode);

        items.sort((a, b) => {
            const scoreA = window.fakeScores.countries[a.dataset.countryCode] || 0;
            const scoreB = window.fakeScores.countries[b.dataset.countryCode] || 0;
            return scoreB - scoreA;
        });

        const rankChanges = {};
        items.forEach((item, newIndex) => {
            const code = item.dataset.countryCode;
            const oldIndex = oldOrder.indexOf(code);
            if (oldIndex !== -1) {
                if (newIndex < oldIndex) rankChanges[code] = 'up';
            }
        });

        items.forEach((item, index) => {
            item.classList.remove('rank-1', 'rank-2', 'rank-3');
            if (index === 0) item.classList.add('rank-1');
            else if (index === 1) item.classList.add('rank-2');
            else if (index === 2) item.classList.add('rank-3');

            const rankEl = item.querySelector('.leaderboard-rank');
            if (rankEl) rankEl.textContent = `#${index + 1}`;

            const scoreEl = item.querySelector('.leaderboard-score');
            const countryCode = item.dataset.countryCode;
            if (countryCode && window.fakeScores.countries[countryCode] && scoreEl) {
                const currentScore = parseInt(scoreEl.textContent.replace(/\D/g, '')) || 0;
                const targetScore = window.fakeScores.countries[countryCode];
                if (currentScore !== targetScore) {
                    animateScoreChange(scoreEl, currentScore, targetScore, ` ${getTranslation('leaderboard_pts')}`);
                }
            }

            // Update Player Count
            const playerCountEl = item.querySelector('.leaderboard-player-count');
            if (playerCountEl && countryCode) {
                const countryScore = window.fakeScores.countries[countryCode] || 0;
                // We remove the parentheses and the translated word to just set the number
                playerCountEl.textContent = `(${simulatePlayerCount(countryScore)} ${getTranslation('leaderboard_players')})`;
            }

            const change = rankChanges[countryCode];
            if (change) {
                item.classList.add(`rank-${change}`);
                setTimeout(() => item.classList.remove('rank-up'), 3000);
            }
            
            leaderboardContainer.appendChild(item);
        });
    }

    // --- Render Country Scores (Preview) with Sorting ---
    const previewContainer = document.getElementById('country-leaderboard-cards-container');
    if (previewContainer) {
        const previewItems = Array.from(previewContainer.querySelectorAll('.leaderboard-card'));

        const oldOrder = previewItems.map(item => item.dataset.countryCode);

        previewItems.sort((a, b) => {
            const scoreA = window.fakeScores.countries[a.dataset.countryCode] || 0;
            const scoreB = window.fakeScores.countries[b.dataset.countryCode] || 0;
            return scoreB - scoreA;
        });

        const rankChanges = {};
        previewItems.forEach((item, newIndex) => {
            const code = item.dataset.countryCode;
            const oldIndex = oldOrder.indexOf(code);
            if (oldIndex !== -1) {
                if (newIndex < oldIndex) rankChanges[code] = 'up';
            }
        });

        previewItems.forEach((item, index) => {
            item.classList.remove('rank-1', 'rank-2', 'rank-3');
            if (index === 0) item.classList.add('rank-1');
            else if (index === 1) item.classList.add('rank-2');
            else if (index === 2) item.classList.add('rank-3');

            const rankEl = item.querySelector('.rank');
            if (rankEl) rankEl.textContent = `#${index + 1}`;

            const scoreEl = item.querySelector('.score');
            const countryCode = item.dataset.countryCode;

            if (countryCode && window.fakeScores.countries[countryCode] && scoreEl) {
                const currentScore = parseInt(scoreEl.textContent.replace(/\D/g, '')) || 0;
                const targetScore = window.fakeScores.countries[countryCode];
                if (currentScore !== targetScore) {
                    animateScoreChange(scoreEl, currentScore, targetScore, '');
                }
            }

            // Update Player Count for preview
            const playerCountEl = item.querySelector('.player-count'); 
            if (playerCountEl && countryCode) {
                const countryScore = window.fakeScores.countries[countryCode] || 0;
                playerCountEl.textContent = simulatePlayerCount(countryScore);
            }

            const change = rankChanges[countryCode];
            if (change) {
                item.classList.add(`rank-${change}`);
                setTimeout(() => item.classList.remove('rank-up'), 3000);
            }

            previewContainer.appendChild(item);
        });
    }

    // --- NEW: Render Professional Casual Game Scores ---
    const animationDuration = 1000; // ms

    Object.keys(window.fakeCasualGames).forEach(gameName => {
        const gameLeaderboard = document.getElementById(`${gameName}-leaderboard`);
        if (!gameLeaderboard) return;

        const players = window.fakeCasualGames[gameName];
        if (!players) return;

        // --- Update all player scores in the central state for animation ---
        players.forEach(player => {
            if (player.displayScore === player.score) {
                player.animationStartTime = 0;
                return;
            }
            if (player.animationStartTime === 0) {
                player.animationStartTime = Date.now();
                player.animationStartScore = player.displayScore;
            }
            const elapsed = Date.now() - player.animationStartTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            player.displayScore = Math.round(player.animationStartScore + (player.score - player.animationStartScore) * easeOut);
            if (progress >= 1) {
                player.animationStartTime = 0;
            }
        });

        // --- Render the top 3 players ---
        const top3 = players.slice(0, 3);
        const podiumCards = {
            1: gameLeaderboard.querySelector('.rank-1'),
            2: gameLeaderboard.querySelector('.rank-2'),
            3: gameLeaderboard.querySelector('.rank-3')
        };

        for (let i = 1; i <= 3; i++) {
            const card = podiumCards[i];
            const player = top3[i - 1];

            if (card) {
                if (player) {
                    const currentPlayerId = card.dataset.playerId;
                    if (currentPlayerId !== player.playerId) {
                        // New player takes this spot, re-render the card
                        card.classList.remove('empty');
                        card.dataset.playerId = player.playerId;
                        card.innerHTML = `
                            <span class="podium-rank">#${i}</span>
                            <img src="${player.avatarurl || 'assets/logo.jpg'}" alt="${player.username}" class="podium-avatar">
                            <div class="podium-name">${player.username}</div>
                            <img src="assets/flags/${(player.countrycode || 'tr').toLowerCase()}.png" alt="${player.countrycode}" class="podium-flag">
                            <div class="podium-score">${player.displayScore.toLocaleString()}</div>
                        `;
                    } else {
                        // Same player, just update the score
                        const scoreEl = card.querySelector('.podium-score');
                        if (scoreEl) {
                            scoreEl.textContent = player.displayScore.toLocaleString();
                        }
                    }
                } else {
                    // No player for this rank, clear the card
                    card.classList.add('empty');
                    card.innerHTML = '';
                    delete card.dataset.playerId;
                }
            }
        }
    });
}

/**
 * Simulates a realistic total player count based on a country's score.
 * This is based on the approved logic of proportionality with non-linear growth.
 * @param {number} countryScore The total score of the country.
 * @returns {string} A formatted string of the simulated player count (e.g., "1,234").
 */
function simulatePlayerCount(countryScore) {
    // If score is zero or very low, return a small random number of players.
    if (countryScore < 250) { 
        return (Math.floor(Math.random() * 15) + 5).toLocaleString(); // 5-20 players
    }

    // 1. Base Ratio: Assume an average player contributes 250 points.
    const baseRatio = 1 / 250;
    let playerCount = countryScore * baseRatio;

    // 2. Non-Linear Growth: Apply a curve to slow down player growth at very high scores.
    playerCount = Math.pow(playerCount, 0.95);

    // 3. Minimum Player Count: Ensure it doesn't fall below a certain threshold after the curve.
    const minimumPlayers = 20;
    playerCount = Math.max(minimumPlayers, playerCount);

    // Return a formatted whole number, localized for nice formatting (e.g., 1,234)
    return Math.round(playerCount).toLocaleString();
}

// Generic animation function
function animateScoreChange(element, start, end, suffix = '') {
    const duration = 1000; // Animation duration
    const startTime = Date.now();

    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.round(start + (end - start) * progress);
        element.textContent = current.toLocaleString() + suffix;
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    requestAnimationFrame(animate);
}

// --- NEW: Fetch real users for simulation ---
window.simulationUserList = [];

async function fetchSimulationUsers() {
    if (window.simulationUserList.length > 0) return; // Already fetched

    try {
        const users = await apiRequest('/api/profile/users/simulation-list');
        if (users && users.length > 0) {
            window.simulationUserList = users;
            console.log(`[Simulation] Successfully fetched ${users.length} users for simulation.`);
        } else {
            console.warn('[Simulation] Fetched 0 users for simulation.');
        }
    } catch (error) {
        console.error('Error fetching simulation user list:', error);
    }
}

// 3. The main start function
async function startFakeScoresSimulation() {
    if (window.isFakeScoresRunning) return;
    console.log("Starting new centralized fake scores simulation...");
    window.isFakeScoresRunning = true;

    // Fetch users before initializing
    await fetchSimulationUsers();

    // Initialize scores from the DOM
    initializeScoreState();
    initializeCasualGamesState(); // Initialize new stateful casual game sim

    // Start the loops
    scoreUpdateInterval = setInterval(updateFakeScoreState, 2000); // Update state every 2s
    renderInterval = setInterval(renderFakeScores, 500); // Render state every 0.5s
}

// Helper to read initial scores from the DOM into the central state
function initializeScoreState() {
    // Initialize country scores
    const countryScoreSelectors = '.leaderboard-item.country-item .leaderboard-score, #country-leaderboard-cards-container .score';
    document.querySelectorAll(countryScoreSelectors).forEach(el => {
        const countryCode = el.dataset.countryCode || el.closest('[data-country-code]')?.dataset.countryCode;
        if (countryCode && !window.fakeScores.countries[countryCode]) {
            window.fakeScores.countries[countryCode] = parseInt(el.textContent.replace(/\D/g, '')) || 0;
        }
    });

    // DEPRECATED: Old casual game score initialization
    /*
    document.querySelectorAll('.podium-score').forEach(el => {
        const gameName = el.closest('[id*="-leaderboard"]')?.id.replace('-leaderboard', '');
        if (gameName && !window.fakeScores.casual[gameName]) {
            window.fakeScores.casual[gameName] = parseInt(el.textContent.replace(/\D/g, '')) || 0;
        }
    });
    */
    console.log("Initial fake country score state:", JSON.parse(JSON.stringify(window.fakeScores.countries)));

    // Immediately update the state once to ensure the animation starts without delay.
    if (window.isFakeScoresRunning) {
        updateFakeScoreState();
    }
}

// --- NEW: Initialize Professional Casual Game State ---
function initializeCasualGamesState() {
    const gameNames = Object.keys(window.fakeCasualGames);
    const userPool = window.simulationUserList;

    if (userPool.length === 0) {
        console.warn("Cannot initialize casual games state: No simulation users available.");
        return;
    }

    gameNames.forEach(gameName => {
        window.fakeCasualGames[gameName] = [];
        const config = casualGameSimulationConfig[gameName];
        if (!config) return;

        for (let i = 0; i < SIMULATED_CASUAL_PLAYERS; i++) {
            const randomUser = userPool[Math.floor(Math.random() * userPool.length)];
            const skill = Math.random();
            
            let initialScore = config.baseScore + (skill * (config.maxScore / 10));
            // Pass a temporary state object for initial score generation
            initialScore = generateCasualGameScore(gameName, { skill, momentum: 0, isStumbling: false }, initialScore);

            window.fakeCasualGames[gameName].push({
                playerId: randomUser.id,
                username: randomUser.username,
                avatarurl: randomUser.avatarurl,
                countrycode: randomUser.countrycode,
                score: Math.floor(initialScore),
                skill: skill,
                momentum: 0,
                isStumbling: false,
                displayScore: Math.floor(initialScore),
                animationStartTime: 0,
                animationStartScore: Math.floor(initialScore)
            });
        }

        window.fakeCasualGames[gameName].sort((a, b) => b.score - a.score);
    });

    console.log("Initialized Professional Casual Game state:", JSON.parse(JSON.stringify(window.fakeCasualGames)));
}


// 4. The main stop function
function stopFakeScoresSimulation() {
    if (!window.isFakeScoresRunning) return;
    console.log("Stopping fake scores simulation...");
    window.isFakeScoresRunning = false;
    clearInterval(scoreUpdateInterval);
    clearInterval(renderInterval);
    scoreUpdateInterval = null;
    renderInterval = null;
    // Clear state
    window.fakeScores.countries = {};
    window.fakeScores.casual = {}; // Deprecated
    window.fakeCasualGames = { snake: [], cetris: [], cong: [] }; // Clear new state
}

// Make rescan function globally available to be called from other UI scripts
window.rescanForFakeScores = () => {
    if (window.isFakeScoresRunning) {
        console.log("Rescanning for new scores to manage...");
        initializeScoreState();
    }
};

// --- PROFESSIONAL PLAYER SCORE SIMULATION ---

window.isPlayerSimRunning = false;
window.fakePlayerScores = {}; // { playerId: { score: 12345, displayScore: 12345, animationStartTime: 0, animationStartScore: 0, hotStreak: 0 } }
let playerUpdateInterval = null;
let playerRenderInterval = null;

// 1. Initialize State from DOM
function initializePlayerScoreState() {
    console.log("Initializing or updating player simulation state from DOM...");
    const processElement = (element, isPreview) => {
        const playerId = element.dataset.playerId;
        if (playerId && !window.fakePlayerScores[playerId]) { // Only add if player is NOT already in the state
            const scoreEl = isPreview ? element.querySelector('.score') : element.querySelector('.leaderboard-score');
            if (scoreEl) {
                const initialScore = parseInt(scoreEl.textContent.replace(/\D/g, '')) || 0;
                const cappedScore = Math.min(initialScore, 900); // Cap initial score at 900
                window.fakePlayerScores[playerId] = {
                    score: cappedScore,
                    displayScore: cappedScore,
                    animationStartTime: 0,
                    animationStartScore: cappedScore,
                    hotStreak: 0,
                };
            } else {
                console.warn(`Score element not found for player ${playerId} during initialization.`);
            }
        }
    };

    // Query players from main leaderboard
    document.querySelectorAll('#leaderboardList .leaderboard-item[data-player-id]').forEach(item => processElement(item, false));

    // Query players from preview leaderboard
    document.querySelectorAll('#player-leaderboard-cards-container .leaderboard-card[data-player-id]').forEach(card => processElement(card, true));

    console.log("Updated player simulation state:", JSON.parse(JSON.stringify(window.fakePlayerScores)));
}

// 2. Update State with Professional Logic (Single Random Player Update)
function updatePlayerScoreState() {
    if (!window.isPlayerSimRunning) return;

    const playerIds = Object.keys(window.fakePlayerScores);
    if (playerIds.length === 0) return;

    // Pick one random player
    const randomPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const player = window.fakePlayerScores[randomPlayerId];

    // Only update if player's score is below the cap (900)
    if (player.score < 900) {
        let scoreIncrease = Math.floor(Math.random() * 90) + 10; // Random increase between 10 and 100

        // Hot streak logic (can still apply to make increases larger)
        if (player.hotStreak > 0) {
            scoreIncrease *= 1.5; // 1.5x score on hot streak
            player.hotStreak--;
        } else if (Math.random() < 0.08) { // 8% chance to start a hot streak
            player.hotStreak = Math.floor(Math.random() * 2) + 1; // Streak for 1-2 rounds
        }

        player.score += Math.round(scoreIncrease);
        player.score = Math.min(player.score, 900); // Cap the score at 900
    }
}

// 3. Render State to DOM (Centralized Animation)
function renderPlayerScores() {
    if (!window.isPlayerSimRunning) return;

    const animationDuration = 1000; // ms

    // --- Update all player scores in the central state ---
    Object.keys(window.fakePlayerScores).forEach(playerId => {
        const player = window.fakePlayerScores[playerId];

        // If the display score is already at the target score, do nothing.
        if (player.displayScore === player.score) {
            player.animationStartTime = 0; // Reset animation state
            return;
        }

        // If an animation is not running for this player, start one.
        if (player.animationStartTime === 0) {
            player.animationStartTime = Date.now();
            player.animationStartScore = player.displayScore;
        }

        // Calculate animation progress
        const elapsed = Date.now() - player.animationStartTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        // Calculate the new display score
        const newDisplayScore = Math.round(player.animationStartScore + (player.score - player.animationStartScore) * easeOut);
        player.displayScore = newDisplayScore;

        // If animation is finished, reset the state
        if (progress >= 1) {
            player.animationStartTime = 0;
        }
    });

    // --- Render Main Individual Leaderboard ---
    const mainLeaderboardContainer = document.getElementById('leaderboardList');
    const isIndividualTabActive = mainLeaderboardContainer && document.querySelector('.tab-btn.active[data-tab-type="individual"]');

    if (isIndividualTabActive) {
        const items = Array.from(mainLeaderboardContainer.querySelectorAll('.leaderboard-item[data-player-id]'));
        const oldOrder = items.map(item => item.dataset.playerId);

        items.sort((a, b) => {
            const scoreA = window.fakePlayerScores[a.dataset.playerId]?.score || 0;
            const scoreB = window.fakePlayerScores[b.dataset.playerId]?.score || 0;
            return scoreB - scoreA;
        });

        const rankChanges = {};
        items.forEach((item, newIndex) => {
            const id = item.dataset.playerId;
            const oldIndex = oldOrder.indexOf(id);
            if (oldIndex !== -1) {
                if (newIndex < oldIndex) rankChanges[id] = 'up';
            }
        });

        items.forEach((item, index) => {
            item.classList.remove('rank-1', 'rank-2', 'rank-3');
            if (index === 0) item.classList.add('rank-1');
            else if (index === 1) item.classList.add('rank-2');
            else if (index === 2) item.classList.add('rank-3');

            const playerId = item.dataset.playerId;
            const scoreData = window.fakePlayerScores[playerId];
            if (!scoreData) return;

            const rankEl = item.querySelector('.leaderboard-rank');
            if (rankEl) rankEl.textContent = `#${index + 1}`;

            const scoreEl = item.querySelector('.leaderboard-score');
            if(scoreEl) scoreEl.textContent = `${scoreData.displayScore.toLocaleString()} ${getTranslation('leaderboard_pts')}`;

            // Update Game Mode
            const gameModeEl = item.querySelector('.leaderboard-mode');
            if (gameModeEl) {
                gameModeEl.textContent = `(${getGameModeFromScore(scoreData.displayScore)})`;
            }

            const change = rankChanges[playerId];
            if (change) {
                item.classList.add(`rank-${change}`);
                setTimeout(() => item.classList.remove('rank-up'), 3000);
            }

            mainLeaderboardContainer.appendChild(item);
        });
    }

    // --- Render Top Players Preview ---
    const previewContainer = document.getElementById('player-leaderboard-cards-container');
    if (previewContainer) {
        const items = Array.from(previewContainer.querySelectorAll('.leaderboard-card[data-player-id]'));
        const oldOrder = items.map(item => item.dataset.playerId);

        items.sort((a, b) => {
            const scoreA = window.fakePlayerScores[a.dataset.playerId]?.score || 0;
            const scoreB = window.fakePlayerScores[b.dataset.playerId]?.score || 0;
            return scoreB - scoreA;
        });

        const rankChanges = {};
        items.forEach((item, newIndex) => {
            const id = item.dataset.playerId;
            const oldIndex = oldOrder.indexOf(id);
            if (oldIndex !== -1) {
                if (newIndex < oldIndex) rankChanges[id] = 'up';
            }
        });

        items.forEach((item, index) => {
            item.classList.remove('rank-1', 'rank-2', 'rank-3');
            if (index === 0) item.classList.add('rank-1');
            else if (index === 1) item.classList.add('rank-2');
            else if (index === 2) item.classList.add('rank-3');

            const playerId = item.dataset.playerId;
            const scoreData = window.fakePlayerScores[playerId];
            if (!scoreData) return;

            const rankEl = item.querySelector('.rank');
            if (rankEl) rankEl.textContent = `#${index + 1}`;

            const scoreEl = item.querySelector('.score');
            if(scoreEl) scoreEl.textContent = scoreData.displayScore.toLocaleString();

            // Update Game Mode for preview
            const gameModeEl = item.querySelector('.game-mode');
            if (gameModeEl) {
                gameModeEl.textContent = getGameModeFromScore(scoreData.displayScore);
            }

            const change = rankChanges[playerId];
            if (change) {
                item.classList.add(`rank-${change}`);
                setTimeout(() => item.classList.remove('rank-up'), 3000);
            }

            previewContainer.appendChild(item);
        });
    }
}

/**
 * Determines the game mode (NxN) based on a player's score.
 * This logic is derived from the user's requirement for non-overlapping ranges
 * and a relationship to the product of game mode dimensions (N*N).
 * @param {number} score The player's simulated score.
 * @returns {string} The game mode string (e.g., '2x2', '3x3', '30x30').
 */
function getGameModeFromScore(score) {
    // Handle very low scores or edge cases
    if (score <= 0) return '1x1'; // Or a default like 'N/A'

    // Calculate N such that N*N is the smallest square greater than or equal to the score.
    // Math.ceil ensures that score 5 (sqrt=2.23) becomes 3 (3x3).
    let N = Math.ceil(Math.sqrt(score));

    // Cap N at 30, as the max simulated score is 900 (30*30).
    N = Math.min(N, 30);

    return `${N}x${N}`;
}

// 4. Main Control Functions
function startPlayerScoreSimulation() {
    if (window.isPlayerSimRunning) return;
    console.log("Starting professional player score simulation...");
    window.isPlayerSimRunning = true;

    initializePlayerScoreState();

    playerUpdateInterval = setInterval(updatePlayerScoreState, 2500); // Update state every 2.5s
    playerRenderInterval = setInterval(renderPlayerScores, 50);   // Render state at ~60fps
}

function stopPlayerScoreSimulation() {
    if (!window.isPlayerSimRunning) return;
    console.log("Stopping professional player score simulation...");
    window.isPlayerSimRunning = false;
    clearInterval(playerUpdateInterval);
    clearInterval(playerRenderInterval);
    playerUpdateInterval = null;
    playerRenderInterval = null;
    window.fakePlayerScores = {};
}

// Make rescan function globally available
window.rescanForPlayerScores = () => {
    if (window.isPlayerSimRunning) {
        console.log("Rescanning for new players to manage in simulation...");
        initializePlayerScoreState();
    }
};

// Listen for events to control the new simulation
window.addEventListener('start-player-sim', startPlayerScoreSimulation);
window.addEventListener('stop-player-sim', stopPlayerScoreSimulation);

// Listen for events from the admin panel
window.addEventListener('start-fake-scores', startFakeScoresSimulation);
window.addEventListener('stop-fake-scores', stopFakeScoresSimulation);

// Auto-start if flag is set
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('playerSimActive') === 'true') {
        // Delay start to ensure leaderboards are loaded
        setTimeout(startPlayerScoreSimulation, 4000);
    }
});
