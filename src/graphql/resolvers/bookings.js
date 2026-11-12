// src/graphql/resolvers/bookings.js
// GraphQL resolvers for Calendar API — availableSlots, bookings, createBooking, cancelBooking.
'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET }      = require('../../middleware/auth');
const {
  getAvailableSlots,
  createBooking,
  cancelBooking,
  listBookings,
} = require('../../models/booking');

function getUserFromContext(context) {
  const header = context.token;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

// ── Query resolvers (Calendar API) ────────────────────────────────────────────

const BookingQuery = {
  availableSlots(_parent, { starts_at, ends_at }) {
    try {
      return getAvailableSlots({ starts_at, ends_at });
    } catch (err) {
      throw Object.assign(new Error(err.message), {
        extensions: { code: err.code || 'INTERNAL_ERROR' },
      });
    }
  },

  bookings(_parent, { starts_at, ends_at }, context) {
    const user = getUserFromContext(context);
    if (!user) {
      throw Object.assign(new Error('Authentication required.'), {
        extensions: { code: 'UNAUTHORIZED' },
      });
    }
    return listBookings({ user_id: user.userId, starts_at, ends_at });
  },
};

// ── Mutation resolvers ────────────────────────────────────────────────────────

const Mutation = {
  createBooking(_parent, { input }, context) {
    const user = getUserFromContext(context);
    if (!user) {
      return {
        booking: null,
        errors:  [{ code: 'UNAUTHORIZED', message: 'Authentication required.', field: null }],
      };
    }

    try {
      const booking = createBooking({ event_id: input.eventId, user_id: user.userId });
      return { booking, errors: [] };
    } catch (err) {
      return {
        booking: null,
        errors:  [{ code: err.code || 'INTERNAL_ERROR', message: err.message, field: null }],
      };
    }
  },

  cancelBooking(_parent, { id }, context) {
    const user = getUserFromContext(context);
    if (!user) {
      return {
        booking: null,
        errors:  [{ code: 'UNAUTHORIZED', message: 'Authentication required.', field: null }],
      };
    }

    try {
      const booking = cancelBooking({ id, user_id: user.userId });
      return { booking, errors: [] };
    } catch (err) {
      return {
        booking: null,
        errors:  [{ code: err.code || 'INTERNAL_ERROR', message: err.message, field: null }],
      };
    }
  },
};

module.exports = { BookingQuery, Mutation };
