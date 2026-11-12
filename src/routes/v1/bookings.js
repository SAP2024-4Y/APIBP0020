// src/routes/v1/bookings.js
// REST handlers for the Calendar API — booking slots, create, list, cancel.
'use strict';

const express = require('express');
const router  = express.Router();

const { requireAuth }    = require('../../middleware/auth');
const {
  getAvailableSlots,
  createBooking,
  cancelBooking,
  listBookings,
} = require('../../models/booking');

// ---------------------------------------------------------------------------
// GET /api/v1/bookings/slots?starts_at=...&ends_at=...
// Public — no auth required.  Returns OPEN/UPCOMING events in the window.
// ---------------------------------------------------------------------------
router.get('/slots', (req, res, next) => {
  try {
    const { starts_at, ends_at } = req.query;
    const slots = getAvailableSlots({ starts_at, ends_at });
    res.json({ data: slots, count: slots.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/bookings?starts_at=...&ends_at=...
// Auth required — returns the authenticated user's bookings in the window.
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res, next) => {
  try {
    const { starts_at, ends_at } = req.query;
    const bookings = listBookings({ user_id: req.user.userId, starts_at, ends_at });
    res.json({ data: bookings, count: bookings.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/bookings
// Auth required — creates a booking; 409 on any conflict.
// Body: { "event_id": "evt-001" }
// ---------------------------------------------------------------------------
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { event_id } = req.body || {};
    if (!event_id) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'event_id is required.' },
      });
    }
    const booking = createBooking({ event_id, user_id: req.user.userId });
    res.status(201).json({ data: booking });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/bookings/:id
// Auth required — cancels a booking; 403 if it belongs to another user.
// ---------------------------------------------------------------------------
router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const booking = cancelBooking({ id: req.params.id, user_id: req.user.userId });
    res.json({ data: booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
