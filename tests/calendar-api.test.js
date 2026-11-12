// tests/calendar-api.test.js
// Integration tests for the Calendar API (bookings + available slots).
'use strict';

const request = require('supertest');

const tmp = require('os').tmpdir() + '/apibp-calendar-test-' + process.pid + '.db';
process.env.DB_PATH = tmp;

let app;

beforeAll(async () => {
  const { buildApp } = require('../src/app');
  app = await buildApp();
});

afterAll(() => {
  try { require('fs').unlinkSync(tmp); } catch {}
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function getToken(username = 'demo', password = 'demo-password') {
  const res = await request(app)
    .post('/api/v1/auth/token')
    .send({ username, password });
  return res.body.token;
}

// ── Auth endpoint ─────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/token', () => {
  test('returns 200 and a token for valid demo credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token')
      .send({ username: 'demo', password: 'demo-password' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  test('returns 401 INVALID_CREDENTIALS for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token')
      .send({ username: 'demo', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('returns 401 for unknown username', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token')
      .send({ username: 'nobody', password: 'demo-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

// ── GET /api/v1/bookings/slots ────────────────────────────────────────────────

describe('GET /api/v1/bookings/slots', () => {
  test('returns events overlapping the given time window', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/slots')
      .query({ starts_at: '2026-12-01T00:00:00Z', ends_at: '2026-12-31T23:59:59Z' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(typeof res.body.count).toBe('number');

    const first = res.body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('starts_at');
    expect(first).toHaveProperty('available_seats');
    expect(first.available_seats).toBeGreaterThanOrEqual(0);
  });

  test('returns only OPEN or UPCOMING events', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/slots')
      .query({ starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-12-31T23:59:59Z' });

    expect(res.status).toBe(200);
    for (const slot of res.body.data) {
      expect(['OPEN', 'UPCOMING']).toContain(slot.status);
    }
  });

  test('returns empty array for a window with no events', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/slots')
      .query({ starts_at: '2020-01-01T00:00:00Z', ends_at: '2020-01-02T00:00:00Z' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  test('returns 422 INVALID_TIME_WINDOW when ends_at <= starts_at', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/slots')
      .query({ starts_at: '2026-12-31T00:00:00Z', ends_at: '2026-12-01T00:00:00Z' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TIME_WINDOW');
  });

  test('returns 422 INVALID_TIME_WINDOW when starts_at is missing', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/slots')
      .query({ ends_at: '2026-12-31T00:00:00Z' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TIME_WINDOW');
  });

  test('results are ordered by starts_at ascending', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/slots')
      .query({ starts_at: '2026-11-01T00:00:00Z', ends_at: '2027-02-01T00:00:00Z' });

    expect(res.status).toBe(200);
    const dates = res.body.data.map(e => e.starts_at);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true);
    }
  });
});

// ── GET /api/v1/bookings (auth required) ─────────────────────────────────────

describe('GET /api/v1/bookings', () => {
  test('returns 401 UNAUTHORIZED with no token', async () => {
    const res = await request(app).get('/api/v1/bookings');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 INVALID_TOKEN with a bad token', async () => {
    const res = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('returns 200 and user bookings for authenticated demo user', async () => {
    const token = await getToken();
    const res   = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  test('time-window filter returns only bookings in range', async () => {
    const token = await getToken();
    const res   = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .query({ starts_at: '2026-12-01T00:00:00Z', ends_at: '2026-12-31T23:59:59Z' });

    expect(res.status).toBe(200);
    for (const b of res.body.data) {
      expect(b.event.ends_at <= '2026-12-31T23:59:59Z').toBe(true);
      expect(b.event.starts_at >= '2026-12-01T00:00:00Z').toBe(true);
    }
  });
});

// ── POST /api/v1/bookings ─────────────────────────────────────────────────────

describe('POST /api/v1/bookings', () => {
  test('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .send({ event_id: 'evt-002' });
    expect(res.status).toBe(401);
  });

  test('returns 422 VALIDATION_ERROR when event_id is missing', async () => {
    const token = await getToken();
    const res   = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 404 EVENT_NOT_FOUND for unknown event', async () => {
    const token = await getToken();
    const res   = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-does-not-exist' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  test('returns 409 EVENT_CANCELLED for a cancelled event', async () => {
    const token = await getToken();
    const res   = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-025' }); // Cancelled: New Year Gala

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_CANCELLED');
  });

  test('returns 409 EVENT_SOLD_OUT for a sold-out event', async () => {
    const token = await getToken();
    const res   = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-005' }); // EDM Takeover Vol 3 — SOLD_OUT

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_SOLD_OUT');
  });

  test('creates a booking and returns 201 with booking id', async () => {
    const token = await getToken();
    const res   = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-002' }); // Cloud & AI Summit, UPCOMING

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('CONFIRMED');
    expect(res.body.data.event.id).toBe('evt-002');
  });

  test('returns 409 BOOKING_CONFLICT on duplicate booking for same event', async () => {
    const token = await getToken();

    // Book evt-006 once
    const first = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-006' });
    expect(first.status).toBe(201);

    // Book evt-006 again — must conflict
    const second = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-006' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('BOOKING_CONFLICT');
  });
});

// ── DELETE /api/v1/bookings/:id ───────────────────────────────────────────────

describe('DELETE /api/v1/bookings/:id', () => {
  test('returns 401 with no token', async () => {
    const res = await request(app).delete('/api/v1/bookings/bkg-seed-001');
    expect(res.status).toBe(401);
  });

  test('returns 404 BOOKING_NOT_FOUND for unknown id', async () => {
    const token = await getToken();
    const res   = await request(app)
      .delete('/api/v1/bookings/bkg-does-not-exist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  test('cancels a booking and returns CANCELLED status', async () => {
    const token = await getToken();

    // Create a booking to cancel
    const created = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-008' });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.id;

    // Cancel it
    const res = await request(app)
      .delete(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(res.body.data.id).toBe(bookingId);
  });

  test('returns 409 BOOKING_ALREADY_CANCELLED on double cancel', async () => {
    const token = await getToken();

    // Create and cancel
    const created = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_id: 'evt-009' });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.id;

    await request(app)
      .delete(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);

    // Cancel again
    const res = await request(app)
      .delete(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
  });
});
