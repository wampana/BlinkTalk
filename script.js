// WebSocket connection
let ws = null;
let isConnected = false;
let currentChatType = null;
let localStream = null;
let peerConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

// DOM Elements
const welcomeScreen = document.querySelector('.welcome-screen');
const chatContainer = document.querySelector('.chat-container');
const videoContainer = document.querySelector('.video-container');
const settingsModal = document.querySelector('.settings-modal');
const settingsBtn = document.querySelector('.settings-btn');
const closeSettingsBtn = document.querySelector('.close-btn');

// Initialize WebSocket connection
function connectWebSocket() {
    // Get the current host and protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        isConnected = true;
        reconnectAttempts = 0;
        console.log('Connected to server');
        updateUIForConnection();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onclose = () => {
        isConnected = false;
        console.log('Disconnected from server');
        handleDisconnect();
        attemptReconnect();
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        handleDisconnect();
    };
}

// Reconnection mechanism
function attemptReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        
        setTimeout(() => {
            if (!isConnected) {
                connectWebSocket();
            }
        }, RECONNECT_DELAY);
    } else {
        console.log('Max reconnection attempts reached');
        displaySystemMessage('Connection failed. Please refresh the page to try again.');
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'system':
            displaySystemMessage(data.text);
            break;
        case 'chat':
            displayMessage(data.text, 'stranger');
            break;
        case 'offer':
            handleOffer(data.offer);
            break;
        case 'answer':
            handleAnswer(data.answer);
            break;
        case 'candidate':
            handleCandidate(data.candidate);
            break;
    }
}

// Start chat session
function startChat(type) {
    currentChatType = type;
    welcomeScreen.style.display = 'none';

    if (type === 'text') {
        chatContainer.style.display = 'flex';
        videoContainer.style.display = 'none';
        connectWebSocket();
    } else {
        chatContainer.style.display = 'none';
        videoContainer.style.display = 'flex';
        startVideoChat();
    }
}

// Video chat functionality
async function startVideoChat() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        document.getElementById('local-video').srcObject = localStream;
        connectWebSocket();
        initializePeerConnection();
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Error accessing camera and microphone. Please check your permissions.');
    }
}

// WebRTC peer connection
function initializePeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };

    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
        document.getElementById('remote-video').srcObject = event.streams[0];
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate
            }));
        }
    };
}

// Handle WebRTC signaling
async function handleOffer(offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({
        type: 'answer',
        answer: answer
    }));
}

async function handleAnswer(answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleCandidate(candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Chat functionality
function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message && isConnected) {
        ws.send(JSON.stringify({
            type: 'chat',
            text: message
        }));
        displayMessage(message, 'user');
        input.value = '';
    }
}

function sendVideoMessage() {
    const input = document.getElementById('video-message-input');
    const message = input.value.trim();
    
    if (message && isConnected) {
        ws.send(JSON.stringify({
            type: 'chat',
            text: message
        }));
        displayMessage(message, 'user');
        input.value = '';
    }
}

function displayMessage(text, sender) {
    const messagesContainer = currentChatType === 'text' 
        ? document.querySelector('.chat-messages')
        : document.querySelector('.video-chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displaySystemMessage(text) {
    const messagesContainer = currentChatType === 'text' 
        ? document.querySelector('.chat-messages')
        : document.querySelector('.video-chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// UI updates
function updateUIForConnection() {
    const messageInput = document.getElementById('message-input');
    const videoMessageInput = document.getElementById('video-message-input');
    if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = 'Type a message...';
    }
    if (videoMessageInput) {
        videoMessageInput.disabled = false;
        videoMessageInput.placeholder = 'Type a message...';
    }
}

function handleDisconnect() {
    displaySystemMessage('Disconnected from server. Please refresh the page to reconnect.');
    const messageInput = document.getElementById('message-input');
    const videoMessageInput = document.getElementById('video-message-input');
    if (messageInput) {
        messageInput.disabled = true;
        messageInput.placeholder = 'Disconnected...';
    }
    if (videoMessageInput) {
        videoMessageInput.disabled = true;
        videoMessageInput.placeholder = 'Disconnected...';
    }
}

// Settings functionality
function toggleSettings() {
    settingsModal.style.display = settingsModal.style.display === 'none' ? 'flex' : 'none';
}

function updateSettings() {
    const audioInput = document.getElementById('audio-input').value;
    const videoInput = document.getElementById('video-input').value;
    const themeInput = document.getElementById('theme-input').value;

    // Update audio/video devices if changed
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = audioInput === 'on';
        });
        localStream.getVideoTracks().forEach(track => {
            track.enabled = videoInput === 'on';
        });
    }

    // Update theme
    document.body.className = themeInput;

    toggleSettings();
}

// End chat session
function endChat() {
    if (currentChatType === 'video' && localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (ws) {
        ws.close();
    }
    welcomeScreen.style.display = 'block';
    chatContainer.style.display = 'none';
    videoContainer.style.display = 'none';
    currentChatType = null;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Chat input handlers
    const messageInput = document.getElementById('message-input');
    const videoMessageInput = document.getElementById('video-message-input');

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (videoMessageInput) {
        videoMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendVideoMessage();
            }
        });
    }

    // Settings handlers
    settingsBtn.addEventListener('click', toggleSettings);
    closeSettingsBtn.addEventListener('click', toggleSettings);

    // Back button handlers
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (currentChatType === 'video' && localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (ws) {
                ws.close();
            }
            welcomeScreen.style.display = 'block';
            chatContainer.style.display = 'none';
            videoContainer.style.display = 'none';
        });
    });

    // Video control handlers
    const muteBtn = document.querySelector('.mute-btn');
    const videoBtn = document.querySelector('.video-btn');
    const endBtn = document.querySelector('.end-btn');

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                audioTrack.enabled = !audioTrack.enabled;
                muteBtn.innerHTML = audioTrack.enabled ? 
                    '<i class="fas fa-microphone"></i>' : 
                    '<i class="fas fa-microphone-slash"></i>';
            }
        });
    }

    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = !videoTrack.enabled;
                videoBtn.innerHTML = videoTrack.enabled ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
            }
        });
    }

    if (endBtn) {
        endBtn.addEventListener('click', () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (ws) {
                ws.close();
            }
            welcomeScreen.style.display = 'block';
            videoContainer.style.display = 'none';
        });
    }
}); 