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
                const cellState = gameState.gameGrid[index];
                // When auto-solver is active, add a strict check to only paint valid cells along the swipe path.
                if (window.autoSolver?.isProcessing && window.autoSolver.solveMode === 'swipe') {
                    if (cellState && cellState.currentColor === '#333' && gameState.activeColor && cellState.originalColor.toLowerCase() === gameState.activeColor.toLowerCase()) {
                        paintCell(cellToPaint);
                        paintedAtLeastOneCell = true;
                    }
                } else {
                    // Default behavior for user swipes
                    paintCell(cellToPaint);
                    paintedAtLeastOneCell = true;
                }
            }
        });
        if (paintedAtLeastOneCell) {
            playSound('click');
        }
    } else if (gameState.lastPaintedCellIndex !== currentCellIndex) {
        // This handles the very first move event in a swipe.
        // The main `if` block above will handle subsequent moves.
        const cellState = gameState.gameGrid[currentCellIndex];
        if (window.autoSolver?.isProcessing && window.autoSolver.solveMode === 'swipe') {
            if (cellState && cellState.currentColor === '#333' && gameState.activeColor && cellState.originalColor.toLowerCase() === gameState.activeColor.toLowerCase()) {
                paintCell(currentCellElement);
            }
        } else {
            paintCell(currentCellElement);
        }
    }

    gameState.lastPaintedCellIndex = currentCellIndex;
}

function handlePaintingEnd(e) {
    e.preventDefault();
    gameState.isPainting = false;
    gameState.lastPaintedCellIndex = null;
}


// Helper function to save and load zoom settings
function saveZoomSettings(mode, zoomFactor) {
    try {
        const settings = JSON.parse(localStorage.getItem('gameZoomSettings')) || {};
        settings[mode] = zoomFactor;
        localStorage.setItem('gameZoomSettings', JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save zoom settings:", e);
    }
}

function loadZoomSettings(mode) {
    try {
        const settings = JSON.parse(localStorage.getItem('gameZoomSettings')) || {};
        return settings[mode] || 1.0; // Return 1.0 as default
    } catch (e) {
        console.error("Failed to load zoom settings:", e);
        return 1.0; // Return 1.0 on error
    }
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
    document.body.classList.remove('photo-mode-active'); // Remove photo mode class
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
    gameState.isImageMode = false; // Set mode flag
    const gameGrid = document.getElementById('gameGrid');
    gameGrid.innerHTML = '';
    gameGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gameGrid.classList.remove('lost', 'grid-reset-animation', 'grid-lose-effect'); // Remove animation/lost classes

    // --- New Zoom Logic Integration ---
    if (size >= 90) gameState.baseCellSize = 8;
    else if (size >= 60) gameState.baseCellSize = 12;
    else if (size >= 30) gameState.baseCellSize = 16;
    else if (size >= 10) gameState.baseCellSize = 22;
    else gameState.baseCellSize = 40;
    
    // --- Load Saved Zoom Settings ---
    const savedZoomFactor = loadZoomSettings(size);
    gameState.zoomFactor = savedZoomFactor;
    applyZoom(); // Apply initial or saved size
    // --- End Load Zoom Settings ---
    // --- End New Zoom Logic ---
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
    gameState.mistakeCount = 0; 
    gameState.isResetting = false; // Flag for mistake reset animation

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
    
    if (gameState.isImageMode) {
        createColorPaletteFromImage(gameState.availableColors);
    } else {
        createColorPalette();
    }
    
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
    if (!cell || !cell.dataset.index || gameState.isResetting) return;

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
            // Only add feedback effect if NOT in image mode
            if (!gameState.isImageMode) {
                cell.classList.add('correct-feedback');
            }
            cell.classList.remove('incorrect-feedback');
            gameState.correctMatches++;
        } else {
            cellState.isCorrect = false;
            cell.classList.remove('correct-feedback');
            cell.classList.add('incorrect-feedback');
            
            // --- Fair Play Enhancement: Mistake Counter ---
            gameState.mistakeCount++;
            if (gameState.mistakeCount > 3 && !gameState.isResetting) {
                gameState.isResetting = true;
                const gameGrid = document.getElementById('gameGrid');
                playSound('lose', 'mp3'); // Play lose sound
                if (gameGrid) {
                    gameGrid.classList.add('grid-lose-effect'); // Add red flash effect
                }
                setTimeout(() => {
                    selectMode(gameState.currentMode); // Reset board after 3 seconds
                }, 3000);
            }
            // --- End Fair Play ---
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
    let activeSwatch = null;
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        if (swatch.dataset.color.trim().toLowerCase() === color.toLowerCase()) {
            activeSwatch = swatch;
        }
    });
    if (activeSwatch) {
        activeSwatch.classList.add('active');
    }
    if (gameState.gamecount && gameState.gamecount >= 10) {
        document.getElementById('gameMessage').textContent = '';
    } else {
        document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageApplyColor');
    }
}

function createColorPalette() {
    const colorPaletteContainer = document.getElementById('colorPalette');
    colorPaletteContainer.dataset.lenisPrevent = 'true';
    colorPaletteContainer.classList.remove('image-mode-palette'); // Ensure image-mode styles are removed
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
    // Stop timers
    cancelAnimationFrame(gameState.memoryTimer);
    cancelAnimationFrame(gameState.matchingTimer);
    if (gameState.clipboardMonitor) {
        clearInterval(gameState.clipboardMonitor);
    }

    // Reset game state properties
    gameState.gameStarted = false;
    gameState.gameCompleted = false;
    gameState.memoryPhase = true;
    gameState.isImageMode = false; // <-- FIX: Explicitly reset image mode flag
    gameState.isPreparingPhotoMode = false; // <-- FIX: Explicitly reset photo mode preparation flag
    gameState.memoryElapsedTime = 0;
    gameState.matchingElapsedTime = 0;
    gameState.gameGrid = [];
    gameState.originalColors = [];
    gameState.correctMatches = 0;
    gameState.totalCellsToMatch = 0;
    gameState.cellsFilledCount = 0;
    gameState.activeColor = null;
    gameState.lastPaintedCellIndex = null;
    gameState.mistakeCount = 0;
    gameState.isResetting = false;
    gameState.clipboardMonitor = null;

    // Reset UI elements to their default state
    document.getElementById('memoryTimerDisplay').textContent = '0';
    document.getElementById('matchingTimerDisplay').textContent = '0';
    document.getElementById('gameMessage').textContent = '';
    document.getElementById('gameGrid').innerHTML = '';
    
    // --- FIX: Restore UI for original game mode ---
    document.getElementById('memoryTimerDisplay').style.display = 'inline';
    document.getElementById('matchingTimerDisplay').style.display = 'inline';
    document.querySelector('.game-header-timers').style.visibility = 'visible';
    const startBtn = document.getElementById('startBtn');
    startBtn.style.display = 'block';
    startBtn.disabled = false;
    startBtn.textContent = getTranslation('startMatching');

    // --- FIX: Cleanup Photo Mode specific UI ---
    const photoControls = document.getElementById('photo-mode-controls');
    if (photoControls) {
        photoControls.remove();
    }
    const previewOverlay = document.getElementById('image-preview-overlay');
    if (previewOverlay) {
        previewOverlay.remove();
    }
    document.body.classList.remove('photo-mode-active');


    // Reset color palette
    const colorPalette = document.getElementById('colorPalette');
    colorPalette.innerHTML = '';
    colorPalette.style.display = 'none';
    colorPalette.classList.remove('image-mode-palette');


    // Remove active class from any swatches (though palette is cleared, this is for safety)
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });

    // Hide game over overlay if it was visible
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
    document.body.classList.remove('photo-mode-active'); // Remove photo mode class
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

// New Zoom Logic
const ZOOM_CONTROLS = {
    MIN_ZOOM_FACTOR: 0.2,
    MAX_ZOOM_FACTOR: 5.0,
    FACTOR_STEP: 0.1
};

function applyZoom() {
    const gameGrid = document.getElementById('gameGrid');
    if (!gameGrid) return;

    const newSize = gameState.baseCellSize * gameState.zoomFactor;
    gameGrid.style.setProperty('--cell-size', `${newSize}px`);
    
    // Update button states based on zoom factor
    const zoomInBtns = document.querySelectorAll('#zoomInBtn');
    const zoomOutBtns = document.querySelectorAll('#zoomOutBtn');
    zoomInBtns.forEach(btn => btn.classList.toggle('active', gameState.zoomFactor > 1.0));
    zoomOutBtns.forEach(btn => btn.classList.toggle('active', gameState.zoomFactor < 1.0));

    // --- Button scaling logic removed ---
}

function zoomIn() {
    gameState.zoomFactor = Math.min(gameState.zoomFactor + ZOOM_CONTROLS.FACTOR_STEP, ZOOM_CONTROLS.MAX_ZOOM_FACTOR);
    applyZoom();
}

function zoomOut() {
    gameState.zoomFactor = Math.max(gameState.zoomFactor - ZOOM_CONTROLS.FACTOR_STEP, ZOOM_CONTROLS.MIN_ZOOM_FACTOR);
    applyZoom();
}


function toggleSound() {
    gameState.isSoundMuted = !gameState.isSoundMuted;
    localStorage.setItem('isSoundMuted', gameState.isSoundMuted);
    applySoundSetting();
}

function applySoundSetting() {
    const toggleSoundBtns = document.querySelectorAll('#toggleSoundBtn');
    toggleSoundBtns.forEach(btn => {
        const soundIcon = btn.querySelector('i');
        if (gameState.isSoundMuted) {
            soundIcon.classList.remove('fa-volume-up');
            soundIcon.classList.add('fa-volume-mute');
            btn.title = "Unmute Sound";
            btn.classList.remove('active');
        } else {
            soundIcon.classList.remove('fa-volume-mute');
            soundIcon.classList.add('fa-volume-up');
            btn.title = "Mute Sound";
            btn.classList.add('active');
        }
    });
}

function applyStoredSettings() {
    const storedSoundMuted = localStorage.getItem('isSoundMuted');
    if (storedSoundMuted !== null) {
        gameState.isSoundMuted = storedSoundMuted === 'true';
    }
    applySoundSetting();
}

function initializeGameControls() {
    applyStoredSettings();

    const zoomInBtns = document.querySelectorAll('#zoomInBtn');
    const zoomOutBtns = document.querySelectorAll('#zoomOutBtn');
    const resetBoardBtns = document.querySelectorAll('#resetBoardBtn');
    const toggleSoundBtns = document.querySelectorAll('#toggleSoundBtn');
    const gameGrid = document.getElementById('gameGrid');

    // --- Button Listeners ---
    // --- Enhanced Zoom Logic with Throttled rAF for Photo Mode ---
    let zoomAnimationId = null;
    let lastZoomApplyTime = 0;
    const ZOOM_APPLY_INTERVAL = 50; // Apply zoom updates every 50ms to prevent freezing

    const zoomInRaf = (timestamp) => {
        gameState.zoomFactor = Math.min(gameState.zoomFactor + ZOOM_CONTROLS.FACTOR_STEP, ZOOM_CONTROLS.MAX_ZOOM_FACTOR);
        
        if (timestamp - lastZoomApplyTime > ZOOM_APPLY_INTERVAL) {
            applyZoom();
            lastZoomApplyTime = timestamp;
        }
        
        zoomAnimationId = requestAnimationFrame(zoomInRaf);
    };

    const zoomOutRaf = (timestamp) => {
        gameState.zoomFactor = Math.max(gameState.zoomFactor - ZOOM_CONTROLS.FACTOR_STEP, ZOOM_CONTROLS.MIN_ZOOM_FACTOR);

        if (timestamp - lastZoomApplyTime > ZOOM_APPLY_INTERVAL) {
            applyZoom();
            lastZoomApplyTime = timestamp;
        }

        zoomAnimationId = requestAnimationFrame(zoomOutRaf);
    };

    const startZoomIn = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        
        if (gameState.isImageMode) {
            lastZoomApplyTime = performance.now();
            if (zoomAnimationId) cancelAnimationFrame(zoomAnimationId);
            zoomAnimationId = requestAnimationFrame(zoomInRaf);
        } else {
            zoomIn(); // Initial call for legacy mode
            if (gameState.zoomInInterval) clearInterval(gameState.zoomInInterval);
            gameState.zoomInInterval = setInterval(zoomIn, 100);
        }
    };

    const startZoomOut = (e) => {
        if (e.type === 'touchstart') e.preventDefault();

        if (gameState.isImageMode) {
            lastZoomApplyTime = performance.now();
            if (zoomAnimationId) cancelAnimationFrame(zoomAnimationId);
            zoomAnimationId = requestAnimationFrame(zoomOutRaf);
        } else {
            zoomOut(); // Initial call for legacy mode
            if (gameState.zoomOutInterval) clearInterval(gameState.zoomOutInterval);
            gameState.zoomOutInterval = setInterval(zoomOut, 100);
        }
    };

    const stopZoom = () => {
        // Stop both types of loops
        if (zoomAnimationId) {
            cancelAnimationFrame(zoomAnimationId);
            zoomAnimationId = null;
        }
        if (gameState.zoomInInterval) {
            clearInterval(gameState.zoomInInterval);
            gameState.zoomInInterval = null;
        }
        if (gameState.zoomOutInterval) {
            clearInterval(gameState.zoomOutInterval);
            gameState.zoomOutInterval = null;
        }

        // Apply one final zoom update to ensure the last value is rendered
        applyZoom();

        // Save the final zoom factor when the user stops zooming
        if (gameState.currentMode) {
            const modeKey = gameState.isImageMode ? `photo_${gameState.currentMode}` : `${gameState.currentMode}`;
            saveZoomSettings(modeKey, gameState.zoomFactor);
        }
    };

    zoomInBtns.forEach(btn => {
        btn.addEventListener('mousedown', startZoomIn);
        btn.addEventListener('touchstart', startZoomIn, { passive: false });
    });

    zoomOutBtns.forEach(btn => {
        btn.addEventListener('mousedown', startZoomOut);
        btn.addEventListener('touchstart', startZoomOut, { passive: false });
    });

    [...zoomInBtns, ...zoomOutBtns].forEach(btn => {
        btn.addEventListener('mouseup', stopZoom);
        btn.addEventListener('mouseleave', stopZoom);
        btn.addEventListener('touchend', stopZoom);
        btn.addEventListener('touchcancel', stopZoom);
    });
    
    toggleSoundBtns.forEach(btn => btn.addEventListener('click', toggleSound));

    resetBoardBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameState.isImageMode) {
                setupPhotoModeWithSize(gameState.currentMode);
            } else {
                selectMode(gameState.currentMode);
            }
        });
    });

    const gameScreen = document.getElementById('gameScreen');

    // --- START: Delegated Mouse Wheel Functionality for Color Palette ---
    if (gameScreen) {
        gameScreen.addEventListener('wheel', (e) => {
            // Only allow color switching during the matching phase
            if (gameState.memoryPhase || !gameState.gameStarted) return;

            // Prevent the default scroll behavior
            e.preventDefault();

            if (!gameState.activeColor) return;

            const currentActiveColorIndex = gameState.availableColors.indexOf(gameState.activeColor);
            if (currentActiveColorIndex === -1) return;

            let nextColorIndex = currentActiveColorIndex;
            if (e.deltaY > 0) { // Scroll down
                nextColorIndex = (currentActiveColorIndex + 1) % gameState.availableColors.length;
            } else { // Scroll up
                nextColorIndex = (currentActiveColorIndex - 1 + gameState.availableColors.length) % gameState.availableColors.length;
            }

            if (nextColorIndex !== currentActiveColorIndex) {
                setActiveColor(gameState.availableColors[nextColorIndex]);
            }
        }, { passive: false });
    }
    // --- END: Delegated Mouse Wheel Functionality for Color Palette ---


    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space' && !gameState.gameStarted && gameState.memoryPhase) {
            event.preventDefault();
            startGame();
        }

        if (gameState.currentScreen === 'gameScreen' && gameState.gameStarted && !gameState.memoryPhase) {
            const colorMap = { 'Digit1': 0, 'Digit2': 1, 'Digit3': 2 };
            const colorIndex = colorMap[event.code];
            if (colorIndex !== undefined && gameState.availableColors?.[colorIndex]) {
                event.preventDefault();
                setActiveColor(gameState.availableColors[colorIndex]);
            }
        }

        if (event.code === 'KeyR' && gameState.currentScreen === 'gameScreen') {
            event.preventDefault();
             if (gameState.isImageMode) {
                setupPhotoModeWithSize(gameState.currentMode);
            } else {
                selectMode(gameState.currentMode);
            }
        }
    });

    // Auto Solver functionality
    setupAutoSolverControls().catch(console.error);
}

// Initialize all controls once the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeGameControls);

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

    // Add listeners for the new solve mode buttons
    const solverModeClickBtn = document.getElementById('solverModeClick');
    const solverModeSwipeBtn = document.getElementById('solverModeSwipe');

    if (solverModeClickBtn && solverModeSwipeBtn && window.autoSolver) {
        solverModeClickBtn.addEventListener('click', () => {
            window.autoSolver.setSolveMode('click');
        });
        solverModeSwipeBtn.addEventListener('click', () => {
            window.autoSolver.setSolveMode('swipe');
        });
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
        
        // Ensure the correct solve mode button is active when opening the modal
        if (window.autoSolver && typeof window.autoSolver.setSolveMode === 'function') {
            window.autoSolver.setSolveMode(window.autoSolver.solveMode);
        }

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

function createColorPaletteFromImage(palette) {
    const colorPaletteContainer = document.getElementById('colorPalette');
    colorPaletteContainer.dataset.lenisPrevent = 'true';
    colorPaletteContainer.classList.add('image-mode-palette'); // Add class for specific styling
    colorPaletteContainer.innerHTML = '';
    gameState.availableColors = palette;

    palette.forEach(color => {
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        colorSwatch.style.backgroundColor = color;
        colorSwatch.dataset.color = color;
        colorSwatch.addEventListener('click', () => setActiveColor(color));
        colorPaletteContainer.appendChild(colorSwatch);
    });

    colorPaletteContainer.style.display = 'flex';

    if (palette.length > 0) {
        setActiveColor(palette[0]);
    }

    // Add swipe functionality for the new palette
    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50;

    colorPaletteContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    colorPaletteContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        if (!gameState.activeColor) return;
        const currentActiveColorIndex = gameState.availableColors.indexOf(gameState.activeColor);
        if (currentActiveColorIndex === -1) return;

        let nextColorIndex = currentActiveColorIndex;
        if (touchStartX - touchEndX > swipeThreshold) {
            nextColorIndex = (currentActiveColorIndex + 1) % gameState.availableColors.length;
        } else if (touchEndX - touchStartX > swipeThreshold) {
            nextColorIndex = (currentActiveColorIndex - 1 + gameState.availableColors.length) % gameState.availableColors.length;
        }

        if (nextColorIndex !== currentActiveColorIndex) {
            setActiveColor(gameState.availableColors[nextColorIndex]);
        }
    }
}


function generateGameGridFromImage(size, pixelColors, colorPalette) {
    gameState.currentMode = size;
    gameState.isImageMode = true; // Set mode flag
    const gameGrid = document.getElementById('gameGrid');
    gameGrid.innerHTML = '';
    gameGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gameGrid.classList.remove('lost', 'grid-reset-animation', 'grid-lose-effect');

    // --- New Zoom Logic Integration ---
    if (size >= 90) gameState.baseCellSize = 8;
    else if (size >= 60) gameState.baseCellSize = 12;
    else if (size >= 30) gameState.baseCellSize = 16;
    else if (size >= 10) gameState.baseCellSize = 22;
    else gameState.baseCellSize = 40;

    // --- Load Saved Zoom Settings for Photo Mode ---
    const modeKey = `photo_${size}`;
    const savedZoomFactor = loadZoomSettings(modeKey);
    gameState.zoomFactor = savedZoomFactor;
    applyZoom(); // Apply initial or saved size
    // --- End New Zoom Logic ---

    gameGrid.style.gap = size >= 10 ? '1px' : '2px';

    gameState.gameGrid = [];
    gameState.originalColors = pixelColors;
    gameState.totalCellsToMatch = size * size;

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.style.backgroundColor = gameState.originalColors[i];
        cell.dataset.index = i;
        cell.dataset.originalColor = gameState.originalColors[i];
        
        fragment.appendChild(cell);
        gameState.gameGrid.push({
            originalColor: gameState.originalColors[i],
            currentColor: gameState.originalColors[i],
            isCorrect: false,
            element: cell
        });
    }
    gameGrid.appendChild(fragment);

    gameGrid.addEventListener('pointerdown', handlePaintingStart);
    gameGrid.addEventListener('pointermove', handlePaintingMove);
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
    gameState.mistakeCount = 0; 
    gameState.isResetting = false;

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

    gameState.availableColors = colorPalette;

    showScreen('gameScreen');
    resetTimer();
    startMemoryTimer();
}

async function generateEmptyGrid(size) {
    return new Promise(resolve => {
        gameState.isImageMode = true; // Set mode flag for photo mode
        const gameGrid = document.getElementById('gameGrid');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        // Show loading overlay
        if (loadingOverlay) {
            loadingOverlay.classList.add('show');
        }

        gameGrid.innerHTML = '';
        gameGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        gameGrid.classList.remove('lost', 'grid-reset-animation', 'grid-lose-effect');

        // --- New Zoom Logic Integration ---
        if (size >= 90) gameState.baseCellSize = 8;
        else if (size >= 60) gameState.baseCellSize = 12;
        else if (size >= 30) gameState.baseCellSize = 16;
        else if (size >= 10) gameState.baseCellSize = 22;
        else gameState.baseCellSize = 40;
        
        // --- Load Saved Zoom Settings for Photo Mode ---
        const modeKey = `photo_${size}`;
        const savedZoomFactor = loadZoomSettings(modeKey);
        gameState.zoomFactor = savedZoomFactor;
        applyZoom(); // Apply initial or saved size
        // --- End New Zoom Logic ---
        gameGrid.style.gap = size >= 10 ? '1px' : '2px';

        gameState.gameGrid = [];
        gameState.originalColors = []; // No original colors yet
        gameState.totalCellsToMatch = size * size;

        const fragment = document.createDocumentFragment();
        const totalCells = size * size;
        const chunkSize = 500; // Process 500 cells per frame
        let i = 0;

        function generateChunk() {
            const limit = Math.min(i + chunkSize, totalCells);
            for (; i < limit; i++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.style.backgroundColor = '#333'; // Empty cell color
                cell.dataset.index = i;
                
                fragment.appendChild(cell);
            }

            if (i < totalCells) {
                requestAnimationFrame(generateChunk);
            } else {
                gameGrid.appendChild(fragment);
                
                const cells = gameGrid.querySelectorAll('.grid-cell');
                cells.forEach(cell => {
                    gameState.gameGrid.push({
                        originalColor: null,
                        currentColor: '#333',
                        isCorrect: false,
                        element: cell
                    });
                });

                gameState.gameStarted = false;
                gameState.gameCompleted = false;
                gameState.memoryPhase = false;
                gameState.isPreparingPhotoMode = true;

                document.getElementById('memoryTimerDisplay').style.display = 'none';
                document.getElementById('matchingTimerDisplay').style.display = 'none';
                document.getElementById('startBtn').style.display = 'none';
                document.getElementById('colorPalette').style.display = 'none';
                document.querySelector('.game-header-timers').style.visibility = 'hidden';
                
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('show');
                }
                resolve();
            }
        }

        generateChunk();
    });
}

function setupPhotoMode() {
    // Default to 30x30 grid
    setupPhotoModeWithSize(30);
}

async function setupPhotoModeWithSize(size) {
    gameState.currentMode = size;
    gameState.isImageMode = true;
    document.body.classList.add('photo-mode-active');

    showScreen('gameScreen');
    await generateEmptyGrid(size);


    const gameArea = document.querySelector('.game-area');

    // Remove existing controls if they are there
    const existingControls = document.getElementById('photo-mode-controls');
    if (existingControls) existingControls.remove();
    const existingPreview = document.getElementById('image-preview-overlay');
    if (existingPreview) existingPreview.remove();

    // Create a dedicated container for the photo mode buttons
    const photoControlsContainer = document.createElement('div');
    photoControlsContainer.id = 'photo-mode-controls';

    // Add "Select Photo" button
    const selectPhotoButton = document.createElement('button');
    selectPhotoButton.id = 'select-photo-btn';
    selectPhotoButton.className = 'btn btn-primary photo-mode-btn';
    selectPhotoButton.innerHTML = '<i class="fas fa-upload"></i> ' + getTranslation('selectPhoto');
    selectPhotoButton.addEventListener('click', () => {
        document.getElementById('image-upload-input').click();
    });
    photoControlsContainer.appendChild(selectPhotoButton);

    // Add "Apply Photo" button (initially hidden)
    const applyPhotoButton = document.createElement('button');
    applyPhotoButton.id = 'apply-photo-btn';
    applyPhotoButton.className = 'btn btn-success photo-mode-btn';
    applyPhotoButton.innerHTML = '<i class="fas fa-magic"></i> ' + getTranslation('applyPhoto');
    applyPhotoButton.style.display = 'none';
    applyPhotoButton.addEventListener('click', animatePhotoToGrid);
    photoControlsContainer.appendChild(applyPhotoButton);

    gameArea.appendChild(photoControlsContainer);
}
window.setupPhotoModeWithSize = setupPhotoModeWithSize;

function animatePhotoToGrid() {
    const preview = document.getElementById('image-preview-overlay');
    if (!preview) return;

    // Hide button and start the process
    document.getElementById('apply-photo-btn').style.display = 'none';

    // --- FIX: Start fading out the preview image immediately ---
    preview.style.opacity = '0';

    // --- MOVED LOGIC: Process the image to get colors ---
    const size = gameState.currentMode;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(preview, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size).data;
    const newOriginalColors = [];
    const colorPalette = new Set();

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        newOriginalColors.push(hexColor);
        colorPalette.add(hexColor);
    }

    gameState.originalColors = newOriginalColors;
    gameState.availableColors = Array.from(colorPalette); // Set the palette for the game

    // Add transition effect to cells
    const gameGrid = document.getElementById('gameGrid');
    gameGrid.classList.add('photo-apply-animation');

    // Animate color filling with requestAnimationFrame for smooth performance
    let currentIndex = 0;
    const totalCells = gameState.gameGrid.length;
    // On each frame, process a chunk of cells. Adjust chunkSize to balance speed and smoothness.
    // A larger chunk size means a faster but potentially less smooth animation.
    const chunkSize = Math.min(500, Math.ceil(totalCells / 30)); // Process enough cells to finish in ~30 frames, but no more than 500 per frame.

    function animate() {
        const cellsToProcess = Math.min(chunkSize, totalCells - currentIndex);
        for (let i = 0; i < cellsToProcess; i++) {
            const cell = gameState.gameGrid[currentIndex];
            const color = gameState.originalColors[currentIndex];
            
            if (cell && color) {
                cell.originalColor = color;
                cell.element.dataset.originalColor = color;
                cell.element.style.backgroundColor = color;
            }
            currentIndex++;
        }

        if (currentIndex < totalCells) {
            requestAnimationFrame(animate);
        } else {
            // Animation finished, clean up and transition to game flow
            if(preview) preview.remove();
            gameGrid.classList.remove('photo-apply-animation');

            // Reset the game state for the actual game start
            gameState.isImageMode = true;
            gameState.isPreparingPhotoMode = false;
            gameState.gameStarted = false;
            gameState.gameCompleted = false;
            gameState.memoryPhase = true;
            gameState.memoryElapsedTime = 0;
            gameState.matchingElapsedTime = 0;
            gameState.correctMatches = 0;
            gameState.cellsFilledCount = 0;
            gameState.activeColor = null;
            gameState.mistakeCount = 0;
            gameState.isResetting = false;

            // Show and reset UI elements for the game
            document.getElementById('memoryTimerDisplay').style.display = 'inline';
            document.getElementById('matchingTimerDisplay').style.display = 'inline';
            document.querySelector('.game-header-timers').style.visibility = 'visible';
            
            const startBtn = document.getElementById('startBtn');
            startBtn.style.display = 'block';
            startBtn.disabled = false;
            startBtn.textContent = getTranslation('startMatching');
            
            document.getElementById('gameMessage').textContent = '';
            document.getElementById('colorPalette').innerHTML = '';
            document.getElementById('colorPalette').style.display = 'none';

            resetTimer();
            startMemoryTimer();
        }
    }

    // Start the animation
    requestAnimationFrame(animate);
}