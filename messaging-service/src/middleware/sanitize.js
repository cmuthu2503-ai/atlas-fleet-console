const xss = require('xss');

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body.content === 'string') {
    req.body.content = xss(req.body.content);
  }
  next();
}

module.exports = { sanitizeBody };
