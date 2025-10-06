const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { Chess } = require('chess.js');
const { getDatabase } = require('../config/db');
const { eloUpdate } = require('../utils/elo');
const { handleChatMessage } = require('./chatSocket');

// Basic in-memory matchmaking & games
const waiting = []; // queue of sockets waiting for match
const games = new Map(); // gameId -> { chess, whiteSocket, blackSocket, whiteUser, blackUser, moves }

function setupWebSocketServer(server, JWT_SECRET) {
  const wss = new WebSocket.Server({ server });

  // Attach metadata to socket
  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // store user info after auth message
    ws.on('message', async (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'auth') {
          // data.token optional - for logged-in users; else anonymous guest
          if (data.token) {
            try {
              const payload = jwt.verify(data.token, JWT_SECRET);
              ws.user = { id: payload.id, username: payload.username };
            } catch (e) {
              ws.send(JSON.stringify({ type: 'error', message: 'invalid token' }));
              return;
            }
          } else {
            // guest
            ws.user = { id: null, username: 'Guest_' + Math.floor(Math.random() * 10000) };
          }
          ws.send(JSON.stringify({ type: 'auth_ok', user: ws.user }));
        }

        // join matchmaking queue
        if (data.type === 'find_match') {
          if (!ws.user) {
            ws.send(JSON.stringify({ type: 'error', message: 'not authenticated (send auth first)' }));
            return;
          }
          waiting.push(ws);
          ws.send(JSON.stringify({ type: 'queued' }));

          // if we have 2 waiting players, create game
          if (waiting.length >= 2) {
            const p1 = waiting.shift();
            const p2 = waiting.shift();
            const chess = new Chess();
            const gameId = Date.now() + '_' + Math.floor(Math.random() * 1000);
            // assign white randomly
            const white = Math.random() < 0.5 ? p1 : p2;
            const black = white === p1 ? p2 : p1;

            games.set(gameId, {
              chess,
              whiteSocket: white,
              blackSocket: black,
              whiteUser: white.user,
              blackUser: black.user,
              moves: []
            });

            // attach gameId on sockets
            white.gameId = gameId; white.color = 'w';
            black.gameId = gameId; black.color = 'b';

            // notify
            const payload = { type: 'match_found', gameId, white: white.user.username, black: black.user.username, color: 'w' };
            white.send(JSON.stringify({ ...payload, color: 'white' }));
            black.send(JSON.stringify({ ...payload, color: 'black' }));
          }
        }

        // handle chat messages
        if (data.type === 'chat') {
          handleChatMessage(ws, data, games);
        }

        // handle moves from clients
        if (data.type === 'move') {
          const { gameId, from, to, promotion } = data;
          const g = games.get(gameId);
          if (!g) {
            ws.send(JSON.stringify({ type: 'error', message: 'game not found' }));
            return;
          }
          const chess = g.chess;
          // ensure correct side
          const isWhite = ws === g.whiteSocket;
          if ((isWhite && chess.turn() !== 'w') || (!isWhite && chess.turn() !== 'b')) {
            ws.send(JSON.stringify({ type: 'error', message: 'not your turn' }));
            return;
          }

          const moveObj = { from, to };
          if (promotion) moveObj.promotion = promotion;
          const move = chess.move(moveObj);
          if (!move) {
            ws.send(JSON.stringify({ type: 'invalid_move' }));
            return;
          }
          g.moves.push(move.san);

          // broadcast move to both
          const payload = { type: 'move_made', move: move.san, from, to, fen: chess.fen(), pgn: chess.pgn() };
          g.whiteSocket.send(JSON.stringify(payload));
          g.blackSocket.send(JSON.stringify(payload));

          // check for game over
          if (chess.game_over()) {
            let result;
            if (chess.in_checkmate()) {
              // side that just moved wins
              const lastMovedColor = chess.turn() === 'w' ? 'b' : 'w';
              result = lastMovedColor === 'w' ? '1-0' : '0-1';
            } else {
              result = '1/2-1/2';
            }

            // persist game to DB and update ELO if both players are registered
            const whiteId = g.whiteUser.id;
            const blackId = g.blackUser.id;
            const db = getDatabase();
            await db.execute('INSERT INTO games (white_player_id, black_player_id, result) VALUES (?, ?, ?)',
              [whiteId, blackId, result]);

            // update ratings if both logged-in users
            if (whiteId && blackId) {
              const [wRows] = await db.execute('SELECT elo_rating FROM users WHERE user_id = ?', [whiteId]);
              const [bRows] = await db.execute('SELECT elo_rating FROM users WHERE user_id = ?', [blackId]);
              const wRow = wRows[0];
              const bRow = bRows[0];
              let Rw = wRow ? wRow.elo_rating : 1200;
              let Rb = bRow ? bRow.elo_rating : 1200;
              let scoreW = 0.5, scoreB = 0.5;
              if (result === '1-0') { scoreW = 1; scoreB = 0; }
              else if (result === '0-1') { scoreW = 0; scoreB = 1; }

              const newRw = eloUpdate(Rw, Rb, scoreW);
              const newRb = eloUpdate(Rb, Rw, scoreB);

              await db.execute('UPDATE users SET elo_rating = ? WHERE user_id = ?', [newRw, whiteId]);
              await db.execute('UPDATE users SET elo_rating = ? WHERE user_id = ?', [newRb, blackId]);

              // notify players about updated ratings
              g.whiteSocket.send(JSON.stringify({ type: 'game_over', result, your_new_rating: newRw }));
              g.blackSocket.send(JSON.stringify({ type: 'game_over', result, your_new_rating: newRb }));
            } else {
              // guest or partial
              g.whiteSocket.send(JSON.stringify({ type: 'game_over', result }));
              g.blackSocket.send(JSON.stringify({ type: 'game_over', result }));
            }

            // cleanup
            games.delete(gameId);
          }
        }
      } catch (err) {
        console.error('WebSocket error:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'server error' }));
      }
    });

    ws.on('close', () => {
      // remove from waiting queue if present
      const idx = waiting.indexOf(ws);
      if (idx !== -1) waiting.splice(idx, 1);
      
      // handle game abandonment if in active game
      if (ws.gameId) {
        const g = games.get(ws.gameId);
        if (g) {
          const opponent = ws === g.whiteSocket ? g.blackSocket : g.whiteSocket;
          if (opponent) {
            opponent.send(JSON.stringify({ type: 'opponent_disconnected' }));
          }
          games.delete(ws.gameId);
        }
      }
    });
  });

  // Heartbeat to detect broken connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

module.exports = { setupWebSocketServer };