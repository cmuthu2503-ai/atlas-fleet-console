const rateLimit = require('express-rate-limit');
const config = require('../config');

const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimits.messagesPerMin,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Rate limit exceeded. Max 60 messages per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimits.uploadsPerMin,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Rate limit exceeded. Max 10 uploads per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { messageRateLimiter, uploadRateLimiter };
