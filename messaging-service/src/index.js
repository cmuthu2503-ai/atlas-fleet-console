/**
 * Atlas Fleet Console - Backend API Server
 * T-070: In-App Messaging System
 */
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { authenticateToken } = require('./middleware/auth');
const conversationsRouter = require('./routes/conversations');
const receiptsRouter = require('./routes/receipts');
const attachmentsRouter = require('./routes/attachments');
const { setupWebSocketGateway } = require('./ws/gateway');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check (no auth)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'atlas-messaging' }));

// All API routes require authentication
app.use('/api/v1/conversations', authenticateToken, conversationsRouter);
app.use('/api/v1', authenticateToken, receiptsRouter);
app.use('/api/v1', authenticateToken, attachmentsRouter);

// Error handler
app.use((err, req, res, next) => {
  // Multer errors (file validation, size limits)
  if (err.message && (err.message.includes('not allowed') || err.message.includes('File too large'))) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum 25MB per file.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);

// WebSocket gateway
setupWebSocketGateway(server);

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`Atlas Messaging API running on port ${config.port}`);
  });
}

module.exports = { app, server };
