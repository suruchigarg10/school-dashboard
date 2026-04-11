// ============================================================
// app.js — Arjun's School Dashboard Frontend Logic
// ============================================================

const DATA = window.DASHBOARD_DATA;
const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Kid Switcher ───────────────────────────────────────────
const KID_CONFIG = {
  arjun: { emoji: '🎒', subtitle: 'Arjun · Shiv Nadar · Grade 7' },
  myra:  { emoji: '🌸', subtitle: 'Myra · Kunskapsskolan · KG' }
};

document.querySelectorAll('.kid-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const kid = btn.dataset.kid;
    document.querySelectorAll('.kid-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.getElementById('arjun-tabs').style.display    = kid === 'arjun' ? '' : 'none';
    document.getElementById('myra-tabs').style.display     = kid === 'myra'  ? '' : 'none';
    document.getElementById('arjun-content').style.display = kid === 'arjun' ? '' : 'none';
    document.getElementById('myra-content').style.display  = kid === 'myra'  ? '' : 'none';

    document.getElementById('kidEmoji').textContent    = KID_CONFIG[kid].emoji;
    document.getElementById('kidSubtitle').textContent = KID_CONFIG[kid].subtitle;
  });
});

// ── Tab switching (scoped per kid) ─────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const nav = btn.closest('.tabs');
    const contentArea = nav.id === 'arjun-tabs' ? 'arjun-content' : 'myra-content';

    nav.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.getElementById(contentArea).querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Helpers ────────────────────────────────────────────────
function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function todayDayName() {
  return DAYS_OF_WEEK[new Date().getDay()];
}

// ── Header ─────────────────────────────────────────────────
function renderHeader() {
  const now = new Date();
  document.getElementById('headerMeta').innerHTML =
    `${now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}<br>
     <span style="color:#10b981;font-weight:600">${DATA.meta.lastUpdated ? 'Updated ' + formatRelative(DATA.meta.lastUpdated) : 'Not yet updated today'}</span>`;

  document.getElementById('todayDate').textContent =
    now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function formatRelative(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return new Date(isoStr).toLocaleDateString('en-IN');
}

// ── Today's Subjects ───────────────────────────────────────
function renderTodaySubjects() {
  const day = todayDayName();
  const subjects = DATA.timetable[day] || [];
  const el = document.getElementById('todaySubjects');

  if (!subjects.length) {
    el.innerHTML = '<p class="muted">No school today 🎉</p>';
    return;
  }

  el.innerHTML = subjects.map(s => {
    const isCore = DATA.coreSubjects.includes(s);
    return `<span class="chip ${isCore ? 'chip-core' : 'chip-activity'}">${s}</span>`;
  }).join('');
}

// ── Today's Summary ────────────────────────────────────────
function renderTodaySummary() {
  const today = todayISO();
  const entry = DATA.days.find(d => d.date === today);
  const el = document.getElementById('todaySummary');

  if (!entry) {
    el.innerHTML = `<p class="muted">No updates yet for today. The dashboard updates at 7 PM each evening.</p>`;
    return;
  }

  el.innerHTML = `<div style="white-space:pre-wrap;font-size:0.875rem;line-height:1.7">${escHtml(entry.summary)}</div>`;
}

// ── Today's Emails ─────────────────────────────────────────
function renderTodayEmails() {
  const today = todayISO();
  const entry = DATA.days.find(d => d.date === today);
  const el = document.getElementById('todayEmails');

  const emails = entry?.emails || [];
  if (!emails.length) {
    el.innerHTML = '<p class="muted">No school emails processed yet today.</p>';
    return;
  }

  el.innerHTML = emails.map(e => `
    <div class="email-item">
      <div class="email-subject">${escHtml(e.subject)}</div>
      <div class="email-from">From: ${escHtml(e.from)}</div>
      <div class="email-preview">${escHtml(e.summary)}</div>
      <div class="email-tags">
        ${(e.tags||[]).map(t => `<span class="tag tag-${t}">${tagLabel(t)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function tagLabel(t) {
  return { hw:'Homework', test:'Test/Quiz', chapter:'Chapter', announcement:'Announcement', veracross:'Veracross' }[t] || t;
}

// ── Veracross Checklist ────────────────────────────────────
// Homework Tracker
function renderHomework() {
  const today = todayISO();
  const entry = DATA.days.find(d => d.date === today);
  const el    = document.getElementById('homeworkList');
  const items = entry?.homeworkItems || [];

  if (!items.length) {
    el.innerHTML = '<p class="muted">No homework assigned yet today.</p>';
    return;
  }

  const done    = items.filter(h => h.done).length;
  const pending = items.length - done;

  let html = '<div class="hw-summary">';
  html += '<span class="hw-stat hw-done-stat">✅ ' + done + ' done</span>';
  if (pending) html += '<span class="hw-stat hw-pending-stat">⏳ ' + pending + ' pending</span>';
  html += '</div>';

  html += items.map((h, i) => `
    <div class="vc-item ${h.done ? 'hw-item-done' : ''}">
      <input type="checkbox" class="vc-checkbox" id="hw-${i}" ${h.done ? 'checked' : ''} disabled>
      <label class="vc-label" for="hw-${i}">
        <strong>${escHtml(h.subject)}</strong>
        <span>${escHtml(h.description)}</span>
        ${h.dueDate ? '<span class="hw-due">📅 Due: ' + escHtml(h.dueDate) + '</span>' : ''}
        ${h.done && h.doneAt ? '<span class="hw-done-time">✅ Done at ' + new Date(h.doneAt).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}) + '</span>' : ''}
      </label>
    </div>
  `).join('');

  el.innerHTML = html;
}

function vcItemId(date, action) {
  // Stable ID for a veracross item — same system as todoItems
  let h = 0;
  for (const c of `vc-${date}-${action}`) h = Math.imul(31, h) + c.charCodeAt(0) | 0;
  return 'vc-' + Math.abs(h).toString(16).padStart(8, '0');
}

function renderVcItem(item, date) {
  const id   = vcItemId(date, item.action);
  const done = isTodoDone(id);
  const doneAt = _todoState[id]?.doneAt
    ? new Date(_todoState[id].doneAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
    : '';
  return `
    <div class="vc-item ${done ? 'hw-item-done' : ''}">
      <input type="checkbox" class="vc-checkbox" id="${id}"
        ${done ? 'checked' : ''}
        onchange="toggleVcItem('${id}', this)">
      <label class="vc-label" for="${id}">
        <strong>${escHtml(item.action)}</strong>
        <span>${escHtml(item.detail)}</span>
        ${done && doneAt ? `<span class="hw-done-time">✅ Done at ${doneAt}</span>` : ''}
      </label>
    </div>`;
}

window.toggleVcItem = async function(id, checkbox) {
  const done = checkbox.checked;
  _todoState[id] = done
    ? { done: true,  doneAt: new Date().toISOString() }
    : { done: false, doneAt: null };
  await saveTodoState();
  renderVeracrossChecklist();
  renderVeracrossTab();
  renderTodosPanel(); // VC section in action items updates too
};

function renderVeracrossChecklist() {
  const today = todayISO();
  const entry = DATA.days.find(d => d.date === today);
  const el    = document.getElementById('veracrossChecklist');
  const items = entry?.veracrossItems || [];

  if (!items.length) {
    el.innerHTML = '<p class="muted">No Veracross action items for today.</p>';
    return;
  }
  el.innerHTML = items.map(item => renderVcItem(item, today)).join('');
}

// ── History Tab ────────────────────────────────────────────
// Groups ALL emails across ALL days by section (General + per subject)
// Within each section, shows entries sorted by date descending.
function renderHistory(monthFilter) {
  const el = document.getElementById('historyList');
  let allDays = [...DATA.days].sort((a,b) => b.date.localeCompare(a.date));
  if (monthFilter) allDays = allDays.filter(d => d.date.startsWith(monthFilter));

  if (!allDays.length) {
    el.innerHTML = '<p class="muted">No history yet.</p>';
    return;
  }

  // Build a flat list of { date, email } across all days
  const allEntries = [];
  allDays.forEach(day => {
    (day.emails || []).forEach(email => {
      allEntries.push({ date: day.date, email });
    });
  });

  // Group by section: null → General, else subject name
  const sections = {}; // key: "General" or subject name
  allEntries.forEach(({ date, email }) => {
    const key = email.schoolSubject || 'General';
    if (!sections[key]) sections[key] = [];
    sections[key].push({ date, email });
  });

  // Order: General first, then subjects in coreSubjects order
  const sectionOrder = ['General', ...DATA.coreSubjects];
  const orderedKeys = [
    ...sectionOrder.filter(k => sections[k]),
    ...Object.keys(sections).filter(k => !sectionOrder.includes(k))
  ];

  const sectionEmoji = {
    'General': '📢', 'Math': '🔢', 'English': '📖', 'Hindi': '🪷',
    'Social Science': '🌍', 'Physics': '⚡', 'Chemistry': '🧪',
    'Biology': '🌿', 'IT': '💻', 'Spanish': '🇪🇸'
  };

  el.innerHTML = orderedKeys.map((sectionKey, si) => {
    const entries = sections[sectionKey].sort((a,b) => b.date.localeCompare(a.date));
    const emoji = sectionEmoji[sectionKey] || '📚';

    const rows = entries.map(({ date, email }) => `
      <div class="hist-section-entry">
        <div class="hist-entry-date">${formatDate(date)}</div>
        <div class="hist-entry-content">
          <div class="email-subject">${escHtml(email.subject)}</div>
          <div class="email-from">${escHtml(email.from)}</div>
          <div class="email-preview">${escHtml(email.summary)}</div>
          <div class="email-tags">${(email.tags||[]).map(t => `<span class="tag tag-${t}">${tagLabel(t)}</span>`).join('')}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="hist-section">
        <div class="hist-section-header" onclick="toggleHistSection(${si})">
          <span class="hist-section-title">${emoji} ${sectionKey}</span>
          <span class="hist-section-count">${entries.length} update${entries.length !== 1 ? 's' : ''}</span>
          <span class="hist-section-toggle" id="hst-toggle-${si}">▲</span>
        </div>
        <div class="hist-section-body open" id="hst-body-${si}">
          ${rows}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleHistSection = function(i) {
  const body = document.getElementById('hst-body-' + i);
  const toggle = document.getElementById('hst-toggle-' + i);
  const open = body.classList.toggle('open');
  toggle.textContent = open ? '▲' : '▼';
};

// ── Topic Log Tab ──────────────────────────────────────────
function renderTopicLog() {
  const el = document.getElementById('topicLog');
  const subjects = DATA.coreSubjects;

  if (!DATA.topicLog.length) {
    el.innerHTML = '<p class="muted">Topics will appear here as teacher emails are processed.</p>';
    return;
  }

  el.innerHTML = subjects.map((subject, si) => {
    const entries = DATA.topicLog
      .filter(t => t.subject === subject)
      .sort((a,b) => b.date.localeCompare(a.date));

    if (!entries.length) return '';

    return `
      <div class="subject-section">
        <div class="subject-title" onclick="toggleTopics(${si})">
          <h3>${subject}</h3>
          <span class="topic-count">${entries.length} topic(s)</span>
        </div>
        <div class="topic-entries" id="topics-${si}">
          ${entries.map(e => `
            <div class="topic-entry">
              <span class="topic-entry-date">${e.date}</span>
              <span class="topic-entry-text">${escHtml(e.topic)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleTopics = function(i) {
  document.getElementById('topics-' + i).classList.toggle('open');
};

// ── Veracross Tab ──────────────────────────────────────────
function renderVeracrossTab() {
  const el = document.getElementById('veracrossLog');
  if (!DATA.veracrossLog.length) {
    el.innerHTML = '<p class="muted">No Veracross notification emails detected yet.</p>';
    return;
  }

  el.innerHTML = DATA.veracrossLog.map(entry => {
    const items   = entry.items || [];
    const doneCount = items.filter(item => isTodoDone(vcItemId(entry.date, item.action))).length;
    return `
      <div class="history-day">
        <div class="history-day-header">
          <span class="history-day-date">${formatDate(entry.date)}</span>
          <span class="history-day-meta">
            ${items.length} item(s)
            ${doneCount ? `· <span style="color:var(--green)">✅ ${doneCount} done</span>` : ''}
          </span>
        </div>
        <div class="history-day-body open">
          ${items.map(item => renderVcItem(item, entry.date)).join('')}
        </div>
      </div>`;
  }).join('');
}

// ── Footer ─────────────────────────────────────────────────
function renderFooter() {
  document.getElementById('lastUpdated').textContent =
    DATA.meta.lastUpdated ? formatDate(DATA.meta.lastUpdated) : 'Never';
}

// ── Escape HTML ────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Timetable Tab ─────────────────────────────────────────
function renderTimetable() {
  const el = document.getElementById('timetableGrid');
  const today = todayDayName();
  const days  = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const slots = DATA.timetableSlots || [];

  // Build full per-day arrays: fixed slots filled in, teaching slots from timetable
  function buildFullDay(day) {
    const teaching = [...(DATA.timetable[day] || [])];
    return slots.map(slot => {
      if (slot.fixed) return { subject: slot.label, fixed: true };
      return { subject: teaching.shift() || '', fixed: false };
    });
  }

  // Time label column + day columns
  let html = '<div class="timetable-grid timetable-grid-with-times">';

  // Time label column
  html += '<div class="tt-time-col">';
  html += '<div class="tt-day-header">Time</div>';
  slots.forEach(slot => {
    html += `<div class="tt-period tt-time-label">${slot.time}</div>`;
  });
  html += '</div>';

  // Day columns
  days.forEach(day => {
    const isToday = day === today;
    html += `<div class="tt-day-col">`;
    html += `<div class="tt-day-header ${isToday ? 'today-col' : ''}">${day}${isToday ? '<span class="tt-today-badge">Today</span>' : ''}</div>`;

    buildFullDay(day).forEach(({ subject, fixed }) => {
      if (fixed) {
        html += `<div class="tt-period tt-fixed">${subject}</div>`;
      } else if (!subject) {
        html += `<div class="tt-period"></div>`;
      } else {
        const isCore = DATA.coreSubjects.includes(subject);
        html += `<div class="tt-period ${isCore ? 'core' : 'activity'}">${subject}</div>`;
      }
    });

    html += '</div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

// ── Myra Tab ──────────────────────────────────────────────────
function renderMyra() {
  const myra  = DATA.myra || {};
  const today = todayISO();
  const days  = (myra.days || []).sort((a,b) => b.date.localeCompare(a.date));
  const todayEntry = days.find(d => d.date === today);

  // Date badge
  document.getElementById('myraTodayDate').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  // Today's summary
  const sumEl = document.getElementById('myraTodaySummary');
  sumEl.innerHTML = todayEntry?.summary
    ? `<div style="white-space:pre-wrap;font-size:0.875rem;line-height:1.7">${escHtml(todayEntry.summary)}</div>`
    : '<p class="muted">No updates yet for today. Check back after 7 PM.</p>';

  // Today's emails
  const emailEl = document.getElementById('myraEmails');
  const todayEmails = todayEntry?.emails || [];
  if (todayEmails.length) {
    emailEl.innerHTML = todayEmails.map(e => `
      <div class="email-item">
        <div class="email-subject">${escHtml(e.subject)}</div>
        <div class="email-from">${escHtml(e.from)}</div>
        <div class="email-preview">${escHtml(e.summary)}</div>
        ${(e.tags||[]).map(t => `<span class="tag tag-${t}">${tagLabel(t)}</span>`).join('')}
      </div>
    `).join('');
  } else {
    emailEl.innerHTML = '<p class="muted">No emails today.</p>';
  }

  // Full history — all days, newest first
  const histEl = document.getElementById('myraHistory');
  if (!days.length) {
    histEl.innerHTML = '<p class="muted">No history yet.</p>';
    return;
  }

  histEl.innerHTML = days.map((day, i) => {
    const allActions = (day.emails||[]).flatMap(e => e.actions || []);
    return `
      <div class="hist-section">
        <div class="hist-section-header" onclick="toggleMyraDay(${i})">
          <span class="hist-section-title">${formatDate(day.date)}</span>
          <span class="hist-section-count">${(day.emails||[]).length} email(s)${allActions.length ? ' · 🔔 ' + allActions.length + ' action(s)' : ''}</span>
          <span class="hist-section-toggle" id="myra-toggle-${i}">▲</span>
        </div>
        <div class="hist-section-body open" id="myra-body-${i}">
          ${day.summary ? `<div style="padding:0.75rem 1.5rem;font-size:0.875rem;color:var(--gray-600);white-space:pre-wrap">${escHtml(day.summary)}</div>` : ''}
          ${(day.emails||[]).map(e => `
            <div class="email-item">
              <div class="email-subject">${escHtml(e.subject)}</div>
              <div class="email-from">${escHtml(e.from)}</div>
              <div class="email-preview">${escHtml(e.summary)}</div>
              ${(e.actions||[]).map(a => `<div class="myra-action">🔔 ${escHtml(a)}</div>`).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleMyraDay = function(i) {
  const body   = document.getElementById('myra-body-' + i);
  const toggle = document.getElementById('myra-toggle-' + i);
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▲' : '▼';
};

// ── Todo State (GitHub-backed) ─────────────────────────────
// todos-state.json lives in the repo: { "todoId": { done, doneAt } }
// Reads/writes via GitHub Contents API so all devices stay in sync.

const TODOS_PATH = "data/todos-state.json";
let _todoState   = {};   // loaded from GitHub
let _todosFileSha = "";  // needed for GitHub API updates

async function loadTodoState() {
  const cfg = window.DASHBOARD_CONFIG || {};
  if (!cfg.githubToken) return;  // no token → read-only, ticks won't persist
  try {
    const res = await fetch(
      `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${TODOS_PATH}`,
      { headers: { Authorization: `token ${cfg.githubToken}`, Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return;
    const json = await res.json();
    _todosFileSha = json.sha;
    _todoState = JSON.parse(atob(json.content.replace(/\n/g, "")));
  } catch (e) { console.warn("Could not load todo state:", e); }
}

async function saveTodoState() {
  const cfg = window.DASHBOARD_CONFIG || {};
  if (!cfg.githubToken) return;
  try {
    const content = btoa(JSON.stringify(_todoState, null, 2));
    const res = await fetch(
      `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${TODOS_PATH}`,
      {
        method: "PUT",
        headers: { Authorization: `token ${cfg.githubToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Update todo state [skip ci]`,
          content,
          sha: _todosFileSha,
        }),
      }
    );
    if (res.ok) {
      const j = await res.json();
      _todosFileSha = j.content.sha;
    }
  } catch (e) { console.warn("Could not save todo state:", e); }
}

function isTodoDone(id) {
  return !!(_todoState[id]?.done);
}

async function toggleTodo(id, checkbox) {
  const done = checkbox.checked;
  _todoState[id] = done
    ? { done: true,  doneAt: new Date().toISOString() }
    : { done: false, doneAt: null };
  saveTodoState(); // fire and forget — don't block re-render
  renderTodosPanel();
  renderMyraTodosPanel();
}

// Collect ALL todoItems across all days for a kid
// Enriches each todo with: category, schoolSubject, emailDate
function collectAllTodos(kid) {
  const items = [];
  const days = kid === "arjun" ? DATA.days : (DATA.myra?.days || []);
  days.forEach(day => {
    (day.emails || []).forEach(email => {
      const tags    = email.tags || [];
      const subject = email.schoolSubject || null;
      // Categorise by parent email tags
      let category;
      if (tags.includes("hw"))         category = "homework";
      else if (tags.includes("veracross")) category = "veracross";
      else                              category = "general";

      (email.todoItems || []).forEach(t => items.push({
        ...t,
        date:         day.date,
        category,
        schoolSubject: subject,
      }));
    });
  });
  return items;
}

function formatDueDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  } catch { return d; }
}

function isDueSoon(d) {
  if (!d) return false;
  const diff = new Date(d) - new Date();
  return diff >= 0 && diff < 3 * 86400000; // within 3 days
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date() && !isTodoDone;
}

// ── Todo table helpers ─────────────────────────────────────

function sortTodos(todos) {
  const open   = todos.filter(t => !isTodoDone(t.id));
  const closed = todos.filter(t =>  isTodoDone(t.id));
  open.sort((a, b) => {
    const aOver = a.dueDate && new Date(a.dueDate) < new Date();
    const bOver = b.dueDate && new Date(b.dueDate) < new Date();
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return  1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return  1;
    return 0;
  });
  return { open, closed };
}

function renderRow(t, isDone) {
  const state   = _todoState[t.id];
  const doneAt  = state?.doneAt
    ? new Date(state.doneAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : '';
  const overdue = !isDone && t.dueDate && new Date(t.dueDate) < new Date();
  const soon    = !isDone && isDueSoon(t.dueDate);
  const dueCls  = overdue ? 'todo-overdue' : soon ? 'todo-soon' : '';

  return `
    <tr class="${isDone ? 'todo-row-done' : 'todo-row-open'}">
      <td class="todo-check-cell">
        <input type="checkbox" class="todo-checkbox" id="td-${t.id}"
          ${isDone ? 'checked' : ''}
          onchange="toggleTodo('${t.id}', this)">
        <label class="todo-check-custom" for="td-${t.id}">
          <span class="todo-check-icon">${isDone ? '✓' : ''}</span>
        </label>
      </td>
      <td class="todo-text-cell ${isDone ? 'todo-text-done' : ''}">
        ${escHtml(t.text)}
        ${isDone && doneAt ? `<span class="todo-done-at">✅ Done ${doneAt}</span>` : ''}
      </td>
      <td class="todo-due-cell ${dueCls}">
        ${t.dueDate ? formatDueDate(t.dueDate) : '—'}
        ${overdue ? '<span class="todo-overdue-badge">Overdue</span>' : ''}
        ${soon && !overdue ? '<span class="todo-soon-badge">Soon</span>' : ''}
      </td>
      <td class="todo-source-cell">
        <a href="#" class="todo-source-link"
          onclick="jumpToHistory(); return false;">
          ${escHtml(t.source || '—')}
        </a>
      </td>
    </tr>`;
}

function buildTable(todos, tableId) {
  if (!todos.length) return '<p class="muted" style="padding:1rem 1.5rem">No items.</p>';
  const { open, closed } = sortTodos(todos);
  let html = `<table class="todo-table" id="${tableId}">
    <thead><tr>
      <th class="todo-check-cell">Done</th>
      <th>To Do</th><th>Due Date</th><th>Reference</th>
    </tr></thead><tbody>`;
  html += open.map(t => renderRow(t, false)).join('');
  if (closed.length) {
    html += `<tr class="todo-divider-row"><td colspan="4">
      <span class="todo-divider-label" onclick="toggleDoneRows(this)">
        ✅ ${closed.length} completed — <span class="toggle-label">show</span>
      </span></td></tr>`;
    html += `<tr class="todo-done-expander" style="display:none"><td colspan="4" style="padding:0">
      <table class="todo-table" style="width:100%"><tbody>
        ${closed.map(t => renderRow(t, true)).join('')}
      </tbody></table></td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

window.toggleDoneRows = function(el) {
  const row   = el.closest('tr').nextElementSibling;
  const label = el.querySelector('.toggle-label');
  const hidden = row.style.display === 'none';
  row.style.display = hidden ? '' : 'none';
  label.textContent = hidden ? 'hide' : 'show';
};

window.jumpToHistory = function() {
  document.querySelectorAll('#arjun-tabs .tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#arjun-content .tab-content').forEach(s => s.classList.remove('active'));
  const histTab = document.querySelector('#arjun-tabs .tab[data-tab="history"]');
  if (histTab) histTab.classList.add('active');
  document.getElementById('tab-history').classList.add('active');
  document.querySelectorAll('.hist-section-body').forEach(b => b.classList.add('open'));
};

// ── Sectioned todo panel ───────────────────────────────────

let _hwSubjectFilter = 'all'; // active homework subject filter

function renderTodosPanel() {
  const all = collectAllTodos("arjun");
  const el  = document.getElementById("todoList");
  const meta = document.getElementById("todoPanelMeta");

  const hw       = all.filter(t => t.category === 'homework');
  const vc       = all.filter(t => t.category === 'veracross');
  const general  = all.filter(t => t.category === 'general');

  const openCount = all.filter(t => !isTodoDone(t.id)).length;
  const doneCount = all.filter(t =>  isTodoDone(t.id)).length;
  if (meta) meta.textContent = `${openCount} open · ${doneCount} done`;

  // Subject pills for homework filter
  const subjects = [...new Set(hw.map(t => t.schoolSubject).filter(Boolean))];
  const hwFiltered = _hwSubjectFilter === 'all'
    ? hw
    : hw.filter(t => t.schoolSubject === _hwSubjectFilter);

  const subjectPills = subjects.length > 1
    ? `<div class="todo-subject-pills">
        <span class="subject-pill ${_hwSubjectFilter === 'all' ? 'active' : ''}"
          onclick="setHwFilter('all')">All subjects</span>
        ${subjects.map(s => `
          <span class="subject-pill ${_hwSubjectFilter === s ? 'active' : ''}"
            onclick="setHwFilter('${s}')">${s}</span>
        `).join('')}
      </div>` : '';

  el.innerHTML = `
    ${renderTodoSection('📚 Homework', hw, hwFiltered, subjectPills, 'hw-table', openCount)}
    ${renderTodoSection('🏫 Veracross', vc, vc, '', 'vc-table', openCount)}
    ${renderTodoSection('📋 General Actions', general, general, '', 'gen-table', openCount)}
  `;
}

function renderTodoSection(title, allItems, visibleItems, pillsHtml, tableId, totalOpen) {
  const open = allItems.filter(t => !isTodoDone(t.id)).length;
  if (!allItems.length) return '';
  return `
    <div class="todo-section">
      <div class="todo-section-header" onclick="toggleTodoSection(this)">
        <span class="todo-section-title">${title}</span>
        <span class="todo-section-count">${open} open</span>
        <span class="todo-section-toggle">▲</span>
      </div>
      <div class="todo-section-body open">
        ${pillsHtml}
        ${buildTable(visibleItems, tableId)}
      </div>
    </div>`;
}

window.setHwFilter = function(subject) {
  _hwSubjectFilter = subject;
  renderTodosPanel();
};

window.toggleTodoSection = function(header) {
  const body   = header.nextElementSibling;
  const toggle = header.querySelector('.todo-section-toggle');
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▲' : '▼';
};

function renderMyraTodosPanel() {
  const todos = collectAllTodos("myra");
  const el    = document.getElementById("myraTodoList");
  const meta  = document.getElementById("myraTodoPanelMeta");
  if (!todos.length) {
    el.innerHTML = '<p class="muted">No action items yet.</p>';
    if (meta) meta.textContent = '';
    return;
  }
  const openCount = todos.filter(t => !isTodoDone(t.id)).length;
  const doneCount = todos.filter(t =>  isTodoDone(t.id)).length;
  if (meta) meta.textContent = `${openCount} open · ${doneCount} done`;
  el.innerHTML = buildTable(todos, 'myra-todo-table');
}

// ── Init ───────────────────────────────────────────────────
// Synchronous renders first
renderHeader();
renderTodaySubjects();
renderTodaySummary();
renderTodayEmails();
renderHomework();
renderVeracrossChecklist();
renderHistory();
renderTopicLog();
renderVeracrossTab();
renderTimetable();
renderMyra();

document.getElementById('historyMonthPicker').addEventListener('change', function() {
  renderHistory(this.value || undefined);
});

// Render todos immediately with empty state (so table shows even if GitHub load fails)
renderTodosPanel();
renderMyraTodosPanel();

// Then load shared state from GitHub and re-render with tick marks
loadTodoState().then(() => {
  renderTodosPanel();
  renderMyraTodosPanel();
  renderVeracrossChecklist();
  renderVeracrossTab();
}).catch(() => {
  // GitHub unavailable — items rendered above, ticks just won't persist
});
