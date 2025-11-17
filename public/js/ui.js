// --- UI Helper Functions ---
const preloadedSounds = {}; // Object to store preloaded audio elements

function preloadGameSounds() {
    const soundsToPreload = [
        { name: 'click', path: 'assets/click.mp3' },
        { name: 'win', path: 'assets/win.mp3' },
        { name: 'lose', path: 'assets/lose.mp3' }
    ];

    soundsToPreload.forEach(sound => {
        const audio = new Audio(sound.path);
        audio.load(); // Start loading the audio
        preloadedSounds[sound.name] = audio;
    });
}

function showScreen(screenId) {
    if (gameState.currentScreen && gameState.currentScreen !== screenId) {
        gameState.screenHistory.push(gameState.currentScreen);
    }
    gameState.currentScreen = screenId;

    const screens = document.querySelectorAll('.game-screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
        if (typeof applyTranslations === 'function') {
            applyTranslations();
        }
    }

    const gameInfoDisplay = document.querySelector('.game-info-display');
    if (gameInfoDisplay) {
        if (screenId === 'gameScreen') {
            gameInfoDisplay.style.display = 'flex';
        } else {
            gameInfoDisplay.style.display = 'none';
        }
    }

    if (screenId === 'profileScreen') {
        populateMyProfileData();
    }

    // Show/hide explanation button based on current screen
    const explanationBtn = document.getElementById('explanationBtn');
    if (explanationBtn) {
        if (screenId === 'mainMenu') {
            explanationBtn.style.display = 'block';
        } else {
            explanationBtn.style.display = 'none';
        }
    }

    // Ensure scroll is still disabled for modal transitions
    if (document.getElementById('gameModal').style.display === 'block' && !document.body.classList.contains('no-scroll')) {
        const scrollY = window.scrollY;
        document.body.style.top = `-${scrollY}px`;
        document.body.classList.add('no-scroll');
    }
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

function openPlayerInfoModal() {
    // Save current scroll position before disabling scroll
    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    
    document.getElementById('playerInfoModal').style.display = 'block';
    document.body.classList.add('no-scroll');

    // Focus on the visible input
    setTimeout(() => {
        if (document.getElementById('loginTab').classList.contains('active')) {
            document.getElementById('usernameInput').focus();
        } else if (document.getElementById('registerTab').classList.contains('active')) {
            document.getElementById('usernameInputRegister').focus();
        }
    }, 100);
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

function closePlayerInfoModal() {
    document.getElementById('playerInfoModal').style.display = 'none';
    
    // Restore scroll position and remove no-scroll class
    const scrollY = document.body.style.top;
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

let isCarouselSetup = false;

function setupCarousel() {
    const carousel = document.querySelector('.casual-games-carousel');
    const paginationContainer = document.querySelector('.carousel-pagination');
    const gameCards = document.querySelectorAll('.game-card');

    if (!carousel || !paginationContainer || gameCards.length === 0) {
        return;
    }
    
    const middleIndex = Math.floor(gameCards.length / 2);

    function updatePagination() {
        const carouselCenter = carousel.scrollLeft + carousel.offsetWidth / 2;
        let closestIndex = -1;
        let minDistance = Infinity;

        gameCards.forEach((card, index) => {
            const cardCenter = card.offsetLeft + card.offsetWidth / 2;
            const distance = Math.abs(carouselCenter - cardCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        const dots = paginationContainer.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === closestIndex);
        });
    }

    if (!isCarouselSetup) {
        paginationContainer.innerHTML = ''; // Clear dots
        gameCards.forEach(() => {
            const dot = document.createElement('button');
            dot.classList.add('dot');
            paginationContainer.appendChild(dot);
        });
        carousel.addEventListener('scroll', updatePagination);
        isCarouselSetup = true;
    }

    // Scroll to the middle card instantly. Use a timeout to ensure layout is calculated.
    setTimeout(() => {
        if (gameCards[middleIndex]) {
            const scrollTarget = gameCards[middleIndex].offsetLeft - (carousel.offsetWidth / 2) + (gameCards[middleIndex].offsetWidth / 2);
            carousel.scrollTo({
                left: scrollTarget,
                behavior: 'instant'
            });
        }
    }, 100);

    // Update pagination after the scroll
    setTimeout(updatePagination, 150);
}

function openCasualGamesModal() {
    // Save current scroll position before disabling scroll
    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    
    document.getElementById('casualGamesModal').style.display = 'block';
    document.body.classList.add('no-scroll');

    // Ensure all game containers are hidden first
    document.getElementById('snake-game-container').classList.add('hidden');
    document.getElementById('cong-game-container').classList.add('hidden');
    document.getElementById('cetris-game-container').classList.add('hidden');

    // Show the casual game selection menu
    document.getElementById('casual-game-selection').classList.remove('hidden');

    // Load leaderboards
    loadCasualPodiums();

    // If the fake score simulation is running, rescan for new elements to initialize their state
    if (window.rescanForFakeScores) {
        setTimeout(window.rescanForFakeScores, 200); // Timeout to allow DOM to render
    }

    // Setup and position the carousel
    setupCarousel();
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

async function loadCasualPodiums() {
    const games = ['snake', 'cetris', 'cong'];
    
    games.forEach(async (game) => {
        try {
            const leaderboardData = await apiRequest(`/api/casual-scores/${game}`, 'GET');
            renderPodium(game, leaderboardData);
        } catch (error) {
            logger.error(`Failed to load podium for ${game}:`, error);
            renderPodium(game, []); // Render an empty state on error
        }
    });
}

async function refreshCasualLeaderboard(gameName) {
    try {
        const leaderboardData = await apiRequest(`/api/casual-scores/${gameName}`, 'GET');
        renderPodium(gameName, leaderboardData);
        logger.debug(`[UI] Refreshed casual leaderboard for ${gameName}`);
    } catch (error) {
        logger.error(`Failed to refresh podium for ${gameName}:`, error);
    }
}
window.refreshCasualLeaderboard = refreshCasualLeaderboard;

function renderPodium(gameName, data) {
    const podiumContainer = document.querySelector(`#${gameName}-leaderboard`);
    if (!podiumContainer) return;

    const rank1Card = podiumContainer.querySelector('.rank-1');
    const rank2Card = podiumContainer.querySelector('.rank-2');
    const rank3Card = podiumContainer.querySelector('.rank-3');

    // Reset all cards
    [rank1Card, rank2Card, rank3Card].forEach(card => {
        if (card) {
            card.innerHTML = '';
            card.classList.add('empty');
        }
    });

    // Helper to populate a card
    const populateCard = (card, player, rank) => {
        if (!card || !player) return;

        const flagUrl = (countries[player.country] && countries[player.country].flag) ? countries[player.country].flag : 'assets/flags/default.png';
        const avatarUrl = player.avatarurl || 'assets/logo.jpg';
        const levelClass = player.level > 0 ? ` level-${player.level}-border` : ' no-border';

        card.innerHTML = `
            <span class="podium-rank">#${rank}</span>
            <img src="${avatarUrl}" alt="${player.username}'s avatar" class="podium-avatar${levelClass}">
            <span class="podium-name">${escapeHTML(player.username)}</span>
            <img src="${flagUrl}" alt="${player.country}" class="podium-flag">
            <span class="podium-score">${player.score}</span>
        `;
        card.classList.remove('empty');
    };

    // Populate cards based on data
    if (data && data.length > 0) {
        // data is already sorted by score DESC
        populateCard(rank1Card, data[0], 1);
        populateCard(rank2Card, data[1], 2);
        populateCard(rank3Card, data[2], 3);
    }
}

// Helper function to prevent XSS
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
}

function navigateBackInCasualGames() {
    const snakeGameContainer = document.getElementById('snake-game-container');
    const cetrisGameContainer = document.getElementById('cetris-game-container');
    const congGameContainer = document.getElementById('cong-game-container');
    const casualGameSelection = document.getElementById('casual-game-selection');

    const isSnakeActive = snakeGameContainer && !snakeGameContainer.classList.contains('hidden');
    const isCetrisActive = cetrisGameContainer && !cetrisGameContainer.classList.contains('hidden');
    const isCongActive = congGameContainer && !congGameContainer.classList.contains('hidden');

    if (isSnakeActive || isCetrisActive || isCongActive) {
        // Stop the active game's loop
        if (isSnakeActive && typeof window.showCasualMenu === 'function') {
            window.showCasualMenu(); // This function in snake.js handles stopping and hiding
        } else if (isCetrisActive && window.cetrisGame && typeof window.cetrisGame.stop === 'function') {
            window.cetrisGame.stop();
        } else if (isCongActive && window.congGame && typeof window.congGame.stop === 'function') {
            window.congGame.stop();
        }

        // Hide all game containers and show the selection menu
        if(snakeGameContainer) snakeGameContainer.classList.add('hidden');
        if(cetrisGameContainer) cetrisGameContainer.classList.add('hidden');
        if(congGameContainer) congGameContainer.classList.add('hidden');
        if(casualGameSelection) casualGameSelection.classList.remove('hidden');

        // Ensure scroll is still disabled for modal
        if (!document.body.classList.contains('no-scroll')) {
            const scrollY = window.scrollY;
            document.body.style.top = `-${scrollY}px`;
            document.body.classList.add('no-scroll');
        }

    } else {
        // If no game is active, the back button should close the modal
        closeCasualGamesModal();
    }
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

function closeCasualGamesModal() {
    const casualGamesModal = document.getElementById('casualGamesModal');
    if (casualGamesModal) {
        casualGamesModal.style.display = 'none';
        
        // Restore scroll position and remove no-scroll class
        const scrollY = document.body.style.top;
        document.body.classList.remove('no-scroll');
        document.body.style.top = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}



function setupCountrySearch() {
    const searchInput = document.getElementById('countrySearchInput');
    const select = document.getElementById('playerCountrySelect');

    if (searchInput && select) {
        searchInput.addEventListener('keyup', () => {
            const filter = searchInput.value.toLowerCase();
            const options = select.getElementsByTagName('option');
            
            for (const option of options) {
                const text = option.textContent.toLowerCase();
                if (text.includes(filter)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            }
        });
    }
}

function showAuthTab(tabId) {
    document.querySelectorAll('.auth-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`${tabId}Tab`).classList.add('active');
    const button = document.getElementById(`show${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Tab`);
    if (button) {
        button.classList.add('active');
    }

    // Focus on the username input of the active tab
    setTimeout(() => {
        if (tabId === 'login') {
            document.getElementById('usernameInput').focus();
        } else if (tabId === 'register') {
            document.getElementById('usernameInputRegister').focus();
        }
    }, 100);


    if (tabId === 'register') {
        if (typeof window.detectUserCountry === 'function') {
            window.detectUserCountry().then(countryCode => {
                populateCountryDropdown(countryCode);
            });
        } else {
            logger.warn('window.detectUserCountry is not defined. Country auto-detection will not work.');
            populateCountryDropdown(); // Fallback to populating without pre-selection
        }
    } else {
        populateCountryDropdown(); // Ensure dropdown is populated for other tabs too, without pre-selection
    }
}

function showNotification(message, type, isRateLimitError = false) {
    const notificationBar = document.getElementById('notificationBar');
    if (!notificationBar) return;

    // Clone the node to safely remove all previous event listeners
    const newNotificationBar = notificationBar.cloneNode(true);
    notificationBar.parentNode.replaceChild(newNotificationBar, notificationBar);
    
    let finalMessage = message;

    if (isRateLimitError) {
        // 1. Change the message to be discreet and not hint at a bypass
        finalMessage = getTranslation('errorSystemBusy', 'System is currently busy. Please try again later.');
        
        // 2. Make the notification clickable
        newNotificationBar.style.cursor = 'pointer';

        // 3. Add a one-time click listener to dispatch the custom event for bypass
        const bypassClickHandler = () => {
            document.dispatchEvent(new CustomEvent('requestBypass'));
            // Hide notification immediately after it's clicked
            newNotificationBar.classList.remove('show');
        };
        newNotificationBar.addEventListener('click', bypassClickHandler, { once: true });

    } else {
        newNotificationBar.style.cursor = 'default';
    }

    newNotificationBar.textContent = finalMessage;
    newNotificationBar.className = `notification-bar show ${type}`;

    // Hide after a delay, but not for the rate limit error, which should be clicked away by the user.
    if (!isRateLimitError) {
        setTimeout(() => {
            newNotificationBar.classList.remove('show');
        }, 5000);
    }
}

function updateProfileDisplay(level) {
    const profileNameElement = document.getElementById('profilePlayerName');
    const profileCountryFlagElement = document.getElementById('profileCountryFlag');
    const gameBtn = document.querySelector('.game-btn');
    const headerPlayGameBtn = document.getElementById('headerPlayGameBtn'); // Mobile button
    const headerPlayGameBtnDesktop = document.getElementById('headerPlayGameBtnDesktop'); // Desktop button
    const myProfileBtn = document.getElementById('myProfileBtn');

    const gameModalProfileLogo = document.querySelector('.profile-logo');
    const profileAvatarPreview = document.getElementById('profileAvatarPreview');

    const avatarToUse = (gameState.isLoggedIn && gameState.avatarUrl) ? gameState.avatarUrl : 'assets/logo.jpg';
    const cacheBustedAvatarUrl = `${avatarToUse}?t=${new Date().getTime()}`;

    if (gameState.isLoggedIn) {
        if (profileNameElement) profileNameElement.textContent = gameState.username;
        if (profileCountryFlagElement) {
            const countryInfo = countries[gameState.playerCountry];
            profileCountryFlagElement.innerHTML = countryInfo ? `<img src="${countryInfo.flag}" alt="${countryInfo.name} Flag" class="flag-icon">` : '';
        }
        if(gameBtn) {
            const span = gameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('playGame');
        }
        if(headerPlayGameBtn) {
            const span = headerPlayGameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('playGame');
        }
        // Add logic for desktop button
        if(headerPlayGameBtnDesktop) {
            const span = headerPlayGameBtnDesktop.querySelector('span');
            if(span) span.textContent = getTranslation('playGame');
        }
        if(myProfileBtn) {
            myProfileBtn.innerHTML = ` ${getTranslation('myProfile')}`;
        }

    } else {
        if (profileNameElement) profileNameElement.textContent = getTranslation('guest');
        if (profileCountryFlagElement) profileCountryFlagElement.innerHTML = '';
        if(gameBtn) {
            const span = gameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('loginOrRegister');
        }
        if(headerPlayGameBtn) {
            const span = headerPlayGameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('loginOrRegister');
        }
        // Add logic for desktop button
        if(headerPlayGameBtnDesktop) {
            const span = headerPlayGameBtnDesktop.querySelector('span');
            if(span) span.textContent = getTranslation('loginOrRegister');
        }
        if(myProfileBtn) {
            myProfileBtn.innerHTML = ` ${getTranslation('myProfile')}`;
        }
    }

    if (gameModalProfileLogo) {
        gameModalProfileLogo.src = cacheBustedAvatarUrl;
        if (level > 0) {
            gameModalProfileLogo.className = `profile-logo level-${level}-border`;
        }
        else {
            gameModalProfileLogo.className = 'profile-logo no-border';
        }
    }
    if (profileAvatarPreview) {
        profileAvatarPreview.src = cacheBustedAvatarUrl;
        if (level > 0) {
            profileAvatarPreview.className = `profile-avatar-preview level-${level}-border`;
        }
        else {
            profileAvatarPreview.className = 'profile-avatar-preview no-border';
        }
    }

    // Call positionPlayGameButton after UI update
    if (typeof positionPlayGameButton === 'function') {
        positionPlayGameButton();
    }
}

async function showPlayerProfile(playerId) {
    try {
        const player = await apiRequest(`/api/players/${playerId}`, 'GET');

        document.getElementById('playerProfileUsername').textContent = player.username;
        document.getElementById('playerProfileCountry').innerHTML = countries[player.country] ? `<img src="${countries[player.country].flag}" alt="${countries[player.country].name} Flag" class="flag-icon"> ${countries[player.country].name}` : player.country;
        document.getElementById('playerProfileAvatar').src = player.avatarurl || 'assets/logo.jpg';
        document.getElementById('playerProfileGamesPlayed').textContent = player.gameCount;
        document.getElementById('playerProfileHighestScore').textContent = player.highestScore;
        document.getElementById('playerProfileJoinedDate').textContent = new Date(player.createdAt).toLocaleDateString();

        const playerScoresList = document.getElementById('playerProfileScores');
        playerScoresList.innerHTML = '';
        if (player.scores && player.scores.length > 0) {
            player.scores.forEach(score => {
                const li = document.createElement('li');
                li.textContent = `${getTranslation('mode')}: ${score.mode}, ${getTranslation('score')}: ${score.score} (${new Date(score.timestamp).toLocaleDateString()})`;
                playerScoresList.appendChild(li);
            });
        } else {
            playerScoresList.innerHTML = `<li>${getTranslation('noScoresYet')}</li>`;
        }

        document.getElementById('playerProfileModal').style.display = 'block';
    } catch (error) {
        logger.error('Failed to fetch player profile:', error);
        showNotification(`${getTranslation('loadProfileFailed')}: ${error.message}`, 'error');
    }
}

function goBack() {
    if (gameState.screenHistory.length > 0) {
        const previousScreenId = gameState.screenHistory.pop();
        showScreen(previousScreenId);
    } else {
        showScreen('mainMenu'); // Fallback to main menu if no history
    }
}

// --- Emoji Picker Functions ---
function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.classList.toggle('show');
}

function populateEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    if (!emojiPicker || emojiPicker.innerHTML !== '') return; // Populate only once

    const emojis = [
        '😀', '😂', '😊', '😍', '🤔', '😎', '😭', '😡', '👍', '👎', '❤️', '🔥', '🚀', '🎉', '💰', '💎',
        '💯', '🙏', '🙌', '🤷', '🤦', '👀', '🤯', '🤣', '🥰', '😘', '🤩', '😴', '👋', '👌', '✌️', '🤞',
        '🧠', '💪', '🎮', '🏆', '🌍', '🏳️', '⚔️', '🛡️', '📈', '📉', '💡', '💀', '🤖', '👾', '👽', '👑'
    ];

    emojis.forEach(emoji => {
        const emojiSpan = document.createElement('span');
        emojiSpan.textContent = emoji;
        emojiSpan.addEventListener('click', () => insertEmoji(emoji));
        emojiPicker.appendChild(emojiSpan);
    });
}

function insertEmoji(emoji) {
    const chatInput = document.getElementById('chatInput');
    chatInput.value += emoji;
    chatInput.focus();
}

function playSound(soundName) {
    if (gameState.isSoundMuted) return;

    const audio = preloadedSounds[soundName];
    if (audio) {
        audio.currentTime = 0; // Rewind to the start
        audio.play().catch(error => console.error(`Error playing sound: ${soundName}`, error));
    } else {
        console.warn(`Sound not found in preloaded sounds: ${soundName}`);
    }
}



function populateChatTabs() {
    const chatRoomList = document.getElementById('chatRoomList');
    if (!chatRoomList) return;

    chatRoomList.innerHTML = ''; // Clear existing options

    // Fetch rooms dynamically from the server
    apiRequest('/api/chat/rooms', 'GET')
        .then(serverRooms => {
            // Ensure 'Global' is always the first option
            let rooms = ['Global'];
            serverRooms.forEach(room => {
                if (room !== 'Global' && !rooms.includes(room)) {
                    rooms.push(room);
                }
            });
            rooms.sort(); // Sort other rooms alphabetically

            rooms.forEach(room => {
                const li = document.createElement('li');
                const translationKey = 'chat_room_' + room.toLowerCase().replace('-', '_');
                li.textContent = getTranslation(translationKey, room); // Pass room as fallback
                li.dataset.roomName = room;
                li.classList.add('chat-room-list-item');
                if (room === gameState.currentRoom) {
                    li.classList.add('active');
                }
                li.addEventListener('click', () => {
                    selectChatTab(room);
                    // Close sidebar on selection
                    document.getElementById('chatRoomSidebar').classList.remove('active');
                    document.getElementById('chatRoomDropdownBtn').classList.remove('active');
                });
                chatRoomList.appendChild(li);
            });
        })
        .catch(error => {
            logger.error('Failed to fetch chat rooms:', error);
            showNotification(getTranslation('failedToLoadChatRooms'), 'error');
            // Fallback to static rooms if API fails
            const fallbackRooms = ['Global', ...Object.keys(continentMap)];
            fallbackRooms.sort().forEach(room => {
                const li = document.createElement('li');
                const translationKey = 'chat_room_' + room.toLowerCase().replace('-', '_');
                li.textContent = getTranslation(translationKey, room); // Pass room as fallback
                li.dataset.roomName = room;
                li.classList.add('chat-room-list-item');
                if (room === gameState.currentRoom) {
                    li.classList.add('active');
                }
                li.addEventListener('click', () => {
                    selectChatTab(room);
                    document.getElementById('chatRoomSidebar').classList.remove('active');
                    document.getElementById('chatRoomDropdownBtn').classList.remove('active');
                });
                chatRoomList.appendChild(li);
            });
        });
}

function selectChatTab(roomName) {
    // Only proceed if the room is actually changing
    if (gameState.currentRoom === roomName) {
        return;
    }

    gameState.currentRoom = roomName;
    gameState.chatHistoryOffset = 0; // Reset offset when changing rooms

    // Update the active class in the list
    document.querySelectorAll('.chat-room-list-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.roomName === roomName) {
            item.classList.add('active');
        }
    });

    if (socket && socket.connected) {
        socket.emit('joinRoom', { playerId: gameState.playerId, username: gameState.username, country: gameState.playerCountry, room: roomName });
    }
    fetchChatMessages(roomName);
}

function createTokenChart() {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) {
        return;
    }

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const ctx = document.getElementById('tokenChart');
                if (ctx) {
                    if (ctx.chart) {
                        ctx.chart.destroy();
                    }
                    const data = {
                        labels: [
                            getTranslation('publicSale'),
                            getTranslation('team')
                        ],
                        datasets: [{
                            data: [97, 3],
                            backgroundColor: [
                                '#00d4ff',
                                '#ff0096'
                            ],
                            borderWidth: 2,
                            borderColor: '#1a1a2e',
                            hoverBorderColor: '#fff',
                            hoverBorderWidth: 3,
                        }]
                    };

                    const options = {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        animation: {
                            animateScale: true,
                            animateRotate: true,
                            duration: 2000,
                            easing: 'easeInOutQuart'
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                enabled: false,
                                external: function(context) {
                                    let tooltipEl = document.getElementById('chartjs-tooltip');
                                    if (!tooltipEl) {
                                        tooltipEl = document.createElement('div');
                                        tooltipEl.id = 'chartjs-tooltip';
                                        tooltipEl.innerHTML = '<table></table>';
                                        document.body.appendChild(tooltipEl);
                                    }
                                    const tooltipModel = context.tooltip;
                                    if (tooltipModel.opacity === 0) {
                                        tooltipEl.style.opacity = 0;
                                        return;
                                    }
                                    tooltipEl.classList.remove('above', 'below', 'no-transform');
                                    if (tooltipModel.yAlign) {
                                        tooltipEl.classList.add(tooltipModel.yAlign);
                                    } else {
                                        tooltipEl.classList.add('no-transform');
                                    }
                                    function getBody(bodyItem) {
                                        return bodyItem.lines;
                                    }
                                    if (tooltipModel.body) {
                                        const titleLines = tooltipModel.title || [];
                                        const bodyLines = tooltipModel.body.map(getBody);
                                        let innerHtml = '<thead>';
                                        titleLines.forEach(function(title) {
                                            innerHtml += '<tr><th>' + title + '</th></tr>';
                                        });
                                        innerHtml += '</thead><tbody>';
                                        bodyLines.forEach(function(body, i) {
                                            const colors = tooltipModel.labelColors[i];
                                            // Apply background and border color directly to span for Chart.js color blocks
                                            let spanStyle = 'background:' + colors.backgroundColor + '; border-color:' + colors.borderColor + '; border-width: 2px;';
                                            const span = '<span style="' + spanStyle + '"></span>';
                                            innerHtml += '<tr><td>' + span + body + '</td></tr>';
                                        });
                                        innerHtml += '</tbody>';
                                        let table = tooltipEl.querySelector('table');
                                        table.innerHTML = innerHtml;
                                    }
                                    const position = context.chart.canvas.getBoundingClientRect();
                                    tooltipEl.style.opacity = 1;
                                    tooltipEl.style.position = 'absolute';
                                    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                                    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                                    // Add the new class for static styles
                                    tooltipEl.classList.add('chartjs-tooltip-dynamic');
                                    // Remove direct style assignments that are now in CSS
                                    // tooltipEl.style.font = '1rem Inter, sans-serif';
                                    // tooltipEl.style.padding = tooltipModel.padding + 'px ' + tooltipModel.padding + 'px';
                                    // tooltipEl.style.pointerEvents = 'none';
                                    // tooltipEl.style.background = 'rgba(15, 26, 43, 0.9)';
                                    // tooltipEl.style.border = '1px solid #00AEEF';
                                    // tooltipEl.style.borderRadius = '10px';
                                    // tooltipEl.style.color = '#fff';
                                    // tooltipEl.style.transition = 'opacity 0.2s';
                                    // tooltipEl.style.boxShadow = '0 0 15px rgba(0, 174, 239, 0.5)';
                                }
                            }
                        }
                    };

                    ctx.chart = new Chart(ctx, {
                        type: 'doughnut',
                        data: data,
                        options: options
                    });
                }
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(chartContainer);
}

document.addEventListener('DOMContentLoaded', () => {
    preloadGameSounds(); // Preload all game sounds

    const introOverlay = document.getElementById('intro-overlay');
    const mainContent = document.getElementById('main-content');

    const transitionToMainContent = () => {
        if (introOverlay) {
            introOverlay.style.opacity = '0';
            setTimeout(() => {
                if (introOverlay) {
                    introOverlay.style.display = 'none';
                }
            }, 500);
        }
        if (mainContent) {
            mainContent.style.opacity = '1';
        }
    };

    if (localStorage.getItem('hasVisited')) {
        document.body.classList.add('intro-skipped');
        if (introOverlay) {
            introOverlay.style.display = 'none';
        }
        if (mainContent) {
            mainContent.style.opacity = '1';
        }
    } else {
        localStorage.setItem('hasVisited', 'true');
        setTimeout(transitionToMainContent, 3000);
    }
});

function populateCountryDropdown(selectedCountryCode = null) {
    const select = document.getElementById('playerCountrySelect');
    if (!select) return;

    select.setAttribute('size', 8); // Make it a listbox

    select.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.textContent = getTranslation('selectCountry');
    defaultOption.value = '';
    select.appendChild(defaultOption);

    const sortedCountries = Object.entries(countries).sort(([, a], [, b]) => a.name.localeCompare(b.name));

    for (const [code, country] of sortedCountries) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = country.name;
        if (selectedCountryCode && code === selectedCountryCode) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

document.addEventListener('languageChanged', () => {
    logger.debug('Language changed event received in ui.js');
    if (typeof updateProfileDisplay === 'function' && typeof gameState !== 'undefined') {
        updateProfileDisplay(gameState.level);
    }
    if (typeof populateCountryDropdown === 'function') {
        populateCountryDropdown();
    }
    if (typeof createTokenChart === 'function') {
        createTokenChart();
    }
});

function show30x30Choice() {
    showScreen('mode-30x30-choice-modal');
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        showNotification(getTranslation('selectValidImage'), 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const gameGrid = document.getElementById('gameGrid');
        if (!gameGrid) return;

        // Remove previous preview if it exists
        const oldPreview = document.getElementById('image-preview-overlay');
        if (oldPreview) {
            oldPreview.remove();
        }

        // Create image preview
        const preview = document.createElement('img');
        preview.id = 'image-preview-overlay';
        preview.src = e.target.result;
        
        gameGrid.appendChild(preview);

        // Update button visibility
        const selectBtn = document.getElementById('select-photo-btn');
        if(selectBtn) selectBtn.style.display = 'none';
        
        const applyBtn = document.getElementById('apply-photo-btn');
        if(applyBtn) applyBtn.style.display = 'block';
    };
    reader.onerror = () => {
        showNotification(getTranslation('failedToReadFile'), 'error');
    };
    reader.readAsDataURL(file);
}
