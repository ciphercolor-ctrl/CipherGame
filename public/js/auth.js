async function registerUser() {
    const username = document.getElementById('usernameInputRegister').value;
    const password = document.getElementById('passwordInputRegister').value;
    const country = document.getElementById('countrySearchInput').dataset.selectedCode;
    const referralCode = document.getElementById('referralCodeInput').value.trim();

    if (!username || !password || !country) {
        showNotification(getTranslation('fillAllFields'), 'error');
        return;
    }

    try {
        const payload = {
            username,
            password,
            country
        };

        if (referralCode) {
            payload.referralCode = referralCode;
        }

        const data = await apiRequest('/api/auth/register', 'POST', payload);
        
        const profileData = await apiRequest(`/api/profile/players/${data.playerId}`);

        localStorage.setItem('token', data.token);
        localStorage.setItem('playerId', data.playerId);
        localStorage.setItem('username', profileData.username);
        localStorage.setItem('playerCountry', profileData.country);
        localStorage.setItem('avatarUrl', profileData.avatarUrl);
        localStorage.setItem('level', profileData.level);

        Object.assign(gameState, { ...profileData, playerId: data.playerId, isLoggedIn: true, isGuest: false, token: data.token, playerCountry: profileData.country });

        updateProfileDisplay(gameState.level);
        closePlayerInfoModal();
        document.getElementById('gameModal').style.display = 'block';
        showScreen('mainMenu');
        showNotification(getTranslation('registrationSuccess'), 'success');

        document.querySelector('.chat-btn')?.classList.remove('disabled-for-guest');
        document.getElementById('myProfileBtn')?.classList.remove('disabled-for-guest');
        document.getElementById('guestLogoutBtn').style.display = 'none';

        // Show explanation modal for new users
        if (gameState.gamecount === 0) {
            showExplanationModal();
            localStorage.setItem('hasSeenExplanation', 'true');
        }

    } catch (error) {
        logger.error('Registration failed:', error);
        if (error.status === 429) {
            showNotification(getTranslation('errorAuthTooManyAttempts'), 'error', true); // Pass true for isRateLimitError
        } else {
            showNotification(`${getTranslation('registrationFailed')}: ${error.message}`, 'error');
        }
    }
}



async function loginUser() {
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;

    if (!username || !password) {
        showNotification(getTranslation('enterUsernamePassword'), 'error');
        return;
    }

    try {
        const data = await apiRequest('/api/auth/login', 'POST', { username, password });

        const profileData = await apiRequest(`/api/profile/players/${data.playerId}`);

        localStorage.setItem('token', data.token);
        localStorage.setItem('playerId', data.playerId);
        localStorage.setItem('username', profileData.username);
        localStorage.setItem('playerCountry', profileData.country);
        localStorage.setItem('avatarUrl', profileData.avatarUrl);
        localStorage.setItem('level', profileData.level);

        Object.assign(gameState, { ...profileData, playerId: data.playerId, isLoggedIn: true, isGuest: false, token: data.token, playerCountry: profileData.country });

        updateProfileDisplay(gameState.level);
        closePlayerInfoModal();
        document.getElementById('gameModal').style.display = 'block';
        showScreen('mainMenu');
        showNotification(getTranslation('loginSuccess'), 'success');

        document.querySelector('.chat-btn')?.classList.remove('disabled-for-guest');
        document.getElementById('myProfileBtn')?.classList.remove('disabled-for-guest');
        document.getElementById('guestLogoutBtn').style.display = 'none';

        // Only show explanation modal for new users (first time login)
        const hasSeenExplanation = localStorage.getItem('hasSeenExplanation');
        if (gameState.gamecount === 0 && !hasSeenExplanation) {
            showExplanationModal();
            localStorage.setItem('hasSeenExplanation', 'true');
        }

        // Fire userLoggedIn event for score socket
        document.dispatchEvent(new CustomEvent('userLoggedIn', {
            detail: { userId: gameState.playerId, username: gameState.username }
        }));

    } catch (error) {
        logger.error('Login failed:', error);
        showNotification(`${getTranslation('loginFailed')}: ${error.message}`, 'error');
    }
}

function logoutUser() {
    localStorage.clear();

    const preservedState = {
        isSoundMuted: gameState.isSoundMuted,
        zoomLevel: gameState.zoomLevel
    };

    gameState = { ...defaultGameState };

    Object.assign(gameState, preservedState);

    // Fire userLoggedOut event for score socket
    document.dispatchEvent(new CustomEvent('userLoggedOut'));

    // Force the connection indicator to update
    if (typeof forceDisconnectIndicator === 'function') {
        forceDisconnectIndicator();
    }

    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('onlineUserList').innerHTML = '';
    document.getElementById('activeUserListSidebar').innerHTML = '';
    document.getElementById('onlineUserCount').textContent = '0';

    showNotification(getTranslation('loggedOut'), 'info');
    closeGame();
    showScreen('mainMenu');

    document.querySelector('.chat-btn')?.classList.add('disabled-for-guest');
    document.getElementById('myProfileBtn')?.classList.add('disabled-for-guest');
    document.getElementById('guestLogoutBtn').style.display = 'none';

    // Move updateProfileDisplay to the end and wrap in a timeout to ensure the UI is updated
    setTimeout(() => {
        updateProfileDisplay();
    }, 0);
}

async function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const playerId = localStorage.getItem('playerId');

    if (token && playerId) {
        try {
            const profileData = await apiRequest(`/api/profile/players/${playerId}`);

            localStorage.setItem('username', profileData.username);
            localStorage.setItem('playerCountry', profileData.country);
            localStorage.setItem('avatarUrl', profileData.avatarUrl);
            localStorage.setItem('level', profileData.level);

            Object.assign(gameState, {
                ...profileData,
                token,
                playerId,
                isLoggedIn: true,
                isGuest: false,
                playerCountry: profileData.country
            });

            if (window.IS_DEVELOPMENT) {
                logger.debug('User is logged in. Game state restored and updated from server:', gameState);
            }
            updateProfileDisplay(gameState.level);

            document.querySelector('.chat-btn')?.classList.remove('disabled-for-guest');
            document.getElementById('myProfileBtn')?.classList.remove('disabled-for-guest');
            document.getElementById('guestLogoutBtn').style.display = 'none';

            if (typeof positionPlayGameButton === 'function') {
                positionPlayGameButton();
            }

            // Only show explanation modal for new users (first time login)
            // Check if this is a new user by looking at localStorage
            const hasSeenExplanation = localStorage.getItem('hasSeenExplanation');
            if (gameState.gamecount === 0 && !hasSeenExplanation) {
                showExplanationModal();
                localStorage.setItem('hasSeenExplanation', 'true');
            }

            // Fire userLoggedIn event for score socket
            document.dispatchEvent(new CustomEvent('userLoggedIn', {
                detail: { userId: gameState.playerId, username: gameState.username }
            }));
        } catch (error) {
            logger.error('Session restore failed:', error);
            logoutUser();
            showNotification(getTranslation('sessionExpired'), 'error');
        }
    } else {
        if (window.IS_DEVELOPMENT) {
            logger.debug('No active login session found.');
        }
        updateProfileDisplay();
        if (typeof positionPlayGameButton === 'function') {
            positionPlayGameButton();
        }
    }
}

function continueAsGuest() {
    gameState.isGuest = true;
    gameState.isLoggedIn = false;

    updateProfileDisplay();
    closePlayerInfoModal();
    document.getElementById('gameModal').style.display = 'block';
    showScreen('mainMenu');
    showNotification(getTranslation('playingAsGuest'), 'info');

    document.querySelector('.chat-btn')?.classList.add('disabled-for-guest');
    document.getElementById('myProfileBtn')?.classList.add('disabled-for-guest');
    document.getElementById('guestLogoutBtn').style.display = 'inline-flex';

    // Only show explanation modal for new guest users
    const hasSeenExplanation = localStorage.getItem('hasSeenExplanation');
    if (gameState.gamecount === 0 && !hasSeenExplanation) {
        showExplanationModal();
        localStorage.setItem('hasSeenExplanation', 'true');
    }
}

function logoutGuest() {
    gameState.isGuest = false;
    gameState.isLoggedIn = false;

    const guestLogoutBtn = document.getElementById('guestLogoutBtn');
    if (guestLogoutBtn) {
        guestLogoutBtn.style.display = 'none';
    }

    document.querySelector('.chat-btn')?.classList.remove('disabled-for-guest');
    document.getElementById('myProfileBtn')?.classList.remove('disabled-for-guest');

    closeGame();
    document.getElementById('playerInfoModal').style.display = 'block';
    showAuthTab('register');
}

document.addEventListener('DOMContentLoaded', () => {
    const guestBtn = document.getElementById('guestBtn');
    if (guestBtn) {
        guestBtn.addEventListener('click', continueAsGuest);
    }

    const guestLogoutBtn = document.getElementById('guestLogoutBtn');
    if (guestLogoutBtn) {
        guestLogoutBtn.addEventListener('click', logoutGuest);
    }

    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');

    const usernameInputRegister = document.getElementById('usernameInputRegister');
    const passwordInputRegister = document.getElementById('passwordInputRegister');
    const playerCountrySelect = document.getElementById('playerCountrySelect');
    const registerBtn = document.getElementById('registerBtn');

    if (usernameInput) {
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInput.focus();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginBtn.click();
            }
        });
    }

    if (usernameInputRegister) {
        usernameInputRegister.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInputRegister.focus();
            }
        });
    }

    if (passwordInputRegister) {
        passwordInputRegister.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (playerCountrySelect) {
                    playerCountrySelect.focus();
                }
            }
        });
    }

    if (playerCountrySelect) {
        playerCountrySelect.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (registerBtn) {
                    registerBtn.click();
                }
            }
        });
    }

    const countrySearchInput = document.getElementById('countrySearchInput');
    const countryDropdownList = document.getElementById('countryDropdownList');

    if (countrySearchInput) {
        countrySearchInput.addEventListener('click', () => {
            countrySearchInput.readOnly = false;
            countrySearchInput.value = '';
            countrySearchInput.classList.add('active-search');
            countrySearchInput.style.backgroundImage = 'none';
            countrySearchInput.style.paddingLeft = '0.75rem';
            populateCountrySelect();
            countryDropdownList.classList.add('active');
            countrySearchInput.focus();
        });

        countrySearchInput.addEventListener('input', (event) => {
            populateCountrySelect(event.target.value);
            countryDropdownList.classList.add('active');
        });

        countrySearchInput.addEventListener('focus', () => {
            if (countrySearchInput.readOnly) {
                countrySearchInput.value = '';
                countrySearchInput.readOnly = false;
                countrySearchInput.classList.add('active-search');
                populateCountrySelect();
                countryDropdownList.classList.add('active');
            }
        });

        countrySearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (!countryDropdownList.contains(document.activeElement)) {
                    countryDropdownList.classList.remove('active');
                    countrySearchInput.readOnly = true;
                    countrySearchInput.classList.remove('active-search');

                    if (countrySearchInput.dataset.selectedCode) {
                        updateCountryInputDisplay(countrySearchInput.dataset.selectedCode);
                    } else {
                        updateCountryInputDisplay('');
                    }
                }
            }, 100);
        });
    }

    document.addEventListener('click', (event) => {
        if (countrySearchInput && countryDropdownList && !countrySearchInput.contains(event.target) && !countryDropdownList.contains(event.target)) {
            countryDropdownList.classList.remove('active');
            countrySearchInput.readOnly = true;
            countrySearchInput.classList.remove('active-search');
            if (countrySearchInput.dataset.selectedCode) {
                updateCountryInputDisplay(countrySearchInput.dataset.selectedCode);
            } else {
                updateCountryInputDisplay('');
            }
        }
    });

    populateCountrySelect();
    updateCountryInputDisplay('');

    if (countrySearchInput) {
        countrySearchInput.placeholder = getTranslation('loadingCountries', 'Loading countries...');
    }

    detectUserCountry().then(detectedCountryCode => {
        console.log('detectUserCountry() returned:', detectedCountryCode);
        if (detectedCountryCode) {
            countrySearchInput.dataset.selectedCode = detectedCountryCode;
            console.log('countrySearchInput.dataset.selectedCode set to:', countrySearchInput.dataset.selectedCode);
            updateCountryInputDisplay(detectedCountryCode);
            console.log('updateCountryInputDisplay() called with:', detectedCountryCode);
        } else {
            console.log('No country detected, not pre-filling.');
        }
    }).catch(error => {
        console.error("Country detection failed:", error);
    }).finally(() => {
        if (countrySearchInput) {
            countrySearchInput.disabled = false;
            const placeholderText = getTranslation('selectYourCountry', 'Select Your Country');
            countrySearchInput.placeholder = placeholderText;
            console.log('Country input enabled.');
        }
    });

    const showRegisterTabBtn = document.getElementById('showRegisterTab');
    if (showRegisterTabBtn) {
        showRegisterTabBtn.addEventListener('click', () => {
            populateCountrySelect();
            if (countrySearchInput) {
                countrySearchInput.value = '';
                countrySearchInput.readOnly = true;
                countrySearchInput.classList.remove('active-search');
                countrySearchInput.dataset.selectedCode = '';
                updateCountryInputDisplay('');
            }
            countryDropdownList.classList.remove('active');
        });
    }


});

async function detectUserCountry() {
    console.log('Attempting to detect user country...');
    try {
        const response = await fetch('https://ipapi.co/json/?fields=countryCode');
        const data = await response.json();
        if (data && data.countryCode) {
            console.log('Detected country from ipapi.co:', data.countryCode);
            return data.countryCode;
        }
    } catch (error) {
        console.warn('Failed to detect country via IP API, falling back to navigator.language:', error);
    }

    const userLanguage = navigator.language || navigator.userLanguage;
    if (userLanguage) {
        const parts = userLanguage.split('-');
        if (parts.length > 1) {
            const detectedCode = parts[1].toUpperCase();
            console.log('Detected country from navigator.language:', detectedCode);
            return detectedCode;
        }
    }
    console.log('Defaulting to US as country detection failed.');
    return 'US';
}

window.detectUserCountry = detectUserCountry;

function populateCountrySelect(filter = '') {
    const countrySearchInput = document.getElementById('countrySearchInput');
    const dropdownList = document.getElementById('countryDropdownList');
    dropdownList.innerHTML = '';

    const countryNames = Object.keys(countries).map(code => ({
        code: code,
        name: getTranslation('country_' + code.toLowerCase()),
        flag: countries[code].flag
    })).sort((a, b) => a.name.localeCompare(b.name));

    countryNames.forEach(country => {
        if (country.name.toLowerCase().includes(filter.toLowerCase())) {
            const countryItem = document.createElement('div');
            countryItem.className = 'country-item';
            countryItem.dataset.countryCode = country.code;
            countryItem.innerHTML = `<img src="${country.flag}" alt="${country.name} Flag" class="flag-icon"><span>${country.name}</span>`;
            
            countryItem.addEventListener('click', () => {
                countrySearchInput.dataset.selectedCode = country.code;
                updateCountryInputDisplay(country.code);
                dropdownList.classList.remove('active');
                countrySearchInput.classList.remove('active-search');
                countrySearchInput.readOnly = true;
            });
            dropdownList.appendChild(countryItem);
        }
    });
}

function updateCountryInputDisplay(countryCode) {
    const countrySearchInput = document.getElementById('countrySearchInput');
    if (countryCode && countries[countryCode]) {
        const country = countries[countryCode];
        countrySearchInput.value = getTranslation('country_' + countryCode.toLowerCase());
        countrySearchInput.style.backgroundImage = `url(${country.flag})`;
        countrySearchInput.style.backgroundRepeat = 'no-repeat';
        countrySearchInput.style.backgroundPosition = '0.75rem center';
        countrySearchInput.style.backgroundSize = '24px 16px';
        countrySearchInput.style.paddingLeft = '2.5rem';
    } else {
        countrySearchInput.value = '';
        countrySearchInput.placeholder = getTranslation('selectCountry');
        countrySearchInput.style.backgroundImage = 'none';
        countrySearchInput.style.paddingLeft = '0.75rem';
    }
}

// This function is called when the special rate-limit notification is clicked
function handleBypassAttempt() {
    const bypassPassword = prompt(getTranslation('errorAuthBypassPasswordRequired', 'Bypass password is required.'));

    if (bypassPassword) {
        apiRequest('/api/auth/bypass-register-limit', 'POST', { bypassPassword })
            .then(() => {
                showNotification(getTranslation('successAuthBypassLimit'), 'success');
                // Attempt to register again, as this is the context where the bypass is needed
                registerUser();
            })
            .catch(error => {
                logger.error('Bypass failed:', error);
                showNotification(`${getTranslation('errorAuthInvalidBypassPassword')}: ${error.message}`, 'error');
            });
    }
}

document.addEventListener('requestBypass', handleBypassAttempt);