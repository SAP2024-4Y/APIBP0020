// src/graphql/resolvers/events.js
// GraphQL resolvers for the Event type and events query (List API).
// Uses DataLoader to batch-load venue and organizer data — no N+1.
'use strict';

const { listEvents, getEventById, searchEventsByRadius, searchEventsByBbox } = require('../../models/event');

// ── GraphQL Connection helpers ──────────────────────────────────────────────

/**
 * Convert a listEvents() result into a GraphQL Connection object.
 * Each edge carries its own cursor so the client can restart from any position.
 *
 * Cursor on each edge: the opaque token that resumes pagination *after* that
 * specific row.  The last edge's cursor matches pageInfo.endCursor.
 * We encode each edge individually by passing the sortField used in the query.
 */
function toConnection(result, sortField) {
  const { encodeCursor } = require('../../models/event');

  const edges = result.events.map(event => ({
    cursor: encodeCursor(event, sortField),
    node:   event,
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage: result.has_more,
      endCursor:   result.next_cursor ?? null,
      startCursor: edges.length ? edges[0].cursor : null,
    },
    totalCount: result.total_count,
  };
}

// ── Query resolvers ─────────────────────────────────────────────────────────

const Query = {
  /**
   * events(status, category, minPrice, maxPrice, sort, order, first, after)
   * Returns EventConnection — GraphQL Connection spec.
   *
   * Note: GraphQL uses camelCase args (minPrice/maxPrice/first) while the
   * REST API uses snake_case (min_price/max_price/limit).  We normalise here.
   */
  events(_parent, args) {
    const sortField = args.sort || 'starts_at';

    const result = listEvents({
      status:    args.status,
      category:  args.category,
      min_price: args.minPrice,
      max_price: args.maxPrice,
      sort:      sortField,
      order:     args.order,
      limit:     args.first,
      after:     args.after,
    });

    return toConnection(result, sortField);
  },

  event(_parent, { id }) {
    return getEventById(id);
  },

  // Deprecated — kept for schema evolution demo.  Returns at most 50 events.
  allEvents() {
    const result = listEvents({ limit: 50 });
    return result.events;
  },

  eventsNearby(_parent, args) {
    const items = searchEventsByRadius({
      latitude:  args.latitude,
      longitude: args.longitude,
      radius_km: args.radius_km,
      status:    args.status,
      category:  args.category,
    });
    return items.map(e => ({ ...e, distanceKm: e.distance_km }));
  },

  eventsInBbox(_parent, args) {
    const items = searchEventsByBbox({
      min_lat:  args.min_lat,
      min_lon:  args.min_lon,
      max_lat:  args.max_lat,
      max_lon:  args.max_lon,
      status:   args.status,
      category: args.category,
    });
    return items.map(e => ({ ...e, distanceKm: e.distance_km }));
  },
};

// ── Field resolvers ─────────────────────────────────────────────────────────
// Event.venue and Event.organizer are already eagerly loaded by the SQL JOIN
// in the model, so no extra DB round-trips occur in the REST path.
//
// In the GraphQL path, these field resolvers are hit when a client asks for
// nested venue/organizer data.  The SQL JOIN already has the data in `parent`,
// so these are effectively free — no DataLoader needed for these two fields.
// DataLoader becomes essential when we add a "bookings" field (see below).

const Event = {
  venue(parent) {
    return parent.venue;
  },
  organizer(parent) {
    return parent.organizer;
  },
};

const EventWithLocation = {
  venue(parent)     { return parent.venue; },
  organizer(parent) { return parent.organizer; },
  location(parent)  { return parent.location; },
};

// ── EventConnection / PageInfo field resolvers ──────────────────────────────
// Apollo Server resolves these automatically from the plain objects returned
// by the Query.events resolver above — no extra resolver code required.

module.exports = { Query, Event, EventWithLocation };
