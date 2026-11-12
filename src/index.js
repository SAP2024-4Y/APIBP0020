// src/index.js
// Server entry point.
'use strict';

require('./db'); // initialise DB (schema + seed) before anything else
const { buildApp } = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 8080;

buildApp().then(app => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`  REST docs  : http://localhost:${PORT}/docs`);
    console.log(`  GraphQL IDE: http://localhost:${PORT}/graphql`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
