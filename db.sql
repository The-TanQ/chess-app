
-- Chess Game Database Schema

-- Drop existing database if needed
DROP DATABASE IF EXISTS chess_app;
CREATE DATABASE chess_app;
USE chess_app;


-- Users Table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    elo_rating INT DEFAULT 1200,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Games Table
CREATE TABLE games (
    game_id INT AUTO_INCREMENT PRIMARY KEY,
    white_player_id INT NOT NULL,
    black_player_id INT NOT NULL,
    result ENUM('white', 'black', 'draw', 'ongoing') DEFAULT 'ongoing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    FOREIGN KEY (white_player_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (black_player_id) REFERENCES users(user_id) ON DELETE CASCADE
);


-- Moves Table
CREATE TABLE moves (
    move_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    move_number INT NOT NULL,
    move_notation VARCHAR(10) NOT NULL,   -- e.g. e4, Nf3, O-O
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);


-- Chat Messages Table
CREATE TABLE chat_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    message_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);


-- Elo Rating History
CREATE TABLE elo_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    old_rating INT NOT NULL,
    new_rating INT NOT NULL,
    change_reason ENUM('game_result') DEFAULT 'game_result',
    game_id INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE SET NULL
);


-- Leaderboard View
CREATE VIEW leaderboard AS
SELECT 
    user_id,
    username,
    elo_rating,
    RANK() OVER (ORDER BY elo_rating DESC) AS rank_position
FROM users;
