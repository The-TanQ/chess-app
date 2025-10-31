console.log("APP.JS LOADED AND RUNNING.");

let socket, board, game, currentGameId, token, playerColor, isInGame = false;

// AUTH
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

// SOCKET
function connectSocket() {
    socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
        console.log('WebSocket connected');
        socket.send(JSON.stringify({type: 'auth', token}));
    };

    socket.onmessage = handleMessage;
    socket.onerror = (error) => console.error('WebSocket error:', error);
    socket.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(() => {
            if (token) connectSocket(); // Reconnect if we have a token
        }, 3000);
    };
}

function handleMessage(event) {
    const msg = JSON.parse(event.data);
    console.log('Received message:', msg);

    switch(msg.type) {
        case 'auth_ok':
            document.getElementById('game-status').textContent = `Welcome, ${msg.user.username}!`;
            break;

        case 'queued':
            document.getElementById('game-status').textContent = 'Looking for opponent...';
            document.getElementById('find-match').disabled = true;
            break;

        case 'match_found':
            currentGameId = msg.gameId;
            playerColor = msg.color;
            isInGame = true;

            document.getElementById('game-panel').style.display = 'block';
            document.getElementById('find-match').style.display = 'none';
            document.getElementById('resign').style.display = 'inline-block';
            document.getElementById('game-status').textContent =
                `Game found! You are ${playerColor}.`;
            document.getElementById('chat-input').disabled = false;

            initGameBoard();
            break;

        case 'move_made':
            if (game && msg.fen) {
                game.load(msg.fen);
                board.position(msg.fen);
                updateGameStatus();
            }
            break;

        case 'chat_message':
            appendChat(msg.username, msg.message);
            break;

        case 'game_over':
            isInGame = false;
            document.getElementById('game-status').textContent =
                `Game Over: ${msg.result}${msg.your_new_rating ? ` | New Rating: ${msg.your_new_rating}` : ''}`;

            document.getElementById('find-match').style.display = 'inline-block';
            document.getElementById('find-match').disabled = false;
            document.getElementById('resign').style.display = 'none';
            document.getElementById('chat-input').disabled = true;
            alert(`Game Over: ${msg.result}`);
            break;

        case 'opponent_disconnected':
            isInGame = false;
            document.getElementById('game-status').textContent = 'Opponent disconnected';
            document.getElementById('find-match').style.display = 'inline-block';
            document.getElementById('find-match').disabled = false;
            document.getElementById('resign').style.display = 'none';
            document.getElementById('chat-input').disabled = true;
            break;
        
        case 'error':
            console.error('Server error:', msg.message);
            if (msg.message.includes('invalid game')) {
                document.getElementById('game-status').textContent = 'Chat only available during games';
            }
            break;
    }
}

// CHESS BOARD
function destroyBoard() {
    if (board && typeof board.destroy === 'function') board.destroy();
    const boardDiv = document.getElementById('board');
    boardDiv.innerHTML = '';
}

function initLobbyBoard() {
    console.log("Attempting to initialize Lobby Board..."); 
    destroyBoard();
    board = Chessboard('board', {
        position: 'start',
        draggable: false,
        pieceTheme: 'lib/img/chesspieces/wikipedia/{piece}.png'
    });
    console.log("Lobby Board initialized (if no errors follow).");
}

function initGameBoard() {
    destroyBoard();
    game = new Chess();

    board = Chessboard('board', {
        position: 'start',
        orientation: playerColor,
        draggable: true,
        pieceTheme: 'lib/img/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    });

    updateGameStatus();
}

function onDragStart(source, piece, position, orientation) {
    if (!isInGame || game.game_over()) return false; 
    
    const pieceColor = piece.charAt(0);
    const playerPieceColor = playerColor === 'white' ? 'w' : 'b';
    return pieceColor === playerPieceColor && game.turn() === playerPieceColor;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'move',
            gameId: currentGameId,
            from: source,
            to: target,
            promotion: 'q'
        }));
    }

    updateGameStatus();
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateGameStatus() {
    if (!game) return;
    let status = '';
    
    if (game.in_checkmate()) {
        status = `CHECKMATE! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`;
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {
        status = 'Game is a DRAW.';
    } else {
        const turn = game.turn() === 'w' ? 'White' : 'Black';
        status = `${turn} to move`;
        if (game.in_check()) { // Check state
            status += ' (Check!)';
        }
    }
    document.getElementById('game-status').textContent = status;
}

// CHAT 
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    if (!isInGame || !currentGameId) {
        return;
    }
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            socket.send(JSON.stringify({
                type: 'chat',
                gameId: currentGameId,
                message: message
            }));
            input.value = '';
        } catch (error) {
            console.error('Failed to send chat message:', error);
        }
    }
}

function appendChat(username, message) {
    const chatDiv = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.innerHTML = `<b>${username}:</b> ${message}`;
    chatDiv.appendChild(messageDiv);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

//LeaderBoard
async function loadLeaderboard() {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = data.map((player, index) => 
        `<div>${index + 1}. ${player.username} - ${player.rating}</div>`
    ).join('');
}
// UI HANDLERS 
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login').onclick = async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (!username || !password) return alert('Enter username and password');

        const result = await login(username, password);
        if (result.token) {
            document.getElementById('auth-panel').style.display = 'none';
            document.getElementById('game-panel').style.display = 'block';
            console.log("Login Success: Calling initLobbyBoard.");
            initLobbyBoard();
            loadLeaderboard();
        } else {
            alert(result.message || 'Login failed');
        }
        document.getElementById('chat-input').disabled = true;
    };

    document.getElementById('register').onclick = async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (!username || !password) return alert('Enter username and password');

        const result = await register(username, password);
        alert(result.message || 'Registration completed');
    };

    document.getElementById('find-match').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({type: 'find_match'}));
        } else {
            alert('Not connected to server');
        }
    };

    document.getElementById('send-chat').onclick = sendChatMessage;
    document.getElementById('chat-input').onkeypress = (e) => { if (e.key === 'Enter') sendChatMessage(); };

    document.getElementById('resign').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            const confirmed = window.confirm('Are you sure you want to resign?');
            if (confirmed) {
                socket.send(JSON.stringify({type: 'resign', gameId: currentGameId}));
            }
        }
    };
});
