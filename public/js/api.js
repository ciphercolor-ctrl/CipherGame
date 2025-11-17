// --- API Helper ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    // Show loading animation only for important API requests
    const taskId = `api_${Date.now()}_${Math.random()}`;
    const loadingMessage = getApiLoadingMessage(endpoint, method);
    
    // Only show loading for important operations
    if (window.loadingAnimation && shouldShowLoadingForEndpoint(endpoint, method)) {
        window.loadingAnimation.addLoadingTask(taskId, loadingMessage);
    }
 
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Add Authorization header if token exists and the endpoint is not public
        const publicEndpoints = ['/api/auth/login', '/api/auth/register'];
        const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.startsWith(publicPath));

        if (gameState.token && !isPublicEndpoint) {
            options.headers['Authorization'] = `Bearer ${gameState.token}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
            error.status = response.status; // Add the status to the error object
            if (response.status === 401 || response.status === 403 || errorData.code === 'USER_NOT_FOUND') {
                showNotification(getTranslation('sessionExpired'), 'error');
                logoutUser(); // Log out the user
            }
            throw error; // Throw the modified error object
        }
        return await response.json();
    } catch (error) {
        logger.error(`API request failed: ${method} ${endpoint}`, error);
        const gameMessage = document.getElementById('gameMessage');
        if (gameMessage) {
            gameMessage.textContent = `${getTranslation('errorConnectingToServer', error.message || getTranslation('couldNotConnectToServer'))}`;
        }
        throw error;
    } finally {
        // Hide loading animation only if it was shown
        if (window.loadingAnimation && shouldShowLoadingForEndpoint(endpoint, method)) {
            window.loadingAnimation.removeLoadingTask(taskId);
        }
    }
}

async function apiUploadRequest(endpoint, formData) {
    // Show loading animation for upload requests
    const taskId = `upload_${Date.now()}_${Math.random()}`;
    
    if (window.loadingAnimation) {
        window.loadingAnimation.addLoadingTask(taskId, 'uploading');
    }

    try {
        const options = {
            method: 'POST',
            headers: {
                // 'Content-Type' is not set for FormData, browser sets it automatically with boundary
            },
            body: formData
        };

        // Add Authorization header if token exists
        if (gameState.token) {
            options.headers['Authorization'] = `Bearer ${gameState.token}`;
        }

        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            if (response.status === 401 || response.status === 403) {
                showNotification(getTranslation('sessionExpired'), 'error');
                logoutUser();
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        logger.error(`API upload request failed: ${endpoint}`, error);
        showNotification(`${getTranslation('uploadError')}: ${error.message || getTranslation('couldNotConnectToServer')}`, 'error');
        throw error;
    } finally {
        // Hide loading animation
        if (window.loadingAnimation) {
            window.loadingAnimation.removeLoadingTask(taskId);
        }
    }
}

// Helper function to determine if loading should be shown for this endpoint
function shouldShowLoadingForEndpoint(endpoint, method) {
    if (!endpoint) return false;
    
    const endpointLower = endpoint.toLowerCase();
    
    // Only show loading for these important operations
    const importantOperations = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/profile/update',
        '/api/profile/avatar',
        '/api/score/save',
        '/api/game/start',
        '/api/game/end'
    ];
    
    return importantOperations.some(pattern => endpointLower.includes(pattern));
}

// Helper function to get appropriate loading message based on API endpoint
function getApiLoadingMessage(endpoint, method) {
    if (!endpoint) return 'loading';

    const endpointLower = endpoint.toLowerCase();
    
    if (endpointLower.includes('/auth/login')) return 'loggingIn';
    if (endpointLower.includes('/auth/register')) return 'creatingAccount';
    if (endpointLower.includes('/profile')) return 'loadingProfile';
    if (endpointLower.includes('/leaderboard')) return 'loadingLeaderboard';
    if (endpointLower.includes('/chat')) return 'connectingToChat';
    if (endpointLower.includes('/game')) return 'loadingGame';
    if (endpointLower.includes('/score')) return 'savingScore';
    if (endpointLower.includes('/avatar')) return 'updatingAvatar';
    if (endpointLower.includes('/username')) return 'updatingUsername';
    if (endpointLower.includes('/password')) return 'updatingPassword';
    
    if (method === 'POST') return 'saving';
    if (method === 'PUT') return 'updating';
    if (method === 'DELETE') return 'deleting';
    
    return 'loading';
}