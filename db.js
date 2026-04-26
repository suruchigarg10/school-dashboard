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
      kid        TEXT NOT NULL DEFAULT 'arjun',
      subject    TEXT NOT NULL,
      score      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      topics     TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Migration: rename legacy 'a-' todo IDs → 'arjun-' (one-time, safe to re-run)
  const legacy = await client.execute("SELECT id FROM todo_state WHERE id LIKE 'a-%'");
  for (const row of legacy.rows) {
    const oldId = row.id;
    const newId = 'arjun-' + oldId.slice(2);
    await client.execute({ sql: 'INSERT OR IGNORE INTO todo_state (id,done,done_at,updated_at) SELECT ?,done,done_at,updated_at FROM todo_state WHERE id=?', args: [newId, oldId] });
    await client.execute({ sql: 'DELETE FROM todo_state WHERE id=?', args: [oldId] });
  }
  if (legacy.rows.length) console.log(`🔄 Migrated ${legacy.rows.length} todo IDs from a- → arjun-`);

  console.log(`🗄️  DB: ${isLocal ? 'local SQLite' : 'Turso cloud'}`);
}

module.exports = { client, init };
