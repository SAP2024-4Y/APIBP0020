// src/models/event.js
// All List-API database logic: filtering, keyset pagination, sorting.
'use strict';

const db = require('../db');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_SORT_FIELDS = new Set(['price', 'starts_at', 'title']);
const ALLOWED_ORDERS      = new Set(['asc', 'desc']);
const ALLOWED_STATUSES    = new Set(['UPCOMING', 'OPEN', 'SOLD_OUT', 'CANCELLED']);
const ALLOWED_CATEGORIES  = new Set(['TECH', 'MUSIC', 'WORKSHOP', 'SPORTS', 'COMEDY', 'ART']);
const DEFAULT_LIMIT        = 20;
const MAX_LIMIT            = 100;

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

/**
 * Encode a cursor from the last row returned.
 * Cursor is: base64url(JSON({ id, [sortField]: value }))
 * It is intentionally opaque to the caller.
 */
function encodeCursor(row, sortField) {
  const payload = { id: row.id, [sortField]: row[sortField] };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Decode a cursor string. Returns null if the string is invalid/tampered.
 */
function decodeCursor(cursor) {
  try {
    const raw  = Buffer.from(cursor, 'base64url').toString('utf8');
    const obj  = JSON.parse(raw);
    if (!obj || typeof obj.id !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

/**
 * Build and execute the paginated event list query.
 *
 * @param {object} opts
 * @param {string}  [opts.status]     – filter by status
 * @param {string}  [opts.category]   – filter by category
 * @param {number}  [opts.min_price]  – price ≥ min_price
 * @param {number}  [opts.max_price]  – price ≤ max_price
 * @param {string}  [opts.sort]       – sort field (price | starts_at | title)
 * @param {string}  [opts.order]      – asc | desc
 * @param {number}  [opts.limit]      – page size (1–100, default 20)
 * @param {string}  [opts.after]      – opaque cursor from previous page
 *
 * @returns {{ events: object[], has_more: boolean, next_cursor: string|null, total_count: number }}
 */
function listEvents(opts = {}) {
  // ── Normalise / validate inputs ──────────────────────────────────────────
  const sortField = ALLOWED_SORT_FIELDS.has(opts.sort)  ? opts.sort  : 'starts_at';
  const order     = ALLOWED_ORDERS.has(opts.order?.toLowerCase())
    ? opts.order.toLowerCase()
    : 'asc';

  const rawLimit = parseInt(opts.limit, 10);
  const limit    = (!isNaN(rawLimit) && rawLimit > 0)
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  // ── Base WHERE clauses (applied before cursor) ───────────────────────────
  const filters   = [];
  const params    = {};

  if (opts.status && ALLOWED_STATUSES.has(opts.status)) {
    filters.push('e.status = @status');
    params.status = opts.status;
  }
  if (opts.category && ALLOWED_CATEGORIES.has(opts.category)) {
    filters.push('e.category = @category');
    params.category = opts.category;
  }

  const minPrice = parseFloat(opts.min_price);
  if (!isNaN(minPrice)) {
    filters.push('e.price >= @min_price');
    params.min_price = minPrice;
  }
  const maxPrice = parseFloat(opts.max_price);
  if (!isNaN(maxPrice)) {
    filters.push('e.price <= @max_price');
    params.max_price = maxPrice;
  }

  // ── Cursor: keyset condition ──────────────────────────────────────────────
  // Keyset guarantee: results are stable even when rows are inserted mid-scan.
  // For ties on the sort field we break them by id (deterministic secondary sort).
  //
  //  ASC  → (sortField >  cursorVal) OR (sortField = cursorVal AND id > cursorId)
  //  DESC → (sortField <  cursorVal) OR (sortField = cursorVal AND id < cursorId)
  let cursor = null;
  if (opts.after) {
    cursor = decodeCursor(opts.after);
    if (!cursor || !(sortField in cursor)) {
      const err = new Error('Invalid cursor');
      err.status = 400;
      err.code   = 'INVALID_CURSOR';
      throw err;
    }

    const gt = order === 'asc' ? '>' : '<';
    filters.push(
      `(e.${sortField} ${gt} @cursor_sort_val OR ` +
      `(e.${sortField} = @cursor_sort_val AND e.id ${gt} @cursor_id))`
    );
    params.cursor_sort_val = cursor[sortField];
    params.cursor_id       = cursor.id;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  // ── Total count (pre-cursor, with same base filters only) ─────────────────
  // We run the count without the cursor so the client gets stable total_count.
  const countFilters = filters
    .filter(f => !f.startsWith('(e.') || cursor === null) // exclude cursor condition
    .filter(f => !f.includes('cursor_sort_val'));
  const countWhere   = countFilters.length ? `WHERE ${countFilters.join(' AND ')}` : '';
  const countParams  = Object.fromEntries(
    Object.entries(params).filter(([k]) => !k.startsWith('cursor_'))
  );
  const totalCount = db
    .prepare(`SELECT COUNT(*) as cnt FROM events e ${countWhere}`)
    .get(countParams).cnt;

  // ── Main query: fetch limit+1 to detect has_more ──────────────────────────
  const orderClause = `ORDER BY e.${sortField} ${order.toUpperCase()}, e.id ${order.toUpperCase()}`;
  const sql = `
    SELECT
      e.*,
      v.name       AS venue_name,
      v.address    AS venue_address,
      v.city       AS venue_city,
      v.longitude  AS venue_longitude,
      v.latitude   AS venue_latitude,
      o.name       AS organizer_name
    FROM events e
    JOIN venues     v ON v.id = e.venue_id
    JOIN organizers o ON o.id = e.organizer_id
    ${whereClause}
    ${orderClause}
    LIMIT @fetch_limit
  `;

  params.fetch_limit = limit + 1;
  const rows = db.prepare(sql).all(params);

  const hasMore    = rows.length > limit;
  const pageEvents = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(pageEvents[pageEvents.length - 1], sortField) : null;

  return {
    events:      pageEvents.map(formatEvent),
    has_more:    hasMore,
    next_cursor: nextCursor,
    total_count: totalCount,
  };
}

/**
 * Fetch a single event by ID.  Returns null if not found.
 */
function getEventById(id) {
  const row = db.prepare(`
    SELECT
      e.*,
      v.name       AS venue_name,
      v.address    AS venue_address,
      v.city       AS venue_city,
      v.longitude  AS venue_longitude,
      v.latitude   AS venue_latitude,
      o.name       AS organizer_name
    FROM events e
    JOIN venues     v ON v.id = e.venue_id
    JOIN organizers o ON o.id = e.organizer_id
    WHERE e.id = ?
  `).get(id);

  return row ? formatEvent(row) : null;
}

// ---------------------------------------------------------------------------
// Shape the DB row into a clean API object
// ---------------------------------------------------------------------------
function formatEvent(row) {
  return {
    id:          row.id,
    title:       row.title,
    description: row.description,
    status:      row.status,
    category:    row.category,
    price:       row.price,
    starts_at:   row.starts_at,
    ends_at:     row.ends_at,
    capacity:    row.capacity,
    booked_count: row.booked_count,
    venue: {
      id:        row.venue_id,
      name:      row.venue_name,
      address:   row.venue_address,
      city:      row.venue_city,
      // GeoJSON semantics: [longitude, latitude]
      coordinates: [row.venue_longitude, row.venue_latitude],
    },
    organizer: {
      id:   row.organizer_id,
      name: row.organizer_name,
    },
  };
}

// ---------------------------------------------------------------------------
// DataLoader batch function (used by GraphQL resolvers)
// ---------------------------------------------------------------------------

/**
 * Load multiple events by ID in one SQL query (prevents N+1).
 * @param {string[]} ids
 * @returns {object[]} — ordered to match the input id array (DataLoader contract)
 */
function batchLoadEventsByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT
      e.*,
      v.name       AS venue_name,
      v.address    AS venue_address,
      v.city       AS venue_city,
      v.longitude  AS venue_longitude,
      v.latitude   AS venue_latitude,
      o.name       AS organizer_name
    FROM events e
    JOIN venues     v ON v.id = e.venue_id
    JOIN organizers o ON o.id = e.organizer_id
    WHERE e.id IN (${placeholders})
  `).all(...ids);

  const map = new Map(rows.map(r => [r.id, formatEvent(r)]));
  return ids.map(id => map.get(id) ?? null);
}

module.exports = { listEvents, getEventById, batchLoadEventsByIds, encodeCursor, decodeCursor };
