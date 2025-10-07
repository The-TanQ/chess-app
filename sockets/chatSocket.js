const { getDatabase } = require('../config/db');

async function handleChatMessage(ws, data, games) {
  const { gameId, message } = data;
  const g = games.get(gameId);
  if (!g || !ws.user) {
    ws.send(JSON.stringify({ type: 'error', message: 'invalid game or user' }));
    return;
  }
  
  // save to database if user is registered
  if (ws.user.id) {
    const db = getDatabase();
    await db.execute('INSERT INTO chat_messages (game_id, user_id, message_text) VALUES (?, ?, ?)',
      [gameId, ws.user.id, message]);
  }
  
  // broadcast to both players
  const chatPayload = { type: 'chat_message', username: ws.user.username, message, timestamp: new Date().toISOString() };
  g.whiteSocket.send(JSON.stringify(chatPayload));
  g.blackSocket.send(JSON.stringify(chatPayload));
}

module.exports = { handleChatMessage };