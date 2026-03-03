/**
 * JWT Authentication Middleware
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: decoded.sub || decoded.id,
      role: decoded.role || 'user',
      email: decoded.email,
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function authenticateWsToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return {
      id: decoded.sub || decoded.id,
      role: decoded.role || 'user',
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

module.exports = { authenticateToken, authenticateWsToken };
