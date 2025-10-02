const updateStatus = (status, text) => {
    const statusIndicator = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionStatusText');

    if (!statusIndicator || !statusText) {
        console.warn('Connection Status Indicator: HTML elements not found.');
        return;
    }

    statusIndicator.className = `connection-status ${status}`;
    statusText.textContent = text;
    updateIndicatorVisibility(); // Update visibility on every status change
};

function updateIndicatorVisibility() {
    const indicator = document.getElementById('connectionStatus');
    if (!indicator) return;

    // Get all relevant modals
    const gameModal = document.getElementById('gameModal');
    const chatModal = document.getElementById('chatModal');
    const casualGamesModal = document.getElementById('casualGamesModal');
    const playerInfoModal = document.getElementById('playerInfoModal');
    const mainMenu = document.getElementById('mainMenu');

    // If any required element is missing, hide the indicator to be safe.
    if (!gameModal || !chatModal || !casualGamesModal || !playerInfoModal || !mainMenu) {
        indicator.style.cssText = 'display: none !important';
        return;
    }

    // Check visibility of each modal
    const isGameModalOpen = gameModal.style.display === 'block';
    const isChatModalOpen = chatModal.style.display === 'block';
    const isCasualGamesModalOpen = casualGamesModal.style.display === 'block';
    const isPlayerInfoModalOpen = playerInfoModal.style.display === 'block';

    // Check if the game's main menu is the active screen
    const isMainMenuVisible = mainMenu.classList.contains('active');

    // First, check for the modals that should ALWAYS hide the indicator.
    if (isChatModalOpen || isCasualGamesModalOpen) {
        indicator.style.cssText = 'display: none !important';
        return; // Exit early
    }

    // Now, check for the conditions that should show the indicator.
    
    // Condition for being on the homepage: NO modals are open.
    const isHomepage = !isGameModalOpen && !isPlayerInfoModalOpen; // Simplified this check

    // Condition for being on the game's main menu.
    const isGameMainMenu = isGameModalOpen && isMainMenuVisible;

    if (isHomepage || isGameMainMenu) {
        indicator.style.cssText = 'display: flex !important';
    } else {
        indicator.style.cssText = 'display: none !important';
    }
}

const setupConnectionIndicator = () => {
    const socket = window.socket;

    if (!socket) {
        console.warn('Connection Status Indicator: Could not find window.socket after socketReady event.');
        return;
    }

    // Set initial status based on the socket's current state when the script runs.
    if (socket.connected) {
        updateStatus('connected', 'Connected');
    } else {
        updateStatus('disconnected', 'Disconnected');
    }

    // Add event listeners for socket connection events.
    socket.on('connect', () => updateStatus('connected', 'Connected'));
    socket.on('disconnect', () => updateStatus('disconnected', 'Disconnected'));
    socket.on('reconnecting', () => updateStatus('connecting', 'Connecting...'));
    socket.on('reconnect', () => updateStatus('connected', 'Connected'));
    socket.on('reconnect_failed', () => updateStatus('disconnected', 'Failed to reconnect'));

    // Set initial visibility right after setup
    updateIndicatorVisibility();
};

function forceDisconnectIndicator() {
    updateStatus('disconnected', 'Disconnected');
}

// Listen for the custom event dispatched by other scripts
document.addEventListener('socketReady', setupConnectionIndicator);
document.addEventListener('uiStateChanged', updateIndicatorVisibility);