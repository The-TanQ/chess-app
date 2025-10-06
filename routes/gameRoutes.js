const express = require('express');
const { getDatabase } = require('../config/db');

const router = express.Router();

// Leaderboard
router.get('/leaderboard', async (req, res) => {
  const db = getDatabase();
  const [rows] = await db.execute('SELECT user_id as id, username, elo_rating as rating FROM users ORDER BY elo_rating DESC LIMIT 50');
  res.json(rows);
});

module.exports = router;