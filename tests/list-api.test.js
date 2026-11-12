// tests/list-api.test.js
// Integration tests for the List API (REST + GraphQL).
// Uses Jest + supertest.  Runs against a real in-memory (temp) SQLite DB.
'use strict';

const request = require('supertest');

// Point DB at a tmp file so tests don't pollute data/events.db
const tmp = require('os').tmpdir() + '/apibp-test-' + process.pid + '.db';
process.env.DB_PATH = tmp;

let app;

beforeAll(async () => {
  const { buildApp } = require('../src/app');
  app = await buildApp();
});

afterAll(() => {
  // Clean up test DB
  try { require('fs').unlinkSync(tmp); } catch {}
});

// ============================================================================
// REST — GET /api/v1/events
// ============================================================================

describe('REST List API — GET /api/v1/events', () => {

  test('returns 200 with data array and pagination envelope', async () => {
    const res = await request(app).get('/api/v1/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      has_more: expect.any(Boolean),
      total_count: expect.any(Number),
    });
  });

  // ── Filtering ──────────────────────────────────────────────────────────

  test('filters by status=OPEN', async () => {
    const res = await request(app).get('/api/v1/events?status=OPEN');
    expect(res.status).toBe(200);
    res.body.data.forEach(e => expect(e.status).toBe('OPEN'));
  });

  test('filters by category=TECH', async () => {
    const res = await request(app).get('/api/v1/events?category=TECH');
    expect(res.status).toBe(200);
    res.body.data.forEach(e => expect(e.category).toBe('TECH'));
  });

  test('filters by min_price=1000', async () => {
    const res = await request(app).get('/api/v1/events?min_price=1000');
    expect(res.status).toBe(200);
    res.body.data.forEach(e => expect(e.price).toBeGreaterThanOrEqual(1000));
  });

  test('filters by max_price=500', async () => {
    const res = await request(app).get('/api/v1/events?max_price=500');
    expect(res.status).toBe(200);
    res.body.data.forEach(e => expect(e.price).toBeLessThanOrEqual(500));
  });

  test('filters by min_price + max_price range', async () => {
    const res = await request(app).get('/api/v1/events?min_price=500&max_price=1500');
    expect(res.status).toBe(200);
    res.body.data.forEach(e => {
      expect(e.price).toBeGreaterThanOrEqual(500);
      expect(e.price).toBeLessThanOrEqual(1500);
    });
  });

  test('combines status + category filters', async () => {
    const res = await request(app).get('/api/v1/events?status=UPCOMING&category=TECH');
    expect(res.status).toBe(200);
    res.body.data.forEach(e => {
      expect(e.status).toBe('UPCOMING');
      expect(e.category).toBe('TECH');
    });
  });

  // ── Sorting ────────────────────────────────────────────────────────────

  test('sort=price order=asc returns ascending prices', async () => {
    const res = await request(app).get('/api/v1/events?sort=price&order=asc&limit=25');
    expect(res.status).toBe(200);
    const prices = res.body.data.map(e => e.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('sort=price order=desc returns descending prices', async () => {
    const res = await request(app).get('/api/v1/events?sort=price&order=desc&limit=25');
    expect(res.status).toBe(200);
    const prices = res.body.data.map(e => e.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test('sort=starts_at order=asc is the default order', async () => {
    const [a, b] = await Promise.all([
      request(app).get('/api/v1/events?sort=starts_at&order=asc&limit=25'),
      request(app).get('/api/v1/events?limit=25'),
    ]);
    expect(a.body.data.map(e => e.id)).toEqual(b.body.data.map(e => e.id));
  });

  // ── Pagination ─────────────────────────────────────────────────────────

  test('limit=5 returns exactly 5 events', async () => {
    const res = await request(app).get('/api/v1/events?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  test('has_more=true when more pages exist', async () => {
    const res = await request(app).get('/api/v1/events?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.pagination.has_more).toBe(true);
    expect(typeof res.body.pagination.next_cursor).toBe('string');
  });

  test('cursor pagination returns non-overlapping pages', async () => {
    const page1 = await request(app).get('/api/v1/events?limit=5&sort=price&order=asc');
    expect(page1.body.pagination.has_more).toBe(true);

    const cursor = page1.body.pagination.next_cursor;
    const page2  = await request(app).get(
      `/api/v1/events?limit=5&sort=price&order=asc&after=${cursor}`
    );
    expect(page2.status).toBe(200);

    const ids1 = page1.body.data.map(e => e.id);
    const ids2 = page2.body.data.map(e => e.id);
    const overlap = ids1.filter(id => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });

  test('pages are contiguous — page2 starts where page1 ended', async () => {
    const page1 = await request(app).get('/api/v1/events?limit=5&sort=price&order=asc');
    const cursor = page1.body.pagination.next_cursor;
    const page2  = await request(app).get(
      `/api/v1/events?limit=5&sort=price&order=asc&after=${cursor}`
    );
    // last price in page1 ≤ first price in page2
    const lastP1  = page1.body.data.at(-1).price;
    const firstP2 = page2.body.data[0].price;
    expect(firstP2).toBeGreaterThanOrEqual(lastP1);
  });

  test('full traversal collects all events exactly once', async () => {
    const allIds = [];
    let after = undefined;
    let safetyLimit = 50;

    while (safetyLimit-- > 0) {
      const url = `/api/v1/events?limit=4&sort=starts_at&order=asc${after ? `&after=${after}` : ''}`;
      const res = await request(app).get(url);
      res.body.data.forEach(e => allIds.push(e.id));
      if (!res.body.pagination.has_more) break;
      after = res.body.pagination.next_cursor;
    }

    // All 25 seed events collected, no duplicates
    expect(allIds).toHaveLength(25);
    expect(new Set(allIds).size).toBe(25);
  });

  test('invalid cursor returns 400 with INVALID_CURSOR code', async () => {
    const res = await request(app).get('/api/v1/events?after=not-a-valid-cursor');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURSOR');
  });

  test('has_more=false and next_cursor=null on last page', async () => {
    // Fetch all events in one big page
    const res = await request(app).get('/api/v1/events?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.pagination.has_more).toBe(false);
    expect(res.body.pagination.next_cursor).toBeNull();
  });
});

// ============================================================================
// GraphQL — events connection query
// ============================================================================

const GQL = (query, variables = {}) =>
  request(app)
    .post('/graphql')
    .set('Content-Type', 'application/json')
    .send({ query, variables });

describe('GraphQL List API — events connection', () => {

  const EVENTS_QUERY = `
    query ListEvents(
      $status: EventStatus
      $category: EventCategory
      $minPrice: Int
      $maxPrice: Int
      $sort: EventSortField
      $order: SortOrder
      $first: Int
      $after: String
    ) {
      events(
        status: $status
        category: $category
        minPrice: $minPrice
        maxPrice: $maxPrice
        sort: $sort
        order: $order
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          startCursor
        }
        edges {
          cursor
          node {
            id title status category price starts_at ends_at
            venue { id name coordinates }
            organizer { id name }
          }
        }
      }
    }
  `;

  test('returns EventConnection with edges and pageInfo', async () => {
    const res = await GQL(EVENTS_QUERY);
    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    const { events } = res.body.data;
    expect(Array.isArray(events.edges)).toBe(true);
    expect(events.pageInfo).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
    expect(typeof events.totalCount).toBe('number');
  });

  test('filters by status=OPEN', async () => {
    const res = await GQL(EVENTS_QUERY, { status: 'OPEN' });
    expect(res.status).toBe(200);
    res.body.data.events.edges.forEach(({ node: e }) => expect(e.status).toBe('OPEN'));
  });

  test('filters by category=TECH', async () => {
    const res = await GQL(EVENTS_QUERY, { category: 'TECH' });
    expect(res.status).toBe(200);
    res.body.data.events.edges.forEach(({ node: e }) => expect(e.category).toBe('TECH'));
  });

  test('minPrice + maxPrice filter', async () => {
    const res = await GQL(EVENTS_QUERY, { minPrice: 500, maxPrice: 1500 });
    expect(res.status).toBe(200);
    res.body.data.events.edges.forEach(({ node: e }) => {
      expect(e.price).toBeGreaterThanOrEqual(500);
      expect(e.price).toBeLessThanOrEqual(1500);
    });
  });

  test('sort=price order=asc', async () => {
    const res = await GQL(EVENTS_QUERY, { sort: 'price', order: 'asc', first: 25 });
    expect(res.status).toBe(200);
    const prices = res.body.data.events.edges.map(e => e.node.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('cursor pagination: page 2 does not overlap page 1', async () => {
    const p1 = await GQL(EVENTS_QUERY, { first: 5, sort: 'price', order: 'asc' });
    expect(p1.body.data.events.pageInfo.hasNextPage).toBe(true);

    const after = p1.body.data.events.pageInfo.endCursor;
    const p2    = await GQL(EVENTS_QUERY, { first: 5, sort: 'price', order: 'asc', after });

    const ids1 = p1.body.data.events.edges.map(e => e.node.id);
    const ids2 = p2.body.data.events.edges.map(e => e.node.id);
    expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
  });

  test('each edge has its own cursor', async () => {
    const res = await GQL(EVENTS_QUERY, { first: 5 });
    const cursors = res.body.data.events.edges.map(e => e.cursor);
    expect(new Set(cursors).size).toBe(cursors.length);
  });

  test('venue coordinates are [longitude, latitude] GeoJSON array', async () => {
    const res = await GQL(EVENTS_QUERY, { first: 3 });
    res.body.data.events.edges.forEach(({ node: e }) => {
      expect(Array.isArray(e.venue.coordinates)).toBe(true);
      expect(e.venue.coordinates).toHaveLength(2);
    });
  });

  test('allEvents deprecated field still returns events', async () => {
    const res = await GQL('{ allEvents { id title } }');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.allEvents)).toBe(true);
  });
});
