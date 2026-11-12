// src/app.js
// Express application factory — separate from server startup for testability.
'use strict';

const express           = require('express');
const { json }          = require('express');
const cors              = require('cors');
const { ApolloServer }  = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { typeDefs }      = require('./graphql/typeDefs');
const resolvers         = require('./graphql/resolvers');

// Route modules
const eventsRouter      = require('./routes/v1/events');
const authRouter        = require('./routes/v1/auth');
const bookingsRouter    = require('./routes/v1/bookings');

// ── Rate limiter ──────────────────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,          // 1-minute window
  max:      120,                 // 120 requests / minute per IP
  standardHeaders: 'draft-7',   // emits RateLimit-* headers (RFC draft-7)
  legacyHeaders: false,
  handler(req, res) {
    res.set('Retry-After', Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000));
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Retry after the window resets.' },
    });
  },
});

// ── Build app ─────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();

  app.use(cors());
  app.use(json());
  app.use(limiter);

  // ── Health check ──────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ── REST API v1 ───────────────────────────────────────────────────────
  app.use('/api/v1/events',   eventsRouter);
  app.use('/api/v1/auth',     authRouter);
  app.use('/api/v1/bookings', bookingsRouter);

  // ── Swagger UI (docs) ────────────────────────────────────────────────────
  const docsRouter = require('./routes/docs');
  app.use('/docs', docsRouter);

  // ── Apollo / GraphQL ──────────────────────────────────────────────────
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();

  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }) => ({ token: req.headers.authorization }),
    }),
  );

  // ── Global error handler ──────────────────────────────────────────────
  app.use((err, _req, res, _next) => {
    const status  = err.status || 500;
    const code    = err.code   || 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'An unexpected error occurred.';
    res.status(status).json({ error: { code, message } });
  });

  return app;
}

module.exports = { buildApp };
