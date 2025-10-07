require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initDatabase, getDatabase } = require('./config/db');
const { router: authRoutes, JWT_SECRET } = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { setupWebSocketServer } = require('./sockets/gameSocket');

(async () => {
  try {
    await initDatabase();
    const db = getDatabase();

    const app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use(express.static('public'));

    app.use('/api', authRoutes);
    app.use('/api', gameRoutes);
    app.use('/api', chatRoutes);

    const server = app.listen(3000, () => {
      console.log("Server running on http://localhost:3000");
    });

    // setupWebSocketServer(server, JWT_SECRET);

  } catch (err) {
    console.error("DB init failed:", err);
  }
})();
