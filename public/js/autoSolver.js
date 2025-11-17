/**
 * Auto Solver for Cipher Game
 * Professional automatic puzzle solving system with human-like behavior
 */

class AutoSolver {
    constructor() {
        this.isActive = false;
        this.speed = 1; // 1x to 10x speed
        this.currentStep = 0;
        this.totalSteps = 0;
        this.solutionPath = [];
        this.isProcessing = false;
        this.userCursorPosition = { x: 0, y: 0 }; // Track user's cursor
        this.solveMode = 'click'; // 'click' or 'swipe'

        // Human-like behavior settings
        this.humanDelaySettings = {
            min: 200, // milliseconds
            max: 500,
            base: 300
        };

        // Mouse simulation settings
        this.mouseSettings = {
            moveSpeed: 0.1, // seconds for mouse movement (previously 0.5)
            clickDelay: 50, // milliseconds between mouse down and up
            microShake: 2 // pixels of micro movement
        };

        // Mouse cursor visibility setting
        this.showMouseCursor = true; // Default: show cursor
        this.originalCursor = null; // Store original cursor
        this.isCursorHidden = false; // Track cursor state

        this.cursorPosition = { x: 0, y: 0 };

        this.initializeCursorTracker(); // Initialize cursor tracking
    }

    /**
     * Set the solving mode ('click' or 'swipe')
     */
    setSolveMode(mode) {
        if (mode !== 'click' && mode !== 'swipe') {
            console.error(`Invalid solve mode: ${mode}`);
            return;
        }
        this.solveMode = mode;
        console.log(`Auto Solver: Mode set to ${mode}`);

        // Update button visuals
        document.getElementById('solverModeClick').classList.toggle('active', mode === 'click');
        document.getElementById('solverModeSwipe').classList.toggle('active', mode === 'swipe');
    }


    /**
     * Initialize cursor position tracker
     */
    initializeCursorTracker() {
        document.addEventListener('mousemove', (e) => {
            this.userCursorPosition = { x: e.clientX, y: e.clientY };
        });
    }

    /**
     * Check if user has auto solver permission
     */
    async checkPermission() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return false;

            const response = await fetch('/api/profile/auto-solver-permission', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Auto solver permission check result:', data.autoSolverPermission);
                return data.autoSolverPermission === true;
            }
            return false;
        } catch (error) {
            console.error('Failed to check auto solver permission:', error);
            return false;
        }
    }

    /**
     * Activate auto solver (ready to start when game begins)
     */
    async activate(speed = 1) {
        if (this.isActive || this.isProcessing) return false;

        // Check permission
        const hasPermission = await this.checkPermission();
        if (!hasPermission) {
            showNotification('Auto solver permission required. Contact admin.', 'error');
            return false;
        }

        this.speed = Math.max(1, Math.min(100, speed)); // Limit speed to 1x-100x
        this.isActive = true;
        this.isProcessing = false; // Will start when game begins

        showNotification('Auto solver activated! It will start automatically when you click "Start Matching".', 'success');
        return true;
    }

    /**
     * Start the auto solver (called automatically when game starts)
     */
    async start() {
        if (!this.isActive || this.isProcessing) return false;

        // Security check: Re-verify permission right before starting
        const hasPermission = await this.checkPermission();
        if (!hasPermission) {
            showNotification('Auto solver permission has been revoked.', 'error');
            await this.stop(true); // Stop and reset state, this is a manual-like stop
            updateAutoSolverButtons(false); // Update UI
            return false;
        }

        // Check if game is in matching phase
        if (!gameState.gameStarted || gameState.memoryPhase || gameState.gameCompleted) {
            return false;
        }

        // Check if game grid exists
        if (!gameState.gameGrid || gameState.gameGrid.length === 0) {
            return false;
        }

        // Check if original colors exist
        if (!gameState.originalColors || gameState.originalColors.length === 0) {
            return false;
        }

        this.isProcessing = true;

        // Disable user interaction with the palette while solver is running
        const colorPalette = document.getElementById('colorPalette');
        if (colorPalette) {
            colorPalette.style.pointerEvents = 'none';
        }

        // Show custom cursor at user's current mouse position
        if (this.showMouseCursor) {
            this.showMouseCursorAt(this.userCursorPosition.x, this.userCursorPosition.y);
        }

        // Hide original cursor
        this.hideOriginalCursor();

        try {
            // Analyze the puzzle and create solution path
            await this.analyzePuzzle();

            // Check if there are cells to paint
            if (this.solutionPath.length === 0) {
                showNotification('Puzzle is already solved!', 'info');
                await this.stop(false); // Gracefully stop
                return false;
            }

            // Start solving
            await this.executeSolution();

            return true;
        } catch (error) {
            console.error('Auto solver error:', error);
            showNotification(`Auto solver encountered an error: ${error.message}`, 'error');
            await this.stop(false); // Gracefully stop on error
            return false;
        }
    }

    /**
     * Stop the auto solver
     */
    async stop(manual = false) {
        const wasProcessing = this.isProcessing;

        this.isProcessing = false;
        if (manual) {
            this.isActive = false;
        }

        // If it wasn't processing, there's no cursor/state cleanup to do.
        if (!wasProcessing) {
            return;
        }

        // Re-enable user interaction with the palette
        const colorPalette = document.getElementById('colorPalette');
        if (colorPalette) {
            colorPalette.style.pointerEvents = 'auto';
        }

        // --- Cleanup logic for a run that was in progress ---

        // Move cursor back to the user's current mouse position before hiding.
        if (this.showMouseCursor) {
            const cursorEl = document.getElementById('auto-solver-cursor');
            if (cursorEl && cursorEl.style.opacity !== '0') {
                // Check if we have a valid mouse position (not the default 0,0)
                const hasValidPosition = this.userCursorPosition.x !== 0 || this.userCursorPosition.y !== 0;
                
                if (hasValidPosition) {
                    const returnDuration = 250; // A pleasant quarter-second duration
                    await this.simulateMouseMovement(this.userCursorPosition.x, this.userCursorPosition.y, returnDuration);
                    await this.delay(50); // Add a brief pause after moving and before fading.
                }
                
                // After movement (or if no movement was needed), fade out the cursor.
                await this.hideMouseCursor();
            }
        }

        // Reset properties for the next potential run.
        this.currentStep = 0;
        this.totalSteps = 0;
        this.solutionPath = [];

        // Restore the original system cursor only after the fake one has faded out.
        this.restoreOriginalCursor();
    }


    /**
     * Analyze the puzzle and create optimal solution path
     */
    async analyzePuzzle() {
        // In photo mode, the available color palette can sometimes be out of sync.
        // To ensure the solver has access to every color it needs, we regenerate the 
        // available colors list and the palette UI directly from the grid's original colors.
        if (gameState.isImageMode) {
            console.log('Auto Solver: Synchronizing color palette for photo mode.');
            const allColorsOnGrid = new Set(gameState.originalColors);
            gameState.availableColors = Array.from(allColorsOnGrid);
            
            if (typeof createColorPaletteFromImage === 'function') {
                createColorPaletteFromImage(gameState.availableColors);
            } else {
                console.error('createColorPaletteFromImage function is not available to the solver.');
            }
        }

        const gridSize = gameState.currentMode;
        const originalColors = gameState.originalColors;

        // Create color frequency map
        const colorFrequency = {};
        originalColors.forEach(color => {
            colorFrequency[color] = (colorFrequency[color] || 0) + 1;
        });

        // Sort colors by frequency (most common first)
        const sortedColors = Object.entries(colorFrequency)
            .sort(([,a], [,b]) => b - a)
            .map(([color]) => color);

        // Create solution path using intelligent strategy
        this.solutionPath = [];

        // Strategy: Paint cells by color groups with intelligent ordering
        for (const color of sortedColors) {
            const cellsOfThisColor = [];

            for (let i = 0; i < originalColors.length; i++) {
                if (originalColors[i] === color && gameState.gameGrid[i].currentColor !== color) {
                    cellsOfThisColor.push({
                        cellIndex: i,
                        targetColor: color,
                        priority: this.calculatePriority(i, color, sortedColors, gridSize)
                    });
                }
            }

            // Sort cells of this color by priority (clusters first, then edges)
            cellsOfThisColor.sort((a, b) => b.priority - a.priority);

            // Add to solution path
            this.solutionPath.push(...cellsOfThisColor);
        }

        // Optimize solution path: minimize color switches
        this.optimizeSolutionPath();

        this.totalSteps = this.solutionPath.length;

        console.log(`Auto solver: Analyzed puzzle, ${this.totalSteps} cells to paint across ${sortedColors.length} colors`);
    }

    /**
     * Optimize solution path to minimize color switches
     */
    optimizeSolutionPath() {
        // This function is intentionally left empty.
        // The solution path is already generated in a color-grouped and priority-sorted order
        // by the analyzePuzzle function, which is optimal for the swipe mode.
        // Previous implementations were redundant and introduced bugs.
        return;
    }

    /**
     * Calculate priority for painting order
     */
    calculatePriority(cellIndex, color, sortedColors, gridSize) {
        let priority = 0;

        // Higher priority for more common colors
        const colorRank = sortedColors.indexOf(color);
        priority += (sortedColors.length - colorRank) * 10;

        // Higher priority for cells that form clusters
        const neighbors = this.getNeighborColors(cellIndex, gridSize);
        const sameColorNeighbors = neighbors.filter(c => c === color).length;
        priority += sameColorNeighbors * 5;

        // Lower priority for edge cells (paint interior first)
        const isEdge = this.isEdgeCell(cellIndex, gridSize);
        if (!isEdge) priority += 3;

        return priority;
    }

    /**
     * Get colors of neighboring cells
     */
    getNeighborColors(cellIndex, gridSize) {
        const x = cellIndex % gridSize;
        const y = Math.floor(cellIndex / gridSize);
        const neighbors = [];

        // Check all 4 directions
        const directions = [
            [-1, 0], [1, 0], [0, -1], [0, 1] // left, right, up, down
        ];

        directions.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                const neighborIndex = ny * gridSize + nx;
                neighbors.push(gameState.originalColors[neighborIndex]);
            }
        });

        return neighbors;
    }

    /**
     * Check if cell is on the edge of the grid
     */
    isEdgeCell(cellIndex, gridSize) {
        const x = cellIndex % gridSize;
        const y = Math.floor(cellIndex / gridSize);
        return x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1;
    }

    /**
     * Execute the solution based on the selected solve mode.
     */
    async executeSolution() {
        if (this.solveMode === 'swipe') {
            return this.executeSwipeSolution();
        }
        return this.executeClickSolution();
    }

    /**
     * Execute the solution with 'click' mode.
     */
    async executeClickSolution() {
        let lastColor = null;

        for (let i = 0; i < this.solutionPath.length; i++) {
            if (!this.isActive) break;

            const step = this.solutionPath[i];
            this.currentStep = i + 1;

            // Update progress every few steps
            if (i % 5 === 0 || i === this.solutionPath.length - 1) {
                this.updateProgress();
            }

            // Select color if needed (only when color changes)
            if (lastColor !== step.targetColor) {
                console.log(`Auto Solver: Switching from ${lastColor} to ${step.targetColor}`);
                await this.selectColorIfNeeded(step.targetColor);
                lastColor = step.targetColor;

                // Extra delay when switching colors (human-like)
                const colorSwitchDelay = 150 / this.speed;
                await this.delay(colorSwitchDelay);

                // Verify color switch was successful
                if (gameState.activeColor !== step.targetColor) {
                    console.log(`Warning: Color switch failed. Expected: ${step.targetColor}, Got: ${gameState.activeColor}`);
                    // Try one more time
                    await this.selectColorIfNeeded(step.targetColor);
                    await this.delay(100 / this.speed);
                }
            }

            // Move mouse to cell and click
            await this.paintCell(step.cellIndex);

            // Human-like delay (variable based on grid size)
            await this.humanDelay();
        }

        if (this.isActive) {
            this.updateProgress(); // Final progress update
            console.log('Auto solver (click mode) completed successfully');
            await this.stop(false); // Gracefully stop
        }
    }

    /**
     * Execute the solution with 'swipe' mode.
     */
    async executeSwipeSolution() {
        let lastColor = null;
        let currentPathSegment = [];

        // The solution path is already optimized by analyzePuzzle.

        for (let i = 0; i < this.solutionPath.length; i++) {
            if (!this.isActive) break;
            
            const step = this.solutionPath[i];

            // If color changes, process the previous segment
            if (lastColor !== step.targetColor && currentPathSegment.length > 0) {
                await this.paintSegment(currentPathSegment, lastColor);
                currentPathSegment = []; // Reset for the new color
            }
            
            // Switch color if needed
            if (lastColor !== step.targetColor) {
                await this.selectColorIfNeeded(step.targetColor);
                lastColor = step.targetColor;
                await this.delay(150 / this.speed);
            }

            currentPathSegment.push(step.cellIndex);
        }
        
        // Process the very last segment after the loop finishes
        if (this.isActive && currentPathSegment.length > 0) {
            await this.paintSegment(currentPathSegment, lastColor);
        }

        if (this.isActive) {
            this.updateProgress(); // Final progress update
            console.log('Auto solver (swipe mode) completed successfully');
            await this.stop(false); // Gracefully stop
        }
    }

    /**
     * Helper to paint a segment of cells with the same color using swipe motion.
     */
    async paintSegment(segment, color) {
        if (segment.length === 0 || !this.isActive) return;

        const firstCell = gameState.gameGrid[segment[0]].element;
        if (!firstCell) return;

        // 1. Pointer Down on the first cell
        await this.moveMouseToElement(firstCell);
        const firstCellRect = firstCell.getBoundingClientRect();
        const downEvent = new PointerEvent('pointerdown', { 
            clientX: firstCellRect.left + 1, 
            clientY: firstCellRect.top + 1, 
            bubbles: true, 
            pointerType: 'mouse',
            isPrimary: true
        });
        firstCell.dispatchEvent(downEvent);
        await this.delay(20 / this.speed);

        // 2. Pointer Move across all cells in the segment
        for (let i = 0; i < segment.length; i++) {
            if (!this.isActive) break;
            const cellIndex = segment[i];
            const cellState = gameState.gameGrid[cellIndex]; // Get cellState
            const cell = cellState.element; // Get the element from cellState
            if (!cell) continue;

            const shouldPaint = cellState.currentColor === '#333' && cellState.originalColor === color;

            // Move mouse to element. Only dispatch move events if the cell should be painted.
            await this.moveMouseToElement(cell, shouldPaint);

            if (shouldPaint) {
                // This cell should be painted. Update progress and delay.
                this.currentStep++;
                if (i % 10 === 0) this.updateProgress();
                await this.delay(5 / this.speed); // Fast delay between moves
            } else {
                // This cell should not be painted. Just a short delay for the cursor movement.
                await this.delay(2 / this.speed); // Shorter delay for non-painting moves
            }
        }

        if (!this.isActive) return;

        // 3. Pointer Up on the last cell
        const lastCell = gameState.gameGrid[segment[segment.length - 1]].element;
        const lastCellRect = lastCell.getBoundingClientRect();
        const upEvent = new PointerEvent('pointerup', { 
            clientX: lastCellRect.left + 1, 
            clientY: lastCellRect.top + 1, 
            bubbles: true, 
            pointerType: 'mouse',
            isPrimary: true
        });
        // The game's 'pointerup' listener is on the document, so dispatch globally.
        document.dispatchEvent(upEvent);
    }

    /**
     * Select color if not already active
     */
    async selectColorIfNeeded(targetColor) {
        // Find the target swatch first.
        let colorSwatch = null;
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            if (swatch.dataset.color.trim().toLowerCase() === targetColor.trim().toLowerCase()) {
                colorSwatch = swatch;
            }
        });
        if (!colorSwatch) {
            console.log(`Color swatch not found for ${targetColor}`);
            return;
        }

        // --- MOVED: Scrolling Logic for Photo Mode ---
        // Always scroll the target color into view when the solver is working with it.
        const colorPalette = document.getElementById('colorPalette');
        if (gameState.isImageMode && colorPalette && colorPalette.classList.contains('image-mode-palette')) {
            colorSwatch.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
            // Wait a bit for the scroll animation to happen before proceeding
            await this.delay(300 / this.speed); 
        }
        // --- END: MOVED LOGIC ---

        // Now, check if we actually need to change the active color.
        if (gameState.activeColor === targetColor) {
            console.log(`Color ${targetColor} already active`);
            return; // No need to re-select, but we still scrolled to it.
        }

        console.log(`Auto Solver: Switching to color ${targetColor}`);

        // Method 1: Try direct function call first (more reliable)
        if (typeof setActiveColor === 'function') {
            setActiveColor(targetColor);
            console.log(`Used setActiveColor function for ${targetColor}`);
            await this.delay(50 / this.speed); // Scaled delay
            return;
        }

        // Method 2: Mouse simulation (fallback)
        await this.moveMouseToElement(colorSwatch);
        await this.clickElement(colorSwatch);

        // Wait for color to be selected and verify
        await this.delay(100 / this.speed);

        // Verify color was selected
        if (gameState.activeColor === targetColor) {
            console.log(`Successfully switched to color ${targetColor}`);
        } else {
            console.log(`Failed to switch to color ${targetColor}, current: ${gameState.activeColor}`);
            // Try clicking again
            await this.clickElement(colorSwatch);
            await this.delay(50 / this.speed);
        }
    }

    /**
     * Paint a specific cell
     */
    async paintCell(cellIndex) {
        const cell = gameState.gameGrid[cellIndex].element;
        if (!cell) return;

        // Add visual feedback for auto solver
        cell.classList.add('auto-solver-highlight');

        // Move mouse to cell
        await this.moveMouseToElement(cell);

        // Click to paint
        await this.clickElement(cell);

        // Remove visual feedback after a short delay
        setTimeout(() => {
            cell.classList.remove('auto-solver-highlight');
        }, 200);
    }

    /**
     * Move mouse to element with human-like behavior
     */
    async moveMouseToElement(element, dispatchMoveEvent = true) {
        const rect = element.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        // The simulation function now handles showing and moving the cursor
        await this.simulateMouseMovement(targetX, targetY, undefined, dispatchMoveEvent);
    }

    /**
     * Simulate natural mouse movement using linear interpolation for a straight path
     */
    async simulateMouseMovement(targetX, targetY, overrideDuration, dispatchMoveEvent = true) {
        const baseSteps = 30; // A fixed number of steps for consistent smoothness
        const duration = overrideDuration || (this.mouseSettings.moveSpeed * 1000) / this.speed;
        const delayPerStep = duration / baseSteps;

        const startX = this.cursorPosition.x;
        const startY = this.cursorPosition.y;

        const cursorEl = document.getElementById('auto-solver-cursor');
        if (!cursorEl) {
            console.error("simulateMouseMovement called but cursor element does not exist.");
            return;
        }

        for (let i = 0; i <= baseSteps; i++) {
            const t = i / baseSteps;
            const x = startX + (targetX - startX) * t;
            const y = startY + (targetY - startY) * t;

            this.updateCursorPosition(x, y);

            if (dispatchMoveEvent) {
                const moveEvent = new PointerEvent('pointermove', { 
                    clientX: x, 
                    clientY: y, 
                    bubbles: true, 
                    pointerType: 'mouse',
                    isPrimary: true
                });
                const elementUnderCursor = document.elementFromPoint(x, y);
                (elementUnderCursor || document).dispatchEvent(moveEvent);
            }

            await this.delay(delayPerStep);
        }

        this.updateCursorPosition(targetX, targetY);
    }


    /**
     * Show mouse cursor at specific position
     */
    showMouseCursorAt(x, y) {
        let cursorEl = document.getElementById('auto-solver-cursor');
        if (!cursorEl) {
            cursorEl = document.createElement('img');
            cursorEl.id = 'auto-solver-cursor';
            cursorEl.src = '/assets/cursor.png';
            cursorEl.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 10px;
                pointer-events: none;
                z-index: 9999;
                transform: translate(-2px, -2px);
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(cursorEl);
        }
        cursorEl.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
        cursorEl.style.opacity = '1';
        this.cursorPosition = { x, y };
    }

    /**
     * Update cursor position
     */
    updateCursorPosition(x, y) {
        const cursorEl = document.getElementById('auto-solver-cursor');
        if (cursorEl) {
            cursorEl.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
        }
        this.cursorPosition = { x, y };
    }

    /**
     * Hide mouse cursor and wait for transition to complete
     */
    hideMouseCursor() {
        return new Promise(resolve => {
            const cursorEl = document.getElementById('auto-solver-cursor');
            if (cursorEl && cursorEl.style.opacity !== '0') {
                const onTransitionEnd = (e) => {
                    if (e.propertyName === 'opacity') {
                        cursorEl.removeEventListener('transitionend', onTransitionEnd);
                        resolve();
                    }
                };
                cursorEl.addEventListener('transitionend', onTransitionEnd);

                cursorEl.style.opacity = '0';

                // Fallback in case transitionend doesn't fire
                setTimeout(() => {
                    cursorEl.removeEventListener('transitionend', onTransitionEnd);
                    resolve();
                }, 400); 
            } else {
                resolve();
            }
        });
    }

    /**
     * Hide original system cursor
     */
    hideOriginalCursor() {
        if (!this.isCursorHidden) {
            this.originalCursor = document.body.style.cursor;
            document.body.style.cursor = 'none'; // Hide cursor
            this.isCursorHidden = true;
        }
    }

    /**
     * Restore original system cursor
     */
    restoreOriginalCursor() {
        if (this.isCursorHidden) {
            document.body.style.cursor = this.originalCursor || 'auto';
            this.isCursorHidden = false;
            this.originalCursor = null;
        }
    }

    /**
     * Toggle mouse cursor visibility
     */
    toggleMouseCursor() {
        this.showMouseCursor = !this.showMouseCursor;
        console.log(`Auto Solver: Mouse cursor ${this.showMouseCursor ? 'enabled' : 'disabled'}`);
        return this.showMouseCursor;
    }

    /**
     * Click element with human-like behavior
     */
    async clickElement(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const clickX = centerX;
        const clickY = centerY;
        
        // Simulate mouse down
        const mouseDownEvent = new PointerEvent('pointerdown', {
            clientX: clickX,
            clientY: clickY,
            bubbles: true,
            pointerType: 'mouse',
            isPrimary: true
        });
        element.dispatchEvent(mouseDownEvent);
        
        // Brief delay between mouse down and up, scaled with speed
        const clickDelay = this.mouseSettings.clickDelay / this.speed;
        await this.delay(clickDelay);
        
        // Simulate mouse up
        const mouseUpEvent = new PointerEvent('pointerup', {
            clientX: clickX,
            clientY: clickY,
            bubbles: true,
            pointerType: 'mouse',
            isPrimary: true
        });
        element.dispatchEvent(mouseUpEvent);
    }

    /**
     * Human-like delay based on speed setting
     */
    async humanDelay() {
        // A simple delay that scales directly with speed.
        const baseDelay = 20; // ms, reduced from 80
        const randomFactor = Math.random() * 10; // Add some variance, reduced from 40
        const totalDelay = (baseDelay + randomFactor) / this.speed;

        // No minimum delay, let it be as fast as possible
        await this.delay(totalDelay);
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update progress display
     */
    updateProgress() {
        // Update progress in UI if element exists
        const progressElement = document.getElementById('autoSolverProgress');
        if (progressElement) {
            const percentage = Math.round((this.currentStep / this.totalSteps) * 100);
            progressElement.textContent = `${this.currentStep}/${this.totalSteps} (${percentage}%)`;
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            isProcessing: this.isProcessing,
            speed: this.speed,
            currentStep: this.currentStep,
            totalSteps: this.totalSteps,
            progress: this.totalSteps > 0 ? Math.round((this.currentStep / this.totalSteps) * 100) : 0
        };
    }
}

// Global auto solver instance
window.autoSolver = new AutoSolver();
