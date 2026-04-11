'use strict';
// ============================================================
// server.js — Express backend for school dashboard
// Serves static files + provides API for todos and quiz
// ============================================================
require('dotenv').config();
const express = require('express');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve all static files (index.html, app.js, style.css, data/*.js)
app.use(express.static(path.join(__dirname)));

// ─── Todos API ────────────────────────────────────────────────

// GET /api/todos  → { id: { done, doneAt }, ... }
app.get('/api/todos', (_req, res) => {
  const rows  = db.prepare('SELECT * FROM todo_state').all();
  const state = {};
  rows.forEach(r => {
    state[r.id] = { done: !!r.done, doneAt: r.done_at || null };
  });
  res.json(state);
});

// PUT /api/todos/:id  body: { done, doneAt }
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const { done, doneAt } = req.body;
  if (typeof done !== 'boolean') return res.status(400).json({ error: 'done must be boolean' });
  db.prepare(`
    INSERT INTO todo_state (id, done, done_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE
    SET done = excluded.done,
        done_at = excluded.done_at,
        updated_at = excluded.updated_at
  `).run(id, done ? 1 : 0, doneAt || null, new Date().toISOString());
  res.json({ ok: true });
});

// ─── Quiz API ─────────────────────────────────────────────────

// POST /api/quiz/generate  body: { subject, topics[], customPrompt? }
app.post('/api/quiz/generate', async (req, res) => {
  const { subject, topics = [], customPrompt } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not set on server. Add it to .env and restart.' });
  }
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = customPrompt || `You are generating a quiz for Arjun, a Grade 7 student at Shiv Nadar School, Gurugram.
Subject: ${subject}
Topics covered in class recently: ${topics.length ? topics.slice(0, 8).join('; ') : 'standard Grade 7 ' + subject + ' curriculum'}

Generate exactly 20 multiple-choice quiz questions appropriate for Grade 7.
Make the questions based on the topics listed above.
Vary difficulty: ~6 easy, ~9 medium, ~5 hard.

Return ONLY a valid JSON array (no markdown code fences, no explanation, just raw JSON):
[
  {
    "q": "Question text here?",
    "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
    "answer": "A"
  }
]`;

    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();

    // Parse: Gemini sometimes wraps in ```json ... ```
    const stripped = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const match    = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Gemini response did not contain a JSON array');

    const questions = JSON.parse(match[0]);
    if (!Array.isArray(questions) || !questions.length) {
      throw new Error('Gemini returned an empty question list');
    }

    res.json({ questions: questions.slice(0, 20) });
  } catch (err) {
    console.error('Quiz generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quiz/score  body: { subject, score, total, topics[] }
app.post('/api/quiz/score', (req, res) => {
  const { subject, score, total, topics = [] } = req.body;
  if (!subject || score == null || !total) {
    return res.status(400).json({ error: 'subject, score, total are required' });
  }
  db.prepare(`
    INSERT INTO quiz_scores (subject, score, total, topics, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(subject, score, total, JSON.stringify(topics), new Date().toISOString());
  res.json({ ok: true });
});

// GET /api/quiz/scores?subject=Math
app.get('/api/quiz/scores', (req, res) => {
  const { subject } = req.query;
  const rows = subject
    ? db.prepare('SELECT * FROM quiz_scores WHERE subject = ? ORDER BY created_at DESC LIMIT 10').all(subject)
    : db.prepare('SELECT * FROM quiz_scores ORDER BY created_at DESC LIMIT 100').all();
  res.json(rows);
});

// ─── Catch-all: index.html ────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🏫  Dashboard → http://localhost:${PORT}`);
  console.log(`    Gemini  : ${process.env.GEMINI_API_KEY ? '✓ configured' : '✗ not set'}`);
});
