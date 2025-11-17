// Theme functionality is now handled by theme.js

document.addEventListener('DOMContentLoaded', () => {
    // Initialize admin panel with its own language system
    setupAdminPanel();
    initializeAdminLanguageSwitcher();
    
    // Listen for theme changes to re-render charts
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                // Theme changed, re-render charts if stats section is visible
                const statsSection = document.getElementById('statsSection');
                if (statsSection && statsSection.style.display !== 'none') {
                    setTimeout(() => {
                        loadCharts();
                    }, 100);
                }
            }
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
});

function updateAdminFlag(lang) {
    const currentFlag = document.getElementById('currentFlagAdmin');
    if (!currentFlag) return;

    // Find the language option to get the correct flag source
    const option = document.querySelector(`.language-option[data-lang='${lang}']`);
    if (option) {
        const flagSrc = option.querySelector('img').src;
        const flagAlt = option.querySelector('img').alt;
        currentFlag.src = flagSrc;
        currentFlag.alt = flagAlt;
    }
}

function initializeAdminLanguageSwitcher() {
    const languageBtn = document.getElementById('languageBtnAdmin');
    const languageDropdown = document.getElementById('languageDropdownAdmin');

    if (!languageBtn || !languageDropdown) return;

    // Set initial flag - use admin-specific language storage
    const savedLanguage = localStorage.getItem('adminLanguage') || 'en';
    updateAdminFlag(savedLanguage);
    
    // Load admin translations
    loadAdminTranslations(savedLanguage);

    languageBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        languageDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (event) => {
        if (!languageDropdown.contains(event.target) && !languageBtn.contains(event.target)) {
            languageDropdown.classList.remove('show');
        }
    });

    languageDropdown.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', (event) => {
            event.preventDefault();
            const newLang = option.getAttribute('data-lang');
            localStorage.setItem('adminLanguage', newLang); // Use admin-specific storage
            updateAdminFlag(newLang);
            loadAdminTranslations(newLang);
            languageDropdown.classList.remove('show');
        });
    });
}

// Admin panel translations
const adminTranslations = {
    en: {
        'users': 'Users',
        'settings': 'Settings',
        'statistics': 'Statistics',
        'logout': 'Logout',
        'userManagement': 'User Management',
        'sortBy': 'Sort By:',
        'id': 'ID',
        'username': 'Username',
        'country': 'Country',
        'createdAt': 'Created At',
        'levelActions': 'Level Actions',
        'actions': 'Actions',
        'update': 'Update',
        'reset': 'Reset',
        'edit': 'Edit',
        'delete': 'Delete',
        'generalSettings': 'General Settings',
        'siteTitle': 'Site Title',
        'welcomeMessage': 'Welcome Message',
        'save': 'Save',
        'chatManagement': 'Chat Management',
        'clearAllMessages': 'Clear All Messages',
        'clearRoomMessages': 'Clear Room Messages',
        'totalPlayers': 'Total Players',
        'totalGames': 'Total Games',
        'averageScore': 'Average Score',
        'adminLoginFailed': 'Admin login failed',
        'errorOccurred': 'An error occurred',
        'updateFailed': 'Update failed',
        'confirmDeleteUser': 'Are you sure you want to delete this user?',
        'deleteFailed': 'Delete failed',
        'confirmClearChat': 'Are you sure you want to clear all chat messages?',
        'confirmClearRoomChat': 'Are you sure you want to clear chat messages for room {room}?',
        'autoSolverPermission': 'Auto Solver',
        'grantPermission': 'Grant Permission',
        'revokePermission': 'Revoke Permission',
        'gamesPlayed': 'Games Played',
        'autoSolverPermissionLabel': 'Auto Solver Permission:',
        'gameCountLabel': 'Game Count:',
        'createdDate': 'Created Date',
        'simulation': 'Simulation',
        'simulationTools': 'Simulation Tools',
        'fakeChatActivity': 'Fake Chat Activity',
        'fakeScoreIncrease': 'Fake Score Increase',
        'fakePlayerActivity': 'Professional Player Simulation',
        'content': 'Content',
        'contentManagement': 'Content Management'
    },
    tr: {
        'users': 'Kullanıcılar',
        'settings': 'Ayarlar',
        'statistics': 'İstatistikler',
        'logout': 'Çıkış',
        'userManagement': 'Kullanıcı Yönetimi',
        'sortBy': 'Sırala:',
        'id': 'ID',
        'username': 'Kullanıcı Adı',
        'country': 'Ülke',
        'createdAt': 'Oluşturulma',
        'levelActions': 'Seviye İşlemleri',
        'actions': 'İşlemler',
        'update': 'Güncelle',
        'reset': 'Sıfırla',
        'edit': 'Düzenle',
        'delete': 'Sil',
        'generalSettings': 'Genel Ayarlar',
        'siteTitle': 'Site Başlığı',
        'welcomeMessage': 'Hoş Geldin Mesajı',
        'save': 'Kaydet',
        'chatManagement': 'Sohbet Yönetimi',
        'clearAllMessages': 'Tüm Mesajları Temizle',
        'clearRoomMessages': 'Oda Mesajlarını Temizle',
        'totalPlayers': 'Toplam Oyuncu',
        'totalGames': 'Toplam Oyun',
        'averageScore': 'Ortalama Skor',
        'adminLoginFailed': 'Admin girişi başarısız',
        'errorOccurred': 'Bir hata oluştu',
        'updateFailed': 'Güncelleme başarısız',
        'confirmDeleteUser': 'Bu kullanıcıyı silmek istediğinizden emin misiniz?',
        'deleteFailed': 'Silme başarısız',
        'confirmClearChat': 'Tüm sohbet mesajlarını temizlemek istediğinizden emin misiniz?',
        'confirmClearRoomChat': '{room} odasındaki sohbet mesajlarını temizlemek istediğinizden emin misiniz?',
        'autoSolverPermission': 'Otomatik Çözücü',
        'grantPermission': 'Yetki Ver',
        'revokePermission': 'Yetkiyi Kaldır',
        'gamesPlayed': 'Oyun Sayısı',
        'autoSolverPermissionLabel': 'Otomatik Çözücü İzni:',
        'gameCountLabel': 'Oyun Sayısı:',
        'createdDate': 'Oluşturulma Tarihi',
        'simulation': 'Simülasyon',
        'simulationTools': 'Simülasyon Araçları',
        'fakeChatActivity': 'Sahte Sohbet Aktivitesi',
        'fakeScoreIncrease': 'Sahte Skor Artışı',
        'fakePlayerActivity': 'Profesyonel Oyuncu Simülasyonu',
        'content': 'İçerik',
        'contentManagement': 'İçerik Yönetimi'
    }
};

function getAdminTranslation(key, params = {}) {
    const currentLang = localStorage.getItem('adminLanguage') || 'en';
    let translation = adminTranslations[currentLang] && adminTranslations[currentLang][key] 
        ? adminTranslations[currentLang][key] 
        : key;
    
    // Replace parameters
    Object.keys(params).forEach(param => {
        translation = translation.replace(`{${param}}`, params[param]);
    });
    
    return translation;
}

function loadAdminTranslations(lang) {
    // Apply translations
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (adminTranslations[lang] && adminTranslations[lang][key]) {
            element.textContent = adminTranslations[lang][key];
        }
    });
}

function setupAdminPanel() {
    // Load admin language first
    const adminLang = localStorage.getItem('adminLanguage') || 'en';
    loadAdminTranslations(adminLang);
    
    const adminLoginSection = document.getElementById('adminLoginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const editUserModal = document.getElementById('editUserModal');
    const closeButton = document.querySelector('.close-button');
    const saveUserChangesBtn = document.getElementById('saveUserChangesBtn');
    const adminUsernameInput = document.getElementById('adminUsername');
    const adminPasswordInput = document.getElementById('adminPassword');
    const sortUsersDropdown = document.getElementById('sortUsers');

    const checkAdminLogin = () => {
        const token = localStorage.getItem('adminToken');
        const tokenExpiry = localStorage.getItem('adminTokenExpiry');
        
        // Check if token exists and is not expired
        if (token && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
            adminLoginSection.style.display = 'none';
            adminDashboard.style.display = 'flex';
            loadUsers(); // Load with default sort
            loadStats();
        } else {
            // Clear expired or invalid tokens
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminTokenExpiry');
            adminLoginSection.style.display = 'block';
            adminDashboard.style.display = 'none';
            adminUsernameInput.focus(); // Automatically focus the username field
        }
    };

    sortUsersDropdown.addEventListener('change', () => {
        loadUsers(sortUsersDropdown.value);
    });

    const handleLogin = async () => {
        const username = adminUsernameInput.value;
        const password = adminPasswordInput.value;
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminTokenExpiry', Date.now() + (8 * 60 * 60 * 1000)); // 8 hours
                checkAdminLogin();
            } else {
                alert(data.message || getAdminTranslation('adminLoginFailed'));
            }
        } catch (error) {
            alert(getAdminTranslation('errorOccurred'));
        }
    };

    adminLoginBtn.addEventListener('click', handleLogin);

    adminUsernameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            adminPasswordInput.focus();
        }
    });

    adminPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });

    adminLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminTokenExpiry');
        checkAdminLogin();
    });

    document.getElementById('showUsersBtn').addEventListener('click', () => showSection('usersSection'));
    document.getElementById('showSettingsBtn').addEventListener('click', () => {
        showSection('settingsSection');
        loadSettings();
        loadChatRooms();
    });
    document.getElementById('showStatsBtn').addEventListener('click', () => {
        showSection('statsSection');
        loadStats(); // Load stats and charts when stats section is shown
    });
    document.getElementById('showSimulationBtn').addEventListener('click', () => showSection('simulationSection'));

    document.getElementById('showContentBtn').addEventListener('click', () => {
        showSection('contentSection');
        loadAdminContent();
    });

    const toggleFakeChat = document.getElementById('toggleFakeChat');
    const toggleFakeScores = document.getElementById('toggleFakeScores');
    const fakeChatLangSelect = document.getElementById('fakeChatLang');

    // Set initial state from localStorage
    const isFakeChatActive = localStorage.getItem('fakeChatActive') === 'true';
    toggleFakeChat.checked = isFakeChatActive;

    const savedLang = localStorage.getItem('fakeChatLang') || 'en';
    fakeChatLangSelect.value = savedLang;

    const isFakeScoresActive = localStorage.getItem('fakeScoresActive') === 'true';
    toggleFakeScores.checked = isFakeScoresActive;

    // Add event listeners
    toggleFakeChat.addEventListener('change', (e) => {
        const isActive = e.target.checked;
        localStorage.setItem('fakeChatActive', isActive);
        const selectedLang = fakeChatLangSelect.value;
        const eventName = isActive ? 'start-fake-chat' : 'stop-fake-chat';
        window.dispatchEvent(new CustomEvent(eventName, { detail: { lang: selectedLang } }));
        showNotification(`Fake chat activity ${isActive ? 'started' : 'stopped'} in ${selectedLang}.`, 'info');
    });

    fakeChatLangSelect.addEventListener('change', async (e) => {
        const selectedLang = e.target.value;
        localStorage.setItem('fakeChatLang', selectedLang);
        // NEW: Save the fake chat language to the backend
        await saveFakeChatLangSetting(selectedLang); // Call the new function

        // If simulation is already active, restart it with the new language
        if (toggleFakeChat.checked) {
            window.dispatchEvent(new CustomEvent('stop-fake-chat'));
            window.dispatchEvent(new CustomEvent('start-fake-chat', { detail: { lang: selectedLang } }));
            showNotification(`Fake chat language changed to ${selectedLang}. Simulation restarted.`, 'info');
        }
    });

// NEW FUNCTION:
async function saveFakeChatLangSetting(lang) {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/admin/settings/fakeChatLang', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ value: lang })
        });
        if (!response.ok) {
            const data = await response.json();
            console.error('Failed to save fake chat language setting:', data.message);
            showNotification('Failed to save fake chat language setting.', 'error');
        } else {
            console.log('Fake chat language setting saved to backend:', lang);
        }
    } catch (error) {
        console.error('Error saving fake chat language setting:', error);
        showNotification('Error saving fake chat language setting.', 'error');
    }
}

    toggleFakeScores.addEventListener('change', (e) => {
        const isActive = e.target.checked;
        localStorage.setItem('fakeScoresActive', isActive);
        const eventName = isActive ? 'start-fake-scores' : 'stop-fake-scores';
        window.dispatchEvent(new CustomEvent(eventName));
        showNotification(`Fake score increase ${isActive ? 'started' : 'stopped'}.`, 'info');
    });

    const togglePlayerSim = document.getElementById('togglePlayerSim');

    // Set initial state from localStorage
    const isPlayerSimActive = localStorage.getItem('playerSimActive') === 'true';
    togglePlayerSim.checked = isPlayerSimActive;

    // Add event listener
    togglePlayerSim.addEventListener('change', (e) => {
        const isActive = e.target.checked;
        localStorage.setItem('playerSimActive', isActive);
        const eventName = isActive ? 'start-player-sim' : 'stop-player-sim';
        window.dispatchEvent(new CustomEvent(eventName));
        showNotification(`Professional player simulation ${isActive ? 'started' : 'stopped'}.`, 'info');
    });


    closeButton.addEventListener('click', () => {
        editUserModal.style.display = 'none';
    });

    saveUserChangesBtn.addEventListener('click', saveUserChanges);

    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    document.getElementById('clearChatBtn').addEventListener('click', clearChatHistory);

    document.getElementById('clearRoomBtn').addEventListener('click', clearRoomHistory);

    // Initialize profile modal
    initializeProfileModal();

    checkAdminLogin();
}

async function loadUsers(sortOption = 'createdAt_desc') {
    const token = localStorage.getItem('adminToken');
    const [sortBy, order] = sortOption.split('_');

    try {
        const response = await fetch(`/api/admin/users?sortBy=${sortBy}&order=${order}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();
        const usersGrid = document.getElementById('usersGrid');
        usersGrid.innerHTML = '';
        
        users.forEach(user => {
            const countryCode = user.country ? user.country.toLowerCase() : 'unknown';
            const flagPath = `assets/flags/${countryCode}.png`;
            const createdDate = user.createdat ? new Date(user.createdat).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'N/A';
            
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.innerHTML = `
                <div class="user-card-header">
                    <img src="${user.avatarurl || 'assets/logo.jpg'}" 
                         class="user-avatar-large clickable-avatar" 
                         alt="${user.username}"
                         data-user-index="${users.indexOf(user)}">
                    <div class="user-info-main">
                        <h3 class="user-name">${user.username}</h3>
                        <span class="user-id">#${user.id}</span>
                        <div class="user-country-info">
                            <img src="${flagPath}" 
                                 class="country-flag-large" 
                                 alt="${user.country}" 
                                 onerror="this.src='assets/flags/unknown.png'">
                            <span class="country-name-large">${user.country || 'Unknown'}</span>
                    </div>
                        <span class="user-date">${createdDate}</span>
                    </div>
                </div>
                
                <div class="user-stats">
                    <div class="stat-item-card">
                        <div class="stat-label">${getAdminTranslation('gamesPlayed')}</div>
                        <div class="stat-value">${user.gamecount || 0}</div>
                    </div>
                    <div class="stat-item-card">
                        <div class="stat-label">${getAdminTranslation('autoSolverPermission')}</div>
                        <div class="stat-value">${user.autosolverpermission ? '✅' : '❌'}</div>
                    </div>
                </div>
                
                <div class="auto-solver-toggle">
                    <label>${getAdminTranslation('autoSolverPermissionLabel')}</label>
                    <label class="toggle-switch">
                        <input type="checkbox" class="auto-solver-toggle-input" data-id="${user.id}" ${user.autosolverpermission ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="influencer-toggle">
                    <label>Influencer:</label>
                    <label class="toggle-switch">
                        <input type="checkbox" class="influencer-toggle-input" data-id="${user.id}" ${user.is_influencer ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="game-count-container">
                    <label>${getAdminTranslation('gameCountLabel')}</label>
                    <input type="number" 
                           class="game-count-input-modern" 
                           data-id="${user.id}" 
                           value="${user.gamecount || 0}" 
                           min="0">
                </div>
                
                <div class="user-actions">
                    <button class="btn-user-action btn-level update-game-count-btn" data-id="${user.id}">
                        <i class="fas fa-sync-alt"></i> ${getAdminTranslation('update')}
                    </button>
                    <button class="btn-user-action btn-warning reset-game-count-btn" data-id="${user.id}">
                        <i class="fas fa-undo"></i> ${getAdminTranslation('reset')}
                    </button>
                    <button class="btn-user-action btn-edit edit-btn" data-id="${user.id}">
                        <i class="fas fa-edit"></i> ${getAdminTranslation('edit')}
                    </button>
                    <button class="btn-user-action btn-delete delete-btn" data-id="${user.id}">
                        <i class="fas fa-trash"></i> ${getAdminTranslation('delete')}
                    </button>
                </div>
            `;
            usersGrid.appendChild(userCard);
        });

        // Add event listeners
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteUser(e.target.dataset.id));
        });
        document.querySelectorAll('.update-game-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => updateGameCount(e.target.dataset.id));
        });
        document.querySelectorAll('.reset-game-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => resetGameCount(e.target.dataset.id));
        });
        document.querySelectorAll('.auto-solver-toggle-input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => updateAutoSolverPermission(e.target.dataset.id, e.target.checked));
        });

        // Add event listeners for influencer toggles
        document.querySelectorAll('.influencer-toggle-input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => updateInfluencerStatus(e.target.dataset.id, e.target.checked));
        });
        
        // Add click event listeners to profile images
        document.querySelectorAll('.user-avatar-large').forEach((avatar, index) => {
            const handleAvatarClick = (event) => {
                console.log('Avatar click detected, preventing all propagation');
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                if (!document.querySelector('#adminDashboard')) {
                    console.log('Not in admin context, ignoring click');
                    return;
                }
                
                const userIndex = parseInt(avatar.getAttribute('data-user-index'));
                const user = users[userIndex];
                console.log('Admin modal opening for user:', user.username);
                
                setTimeout(() => {
                    openProfileModal(user);
                }, 10);
            };
            
            if (avatar._adminClickHandler) {
                avatar.removeEventListener('click', avatar._adminClickHandler, true);
            }
            
            avatar.addEventListener('click', handleAvatarClick, true);
            avatar.style.cursor = 'pointer';
            avatar._adminClickHandler = handleAvatarClick;
        });
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadChatRooms() {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/chat/rooms', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const rooms = await response.json();
        const select = document.getElementById('chatRoomSelect');
        select.innerHTML = '';
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room;
            option.textContent = room;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load chat rooms:', error);
    }
}

async function loadStats() {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await response.json();
        document.getElementById('totalPlayersStat').textContent = stats.totalPlayers;
        document.getElementById('totalGamesPlayedStat').textContent = stats.totalGamesPlayed;
        document.getElementById('averageScoreStat').textContent = stats.averageScore ? stats.averageScore.toFixed(2) : '0.00';
        
        // Load and render charts
        await loadCharts();
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadCharts() {
    // Wait a bit for the DOM to be ready
    setTimeout(async () => {
        try {
            // Check if Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded');
                return;
            }

            // Check if chart containers exist
            const chartContainers = [
                'playerGrowthChart',
                'gameActivityChart', 
                'scoreDistributionChart',
                'topCountriesChart'
            ];

            const missingContainers = chartContainers.filter(id => !document.getElementById(id));
            if (missingContainers.length > 0) {
                console.error('Missing chart containers:', missingContainers);
                return;
            }

            const token = localStorage.getItem('adminToken');
            if (!token) {
                console.error('No admin token found');
                renderSampleCharts();
                return;
            }

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            console.log('Loading chart data from API...');

            // Load all chart data with detailed logging
            const [playerGrowthRes, gameActivityRes, scoreDistributionRes, topCountriesRes] = await Promise.all([
                fetch('/api/admin/stats/player-growth', { headers }),
                fetch('/api/admin/stats/game-activity', { headers }),
                fetch('/api/admin/stats/score-distribution', { headers }),
                fetch('/api/admin/stats/top-countries', { headers })
            ]);

            console.log('API Responses:', {
                playerGrowth: playerGrowthRes.status,
                gameActivity: gameActivityRes.status,
                scoreDistribution: scoreDistributionRes.status,
                topCountries: topCountriesRes.status
            });

            // Check if responses are successful
            if (!playerGrowthRes.ok || !gameActivityRes.ok || !scoreDistributionRes.ok || !topCountriesRes.ok) {
                console.error('One or more API calls failed:', {
                    playerGrowth: playerGrowthRes.status,
                    gameActivity: gameActivityRes.status,
                    scoreDistribution: scoreDistributionRes.status,
                    topCountries: topCountriesRes.status
                });
                console.log('Server needs to be restarted to load new API endpoints. Using sample data for now.');
                renderSampleCharts();
                return;
            }

            const playerGrowthData = await playerGrowthRes.json();
            const gameActivityData = await gameActivityRes.json();
            const scoreDistributionData = await scoreDistributionRes.json();
            const topCountriesData = await topCountriesRes.json();

            console.log('Chart Data:', {
                playerGrowth: playerGrowthData,
                gameActivity: gameActivityData,
                scoreDistribution: scoreDistributionData,
                topCountries: topCountriesData
            });

            // Render charts with real data
            renderPlayerGrowthChart(playerGrowthData);
            renderGameActivityChart(gameActivityData);
            renderScoreDistributionChart(scoreDistributionData);
            renderTopCountriesChart(topCountriesData);

            console.log('Charts rendered successfully with real data');
        } catch (error) {
            console.error('Failed to render charts:', error);
            console.log('Rendering sample charts instead...');
            renderSampleCharts();
        }
    }, 100);
}

function getChartColors() {
    const theme = document.documentElement.getAttribute('data-theme');
    const isDark = theme === 'dark';
    console.log('Current theme:', theme, 'isDark:', isDark); // Debug log
    return {
        primary: isDark ? '#0A84FF' : '#007AFF',
        secondary: isDark ? '#5E5CE6' : '#5856D6',
        accent: isDark ? '#64D2FF' : '#00C7BE',
        success: isDark ? '#30D158' : '#34C759',
        warning: isDark ? '#FF9F0A' : '#FF9500',
        danger: isDark ? '#FF453A' : '#FF3B30',
        background: isDark ? 'rgba(28, 28, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        text: isDark ? '#EBEBF5' : '#3C3C43'
    };
}

function renderPlayerGrowthChart(data) {
    const ctx = document.getElementById('playerGrowthChart').getContext('2d');
    const colors = getChartColors();
    
    // If no data, show empty state
    if (!data || data.length === 0) {
        ctx.fillStyle = colors.text;
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No player growth data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                label: 'New Players',
                data: data.map(d => d.players),
                borderColor: colors.primary,
                backgroundColor: colors.primary + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: colors.primary,
                pointBorderColor: colors.background,
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: colors.text,
                        font: { size: 12, weight: '600' }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                }
            }
        }
    });
}

function renderGameActivityChart(data) {
    const ctx = document.getElementById('gameActivityChart').getContext('2d');
    const colors = getChartColors();
    
    // If no data, show empty state
    if (!data || data.length === 0) {
        ctx.fillStyle = colors.text;
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No game activity data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                label: 'Games Played',
                data: data.map(d => d.games),
                borderColor: colors.secondary,
                backgroundColor: colors.secondary + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: colors.secondary,
                pointBorderColor: colors.background,
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: colors.text,
                        font: { size: 12, weight: '600' }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                }
            }
        }
    });
}

function renderScoreDistributionChart(data) {
    const ctx = document.getElementById('scoreDistributionChart').getContext('2d');
    const colors = getChartColors();
    
    // If no data, show empty state
    if (!data || data.length === 0) {
        ctx.fillStyle = colors.text;
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No score distribution data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.range),
            datasets: [{
                label: 'Games',
                data: data.map(d => d.count),
                backgroundColor: colors.primary + '80',
                borderColor: colors.primary,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: colors.text,
                        font: { size: 12, weight: '600' }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                }
            }
        }
    });
}

function renderTopCountriesChart(data) {
    const ctx = document.getElementById('topCountriesChart').getContext('2d');
    const colors = getChartColors();
    
    // If no data, show empty state
    if (!data || data.length === 0) {
        ctx.fillStyle = colors.text;
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No country data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.country),
            datasets: [{
                label: 'Players',
                data: data.map(d => d.players),
                backgroundColor: [
                    colors.primary,
                    colors.secondary,
                    colors.accent,
                    colors.success,
                    colors.warning,
                    colors.danger,
                    '#FF6B6B',
                    '#4ECDC4',
                    '#45B7D1',
                    '#96CEB4'
                ],
                borderColor: colors.background,
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                },
                y: {
                    grid: { color: colors.text + '20' },
                    ticks: { color: colors.text }
                }
            }
        }
    });
}

function renderSampleCharts() {
    // Render charts with sample data if API is not available
    console.log('Rendering sample charts with demo data...');
    
    // Sample data for demonstration
    const samplePlayerGrowth = [
        { date: '2024-01-01', players: 5 },
        { date: '2024-01-02', players: 8 },
        { date: '2024-01-03', players: 12 },
        { date: '2024-01-04', players: 15 },
        { date: '2024-01-05', players: 18 }
    ];
    
    const sampleGameActivity = [
        { date: '2024-01-01', games: 25 },
        { date: '2024-01-02', games: 32 },
        { date: '2024-01-03', games: 28 },
        { date: '2024-01-04', games: 45 },
        { date: '2024-01-05', games: 38 }
    ];
    
    const sampleScoreDistribution = [
        { range: '0-99', count: 25 },
        { range: '100-499', count: 40 },
        { range: '500-999', count: 20 },
        { range: '1000-1999', count: 10 },
        { range: '2000-4999', count: 4 },
        { range: '5000+', count: 1 }
    ];
    
    const sampleTopCountries = [
        { country: 'Turkey', players: 45 },
        { country: 'USA', players: 32 },
        { country: 'Germany', players: 28 },
        { country: 'France', players: 22 },
        { country: 'UK', players: 18 }
    ];
    
    renderPlayerGrowthChart(samplePlayerGrowth);
    renderGameActivityChart(sampleGameActivity);
    renderScoreDistributionChart(sampleScoreDistribution);
    renderTopCountriesChart(sampleTopCountries);
}

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
}

async function openEditModal(userId) {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch(`/api/admin/users/${userId}`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await response.json();
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editCountry').value = user.country;
        document.getElementById('editAvatarUrl').value = user.avatarurl;
        document.getElementById('editUserModal').style.display = 'block';
    } catch (error) {
        console.error('Failed to fetch user data:', error);
    }
}

async function saveUserChanges() {
    const token = localStorage.getItem('adminToken');
    const userId = document.getElementById('editUserId').value;
    const userData = {
        username: document.getElementById('editUsername').value,
        country: document.getElementById('editCountry').value,
        avatarUrl: document.getElementById('editAvatarUrl').value
    };

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });
        if (response.ok) {
            document.getElementById('editUserModal').style.display = 'none';
            loadUsers();
        } else {
            const data = await response.json();
            alert(data.message || getAdminTranslation('updateFailed'));
        }
    } catch (error) {
        alert(getAdminTranslation('errorOccurred'));
    }
}

async function deleteUser(userId) {
    const token = localStorage.getItem('adminToken');
    if (confirm(getAdminTranslation('confirmDeleteUser'))) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                loadUsers();
            } else {
                const data = await response.json();
                alert(data.message || getAdminTranslation('deleteFailed'));
            }
        } catch (error) {
            alert(getAdminTranslation('errorOccurred'));
        }
    }
}

async function updateGameCount(userId) {
    const token = localStorage.getItem('adminToken');
    const inputElement = document.querySelector(`.game-count-input-modern[data-id="${userId}"]`);
    const targetGameCount = parseInt(inputElement.value, 10);

    if (isNaN(targetGameCount) || targetGameCount < 0) {
        showNotification('Invalid game count. Please enter a non-negative number.', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/admin/player/${userId}/gamecount`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetGameCount })
        });
        const data = await response.json();
        if (response.ok) {
            showNotification(data.message, 'success');
            loadUsers(); // Reload users to reflect changes
        } else {
            showNotification(data.message || 'Failed to update game count.', 'error');
        }
    } catch (error) {
        console.error('Failed to update game count:', error);
        showNotification('An error occurred while updating game count.', 'error');
    }
}

async function resetGameCount(userId) {
    const token = localStorage.getItem('adminToken');
    if (confirm("Are you sure you want to reset this user's game count? This will remove all dummy games.")) {
        try {
            const response = await fetch(`/api/admin/player/${userId}/gamecount/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(data.message, 'success');
                loadUsers(); // Reload users to reflect changes
            } else {
                showNotification(data.message || 'Failed to reset game count.', 'error');
            }
        } catch (error) {
            console.error('Failed to reset game count:', error);
            showNotification('An error occurred while resetting game count.', 'error');
        }
    }
}

async function updateAutoSolverPermission(userId, permission) {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch(`/api/admin/player/${userId}/auto-solver`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ autoSolverPermission: permission })
        });
        const data = await response.json();
        if (response.ok) {
            showNotification(data.message, 'success');
            // Update the visual indicator in the stats section
            const userCard = document.querySelector(`[data-id="${userId}"]`).closest('.user-card');
            const statValue = userCard.querySelector('.stat-item-card:last-child .stat-value');
            if (statValue) {
                statValue.textContent = permission ? '✅' : '❌';
            }
        } else {
            showNotification(data.message || 'Failed to update auto solver permission.', 'error');
            // Revert toggle state on error
            const toggle = document.querySelector(`.auto-solver-toggle-input[data-id="${userId}"]`);
            if (toggle) {
                toggle.checked = !permission;
            }
        }
    } catch (error) {
        console.error('Failed to update auto solver permission:', error);
        showNotification('An error occurred while updating auto solver permission.', 'error');
        // Revert toggle state on error
        const toggle = document.querySelector(`.auto-solver-toggle-input[data-id="${userId}"]`);
        if (toggle) {
            toggle.checked = !permission;
        }
    }
}

async function updateInfluencerStatus(userId, isInfluencer) {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch(`/api/admin/player/${userId}/toggle-influencer`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isInfluencer: isInfluencer })
        });
        const data = await response.json();
        if (response.ok) {
            showNotification(data.message, 'success');
        } else {
            showNotification(data.message || 'Failed to update influencer status.', 'error');
            // Revert toggle state on error
            const toggle = document.querySelector(`.influencer-toggle-input[data-id="${userId}"]`);
            if (toggle) {
                toggle.checked = !isInfluencer;
            }
        }
    } catch (error) {
        console.error('Failed to update influencer status:', error);
        showNotification('An error occurred while updating influencer status.', 'error');
        // Revert toggle state on error
        const toggle = document.querySelector(`.influencer-toggle-input[data-id="${userId}"]`);
        if (toggle) {
            toggle.checked = !isInfluencer;
        }
    }
}

async function loadSettings() {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const settings = await response.json();
        document.getElementById('siteTitleInput').value = settings.siteTitle || '';
        document.getElementById('welcomeMessageInput').value = settings.welcomeMessage || '';
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings() {
    const token = localStorage.getItem('adminToken');
    const settings = {
        siteTitle: document.getElementById('siteTitleInput').value,
        welcomeMessage: document.getElementById('welcomeMessageInput').value
    };

    try {
        for (const key in settings) {
            await fetch(`/api/admin/settings/${key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ value: settings[key] })
            });
        }
        showNotification('Settings saved successfully!', 'success');
    } catch (error) {
        showNotification('Failed to save settings.', 'error');
    }
}

function showNotification(message, type) {
    const notificationBar = document.getElementById('notificationBar');
    notificationBar.textContent = message;
    notificationBar.className = `notification-bar show ${type}`;
    setTimeout(() => {
        notificationBar.className = 'notification-bar';
    }, 3000);
}

async function clearChatHistory() {
    const token = localStorage.getItem('adminToken');
    if (confirm(getAdminTranslation('confirmClearChat'))) {
        try {
            const response = await fetch('/api/admin/chat/messages', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(data.message, 'success');
            } else {
                showNotification(data.message || 'Failed to clear chat history.', 'error');
            }
        } catch (error) {
            console.error('Failed to clear chat history:', error);
            showNotification('An error occurred while clearing chat history.', 'error');
        }
    }
}

async function clearRoomHistory() {

    const token = localStorage.getItem('adminToken');

    const room = document.getElementById('chatRoomSelect').value;

    if (!room) {

        showNotification('Please select a room to clear.', 'error');

        return;

    }

    if (confirm(getAdminTranslation('confirmClearRoomChat', { room }))) {

        try {

            const response = await fetch(`/api/admin/chat/messages/${encodeURIComponent(room)}`, {

                method: 'DELETE',

                headers: { 'Authorization': `Bearer ${token}` }

            });

            const data = await response.json();

            if (response.ok) {

                showNotification(data.message, 'success');

            } else {

                showNotification(data.message || `Failed to clear chat history for room ${room}.`, 'error');

            }

        } catch (error) {

            console.error(`Failed to clear chat history for room ${room}:`, error);

            showNotification(`An error occurred while clearing chat history for room ${room}.`, 'error');

        }

    }

}



async function loadAdminContent() {

    const token = localStorage.getItem('adminToken');

    try {

        const response = await fetch('/api/admin/content', { 

            headers: { 'Authorization': `Bearer ${token}` }

        });

        const contentItems = await response.json();

        const contentGrid = document.getElementById('contentGrid');

        contentGrid.innerHTML = ''; // Clear previous content



        if (contentItems.length === 0) {

            contentGrid.innerHTML = '<p>No content submitted yet.</p>';

            return;

        }



        contentItems.forEach(item => {

            const itemCard = document.createElement('div');

            itemCard.className = 'content-card';

            itemCard.innerHTML = `

                <div class="content-card-header">

                    <span class="content-influencer">${item.influencer_username}</span>

                    <span class="content-date">${new Date(item.submitted_at).toLocaleDateString()}</span>

                </div>

                <div class="content-card-body">

                    <a href="${item.content_url}" target="_blank" class="content-link">${item.content_url}</a>

                </div>

                <div class="content-card-footer">

                    <button class="btn ${item.is_verified ? 'btn-success' : 'btn-primary'} verify-btn" 

                            data-id="${item.id}" 

                            ${item.is_verified ? 'disabled' : ''}>

                        ${item.is_verified ? '<i class="fas fa-check"></i> Verified' : 'Verify'}

                    </button>

                </div>

            `;

            contentGrid.appendChild(itemCard);

        });



        // Add event listeners to new buttons

        document.querySelectorAll('.verify-btn').forEach(btn => {

            if (!btn.disabled) {

                btn.addEventListener('click', (e) => verifyContent(e.target.dataset.id, e.target));

            }

        });



    } catch (error) {

        console.error('Failed to load content for admin:', error);

        document.getElementById('contentGrid').innerHTML = '<p class="error">Failed to load content.</p>';

    }

}



async function verifyContent(contentId, buttonElement) {

    const token = localStorage.getItem('adminToken');

    try {

        const response = await fetch(`/api/admin/content/${contentId}/verify`, {

            method: 'PUT',

            headers: { 'Authorization': `Bearer ${token}` }

        });

        const data = await response.json();

        if (response.ok) {

            showNotification(data.message, 'success');

            buttonElement.innerHTML = '<i class="fas fa-check"></i> Verified';

            buttonElement.disabled = true;

            buttonElement.classList.remove('btn-primary');

            buttonElement.classList.add('btn-success');

        } else {

            showNotification(data.message || 'Failed to verify content.', 'error');

        }

    } catch (error) {

        console.error('Failed to verify content:', error);

        showNotification('An error occurred while verifying content.', 'error');

    }

}



// Profile Image Modal Functions

function openProfileModal(user) {

    console.log('openProfileModal called for user:', user.username);

    

    const modal = document.getElementById('profileImageModal');

    if (!modal) {

        console.error('Profile modal not found!');

        return;

    }

    

    // Prevent multiple modals from opening

    if (modal.style.display === 'block') {

        console.log('Modal already open, closing first');

        closeProfileModal();

        return;

    }

    

    const modalUsername = document.getElementById('modalUsername');

    const modalUsernameText = document.getElementById('modalUsernameText');

    const modalUserId = document.getElementById('modalUserId');

    const modalUserCountry = document.getElementById('modalUserCountry');

    const modalUserCreated = document.getElementById('modalUserCreated');

    const modalProfileImage = document.getElementById('modalProfileImage');

    

    // Set modal content safely

    if (modalUsername) modalUsername.textContent = user.username;

    if (modalUsernameText) modalUsernameText.textContent = user.username;

    if (modalUserId) modalUserId.textContent = user.id;

    if (modalUserCountry) modalUserCountry.textContent = user.country || 'Unknown';

    if (modalUserCreated) modalUserCreated.textContent = user.createdat ? user.createdat.substring(0, 10) : 'N/A';

    if (modalProfileImage) {

        modalProfileImage.src = user.avatarurl || 'assets/logo.jpg';

        modalProfileImage.alt = `${user.username}'s profile image`;

    }

    

    // Show modal with animation and protection

    modal.style.display = 'block';

    modal.style.opacity = '0';

    modal.style.transform = 'scale(0.8)';

    

    // Animate in

    requestAnimationFrame(() => {

        modal.style.transition = 'all 0.3s ease';

        modal.style.opacity = '1';

        modal.style.transform = 'scale(1)';

    });

    

    document.body.style.overflow = 'hidden';

    

    // Set a flag to prevent rapid opening/closing

    modal._isOpening = true;

    setTimeout(() => {

        modal._isOpening = false;

    }, 300);

    

    console.log('Modal opened successfully for:', user.username);

}



function closeProfileModal() {

    console.log('closeProfileModal called');

    const modal = document.getElementById('profileImageModal');

    

    if (!modal) {

        console.error('Modal not found for closing');

        return;

    }

    

    // Check if modal is currently opening (prevent rapid close during opening)

    if (modal._isOpening) {

        console.log('Modal is opening, delaying close');

        setTimeout(() => closeProfileModal(), 100);

        return;

    }

    

    // Animate out

    modal.style.transition = 'all 0.2s ease';

    modal.style.opacity = '0';

    modal.style.transform = 'scale(0.8)';

    

    // Hide after animation

    setTimeout(() => {

        modal.style.display = 'none';

        modal.style.transition = '';

        modal.style.opacity = '';

        modal.style.transform = '';

        document.body.style.overflow = 'auto';

        console.log('Modal closed successfully');

    }, 200);

}



// Initialize modal event listeners
function initializeProfileModal() {
    const modal = document.getElementById('profileImageModal');
    const closeBtn = document.querySelector('.close');
    
    if (!modal || !closeBtn) {
        console.error('Modal or close button not found during initialization');
        return;
    }
    
    console.log('Initializing profile modal event listeners');
    
    // Create named functions first
    const handleCloseClick = (event) => {
        console.log('Close button clicked');
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        closeProfileModal();
    };
    
    const handleModalClick = (event) => {
        if (event.target === modal) {
            console.log('Modal background clicked');
            event.preventDefault();
            event.stopPropagation();
            closeProfileModal();
        }
    };
    
    const handleEscapeKey = (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            console.log('Escape key pressed');
            event.preventDefault();
            event.stopPropagation();
            closeProfileModal();
        }
    };
    
    // Remove any existing listeners to prevent duplicates
    if (modal._closeHandler) closeBtn.removeEventListener('click', modal._closeHandler, true);
    if (modal._modalHandler) modal.removeEventListener('click', modal._modalHandler, true);
    if (modal._escapeHandler) document.removeEventListener('keydown', modal._escapeHandler, true);
    
    // Add listeners with capture: true for priority
    closeBtn.addEventListener('click', handleCloseClick, true);
    modal.addEventListener('click', handleModalClick, true);
    document.addEventListener('keydown', handleEscapeKey, true);
    
    // Store references for cleanup
    modal._closeHandler = handleCloseClick;
    modal._modalHandler = handleModalClick;
    modal._escapeHandler = handleEscapeKey;
}