let socket, board, game, currentGameUuid, token, playerColor;

// Auth
async function register(username, password) {
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
    });
    return res.json();
}

async function login(username, password) {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
    });
    const data = await res.json();
    if (data.token) {
        token = data.token;
        connectSocket();
    }
    return data;
}

// WebSocket
function connectSocket() {
    socket = new WebSocket('ws://localhost:3000');
    socket.onopen = () => socket.send(JSON.stringify({type: 'auth', token}));
    socket.onmessage = handleMessage;
}

function handleMessage(event) {
    const msg = JSON.parse(event.data);
    
    if (msg.type === 'match_found') {
        currentGameUuid = msg.gameUuid;
        playerColor = msg.color;
        initBoard();
        if (msg.chats) showChats(msg.chats);
    }
    
    if (msg.type === 'move_made') {
        board.position(msg.fen);
    }
    
    if (msg.type === 'chat') {
        appendChat(msg.username, msg.message);
    }
    
    if (msg.type === 'game_over') {
        alert(`Game Over: ${msg.result}${msg.newRating ? ` New Rating: ${msg.newRating}` : ''}`);
    }
}

// Chess Board
function initBoard() {
    board = Chessboard('board', {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        onDragStart: (source, piece) => {
            return piece.charAt(0) === playerColor.charAt(0);
        },
        onDrop: (source, target) => {
            const promotion = (piece.charAt(1) === 'P' && (target.charAt(1) === '8' || target.charAt(1) === '1')) ? 'q' : null;
            board.move(`${source}-${target}`);
            socket.send(JSON.stringify({
                type: 'move',
                gameUuid: currentGameUuid,
                from: source,
                to: target,
                promotion
            }));
        }
    });
}

// UI Event Listeners
document.getElementById('login').onclick = async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const result = await login(username, password);
    if (result.token) {
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('game-panel').style.display = 'block';
    }
};

document.getElementById('register').onclick = async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    await register(username, password);
};

document.getElementById('find-match').onclick = () => {
    socket.send(JSON.stringify({type: 'find_match'}));
};

function showChats(chats) {
    chats.forEach(chat => appendChat(chat.username, chat.message));
}

function appendChat(username, message) {
    const chatDiv = document.getElementById('chat-messages');
    chatDiv.innerHTML += `<div><b>${username}:</b> ${message}</div>`;
    chatDiv.scrollTop = chatDiv.scrollHeight;
}