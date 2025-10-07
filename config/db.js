const mysql = require('mysql2/promise');

let pool; // shared pool instance

async function initDatabase() {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Create tables
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      elo_rating INT DEFAULT 1200,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS games (
      game_id INT AUTO_INCREMENT PRIMARY KEY,
      white_player_id INT NOT NULL,
      black_player_id INT NOT NULL,
      result ENUM('white', 'black', 'draw', 'ongoing') DEFAULT 'ongoing',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP NULL,
      FOREIGN KEY (white_player_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (black_player_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS moves (
      move_id INT AUTO_INCREMENT PRIMARY KEY,
      game_id INT NOT NULL,
      move_number INT NOT NULL,
      move_notation VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      message_id INT AUTO_INCREMENT PRIMARY KEY,
      game_id INT NOT NULL,
      user_id INT NOT NULL,
      message_text TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS elo_history (
      history_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      old_rating INT NOT NULL,
      new_rating INT NOT NULL,
      change_reason ENUM('game_result') DEFAULT 'game_result',
      game_id INT,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE OR REPLACE VIEW leaderboard AS
    SELECT 
      user_id,
      username,
      elo_rating,
      RANK() OVER (ORDER BY elo_rating DESC) AS rank_position
    FROM users
  `);

  console.log("Database initialized.");
  return pool;
}

function getDatabase() {
  if (!pool) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return pool;
}

module.exports = { initDatabase, getDatabase };
