const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initDatabase } = require('./config/db');
const { router: authRoutes, JWT_SECRET } = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { setupWebSocketServer } = require('./sockets/gameSocket');

(async () => {
  // Initialize database
  await initDatabase();

  // Express app
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use(express.static('public'));

  // Routes
  app.use('/api', authRoutes);
  app.use('/api', gameRoutes);
  app.use('/api', chatRoutes);

  const server = app.listen(3000, () => {
    console.log('Server listening on http://localhost:3000');
  });

  // Setup WebSocket server
  setupWebSocketServer(server, JWT_SECRET);
})();