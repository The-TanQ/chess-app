const express = require('express');
const { getDatabase } = require('../config/db');

const router = express.Router();

// Get chat messages for a game
router.get('/chat/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const db = getDatabase();
  const [rows] = await db.execute(
    'SELECT cm.message_text, cm.sent_at, u.username FROM chat_messages cm JOIN users u ON cm.user_id = u.user_id WHERE cm.game_id = ? ORDER BY cm.sent_at ASC',
    [gameId]
  );
  res.json(rows);
});

module.exports = router;