'use strict';
// ============================================================
// db.js — Database setup for school dashboard
// Uses Turso (libsql) in production for persistent cloud SQLite.
// Falls back to a local SQLite file when TURSO_DATABASE_URL is not set.
// ============================================================
const { createClient } = require('@libsql/client');
const path = require('path');

const isLocal = !process.env.TURSO_DATABASE_URL;

const client = createClient(
  isLocal
    ? { url: `file:${path.join(__dirname, 'data', 'dashboard.db')}` }
    : { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
);

async function init() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS todo_state (
      id         TEXT PRIMARY KEY,
      done       INTEGER NOT NULL DEFAULT 0,
      done_at    TEXT,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS quiz_scores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      subject    TEXT NOT NULL,
      score      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      topics     TEXT,
      created_at TEXT NOT NULL
    )
  `);
  console.log(`🗄️  DB: ${isLocal ? 'local SQLite' : 'Turso cloud'}`);
}

module.exports = { client, init };
