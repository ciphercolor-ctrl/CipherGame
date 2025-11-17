document.addEventListener('DOMContentLoaded', () => {
    const gameSelectionMenu = document.getElementById('casual-game-selection');
    const snakeGameContainer = document.getElementById('snake-game-container');
    const playSnakeCard = document.querySelector('.game-card[data-game="snake"]');
    
    const canvas = document.getElementById('snakeCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('snake-score');
    
    // Enhanced mobile features
    let enhancedTouchControls = null;
    let gameStartTime = 0;
    let powerUps = [];
    let particles = [];
    let lastScore = 0;
    
    const startScreen = document.getElementById('snake-start-screen');
    const startButton = document.getElementById('snake-start-btn');
    
    const gameOverScreen = document.getElementById('snake-game-over-screen');
    const playAgainButton = document.getElementById('snake-play-again-btn');

    // Create a wrapper for the top UI elements and move them
    const pauseButton = document.getElementById('snake-pause-btn');
    const canvasWrapper = document.querySelector('.snake-canvas-wrapper');
    if (snakeGameContainer && scoreElement && pauseButton && canvasWrapper) {
        const topBar = document.createElement('div');
        topBar.className = 'snake-top-bar';
        topBar.appendChild(pauseButton);
        topBar.appendChild(scoreElement);
        snakeGameContainer.insertBefore(topBar, canvasWrapper);
    }

    let gridSize = 20;
    let snake = [];
    let foods = [];
    let score = 0;
    let direction = 'right';
    let isGameOver = true; // Start as true, set to false in initSnakeGame
    let gameLoopId = null;
    let isPaused = false;
    let gameHasStarted = false; // To prevent spacebar pause before game starts
    let lastUpdateTime = 0;
    let foodAnimationTime = 0;
    let snakeSpeed = 100; // ms per move
    let cursorIdleTimer = null; // Timer for hiding cursor
    let directionLocked = false; // Prevent multiple direction changes per tick
    
    // Adaptive controls variables
    let deviceType = 'desktop'; // 'desktop', 'tablet', 'mobile'
    let controlMode = 'buttons'; // 'buttons', 'joystick', 'swipe'
    
    // Swipe gesture variables
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeThreshold = 50; // Minimum distance for swipe

    // RESTORED: Original snake colors
    const snakeColors = ['#ff0000', '#ffff00', '#0000ff'];
    
    // Enhanced visual effects
    const visualEffects = {
        particles: [],
        screenShake: { intensity: 0, duration: 0 },
        powerUpGlow: { active: false, intensity: 0 }
    };

    // Enhanced controls setup
    function setupEnhancedControls() {
        if (enhancedTouchControls) {
            enhancedTouchControls.destroy();
        }
        
        const gameArea = document.getElementById('snake-game-container');
        if (gameArea && window.EnhancedTouchControls) {
            enhancedTouchControls = new window.EnhancedTouchControls(gameArea, {
                sensitivity: 1.0,
                deadZone: 10,
                hapticEnabled: true
            });
            
            enhancedTouchControls
                .on('swipe', (direction) => {
                    if (window.hapticFeedback) {
                        window.hapticFeedback.buttonPress();
                    }
                    changeDirection(direction);
                })
                .on('start', (pos) => {
                    if (window.hapticFeedback) {
                        window.hapticFeedback.buttonPress();
                    }
                });
        }
    }

    // Particle effect system
    function createParticleEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1.0,
                decay: 0.02,
                size: Math.random() * 4 + 2,
                color: `hsl(${Math.random() * 360}, 100%, 60%)`
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            particle.vy += 0.1; // Gravity
            
            if (particle.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function drawParticles() {
        particles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.life;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function setCursorVisibility(visible) {
        if (!snakeGameContainer) return;
        if (visible) {
            snakeGameContainer.classList.remove('hide-cursor');
        } else {
            snakeGameContainer.classList.add('hide-cursor');
        }
    }

    function handleCursorActivity() {
        setCursorVisibility(true);
        clearTimeout(cursorIdleTimer);
        if (!isGameOver && !isPaused) {
            cursorIdleTimer = setTimeout(() => setCursorVisibility(false), 2000);
        }
    }

    // Device detection and adaptive controls
    function detectDeviceType() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Determine device type first
        if (width <= 480) {
            deviceType = 'mobile';
        } else if (width <= 768) {
            deviceType = 'tablet';
        } else {
            deviceType = 'desktop';
        }
        
        // Load user preference and validate against available modes
        const savedControlMode = localStorage.getItem('snakeControlMode');
        let availableModes = [];
        if (deviceType === 'desktop') {
            availableModes = ['keyboard', 'joystick']; // No swipe on desktop
        } else if (deviceType === 'mobile') {
            availableModes = ['buttons', 'swipe', 'joystick']; // Mobile has buttons, swipe, joystick
        } else {
            availableModes = ['keyboard', 'joystick', 'swipe']; // Tablet has all modes
        }
        
        if (savedControlMode && availableModes.includes(savedControlMode)) {
            controlMode = savedControlMode;
        } else {
            // Default based on device type
            if (deviceType === 'mobile') {
                controlMode = 'buttons'; // Mobile defaults to direction buttons
            } else if (deviceType === 'tablet') {
                controlMode = 'joystick'; // Tablet uses joystick
            } else {
                controlMode = 'keyboard'; // Desktop uses keyboard only
            }
        }
        
        applyControlMode();
    }

    function applyControlMode() {
        const controls = document.getElementById('snake-controls');
        const joystick = document.getElementById('snake-joystick');
        const directionButtons = document.getElementById('snake-direction-buttons');
        const controlButton = document.getElementById('snake-control-indicator');
        const controlText = document.getElementById('control-mode-text');
        const canvasWrapper = document.querySelector('.snake-canvas-wrapper');
        
        // Hide all controls first
        if (controls) controls.style.display = 'none';
        if (joystick) joystick.style.display = 'none';
        if (directionButtons) directionButtons.style.display = 'none';
        if (canvasWrapper) canvasWrapper.classList.remove('swipe-mode-active');
        
        // Update control mode text and active option
        if (controlText) {
            controlText.textContent = controlMode.toUpperCase();
        }
        
        // Update active option in menu - filter out unavailable modes
        const menuOptions = document.querySelectorAll('.control-mode-option');
        menuOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.mode === controlMode) {
                option.classList.add('active');
            }
            
            // Hide unavailable modes based on device type
            const mode = option.dataset.mode;
            if (deviceType === 'desktop' && (mode === 'swipe' || mode === 'buttons')) {
                option.style.display = 'none'; // Hide swipe and buttons on desktop
            } else if (deviceType === 'mobile' && mode === 'keyboard') {
                option.style.display = 'none'; // Hide keyboard on mobile
            } else {
                option.style.display = 'flex'; // Show available modes
            }
        });
        
        // Show appropriate controls based on mode
        switch (controlMode) {
            case 'keyboard':
                // Desktop - keyboard only, no visible controls
                break;
            case 'joystick':
                if (joystick && (deviceType !== 'desktop' || controlMode === 'joystick')) {
                    joystick.style.display = 'block';
                }
                break;
            case 'buttons':
                // Mobile direction buttons
                if (directionButtons) directionButtons.style.display = 'block';
                break;
            case 'swipe':
                // Swipe mode - no visible controls, handled by canvas touch events
                if (canvasWrapper) canvasWrapper.classList.add('swipe-mode-active');
                break;
        }
        
        // Save user preference
        localStorage.setItem('snakeControlMode', controlMode);
    }

    function toggleControlMenu() {
        const menu = document.getElementById('snake-control-menu');
        const button = document.getElementById('snake-control-indicator');
        
        if (menu && button) {
            const isHidden = menu.classList.contains('hidden');
            
            if (isHidden) {
                menu.classList.remove('hidden');
                button.classList.add('active');
            } else {
                menu.classList.add('hidden');
                button.classList.remove('active');
            }
        }
    }

    function setControlMode(mode) {
        // Validate mode based on device type
        let availableModes = [];
        if (deviceType === 'desktop') {
            availableModes = ['keyboard', 'joystick']; // No swipe on desktop
        } else if (deviceType === 'mobile') {
            availableModes = ['buttons', 'swipe', 'joystick']; // Mobile has buttons, swipe, joystick
        } else {
            availableModes = ['keyboard', 'joystick', 'swipe']; // Tablet has all modes
        }
        
        if (availableModes.includes(mode)) {
            controlMode = mode;
            applyControlMode();
            toggleControlMenu(); // Close menu after selection
            
            // Show brief notification
            showControlModeNotification();
        }
    }

    function toggleControlMode() {
        // Get available modes based on device type
        let availableModes = [];
        if (deviceType === 'desktop') {
            availableModes = ['keyboard', 'joystick']; // No swipe on desktop
        } else if (deviceType === 'mobile') {
            availableModes = ['buttons', 'swipe', 'joystick']; // Mobile has buttons, swipe, joystick
        } else {
            availableModes = ['keyboard', 'joystick', 'swipe']; // Tablet has all modes
        }
        
        const currentIndex = availableModes.indexOf(controlMode);
        const nextIndex = (currentIndex + 1) % availableModes.length;
        setControlMode(availableModes[nextIndex]);
    }

    function showControlModeNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-family: 'Orbitron', sans-serif;
            font-size: 14px;
        `;
        notification.textContent = `Control Mode: ${controlMode.toUpperCase()}`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 1500);
    }

    function resizeCanvas() {
        const container = document.getElementById('snake-game-container');
        const containerSize = container.getBoundingClientRect();
        const size = Math.min(containerSize.width, window.innerHeight * 0.6) - 20; // Leave some padding
        
        canvas.width = size;
        canvas.height = size;

        // Recalculate grid size to maintain a 20x20 grid
        gridSize = canvas.width / 20;
    }

    let accumulator = 0;

    function gameLoop(currentTime) {
        if (isGameOver || isPaused) {
            if (gameLoopId) cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
            return;
        }

        if (!lastUpdateTime) {
            lastUpdateTime = currentTime;
        }
        const delta = currentTime - lastUpdateTime;
        lastUpdateTime = currentTime;
        accumulator += delta;

        // Fixed timestep for game logic update
        while (accumulator >= snakeSpeed) {
            update();
            accumulator -= snakeSpeed;
        }

        // Calculate interpolation factor for smooth rendering
        const interpolation = accumulator / snakeSpeed;

        draw(interpolation); // Pass interpolation to draw function

        // Handle other animations that run every frame
        foodAnimationTime += 0.1;
        updateParticles();

        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function startGameLoop() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        lastUpdateTime = performance.now();
        accumulator = 0;
        gameLoop(lastUpdateTime);
    }

    function initSnakeGame(isRestarting = false) {
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        
        snake = [{ x: 10, y: 10, prevX: 10, prevY: 10 }];
        foods = []; // Reset foods array
        score = 0;
        direction = 'right';
        isGameOver = false;
        isPaused = false;
        gameHasStarted = false;
        snakeSpeed = 150;
        gameStartTime = Date.now();
        powerUps = [];
        particles = [];
        lastScore = 0;
        lastUpdateTime = 0;

        // Reset visual effects
        visualEffects.particles = [];
        visualEffects.screenShake = { intensity: 0, duration: 0 };
        visualEffects.powerUpGlow = { active: false, intensity: 0 };

        scoreElement.textContent = `0`;
        scoreElement.classList.remove('hidden');
        
        gameOverScreen.classList.add('hidden');
        canvas.classList.remove('hidden');
        
        addFood(); // Add initial food
        draw(1.0); // Draw initial state at full interpolation

        // Set up enhanced controls
        setupEnhancedControls();

        // Haptic feedback for game start
        if (window.hapticFeedback) {
            window.hapticFeedback.gameStart();
        }

        if (isRestarting) {
            startScreen.classList.add('hidden');
            startGameLoop();
            setCursorVisibility(false); // Hide cursor immediately
        } else {
            startScreen.classList.remove('hidden');
        }
    }

    function togglePause() {
        if (isGameOver) return;
        
        isPaused = !isPaused;
        
        const pauseButton = document.getElementById('snake-pause-btn');
        if (pauseButton) {
            const icon = pauseButton.querySelector('i');
            if (isPaused) {
                icon.className = 'fas fa-play';
                pauseButton.title = 'Resume (Space)';
            } else {
                icon.className = 'fas fa-pause';
                pauseButton.title = 'Pause (Space)';
            }
        }
        
        if (isPaused) {
            showPauseOverlay();
            setCursorVisibility(true);
            clearTimeout(cursorIdleTimer);
        } else {
            hidePauseOverlay();
            startGameLoop(); // Resume the game loop
            setCursorVisibility(false); // Hide cursor immediately
        }
    }

    function showPauseOverlay() {
        const pauseOverlay = document.createElement('div');
        pauseOverlay.id = 'snake-pause-overlay';
        pauseOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
            font-family: 'Orbitron', sans-serif;
            z-index: 30;
        `;
        
        pauseOverlay.innerHTML = `
            <h2 style="font-size: 2rem; margin-bottom: 1rem; color: #ff8c00;">PAUSED</h2>
            <p style="font-size: 1.2rem; margin-bottom: 1.5rem;">Tap to resume</p>
            <button id="resume-btn" style="
                background: none;
                border: 2px solid #ff8c00;
                color: #ff8c00;
                padding: 10px 20px;
                border-radius: 5px;
                font-size: 1rem;
                cursor: pointer;
                font-family: 'Orbitron', sans-serif;
            ">Resume</button>
        `;
        
        // Add event listener to resume button
        const resumeBtn = pauseOverlay.querySelector('#resume-btn');
        resumeBtn.addEventListener('click', togglePause);
        
        // Add touch event for mobile resume
        pauseOverlay.addEventListener('click', togglePause);
        
        const canvasWrapper = document.querySelector('.snake-canvas-wrapper');
        canvasWrapper.appendChild(pauseOverlay);
    }

    function hidePauseOverlay() {
        const pauseOverlay = document.getElementById('snake-pause-overlay');
        if (pauseOverlay) {
            pauseOverlay.remove();
        }
    }

    function update() {
        if (isGameOver) return;

        const nextHeadPos = { x: snake[0].x, y: snake[0].y };
        switch (direction) {
            case 'up': nextHeadPos.y--; break;
            case 'down': nextHeadPos.y++; break;
            case 'left': nextHeadPos.x--; break;
            case 'right': nextHeadPos.x++; break;
        }

        if (nextHeadPos.x < 0 || nextHeadPos.x >= 20 || nextHeadPos.y < 0 || nextHeadPos.y >= 20 || checkSelfCollision(nextHeadPos)) {
            gameOver();
            return;
        }

        let ateFood = false;
        for (let i = foods.length - 1; i >= 0; i--) {
            if (nextHeadPos.x === foods[i].x && nextHeadPos.y === foods[i].y) {
                ateFood = true;
                score++;
                scoreElement.textContent = score;
                if (window.hapticFeedback) window.hapticFeedback.scorePoint();
                createParticleEffect(foods[i].x * gridSize + gridSize / 2, foods[i].y * gridSize + gridSize / 2);
                foods.splice(i, 1);
                if (snakeSpeed > 40) snakeSpeed -= 1.5;
                break;
            }
        }

        const oldTail = ateFood ? { ...snake[snake.length - 1] } : null;

        for (let i = snake.length - 1; i > 0; i--) {
            const segment = snake[i];
            const nextSegment = snake[i - 1];
            segment.prevX = segment.x;
            segment.prevY = segment.y;
            segment.x = nextSegment.x;
            segment.y = nextSegment.y;
        }

        const head = snake[0];
        head.prevX = head.x;
        head.prevY = head.y;
        head.x = nextHeadPos.x;
        head.y = nextHeadPos.y;

        if (ateFood && oldTail) {
            snake.push({ x: oldTail.x, y: oldTail.y, prevX: oldTail.x, prevY: oldTail.y });
        }

        if (foods.length === 0 && !isGameOver) {
            addFood();
        }
        directionLocked = false;
    }

    const lerp = (a, b, t) => a + (b - a) * t;

    function draw(interpolation) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.shadowBlur = 10;
        snake.forEach((segment, index) => {
            const color = snakeColors[index % snakeColors.length];
            ctx.fillStyle = color;
            ctx.shadowColor = color;

            const renderX = lerp(segment.prevX, segment.x, interpolation) * gridSize;
            const renderY = lerp(segment.prevY, segment.y, interpolation) * gridSize;

            ctx.fillRect(renderX, renderY, gridSize, gridSize);
        });
        ctx.shadowBlur = 0;

        foods.forEach(f => {
            const pulse = Math.sin(foodAnimationTime + f.x) * 0.1 + 0.9;
            if (f.type === 'special') {
                const foodSize = (gridSize * 1.2) * pulse;
                const foodOffset = (gridSize - foodSize) / 2;
                const specialColor = '#9400D3';
                ctx.fillStyle = specialColor;
                ctx.shadowColor = specialColor;
                ctx.shadowBlur = 15;
                ctx.fillRect(f.x * gridSize + foodOffset, f.y * gridSize + foodOffset, foodSize, foodSize);
            } else {
                const foodSize = gridSize * pulse;
                const foodOffset = (gridSize - foodSize) / 2;
                const foodColor = '#ffffff';
                ctx.fillStyle = foodColor;
                ctx.shadowColor = foodColor;
                ctx.shadowBlur = 10;
                ctx.fillRect(f.x * gridSize + foodOffset, f.y * gridSize + foodOffset, foodSize, foodSize);
            }
        });
        ctx.shadowBlur = 0;

        drawParticles();
    }

    function addFood() {
        // Determine food type
        const specialFoodExists = foods.some(f => f.type === 'special');
        let foodType = 'standard';
        // 10% chance to spawn a special food, but only if one doesn't already exist
        if (!specialFoodExists && Math.random() < 0.1) {
            foodType = 'special';
        }

        let newFood = {
            x: Math.floor(Math.random() * 20),
            y: Math.floor(Math.random() * 20),
            type: foodType // Add type property
        };

        const onSnake = snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
        const onFood = foods.some(f => f.x === newFood.x && f.y === newFood.y);

        if (onSnake || onFood) {
            addFood(); // Retry
        } else {
            foods.push(newFood);
        }
    }

    function checkSelfCollision(head) {
        return snake.some((segment, index) => index > 0 && segment.x === head.x && segment.y === head.y);
    }

    function gameOver() {
        isGameOver = true;
        gameHasStarted = false;
        cancelAnimationFrame(gameLoopId);
        
        setCursorVisibility(true);
        clearTimeout(cursorIdleTimer);

        // Haptic feedback for game over
        if (window.hapticFeedback) {
            window.hapticFeedback.gameOver();
        }
        
        // Screen shake effect
        visualEffects.screenShake = { intensity: 10, duration: 500 };
        
        gameOverScreen.classList.remove('hidden');
        saveCasualScore('snake', score);
        // Don't hide the canvas, the overlay will cover it
    }

    async function saveCasualScore(gameName, score) {
        if (score <= 0) {
            return;
        }
        if (!gameState.token) {
            if(window.IS_DEVELOPMENT) {
                logger.debug("User not logged in, not saving casual score.");
            }
            return;
        }
        try {
            const response = await apiRequest('/api/casual-scores', 'POST', {
                game_name: gameName,
                score: score
            });
            if(window.IS_DEVELOPMENT) {
                logger.debug(`Successfully saved score ${score} for ${gameName}`);
            }
            
            if (response && response.newScore) {
                console.log('[Snake] New high score! Live update will be triggered by the server.');
            } else if (!response.newScore) {
                console.log('[Snake] Score not higher than existing high score, no live update needed');
            } else {
                console.warn('[Snake] ScoreSocketManager not available for score submission');
            }
        } catch (error) {
            logger.error(`Failed to save score for ${gameName}:`, error);
        }
    }

    function changeDirection(e) {
        if (isGameOver || isPaused || directionLocked) return;
        
        let newDirection;
        
        // Handle different input types
        if (typeof e === 'string') {
            // Direct direction string
            newDirection = e;
        } else if (e.key) {
            // Keyboard event
            newDirection = e.key.replace('Arrow', '').toLowerCase();
        } else if (e.direction) {
            // Swipe direction
            newDirection = e.direction;
        } else {
            return;
        }
        
        const oppositeDirections = {
            'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left'
        };

        if (['up', 'down', 'left', 'right'].includes(newDirection) && snake.length > 1 && oppositeDirections[direction] === newDirection) {
            return;
        }
        
        if (['up', 'down', 'left', 'right'].includes(newDirection)) {
            direction = newDirection;
            directionLocked = true; // Lock direction until next tick
        }
    }

    // Swipe gesture handling
    function handleSwipeStart(e) {
        if (controlMode !== 'swipe' || isGameOver || isPaused) return;
        
        const touch = e.touches[0];
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
    }

    function handleSwipeEnd(e) {
        if (controlMode !== 'swipe' || isGameOver || isPaused) return;
        
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - swipeStartX;
        const deltaY = touch.clientY - swipeStartY;
        
        // Determine swipe direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (Math.abs(deltaX) > swipeThreshold) {
                if (deltaX > 0) {
                    changeDirection('right');
                } else {
                    changeDirection('left');
                }
            }
        } else {
            // Vertical swipe
            if (Math.abs(deltaY) > swipeThreshold) {
                if (deltaY > 0) {
                    changeDirection('down');
                } else {
                    changeDirection('up');
                }
            }
        }
    }

    function showSnakeGame() {
        gameSelectionMenu.classList.add('hidden');
        document.getElementById('cetris-game-container').classList.add('hidden');
        document.getElementById('cong-game-container').classList.add('hidden');
        snakeGameContainer.classList.remove('hidden');
        
        // Detect device and apply adaptive controls
        detectDeviceType();
        
        resizeCanvas();
        initSnakeGame(false); // Initial setup, don't start loop

        snakeGameContainer.addEventListener('mousemove', handleCursorActivity, { passive: true });
        setCursorVisibility(true); // Ensure cursor is visible initially
    }

    function showCasualMenu() {
        snakeGameContainer.classList.add('hidden');
        gameSelectionMenu.classList.remove('hidden');
        isGameOver = true; 
        cancelAnimationFrame(gameLoopId);

        setCursorVisibility(true);
        clearTimeout(cursorIdleTimer);
        snakeGameContainer.removeEventListener('mousemove', handleCursorActivity);
    }

    // --- Event Listeners ---
    if (playSnakeCard) {
        playSnakeCard.addEventListener('click', showSnakeGame);
    }
    if (startButton) {
        startButton.addEventListener('click', () => {
            startScreen.classList.add('hidden');
            startGameLoop();
            gameHasStarted = true; // Mark game as started
            setCursorVisibility(false); // Hide cursor immediately
        });
    }
    if (playAgainButton) {
        playAgainButton.addEventListener('click', () => {
            initSnakeGame(true);
            gameHasStarted = true; // Mark game as started
        });
    }
    
    // Pause button
    const pauseButtonListener = document.getElementById('snake-pause-btn');
    if (pauseButtonListener) {
        pauseButtonListener.addEventListener('click', togglePause);
    }
    
    document.addEventListener('keydown', changeDirection);
    window.addEventListener('resize', resizeCanvas);

    // Mobile Controls
    document.getElementById('snake-up').addEventListener('click', () => changeDirection('up'));
    document.getElementById('snake-down').addEventListener('click', () => changeDirection('down'));
    document.getElementById('snake-left').addEventListener('click', () => changeDirection('left'));
    document.getElementById('snake-right').addEventListener('click', () => changeDirection('right'));
    
    // Mobile Direction Buttons
    document.getElementById('mobile-snake-up').addEventListener('click', () => changeDirection('up'));
    document.getElementById('mobile-snake-down').addEventListener('click', () => changeDirection('down'));
    document.getElementById('mobile-snake-left').addEventListener('click', () => changeDirection('left'));
    document.getElementById('mobile-snake-right').addEventListener('click', () => changeDirection('right'));

    // Mobile joystick for touch devices
    const joystickBase = document.getElementById('snake-joystick');
    const joystickHandle = document.getElementById('snake-joystick-handle');
    let joystickActive = false;

    if (joystickBase && joystickHandle) {
        let initialTouchX = 0;
        let initialTouchY = 0;

        // Mouse event listeners for desktop
        joystickBase.addEventListener('mousedown', (e) => {
            e.preventDefault();
            joystickActive = true;
            initialTouchX = e.clientX;
            initialTouchY = e.clientY;
        }, { passive: false });

        window.addEventListener('mousemove', (e) => {
            if (!joystickActive) return;

            const deltaX = e.clientX - initialTouchX;
            const deltaY = e.clientY - initialTouchY;

            const maxHandleMove = joystickBase.clientWidth / 2;
            const handleX = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaX));
            const handleY = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaY));
            joystickHandle.style.transform = `translate(${handleX}px, ${handleY}px)`;

            const moveThreshold = 20; // Reduced threshold for smoother mouse control

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > moveThreshold) {
                    changeDirection('right');
                } else if (deltaX < -moveThreshold) {
                    changeDirection('left');
                }
            } else {
                if (deltaY > moveThreshold) {
                    changeDirection('down');
                } else if (deltaY < -moveThreshold) {
                    changeDirection('up');
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (!joystickActive) return;
            e.preventDefault();
            joystickActive = false;
            joystickHandle.style.transform = `translate(0px, 0px)`;
            initialTouchX = 0;
            initialTouchY = 0;
        });


        joystickBase.addEventListener('touchstart', (e) => {
            e.preventDefault();
            joystickActive = true;
            const touch = e.touches[0];
            initialTouchX = touch.clientX;
            initialTouchY = touch.clientY;
        }, { passive: false });

        joystickBase.addEventListener('touchmove', (e) => {
            if (!joystickActive) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - initialTouchX;
            const deltaY = touch.clientY - initialTouchY;

            // Move the handle visually
            const maxHandleMove = joystickBase.clientWidth / 2;
            const handleX = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaX));
            const handleY = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaY));
            joystickHandle.style.transform = `translate(${handleX}px, ${handleY}px)`;

            const moveThreshold = 40; // Pixels to move before snake moves

            // Horizontal movement
            if (deltaX > moveThreshold) {
                changeDirection('right');
                initialTouchX = touch.clientX; // Reset initial touch to prevent continuous movement
            } else if (deltaX < -moveThreshold) {
                changeDirection('left');
                initialTouchX = touch.clientX; // Reset initial touch to prevent continuous movement
            }

            // Vertical movement
            if (Math.abs(deltaY) > moveThreshold) {
                if (deltaY > 0) { // Down swipe
                    changeDirection('down');
                    initialTouchY = touch.clientY; // Reset initial touch
                } else { // Up swipe
                    changeDirection('up');
                    initialTouchY = touch.clientY; // Reset initial touch
                }
            }

        }, { passive: true });

        joystickBase.addEventListener('touchend', (e) => {
            e.preventDefault();
            joystickActive = false;
            joystickHandle.style.transform = `translate(0px, 0px)`; // Reset handle position
        });
    }

    // Add swipe gesture support to canvas
    canvas.addEventListener('touchstart', handleSwipeStart, { passive: true });
    canvas.addEventListener('touchend', handleSwipeEnd, { passive: true });
    
    // Add pause functionality for swipe mode
    canvas.addEventListener('click', (e) => {
        if (controlMode === 'swipe' && !isGameOver) {
            togglePause();
        }
    });
    
    
    
    // Control mode button event listener
    const controlButton = document.getElementById('snake-control-indicator');
    if (controlButton) {
        controlButton.addEventListener('click', toggleControlMenu);
    }
    
    // Control mode menu option event listeners
    const controlOptions = document.querySelectorAll('.control-mode-option');
    controlOptions.forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.mode;
            setControlMode(mode);
        });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('snake-control-menu');
        const button = document.getElementById('snake-control-indicator');
        
        if (menu && button && !menu.contains(e.target) && !button.contains(e.target)) {
            menu.classList.add('hidden');
            button.classList.remove('active');
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && gameHasStarted && !isGameOver) {
            e.preventDefault();
            togglePause();
        } else if (e.code === 'KeyC' && !isGameOver) {
            e.preventDefault();
            toggleControlMode();
        }
    });

    // Window resize handler for adaptive controls
    window.addEventListener('resize', () => {
        detectDeviceType();
        resizeCanvas();
    });

    window.showCasualMenu = showCasualMenu;
    window.togglePause = togglePause;
    window.toggleControlMode = toggleControlMode;
    window.toggleControlMenu = toggleControlMenu;
    window.setControlMode = setControlMode;
});
