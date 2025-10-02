const STANDARD_ZOOM_LEVEL = 40; // Define the standard zoom level

const levelBorderColors = {
    1: { color: '#FFCCCC', shadow: 'rgba(255, 204, 204, 0.5)' }, // Faded Red
    2: { color: '#FF9999', shadow: 'rgba(255, 153, 153, 0.5)' },
    3: { color: '#FF6666', shadow: 'rgba(255, 102, 102, 0.5)' },
    4: { color: '#FF3333', shadow: 'rgba(255, 51, 51, 0.5)' },
    5: { color: '#FF0000', shadow: 'rgba(255, 0, 0, 0.5)' }, // Pure Red
    6: { color: '#CC0000', shadow: 'rgba(204, 0, 0, 0.5)' },
    7: { color: '#990000', shadow: 'rgba(153, 0, 0, 0.5)' },
    8: { color: '#660000', shadow: 'rgba(102, 0, 0, 0.5)' },
    9: { color: '#330000', shadow: 'rgba(51, 0, 0, 0.5)' }, // Vibrant Red
    10: { color: '#FF0000', shadow: 'rgba(255, 0, 0, 0.7)' } // Vibrant Red for Level 10 fallback
};


// Helper function to get all cells in a line between two points (Bresenham's-like algorithm)
function getCellsInLine(startIndex, endIndex, gridSize) {
    const cells = [];
    const startX = startIndex % gridSize;
    const startY = Math.floor(startIndex / gridSize);
    const endX = endIndex % gridSize;
    const endY = Math.floor(endIndex / gridSize);

    const dx = Math.abs(endX - startX);
    const dy = Math.abs(endY - startY);
    const sx = (startX < endX) ? 1 : -1;
    const sy = (startY < endY) ? 1 : -1;
    let err = dx - dy;

    let x = startX;
    let y = startY;

    while (true) {
        cells.push(y * gridSize + x);
        if (x === endX && y === endY) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
    return cells;
}

function getCellFromCoordinates(e) {
    const point = e; // No longer need to check for e.touches
    return document.elementFromPoint(point.clientX, point.clientY);
}

function handlePaintingStart(e) {
    e.preventDefault();
    gameState.isPainting = true;
    const cellElement = getCellFromCoordinates(e)?.closest('.grid-cell');
    if (cellElement) {
        paintCell(cellElement);
        gameState.lastPaintedCellIndex = parseInt(cellElement.dataset.index);
    }
}

function handlePaintingMove(e) {
    e.preventDefault();
    if (!gameState.isPainting || !gameState.activeColor) return;
    
    const currentCellElement = getCellFromCoordinates(e)?.closest('.grid-cell');
    if (!currentCellElement) return;

    const currentCellIndex = parseInt(currentCellElement.dataset.index);

    if (gameState.lastPaintedCellIndex !== null && gameState.lastPaintedCellIndex !== currentCellIndex) {
        const cellsToPaint = getCellsInLine(gameState.lastPaintedCellIndex, currentCellIndex, gameState.currentMode);
        let paintedAtLeastOneCell = false;
        cellsToPaint.forEach(index => {
            const cellToPaint = gameState.gameGrid[index]?.element;
            if (cellToPaint) {
                paintCell(cellToPaint);
                paintedAtLeastOneCell = true;
            }
        });
        if (paintedAtLeastOneCell) {
            playSound('click');
        }
    } else if (gameState.lastPaintedCellIndex !== currentCellIndex) {
        paintCell(currentCellElement);
    }
    
    gameState.lastPaintedCellIndex = currentCellIndex;
}

function handlePaintingEnd(e) {
    e.preventDefault();
    gameState.isPainting = false;
    gameState.lastPaintedCellIndex = null;
}


function openGame() {
    if (window.IS_DEVELOPMENT) { // Check if in development mode
        logger.debug('openGame called!', 'gameState.isLoggedIn:', gameState.isLoggedIn, 'gameState.isGuest:', gameState.isGuest);
    }
    
    // Save current scroll position before disabling scroll
    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    
    updateProfileDisplay(gameState.level);
    if (!gameState.isLoggedIn && !gameState.isGuest) {
        document.getElementById('playerInfoModal').style.display = 'block';
        showAuthTab('login');
    } else {
        document.getElementById('gameModal').style.display = 'block';
        showScreen('mainMenu');
        const playerAvatar = document.querySelector('#gameModal .profile-logo');
        if (playerAvatar) {
            playerAvatar.id = 'profileLogo';
            if (gameState.level > 0) {
                playerAvatar.className = `profile-logo level-${gameState.level}-border`;
            } else {
                playerAvatar.className = 'profile-logo no-border'; // No border for level 0
            }
            if (window.IS_DEVELOPMENT) {
                logger.debug('Game screen player avatar class:', playerAvatar.className);
            }
        }
        
        // Also set up Auto Solver controls for the profile logo
        setTimeout(async () => {
            await setupAutoSolverControls();
        }, 100);
    }
    document.body.classList.add('no-scroll');
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

function closeGame() {
    // Restore the game container's scrollbar when closing the modal.
    const gameContainer = document.querySelector('#gameModal .game-container');
    if (gameContainer) {
        gameContainer.style.overflowY = 'auto';
    }
    document.getElementById('gameModal').style.display = 'none';
    document.getElementById('chatModal').style.display = 'none';
    resetGame();
    
    // Restore scroll position and remove no-scroll class
    const scrollY = document.body.style.top;
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

function selectMode(size) {
    gameState.currentMode = size;

    generateGameGrid(size);
    showScreen('gameScreen');
    resetTimer();
    startMemoryTimer();
    
    // Set up Auto Solver controls for game screen
    setTimeout(async () => {
        await setupAutoSolverControls();
    }, 100);
}

function generateClusteredDistribution(size, colors, clusteringFactor, maxAttempts = 10) {
    const totalCells = size * size;
    let distribution = [];

    // 1. Adım: Renkleri dengeli bir şekilde dağıtarak tahtayı oluştur.
    const numColors = colors.length;
    const cellsPerColor = Math.floor(totalCells / numColors);
    let remainder = totalCells % numColors;

    for (let i = 0; i < numColors; i++) {
        let count = cellsPerColor;
        if (remainder > 0) {
            count++;
            remainder--;
        }
        for (let j = 0; j < count; j++) {
            distribution.push(colors[i]);
        }
    }

    // Fisher-Yates (aka Knuth) Shuffle
    for (let i = distribution.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [distribution[i], distribution[j]] = [distribution[j], distribution[i]];
    }
    // Dengeli başlangıç adımı tamamlandı.

    // Eğer clusteringFactor 0 ise (Uzman seviye), hiç dokunmadan dengeli/karışık tahtayı döndür.
    if (clusteringFactor <= 0) {
        return distribution;
    }

    // 2. Adım: "Gruplama" işlemi (çekim gücünü uygula).
    // Bu işlem, renklerin komşularına benzeme olasılığını artırır.
    const passes = 2; // Daha pürüzsüz kümeler için işlemi 2 kez tekrarla
    for (let p = 0; p < passes; p++) {
        for (let i = 0; i < totalCells; i++) {
            const x = i % size;
            const y = Math.floor(i / size);
            
            // Komşu renkleri topla
            const neighborColors = [];
            if (x > 0) neighborColors.push(distribution[i - 1]); // Sol
            if (x < size - 1) neighborColors.push(distribution[i + 1]); // Sağ
            if (y > 0) neighborColors.push(distribution[i - size]); // Üst
            if (y < size - 1) neighborColors.push(distribution[i + size]); // Alt

            if (neighborColors.length > 0) {
                // Komşular arasında en baskın olan rengi bul
                const dominantColor = neighborColors.reduce((a, b, idx, arr) =>
                    (arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b), null);
                
                // Belirlenen "çekim gücü" olasılığıyla, mevcut kareyi baskın komşu rengiyle değiştir.
                if (dominantColor && Math.random() < clusteringFactor) {
                    distribution[i] = dominantColor;
                }
            }
        }
    }
    
    // 3. Adım: Tek renk kontrolü - Eğer sadece bir renk varsa yeniden oluştur
    const uniqueColors = [...new Set(distribution)];
    if (uniqueColors.length < numColors && maxAttempts > 0) {
        if (window.IS_DEVELOPMENT) {
            logger.warn(`Single color detected! Regenerating distribution. Found colors: ${uniqueColors.length}/${numColors}, Attempts left: ${maxAttempts}`);
        }
        // Tek renk tespit edildi, algoritmayı yeniden çalıştır
        return generateClusteredDistribution(size, colors, clusteringFactor, maxAttempts - 1);
    } else if (uniqueColors.length < numColors) {
        if (window.IS_DEVELOPMENT) {
            logger.error(`Failed to generate multi-color distribution after ${maxAttempts} attempts. Using fallback.`);
        }
        // Son çare: Manuel olarak en az 2 farklı renk garantisi
        const fallbackDistribution = [...distribution];
        const firstColor = fallbackDistribution[0];
        const secondColor = colors.find(color => color !== firstColor);
        if (secondColor) {
            // İlk hücreyi farklı renge çevir
            fallbackDistribution[0] = secondColor;
        }
        return fallbackDistribution;
    }
    
    return distribution;
}


// ====================================================================================
// GÜNCELLENMİŞ OYUN TAHTASI OLUŞTURMA FONKSİYONU
// ====================================================================================

function generateGameGrid(size) {
    const gameGrid = document.getElementById('gameGrid');
    gameGrid.innerHTML = '';
    gameGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    let cellSize = gameState.zoomLevel;
    if (size >= 10) cellSize = 22;
    if (size >= 20) cellSize = 16;
    gameGrid.style.setProperty('--cell-size', `${cellSize}px`);
    gameGrid.style.gap = size >= 10 ? '1px' : '2px';

    gameState.gameGrid = [];
    gameState.originalColors = [];
    gameState.totalCellsToMatch = size * size;

    // --- YENİ "RENK ÇEKİM GÜCÜ" KONTROLÜ ---
    const numColors = 3;
    const selectedColors = gameColors.slice(0, numColors);
    let colorDistribution;

    const gamesPlayed = gameState.gamecount || 0;
    let clusteringFactor = 0; // Varsayılan: Uzman seviyesi (çekim gücü yok)

    if (gamesPlayed <= 100) {
        clusteringFactor = 0.65; // Kolay Seviye: Güçlü çekim
        if (window.IS_DEVELOPMENT) logger.log(`Difficulty: Easy (Clustering: ${clusteringFactor})`);
    } else if (gamesPlayed <= 200) {
        clusteringFactor = 0.35; // Orta Seviye: Orta çekim
        if (window.IS_DEVELOPMENT) logger.log(`Difficulty: Medium (Clustering: ${clusteringFactor})`);
    } else if (gamesPlayed <= 300) {
        clusteringFactor = 0.15; // Zor Seviye: Zayıf çekim
        if (window.IS_DEVELOPMENT) logger.log(`Difficulty: Hard (Clustering: ${clusteringFactor})`);
    } else {
        if (window.IS_DEVELOPMENT) logger.log(`Difficulty: Expert (Clustering: ${clusteringFactor})`);
    }

    colorDistribution = generateClusteredDistribution(size, selectedColors, clusteringFactor);
    // --- KONTROL SONU ---

    gameState.originalColors = colorDistribution;

    const fragment = document.createDocumentFragment(); // Use DocumentFragment

    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.style.backgroundColor = gameState.originalColors[i];
        cell.dataset.index = i;
        cell.dataset.originalColor = gameState.originalColors[i];
        
        fragment.appendChild(cell); // Append to fragment
        gameState.gameGrid.push({
            originalColor: gameState.originalColors[i],
            currentColor: gameState.originalColors[i],
            isCorrect: false,
            element: cell
        });
    }
    gameGrid.appendChild(fragment); // Append fragment to DOM once

    // Event Delegation for painting using Pointer Events
    gameGrid.addEventListener('pointerdown', handlePaintingStart);
    gameGrid.addEventListener('pointermove', handlePaintingMove);

    // Global listeners for stopping painting
    document.addEventListener('pointerup', handlePaintingEnd);
    document.addEventListener('pointercancel', handlePaintingEnd);
    gameGrid.addEventListener('mouseleave', handlePaintingEnd);


    gameState.gameStarted = false;
    gameState.gameCompleted = false;
    gameState.memoryPhase = true;
    gameState.memoryElapsedTime = 0;
    gameState.matchingElapsedTime = 0;
    gameState.correctMatches = 0;
    gameState.cellsFilledCount = 0;
    gameState.activeColor = null;

    document.getElementById('memoryTimerDisplay').textContent = '0';
    document.getElementById('matchingTimerDisplay').textContent = '0';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = getTranslation('startMatching');
    document.getElementById('gameMessage').textContent = '';
    document.getElementById('colorPalette').innerHTML = '';
    document.getElementById('colorPalette').style.display = 'none';

    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });
    gameState.lastPaintedCellIndex = null;
}

function startGame() {
    if (gameState.gameStarted) return;
    gameState.gameStarted = true;
    gameState.memoryPhase = false;
    cancelAnimationFrame(gameState.memoryTimer);
    document.getElementById('memoryTimerDisplay').textContent = gameState.memoryElapsedTime.toFixed(1);

    gameState.gameGrid.forEach(cell => {
        cell.element.style.backgroundColor = '#333';
        cell.currentColor = '#333';
        cell.isCorrect = false;
        cell.element.classList.remove('correct-feedback');
    });

    document.getElementById('startBtn').disabled = true;
    document.getElementById('startBtn').textContent = getTranslation('matching');
    
    // Hide game message for users who have played 10 or more games
    if (gameState.gamecount && gameState.gamecount >= 10) {
        document.getElementById('gameMessage').textContent = '';
    } else {
        document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageMatchColors');
    }
    startMatchingTimer();
    createColorPalette();
    
    // Auto Solver: Start automatically if activated
    if (window.autoSolver && window.autoSolver.isActive && !window.autoSolver.isProcessing) {
        setTimeout(() => {
            window.autoSolver.start();
        }, 500); // Small delay to let UI settle
    }
}

function startMemoryTimer() {
    gameState.startTime = performance.now();
    if (gameState.memoryTimer) cancelAnimationFrame(gameState.memoryTimer);
    const tick = (ts) => {
        gameState.memoryElapsedTime = (ts - gameState.startTime) / 1000;
        const el = document.getElementById('memoryTimerDisplay');
        if (el) el.textContent = gameState.memoryElapsedTime.toFixed(1);
        gameState.memoryTimer = requestAnimationFrame(tick);
    };
    gameState.memoryTimer = requestAnimationFrame(tick);
}

function startMatchingTimer() {
    gameState.startTime = performance.now();
    if (gameState.matchingTimer) cancelAnimationFrame(gameState.matchingTimer);
    const tick = (ts) => {
        gameState.matchingElapsedTime = (ts - gameState.startTime) / 1000;
        const el = document.getElementById('matchingTimerDisplay');
        if (el) el.textContent = gameState.matchingElapsedTime.toFixed(1);
        gameState.matchingTimer = requestAnimationFrame(tick);
    };
    gameState.matchingTimer = requestAnimationFrame(tick);
}

function resetTimer() {
    if (gameState.memoryTimer) cancelAnimationFrame(gameState.memoryTimer);
    if (gameState.matchingTimer) cancelAnimationFrame(gameState.matchingTimer);
    gameState.memoryTimer = null;
    gameState.matchingTimer = null;
    gameState.memoryElapsedTime = 0;
    gameState.matchingElapsedTime = 0;
    document.getElementById('memoryTimerDisplay').textContent = '0';
    document.getElementById('matchingTimerDisplay').textContent = '0';
}

function paintCell(cell) {
    if (!cell || !cell.dataset.index) return;

    const cellIndex = parseInt(cell.dataset.index);
    const cellState = gameState.gameGrid[cellIndex];

    if (gameState.memoryPhase || gameState.gameCompleted || cellState.isCorrect) return;

    if (gameState.activeColor) {
        if (cellState.currentColor === '#333') {
            gameState.cellsFilledCount++;
        }

        cell.style.backgroundColor = gameState.activeColor;
        cellState.currentColor = gameState.activeColor;
        playSound('click');

        if (cellState.currentColor === cellState.originalColor) {
            cellState.isCorrect = true;
            cell.classList.add('correct-feedback');
            cell.classList.remove('incorrect-feedback');
            gameState.correctMatches++;
        } else {
            cellState.isCorrect = false;
            cell.classList.remove('correct-feedback');
            cell.classList.add('incorrect-feedback');
        }

        if (gameState.cellsFilledCount === gameState.totalCellsToMatch) {
            checkGameCompletion();
        }
    } else {
        if (gameState.gamecount && gameState.gamecount >= 10) {
            document.getElementById('gameMessage').textContent = '';
        } else {
            document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageSelectColorFirst');
        }
    }
}

function setActiveColor(color) {
    gameState.activeColor = color;
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });
    document.querySelector(`.color-swatch[data-color="${color}"]`).classList.add('active');
    if (gameState.gamecount && gameState.gamecount >= 10) {
        document.getElementById('gameMessage').textContent = '';
    } else {
        document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageApplyColor');
    }
}

function createColorPalette() {
    const colorPaletteContainer = document.getElementById('colorPalette');
    colorPaletteContainer.innerHTML = '';
    const fixedPaletteColors = ['#FF0000', '#FFFF00', '#0000FF']; // Red, Yellow, Blue
    gameState.availableColors = fixedPaletteColors; // Store fixed colors in gameState for palette

    fixedPaletteColors.forEach(color => {
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        colorSwatch.style.backgroundColor = color;
        colorSwatch.dataset.color = color;
        colorSwatch.addEventListener('click', () => setActiveColor(color));
        colorPaletteContainer.appendChild(colorSwatch);
    });

    colorPaletteContainer.style.display = 'flex';

    // Automatically select the middle color from the fixed palette
    if (fixedPaletteColors.length > 0) {
        const middleIndex = Math.floor(fixedPaletteColors.length / 2);
        setActiveColor(fixedPaletteColors[middleIndex]);
    }

    // --- START: Swipe Functionality for Color Palette ---
    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50; // Minimum distance for a swipe

    colorPaletteContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    colorPaletteContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        if (!gameState.activeColor) return; // Don't swipe if no color is active

        const currentActiveColorIndex = gameState.availableColors.indexOf(gameState.activeColor);
        if (currentActiveColorIndex === -1) return;

        let nextColorIndex = currentActiveColorIndex;

        // Swipe Left
        if (touchStartX - touchEndX > swipeThreshold) {
            nextColorIndex = (currentActiveColorIndex + 1) % gameState.availableColors.length;
        }
        // Swipe Right
        else if (touchEndX - touchStartX > swipeThreshold) {
            nextColorIndex = (currentActiveColorIndex - 1 + gameState.availableColors.length) % gameState.availableColors.length;
        }

        if (nextColorIndex !== currentActiveColorIndex) {
            setActiveColor(gameState.availableColors[nextColorIndex]);
        }
    }
    // --- END: Swipe Functionality for Color Palette ---
}

async function checkGameCompletion() {
    gameState.gameCompleted = true;
    cancelAnimationFrame(gameState.matchingTimer);

    const score = calculateScore();
    const isWin = gameState.correctMatches === gameState.totalCellsToMatch;

    if (isWin) {
        await saveScore(score);
    }

    setTimeout(() => {
        showGameOverScreen(isWin, score);
    }, 1500);
}

function showGameOverScreen(isWin, score) {
    gameState.lastGameScore = isWin ? score : 0;
    gameState.lastGameMode = `${gameState.currentMode}x${gameState.currentMode}`;
    gameState.lastGameAccuracy = `${gameState.correctMatches} / ${gameState.totalCellsToMatch}`;
    gameState.lastGameTime = `${gameState.matchingElapsedTime.toFixed(1)}s`;

    document.getElementById('gameOverTitle').textContent = isWin ? getTranslation('gameResultWin') : getTranslation('gameResultLose');
    const gameOverTitleElement = document.getElementById('gameOverTitle');

    gameOverTitleElement.classList.remove('win', 'lose');

    if (isWin) {
        gameOverTitleElement.classList.add('win');
        playSound('win', 'mp3');
    } else {
        gameOverTitleElement.classList.add('lose');
        playSound('lose', 'mp3');
    }
    document.getElementById('statMode').textContent = gameState.lastGameMode;
    document.getElementById('statScore').textContent = gameState.lastGameScore;
    document.getElementById('statAccuracy').textContent = gameState.lastGameAccuracy;
    document.getElementById('statTime').textContent = gameState.lastGameTime;
    showScreen('gameOverScreen');

    document.querySelector('[data-action="restartGame"]').onclick = restartGame;
    document.querySelector('[data-action="showLeaderboard"]').onclick = showLeaderboard;
    document.querySelector('[data-action="shareScoreToX"]').onclick = shareScoreToX;
}

function restartGame() {
    selectMode(gameState.currentMode);
}



function calculateScore() {
    const modeSize = gameState.currentMode;
    const maxBaseScore = (modeSize === 2) ? 2 : (modeSize * modeSize);

    const accuracyFactor = (gameState.correctMatches / gameState.totalCellsToMatch);
    const scoreFromAccuracy = maxBaseScore * accuracyFactor;

    const totalTime = gameState.memoryElapsedTime + gameState.matchingElapsedTime;
    const timePenalty = totalTime * modeSize * 0.1;

    let finalScore = Math.round(scoreFromAccuracy - timePenalty);
    
    // Level-based scoring adjustment: Players under level 10 get half points
    if (gameState.level < 10) {
        finalScore = Math.round(finalScore / 2);
        if (window.IS_DEVELOPMENT) {
            logger.debug(`Player level ${gameState.level} < 10, score halved: ${finalScore}`);
        }
    }
    
    return Math.max(finalScore, 0);
}

async function saveScore(score) {
    if (gameState.isGuest) {
        return;
    }
    if (!gameState.isLoggedIn) {
        logger.error("Cannot save score: User not logged in.");
        showNotification(getTranslation('pleaseLoginToSaveScore'), 'info');
        return;
    }
    const clientGameId = `game_${gameState.username}_${Date.now()}`; // Create a unique ID for the game session
    const scoreEntry = {
        score: score,
        mode: `${gameState.currentMode}x${gameState.currentMode}`,
        memoryTime: gameState.memoryElapsedTime,
        matchingTime: gameState.matchingElapsedTime,
        clientGameId: clientGameId // Send the unique ID to the server
    };
    try {
        const response = await apiRequest('/api/scores', 'POST', scoreEntry);
        if (window.IS_DEVELOPMENT) {
            logger.debug('[DEBUG] Score saved successfully. API Response:', response);
        }
        
        // Update gameState and localStorage with the new level from the server
        if (response.newLevel !== undefined) {
            const oldLevel = gameState.level;
            gameState.level = response.newLevel;
            localStorage.setItem('level', response.newLevel);
            updateProfileDisplay(gameState.level); // Update UI elements that show level
            
            // Premium level up animasyonunu tetikle
            if (response.newLevel > oldLevel && response.newLevel <= 10) {
                PremiumLevelUpAnimations.trigger(response.newLevel);
            }
            
            if (window.IS_DEVELOPMENT) {
                logger.debug('[DEBUG] gameState.level updated to:', gameState.level);
            }
        }

        // Trigger score socket update
        if (window.scoreSocketManager && window.scoreSocketManager.socket) {
            console.log('[Game] Emitting scoreSubmitted:', {
                playerId: gameState.playerId,
                score: score,
                mode: `${gameState.currentMode}x${gameState.currentMode}`,
                newLevel: response.newLevel
            });
            
            window.scoreSocketManager.socket.emit('scoreSubmitted', {
                playerId: gameState.playerId,
                score: score,
                mode: `${gameState.currentMode}x${gameState.currentMode}`,
                newLevel: response.newLevel
            });
        } else {
            console.warn('[Game] ScoreSocketManager not available:', {
                manager: !!window.scoreSocketManager,
                socket: !!(window.scoreSocketManager && window.scoreSocketManager.socket)
            });
        }

    } catch (error) {
        logger.error('Failed to save score:', error);
        showNotification(`${getTranslation('failedToSaveScore')} ${error.message}`, 'error');
    }
}

function resetGame() {
    cancelAnimationFrame(gameState.memoryTimer);
    cancelAnimationFrame(gameState.matchingTimer);
    gameState.gameStarted = false;
    gameState.gameCompleted = false;
    gameState.memoryPhase = true;
    gameState.memoryElapsedTime = 0;
    gameState.matchingElapsedTime = 0;
    gameState.gameGrid = [];
    gameState.originalColors = [];
    gameState.correctMatches = 0;
    gameState.totalCellsToMatch = 0;
    gameState.cellsFilledCount = 0;
    gameState.activeColor = null;
    gameState.lastPaintedCellIndex = null;
    document.getElementById('memoryTimerDisplay').textContent = '0';
    document.getElementById('matchingTimerDisplay').textContent = '0';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = getTranslation('startMatching');
    document.getElementById('gameMessage').textContent = '';
    document.getElementById('colorPalette').innerHTML = '';
    document.getElementById('colorPalette').style.display = 'none';
    document.getElementById('gameGrid').innerHTML = '';
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });
    const gameResultOverlayElement = document.getElementById('gameResultOverlay');
    if (gameResultOverlayElement) {
        gameResultOverlayElement.classList.remove('win-active', 'lose-active');
    }
}

function backToMenu() {
    // Restore the game container's scrollbar when leaving the leaderboard or other screens.
    const gameContainer = document.querySelector('#gameModal .game-container');
    if (gameContainer) {
        gameContainer.style.overflowY = 'auto';
    }
    resetGame();
    document.getElementById('chatModal').style.display = 'none'; // Chat modalını kapat
    showScreen('mainMenu');
    
    // Ensure scroll is still disabled for modal
    if (!document.body.classList.contains('no-scroll')) {
        const scrollY = window.scrollY;
        document.body.style.top = `-${scrollY}px`;
        document.body.classList.add('no-scroll');
    }
}

// --- Game Area Control Functions ---

function zoomIn() {
    const gameGrid = document.getElementById('gameGrid');
    let currentSize = parseInt(getComputedStyle(gameGrid).getPropertyValue('--cell-size'));
    let newSize = Math.min(currentSize + 3, 60);
    gameGrid.style.setProperty('--cell-size', `${newSize}px`);
    gameState.zoomLevel = newSize;
    localStorage.setItem('zoomLevel', newSize);
    updateZoomButtonStates();
}

function zoomOut() {
    const gameGrid = document.getElementById('gameGrid');
    let currentSize = parseInt(getComputedStyle(gameGrid).getPropertyValue('--cell-size'));
    let newSize = Math.max(currentSize - 3, 10);
    gameGrid.style.setProperty('--cell-size', `${newSize}px`);
    gameState.zoomLevel = newSize;
    localStorage.setItem('zoomLevel', newSize);
    updateZoomButtonStates();
}

function updateZoomButtonStates() {
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');

    if (gameState.zoomLevel > STANDARD_ZOOM_LEVEL) {
        zoomInBtn.classList.add('active');
        zoomOutBtn.classList.remove('active');
    } else if (gameState.zoomLevel < STANDARD_ZOOM_LEVEL) {
        zoomOutBtn.classList.add('active');
        zoomInBtn.classList.remove('active');
    } else { // At standard zoom level
        zoomInBtn.classList.remove('active');
        zoomOutBtn.classList.remove('active');
    }
}

function toggleSound() {
    gameState.isSoundMuted = !gameState.isSoundMuted;
    localStorage.setItem('isSoundMuted', gameState.isSoundMuted);
    applySoundSetting();
}

function applySoundSetting() {
    // Select all sound toggle buttons
    const toggleSoundBtns = document.querySelectorAll('#toggleSoundBtn');

    toggleSoundBtns.forEach(btn => {
        const soundIcon = btn.querySelector('i');
        if (gameState.isSoundMuted) {
            soundIcon.classList.remove('fa-volume-up');
            soundIcon.classList.add('fa-volume-mute');
            btn.title = "Unmute Sound";
            btn.classList.remove('active'); // White when muted
        } else {
            soundIcon.classList.remove('fa-volume-mute');
            soundIcon.classList.add('fa-volume-up');
            btn.title = "Mute Sound";
            btn.classList.add('active'); // Blue when unmuted
        }
    });
}

function applyStoredSettings() {
    const storedZoomLevel = localStorage.getItem('zoomLevel');
    if (storedZoomLevel) {
        gameState.zoomLevel = parseInt(storedZoomLevel);
        const gameGrid = document.getElementById('gameGrid');
        gameGrid.style.setProperty('--cell-size', `${gameState.zoomLevel}px`);
    } else {
        gameState.zoomLevel = STANDARD_ZOOM_LEVEL; // Set to standard if no stored value
    }
    updateZoomButtonStates(); // Apply initial zoom button states

    const storedSoundMuted = localStorage.getItem('isSoundMuted');
    if (storedSoundMuted !== null) { // Check for null to differentiate from 'false'
        gameState.isSoundMuted = storedSoundMuted === 'true';
    }
    applySoundSetting(); // Apply initial sound setting and button state
}

// Event listeners for the new controls
document.addEventListener('DOMContentLoaded', () => {
    applyStoredSettings();

    // Select all instances of the buttons by their IDs
    const zoomInBtns = document.querySelectorAll('#zoomInBtn');
    const zoomOutBtns = document.querySelectorAll('#zoomOutBtn');
    const resetBoardBtns = document.querySelectorAll('#resetBoardBtn');
    const toggleSoundBtns = document.querySelectorAll('#toggleSoundBtn');

    const stopZoom = () => {
        clearInterval(gameState.zoomInInterval);
        clearInterval(gameState.zoomOutInterval);
        gameState.zoomInInterval = null;
        gameState.zoomOutInterval = null;
    };

    // Attach event listeners to all zoomIn buttons
    zoomInBtns.forEach(btn => {
        btn.addEventListener('mousedown', () => {
            zoomIn();
            gameState.zoomInInterval = setInterval(zoomIn, 100);
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            zoomIn();
            gameState.zoomInInterval = setInterval(zoomIn, 100);
        }, { passive: false });
        btn.addEventListener('mouseup', stopZoom);
        btn.addEventListener('mouseleave', stopZoom);
        btn.addEventListener('touchend', stopZoom);
        btn.addEventListener('touchcancel', stopZoom);
    });

    // Attach event listeners to all zoomOut buttons
    zoomOutBtns.forEach(btn => {
        btn.addEventListener('mousedown', () => {
            zoomOut();
            gameState.zoomOutInterval = setInterval(zoomOut, 100);
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            zoomOut();
            gameState.zoomOutInterval = setInterval(zoomOut, 100);
        }, { passive: false });
        btn.addEventListener('mouseup', stopZoom);
        btn.addEventListener('mouseleave', stopZoom);
        btn.addEventListener('touchend', stopZoom);
        btn.addEventListener('touchcancel', stopZoom);
    });

    // Attach event listeners to all toggleSound buttons
    toggleSoundBtns.forEach(btn => {
        btn.addEventListener('click', toggleSound);
    });

    // Attach event listeners to all resetBoard buttons
    resetBoardBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectMode(gameState.currentMode);
        });
    });

    document.addEventListener('wheel', (event) => {
        // Only allow color change during the matching phase on the actual game screen.
        if (gameState.currentScreen !== 'gameScreen' || !gameState.gameStarted || gameState.memoryPhase || !gameState.activeColor) {
            return; 
        }

        event.preventDefault(); // Prevent page scrolling

        const currentActiveColorIndex = gameState.availableColors.indexOf(gameState.activeColor);
        let nextColorIndex = currentActiveColorIndex;

        if (event.deltaY < 0) {
            // Wheel up, go to previous color
            nextColorIndex = (currentActiveColorIndex - 1 + gameState.availableColors.length) % gameState.availableColors.length;
        } else {
            // Wheel down, go to next color
            nextColorIndex = (currentActiveColorIndex + 1) % gameState.availableColors.length;
        }

                setActiveColor(gameState.availableColors[nextColorIndex]);
    }, { passive: false });

    document.addEventListener('keydown', (event) => {
        // Start game with Spacebar
        if (event.code === 'Space' && !gameState.gameStarted && gameState.memoryPhase) {
            event.preventDefault(); // Prevent default spacebar action (e.g., scrolling)
            startGame();
        }

        // Switch colors with 1, 2, 3 keys
        if (gameState.currentScreen === 'gameScreen' && gameState.gameStarted && !gameState.memoryPhase) {
            const colorMap = {
                'Digit1': 0, // Key '1'
                'Digit2': 1, // Key '2'
                'Digit3': 2  // Key '3'
            };

            const colorIndex = colorMap[event.code];
            if (colorIndex !== undefined && gameState.availableColors && gameState.availableColors[colorIndex]) {
                event.preventDefault(); // Prevent default action for number keys if any
                setActiveColor(gameState.availableColors[colorIndex]);
            }
        }

        // Refresh board with 'R' key
        if (event.code === 'KeyR' && gameState.currentScreen === 'gameScreen') {
            event.preventDefault();
            selectMode(gameState.currentMode);
        }
    });

    // Auto Solver functionality
    setupAutoSolverControls().catch(console.error);
});

// Auto Solver Control Functions
async function setupAutoSolverControls() {
    // Check permission first before setting up any controls
    if (!window.autoSolver) {
        return;
    }
    
    const hasPermission = await window.autoSolver.checkPermission();
    if (!hasPermission) {
        console.log('Auto Solver: No permission, skipping setup');
        return; // Don't set up any controls for users without permission
    }
    
    // Profile logo click handler for Auto Solver (only for authorized users)
    let profileLogo = document.getElementById('profileLogo');
    
    // If not found by ID, try to find by class
    if (!profileLogo) {
        profileLogo = document.querySelector('#gameModal .profile-logo');
        if (profileLogo) {
            profileLogo.id = 'profileLogo';
            console.log('Profile logo found and ID assigned');
        }
    }
    
    if (profileLogo) {
        // Remove existing event listeners to avoid duplicates
        profileLogo.removeEventListener('click', openAutoSolverModal);
        profileLogo.addEventListener('click', openAutoSolverModal);
        profileLogo.style.cursor = 'pointer';
        profileLogo.title = getTranslation('clickToOpenAutoSolver');
        console.log('Auto Solver controls set up for authorized user');
    } else {
        console.log('Profile logo not found for Auto Solver setup');
    }

    // Auto Solver modal controls
    const autoSolverModal = document.getElementById('autoSolverModal');
    const autoSolverStartBtn = document.getElementById('autoSolverStartBtn');
    const autoSolverStopBtn = document.getElementById('autoSolverStopBtn');
    const autoSolverSpeed = document.getElementById('autoSolverSpeed');
    const autoSolverSpeedDisplay = document.getElementById('autoSolverSpeedDisplay');
    const autoSolverCursorBtn = document.getElementById('autoSolverCursorBtn');

    if (autoSolverStartBtn) {
        autoSolverStartBtn.addEventListener('click', startAutoSolver);
    }

    if (autoSolverStopBtn) {
        autoSolverStopBtn.addEventListener('click', stopAutoSolver);
    }

    if (autoSolverSpeed && autoSolverSpeedDisplay) {
        autoSolverSpeed.addEventListener('input', (e) => {
            const newSpeed = e.target.value;
            autoSolverSpeedDisplay.textContent = `${newSpeed}x`;
            if (window.autoSolver) {
                window.autoSolver.speed = parseInt(newSpeed);
            }
        });
    }

    if (autoSolverCursorBtn) {
        autoSolverCursorBtn.addEventListener('click', toggleAutoSolverCursor);
    }

    // Close modal when clicking close button
    if (autoSolverModal) {
        const closeBtn = autoSolverModal.querySelector('.auto-solver-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeAutoSolverModal);
        }
    }
}

async function openAutoSolverModal() {
    console.log('openAutoSolverModal called');
    
    // Double check permission (should already be checked in setupAutoSolverControls)
    if (!window.autoSolver) {
        console.log('Auto Solver not available');
        return;
    }
    
    const hasPermission = await window.autoSolver.checkPermission();
    if (!hasPermission) {
        console.log('Auto Solver: Permission denied, modal not opened');
        return; // Silent return, no notification
    }
    
    const autoSolverModal = document.getElementById('autoSolverModal');
    if (autoSolverModal) {
        autoSolverModal.style.display = 'block';
        updateAutoSolverStatus();
        console.log('Auto Solver modal opened for authorized user');
    } else {
        console.log('Auto Solver modal not found');
    }
}

function closeAutoSolverModal() {
    const autoSolverModal = document.getElementById('autoSolverModal');
    if (autoSolverModal) {
        autoSolverModal.style.display = 'none';
    }
}

async function startAutoSolver() {
    const speed = parseInt(document.getElementById('autoSolverSpeed').value);
    
    if (window.autoSolver) {
        const success = await window.autoSolver.activate(speed);
        if (success) {
            updateAutoSolverStatus();
            updateAutoSolverButtons(true);
            closeAutoSolverModal();
        }
    }
}

async function stopAutoSolver() {
    if (window.autoSolver) {
        await window.autoSolver.stop(true); // Manually stopping
        updateAutoSolverStatus();
        updateAutoSolverButtons(false);
    }
}

function updateAutoSolverStatus() {
    if (!window.autoSolver) return;

    const status = window.autoSolver.getStatus();
    const statusDot = document.getElementById('autoSolverStatusDot');
    const statusText = document.getElementById('autoSolverStatusText');
    const progressFill = document.getElementById('autoSolverProgressFill');
    const progressText = document.getElementById('autoSolverProgress');

    if (statusDot && statusText) {
        if (status.isActive) {
            statusDot.className = 'status-dot active';
            statusText.textContent = getTranslation('statusActive') || 'Status: Active';
        } else {
            statusDot.className = 'status-dot';
            statusText.textContent = getTranslation('statusInactive') || 'Status: Inactive';
        }
    }

    if (progressFill && progressText) {
        progressFill.style.width = `${status.progress}%`;
        progressText.textContent = `${status.currentStep}/${status.totalSteps} (${status.progress}%)`;
    }
}

// Auto Solver progress monitoring
setInterval(() => {
    if (window.autoSolver && window.autoSolver.isActive) {
        updateAutoSolverStatus();
    }
}, 100); // Update every 100ms

function updateAutoSolverButtons(isActive) {
    const startBtn = document.getElementById('autoSolverStartBtn');
    const stopBtn = document.getElementById('autoSolverStopBtn');

    if (startBtn && stopBtn) {
        if (isActive) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
        }
    }
}

function toggleAutoSolverCursor() {
    if (!window.autoSolver) return;
    
    const isEnabled = window.autoSolver.toggleMouseCursor();
    const cursorBtn = document.getElementById('autoSolverCursorBtn');
    
    if (cursorBtn) {
        const icon = cursorBtn.querySelector('i');
        const text = cursorBtn.querySelector('span');
        
        if (isEnabled) {
            cursorBtn.classList.remove('disabled');
            icon.className = 'fas fa-mouse-pointer';
            text.textContent = getTranslation('hideCursor');
        } else {
            cursorBtn.classList.add('disabled');
            icon.className = 'fas fa-eye-slash';
            text.textContent = getTranslation('showCursor');
        }
    }
}