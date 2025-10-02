async function shareScoreToX() {
    // Show loading animation for share process
    if (window.loadingAnimation) {
        window.loadingAnimation.show('preparingShareImage', 'normal');
    }

    const text = `Just crushed it in CIPHER! My score: ${gameState.lastGameScore} in ${gameState.lastGameMode} mode with ${gameState.lastGameAccuracy} accuracy. Challenge your memory and represent your country!`;
    const hashtags = "CIPHER";
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}`;

    const shareImageTemplate = document.getElementById('shareImageTemplate');
    const shareGameGridPlaceholder = document.getElementById('shareGameGridPlaceholder');

    // Style the placeholder directly in JS to override any potential cached CSS
        shareGameGridPlaceholder.style.position = 'absolute';
    shareGameGridPlaceholder.style.top = '80px';
    shareGameGridPlaceholder.style.right = '90px';
    shareGameGridPlaceholder.style.width = '99px';
    shareGameGridPlaceholder.style.height = '99px';
    shareGameGridPlaceholder.style.transform = 'rotate(-15deg)'; // Rotate the placeholder

    // --- Cleanup from previous runs ---
    shareGameGridPlaceholder.innerHTML = '';
    const existingEffect = shareImageTemplate.querySelector('.share-effect-overlay');
    if (existingEffect) {
        existingEffect.remove();
    }

    // --- 1. Create Grid Element ---
    const shareGrid = document.createElement('div');
    // Style the grid container itself
    shareGrid.style.width = '99px';
    shareGrid.style.height = '99px';
    shareGrid.style.background = '#000000';
    shareGrid.style.borderRadius = '10px';
    shareGrid.style.boxShadow = '0 0 30px rgba(0, 174, 239, 0.8)';
    shareGrid.style.padding = '5px';
    shareGrid.style.boxSizing = 'border-box';
    shareGrid.style.display = 'grid';
    shareGrid.style.gap = '1px';
    shareGrid.style.gridTemplateColumns = `repeat(${gameState.currentMode}, 1fr)`; 

    // Populate the grid with cells from the final game state
    if (gameState.gameGrid && gameState.gameGrid.length > 0) {
        gameState.gameGrid.forEach(cellState => {
            const cell = document.createElement('div');
            // Use the color the player actually painted on the cell
            cell.style.backgroundColor = cellState.currentColor;
            cell.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            cell.style.borderRadius = '2px';
            shareGrid.appendChild(cell);
        });
    }
    // Append the finished grid to its placeholder in the template
    shareGameGridPlaceholder.appendChild(shareGrid);

    // --- 2. Populate Template with Data ---
    shareImageTemplate.style.backgroundImage = `url('assets/share_background.jpg')`;
    const shareAvatarWrapper = document.querySelector('.share-avatar-wrapper');
    const shareAvatar = document.getElementById('shareAvatar');
    shareAvatar.src = gameState.avatarUrl || 'assets/logo.jpg';
    shareAvatar.classList.add('share-avatar-image');
    if (gameState.level > 0) {
        shareAvatarWrapper.className = `share-avatar-wrapper level-${gameState.level}-border`;
    } else {
        shareAvatarWrapper.className = 'share-avatar-wrapper no-border';
    }
    document.getElementById('shareUsername').textContent = gameState.username;
    const shareCountryElement = document.getElementById('shareCountry');
    const countryCode = gameState.playerCountry.toLowerCase();
    const countryFlagSrc = countries[gameState.playerCountry] ? countries[gameState.playerCountry].flag : '';
    const translatedCountryName = getTranslation(`country_${countryCode}`);

    if (gameState.playerCountry) {
        shareCountryElement.innerHTML = `<img src="${countryFlagSrc}" alt="${translatedCountryName} Flag"> ${translatedCountryName}`;
    } else {
        shareCountryElement.innerHTML = '';
    }

    const statsGrid = shareImageTemplate.querySelector('.stats-grid-container');
    statsGrid.innerHTML = `
        <div class="stat-item-box"><h3>${getTranslation('share_mode')}</h3><p>${gameState.lastGameMode}</p></div>
        <div class="stat-item-box"><h3>${getTranslation('share_score')}</h3><p>${gameState.lastGameScore}</p></div>
        <div class="stat-item-box"><h3>${getTranslation('share_accuracy')}</h3><p>${gameState.lastGameAccuracy}</p></div>
        <div class="stat-item-box"><h3>${getTranslation('share_time')}</h3><p>${gameState.lastGameTime}</p></div>
    `;
    shareImageTemplate.querySelector('.tagline').textContent = getTranslation('share_tagline');
    // --- 3. Add Color Effect ---
    const effectDiv = document.createElement('div');
    effectDiv.className = 'share-effect-overlay'; // Add a class for easy removal
    const lightColors = [
        'rgba(0, 174, 239, 0.15)', 'rgba(255, 0, 119, 0.15)', 'rgba(255, 234, 0, 0.15)',
        'rgba(0, 255, 140, 0.15)', 'rgba(138, 43, 226, 0.15)'
    ];
    const color1 = lightColors[Math.floor(Math.random() * lightColors.length)];
    const color2 = lightColors[Math.floor(Math.random() * lightColors.length)];
    effectDiv.style.position = 'absolute';
    effectDiv.style.top = '0';
    effectDiv.style.left = '0';
    effectDiv.style.width = '100%';
    effectDiv.style.height = '100%';
    effectDiv.style.background = `linear-gradient(to bottom right, ${color1}, ${color2})`;
    effectDiv.style.zIndex = '1'; // Changed z-index to be behind content
    shareImageTemplate.appendChild(effectDiv);

    // --- 4. Add Watermark Text ---
    const watermarkText = document.createElement('div');
    watermarkText.textContent = 'cipher-global.online';
    watermarkText.style.position = 'absolute';
    watermarkText.style.top = '10px';
    watermarkText.style.left = '50%';
    watermarkText.style.transform = 'translateX(-50%)';
    watermarkText.style.color = 'white';
    watermarkText.style.fontSize = '0.84rem'; // Reduced by 30%
    watermarkText.style.fontFamily = 'Orbitron, sans-serif'; // Use the same font as other elements
    watermarkText.style.zIndex = '2'; // Ensure it's on top of the effect and background
    watermarkText.style.textShadow = '0 0 5px rgba(0,0,0,0.5)'; // Subtle shadow for readability
    shareImageTemplate.appendChild(watermarkText);

    // --- 5. Prepare for Rendering ---
    shareImageTemplate.style.display = 'block';
    shareImageTemplate.style.position = 'absolute';
    shareImageTemplate.style.left = '-9999px';
    shareImageTemplate.style.top = '-9999px';

    // --- 4. Prepare for Rendering ---
    shareImageTemplate.style.display = 'block';
    shareImageTemplate.style.position = 'absolute';
    shareImageTemplate.style.left = '-9999px';
    shareImageTemplate.style.top = '-9999px';

    const canvasOptions = { scale: 2, useCORS: true, backgroundColor: null, logging: false };

    try {
        // --- 5. Single Canvas Call on the fully assembled template ---
        const canvas = await html2canvas(shareImageTemplate, canvasOptions);

        // --- 6. Cleanup ---
        shareImageTemplate.style.display = 'none';
        shareGameGridPlaceholder.innerHTML = ''; // Clean placeholder
        const effectToRemove = shareImageTemplate.querySelector('.share-effect-overlay');
        if (effectToRemove) effectToRemove.remove();

        // --- 7. Show Modal ---
        const imageUrl = canvas.toDataURL('image/png');
        const shareConfirmationModal = document.getElementById('shareConfirmationModal');
        const scorePreviewImage = document.getElementById('scorePreviewImage');
        scorePreviewImage.src = imageUrl;
        
        // Save current scroll position before disabling scroll
        const scrollY = window.scrollY;
        document.body.style.top = `-${scrollY}px`;
        
        shareConfirmationModal.style.display = 'block';
        document.body.classList.add('no-scroll');

        document.getElementById('downloadAndShareBtn').onclick = () => {
            // Check if device is mobile
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                // For mobile devices, show the image in a new tab for manual saving
                const newWindow = window.open('', '_blank');
                newWindow.document.write(`
                    <html>
                        <head>
                            <title>CIPHER Score - ${gameState.username}</title>
                            <style>
                                body { 
                                    margin: 0; 
                                    padding: 20px; 
                                    background: #000; 
                                    color: #fff; 
                                    font-family: Arial, sans-serif; 
                                    text-align: center; 
                                }
                                img { 
                                    max-width: 100%; 
                                    height: auto; 
                                    border-radius: 10px; 
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.5); 
                                }
                                .instructions { 
                                    margin: 20px 0; 
                                    font-size: 16px; 
                                    line-height: 1.5; 
                                }
                                .share-btn { 
                                    background: #1DA1F2; 
                                    color: white; 
                                    padding: 12px 24px; 
                                    border: none; 
                                    border-radius: 8px; 
                                    font-size: 16px; 
                                    cursor: pointer; 
                                    margin: 10px; 
                                    text-decoration: none; 
                                    display: inline-block; 
                                }
                            </style>
                        </head>
                        <body>
                            <h2>CIPHER Score Share</h2>
                            <img src="${imageUrl}" alt="CIPHER Score">
                            <div class="instructions">
                                <p><strong>To save this image:</strong></p>
                                <p>• On iPhone: Long press the image → Save to Photos</p>
                                <p>• On Android: Long press the image → Save image</p>
                            </div>
                            <a href="${twitterUrl}" target="_blank" class="share-btn">Share on X</a>
                        </body>
                    </html>
                `);
                newWindow.document.close();
            } else {
                // For desktop, use traditional download
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = `CIPHER_Score_${gameState.username}_${gameState.lastGameScore}.png`;
                link.click();
                window.open(twitterUrl, '_blank');
            }
            
            // Restore scroll position and remove no-scroll class
            const scrollY = document.body.style.top;
            shareConfirmationModal.style.display = 'none';
            document.body.classList.remove('no-scroll');
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        };
        document.getElementById('cancelShareBtn').onclick = () => {
            // Restore scroll position and remove no-scroll class
            const scrollY = document.body.style.top;
            shareConfirmationModal.style.display = 'none';
            document.body.classList.remove('no-scroll');
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        };
        shareConfirmationModal.querySelector('.close-game').onclick = () => {
            // Restore scroll position and remove no-scroll class
            const scrollY = document.body.style.top;
            shareConfirmationModal.style.display = 'none';
            document.body.classList.remove('no-scroll');
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        };

    } catch (error) {
        logger.error('Error capturing game over screen:', error);
        showNotification(getTranslation('captureErrorSharingTextOnly', { message: error.message }), 'error');
        window.open(twitterUrl, '_blank');
        shareImageTemplate.style.display = 'none';
    } finally {
        // Hide loading animation
        if (window.loadingAnimation) {
            window.loadingAnimation.hide();
        }
    }
}