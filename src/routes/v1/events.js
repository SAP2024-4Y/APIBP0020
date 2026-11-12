// src/routes/v1/events.js
// REST handlers for the /api/v1/events List API.
'use strict';

const express = require('express');
const router  = express.Router();

const { listEvents, getEventById } = require('../../models/event');

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
      data:        result.events,
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
