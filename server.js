'use strict';
// ============================================================
// server.js — Express backend for school dashboard
// Serves static files + provides API for todos and quiz
// ============================================================
require('dotenv').config();
const express = require('express');
const path    = require('path');
const { client, init } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve all static files (index.html, app.js, style.css, data/*.js)
app.use(express.static(path.join(__dirname)));

// ─── Todos API ────────────────────────────────────────────────

// GET /api/todos  → { id: { done, doneAt }, ... }
app.get('/api/todos', async (_req, res) => {
  try {
    const result = await client.execute('SELECT * FROM todo_state');
    const state  = {};
    result.rows.forEach(r => {
      state[r.id] = { done: !!r.done, doneAt: r.done_at || null };
    });
    res.json(state);
  } catch (err) {
    console.error('GET /api/todos error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id  body: { done, doneAt }
app.put('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { done, doneAt } = req.body;
  if (typeof done !== 'boolean') return res.status(400).json({ error: 'done must be boolean' });
  try {
    await client.execute({
      sql: `
        INSERT INTO todo_state (id, done, done_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE
        SET done = excluded.done,
            done_at = excluded.done_at,
            updated_at = excluded.updated_at
      `,
      args: [id, done ? 1 : 0, doneAt || null, new Date().toISOString()],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/todos error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

    const raw = JSON.parse(match[0]);
    if (!Array.isArray(raw) || !raw.length) {
      throw new Error('Gemini returned an empty question list');
    }

    const LABELS = ['A', 'B', 'C', 'D'];

    // Normalise each question to the exact shape the frontend expects:
    //   { q, options: ["A) ...", "B) ...", "C) ...", "D) ..."], answer: "A" }
    const questions = raw.slice(0, 20).map(item => {
      const qText = (item.q || item.question || '').trim();

      const opts = (item.options || []).slice(0, 4).map((opt, i) => {
        const s = String(opt).trim();
        if (/^[A-D][).]\s/i.test(s)) return s.replace(/^([A-D])[).]?\s*/i, (_, l) => `${l.toUpperCase()}) `);
        return `${LABELS[i]}) ${s}`;
      });

      let ans = String(item.answer || 'A').trim().toUpperCase();
      if (ans.length > 1) ans = ans[0];
      if (!LABELS.includes(ans)) ans = 'A';

      return { q: qText, options: opts, answer: ans };
    });

    res.json({ questions });
  } catch (err) {
    console.error('Quiz generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quiz/score  body: { subject, score, total, topics[] }
app.post('/api/quiz/score', async (req, res) => {
  const { subject, score, total, topics = [] } = req.body;
  if (!subject || score == null || !total) {
    return res.status(400).json({ error: 'subject, score, total are required' });
  }
  try {
    await client.execute({
      sql: `INSERT INTO quiz_scores (subject, score, total, topics, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [subject, score, total, JSON.stringify(topics), new Date().toISOString()],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/quiz/score error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quiz/scores?subject=Math
app.get('/api/quiz/scores', async (req, res) => {
  const { subject } = req.query;
  try {
    const result = subject
      ? await client.execute({ sql: 'SELECT * FROM quiz_scores WHERE subject = ? ORDER BY created_at DESC LIMIT 10', args: [subject] })
      : await client.execute('SELECT * FROM quiz_scores ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/quiz/scores error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: index.html ────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────
init().then(() => {
  app.listen(PORT, () => {
    console.log(`🏫  Dashboard → http://localhost:${PORT}`);
    console.log(`    Gemini  : ${process.env.GEMINI_API_KEY ? '✓ configured' : '✗ not set'}`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});
