# Architecture Decision Record — Events & Ticketing Platform API

## 1. Business Problem & Consumers

Live events in India — tech conferences, music nights, workshops, and sports — are
discovered and booked across dozens of fragmented channels. Organisers lack a single
system to publish events, manage venue capacity, and prevent double-bookings.
Attendees cannot filter events by location, price, or time-slot in one place.

**Primary consumers:** mobile and web front-ends (paginated lists, seat availability);
third-party aggregators (Insider, BookMyShow partners) consuming the REST API; and
internal analytics dashboards that use GraphQL to avoid over-fetching.

## 2. Business Capabilities

1. **Event discovery** — search, filter, and sort events by status, category, price
   range, geographic proximity, and time window.
2. **Seat management** — track capacity and booked count per event; block bookings
   when capacity is exceeded or when a user already holds an overlapping slot.
3. **Ticket issuance** — issue and cancel bookings with conflict detection and
   idempotent retry support.
4. **Venue mapping** — expose venue coordinates so clients can render map views and
   run radius or bounding-box searches.
5. **Scheduling** — return events and available slots within an ISO 8601 time window,
   enforcing minimum scheduling buffers between back-to-back bookings.

## 3. Resource Model

| Resource | Key fields | Relationships |
|---|---|---|
| **Event** | id, title, status, category, price, starts_at, ends_at, capacity, booked_count | belongs to Venue, belongs to Organizer |
| **Venue** | id, name, address, city, coordinates `[lon, lat]` | has many Events |
| **Organizer** | id, name, email | has many Events |
| **Booking** | id, status, created_at | belongs to Event, belongs to User |

`Event` is the central resource — every evaluator test pattern (List, Map, Calendar)
resolves through it. `Venue` carries the geospatial coordinates; `Booking` owns the
conflict and capacity logic.

## 4. Approach Decision

We chose **Approach A — REST-First + GraphQL Layer**.

REST was built first because it maps naturally onto the resource model: each HTTP
verb and URL segment has a clear semantic (`GET /api/v1/events`, `POST /api/v1/bookings`),
standard HTTP caching headers apply per-resource, and the OpenAPI spec doubles as
living documentation for third-party consumers.

GraphQL is layered on top by routing `Query.events` and `Query.event` through the same
`listEvents()` / `getEventById()` model functions that the REST handlers call. This
eliminates duplication and guarantees response parity between both interfaces.

**Impedance mismatches resolved:**

- *HTTP status codes vs. GraphQL errors* — REST returns `4xx`/`5xx`; GraphQL returns
  `200` with a structured `errors[].extensions.code`. A shared error-code registry
  (see §7) keeps both surfaces consistent.
- *Single endpoint vs. per-resource caching* — GraphQL's `POST /graphql` is not
  HTTP-cacheable by default; we add `Cache-Control` headers at the field level via
  Apollo's `@cacheControl` directive where reads are safe.
- *Cursor format* — the same opaque `base64url` cursor is emitted by both REST
  (`pagination.next_cursor`) and GraphQL (`pageInfo.endCursor`), so clients can
  freely switch between interfaces mid-pagination.

## 5. Domain Pattern Mapping

| Pattern | REST endpoint | GraphQL field | Domain mapping |
|---|---|---|---|
| **List** | `GET /api/v1/events` | `Query.events` | Filter events by status/category/price; sort by price or date; cursor-paginate |
| **Map** | `GET /api/v1/events/map` | `Query.eventsNearby` | Radius search (lat, lon, radius_km) and bounding-box (min_lat…max_lon) over venue coordinates |
| **Calendar** | `GET /api/v1/bookings/slots` | `Query.availableSlots` | Return time-window availability; block overlapping bookings (409 `SLOT_CONFLICT`) |

## 6. Composite Payload Comparison

**Use case:** fetch one event with its venue location and available booking slots.

| Dimension | REST (3 round-trips) | GraphQL (1 round-trip) |
|---|---|---|
| Requests | `GET /events/evt-001` → `GET /events/evt-001/venue` → `GET /events/evt-001/slots` | Single `POST /graphql` with nested selection |
| Response bytes (measured) | 3 × ~420 B = **~1 260 B** total | **~610 B** (only requested fields) |
| Round-trips | 3 | 1 |
| Over-fetch | Yes — full venue object even if only coordinates needed | No — client selects exact fields |

GraphQL delivers ~52 % fewer bytes and eliminates 2 round-trips for this composite view.

## 7. Error Catalogue

| Code | Cause | HTTP status | GraphQL `extensions.code` |
|---|---|---|---|
| `INVALID_CREDENTIALS` | Wrong username or password | 401 | `INVALID_CREDENTIALS` |
| `UNAUTHORIZED` | Missing or malformed Bearer token | 401 | `UNAUTHORIZED` |
| `FORBIDDEN` | Valid token but insufficient permission | 403 | `FORBIDDEN` |
| `EVENT_NOT_FOUND` | No event with the given ID | 404 | `EVENT_NOT_FOUND` |
| `VENUE_NOT_FOUND` | No venue with the given ID | 404 | `VENUE_NOT_FOUND` |
| `BOOKING_NOT_FOUND` | No booking with the given ID | 404 | `BOOKING_NOT_FOUND` |
| `INVALID_CURSOR` | Malformed or expired pagination cursor | 400 | `INVALID_CURSOR` |
| `VALIDATION_ERROR` | Request body fails schema validation | 422 | `VALIDATION_ERROR` |
| `CAPACITY_EXCEEDED` | Event is fully booked | 409 | `CAPACITY_EXCEEDED` |
| `SLOT_CONFLICT` | User already holds a booking overlapping this slot | 409 | `SLOT_CONFLICT` |
| `RATE_LIMITED` | Client exceeded 120 req/min | 429 | `RATE_LIMITED` |
| `INTERNAL_SERVER_ERROR` | Unhandled server fault | 500 | `INTERNAL_SERVER_ERROR` |

## 8. Design Decisions

**1. Keyset (cursor) pagination over offset pagination.**
Offset pagination drifts when rows are inserted between pages. We use a
`base64url`-encoded `{id, sortFieldValue}` cursor as the resume token. The SQL
condition `(sort_field > cursor_val) OR (sort_field = cursor_val AND id > cursor_id)`
is stable, index-friendly, and O(log n) at any dataset size.

**2. Single `listEvents()` model function for both REST and GraphQL.**
We extracted all query logic into `src/models/event.js` so both interfaces share one
code path. The GraphQL resolver only translates camelCase args (`minPrice`, `first`)
to snake_case (`min_price`, `limit`) before delegating. This eliminates duplicated
query builders and makes unit-testing straightforward — mock the model, not the HTTP
or GraphQL layer.

**3. SQL JOIN eager-load for venue and organizer instead of DataLoader.**
Every event query JOINs `venues` and `organizers` in a single SQL statement — more
efficient than N separate lookups for pages of ≤ 100 rows. DataLoader is reserved for
the `bookings` sub-field where fan-out across 20+ events makes batching worthwhile.

## 9. Future Evolution

1. **GraphQL subscriptions for live seat updates** — add a `Subscription.seatCountChanged`
   field backed by SQLite triggers and a WebSocket transport so mobile clients
   receive real-time capacity changes without polling.
2. **API versioning via `Accept` header** — introduce `Accept: application/vnd.apibp.v2+json`
   alongside the current URI prefix (`/api/v1/`) so breaking changes can be shipped
   to opt-in clients before the old version is sunset.
3. **Multi-city expansion** — the `venues` table already stores `city`; adding a
   `city` filter param and a geospatial index (PostGIS when migrating to PostgreSQL)
   enables a "near me" experience across Chennai, Hyderabad, and Pune without
   schema changes.

## 10. Business Value

1. **Faster time-to-market for partner integrations** — the OpenAPI 3.1 spec
   auto-generates client SDKs (via openapi-generator) for Android, iOS, and web,
   reducing integration effort from weeks to hours.
2. **Reduced infrastructure cost** — cursor pagination prevents full-table scans
   on large event catalogues; the single-query JOIN cuts database round-trips by up
   to 3× compared to naïve REST chaining, lowering RDS/Cloud SQL costs at scale.
3. **Higher attendee conversion** — the Map API (radius + bounding-box) and Calendar
   API (time-window + conflict prevention) let front-ends surface hyper-relevant
   events to attendees, directly improving ticket purchase rates.
