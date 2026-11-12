// src/models/booking.js
// Calendar API — booking model with conflict-prevention business logic.
'use strict';

const { randomUUID } = require('crypto');
const db = require('../db');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code   = code;
  return err;
}

function formatBookingRow(row) {
  return {
    id:        row.id,
    status:    row.status,
    userId:    row.user_id,
    createdAt: row.created_at,
    event: {
      id:           row.event_id,
      title:        row.event_title,
      description:  row.event_description,
      status:       row.event_status,
      category:     row.event_category,
      price:        row.event_price,
      starts_at:    row.event_starts_at,
      ends_at:      row.event_ends_at,
      capacity:     row.event_capacity,
      booked_count: row.event_booked_count,
      venue: {
        id:          row.event_venue_id,
        name:        row.venue_name,
        address:     row.venue_address,
        city:        row.venue_city,
        coordinates: [row.venue_longitude, row.venue_latitude],
      },
      organizer: {
        id:   row.event_organizer_id,
        name: row.organizer_name,
      },
    },
  };
}

function formatSlotRow(row) {
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description,
    status:          row.status,
    category:        row.category,
    price:           row.price,
    starts_at:       row.starts_at,
    ends_at:         row.ends_at,
    capacity:        row.capacity,
    booked_count:    row.booked_count,
    available_seats: row.capacity - row.booked_count,
    venue: {
      id:          row.venue_id,
      name:        row.venue_name,
      address:     row.venue_address,
      city:        row.venue_city,
      coordinates: [row.venue_longitude, row.venue_latitude],
    },
    organizer: {
      id:   row.organizer_id,
      name: row.organizer_name,
    },
  };
}

const BOOKING_JOIN_SQL = `
  SELECT
    b.id,  b.status,  b.user_id,  b.created_at,
    e.id          AS event_id,
    e.title       AS event_title,
    e.description AS event_description,
    e.status      AS event_status,
    e.category    AS event_category,
    e.price       AS event_price,
    e.starts_at   AS event_starts_at,
    e.ends_at     AS event_ends_at,
    e.capacity    AS event_capacity,
    e.booked_count AS event_booked_count,
    e.venue_id    AS event_venue_id,
    e.organizer_id AS event_organizer_id,
    v.name        AS venue_name,
    v.address     AS venue_address,
    v.city        AS venue_city,
    v.longitude   AS venue_longitude,
    v.latitude    AS venue_latitude,
    o.name        AS organizer_name
  FROM bookings b
  JOIN events     e ON e.id = b.event_id
  JOIN venues     v ON v.id = e.venue_id
  JOIN organizers o ON o.id = e.organizer_id
`;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return OPEN/UPCOMING events whose time window overlaps the requested window.
 * Overlap condition: event.starts_at < ends_at AND event.ends_at > starts_at
 */
function getAvailableSlots({ starts_at, ends_at }) {
  if (!starts_at || !ends_at) {
    throw makeError('starts_at and ends_at are required.', 422, 'INVALID_TIME_WINDOW');
  }
  if (starts_at >= ends_at) {
    throw makeError('ends_at must be after starts_at.', 422, 'INVALID_TIME_WINDOW');
  }

  const rows = db.prepare(`
    SELECT
      e.*,
      v.name      AS venue_name,
      v.address   AS venue_address,
      v.city      AS venue_city,
      v.longitude AS venue_longitude,
      v.latitude  AS venue_latitude,
      o.name      AS organizer_name
    FROM events e
    JOIN venues     v ON v.id = e.venue_id
    JOIN organizers o ON o.id = e.organizer_id
    WHERE e.status IN ('OPEN', 'UPCOMING')
      AND e.starts_at < @ends_at
      AND e.ends_at   > @starts_at
    ORDER BY e.starts_at ASC
  `).all({ starts_at, ends_at });

  return rows.map(formatSlotRow);
}

/**
 * Create a confirmed booking, applying all conflict-prevention rules.
 * Runs the INSERT + booked_count increment in a single transaction.
 */
function createBooking({ event_id, user_id }) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
  if (!event) {
    throw makeError(`Event '${event_id}' not found.`, 404, 'EVENT_NOT_FOUND');
  }

  if (event.status === 'CANCELLED') {
    throw makeError('This event has been cancelled.', 409, 'EVENT_CANCELLED');
  }

  if (event.status === 'SOLD_OUT' || event.booked_count >= event.capacity) {
    throw makeError('This event is fully booked.', 409, 'EVENT_SOLD_OUT');
  }

  // Booking window: must be at least 15 minutes before event starts.
  const cutoff = new Date(event.starts_at);
  cutoff.setMinutes(cutoff.getMinutes() - 15);
  if (new Date() >= cutoff) {
    throw makeError(
      'Booking window has closed — less than 15 minutes to event start.',
      409,
      'BOOKING_WINDOW_CLOSED',
    );
  }

  const existing = db.prepare(
    `SELECT id FROM bookings WHERE event_id = ? AND user_id = ? AND status = 'CONFIRMED'`,
  ).get(event_id, user_id);
  if (existing) {
    throw makeError('You have already booked this event.', 409, 'BOOKING_CONFLICT');
  }

  const bookingId = `bkg-${randomUUID()}`;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO bookings (id, event_id, user_id, status) VALUES (?, ?, ?, 'CONFIRMED')`,
    ).run(bookingId, event_id, user_id);

    const newCount  = event.booked_count + 1;
    const newStatus = newCount >= event.capacity ? 'SOLD_OUT' : event.status;

    db.prepare(
      `UPDATE events SET booked_count = ?, status = ? WHERE id = ?`,
    ).run(newCount, newStatus, event_id);
  })();

  return getBookingById(bookingId);
}

/**
 * Cancel a confirmed booking and restore the event's available seat.
 */
function cancelBooking({ id, user_id }) {
  const row = db.prepare(
    `SELECT b.*, e.starts_at, e.status AS event_status, e.booked_count
     FROM bookings b JOIN events e ON e.id = b.event_id WHERE b.id = ?`,
  ).get(id);

  if (!row) {
    throw makeError(`Booking '${id}' not found.`, 404, 'BOOKING_NOT_FOUND');
  }
  if (row.user_id !== user_id) {
    throw makeError('You do not have permission to cancel this booking.', 403, 'FORBIDDEN');
  }
  if (row.status === 'CANCELLED') {
    throw makeError('Booking is already cancelled.', 409, 'BOOKING_ALREADY_CANCELLED');
  }

  db.transaction(() => {
    db.prepare(`UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`).run(id);
    db.prepare(`
      UPDATE events
      SET booked_count = MAX(0, booked_count - 1),
          status = CASE WHEN status = 'SOLD_OUT' THEN 'OPEN' ELSE status END
      WHERE id = ?
    `).run(row.event_id);
  })();

  return getBookingById(id);
}

/**
 * List bookings for a user, optionally filtered by event time window.
 */
function listBookings({ user_id, starts_at, ends_at }) {
  const filters = ['b.user_id = @user_id'];
  const params  = { user_id };

  if (starts_at) { filters.push('e.starts_at >= @starts_at'); params.starts_at = starts_at; }
  if (ends_at)   { filters.push('e.ends_at   <= @ends_at');   params.ends_at   = ends_at;   }

  const rows = db.prepare(
    `${BOOKING_JOIN_SQL} WHERE ${filters.join(' AND ')} ORDER BY e.starts_at ASC`,
  ).all(params);

  return rows.map(formatBookingRow);
}

function getBookingById(id) {
  const row = db.prepare(`${BOOKING_JOIN_SQL} WHERE b.id = ?`).get(id);
  return row ? formatBookingRow(row) : null;
}

module.exports = { getAvailableSlots, createBooking, cancelBooking, listBookings, getBookingById };
