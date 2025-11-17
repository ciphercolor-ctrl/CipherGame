// Default Game State
const defaultGameState = {
    currentMode: null,
    gameGrid: [],
    originalColors: [],
    gameStarted: false,
    memoryPhase: true,
    memoryTimer: null,
    matchingTimer: null,
    memoryElapsedTime: 0,
    matchingElapsedTime: 0,
    gameCompleted: false,
    correctMatches: 0,
    totalCellsToMatch: 0,
    cellsFilledCount: 0,
    isPainting: false, // Flag for drag-to-paint
    // User authentication state
    isLoggedIn: false,
    username: '',
    playerCountry: '',
    avatarUrl: 'assets/logo.jpg',
    playerId: null,
    token: null,
    activeColor: null,
    lastGameScore: 0,
    lastGameMode: '',
    lastGameAccuracy: '',
    lastGameTime: '',
    currentRoom: 'Global', // Default chat room
    lastChatMessageTime: 0, // For client-side rate limiting
    chatHistoryOffset: 0, // Offset for fetching chat history
    chatHistoryLimit: 50, // Number of messages to fetch per request
    screenHistory: [], // To keep track of screen navigation
    currentScreen: null, // To keep track of the currently active screen
    isSoundMuted: false, // To track sound state
    zoomFactor: 1.0, // New: For percentage-based zoom
    baseCellSize: 16, // New: Base size of a cell, adjusted by grid size
    zoomInInterval: null, // For holding zoom in
    zoomOutInterval: null, // For holding zoom out
    replyingTo: null, // To track the message being replied to
    chatSoundEnabled: true, // To track chat sound state
    unreadMessages: {} // To track unread messages per room
};

// Game State
let gameState = { ...defaultGameState };

// Cropper.js instance
let cropper = null;