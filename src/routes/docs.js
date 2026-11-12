// src/routes/docs.js
// Serves Swagger UI at /docs backed by docs/openapi.yaml.
'use strict';

const path      = require('path');
const fs        = require('fs');
const express   = require('express');
const swaggerUi = require('swagger-ui-express');
const yaml      = require('js-yaml');

const router   = express.Router();
const specPath = path.join(__dirname, '../../docs/openapi.yaml');
const spec     = yaml.load(fs.readFileSync(specPath, 'utf8'));

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(spec, {
  customSiteTitle: 'Events & Ticketing API',
}));

module.exports = router;
