let socket;
let typingTimeout = null;

function connectChat() {
    if (!gameState.isLoggedIn) {
        if (window.IS_DEVELOPMENT) {
            logger.debug('Not logged in, cannot connect to chat.');
        }
        return;
    }

    if (socket && socket.connected) {
        if (window.IS_DEVELOPMENT) {
            logger.debug('Already connected to chat, ensuring correct room.');
        }
        const roomToJoin = gameState.playerCountry ? `country-${gameState.playerCountry}` : window.DEFAULT_CHAT_ROOM;
        if (gameState.currentRoom !== roomToJoin) {
            socket.emit('joinRoom', { 
                playerId: gameState.playerId, 
                username: gameState.username, 
                room: roomToJoin, 
                avatarUrl: gameState.avatarUrl, 
                level: gameState.level, 
                country: gameState.playerCountry 
            });
            gameState.currentRoom = roomToJoin;
            fetchChatMessages(roomToJoin);
            populateChatRoomList();
        }
        return;
    }

    if (window.IS_DEVELOPMENT) {
        logger.debug('Attempting to connect to chat...');
    }
    initializeChatSocket();
}

function initializeChatSocket() {
    if (socket && socket.connected) {
        return; // Socket already initialized and connected
    }
    if (!socket) {
        socket = io({
            // Optional: Add connection options if needed, e.g., transports
            // transports: ['websocket', 'polling'],
        });
    }

    // Remove all previous listeners to prevent duplicates
    socket.off('connect');
    socket.off('message');
    socket.off('userListUpdate');
    socket.off('userJoined');
    socket.off('userLeft');
    socket.off('userProfileUpdated');
    socket.off('typingUpdate');
    socket.off('disconnect');
    socket.off('messageUpdated');
    socket.off('messageDeleted');
    socket.off('error');

    socket.on('connect', () => {
        if (window.IS_DEVELOPMENT) {
            logger.info('Connected to chat server.');
        }
        // Determine the room to join based on user's country
        const roomToJoin = gameState.playerCountry ? `country-${gameState.playerCountry}` : window.DEFAULT_CHAT_ROOM;
        gameState.currentRoom = roomToJoin;
        if (window.IS_DEVELOPMENT) {
            logger.debug('Sending level to server:', gameState.level);
        }
        socket.emit('joinRoom', { playerId: gameState.playerId, username: gameState.username, room: roomToJoin, avatarUrl: gameState.avatarUrl, level: gameState.level, country: gameState.playerCountry });
        fetchChatMessages(roomToJoin);
        populateChatRoomList();
    });

    socket.on('message', (message) => {
        if (window.IS_DEVELOPMENT) {
            logger.debug('Received message:', message);
            logger.debug('Current room:', gameState.currentRoom);
        }
        if (message.room === gameState.currentRoom || message.isSystem) {
            displayMessage(message);
        }
    });

    socket.on('userListUpdate', (users) => {
        updateUserListDisplay(users);
    });

    socket.on('userJoined', (user) => {
        addUserToList(user);
    });

    socket.on('userLeft', (data) => {
        removeUserFromList(data.playerId);
    });

    socket.on('userProfileUpdated', (data) => {
        updateUserInList(data);
    });

    socket.on('typingUpdate', (typingUsernames) => {
        updateTypingIndicator(typingUsernames);
    });

    socket.on('disconnect', () => {
        logger.warn('Disconnected from chat server.');
        updateUserListDisplay([]);
        updateTypingIndicator([]);
    });

    socket.on('messageUpdated', (data) => {
        const messageElement = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageElement) {
            // If the message is currently being edited, cancel the edit mode
            if (messageElement.classList.contains('editing')) {
                cancelEdit(data.id);
            }
            
            const messageContentDiv = messageElement.querySelector('.message-content');
            const messageP = messageContentDiv.querySelector('p');
            const timestampSpan = messageP.querySelector('.timestamp');
            
            // Create a new span for the message text to make it easier to select
            const newTextSpan = document.createElement('span');
            newTextSpan.className = 'message-text-content';
            newTextSpan.innerHTML = parseMarkdown(data.message);

            // Store the raw text for editing
            messageElement.dataset.originalText = data.message;

            // Reconstruct the paragraph content
            messageP.innerHTML = ''; // Clear it first
            messageP.appendChild(newTextSpan);
            messageP.appendChild(document.createTextNode(' ')); // Add a space before the timestamp
            messageP.appendChild(timestampSpan);
        }
    });

    socket.on('messageDeleted', (data) => {
        const messageElement = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });

    socket.on('error', (error) => {
        logger.error('Chat socket error:', error);
        showNotification(`Chat error: ${error.message}`, 'error');
    });
}

async function fetchChatMessages(room = gameState.currentRoom, append = false) {
    const chatMessagesDiv = document.getElementById('chatMessages');
    const loadMoreBtnId = 'loadMoreMessagesBtn';

    // If appending, find the button. If not, clear everything.
    if (!append) {
        chatMessagesDiv.innerHTML = ''; 
        gameState.chatHistoryOffset = 0;
    } else {
        const oldLoadMoreBtn = document.getElementById(loadMoreBtnId);
        if (oldLoadMoreBtn) {
            oldLoadMoreBtn.remove();
        }
    }

    try {
        const history = await apiRequest(`/api/chat/history/${room}?limit=${gameState.chatHistoryLimit}&offset=${gameState.chatHistoryOffset}`, 'GET');
        
        // --- DEBUG LOGS START ---
        if (window.IS_DEVELOPMENT) {
            logger.debug('--- fetchChatMessages DEBUG ---');
            logger.debug('GameState Player ID at fetch time:', gameState.playerId);
            logger.debug('Fetched History:', history);
            logger.debug('-------------------------------');
        }
        // --- DEBUG LOGS END ---

        if (history.length > 0) {
            const fragment = document.createDocumentFragment();
            history.forEach(msg => {
                // --- Start of change: De-duplication logic ---
                // If a message with this ID already exists in the DOM, skip it.
                if (document.querySelector(`[data-message-id="${msg.id}"]`)) {
                    return; // Skip this message
                }
                // --- End of change ---

                const messageElement = createMessageElement(msg);
                fragment.appendChild(messageElement);
            });
            
            if (append) {
                chatMessagesDiv.prepend(fragment);
            } else {
                chatMessagesDiv.appendChild(fragment);
            }

            // ONLY add the 'Load More' button if the number of messages received is equal to the limit,
            // which implies there might be more messages to fetch.
            if (history.length === gameState.chatHistoryLimit) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = loadMoreBtnId;
                loadMoreBtn.textContent = 'Load More Messages';
                loadMoreBtn.classList.add('load-more-messages-btn');
                loadMoreBtn.addEventListener('click', () => fetchChatMessages(gameState.currentRoom, true));
                chatMessagesDiv.prepend(loadMoreBtn);
            }

            if (!append) {
                scrollToChatBottom();
            }

            gameState.chatHistoryOffset += history.length;
        } else if (!append) {
            chatMessagesDiv.innerHTML = '<div class="no-messages-yet">No messages in this chat yet.</div>';
        }

    } catch (error) {
        logger.error('Failed to fetch chat history:', error);
        showNotification(`Failed to load chat history: ${error.message}`, 'error');
        if (!append) {
            chatMessagesDiv.innerHTML = '<div class="error-loading-messages">Error loading messages.</div>';
        }
    }
}



// Helper function to create a message element (extracted from displayMessage)
function createMessageElement(message) {
    const messageElement = document.createElement('div');
    const currentPlayerId = gameState.playerId ? String(gameState.playerId) : null;
    const messageSenderId = message.senderId ? String(message.senderId) : null;
    const isSent = currentPlayerId && messageSenderId && currentPlayerId === messageSenderId;

    let levelToShow = message.level;
    if (isSent) {
        levelToShow = gameState.level;
    } else if (gameState.chatUsers) {
        const sender = gameState.chatUsers.find(u => String(u.playerId) === messageSenderId);
        if (sender) levelToShow = sender.level;
    }

    messageElement.classList.add('chat-message-item', isSent ? 'sent' : 'received');
    if (message.isSystem) {
        messageElement.classList.add('system');
    }
    messageElement.dataset.messageId = message.id;
    messageElement.dataset.originalText = message.message;

    const date = new Date(message.timestamp);
    const timestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const avatarSrc = message.avatarUrl ? DOMPurify.sanitize(message.avatarUrl) : 'assets/logo.jpg';
    const levelClass = levelToShow > 0 ? ` level-${levelToShow}-border` : ' no-border';

    let replyHtml = '';
    if (message.replyTo && message.replyTo.id) {
        const saneUsername = DOMPurify.sanitize(message.replyTo.username);
        const saneMessage = DOMPurify.sanitize(message.replyTo.message);
        // Add data-replied-message-id and a clickable class to the reply container
        replyHtml = `
            <div class="replied-to-message clickable-reply" data-replied-message-id="${message.replyTo.id}">
                <div class="replied-to-header">${saneUsername}</div>
                <p class="replied-to-text">${saneMessage}</p>
            </div>
        `;
    }


    const messageContentHtml = `
        ${replyHtml}
        <p><span class="message-text-content">${parseMarkdown(message.message)}</span> <span class="timestamp">${timestamp}</span></p>
    `;

    const ownMessageActions = `
        <button class="edit-message-btn" data-message-id="${message.id}"><i class="fas fa-edit"></i> Edit</button>
        <button class="delete-message-btn" data-message-id="${message.id}"><i class="fas fa-trash"></i> Delete</button>
    `;

    messageElement.innerHTML = `
        <div class="message-avatar-container">
            <span class="username">${DOMPurify.sanitize(message.username)}</span>
            <img src="${avatarSrc}" alt="Avatar" class="chat-avatar${levelClass} clickable-avatar">
        </div>
        <div class="message-bubble">
            <div class="message-content">${messageContentHtml}</div>
        </div>
        <div class="message-actions-container">
            <button class="message-options-btn"><i class="fas fa-ellipsis-h"></i></button>
            <div class="message-actions hidden">
                <button class="reply-message-btn" data-message-id="${message.id}"><i class="fas fa-reply"></i> Reply</button>
                ${isSent ? ownMessageActions : ''}
            </div>
        </div>
    `;

    return messageElement;
}

// Modify displayMessage to use createMessageElement and append
function displayMessage(message) {
    const chatMessagesDiv = document.getElementById('chatMessages');
    const isScrolledToBottom = chatMessagesDiv.scrollHeight - chatMessagesDiv.clientHeight <= chatMessagesDiv.scrollTop + 10;

    const messageElement = createMessageElement(message);
    chatMessagesDiv.appendChild(messageElement);

    if (isScrolledToBottom) {
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    } else {
        // Show the "New Messages" button if the user is not at the bottom
        const newMessagesBtn = document.getElementById('newMessagesBtn');
        if (newMessagesBtn) {
            newMessagesBtn.style.display = 'block';
        }
    }

    playNotificationSound(message);

    // Increment unread message count if the chat is not active
    const chatModal = document.getElementById('chatModal');
    const isChatWindowOpen = chatModal.style.display === 'block';
    const isPageVisible = !document.hidden;
    const isChatActive = isChatWindowOpen && isPageVisible && message.room === gameState.currentRoom;

    if (!isChatActive && String(message.senderId) !== String(gameState.playerId)) {
        if (!gameState.unreadMessages[message.room]) {
            gameState.unreadMessages[message.room] = 0;
        }
        gameState.unreadMessages[message.room]++;
        updateChatNotificationBadge();
    }
}



function updateChatNotificationBadge() {
    const totalUnread = Object.values(gameState.unreadMessages).reduce((sum, count) => sum + count, 0);

    // Update the main notification badges (e.g., on the main chat button)
    const mainBadges = document.querySelectorAll('.main-notification-badge');
    mainBadges.forEach(badge => {
        if (totalUnread > 0) {
            badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    });

    // Update per-room notification badges in the sidebar
    const roomBadges = document.querySelectorAll('.room-badge');
    roomBadges.forEach(badge => {
        badge.style.display = 'none'; // Reset all first
        badge.textContent = '';
    });

    for (const room in gameState.unreadMessages) {
        const count = gameState.unreadMessages[room];
        if (count > 0) {
            const roomBadge = document.querySelector(`.chat-room-list-item[data-room-id="${room}"] .room-badge`);
            if (roomBadge) {
                roomBadge.textContent = count > 99 ? '99+' : count;
                roomBadge.style.display = 'block';
            }
        }
    }
}

function playNotificationSound(message) {
    const chatModal = document.getElementById('chatModal');
    const isChatOpen = chatModal.style.display === 'block';

    // Conditions to play sound:
    // 1. Sound is enabled in settings.
    // 2. Message is not from the current user.
    // 3. EITHER the chat modal is closed OR the browser tab is not visible (document.hidden).
    const shouldPlaySound = gameState.chatSoundEnabled &&
        String(message.senderId) !== String(gameState.playerId) &&
        (!isChatOpen || document.hidden);

    if (shouldPlaySound) {
        const notificationSound = document.getElementById('notificationSound');
        if (notificationSound) {
            const playPromise = notificationSound.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    logger.error('Audio play failed:', error);
                    // This notification can be annoying if the user hasn't interacted with the page yet.
                    // Consider showing it only once.
                    if (!gameState.hasShownSoundError) {
                        showNotification('Click anywhere on the page to enable sound.', 'info');
                        gameState.hasShownSoundError = true;
                    }
                });
            }
        }
    }
}

function toggleChatSound() {
    gameState.chatSoundEnabled = !gameState.chatSoundEnabled;
    localStorage.setItem('chatSoundEnabled', gameState.chatSoundEnabled);
    updateChatSoundIcon();
}

function updateChatSoundIcon() {
    const toggleChatSoundBtn = document.getElementById('toggleChatSoundBtn');
    if (toggleChatSoundBtn) {
        const icon = toggleChatSoundBtn.querySelector('i');
        if (gameState.chatSoundEnabled) {
            icon.classList.remove('fa-volume-mute');
            icon.classList.add('fa-volume-up');
        } else {
            icon.classList.remove('fa-volume-up');
            icon.classList.add('fa-volume-mute');
        }
    }
}

function initChatSound() {
    const savedSoundPreference = localStorage.getItem('chatSoundEnabled');
    if (savedSoundPreference !== null) {
        gameState.chatSoundEnabled = savedSoundPreference === 'true';
    }
    updateChatSoundIcon();

    const toggleChatSoundBtn = document.getElementById('toggleChatSoundBtn');
    if (toggleChatSoundBtn) {
        toggleChatSoundBtn.addEventListener('click', toggleChatSound);
    }
}


function scrollToChatBottom() {
    const chatMessagesDiv = document.getElementById('chatMessages');
    if (chatMessagesDiv) {
        // Use a timeout to ensure the DOM has rendered and scrollHeight is correct, especially on initial load
        setTimeout(() => {
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            chatMessagesDiv.classList.remove('messages-loading');
        }, 50);
    }
}

// Event Delegation for chat messages
document.getElementById('chatMessages').addEventListener('click', (event) => {
    const target = event.target;
    const messageElement = target.closest('.chat-message-item');
    if (!messageElement) return;

    const messageId = messageElement.dataset.messageId;

    // Handle clicking on a replied message to scroll to it
    const repliedMessage = target.closest('.clickable-reply');
    if (repliedMessage) {
        const repliedMessageId = repliedMessage.dataset.repliedMessageId;
        const targetMessage = document.querySelector(`[data-message-id="${repliedMessageId}"]`);
        if (targetMessage) {
            targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add the new flash-highlight animation
            targetMessage.classList.add('flash-highlight');
            // Remove the class after the animation finishes to allow re-triggering
            targetMessage.addEventListener('animationend', () => {
                targetMessage.classList.remove('flash-highlight');
            }, { once: true });
        }
        return; // Stop further execution
    }

    if (target.closest('.message-options-btn')) {
        event.stopPropagation();
        const messageActions = messageElement.querySelector('.message-actions');
        if (messageActions) {
            document.querySelectorAll('.message-actions').forEach(menu => {
                if (menu !== messageActions) menu.classList.add('hidden');
            });
            messageActions.classList.toggle('hidden');
        }
    } else if (target.closest('.reply-message-btn')) {
        const username = messageElement.querySelector('.username').textContent;
        const messageP = messageElement.querySelector('.message-content > p');
        const messageText = messageP ? messageP.textContent : '';
        startReply(messageId, username, messageText);
    } else if (target.closest('.edit-message-btn')) {
        enableMessageEdit(messageId);
    } else if (target.closest('.delete-message-btn')) {
        deleteMessage(messageId);
    }
});

// Hide message action menus when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('.message-actions-container')) {
        document.querySelectorAll('.message-actions').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});

function startReply(messageId, username, messageText) {
    gameState.replyingTo = {
        id: messageId,
        username: username,
        message: messageText
    };

    const replyPreviewContainer = document.getElementById('replyPreviewContainer');
    const replyPreviewText = document.getElementById('replyPreviewText');
    const replyPreviewHeader = replyPreviewContainer.querySelector('.reply-preview-header');

    replyPreviewHeader.textContent = `${getTranslation('replyingTo')} ${username}`;
    replyPreviewText.textContent = messageText;
    replyPreviewContainer.style.display = 'flex';

    document.getElementById('chatInput').focus();
}

function cancelReply() {
    gameState.replyingTo = null;
    document.getElementById('replyPreviewContainer').style.display = 'none';
}

document.getElementById('cancelReplyBtn').addEventListener('click', cancelReply);

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    const now = Date.now();
    const chatMessageCooldown = 2000;
    if (now - gameState.lastChatMessageTime < chatMessageCooldown) {
        showNotification('Please wait before sending another message.', 'info');
        return;
    }
    gameState.lastChatMessageTime = now;

    if (!gameState.isLoggedIn) {
        showNotification('Please log in to send messages.', 'info');
        return;
    }
    if (!socket || !socket.connected) {
        showNotification('Not connected to chat server. Please try again later.', 'error');
        console.log('Socket state on sendMessage attempt:', socket); // Debugging line
        return;
    }

    socket.emit('stopTyping', { username: gameState.username, room: gameState.currentRoom });

    const messagePayload = {
        text: message,
        username: gameState.username,
        playerId: gameState.playerId,
        replyTo: gameState.replyingTo ? gameState.replyingTo.id : null
    };

    socket.emit('sendMessage', messagePayload);
    
    chatInput.value = '';
    if (gameState.replyingTo) {
        cancelReply();
    }
}

function parseMarkdown(text) {
    if (typeof text !== 'string') return text;
    let parsedText = text;

    // Basic Markdown parsing (keep this if you want markdown support)
    parsedText = parsedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    parsedText = parsedText.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
    parsedText = parsedText.replace(/~~(.*?)~~/g, '<del>$1</del>'); // Strikethrough
    parsedText = parsedText.replace(/`(.*?)`/g, '<code>$1</code>'); // Code
    parsedText = parsedText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'); // Links
    parsedText = parsedText.replace(/^>\s*(.*)$/gm, '<blockquote>$1</blockquote>'); // Blockquote

    // Sanitize the parsed HTML using DOMPurify
    return DOMPurify.sanitize(parsedText, { USE_PROFILES: { html: true } });
}

function handleTyping() {
    if (!gameState.isLoggedIn || !socket || !socket.connected) return;

    socket.emit('typing', { username: gameState.username, room: gameState.currentRoom });

    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(() => {
        socket.emit('stopTyping', { username: gameState.username, room: gameState.currentRoom });
    }, 3000);
}

function updateUserListDisplay(users) {
    gameState.chatUsers = users; // Store the current user list for lookups
    const onlineUserList = document.getElementById('onlineUserList');
    const onlineUserCount = document.getElementById('onlineUserCount');
    const activeUserListSidebar = document.getElementById('activeUserListSidebar');

    if (!onlineUserList || !onlineUserCount || !activeUserListSidebar) return;

    onlineUserList.innerHTML = '';
    activeUserListSidebar.innerHTML = ''; // Clear sidebar list as well
    onlineUserCount.textContent = users.length;

    if (users.length === 0) {
        const noUsersMessage = 'No other users online right now.';
        onlineUserList.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
        activeUserListSidebar.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
    } else {
        users.forEach(user => {
            const userElement = createUserListItem(user);
            onlineUserList.appendChild(userElement.cloneNode(true));
            activeUserListSidebar.appendChild(userElement);
        });
    }
}

function createUserListItem(user) {
    const listItem = document.createElement('li');
    listItem.classList.add('online-user-item');
    listItem.dataset.playerId = user.playerId;
    const levelClass = user.level > 0 ? ` level-${user.level}-border` : ' no-border';
    listItem.innerHTML = `
        <img src="${user.avatarUrl || 'assets/logo.jpg'}" alt="Avatar" class="online-user-avatar${levelClass} clickable-avatar" data-action="view-avatar">
        <span class="username" data-action="view-profile">${user.username}</span>
    `;
    return listItem;
}

function addUserToList(user) {
    const onlineUserList = document.getElementById('onlineUserList');
    const onlineUserCount = document.getElementById('onlineUserCount');
    const activeUserListSidebar = document.getElementById('activeUserListSidebar');

    // Remove the "No other users" message if it exists
    const noUsersMessage = onlineUserList.querySelector('.no-users-message');
    if (noUsersMessage) {
        noUsersMessage.remove();
        const sidebarMessage = activeUserListSidebar.querySelector('.no-users-message');
        if (sidebarMessage) sidebarMessage.remove();
    }

    // Add the new user
    const userElement = createUserListItem(user);
    onlineUserList.appendChild(userElement.cloneNode(true));
    activeUserListSidebar.appendChild(userElement);

    // Update count
    onlineUserCount.textContent = parseInt(onlineUserCount.textContent) + 1;
}

function removeUserFromList(playerId) {
    const onlineUserList = document.getElementById('onlineUserList');
    const onlineUserCount = document.getElementById('onlineUserCount');
    const activeUserListSidebar = document.getElementById('activeUserListSidebar');

    const userElements = document.querySelectorAll(`[data-player-id="${playerId}"]`);
    userElements.forEach(el => el.remove());

    // Update count
    const newCount = parseInt(onlineUserCount.textContent) - 1;
    onlineUserCount.textContent = newCount;

    // If list is empty, show the message
    if (newCount === 0) {
        const noUsersMessage = 'No other users online right now.';
        onlineUserList.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
        activeUserListSidebar.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
    }
}

function updateUserInList(user) {
    const userElements = document.querySelectorAll(`[data-player-id="${user.playerId}"]`);
    userElements.forEach(element => {
        const avatarImg = element.querySelector('.online-user-avatar');
        if (avatarImg) {
            avatarImg.src = user.avatarUrl || 'assets/logo.jpg';
            // Update level border if it can change
            if (user.level > 0) {
                avatarImg.className = `online-user-avatar level-${user.level}-border`;
            } else {
                avatarImg.className = 'online-user-avatar no-border';
            }
        }
        const usernameSpan = element.querySelector('.username');
        if (usernameSpan) {
            usernameSpan.textContent = user.username;
        }
    });
}

function updateTypingIndicator(typingUsernames) {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (!typingIndicator) return;

    const typingUsersDisplay = typingIndicator.querySelector('#typingUsersDisplay');
    if (!typingUsersDisplay) return;

    const filteredTypingUsernames = typingUsernames.filter(name => name !== gameState.username);

    if (filteredTypingUsernames.length === 0) {
        typingIndicator.style.display = 'none';
        typingUsersDisplay.textContent = '';
    } else {
        typingIndicator.style.display = 'block';
        if (filteredTypingUsernames.length === 1) {
            typingUsersDisplay.textContent = getTranslation('userIsTyping').replace('{0}', filteredTypingUsernames[0]);
        } else if (filteredTypingUsernames.length === 2) {
            typingUsersDisplay.textContent = getTranslation('usersAreTyping').replace('{0}', filteredTypingUsernames[0]).replace('{1}', filteredTypingUsernames[1]);
        } else {
            typingUsersDisplay.textContent = getTranslation('multipleUsersTyping');
        }
    }
}

function enableMessageEdit(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement || messageElement.classList.contains('editing')) return;

    messageElement.classList.add('editing');

    const messageContentDiv = messageElement.querySelector('.message-content');
    const messageP = messageContentDiv.querySelector('p');
    const originalMessage = messageP.innerHTML; // Keep original HTML with timestamp
    const originalText = messageElement.dataset.originalText || messageP.querySelector('.message-text-content').textContent;
    
    // Store original content in case of cancellation
    messageElement.dataset.originalContent = originalMessage;

    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.value = originalText;
    textarea.className = 'inline-edit-textarea';
    
    // Replace paragraph with textarea
    messageP.style.display = 'none';
    messageContentDiv.appendChild(textarea);
    textarea.focus();

    // Auto-resize textarea after it's in the DOM
    setTimeout(() => {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }, 0);

    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    });

    // Hide original actions, show edit actions
    const messageActions = messageElement.querySelector('.message-actions');
    if (messageActions) messageActions.classList.add('hidden');

    const messageOptionsBtn = messageElement.querySelector('.message-options-btn');
    if (messageOptionsBtn) messageOptionsBtn.style.display = 'none';

    let editActions = messageElement.querySelector('.edit-actions');
    if (!editActions) {
        editActions = document.createElement('div');
        editActions.className = 'edit-actions';
        editActions.innerHTML = `
            <button class="save-edit-btn"><i class="fas fa-check"></i></button>
            <button class="cancel-edit-btn"><i class="fas fa-times"></i></button>
        `;
        messageElement.querySelector('.message-bubble').appendChild(editActions);
    } else {
        editActions.style.display = 'flex';
    }
    
    // Add event listeners for save/cancel
    editActions.querySelector('.save-edit-btn').onclick = () => saveEditedMessage(messageId);
    editActions.querySelector('.cancel-edit-btn').onclick = () => cancelEdit(messageId);

    // Handle Enter/Escape keys
    textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEditedMessage(messageId);
        } else if (e.key === 'Escape') {
            cancelEdit(messageId);
        }
    };
}

async function saveEditedMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    const textarea = messageElement.querySelector('.inline-edit-textarea');
    const newContent = textarea.value.trim();
    const originalText = messageElement.dataset.originalText;

    if (newContent && newContent !== originalText) {
        try {
            await apiRequest(`/api/chat/messages/${messageId}`, 'PUT', { message: newContent });
            // The 'messageUpdated' socket event will handle the UI update
        } catch (error) {
            logger.error('Failed to save edited message:', error);
            showNotification(`Failed to update message: ${error.message}`, 'error');
            cancelEdit(messageId); // Revert on failure
        }
    } else {
        cancelEdit(messageId); // If content is empty or unchanged, just cancel
    }
}

function cancelEdit(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement || !messageElement.classList.contains('editing')) return;

    messageElement.classList.remove('editing');

    const messageContentDiv = messageElement.querySelector('.message-content');
    const messageP = messageContentDiv.querySelector('p');
    const textarea = messageContentDiv.querySelector('.inline-edit-textarea');

    // Remove textarea and show original paragraph
    if (textarea) textarea.remove();
    messageP.style.display = 'block';

    // Restore original content if it was stored
    if (messageElement.dataset.originalContent) {
        messageP.innerHTML = messageElement.dataset.originalContent;
    }

    // Hide edit actions, show original options button
    const editActions = messageElement.querySelector('.edit-actions');
    if (editActions) editActions.style.display = 'none';
    
    const messageOptionsBtn = messageElement.querySelector('.message-options-btn');
    if (messageOptionsBtn) messageOptionsBtn.style.display = 'block';
}

function deleteMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement || messageElement.classList.contains('deleting')) return;

    messageElement.classList.add('deleting');

    const originalContent = messageElement.querySelector('.message-bubble').innerHTML;
    const confirmationHtml = `
        <div class="delete-confirmation">
            <p>Are you sure?</p>
            <button class="confirm-delete-btn"><i class="fas fa-check"></i></button>
            <button class="cancel-delete-btn"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    messageElement.querySelector('.message-bubble').innerHTML = confirmationHtml;

    messageElement.querySelector('.confirm-delete-btn').onclick = async () => {
        try {
            await apiRequest(`/api/chat/messages/${messageId}`, 'DELETE');
            // The 'messageDeleted' socket event will handle removing the element
        } catch (error) {
            logger.error('Failed to delete message:', error);
            showNotification(`Failed to delete message: ${error.message}`, 'error');
            // Restore original content on failure
            messageElement.querySelector('.message-bubble').innerHTML = originalContent;
            messageElement.classList.remove('deleting');
        }
    };

    messageElement.querySelector('.cancel-delete-btn').onclick = () => {
        messageElement.querySelector('.message-bubble').innerHTML = originalContent;
        messageElement.classList.remove('deleting');
    };
}


function showChatScreen() {
    if (!gameState.isLoggedIn) {
        showNotification(getTranslation('pleaseLoginToUseChat'), 'info');
        return;
    }

    // Ensure the fake chat simulation is running if it's supposed to be
    if (localStorage.getItem('fakeChatActive') === 'true') {
        startFakeChatSimulation();
    }

    // Create and append the "New Messages" button if it doesn't exist
    if (!document.getElementById('newMessagesBtn')) {
        const chatContainer = document.querySelector('#chatModal .game-container');
        const chatMessagesDiv = document.getElementById('chatMessages');

        if (chatContainer && chatMessagesDiv) {
            const newMessagesBtn = document.createElement('button');
            newMessagesBtn.id = 'newMessagesBtn';
            newMessagesBtn.className = 'new-messages-btn';
            newMessagesBtn.style.display = 'none';
            newMessagesBtn.innerHTML = 'New Messages <i class="fas fa-arrow-down"></i>';
            chatContainer.appendChild(newMessagesBtn);

            // Add event listeners now that the button is created
            chatMessagesDiv.addEventListener('scroll', () => {
                if (chatMessagesDiv.scrollHeight - chatMessagesDiv.clientHeight <= chatMessagesDiv.scrollTop + 10) {
                    newMessagesBtn.style.display = 'none';
                }
            });

            newMessagesBtn.addEventListener('click', () => {
                chatMessagesDiv.scrollTo({
                    top: chatMessagesDiv.scrollHeight,
                    behavior: 'smooth'
                });
                newMessagesBtn.style.display = 'none';
            });
        }
    }

    document.getElementById('chatMessages').classList.add('messages-loading');
    document.getElementById('chatModal').style.display = 'block';
    document.getElementById('onlineUsersDropdown').classList.remove('active');
    document.body.classList.add('no-scroll');
    scrollToChatBottom();

    // Auto-focus the chat input
    setTimeout(() => {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.focus();
        }
    }, 150); // Delay to ensure modal is fully rendered

    // Reset unread messages for the current room
    if (gameState.unreadMessages[gameState.currentRoom]) {
        gameState.unreadMessages[gameState.currentRoom] = 0;
    }
    updateChatNotificationBadge();
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

function closeChatScreen() {
    document.getElementById('chatModal').style.display = 'none';
    document.getElementById('onlineUsersDropdown').classList.remove('active');
    document.body.classList.remove('no-scroll');
    document.dispatchEvent(new CustomEvent('uiStateChanged'));
}

// Generic Modal Functions
function showGenericModal(title, message, showTextarea, confirmBtnText, onConfirm, onCancel) {
    const genericModal = document.getElementById('genericModal');
    const genericModalTitle = document.getElementById('genericModalTitle');
    const genericModalMessage = document.getElementById('genericModalMessage');
    const genericModalTextarea = document.getElementById('genericModalTextarea');
    const genericModalConfirmBtn = document.getElementById('genericModalConfirmBtn');
    const genericModalCancelBtn = document.getElementById('genericModalCancelBtn');

    genericModalTitle.textContent = title;
    genericModalMessage.innerHTML = message; // Use innerHTML for potential markdown/HTML
    genericModalConfirmBtn.textContent = confirmBtnText;

    if (showTextarea) {
        genericModalTextarea.style.display = 'block';
        genericModalTextarea.value = genericModalMessage.textContent; // Pre-fill with message
        genericModalMessage.style.display = 'none'; // Hide message if textarea is shown
    } else {
        genericModalTextarea.style.display = 'none';
        genericModalMessage.style.display = 'block';
    }

    // Clear previous event listeners
    genericModalConfirmBtn.onclick = null;
    genericModalCancelBtn.onclick = null;

    // Attach new event listeners
    genericModalConfirmBtn.onclick = () => {
        onConfirm(showTextarea ? genericModalTextarea.value : null);
        hideGenericModal();
    };
    genericModalCancelBtn.onclick = () => {
        if (onCancel) onCancel();
        hideGenericModal();
    };

    genericModal.style.display = 'block';
    document.body.classList.add('no-scroll');
}

function hideGenericModal() {
    const genericModal = document.getElementById('genericModal');
    genericModal.style.display = 'none';
    document.body.classList.remove('no-scroll');
}

function populateChatRoomList() {
    const chatRoomList = document.getElementById('chatRoomList');
    if (!chatRoomList) return;

    // Define rooms with translation keys
    const rooms = [
        { id: 'Global', nameKey: 'chat_room_global' },
        { id: 'Europe', nameKey: 'chat_room_europe' },
        { id: 'Asia', nameKey: 'chat_room_asia' },
        { id: 'North-America', nameKey: 'chat_room_north_america' },
        { id: 'South-America', nameKey: 'chat_room_south_america' },
        { id: 'Africa', nameKey: 'chat_room_africa' },
        { id: 'Oceania', nameKey: 'chat_room_oceania' }
    ];

    // Add country-specific room to the beginning of the list if it exists
    if (gameState.playerCountry && countries[gameState.playerCountry]) {
        const countryCode = gameState.playerCountry.toLowerCase();
        const translationKey = `country_${countryCode}`;
        rooms.unshift({ id: `country-${gameState.playerCountry}`, nameKey: translationKey });
    }

    chatRoomList.innerHTML = ''; // Clear existing list

    rooms.forEach(room => {
        const listItem = document.createElement('li');
        listItem.className = 'chat-room-list-item';
        
        listItem.innerHTML = `
            <span class="chat-room-name">${getTranslation(room.nameKey) || room.name}</span>
            <span class="notification-badge room-badge" style="display: none;"></span>
        `;
        
        listItem.dataset.roomId = room.id;

        if (room.id === gameState.currentRoom) {
            listItem.classList.add('active');
        }

        listItem.addEventListener('click', () => switchRoom(room.id));
        chatRoomList.appendChild(listItem);
    });
}

function switchRoom(newRoom) {
    if (newRoom === gameState.currentRoom) {
        return; // Already in this room
    }

    socket.emit('joinRoom', {
        playerId: gameState.playerId,
        username: gameState.username,
        room: newRoom,
        avatarUrl: gameState.avatarUrl,
        level: gameState.level
    });

    gameState.currentRoom = newRoom;
    fetchChatMessages(newRoom);
    populateChatRoomList(); // Update active room in the list

    // --- PROFESSIONAL FIX: Restart simulation on room switch ---
    if (localStorage.getItem('fakeChatActive') === 'true') {
        stopFakeChatSimulation(); // Stop the old one
        startFakeChatSimulation(); // Start a new one for the new room
    }

    // Reset unread messages for the new room
    if (gameState.unreadMessages[newRoom]) {
        gameState.unreadMessages[newRoom] = 0;
    }
    updateChatNotificationBadge();
}

function setupEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtn = document.getElementById('emojiBtn');
    const chatInput = document.getElementById('chatInput');
    const categoriesContainer = emojiPicker.querySelector('.emoji-categories');
    const emojiListContainer = emojiPicker.querySelector('.emoji-list-container');
    const leftArrow = emojiPicker.querySelector('.left-arrow');
    const rightArrow = emojiPicker.querySelector('.right-arrow');

    const categoryIcons = {
        smileys: '😊',
        people: '👋',
        animals: '🐶',
        food: '🍔',
        activities: '⚽️',
        travel: '🚗',
        objects: '💻',
        symbols: '❤️',
        flags: '🏁'
    };

    // Populate categories
    for (const category in EMOJI_CATEGORIES) {
        const categoryBtn = document.createElement('button');
        categoryBtn.className = 'emoji-category-btn';
        categoryBtn.dataset.category = category;
        categoryBtn.dataset.i18n = `emojiCategory_${category}`;
        categoryBtn.innerHTML = `<span class="emoji-category-icon">${categoryIcons[category] || '❓'}</span> <span class="emoji-category-name" data-i18n="emojiCategory_${category}">${category}</span>`;
        categoriesContainer.appendChild(categoryBtn);

        categoryBtn.addEventListener('click', () => {
            // Set active button
            const currentActive = categoriesContainer.querySelector('.active');
            if(currentActive) currentActive.classList.remove('active');
            categoryBtn.classList.add('active');
            // Populate emojis for the selected category
            populateEmojiList(category);
        });
    }

    function populateEmojiList(category) {
        emojiListContainer.innerHTML = '';
        EMOJI_CATEGORIES[category].forEach(emoji => {
            const emojiSpan = document.createElement('span');
            emojiSpan.textContent = emoji;
            emojiSpan.addEventListener('click', () => {
                chatInput.value += emoji;
                chatInput.focus();
            });
            emojiListContainer.appendChild(emojiSpan);
        });
    }

    // Arrow button logic
    function updateArrowVisibility() {
        const isScrollable = categoriesContainer.scrollWidth > categoriesContainer.clientWidth;
        if (!isScrollable) {
            leftArrow.classList.add('hidden');
            rightArrow.classList.add('hidden');
            return;
        }
        leftArrow.classList.toggle('hidden', categoriesContainer.scrollLeft === 0);
        rightArrow.classList.toggle('hidden', categoriesContainer.scrollLeft + categoriesContainer.clientWidth >= categoriesContainer.scrollWidth - 5); // 5px buffer
    }

    leftArrow.addEventListener('click', () => {
        categoriesContainer.scrollLeft -= 100;
        updateArrowVisibility();
    });

    rightArrow.addEventListener('click', () => {
        categoriesContainer.scrollLeft += 100;
        updateArrowVisibility();
    });

    categoriesContainer.addEventListener('scroll', updateArrowVisibility);
    new ResizeObserver(updateArrowVisibility).observe(categoriesContainer);


    // Toggle emoji picker
    emojiBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        emojiPicker.classList.toggle('show');
        if (emojiPicker.classList.contains('show')) {
            updateArrowVisibility();
        }
    });

    // Close picker when clicking outside
    document.addEventListener('click', (event) => {
        if (!emojiPicker.contains(event.target) && !emojiBtn.contains(event.target)) {
            emojiPicker.classList.remove('show');
        }
    });

    // Initial population
    const firstCategory = Object.keys(EMOJI_CATEGORIES)[0];
    categoriesContainer.querySelector('.emoji-category-btn').classList.add('active');
    populateEmojiList(firstCategory);
    updateArrowVisibility();
}

window.setupEmojiPicker = setupEmojiPicker;
EmojiPicker = setupEmojiPicker;

function disconnectChat() {
    if (socket) {
        if (window.IS_DEVELOPMENT) {
            logger.debug('Disconnecting chat socket...');
        }
        socket.disconnect();
        socket = null;
    }
}

document.addEventListener('userLoggedOut', disconnectChat);

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('input', handleTyping);
    }

    // Add click listener for active users in chat
    const activeUserListSidebar = document.getElementById('activeUserListSidebar');
    if (activeUserListSidebar) {
        activeUserListSidebar.addEventListener('click', (event) => {
            const clickedItem = event.target.closest('.online-user-item');
            if (!clickedItem || !clickedItem.dataset.playerId) return;

            const playerId = clickedItem.dataset.playerId;

            // Check if the avatar was clicked by looking for the 'data-action' attribute
            if (event.target.closest('[data-action="view-avatar"]')) {
                const avatarUrl = clickedItem.querySelector('.online-user-avatar').src;
                showProfilePicture(avatarUrl);
            } else {
                // If anything else inside the item is clicked (username, empty space), show the profile
                document.getElementById('chatModal').style.display = 'none';
                gameState.returnTo = 'chat';
                showPlayerProfile(playerId);
            }
        });
    }
});

let fakeChatInterval = null;
let simulationUsers = [];
let pendingQuestions = []; // Tracks open questions: { id, tags, author, replies, timestamp }

// --- Programmatic Message Generation System ---

const messageGeneratorData = {
    en: {
        templates: {
            questions: [
                { text: "Anyone have {tips} for {topic_level}?", tags: ["tips", "topic_level"] },
                { text: "What's the best {strategy} for {topic_patterns}?", tags: ["strategy", "topic_patterns"] },
                { text: "How do you all get such {adjective_positive} scores?", tags: ["score"] },
                { text: "Is the server {adjective_negative} for anyone else?", tags: ["server"] },
                { text: "Has anyone actually beaten the {dev}'s score? 😈", tags: ["dev", "score"] },
                { text: "What's the fastest way to {verb_progress} in levels?", tags: ["verb_progress", "level"] },
                { text: "How does the {leaderboard} work exactly for {country}?", tags: ["leaderboard", "country"] },
                { text: "What's the current price of {token}?", tags: ["token", "token_price"] },
                { text: "When is the next {token_event} scheduled?", tags: ["token_event"] },
                { text: "Is it better to play {adverb_speed} or more {adverb_accuracy}?", tags: ["strategy"] },
                { text: "What are the {rewards} for {topic_players}?", tags: ["rewards", "topic_players"] },
                { text: "Any news on {nft} integration?", tags: ["nft", "news"] },
                { text: "Hey @{randomUser}, that last score was {adjective_positive}, how'd you do it?", tags: ["score", "user_interaction"] },
                { text: "What's the minimum score to get on the {leaderboard}?", tags: ["leaderboard", "score"] },
                { text: "Are there {teams} in this game?", tags: ["teams"] },
                { text: "How do you unlock the {cosmetics}?", tags: ["cosmetics"] },
                { text: "Is there a {roadmap} for future updates?", tags: ["roadmap", "news"] },
                { text: "What does the {score} on my profile mean? Is it all-time?", tags: ["score", "profile"] },
                { text: "Does playing on {platform} have an advantage over {platform}?", tags: ["platform", "strategy"] },
                { text: "Where is the best place to follow for {news}?", tags: ["news", "community_platform"] },
                { text: "Is anyone else {verb_saving} their {token} for something big?", tags: ["token", "verb_saving"] },
                { text: "What's the most {adjective_underrated} {powerup} in your opinion?", tags: ["powerup", "strategy"] },
                { text: "Do you guys listen to {music} while playing?", tags: ["music"] },
                { text: "How long did it take you to reach {level_milestone}?", tags: ["level_milestone", "verb_progress"] },
                { text: "How do I even play this game? What are the {rules}?", tags: ["rules", "new_player"] },
                { text: "What happens when I {verb_progress}?", tags: ["verb_progress", "rewards"] },
                { text: "Is this game {free_to_play}?", tags: ["free_to_play"] }
            ],
            answers: [
                { text: "Try to {verb_action} your {powerup} for the {later_stages}.", tags: ["strategy", "powerup", "later_stages"] },
                { text: "Focus on one {topic_patterns} at a time. Don't get overwhelmed.", tags: ["strategy", "topic_patterns"] },
                { text: "Just {verb_practice}, you'll get the hang of it! {muscle_memory} is key.", tags: ["verb_practice", "muscle_memory"] },
                { text: "The server seems {adjective_positive} for me.", tags: ["server"] },
                { text: "Not yet, but I'm getting close! The {dev}'s score is {adjective_insane}.", tags: ["dev", "score"] },
                { text: "It's all about {speed} and {accuracy}. Find a balance.", tags: ["strategy", "speed", "accuracy"] },
                { text: "The faster you are, the higher your {score_multiplier}.", tags: ["strategy", "score_multiplier"] },
                { text: "Your {score} contributes to your {country}'s total score. It's a team effort!", tags: ["score", "country", "leaderboard"] },
                { text: "Check the official {community_platform} for {token_price}.", tags: ["token_price", "community_platform"] },
                { text: "I think the {tokenomics} are explained in the {whitepaper}.", tags: ["tokenomics", "whitepaper"] },
                { text: "For {topic_level}, try to trace the pattern with your finger on the screen first.", tags: ["tips", "topic_level"] },
                { text: "{topic_players} get a bigger share of the daily {token_rewards}, I think.", tags: ["topic_players", "rewards"] },
                { text: "Like @{randomUser} said, staying {adjective_calm} is the best advice.", tags: ["tips", "user_interaction"] },
                { text: "I agree with @{randomUser}, {verb_practice} is the only way.", tags: ["verb_practice", "user_interaction"] },
                { text: "The {leaderboard} cutoff varies, but it's usually pretty high.", tags: ["leaderboard", "score"] },
                { text: "No official {teams} yet, but people are forming their own on {community_platform}.", tags: ["teams", "community_platform"] },
                { text: "You unlock {cosmetic} automatically as you {verb_progress}.", tags: ["cosmetics", "verb_progress"] },
                { text: "The {roadmap} is on the official website, check the 'About' section.", tags: ["roadmap", "news"] },
                { text: "Yes, {score} is your all-time best.", tags: ["score", "profile"] },
                { text: "{platform} definitely feels easier for complex patterns because of the bigger screen.", tags: ["platform", "strategy"] },
                { text: "The official {community_platform} and {community_platform} are the best for {news}.", tags: ["news", "community_platform"] },
                { text: "I'm {verb_saving} for the next {nft} drop!", tags: ["verb_saving", "nft"] },
                { text: "The '{powerup}' power-up is a lifesaver in the {later_stages}.", tags: ["powerup", "later_stages"] },
                { text: "I listen to {music}, helps me focus.", tags: ["music"] },
                { text: "It took me about a {time_duration} of casual play to get to {level_milestone}.", tags: ["level_milestone", "verb_progress"] },
                { text: "Welcome! You just have to {verb_action} the pattern of lit-up squares and repeat it.", tags: ["rules", "new_player"] },
                { text: "When you {verb_progress}, you get a new {cosmetic} for your avatar and access to harder levels.", tags: ["verb_progress", "cosmetic", "rewards"] },
                { text: "Yep, the game is {free_to_play}!", tags: ["free_to_play"] }
            ],
            statements: [
                { text: "Just broke my personal best! New {score}!", tags: ["score", "personal_achievement"] },
                { text: "Finally reached {level_milestone}!", tags: ["level_milestone", "personal_achievement"] },
                { text: "YES! Passed the level I was stuck on for {time_duration}.", tags: ["personal_achievement", "level"] },
                { text: "Just got a perfect score on a round! Feeling like a {adjective_genius}.", tags: ["score", "personal_achievement"] },
                { text: "My accuracy is over 95% this week. Feeling {adjective_proud}.", tags: ["accuracy", "personal_achievement"] },
                { text: "Another {score_milestone} score run, let's go!", tags: ["score_milestone", "personal_achievement"] },
                { text: "This game is so {adjective_addictive}! Can't stop playing.", tags: ["game_feedback"] },
                { text: "The new {animations} for leveling up look so {adjective_cool}.", tags: ["game_feedback", "animations"] },
                { text: "Time for one more game to climb the {leaderboard}.", tags: ["leaderboard"] },
                { text: "The new update is {adjective_great}, much smoother.", tags: ["game_feedback"] },
                { text: "That last round was {adjective_intense}.", tags: ["game_feedback"] },
                { text: "I can't believe I missed that last tile.", tags: ["gameplay_comment"] },
                { text: "The {music} in this game is surprisingly {adjective_good}.", tags: ["music", "game_feedback"] },
                { text: "The feeling of completing a complex pattern is the {adjective_best}.", tags: ["game_feedback"] },
                { text: "The competition is {adjective_fierce} today.", tags: ["leaderboard"] },
                { text: "Need to take a break, my brain hurts from {verb_gerund}.", tags: ["gameplay_comment"] },
                { text: "Go {country}! We're climbing the ranks.", tags: ["country", "leaderboard"] },
                { text: "Shoutout to the {devs} for being so {adjective_active} in the community.", tags: ["devs", "community"] },
                { text: "Holding my {token} tokens for the long run! 💎🙌", tags: ["token"] },
                { text: "Just claimed my daily {rewards}.", tags: ["rewards"] },
                { text: "@{randomUser} is on fire today on the {leaderboard}!", tags: ["leaderboard", "user_interaction"] },
                { text: "I think the {token} has huge potential.", tags: ["token"] },
                { text: "I wish there was a {feature_request_mode}.", tags: ["feature_request"] },
                { text: "A {feature_request_improvement} would be so cool.", tags: ["feature_request"] }
            ],
            reactions: [
                { text: "Wow, {adjective_positive} score!", tags: ["reaction_positive", "score"] }, { text: "GG!", tags: ["reaction_positive"] }, { text: "Congrats on the new level!", tags: ["reaction_positive", "level"] }, { text: "That's {adjective_awesome}!", tags: ["reaction_positive"] }, { text: "Keep it up!", tags: ["reaction_positive"] },
                { text: "Impressive memory!", tags: ["reaction_positive"] }, { text: "🔥🔥🔥", tags: ["reaction_positive"] }, { text: "🚀", tags: ["reaction_positive"] }, { text: "OMG!", tags: ["reaction_positive"] }, { text: "No way, that's a {adjective_insane} score!", tags: ["reaction_positive", "score"] },
                { text: "You're a {legend}!", tags: ["reaction_positive"] }, { text: "Clean!", tags: ["reaction_positive"] }, { text: "Well played!", tags: ["reaction_positive"] }, { text: "Props to @{randomUser}!", tags: ["reaction_positive", "user_interaction"] }, { text: "Nice!", tags: ["reaction_positive"] }, { text: "Sick!", tags: ["reaction_positive"] },
                { text: "Thanks for the {tip}!", tags: ["reaction_thanks", "tip"] }, { text: "Ah, that makes sense.", tags: ["reaction_thanks"] }, { text: "Good advice, thanks!", tags: ["reaction_thanks"] }, { text: "I'll try that next time.", tags: ["reaction_thanks"] },
                { text: "That's a good point.", tags: ["reaction_agreement"] }, { text: "lol", tags: ["reaction_agreement"] }, { text: "True.", tags: ["reaction_agreement"] }, { text: "So true!", tags: ["reaction_agreement"] }, { text: "Couldn't have said it better myself.", tags: ["reaction_agreement"] }, { text: "Exactly!", tags: ["reaction_agreement"] }, { text: "I agree.", tags: ["reaction_agreement"] },
                { text: "So close!", tags: ["reaction_negative"] }, { text: "Nice try!", tags: ["reaction_negative"] }, { text: "Unlucky.", tags: ["reaction_negative"] }, { text: "RIP.", tags: ["reaction_negative"] }, { text: "F in the chat.", tags: ["reaction_negative"] }, { text: "Oof.", tags: ["reaction_negative"] }, { text: "That hurts.", tags: ["reaction_negative"] }, { text: "Pain.", tags: ["reaction_negative"] },
                { text: "Congrats @{randomUser}!", tags: ["reaction_positive", "user_interaction"] }
            ]
        },
        dictionaries: {
            tips: ["tips", "tricks", "advice", "hints", "secrets"],
            topic_level: ["level {level}", "this level", "the current stage"],
            strategy: ["strategy", "tactic", "approach", "method", "plan"],
            topic_patterns: ["the color patterns", "the memory sequences", "the grids", "the hard patterns"],
            adjective_positive: ["high", "great", "amazing", "awesome", "incredible", "solid"],
            adjective_negative: ["laggy", "slow", "buggy", "choppy"],
            dev: ["developer", "dev", "creator"],
            verb_progress: ["level up", "progress", "advance", "get better"],
            leaderboard: ["leaderboard", "ranking", "scoreboard"],
            token: ["$CIPHER", "token", "coin"],
            token_event: ["token burn", "airdrop", "giveaway"],
            adverb_speed: ["fast", "quickly", "rapidly"],
            adverb_accuracy: ["accurately", "precisely", "carefully"],
            rewards: ["rewards", "payouts", "earnings", "incentives"],
            topic_players: ["top players", "the best players", "high-level players", "pros"],
            nft: ["NFT", "collectible"],
            verb_saving: ["saving", "stacking", "hodling", "accumulating"],
            adjective_underrated: ["underrated", "overlooked", "slept on"],
            powerup: ["power-up", "booster", "item"],
            music: ["music", "tunes", "soundtrack", "beats"],
            level_milestone: ["level {level}", "level 5", "level 10"],
            rules: ["rules", "basics", "fundamentals"],
            free_to_play: ["free to play", "free", "F2P"],
            later_stages: ["later stages", "endgame", "the final rounds"],
            muscle_memory: ["muscle memory", "instinct", "reflexes"],
            adjective_insane: ["insane", "crazy", "unbelievable", "ridiculous"],
            speed: ["speed", "quickness"],
            accuracy: ["accuracy", "precision"],
            score_multiplier: ["score multiplier", "combo bonus", "multiplier"],
            token_price: ["token price", "price", "value"],
            tokenomics: ["tokenomics", "economics"],
            whitepaper: ["whitepaper", "docs", "documentation"],
            adjective_calm: ["calm", "cool", "composed"],
            community_platform: ["Discord", "Telegram", "forums"],
            time_duration: ["a week", "a few days", "a month"],
            cosmetic: ["border", "avatar frame", "cosmetic"],
            adjective_genius: ["genius", "mastermind", "savant"],
            adjective_proud: ["proud", "pleased", "satisfied"],
            score_milestone: ["1 million", "2 million", "5 million"],
            adjective_addictive: ["addictive", "engaging", "captivating"],
            animations: ["animations", "effects", "visuals"],
            adjective_cool: ["cool", "awesome", "neat", "slick"],
            adjective_great: ["great", "fantastic", "amazing"],
            adjective_intense: ["intense", "crazy", "wild"],
            adjective_good: ["good", "great", "solid", "fire"],
            adjective_best: ["best", "greatest", "most satisfying"],
            adjective_fierce: ["fierce", "tough", "intense"],
            verb_gerund: ["memorizing", "grinding", "playing"],
            adjective_active: ["active", "responsive", "engaged"],
            feature_request_mode: ["practice mode", "1v1 mode", "spectate mode", "zen mode"],
            feature_request_improvement: ["customizable themes", "more stats", "seasonal events"],
            adjective_awesome: ["awesome", "amazing", "incredible"],
            legend: ["legend", "god", "master", "pro"],
            tip: ["tip", "advice", "hint"]
        }
    },
    tr: {
        templates: {
            questions: [
                { text: "{topic_level} i\u00e7in bir {tips} olan var m\u0131?", tags: ["tips", "topic_level"] },
                { text: "{topic_patterns} i\u00e7in en iyi {strategy} nedir?", tags: ["strategy", "topic_patterns"] },
                { text: "Nas\u0131l bu kadar {adjective_positive} puanlar al\u0131yorsunuz?", tags: ["score"] },
                { text: "Sunucu ba\u015fka birinde de {adjective_negative} m\u0131?", tags: ["server"] },
                { text: "{dev}'in skorunu ge\u00e7en oldu mu? \ud83d\ude08", tags: ["dev", "score"] },
                { text: "Seviyelerde {verb_progress} i\u00e7in en h\u0131zl\u0131 yol nedir?", tags: ["verb_progress", "level"] },
                { text: "{country} i\u00e7in {leaderboard} tam olarak nas\u0131l \u00e7al\u0131\u015f\u0131yor?", tags: ["leaderboard", "country"] },
                { text: "{token} fiyat\u0131 \u015fu an ne kadar?", tags: ["token", "token_price"] },
                { text: "Bir sonraki {token_event} ne zaman planland\u0131?", tags: ["token_event"] },
                { text: "{adverb_speed} oynamak m\u0131 daha iyi yoksa daha {adverb_accuracy} m\u0131?", tags: ["strategy"] },
                { text: "{topic_players} i\u00e7in {rewards} nelerdir?", tags: ["rewards", "topic_players"] },
                { text: "{nft} entegrasyonu hakk\u0131nda bir haber var m\u0131?", tags: ["nft", "news"] },
                { text: "Hey @{randomUser}, son skorun {adjective_positive} idi, nas\u0131l yapt\u0131n?", tags: ["score", "user_interaction"] },
                { text: "{leaderboard}'a girmek i\u00e7in minimum skor ne kadar?", tags: ["leaderboard", "score"] },
                { text: "Bu oyunda {teams} var m\u0131?", tags: ["teams"] },
                { text: "{cosmetics} nas\u0131l a\u00e7\u0131l\u0131r?", tags: ["cosmetics"] },
                { text: "Gelecek g\u00fcncellemeler i\u00e7in bir {roadmap} var m\u0131?", tags: ["roadmap", "news"] },
                { text: "Profilimdeki {score} ne anlama geliyor? T\u00fcm zamanlar\u0131n en iyisi mi?", tags: ["score", "profile"] },
                { text: "{platform} \u00fczerinde oynaman\u0131n {platform} \u00fczerinde oynamaya g\u00f6re bir avantaj\u0131 var m\u0131?", tags: ["platform", "strategy"] },
                { text: "{news} i\u00e7in takip edilecek en iyi yer neresi?", tags: ["news", "community_platform"] },
                { text: "Ba\u015fka kimse b\u00fcy\u00fck bir \u015fey i\u00e7in {token}'ini {verb_saving} mu?", tags: ["token", "verb_saving"] },
                { text: "Sizce en {adjective_underrated} {powerup} hangisi?", tags: ["powerup", "strategy"] },
                { text: "Oynarken {music} dinliyor musunuz?", tags: ["music"] },
                { text: "{level_milestone}'a ula\u015fman\u0131z ne kadar s\u00fcrd\u00fc?", tags: ["level_milestone", "verb_progress"] },
                { text: "Bu oyunu nas\u0131l oynar\u0131m? {rules} nelerdir?", tags: ["rules", "new_player"] },
                { text: "{verb_progress} yapt\u0131\u011f\u0131mda ne olur?", tags: ["verb_progress", "rewards"] },
                { text: "Bu oyun {free_to_play} mi?", tags: ["free_to_play"] }
            ],
            answers: [
                { text: "{powerup}lar\u0131n\u0131 {later_stages} i\u00e7in {verb_action} \u00e7al\u0131\u015f.", tags: ["strategy", "powerup", "later_stages"] },
                { text: "Her seferinde bir {topic_patterns}'a odaklan. Kafan\u0131 kar\u0131\u015ft\u0131rma.", tags: ["strategy", "topic_patterns"] },
                { text: "Sadece {verb_practice} yap, al\u0131\u015f\u0131rs\u0131n! {muscle_memory} \u00f6nemli.", tags: ["verb_practice", "muscle_memory"] },
                { text: "Sunucu bende {adjective_positive} g\u00f6r\u00fcn\u00fcyor.", tags: ["server"] },
                { text: "Hen\u00fcz de\u011fil, ama yakla\u015f\u0131yorum! {dev}'in skoru {adjective_insane}.", tags: ["dev", "score"] },
                { text: "Her \u015fey {speed} ve {accuracy} ile ilgili. Bir denge bul.", tags: ["strategy", "speed", "accuracy"] },
                { text: "Ne kadar h\u0131zl\u0131ysan, {score_multiplier} o kadar y\u00fcksek olur.", tags: ["strategy", "score_multiplier"] },
                { text: "Senin {score}'un {country}'nin toplam skoruna katk\u0131da bulunuyor. Bu bir takım oyunu!", tags: ["score", "country", "leaderboard"] },
                { text: "{token_price} i\u00e7in resmi {community_platform}'u kontrol et.", tags: ["token_price", "community_platform"] },
                { text: "San\u0131r\u0131m {tokenomics} {whitepaper}'da a\u00e7\u0131klanm\u0131\u015f.", tags: ["tokenomics", "whitepaper"] },
                { text: "{topic_level} i\u00e7in, \u00f6nce deseni parma\u011f\u0131nla ekranda izlemeyi dene.", tags: ["tips", "topic_level"] },
                { text: "{topic_players} g\u00fcnl\u00fck {token_rewards}'dan daha b\u00fcy\u00fck bir pay al\u0131yor san\u0131r\u0131m.", tags: ["topic_players", "rewards"] },
                { text: "@{randomUser}'\u0131n dedi\u011fi gibi, {adjective_calm} kalmak en iyi tavsiye.", tags: ["tips", "user_interaction"] },
                { text: "@{randomUser}'a kat\u0131l\u0131yorum, {verb_practice} tek yol.", tags: ["verb_practice", "user_interaction"] },
                { text: "{leaderboard} s\u0131n\u0131r\u0131 de\u011fi\u015fiyor, ama genelde oldukça y\u00fcksek.", tags: ["leaderboard", "score"] },
                { text: "Hen\u00fcz resmi {teams} yok, ama insanlar {community_platform}'da kendi tak\u0131mlar\u0131n\u0131 kuruyor.", tags: ["teams", "community_platform"] },
                { text: "{verb_progress} yapt\u0131k\u00e7a {cosmetics} otomatik olarak a\u00e7\u0131l\u0131r.", tags: ["cosmetics", "verb_progress"] },
                { text: "{roadmap} resmi web sitesinde, 'Hakk\u0131nda' b\u00f6l\u00fcm\u00fcn\u00fc kontrol et.", tags: ["roadmap", "news"] },
                { text: "Evet, {score} t\u00fcm zamanlar\u0131n en iyi skorun.", tags: ["score", "profile"] },
                { text: "{platform} kesinlikle karma\u015f\u0131k desenler i\u00e7in daha kolay hissettiriyor, daha b\u00fcy\u00fck ekran sayesinde.", tags: ["platform", "strategy"] },
                { text: "Resmi {community_platform} ve {community_platform} {news} i\u00e7in en iyisi.", tags: ["news", "community_platform"] },
                { text: "Bir sonraki {nft} d\u00fc\u015f\u00fc\u015f\u00fc i\u00e7in {verb_saving} yap\u0131yorum!", tags: ["verb_saving", "nft"] },
                { text: "'{powerup}' g\u00fc\u00e7lendirmesi {later_stages}'da hayat kurtar\u0131c\u0131.", tags: ["powerup", "later_stages"] },
                { text: "{music} dinliyorum, odaklanmama yard\u0131mc\u0131 oluyor.", tags: ["music"] },
                { text: "{level_milestone}'a ula\u015fmak yakla\u015f\u0131k bir {time_duration} s\u00fcrd\u00fc.", tags: ["level_milestone", "verb_progress"] },
                { text: "Ho\u015f geldin! Sadece yanan karelerin desenini {verb_action} ve tekrarla.", tags: ["rules", "new_player"] },
                { text: "{verb_progress} yapt\u0131\u011f\u0131nda, avatar\u0131n i\u00e7in yeni bir {cosmetic} al\u0131rs\u0131n ve daha zor seviyelere eri\u015firsin.", tags: ["verb_progress", "cosmetic", "rewards"] },
                { text: "Evet, oyun {free_to_play}!", tags: ["free_to_play"] }
            ],
            statements: [
                { text: "Kendi rekorumu k\u0131rd\u0131m! Yeni {score}!", tags: ["score", "personal_achievement"] },
                { text: "Sonunda {level_milestone}'a ula\u015ft\u0131m!", tags: ["level_milestone", "personal_achievement"] },
                { text: "EVET! {time_duration} boyunca tak\u0131l\u0131p kald\u0131\u011f\u0131m seviyeyi ge\u00e7tim.", tags: ["personal_achievement", "level"] },
                { text: "Bir turda m\u00fckemmel bir skor yapt\u0131m! Kendimi bir {adjective_genius} gibi hissediyorum.", tags: ["score", "personal_achievement"] },
                { text: "Bu hafta do\u011frulu\u011fum %95'in \u00fczerinde. {adjective_proud} hissediyorum.", tags: ["accuracy", "personal_achievement"] },
                { text: "Bir ba\u015fka {score_milestone} skor ko\u015fusu, hadi bakal\u0131m!", tags: ["score_milestone", "personal_achievement"] },
                { text: "Bu oyun \u00e7ok {adjective_addictive}! Oynamay\u0131 b\u0131rakam\u0131yorum.", tags: ["game_feedback"] },
                { text: "Seviye atlama i\u00e7in yeni {animations} \u00e7ok {adjective_cool} g\u00f6r\u00fcn\u00fcyor.", tags: ["game_feedback", "animations"] },
                { text: "{leaderboard}'a t\u0131rmanmak i\u00e7in bir oyun daha zaman\u0131.", tags: ["leaderboard"] },
                { text: "Yeni g\u00fcncelleme {adjective_great}, \u00e7ok daha ak\u0131c\u0131.", tags: ["game_feedback"] },
                { text: "Son tur {adjective_intense} idi.", tags: ["game_feedback"] },
                { text: "Son karoyu ka\u00e7\u0131rd\u0131\u011f\u0131ma inanam\u0131yorum.", tags: ["gameplay_comment"] },
                { text: "Bu oyundaki {music} \u015fa\u015f\u0131rt\u0131c\u0131 derecede {adjective_good}.", tags: ["music", "game_feedback"] },
                { text: "Karma\u015f\u0131k bir deseni tamamlaman\u0131n hissi en {adjective_best} olan\u0131.", tags: ["game_feedback"] },
                { text: "Rekabet bug\u00fcn {adjective_fierce}.", tags: ["leaderboard"] },
                { text: "Bir mola vermem laz\u0131m, beynim {verb_gerund} y\u00fcz\u00fcnden a\u011fr\u0131yor.", tags: ["gameplay_comment"] },
                { text: "Haydi {country}! S\u0131ralamada y\u00fckseliyoruz.", tags: ["country", "leaderboard"] },
                { text: "Toplulukta bu kadar {adjective_active} olduklar\u0131 i\u00e7in {devs}'e te\u015fekk\u00fcrler.", tags: ["devs", "community"] },
                { text: "{token} tokenlar\u0131m\u0131 uzun vade i\u00e7in tutuyorum! \ud83d\udc8e\ud83d\ude4c", tags: ["token"] },
                { text: "G\u00fcnl\u00fck {rewards}'\u0131m\u0131 yeni ald\u0131m.", tags: ["rewards"] },
                { text: "@{randomUser} bug\u00fcn {leaderboard}'da yan\u0131yor!", tags: ["leaderboard", "user_interaction"] },
                { text: "Bence {token}'in b\u00fcy\u00fck bir potansiyeli var.", tags: ["token"] },
                { text: "Ke\u015fke bir {feature_request_mode} olsayd\u0131.", tags: ["feature_request"] },
                { text: "Bir {feature_request_improvement} \u00e7ok g\u00fczel olurdu.", tags: ["feature_request"] }
            ],
            reactions: [
                { text: "Vay, {adjective_positive} skor!", tags: ["reaction_positive", "score"] }, { text: "GG!", tags: ["reaction_positive"] }, { text: "Yeni seviyen i\u00e7in tebrikler!", tags: ["reaction_positive", "level"] }, { text: "Bu {adjective_awesome}!", tags: ["reaction_positive"] }, { text: "Devam et!", tags: ["reaction_positive"] },
                { text: "Etkileyici haf\u0131za!", tags: ["reaction_positive"] }, { text: "\ud83d\udd25\ud83d\udd25\ud83d\udd25", tags: ["reaction_positive"] }, { text: "\ud83d\ude80", tags: ["reaction_positive"] }, { text: "Aman Tanr\u0131m!", tags: ["reaction_positive"] }, { text: "Olamaz, bu {adjective_insane} bir skor!", tags: ["reaction_positive", "score"] },
                { text: "Sen bir {legend}s\u0131n!", tags: ["reaction_positive"] }, { text: "Temiz!", tags: ["reaction_positive"] }, { text: "\u0130yi oynad\u0131n!", tags: ["reaction_positive"] }, { text: "@{randomUser}'a tebrikler!", tags: ["reaction_positive", "user_interaction"] }, { text: "G\u00fczel!", tags: ["reaction_positive"] }, { text: "Harika!", tags: ["reaction_positive"] },
                { text: "{tip} i\u00e7in te\u015fekk\u00fcrler!", tags: ["reaction_thanks", "tip"] }, { text: "Ah, bu mant\u0131kl\u0131.", tags: ["reaction_thanks"] }, { text: "\u0130yi tavsiye, te\u015fekk\u00fcrler!", tags: ["reaction_thanks"] }, { text: "Bir dahaki sefere bunu deneyece\u011fim.", tags: ["reaction_thanks"] },
                { text: "Bu iyi bir nokta.", tags: ["reaction_agreement"] }, { text: "lol", tags: ["reaction_agreement"] }, { text: "Do\u011fru.", tags: ["reaction_agreement"] }, { text: "\u00c7ok do\u011fru!", tags: ["reaction_agreement"] }, { text: "Daha iyi s\u00f6ylenemezdi.", tags: ["reaction_agreement"] }, { text: "Kesinlikle!", tags: ["reaction_agreement"] }, { text: "Kat\u0131l\u0131yorum.", tags: ["reaction_agreement"] },
                { text: "\u00c7ok yak\u0131nd\u0131!", tags: ["reaction_negative"] }, { text: "\u0130yi deneme!", tags: ["reaction_negative"] }, { text: "Talihsizlik.", tags: ["reaction_negative"] }, { text: "RIP.", tags: ["reaction_negative"] }, { text: "F.", tags: ["reaction_negative"] }, { text: "Oof.", tags: ["reaction_negative"] }, { text: "Bu ac\u0131tt\u0131.", tags: ["reaction_negative"] }, { text: "Ac\u0131.", tags: ["reaction_negative"] },
                { text: "Tebrikler @{randomUser}!", tags: ["reaction_positive", "user_interaction"] }
            ]
        },
        dictionaries: {
            tips: ["tavsiye", "ipucu", "t\u00fcyo", "s\u0131r"],
            topic_level: ["seviye {level}", "bu seviye", "mevcut a\u015fama"],
            strategy: ["strateji", "taktik", "yakla\u015f\u0131m", "y\u00f6ntem", "plan"],
            topic_patterns: ["renk desenleri", "haf\u0131za dizileri", "\u0131zgaralar", "zor desenler"],
            adjective_positive: ["y\u00fcksek", "harika", "inan\u0131lmaz", "m\u00fckemmel", "sa\u011flam"],
            adjective_negative: ["kas\u0131yor", "yava\u015f", "hatal\u0131", "tak\u0131l\u0131yor"],
            dev: ["geli\u015ftirici", "dev", "yarat\u0131c\u0131"],
            verb_progress: ["seviye atlamak", "ilerlemek", "geli\u015fmek"],
            leaderboard: ["lider tablosu", "s\u0131ralama", "puan tablosu"],
            token: ["$CIPHER", "token", "coin"],
            token_event: ["token yakma", "airdrop", "\u00e7ekili\u015f"],
            adverb_speed: ["h\u0131zl\u0131", "\u00e7abuk", "seri"],
            adverb_accuracy: ["do\u011fru", "hassas", "dikkatli"],
            rewards: ["\u00f6d\u00fcller", "kazan\u00e7lar", "te\u015fvikler"],
            topic_players: ["en iyi oyuncular", "y\u00fcksek seviyeli oyuncular", "profesyoneller"],
            nft: ["NFT", "koleksiyon"],
            verb_saving: ["biriktiriyorum", "y\u0131\u011f\u0131yorum", "hodl yap\u0131yorum"],
            adjective_underrated: ["hak etti\u011fi de\u011feri g\u00f6rmeyen", "g\u00f6zden ka\u00e7an"],
            powerup: ["g\u00fc\u00e7lendirme", "bonus", "\u00f6\u011fe"],
            music: ["m\u00fczik", "par\u00e7alar", "melodiler"],
            level_milestone: ["seviye {level}", "seviye 5", "seviye 10"],
            rules: ["kurallar", "temeller", "esaslar"],
            free_to_play: ["oynamas\u0131 \u00fccretsiz", "\u00fccretsiz", "F2P"],
            later_stages: ["sonraki a\u015famalar", "oyun sonu", "final turlar\u0131"],
            muscle_memory: ["kas haf\u0131zas\u0131", "i\u00e7g\u00fcd\u00fc", "refleks"],
            adjective_insane: ["\u00e7\u0131lg\u0131n", "inan\u0131lmaz", "ak\u0131l almaz"],
            speed: ["h\u0131z", "s\u00fcrat"],
            accuracy: ["do\u011fruluk", "hassasiyet"],
            score_multiplier: ["puan \u00e7arpan\u0131", "kombo bonusu", "\u00e7arpan"],
            token_price: ["token fiyat\u0131", "fiyat", "de\u011fer"],
            tokenomics: ["tokenomi", "ekonomi"],
            whitepaper: ["whitepaper", "dok\u00fcmanlar", "belgeler"],
            adjective_calm: ["sakin", "so\u011fukkanl\u0131"],
            community_platform: ["Discord", "Telegram", "forumlar"],
            time_duration: ["bir hafta", "birka\u00e7 g\u00fcn", "bir ay"],
            cosmetic: ["\u00e7er\u00e7eve", "avatar \u00e7er\u00e7evesi", "kozmetik"],
            adjective_genius: ["dahi", "usta", "bilge"],
            adjective_proud: ["gururlu", "memnun", "tatmin olmu\u015f"],
            score_milestone: ["1 milyon", "2 milyon", "5 milyon"],
            adjective_addictive: ["ba\u011f\u0131ml\u0131l\u0131k yap\u0131c\u0131", "s\u00fcr\u00fckleyici", "etkileyici"],
            animations: ["animasyonlar", "efektler", "g\u00f6rseller"],
            adjective_cool: ["haval\u0131", "harika", "g\u00fczel"],
            adjective_great: ["harika", "fantastik", "inan\u0131lmaz"],
            adjective_intense: ["yo\u011fun", "heyecanl\u0131", "\u00e7\u0131lg\u0131n"],
            adjective_good: ["iyi", "harika", "sa\u011flam"],
            adjective_best: ["en iyi", "en harika", "en tatmin edici"],
            adjective_fierce: ["\u00e7etin", "zorlu", "yo\u011fun"],
            verb_gerund: ["ezberlemek", "kasmak", "oynamak"],
            adjective_active: ["aktif", "ilgili", "etkile\u015fime a\u00e7\u0131k"],
            feature_request_mode: ["al\u0131\u015ft\u0131rma modu", "1v1 modu", "izleyici modu", "zen modu"],
            feature_request_improvement: ["\u00f6zelle\u015ftirilebilir temalar", "daha fazla istatistik", "sezonluk etkinlikler"],
            adjective_awesome: ["harika", "inan\u0131lmaz", "m\u00fckemmel"],
            legend: ["efsane", "kral", "usta", "pro"],
            tip: ["tavsiye", "ipucu", "t\u00fcyo"]
        }
    }
};

let messageTemplates = {}; // This will be populated by the generator

function generateMessages(lang = 'en') {
    const langData = messageGeneratorData[lang];
    if (!langData) {
        console.error(`Message generator data for language '${lang}' not found.`);
        return {};
    }

    const generatedTemplates = {};

    for (const type in langData.templates) {
        generatedTemplates[type] = [];
        const templates = langData.templates[type];

        templates.forEach(templateObj => {
            let variations = [templateObj]; // Pass the whole object to retain tags
            const placeholders = templateObj.text.match(/\{([a-zA-Z_]+)\}/g) || [];

            placeholders.forEach(placeholder => {
                const key = placeholder.substring(1, placeholder.length - 1);
                const dictionary = langData.dictionaries[key];
                if (dictionary) {
                    const newVariations = [];
                    variations.forEach(variation => {
                        dictionary.forEach(word => {
                            newVariations.push({ ...variation, text: variation.text.replace(placeholder, word) });
                        });
                    });
                    variations = newVariations;
                }
            });

            variations.forEach(variationObj => {
                generatedTemplates[type].push(variationObj);
            });
        });
    }
    return generatedTemplates;
}


// --- Simulation Logic ---

async function startFakeChatSimulation(lang = 'en') {
    console.log(`[Fake Chat Debug] startFakeChatSimulation called with lang: ${lang}`);
    if (fakeChatInterval) {

        return;
    }

    messageTemplates = generateMessages(lang);
    console.log(`[Fake Chat Debug] messageTemplates after generation for ${lang}:`, messageTemplates);
    console.log(`[Fake Chat Debug] messageTemplates after generation for ${lang}:`, messageTemplates);
    if (!messageTemplates || Object.keys(messageTemplates).length === 0) {
        console.error(`Could not generate message templates for language: ${lang}. Aborting simulation.`);
        showNotification(`Failed to load chat simulation for ${lang}.`, "error");
        return;
    }

    if (simulationUsers.length === 0) {
        try {
            const response = await fetch('/api/profile/users/simulation-list');
            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
            const fetchedData = await response.json();
            if (!Array.isArray(fetchedData) || fetchedData.length === 0) throw new Error('No user data returned from API.');
            simulationUsers = fetchedData.map(u => ({ ...u, playerId: u.id, avatarUrl: u.avatarurl }));
        } catch (error) {
            showNotification(`Error starting chat simulation: ${error.message}`, "error");
            console.error(`Fake Chat: Error during user fetch: ${error.message}.`);
            return;
        }
    }

    if (simulationUsers.length === 0) {
        showNotification("Cannot start simulation: No users available.", "error");
        return;
    }

    const numUsersToAdd = Math.min(Math.floor(Math.random() * 6) + 5, simulationUsers.length);
    const shuffledUsers = [...simulationUsers].sort(() => 0.5 - Math.random());
    const activeFakeUsersInList = shuffledUsers.slice(0, numUsersToAdd);

    activeFakeUsersInList.forEach(user => {
        if (!document.querySelector(`.online-user-item[data-player-id="${user.playerId}"]`)) {
            addUserToList(user);
        }
    });

    fakeChatInterval = setInterval(() => {
        const randomUser = simulationUsers[Math.floor(Math.random() * simulationUsers.length)];
        if (String(randomUser.id) === String(gameState.playerId)) return;

        const message = getNextFakeMessage(randomUser);
        if (!message) return;

        console.log(`[Fake Chat Debug] Message text before final processing: ${message.text}`);

        const fakeMessagePayload = {
            id: `fake-${Date.now()}`,
            senderId: randomUser.id || randomUser.playerId,
            username: randomUser.username,
            avatarUrl: randomUser.avatarurl || randomUser.avatarUrl,
            level: randomUser.level,
            message: message.text,
            timestamp: new Date().toISOString(),
            room: gameState.currentRoom,
            isSystem: false
        };

        const initialDelay = Math.random() * 2000;
        setTimeout(() => {
            updateTypingIndicator([randomUser.username]);
            const typingDuration = Math.max(1000, (message.text.length / 50) * 1000 + Math.random() * 1500);
            setTimeout(() => {
                updateTypingIndicator([]);
                displayMessage(fakeMessagePayload);
                scrollToChatBottom();
            }, typingDuration);
        }, initialDelay);

    }, Math.random() * 4000 + 3000);
}

function replacePlaceholders(text, values) {
    let result = text;
    for (const key in values) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]);
    }
    return result;
}

function getNextFakeMessage(user) {
    // Clean up old questions that were never answered
    const now = Date.now();
    pendingQuestions = pendingQuestions.filter(q => (now - q.timestamp) < 60000); // Remove questions older than 60 seconds

    const dynamicValues = {
        level: user.level || '1',
        country: user.country || '??',
        score: (Math.floor(Math.random() * 100000) + 1000).toLocaleString(),
        score_milestone: (Math.floor(Math.random() * 5) + 1) * 1000000,
        time_duration: ['a few minutes', 'an hour', 'a day', 'a week'][Math.floor(Math.random() * 4)],
        platform: ['mobile', 'PC'][Math.floor(Math.random() * 2)],
    };

    // Handle @randomUser placeholder
    const otherUsers = simulationUsers.filter(u => String(u.id) !== String(user.id));
    if (otherUsers.length > 0) {
        dynamicValues.randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)].username;
    } else {
        dynamicValues.randomUser = 'a player';
    }

    // --- Advanced Conversation Logic ---

    // 1. Chance to answer a pending question
    if (pendingQuestions.length > 0 && Math.random() < 0.5) { // 50% chance to try and answer
        const questionToAnswer = pendingQuestions[0]; // Try to answer the oldest question

        // Ensure the user isn't answering their own question
        if (questionToAnswer.author !== user.username) {
            const relevantAnswers = messageTemplates.answers.filter(ans => ans.tags.some(tag => questionToAnswer.tags.includes(tag)));
            if (relevantAnswers.length > 0) {
                const answerTemplate = relevantAnswers[Math.floor(Math.random() * relevantAnswers.length)];
                
                // When replying, the {randomUser} placeholder should refer to the question's author
                const replyDynamicValues = { ...dynamicValues, randomUser: questionToAnswer.author };
                const text = replacePlaceholders(answerTemplate.text, replyDynamicValues);

                questionToAnswer.replies++;
                // If a question gets 2 replies or is old, remove it.
                if (questionToAnswer.replies >= 2) {
                    pendingQuestions.shift(); // Remove the answered question
                }
                return { text };
            }
        }
    }

    // 2. Chance to ask a new question
    if (Math.random() < 0.2 && messageTemplates.questions && messageTemplates.questions.length > 0) { // 20% chance to ask
        const questionTemplate = messageTemplates.questions[Math.floor(Math.random() * messageTemplates.questions.length)];
        const text = replacePlaceholders(questionTemplate.text, dynamicValues);
        
        // Add to pending questions queue
        pendingQuestions.push({
            id: `q-${Date.now()}`,
            tags: questionTemplate.tags,
            author: user.username,
            replies: 0,
            timestamp: Date.now()
        });

        return { text };
    }

    // 3. Otherwise, make a statement or reaction
    const otherTypes = ['statements', 'reactions'].filter(type => messageTemplates[type] && messageTemplates[type].length > 0);
    if (otherTypes.length === 0) return null;
    
    const randomType = otherTypes[Math.floor(Math.random() * otherTypes.length)];
    const messageTemplate = messageTemplates[randomType][Math.floor(Math.random() * messageTemplates[randomType].length)];
    const text = replacePlaceholders(messageTemplate.text, dynamicValues);

    return { text };
}

function stopFakeChatSimulation() {
    if (fakeChatInterval) {
        console.log("Stopping fake chat simulation...");
        clearInterval(fakeChatInterval);
        fakeChatInterval = null;
        simulationUsers = [];
        pendingQuestions = []; // Clear the new conversation state
    }
}

// Listen for events from the admin panel
window.addEventListener('start-fake-chat', (event) => {
    const lang = event.detail && event.detail.lang ? event.detail.lang : 'en';
    startFakeChatSimulation(lang);
});
window.addEventListener('stop-fake-chat', stopFakeChatSimulation);

// Make function globally available
window.sendMessage = sendMessage;

// Check on initial load
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('fakeChatActive') === 'true') {
        const initialLang = localStorage.getItem('fakeChatLang') || 'en'; // Get language from localStorage
        setTimeout(() => startFakeChatSimulation(initialLang), 5000); // Pass it
    }
});

// Placeholder for showProfilePicture function
// This function should ideally open a modal or lightbox to display the avatar.
function showProfilePicture(avatarUrl) {
    console.log('Showing profile picture:', avatarUrl);
    // TODO: Implement a proper image modal/lightbox here
    // Example: openImageModal(avatarUrl);
}
