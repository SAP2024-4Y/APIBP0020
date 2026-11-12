// src/db/index.js
// Single shared better-sqlite3 connection.  Runs schema + seed on first boot.
'use strict';

const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/events.db');

// Ensure the data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL mode → faster concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function runFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  db.exec(sql);
}

// Idempotent: CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE guarantee safe re-runs
runFile(path.join(__dirname, 'schema.sql'));
runFile(path.join(__dirname, 'seed.sql'));

module.exports = db;
