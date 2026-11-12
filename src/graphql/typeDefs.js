// src/graphql/typeDefs.js
// Full GraphQL SDL for the Events & Ticketing domain.
// The authoritative copy is docs/schema.graphql; this file is loaded at runtime.
'use strict';

const { gql } = require('graphql-tag');

const typeDefs = gql`
  # ── Scalars ───────────────────────────────────────────────────────────────

  "ISO 8601 UTC datetime string (e.g. 2026-12-05T04:30:00Z)"
  scalar DateTime

  "GeoJSON position: [longitude, latitude] decimal degrees"
  scalar GeoPoint


  # ── Enums ─────────────────────────────────────────────────────────────────

  enum EventStatus {
    UPCOMING
    OPEN
    SOLD_OUT
    CANCELLED
  }

  enum EventCategory {
    TECH
    MUSIC
    WORKSHOP
    SPORTS
    COMEDY
    ART
  }

  enum EventSortField {
    price
    starts_at
    title
  }

  enum SortOrder {
    asc
    desc
  }


  # ── Core types ────────────────────────────────────────────────────────────

  type Venue {
    id:          ID!
    name:        String!
    address:     String!
    city:        String!
    "GeoJSON [longitude, latitude]"
    coordinates: GeoPoint!
  }

  type Organizer {
    id:   ID!
    name: String!
  }

  type Event {
    id:           ID!
    title:        String!
    description:  String
    status:       EventStatus!
    category:     EventCategory!
    "Ticket price in INR (0 = free)"
    price:        Int!
    starts_at:    DateTime!
    ends_at:      DateTime!
    capacity:     Int!
    booked_count: Int!
    venue:        Venue!
    organizer:    Organizer!
  }


  # ── Map (Geospatial) types ────────────────────────────────────────────────

  type GeoLocation {
    type: String!
    "GeoJSON [longitude, latitude]"
    coordinates: GeoPoint!
  }

  type EventWithLocation {
    id:           ID!
    title:        String!
    description:  String
    status:       EventStatus!
    category:     EventCategory!
    "Ticket price in INR (0 = free)"
    price:        Int!
    starts_at:    DateTime!
    ends_at:      DateTime!
    capacity:     Int!
    booked_count: Int!
    venue:        Venue!
    organizer:    Organizer!
    "GeoJSON location of the venue"
    location:     GeoLocation!
    "Distance from search centre in km (radius search only)"
    distanceKm:   Float
  }


  # ── GraphQL Connection spec (cursor-based pagination) ─────────────────────

  type PageInfo {
    "true when more pages follow in the current direction"
    hasNextPage: Boolean!
    "Opaque cursor pointing to the last edge in this page; pass as 'after'"
    endCursor:   String
    "Opaque cursor pointing to the first edge in this page"
    startCursor: String
  }

  type EventEdge {
    node:   Event!
    cursor: String!
  }

  type EventConnection {
    edges:      [EventEdge!]!
    pageInfo:   PageInfo!
    totalCount: Int!
  }


  # ── Booking types ─────────────────────────────────────────────────────────

  enum BookingStatus {
    CONFIRMED
    CANCELLED
  }

  type Booking {
    id:        ID!
    event:     Event!
    userId:    String!
    status:    BookingStatus!
    createdAt: DateTime!
  }

  input CreateBookingInput {
    eventId: ID!
    userId:  String!
  }


  # ── Mutations payload ─────────────────────────────────────────────────────

  type CreateBookingPayload {
    booking: Booking
    errors:  [UserError!]!
  }

  type UserError {
    field:   String
    message: String!
    code:    String!
  }


  # ── Queries ───────────────────────────────────────────────────────────────

  type Query {
    "Paginated, filtered and sorted list of events (Connection spec)"
    events(
      "Filter by event status"
      status:   EventStatus
      "Filter by category"
      category: EventCategory
      "Minimum ticket price in INR (inclusive)"
      minPrice: Int
      "Maximum ticket price in INR (inclusive)"
      maxPrice: Int
      "Field to sort by (default: starts_at)"
      sort:     EventSortField
      "Sort direction (default: asc)"
      order:    SortOrder
      "Max results to return (1–100, default 20)"
      first:    Int
      "Opaque cursor from pageInfo.endCursor of the previous page"
      after:    String
    ): EventConnection!

    "Fetch a single event by ID"
    event(id: ID!): Event

    # ── Deprecated field kept to demonstrate schema evolution ─────────────
    """
    @deprecated Use the 'events' connection instead.
    This field will be removed in schema v2.
    """
    allEvents: [Event!]! @deprecated(reason: "Use the events connection query with pagination instead. Will be removed in v2.")

    "Calendar API — list OPEN/UPCOMING events overlapping the given time window"
    availableSlots(
      "Window start (ISO 8601 UTC, inclusive)"
      starts_at: DateTime!
      "Window end (ISO 8601 UTC, exclusive)"
      ends_at:   DateTime!
    ): [Event!]!

    "Calendar API — list the authenticated user's bookings, optionally filtered by event time window"
    bookings(
      "Filter to bookings whose event starts on or after this time"
      starts_at: DateTime
      "Filter to bookings whose event ends on or before this time"
      ends_at:   DateTime
    ): [Booking!]!

    "Map API — events within radius_km of (latitude, longitude), sorted nearest-first"
    eventsNearby(
      latitude:  Float!
      longitude: Float!
      radius_km: Float!
      status:    EventStatus
      category:  EventCategory
    ): [EventWithLocation!]!

    "Map API — events within a bounding box (SW corner to NE corner)"
    eventsInBbox(
      min_lat:  Float!
      min_lon:  Float!
      max_lat:  Float!
      max_lon:  Float!
      status:   EventStatus
      category: EventCategory
    ): [EventWithLocation!]!
  }


  # ── Mutations ─────────────────────────────────────────────────────────────

  type Mutation {
    "Book a ticket for an event. Requires authentication (Bearer JWT)."
    createBooking(input: CreateBookingInput!): CreateBookingPayload!

    "Cancel an existing booking."
    cancelBooking(id: ID!): CreateBookingPayload!
  }
`;

module.exports = { typeDefs };
