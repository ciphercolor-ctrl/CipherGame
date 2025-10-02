let gameLoop; // legacy ref (unused after rAF)

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.cetris-game-header');
    
    // Enhanced mobile features
    let enhancedTouchControls = null;
    let gameStartTime = 0;
    let particles = [];
    let visualEffects = {
        particles: [],
        screenShake: { intensity: 0, duration: 0 },
        lineClearGlow: { active: false, intensity: 0 }
    };
    const preview = document.getElementById('cetris-next-piece-preview');
    const scoreItem = document.getElementById('cetris-score').parentElement;
    const levelItem = document.getElementById('cetris-level').parentElement;

    if (header && preview && scoreItem && levelItem) {
        header.innerHTML = '';
        header.appendChild(scoreItem);
        header.appendChild(preview);
        header.appendChild(levelItem);
    }

    const cetrisPlayBtn = document.querySelector('[data-game-target="cetris-game-container"]');
    const cetrisGameContainer = document.getElementById('cetris-game-container');
    const casualGameSelection = document.getElementById('casual-game-selection');
    const casualGamesBackBtn = document.getElementById('casualGamesBackBtn');

    const canvas = document.getElementById('cetrisCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('cetris-score');
    const levelDisplay = document.getElementById('cetris-level');
    const gameOverScreen = document.querySelector('.cetris-game-over-screen');
    const playAgainBtn = document.getElementById('cetris-play-again-btn');
    const cetrisCanvasWrapper = document.getElementById('cetris-canvas-wrapper');

    const nextPieceCanvas = document.getElementById('cetrisNextPieceCanvas');
    const nextPieceCtx = nextPieceCanvas.getContext('2d');
    const NEXT_BLOCK_SIZE = 15;
    nextPieceCanvas.width = 5 * NEXT_BLOCK_SIZE;
    nextPieceCanvas.height = 5 * NEXT_BLOCK_SIZE;

    const startScreen = document.createElement('div');
    startScreen.id = 'cetris-start-screen';
    startScreen.innerHTML = `<button id="cetris-start-btn" class="cetris-game-btn"><i class="fas fa-play"></i></button>`;
    cetrisCanvasWrapper.appendChild(startScreen);
    const cetrisStartBtn = document.getElementById('cetris-start-btn');

    const BOARD_WIDTH = 15;
    const BOARD_HEIGHT = 15;
    let BLOCK_SIZE = 20;

    let board = [];
    let currentPiece;
    let nextPiece;
    let score = 0;
    let level = 1;
    let dropInterval = 1000;
    let accumulator = 0;
    let lastTimestamp = 0;
    let rafId = null;
    let isGameOver = false;

    let deviceType = 'desktop';
    let controlMode = 'keyboard';

    const TETROMINOES = [
        [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
        [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
        [[1, 1], [1, 1]],
        [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
    ];
    const COLORS = ['#FF0000', '#FFFF00', '#0000FF'];

    function detectDeviceType() {
        const width = window.innerWidth;
        deviceType = (width <= 768) ? 'mobile' : 'desktop';
        const savedControlMode = localStorage.getItem('cetrisControlMode');
        const availableModes = (deviceType === 'desktop') ? ['keyboard'] : ['buttons', 'joystick'];
        if (savedControlMode && availableModes.includes(savedControlMode)) {
            controlMode = savedControlMode;
        } else {
            controlMode = (deviceType === 'desktop') ? 'keyboard' : 'buttons';
        }
        applyControlMode();
    }

    function applyControlMode() {
        const joystick = document.getElementById('cetris-joystick');
        const directionButtons = document.getElementById('cetris-direction-buttons');
        const controlText = document.getElementById('cetris-control-mode-text');
        if (joystick) joystick.style.display = 'none';
        if (directionButtons) directionButtons.style.display = 'none';
        document.removeEventListener('keydown', handleKeyPress);
        if (controlText) controlText.textContent = controlMode.toUpperCase();
        const menuOptions = document.querySelectorAll('#cetris-control-menu .control-mode-option');
        const availableModes = (deviceType === 'desktop') ? ['keyboard'] : ['buttons', 'joystick'];
        menuOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.mode === controlMode) option.classList.add('active');
            option.style.display = availableModes.includes(option.dataset.mode) ? 'flex' : 'none';
        });
        switch (controlMode) {
            case 'keyboard': document.addEventListener('keydown', handleKeyPress); break;
            case 'joystick': if (joystick) joystick.style.display = 'block'; break;
            case 'buttons': if (directionButtons) directionButtons.style.display = 'block'; break;
        }
        localStorage.setItem('cetrisControlMode', controlMode);
    }

    function setControlMode(mode) {
        const availableModes = (deviceType === 'desktop') ? ['keyboard'] : ['buttons', 'joystick'];
        if (availableModes.includes(mode)) {
            controlMode = mode;
            applyControlMode();
            toggleControlMenu();
        }
    }

    function toggleControlMenu() {
        const menu = document.getElementById('cetris-control-menu');
        const button = document.getElementById('cetris-control-indicator');
        if (menu && button) {
            menu.classList.toggle('hidden');
            button.classList.toggle('active');
        }
    }

    function resizeCanvasAndCalculateBlockSize() {
        const size = cetrisCanvasWrapper.clientWidth;
        canvas.width = size;
        canvas.height = size;
        BLOCK_SIZE = Math.floor(size / BOARD_WIDTH);
    }

    function initBoard() {
        board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
    }

    function createPiece() {
        const randIndex = Math.floor(Math.random() * TETROMINOES.length);
        const shape = TETROMINOES[randIndex];
        return { shape: shape, color: COLORS[Math.floor(Math.random() * COLORS.length)], x: Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2), y: 0 };
    }

    function drawBlock(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }

    function mixColors(color1, color2) {
        const pair = [color1, color2].sort().join(',');
        const mixes = { '#0000FF,#FF0000': '#800080', '#0000FF,#FFFF00': '#008000', '#FF0000,#FFFF00': '#FFA500' };
        return mixes[pair] || null;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        // 1. Draw solid blocks on the board
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                if (board[row][col] !== 0) {
                    drawBlock(col, row, board[row][col]);
                }
            }
        }

        // 2. Draw color blends on top of the board using a glow/shadow effect
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                const color1 = board[row][col];
                if (color1 === 0) continue;

                // Blend with the block below
                if (row + 1 < BOARD_HEIGHT) {
                    const color2 = board[row + 1][col];
                    if (color2 !== 0 && color1 !== color2) {
                        const mixedColor = mixColors(color1, color2);
                        if (mixedColor) {
                            ctx.save();
                            ctx.shadowColor = mixedColor;
                            ctx.shadowBlur = 30;
                            ctx.fillStyle = mixedColor;
                            // Draw the effect multiple times to increase intensity
                            for (let i = 0; i < 3; i++) {
                                ctx.fillRect(col * BLOCK_SIZE, (row + 1) * BLOCK_SIZE - 2, BLOCK_SIZE, 4);
                            }
                            ctx.restore();
                        }
                    }
                }

                // Blend with the block to the right
                if (col + 1 < BOARD_WIDTH) {
                    const color2 = board[row][col + 1];
                    if (color2 !== 0 && color1 !== color2) {
                        const mixedColor = mixColors(color1, color2);
                        if (mixedColor) {
                            ctx.save();
                            ctx.shadowColor = mixedColor;
                            ctx.shadowBlur = 30;
                            ctx.fillStyle = mixedColor;
                            // Draw the effect multiple times to increase intensity
                            for (let i = 0; i < 3; i++) {
                                ctx.fillRect((col + 1) * BLOCK_SIZE - 2, row * BLOCK_SIZE, 4, BLOCK_SIZE);
                            }
                            ctx.restore();
                        }
                    }
                }
            }
        }

        // 3. Draw the currently falling piece
        if (currentPiece) {
            for (let row = 0; row < currentPiece.shape.length; row++) {
                for (let col = 0; col < currentPiece.shape[row].length; col++) {
                    if (currentPiece.shape[row][col] !== 0) {
                        drawBlock(currentPiece.x + col, currentPiece.y + row, currentPiece.color);
                    }
                }
            }
        }
    }

    function drawNextPiece() {
        nextPieceCtx.clearRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
        if (nextPiece) {
            const startX = (nextPieceCanvas.width / 2) - (nextPiece.shape[0].length * NEXT_BLOCK_SIZE / 2);
            const startY = (nextPieceCanvas.height / 2) - (nextPiece.shape.length * NEXT_BLOCK_SIZE / 2);
            nextPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        nextPieceCtx.fillStyle = nextPiece.color;
                        nextPieceCtx.fillRect(startX + x * NEXT_BLOCK_SIZE, startY + y * NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE);
                    }
                });
            });
        }
    }

    function isValidMove(piece, offsetX, offsetY, newShape) {
        for (let row = 0; row < newShape.length; row++) {
            for (let col = 0; col < newShape[row].length; col++) {
                if (newShape[row][col] !== 0) {
                    const boardX = piece.x + col + offsetX;
                    const boardY = piece.y + row + offsetY;
                    if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT || (boardY >= 0 && board[boardY][boardX] !== 0)) return false;
                }
            }
        }
        return true;
    }

    function rotate(piece) {
        const shape = piece.shape;
        const newShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
        if (isValidMove(piece, 0, 0, newShape)) piece.shape = newShape;
    }

    function mergePiece() {
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[row].length; col++) {
                if (currentPiece.shape[row][col] !== 0) {
                    board[currentPiece.y + row][currentPiece.x + col] = currentPiece.color;
                }
            }
        }
    }

    function clearLines() {
        let linesCleared = 0;
        outer: for (let y = BOARD_HEIGHT - 1; y >= 0; --y) {
            for (let x = 0; x < BOARD_WIDTH; ++x) {
                if (board[y][x] === 0) continue outer;
            }
            const row = board.splice(y, 1)[0].fill(0);
            board.unshift(row);
            ++y;
            linesCleared++;
        }
        if (linesCleared > 0) {
            score += linesCleared * 100 * level;
            if (score >= level * 500) {
                level++;
                dropInterval = Math.max(50, dropInterval - 50);
            }
            scoreDisplay.textContent = score;
            levelDisplay.textContent = level;
        }
    }

    function dropPiece() {
        if (isGameOver) return;
        if (isValidMove(currentPiece, 0, 1, currentPiece.shape)) {
            currentPiece.y++;
        } else {
            mergePiece();
            clearLines();
            currentPiece = nextPiece;
            nextPiece = createPiece();
            drawNextPiece();
            if (!isValidMove(currentPiece, 0, 0, currentPiece.shape)) {
                isGameOver = true;
                if (rafId) cancelAnimationFrame(rafId);
                showGameOverScreen();
            }
        }
        draw();
    }

    function gameLoopRaf(ts) {
        if (isGameOver) return;
        if (lastTimestamp === 0) lastTimestamp = ts;
        const delta = ts - lastTimestamp;
        lastTimestamp = ts;
        accumulator += delta;
        if (accumulator >= dropInterval) {
            dropPiece();
            accumulator = 0;
        }
        rafId = requestAnimationFrame(gameLoopRaf);
    }

    function handleKeyPress(e) {
        if (isGameOver || !currentPiece) return;
        switch (e.key) {
            case 'ArrowLeft': if (isValidMove(currentPiece, -1, 0, currentPiece.shape)) { currentPiece.x--; draw(); } break;
            case 'ArrowRight': if (isValidMove(currentPiece, 1, 0, currentPiece.shape)) { currentPiece.x++; draw(); } break;
            case 'ArrowDown': dropPiece(); break;
            case 'ArrowUp': rotate(currentPiece); draw(); break;
            case ' ': while (isValidMove(currentPiece, 0, 1, currentPiece.shape)) { currentPiece.y++; } dropPiece(); break;
        }
    }

    function showGameOverScreen() {
        gameOverScreen.classList.remove('hidden');
        saveCasualScore('cetris', score);
    }

    async function saveCasualScore(gameName, score) {
        if (score <= 0) return;
        if (!gameState.token) {
            if(window.IS_DEVELOPMENT) console.debug("User not logged in, not saving casual score.");
            return;
        }
        try {
            const response = await apiRequest('/api/casual-scores', 'POST', { game_name: gameName, score: score });
            
            // Only emit score for live updates if it's a new high score
            if (response && response.newScore && window.scoreSocketManager && window.scoreSocketManager.socket) {
                console.log('[Cetris] New high score! Emitting scoreSubmitted:', {
                    playerId: gameState.username,
                    score: score,
                    mode: gameName,
                    newLevel: null,
                    isNewHighScore: true
                });
                
                window.scoreSocketManager.socket.emit('scoreSubmitted', {
                    playerId: gameState.username,
                    score: score,
                    mode: gameName,
                    newLevel: null
                });
            } else if (!response.newScore) {
                console.log('[Cetris] Score not higher than existing high score, no live update needed');
            } else {
                console.warn('[Cetris] ScoreSocketManager not available for score submission');
            }
        } catch (error) {
            console.error(`Failed to save score for ${gameName}:`, error);
        }
    }

    function startGame() {
        startScreen.classList.add('hidden');
        resizeCanvasAndCalculateBlockSize();
        initBoard();
        score = 0; level = 1; dropInterval = 1000; isGameOver = false;
        scoreDisplay.textContent = score; levelDisplay.textContent = level;
        gameOverScreen.classList.add('hidden');
        currentPiece = createPiece();
        nextPiece = createPiece();
        draw();
        drawNextPiece();
        detectDeviceType();
        if (rafId) cancelAnimationFrame(rafId);
        accumulator = 0; lastTimestamp = 0;
        rafId = requestAnimationFrame(gameLoopRaf);
    }

    if (cetrisPlayBtn) {
        cetrisPlayBtn.addEventListener('click', () => {
            casualGameSelection.classList.add('hidden');
            document.getElementById('snake-game-container').classList.add('hidden');
            document.getElementById('cong-game-container').classList.add('hidden');
            cetrisGameContainer.classList.remove('hidden');
            
            const startScreen = document.getElementById('cetris-start-screen');
            if (startScreen) {
                startScreen.classList.add('hidden');
            }
            
            startGame();
        });
    }
    if(cetrisStartBtn) cetrisStartBtn.addEventListener('click', startGame);
    if(playAgainBtn) playAgainBtn.addEventListener('click', startGame);

    const controlButton = document.getElementById('cetris-control-indicator');
    if(controlButton) controlButton.addEventListener('click', toggleControlMenu);

    const controlOptions = document.querySelectorAll('#cetris-control-menu .control-mode-option');
    controlOptions.forEach(option => {
        option.addEventListener('click', () => setControlMode(option.dataset.mode));
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('cetris-control-menu');
        const button = document.getElementById('cetris-control-indicator');
        
        if (menu && button && !menu.contains(e.target) && !button.contains(e.target)) {
            menu.classList.add('hidden');
            button.classList.remove('active');
        }
    });

    document.getElementById('cetris-up').addEventListener('click', () => { if(!isGameOver && currentPiece) { rotate(currentPiece); draw(); } });
    document.getElementById('cetris-down').addEventListener('click', () => { if(!isGameOver && currentPiece) dropPiece(); });
    document.getElementById('cetris-left').addEventListener('click', () => { if(!isGameOver && currentPiece && isValidMove(currentPiece, -1, 0, currentPiece.shape)) { currentPiece.x--; draw(); } });
    document.getElementById('cetris-right').addEventListener('click', () => { if(!isGameOver && currentPiece && isValidMove(currentPiece, 1, 0, currentPiece.shape)) { currentPiece.x++; draw(); } });

    const joystickBase = document.getElementById('cetris-joystick');
    const joystickHandle = document.getElementById('cetris-joystick-handle');
    let joystickActive = false;
    let initialTouchX = 0;
    let initialTouchY = 0;

    if (joystickBase && joystickHandle) {
        joystickBase.addEventListener('touchstart', (e) => {
            if (controlMode !== 'joystick') return;
            e.preventDefault();
            joystickActive = true;
            const touch = e.touches[0];
            initialTouchX = touch.clientX;
            initialTouchY = touch.clientY;
        }, { passive: false });

        joystickBase.addEventListener('touchmove', (e) => {
            if (controlMode !== 'joystick' || !joystickActive || isGameOver || !currentPiece) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - initialTouchX;
            const deltaY = touch.clientY - initialTouchY;
            const maxHandleMove = joystickBase.clientWidth / 2;
            const handleX = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaX));
            const handleY = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaY));
            joystickHandle.style.transform = `translate(${handleX}px, ${handleY}px)`;
            const moveThreshold = 40;
            if (deltaX > moveThreshold) {
                if (isValidMove(currentPiece, 1, 0, currentPiece.shape)) { currentPiece.x++; draw(); }
                initialTouchX = touch.clientX;
            } else if (deltaX < -moveThreshold) {
                if (isValidMove(currentPiece, -1, 0, currentPiece.shape)) { currentPiece.x--; draw(); }
                initialTouchX = touch.clientX;
            }
            if (deltaY > moveThreshold) {
                dropPiece();
                initialTouchY = touch.clientY;
            } else if (deltaY < -moveThreshold) {
                rotate(currentPiece);
                draw();
                initialTouchY = touch.clientY;
            }
        }, { passive: true });

        joystickBase.addEventListener('touchend', (e) => {
            if (controlMode !== 'joystick') return;
            e.preventDefault();
            joystickActive = false;
            joystickHandle.style.transform = `translate(0px, 0px)`;
        });
    }
    
    const cetrisDropBtn = document.getElementById('cetris-drop-btn');
    if (cetrisDropBtn) {
        cetrisDropBtn.addEventListener('click', () => {
            if (isGameOver || !currentPiece) return;
            while (isValidMove(currentPiece, 0, 1, currentPiece.shape)) { currentPiece.y++; }
            dropPiece();
        });
    }

    window.cetrisGame = {
        stop: () => {
            if(rafId) cancelAnimationFrame(rafId);
        }
    };
});