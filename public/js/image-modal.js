document.addEventListener('DOMContentLoaded', () => {
    // Create modal elements once
    const modal = document.createElement('div');
    modal.id = 'imageModal';

    const closeModal = document.createElement('span');
    closeModal.className = 'close-modal';
    closeModal.innerHTML = '&times;';

    const modalImage = document.createElement('img');
    modalImage.className = 'modal-content-image';

    modal.appendChild(closeModal);
    modal.appendChild(modalImage);
    document.body.appendChild(modal);

    // Function to open modal
    const openModal = (src, isSocial, isProfile) => {
        if (isSocial) {
            modal.classList.add('social-image-modal');
        } else if (isProfile) {
            modal.classList.add('profile-image-modal');
        }
        modal.classList.add('show');
        modalImage.src = src;
    };

    // Function to close modal
    const closeModalFunction = () => {
        modal.classList.remove('show');
        modal.classList.remove('social-image-modal'); // Always remove the class on close
        modal.classList.remove('profile-image-modal'); // Always remove the class on close
    };

    // Event listener for closing the modal
    closeModal.onclick = closeModalFunction;
    modal.onclick = function(event) {
        // Close if the click is on the background, not the image itself
        if (event.target === modal) {
            closeModalFunction();
        }
    };

    // Use event delegation to handle clicks on avatars
    // This is more efficient and works for dynamically added elements.
    document.body.addEventListener('click', (event) => {
        // COMPLETELY DISABLE image modal in admin panel
        if (document.querySelector('#adminDashboard')) {
            console.log('Admin panel detected, skipping image modal');
            return; // Skip image modal entirely in admin panel
        }
        
        const target = event.target;
        // Check if the clicked element or its parent has the 'clickable-avatar' class
        const clickableAvatar = target.closest('.clickable-avatar');
        if (clickableAvatar && clickableAvatar.src) {
            // Don't open image modal if we're in admin panel and clicking on user-avatar
            if (clickableAvatar.classList.contains('user-avatar')) {
                console.log('User avatar clicked, but skipping image modal');
                return; // Let admin's own modal handle this
            }
            
            const isSocial = clickableAvatar.closest('.social-item');
            const isProfile = clickableAvatar.closest('.profile-header') || clickableAvatar.closest('.avatar-section');
            openModal(clickableAvatar.src, isSocial, isProfile);
        }
    });
});
