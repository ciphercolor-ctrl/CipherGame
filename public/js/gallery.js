document.addEventListener('DOMContentLoaded', () => {
    const galleryGrid = document.getElementById('logo-gallery-grid');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxDownload = document.getElementById('lightbox-download');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    let currentImageIndex = 0;

    // List of images in the gallery folder
    const images = [
        'Cipher (1).png',
        'Cipher (2).png',
        'Cipher (3).png',
        'Cipher (4).png',
        'Cipher (5).png',
        'Cipher (6).png',
        'Cipher (7).png',
        'Cipher (8).png',
        'Cipher (9).png',
        'Cipher (10).png',
        'Cipher (11).png',
        'Cipher (12).png',
        'Cipher (13).png',
        'Cipher (14).png',
        'Cipher (15).png',
        'Cipher (16).png',
        'Cipher (17).png',
        'Cipher (18).png',
        'Cipher (19).png',
        'Cipher (20).png',
        'Cipher (21).png',
        'Cipher (22).png',
        'Cipher (23).png',
        'Cipher (24).png',
        'Cipher (25).png'
    ];

    // Function to show a specific image in the lightbox
    const showImage = (index) => {
        if (index < 0) {
            currentImageIndex = images.length - 1;
        } else if (index >= images.length) {
            currentImageIndex = 0;
        } else {
            currentImageIndex = index;
        }
        const imgSrc = `assets/gallery/${images[currentImageIndex]}`;
        lightboxImage.src = imgSrc;
        lightboxDownload.href = imgSrc;
        lightboxModal.style.display = 'flex';
        document.addEventListener('keydown', handleKeyDown); // Add keyboard listener when modal opens
    };

    // Function to close the lightbox
    const closeModal = () => {
        if (lightboxModal) {
            lightboxModal.style.display = 'none';
            document.removeEventListener('keydown', handleKeyDown); // Remove keyboard listener when modal closes
        }
    };

    // New: Keyboard navigation handler
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
            showImage(currentImageIndex - 1);
        } else if (e.key === 'ArrowRight') {
            showImage(currentImageIndex + 1);
        } else if (e.key === 'Escape') {
            closeModal();
        }
    };

    // Dynamically create gallery items
    if (galleryGrid) {
        images.forEach((imageName, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item scroll-animate-scale';
            item.dataset.imageSrc = `assets/gallery/${imageName}`;

            const img = document.createElement('img');
            img.src = `assets/gallery/${imageName}`;
            img.alt = 'Cipher Logo Art';

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            overlay.innerHTML = '<i class="fas fa-expand"></i>';

            item.appendChild(img);
            item.appendChild(overlay);
            galleryGrid.appendChild(item);

            // Add click listener to open lightbox
            item.addEventListener('click', () => {
                showImage(index);
            });
        });
        
        // Reinitialize scroll animations for dynamically added gallery items
        if (window.scrollAnimations) {
            setTimeout(() => {
                window.scrollAnimations.observeElements();
            }, 100);
        }
    }

    // Event listeners for closing the lightbox
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeModal);
    }

    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) {
                closeModal();
            }
        });
    }

    // Event listeners for navigation buttons
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            showImage(currentImageIndex - 1);
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            showImage(currentImageIndex + 1);
        });
    }

    // Event listener for download button with mobile optimization
    if (lightboxDownload) {
        lightboxDownload.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if device is mobile
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                // For mobile devices, show the image in a new tab for manual saving
                const imgSrc = `assets/gallery/${images[currentImageIndex]}`;
                const newWindow = window.open('', '_blank');
                newWindow.document.write(`
                    <html>
                        <head>
                            <title>CIPHER Gallery - ${images[currentImageIndex]}</title>
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
                                .back-btn { 
                                    background: #6c757d; 
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
                            <h2>CIPHER Gallery</h2>
                            <img src="${imgSrc}" alt="CIPHER Gallery Image">
                            <div class="instructions">
                                <p><strong>To save this image:</strong></p>
                                <p>• On iPhone: Long press the image → Save to Photos</p>
                                <p>• On Android: Long press the image → Save image</p>
                            </div>
                            <button class="back-btn" onclick="window.close()">Close</button>
                        </body>
                    </html>
                `);
                newWindow.document.close();
            } else {
                // For desktop, use traditional download
                const link = document.createElement('a');
                link.href = `assets/gallery/${images[currentImageIndex]}`;
                link.download = images[currentImageIndex];
                link.click();
            }
        });
    }
});
