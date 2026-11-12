// src/graphql/resolvers/index.js
// Merge all resolver maps for Apollo Server.
'use strict';

const { GraphQLDateTime } = require('graphql-scalars');
const { Query, Event, EventWithLocation } = require('./events');
const { BookingQuery, Mutation } = require('./bookings');

module.exports = {
  DateTime: GraphQLDateTime,
  GeoPoint: {
    // GeoJSON position [lon, lat] — stored as JS array, returned as-is.
    serialize:    v => v,
    parseValue:   v => v,
    parseLiteral: ast => JSON.parse(ast.value),
  },
  Query: { ...Query, ...BookingQuery },
  Event,
  EventWithLocation,
  Mutation,
};
