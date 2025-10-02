function buildExplanationVisuals() {
    const content = document.getElementById('explanationContent');
    if (!content) return;
    content.innerHTML = ''; // Clear previous content

    const R = '#FF0000';
    const Y = '#FFFF00';
    const B = '#0000FF';

    const staticPatterns = {
        easy:   [R, R, Y, R, R, Y, B, B, Y],
        medium: [R, B, Y, R, B, B, R, Y, B],
        hard:   [Y, Y, R, Y, R, B, R, B, B],
        expert: [R, B, Y, Y, R, B, B, Y, R]
    };

    const difficulties = [
        { name: 'CLUSTERING', levelKey: 'difficultyEasy', games: '0-100', color: '#4a235a', pattern: staticPatterns.easy },
        { name: 'CLUSTERING', levelKey: 'difficultyMedium', games: '101-200', color: '#5b2c6f', pattern: staticPatterns.medium },
        { name: 'CLUSTERING', levelKey: 'difficultyHard', games: '201-300', color: '#6c3483', pattern: staticPatterns.hard },
        { name: 'RANDOM', levelKey: 'difficultyExpert', games: '300+', color: '#7d3c98', pattern: staticPatterns.expert }
    ];

    difficulties.forEach(level => {
        const quadrant = document.createElement('div');
        quadrant.className = 'explanation-quadrant';

        const title = document.createElement('div');
        title.className = 'explanation-title';
        title.textContent = level.name;

        const miniGrid = document.createElement('div');
        miniGrid.className = 'mini-grid';

        level.pattern.forEach(color => {
            const cell = document.createElement('div');
            cell.className = 'mini-grid-cell';
            cell.style.backgroundColor = color;
            miniGrid.appendChild(cell);
        });

        const levelContainer = document.createElement('div');
        levelContainer.className = 'explanation-level-container';

        const levelText = document.createElement('div');
        levelText.className = 'explanation-level';
        levelText.setAttribute('data-i18n', level.levelKey);
        levelText.textContent = getTranslation(level.levelKey);

        const gamesRange = document.createElement('div');
        gamesRange.className = 'explanation-games-range';
        gamesRange.textContent = `Games: ${level.games}`;

        levelContainer.appendChild(levelText);
        levelContainer.appendChild(gamesRange);

        quadrant.appendChild(title);
        quadrant.appendChild(miniGrid);
        quadrant.appendChild(levelContainer);
        content.appendChild(quadrant);
    });
}

function buildLevelsVisuals() {
    const content = document.getElementById('levelsContent');
    if (!content) return;
    content.innerHTML = ''; // Clear previous content

    // Create a wrapper for the grid
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'levels-grid-wrapper';

    const levelData = [
        { level: 1, title: 'BEGINNER', color: '#4a235a', multiplier: 'x0.5' },
        { level: 2, title: 'APPRENTICE', color: '#512e65', multiplier: 'x0.5' },
        { level: 3, title: 'JOURNEYMAN', color: '#583570', multiplier: 'x0.5' },
        { level: 4, title: 'ADEPT', color: '#5f3c7b', multiplier: 'x0.5' },
        { level: 5, title: 'EXPERT', color: '#664386', multiplier: 'x0.5' },
        { level: 6, title: 'MASTER', color: '#6d4a91', multiplier: 'x0.5' },
        { level: 7, title: 'GRANDMASTER', color: '#74519c', multiplier: 'x0.5' },
        { level: 8, title: 'LEGEND', color: '#7b58a7', multiplier: 'x0.5' },
        { level: 9, title: 'MYTHIC', color: '#825fb2', multiplier: 'x0.5' },
        { level: 10, title: 'TRANSCENDENT', color: '#8966bd', multiplier: 'x1.0' }
    ];

    levelData.forEach(data => {
        const card = document.createElement('div');
        card.className = 'level-visual-card';

        const header = document.createElement('div');
        header.className = 'level-visual-header';
        
        const levelNum = document.createElement('div');
        levelNum.className = 'level-visual-number';
        levelNum.textContent = `${getTranslation('level')} ${data.level}`;
        
        const levelTitle = document.createElement('div');
        levelTitle.className = `level-visual-title level-badge level-${data.level}`;
        levelTitle.textContent = getTranslation('level_' + data.level, data.title);

        header.appendChild(levelNum);

        const avatarWrapper = document.createElement('div');
        avatarWrapper.className = 'level-visual-avatar-wrapper';

        const avatarImage = document.createElement('img');
        avatarImage.src = 'assets/logo.jpg';
        avatarImage.alt = `${data.title} Frame`;
        avatarImage.className = `profile-avatar-preview level-${data.level}-border`;
        
        avatarWrapper.appendChild(avatarImage);
        avatarWrapper.appendChild(levelTitle);

        card.appendChild(header);
        card.appendChild(avatarWrapper);
        
        // Append card to the new wrapper
        gridWrapper.appendChild(card);
    });

    // Append the wrapper to the main content pane
    content.appendChild(gridWrapper);
}

function buildScoringVisuals() {
    const content = document.getElementById('scoringContent');
    if (!content) return;
    content.innerHTML = ''; // Clear previous content

    const scoringData = [
        { difficulty: 'difficultyEasy', size: '2x2', score: 4 },
        { difficulty: 'difficultyNormal', size: '3x3', score: 9 },
        { difficulty: 'difficultyMedium', size: '4x4', score: 16 },
        { difficulty: 'difficultyHard', size: '5x5', score: 25 },
        { difficulty: 'difficultyExpert', size: '6x6', score: 36 },
        { difficulty: 'difficultyMaster', size: '7x7', score: 49 },
        { difficulty: 'difficultyExtreme', size: '8x8', score: 64 },
        { difficulty: 'difficultyInsane', size: '9x9', score: 81 },
        { difficulty: 'difficultyLegend', size: '10x10', score: 100 },
        { difficulty: 'difficultyUltimate', size: '30x30', score: 900 }
    ];

    // Main Title
    const mainTitle = document.createElement('h2');
    mainTitle.className = 'scoring-section-title';
    mainTitle.setAttribute('data-i18n', 'scoringSystem');
    mainTitle.textContent = getTranslation('scoringSystem', 'Scoring System');
    content.appendChild(mainTitle);

    // Intro Text
    const introText = document.createElement('p');
    introText.className = 'scoring-intro-text';
    introText.setAttribute('data-i18n', 'scoringIntro');
    introText.textContent = getTranslation('scoringIntro', "Your score is determined by the game's difficulty (grid size), your accuracy, and your speed. The base score is calculated from the grid size.");
    content.appendChild(introText);

    // Base Score Grid
    const baseScoreGrid = document.createElement('div');
    baseScoreGrid.className = 'base-score-grid';
    scoringData.forEach(data => {
        const card = document.createElement('div');
        card.className = 'base-score-card';
        card.innerHTML = `
            <h4 data-i18n="${data.difficulty}">${getTranslation(data.difficulty, data.difficulty.replace('difficulty', ''))}</h4>
            <p>${data.size}</p>
            <p class="score-value">${data.score}</p>
        `;
        baseScoreGrid.appendChild(card);
    });
    content.appendChild(baseScoreGrid);

    // Other Factors Title
    const factorsTitle = document.createElement('h3');
    factorsTitle.className = 'scoring-section-title'; // Reusing title style
    factorsTitle.setAttribute('data-i18n', 'otherFactors');
    factorsTitle.textContent = getTranslation('otherFactors', 'Other Factors');
    content.appendChild(factorsTitle);

    // Factors Grid
    const factorsGrid = document.createElement('div');
    factorsGrid.className = 'scoring-factors-grid';

    const factorData = [
        { icon: 'fas fa-bullseye', titleKey: 'accuracy', descKey: 'accuracyDesc' },
        { icon: 'fas fa-clock', titleKey: 'time', descKey: 'timeDesc' },
        { icon: 'fas fa-star', titleKey: 'levelBonus', descKey: 'levelBonusDesc' }
    ];

    factorData.forEach(factor => {
        const card = document.createElement('div');
        card.className = 'factor-card';
        card.innerHTML = `
            <i class="${factor.icon}"></i>
            <h4 data-i18n="${factor.titleKey}">${getTranslation(factor.titleKey)}</h4>
            <p data-i18n="${factor.descKey}">${getTranslation(factor.descKey)}</p>
        `;
        factorsGrid.appendChild(card);
    });
    content.appendChild(factorsGrid);
}

function showExplanationModal() {
    const modal = document.getElementById('explanationModal');
    if (!modal) return;

    modal.style.display = 'block';
    
    // Build content for all panes
    buildExplanationVisuals();
    buildLevelsVisuals();
    buildScoringVisuals();

    const dots = modal.querySelectorAll('.nav-dot');
    const explanationContent = modal.querySelector('#explanationContent');
    const levelsContent = modal.querySelector('#levelsContent');
    const scoringContent = modal.querySelector('#scoringContent');

    // Set initial state
    explanationContent.style.display = 'flex'; // Reverted to flex
    levelsContent.style.display = 'none';
    scoringContent.style.display = 'none';
    
    // Ensure the correct dot is active initially
    dots.forEach(d => d.classList.remove('active'));
    modal.querySelector('.nav-dot.red').classList.add('active');

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const targetId = dot.getAttribute('data-target');
            if (!targetId) return;

            // Update active dot
            dots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');

            // Hide all content panes
            explanationContent.style.display = 'none';
            levelsContent.style.display = 'none';
            scoringContent.style.display = 'none';

            // Show the target content pane
            if (targetId === 'explanationContent') {
                explanationContent.style.display = 'flex'; // Reverted to flex
            } else if (targetId === 'levelsContent') {
                levelsContent.style.display = 'flex';
            } else if (targetId === 'scoringContent') {
                scoringContent.style.display = 'flex';
            }
        });
    });
}