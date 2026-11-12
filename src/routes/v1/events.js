// src/routes/v1/events.js
// REST handlers for the /api/v1/events List & Map APIs.
'use strict';

const express = require('express');
const router  = express.Router();

const {
  listEvents,
  getEventById,
  searchEventsByRadius,
  searchEventsByBbox,
} = require('../../models/event');

function makeInvalidCoordError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code   = 'INVALID_COORDINATES';
  return err;
}

function isValidLatLon(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

// ---------------------------------------------------------------------------
// GET /api/v1/events
// ---------------------------------------------------------------------------
// Query params:
//   Filtering : status, category, min_price, max_price
//   Sorting   : sort=<price|starts_at|title>  order=<asc|desc>
//   Pagination: limit, after (opaque cursor)
// ---------------------------------------------------------------------------
router.get('/', (req, res, next) => {
  try {
    const result = listEvents({
      status:    req.query.status,
      category:  req.query.category,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      sort:      req.query.sort,
      order:     req.query.order,
      limit:     req.query.limit,
      after:     req.query.after,
    });

    res.json({
      data: result.events,
      pagination: {
        has_more:    result.has_more,
        next_cursor: result.next_cursor,
        total_count: result.total_count,
        limit:       parseInt(req.query.limit, 10) || 20,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/events/map
// ---------------------------------------------------------------------------
// Query params:
//   Radius mode : latitude, longitude, radius_km
//   BBox mode   : min_lat, min_lon, max_lat, max_lon
//   Optional    : status, category
// ---------------------------------------------------------------------------
router.get('/map', (req, res, next) => {
  try {
    const { latitude, longitude, radius_km, min_lat, min_lon, max_lat, max_lon, status, category } = req.query;

    const hasRadius = latitude !== undefined || longitude !== undefined || radius_km !== undefined;
    const hasBbox   = min_lat !== undefined || min_lon !== undefined || max_lat !== undefined || max_lon !== undefined;

    if (hasRadius) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const rad = parseFloat(radius_km);

      if (!isValidLatLon(lat, lon)) {
        throw makeInvalidCoordError('latitude must be [-90, 90] and longitude must be [-180, 180].');
      }
      if (!Number.isFinite(rad) || rad <= 0) {
        throw makeInvalidCoordError('radius_km must be a positive number.');
      }

      const items = searchEventsByRadius({ latitude: lat, longitude: lon, radius_km: rad, status, category });
      return res.json({
        type:  'FeatureCollection',
        count: items.length,
        data:  items,
        items,
      });
    }

    if (hasBbox) {
      const swLat = parseFloat(min_lat);
      const swLon = parseFloat(min_lon);
      const neLat = parseFloat(max_lat);
      const neLon = parseFloat(max_lon);

      if (!isValidLatLon(swLat, swLon) || !isValidLatLon(neLat, neLon)) {
        throw makeInvalidCoordError('Bounding-box coordinates must be valid WGS-84 degrees.');
      }
      if (swLat > neLat || swLon > neLon) {
        throw makeInvalidCoordError('min_lat/min_lon cannot exceed max_lat/max_lon.');
      }

      const items = searchEventsByBbox({
        min_lat: swLat,
        min_lon: swLon,
        max_lat: neLat,
        max_lon: neLon,
        status,
        category,
      });
      return res.json({
        type:  'FeatureCollection',
        count: items.length,
        data:  items,
        items,
      });
    }

    throw makeInvalidCoordError(
      'Provide either (latitude, longitude, radius_km) or (min_lat, min_lon, max_lat, max_lon).'
    );
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/events/:id
// ---------------------------------------------------------------------------
router.get('/:id', (req, res, next) => {
  try {
    const event = getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${req.params.id}' not found` },
      });
    }
    res.json({ data: event });
  } catch (err) {
    next(err);
  }
});

module.exports = router;