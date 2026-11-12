// src/routes/v1/auth.js
// POST /api/v1/auth/token — issues a signed JWT for the demo account.
'use strict';

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const { JWT_SECRET } = require('../../middleware/auth');

const USERS = {
  demo: { password: 'demo-password', userId: 'user-demo', role: 'user' },
};

router.post('/token', (req, res) => {
  const { username, password } = req.body || {};

  const user = USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
    });
  }

  const token = jwt.sign(
    { userId: user.userId, username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' },
  );

  return res.json({ token });
});

module.exports = router;
