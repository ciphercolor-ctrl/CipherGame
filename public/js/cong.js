class CongGame {
    constructor(container) {
        this.container = container;
        
        // Enhanced mobile features
        this.enhancedTouchControls = null;
        this.gameStartTime = 0;
        this.particles = [];
        this.visualEffects = {
            particles: [],
            screenShake: { intensity: 0, duration: 0 },
            hitGlow: { active: false, intensity: 0 }
        };
        this.canvas = container.querySelector('#cong-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.initDOMElements();
        this.initGameSettings();
        this.initGameObjects();
        this.initEventListeners();

        this.animationFrameId = null;
        this.gameState = 'STOPPED'; // STOPPED, RUNNING, PAUSED

        this.showStartScreen(); // Initial setup
        this.updateUIFromSettings();
    }

    initDOMElements() {
        this.scoreDiv = this.container.querySelector('#cong-score');
        this.playerScoreDisplay = this.container.querySelector('#player-score');
        this.aiScoreDisplay = this.container.querySelector('#ai-score');

        this.startScreen = this.container.querySelector('#cong-start-screen');
        this.gameOverScreen = this.container.querySelector('#cong-game-over-screen');
        this.startBtn = this.container.querySelector('#cong-start-btn');
        this.playAgainBtn = this.container.querySelector('#cong-play-again-btn');
        this.winnerText = this.container.querySelector('#cong-winner-text');
        this.finalScoreDisplay = this.container.querySelector('#cong-final-score');

        this.settingsBtn = this.container.querySelector('#cong-settings-btn');
        this.settingsModal = this.container.querySelector('#cong-settings-modal');
        this.saveSettingsBtn = this.container.querySelector('#save-cong-settings-btn');
        this.closeSettingsBtn = this.container.querySelector('#close-cong-settings-btn');
        this.winningScoreSelect = this.container.querySelector('#winning-score-select');
        this.aiDifficultySelect = this.container.querySelector('#ai-difficulty-select');

        this.joystickBase = this.container.querySelector('#cong-joystick');
        this.joystickHandle = this.container.querySelector('#cong-joystick-handle');
    }

    initGameSettings() {
        this.canvas.width = 300;
        this.canvas.height = 300;

        this.config = {
            paddleWidth: 10,
            paddleHeight: 100,
            ballRadius: 8,
            aiDifficulties: {
                easy: { speed: 0.04, error: 0.2 },
                medium: { speed: 0.07, error: 0.1 },
                hard: { speed: 0.1, error: 0.05 }
            }
        };

        this.settings = {
            winningScore: 5,
            aiDifficulty: 'easy'
        };
    }

    initGameObjects() {
        this.player = new PlayerPaddle(this.canvas.width - this.config.paddleWidth * 2, this.canvas, this.config);
        this.ai = new AIPaddle(this.config.paddleWidth, this.canvas, this.config);
        this.ball = new Ball(this.canvas, this.config);
    }

    initEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.playAgainBtn.addEventListener('click', () => {
            this.resetGame();
            this.startGame();
        });

        this.settingsBtn.addEventListener('click', () => this.showSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        this.canvas.addEventListener('mousemove', e => this.player.move(e));
        
        let joystickActive = false;
        let initialTouchY = 0;
        let initialPaddleY = 0;
        this.joystickBase.addEventListener('touchstart', e => {
            e.preventDefault();
            joystickActive = true;
            const touch = e.touches[0];
            initialTouchY = touch.clientY;
            initialPaddleY = this.player.y;
        }, { passive: false });
        this.joystickBase.addEventListener('touchmove', e => {
            e.preventDefault();
            if (!joystickActive) return;
            const touch = e.touches[0];
            this.player.moveWithJoystick(touch, initialTouchY, initialPaddleY, this.joystickBase, this.joystickHandle);
        }, { passive: false });
        this.joystickBase.addEventListener('touchend', e => {
            e.preventDefault();
            joystickActive = false;
            this.joystickHandle.style.transform = `translateY(0px)`;
        });
    }

    // --- UI & Settings --- 
    updateUIFromSettings() {
        this.winningScoreSelect.value = this.settings.winningScore;
        this.aiDifficultySelect.value = this.settings.aiDifficulty;
    }

    showSettings() {
        if (this.gameState === 'RUNNING') {
            this.pauseGame();
        }
        this.updateUIFromSettings();
        this.settingsModal.classList.remove('hidden');
    }

    hideSettings() {
        this.settingsModal.classList.add('hidden');
        if (this.gameState === 'PAUSED') {
            this.resumeGame();
        }
    }

    saveSettings() {
        this.settings.winningScore = parseInt(this.winningScoreSelect.value, 10);
        this.settings.aiDifficulty = this.aiDifficultySelect.value;
        this.settingsModal.classList.add('hidden');
        this.resetGame();
        this.startGame();
    }

    showStartScreen() {
        this.resetGame();
        this.startScreen.classList.remove('hidden');
        this.scoreDiv.classList.remove('visible'); // Skor göstergesini şeffaf yap
    }

    // --- Game State --- 
    resetGame() {
        this.stopGame();
        this.player.score = 0;
        this.ai.score = 0;
        this.player.reset();
        this.ai.reset();
        this.ball.reset(0);
        this.updateScore();
        this.draw();
    }

    startGame() {
        if (this.gameState === 'RUNNING') return;
        this.gameState = 'RUNNING';
        this.startScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.scoreDiv.classList.add('visible'); // Skor göstergesini görünür yap
        this.container.classList.add('game-running'); // Hide cursor in game area
        this.gameLoop();
    }

    pauseGame() {
        if (this.gameState !== 'RUNNING') return;
        this.gameState = 'PAUSED';
    }

    resumeGame() {
        if (this.gameState !== 'PAUSED') return;
        this.gameState = 'RUNNING';
        this.gameLoop();
    }

    stopGame() {
        this.gameState = 'STOPPED';
        this.container.classList.remove('game-running'); // Show cursor
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    endGame() {
        this.stopGame();
        const playerWon = this.player.score >= this.settings.winningScore;
        this.winnerText.textContent = playerWon ? getTranslation('gameResultWin') : getTranslation('gameOver');
        this.finalScoreDisplay.textContent = `${this.ai.score} - ${this.player.score}`;
        this.gameOverScreen.classList.remove('hidden');

        if (playerWon) {
            const finalScore = 10 + (this.player.score - this.ai.score);
            this.saveCasualScore('cong', finalScore);
        }
    }

    gameLoop() {
        if (this.gameState !== 'RUNNING') return;
        this.update();
        this.draw();
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.ball.update(this.player, this.ai);
        
        let difficulty = this.config.aiDifficulties[this.settings.aiDifficulty];
        if (!difficulty) {
            if(window.IS_DEVELOPMENT) console.warn(`Invalid AI difficulty '${this.settings.aiDifficulty}'. Defaulting to 'easy'.`);
            this.settings.aiDifficulty = 'easy';
            difficulty = this.config.aiDifficulties['easy'];
        }
        this.ai.update(this.ball, difficulty);

        if (this.ball.x - this.ball.radius < 0) {
            this.player.score++;
            this.ball.reset(1);
            this.player.reset();
            this.ai.reset();
        } else if (this.ball.x + this.ball.radius > this.canvas.width) {
            this.ai.score++;
            this.ball.reset(-1);
            this.player.reset();
            this.ai.reset();
        }

        this.updateScore();

        if (this.player.score >= this.settings.winningScore || this.ai.score >= this.settings.winningScore) {
            this.endGame();
        }
    }

    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const netColor = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.setLineDash([10, 10]);
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.strokeStyle = netColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.player.draw(this.ctx);
        this.ai.draw(this.ctx);
        this.ball.draw(this.ctx);
    }

    updateScore() {
        this.playerScoreDisplay.textContent = this.player.score;
        this.aiScoreDisplay.textContent = this.ai.score;
    }

    async saveCasualScore(gameName, score) {
        if (score <= 0) return;
        if (!gameState.token) {
            if(window.IS_DEVELOPMENT) console.debug("User not logged in, not saving casual score.");
            return;
        }
        try {
            const response = await apiRequest('/api/casual-scores', 'POST', { game_name: gameName, score: score });
            
            if (response && response.newScore) {
                console.log('[Pong] New high score! Live update will be triggered by the server.');
            } else if (!response.newScore) {
                console.log('[Pong] Score not higher than existing high score, no live update needed');
            } else {
                console.warn('[Pong] ScoreSocketManager not available for score submission');
            }
        } catch (error) {
            console.error(`Failed to save score for ${gameName}:`, error);
        }
    }
}

class Paddle {
    constructor(x, y, width, height, canvas) {
        this.initialX = x;
        this.initialY = y;
        this.width = width;
        this.height = height;
        this.canvas = canvas;
        this.score = 0;
        this.reset();
    }

    reset() {
        this.x = this.initialX;
        this.y = this.canvas.height / 2 - this.height / 2;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    clampY() {
        if (this.y < 0) this.y = 0;
        if (this.y + this.height > this.canvas.height) this.y = this.canvas.height - this.height;
    }
}

class PlayerPaddle extends Paddle {
    constructor(x, canvas, config) {
        super(x, canvas.height / 2 - config.paddleHeight / 2, config.paddleWidth, config.paddleHeight, canvas);
        this.color = 'blue';
    }

    move(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.y = event.clientY - rect.top - this.height / 2;
        this.clampY();
    }

    moveWithJoystick(touch, initialTouchY, initialPaddleY, joystickBase, joystickHandle) {
        const deltaY = touch.clientY - initialTouchY;
        const maxHandleMove = joystickBase.clientHeight / 2;
        const handleY = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaY));
        joystickHandle.style.transform = `translateY(${handleY}px)`;

        const joystickRange = joystickBase.clientHeight;
        const paddleRange = this.canvas.height - this.height;
        this.y = initialPaddleY + (deltaY / joystickRange) * paddleRange * 0.8;
        this.clampY();
    }
}

class AIPaddle extends Paddle {
    constructor(x, canvas, config) {
        super(x, canvas.height / 2 - config.paddleHeight / 2, config.paddleWidth, config.paddleHeight, canvas);
        this.color = 'red';
    }

    update(ball, difficulty) {
        const errorFactor = (Math.random() - 0.5) * this.height * difficulty.error;
        const targetY = ball.y + errorFactor;
        const moveSpeed = difficulty.speed;
        this.y += (targetY - (this.y + this.height / 2)) * moveSpeed;
        this.clampY();
    }
}

class Ball {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.radius = config.ballRadius;
        this.reset(0);
    }

    reset(direction) {
        const isMobile = window.innerWidth <= 768;
        this.baseSpeed = isMobile ? 4 : 7;
        this.speed = this.baseSpeed;
        this.x = this.canvas.width / 2;
        this.y = this.canvas.height / 2;

        const serveDirection = direction !== 0 ? direction : (Math.random() > 0.5 ? 1 : -1);
        this.dx = serveDirection * this.speed;
        this.dy = (Math.random() * 2) - 1;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow';
        ctx.fill();
    }

    update(player, ai) {
        this.x += this.dx;
        this.y += this.dy;

        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.dy *= -1;
        } else if (this.y + this.radius > this.canvas.height) {
            this.y = this.canvas.height - this.radius;
            this.dy *= -1;
        }

        let currentPaddle = (this.dx < 0) ? ai : player;
        if (this.isColliding(currentPaddle)) {
            let collidePoint = (this.y - (currentPaddle.y + currentPaddle.height / 2));
            collidePoint = collidePoint / (currentPaddle.height / 2);
            let angleRad = (Math.PI / 4) * collidePoint;
            let direction = (this.dx < 0) ? 1 : -1;
            this.speed *= 1.03;
            this.dx = direction * this.speed * Math.cos(angleRad);
            this.dy = this.speed * Math.sin(angleRad);
        }
    }

    isColliding(paddle) {
        const ballLeft = this.x - this.radius;
        const ballRight = this.x + this.radius;
        const ballTop = this.y - this.radius;
        const ballBottom = this.y + this.radius;
        const paddleLeft = paddle.x;
        const paddleRight = paddle.x + paddle.width;
        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;
        return ballRight > paddleLeft && ballLeft < paddleRight && ballBottom > paddleTop && ballTop < paddleBottom;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const congGameContainer = document.getElementById('cong-game-container');
    const playCongButton = document.querySelector('.game-card[data-game="cong"] .play-casual-game-btn');
    const casualGamesModal = document.getElementById('casualGamesModal');
    const closeBtn = casualGamesModal.querySelector('.close-game[data-modal-id="casualGamesModal"]');

    let congGameInstance = null;

    function getGameInstance() {
        if (!congGameInstance) {
            congGameInstance = new CongGame(congGameContainer);
        }
        return congGameInstance;
    }

    if (playCongButton) {
        playCongButton.addEventListener('click', () => {
            document.getElementById('casual-game-selection').classList.add('hidden');
            document.getElementById('snake-game-container').classList.add('hidden');
            document.getElementById('cetris-game-container').classList.add('hidden');
            
            congGameContainer.classList.remove('hidden');
            getGameInstance().showStartScreen();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (congGameInstance) {
                congGameInstance.stopGame();
            }
        });
    }
});