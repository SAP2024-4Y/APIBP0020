// src/middleware/auth.js
// JWT verification middleware — attach req.user on success.
'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'events-ticketing-secret-key';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header.' },
    });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' },
    });
  }
}

module.exports = { requireAuth, JWT_SECRET };
