# Chess App

A real-time multiplayer chess game built with Node.js, WebSockets, and Chess.js.

## Features

- Real-time multiplayer chess gameplay
- User registration and authentication
- ELO rating system
- In-game chat
- Responsive web interface

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Setup**
   - Make sure MySQL is running on your system
   - Update the `.env` file with your database credentials
   - The application will automatically create the required tables

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Access the Game**
   - Open your browser and go to `http://localhost:3000`
   - Register a new account or login
   - Click "Find Match" to start playing

## How to Play

1. **Register/Login**: Create an account or login with existing credentials
2. **Find Match**: Click the "Find Match" button to join the matchmaking queue
3. **Play**: Once matched with an opponent, drag and drop pieces to make moves
4. **Chat**: Use the chat panel to communicate with your opponent
5. **Game End**: Games end when there's checkmate, stalemate, or other draw conditions

## Technical Details

- **Backend**: Node.js with Express
- **Database**: MySQL
- **Real-time Communication**: WebSockets
- **Chess Logic**: Chess.js library
- **Board UI**: Chessboard.js
- **Authentication**: JWT tokens

## Environment Variables

Make sure your `.env` file contains:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chess
JWT_SECRET=your_secret_key
PORT=3000
```

## Game Rules

- Standard chess rules apply
- Players are automatically assigned colors (white/black)
- White moves first
- Games are rated using the ELO rating system
- Chat is available during games