// ============================================================
// app.js — Arjun's School Dashboard Frontend Logic
// ============================================================

const DATA = window.DASHBOARD_DATA;
const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Tab switching ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
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

function renderVeracrossChecklist() {
  const today = todayISO();
  const entry = DATA.days.find(d => d.date === today);
  const el = document.getElementById('veracrossChecklist');
  const items = entry?.veracrossItems || [];

  if (!items.length) {
    el.innerHTML = '<p class="muted">No Veracross action items for today.</p>';
    return;
  }

  el.innerHTML = items.map((item, i) => `
    <div class="vc-item">
      <input type="checkbox" class="vc-checkbox" id="vc-${i}" ${item.done ? 'checked' : ''}>
      <label class="vc-label" for="vc-${i}">
        <strong>${escHtml(item.action)}</strong>
        <span>${escHtml(item.detail)}</span>
      </label>
    </div>
  `).join('');
}

// ── History Tab ────────────────────────────────────────────
// Groups ALL emails across ALL days by section (General + per subject)
// Within each section, shows entries sorted by date descending.
function renderHistory() {
  const el = document.getElementById('historyList');
  const allDays = [...DATA.days].sort((a,b) => b.date.localeCompare(a.date));

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

  el.innerHTML = DATA.veracrossLog.map(entry => `
    <div class="history-day">
      <div class="history-day-header">
        <span class="history-day-date">${formatDate(entry.date)}</span>
        <span class="history-day-meta">${(entry.items||[]).length} item(s)</span>
      </div>
      <div class="history-day-body open">
        ${(entry.items||[]).map((item, i) => `
          <div class="vc-item">
            <input type="checkbox" class="vc-checkbox" ${item.done ? 'checked' : ''}>
            <label class="vc-label">
              <strong>${escHtml(item.action)}</strong>
              <span>${escHtml(item.detail)}</span>
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
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
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  // Find max periods across all days
  const maxPeriods = Math.max(...days.map(d => (DATA.timetable[d] || []).length));

  let html = '<div class="timetable-grid">';

  days.forEach(day => {
    const isToday = day === today;
    html += `<div class="tt-day-col">`;
    html += `<div class="tt-day-header ${isToday ? 'today-col' : ''}">${day}${isToday ? '<span class="tt-today-badge">Today</span>' : ''}</div>`;

    const periods = DATA.timetable[day] || [];
    for (let i = 0; i < maxPeriods; i++) {
      const subject = periods[i] || '';
      if (!subject) {
        html += `<div class="tt-period"></div>`;
      } else {
        const isCore = DATA.coreSubjects.includes(subject);
        html += `<div class="tt-period ${isCore ? 'core' : 'activity'}">${subject}</div>`;
      }
    }

    html += `</div>`;
  });

  html += '</div>';
  el.innerHTML = html;
}

// ── Init ───────────────────────────────────────────────────
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
