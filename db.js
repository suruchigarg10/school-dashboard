'use strict';
// ============================================================
// db.js — SQLite database setup for school dashboard
// ============================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

// On Render (and other PaaS), use /tmp for writable storage.
// Locally, use data/ so the file persists across restarts.
const DB_DIR = process.env.NODE_ENV === 'production'
  ? '/tmp'
  : path.join(__dirname, 'data');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'dashboard.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  -- Per-item todo state (replaces GitHub Contents API approach)
  CREATE TABLE IF NOT EXISTS todo_state (
    id         TEXT PRIMARY KEY,
    done       INTEGER NOT NULL DEFAULT 0,
    done_at    TEXT,
    updated_at TEXT NOT NULL
  );

  -- Quiz scores saved after each completed quiz
  CREATE TABLE IF NOT EXISTS quiz_scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    subject    TEXT NOT NULL,
    score      INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    topics     TEXT,        -- JSON array of topic strings
    created_at TEXT NOT NULL
  );
`);

module.exports = db;
