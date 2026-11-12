-- Organizers
CREATE TABLE IF NOT EXISTS organizers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  phone      TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Venues
CREATE TABLE IF NOT EXISTS venues (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  address   TEXT NOT NULL,
  city      TEXT NOT NULL DEFAULT 'Bengaluru',
  longitude REAL NOT NULL,
  latitude  REAL NOT NULL
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL CHECK(status IN ('UPCOMING','OPEN','SOLD_OUT','CANCELLED')),
  category     TEXT NOT NULL CHECK(category IN ('TECH','MUSIC','WORKSHOP','SPORTS','COMEDY','ART')),
  price        INTEGER NOT NULL CHECK(price >= 0),   -- INR
  starts_at    TEXT NOT NULL,                         -- ISO 8601 UTC
  ends_at      TEXT NOT NULL,
  capacity     INTEGER NOT NULL CHECK(capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0,
  venue_id     TEXT NOT NULL REFERENCES venues(id),
  organizer_id TEXT NOT NULL REFERENCES organizers(id)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id),
  user_id    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','CANCELLED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_events_status    ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category  ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_price     ON events(price);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
-- Composite index for keyset pagination (most common sort fields)
CREATE INDEX IF NOT EXISTS idx_events_price_id    ON events(price, id);
CREATE INDEX IF NOT EXISTS idx_events_startsat_id ON events(starts_at, id);
CREATE INDEX IF NOT EXISTS idx_events_title_id    ON events(title, id);
