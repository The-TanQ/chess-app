const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/db');

const router = express.Router();
const JWT_SECRET = 'change_this_secret_in_production';

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username + password required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const db = getDatabase();
    const [result] = await db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    const user = { id: result.insertId, username, rating: 1200 };
    return res.json({ token: signToken(user), user });
  } catch (err) {
    return res.status(400).json({ error: 'username taken' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDatabase();
  const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
  const row = rows[0];
  if (!row) return res.status(400).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(400).json({ error: 'invalid credentials' });
  const { user_id: id, elo_rating: rating } = row;
  const token = signToken({ id, username, rating });
  return res.json({ token, user: { id, username, rating } });
});

module.exports = { router, JWT_SECRET };