// ============================================================
// app.js — School Dashboard Frontend Logic v2
// ============================================================

const DATA = window.DASHBOARD_DATA;
const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Subject emojis ─────────────────────────────────────────
const SUBJECT_EMOJI = {
  'Math': '🔢', 'English': '📖', 'Hindi': '🪷',
  'Social Science': '🌍', 'Physics': '⚡', 'Chemistry': '🧪',
  'Biology': '🌿', 'IT': '💻', 'Spanish': '🇪🇸', 'General': '📢'
};
function subjectEmoji(s) { return SUBJECT_EMOJI[s] || '📚'; }

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
function todayISO() { return new Date().toISOString().split('T')[0]; }
function todayDayName() { return DAYS_OF_WEEK[new Date().getDay()]; }

function formatRelative(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return new Date(isoStr).toLocaleDateString('en-IN');
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDueDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return d; }
}

function isDueSoon(d) {
  if (!d) return false;
  const diff = new Date(d) - new Date();
  return diff >= 0 && diff < 3 * 86400000;
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date();
}

// Stable hash for email anchors
function emailAnchorId(date, from, subject) {
  let h = 0;
  for (const c of `${date}|${from}|${subject}`) h = Math.imul(31, h) + c.charCodeAt(0) | 0;
  return 'em-' + Math.abs(h).toString(16).padStart(8, '0');
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

// ── Today's Subjects ───────────────────────────────────────
function renderTodaySubjects() {
  const day      = todayDayName();
  const subjects = DATA.timetable[day] || [];
  const el       = document.getElementById('todaySubjects');
  if (!subjects.length) { el.innerHTML = '<p class="muted">No school today 🎉</p>'; return; }
  el.innerHTML = subjects.map(s => {
    const isCore = DATA.coreSubjects.includes(s);
    return `<span class="chip ${isCore ? 'chip-core' : 'chip-activity'}">${s}</span>`;
  }).join('');
}

// ── Today's Summary ────────────────────────────────────────
function renderTodaySummary() {
  const today = todayISO();
  const entry = DATA.days.find(d => d.date === today);
  const el    = document.getElementById('todaySummary');
  if (!entry) {
    el.innerHTML = `<p class="muted">No updates yet for today. The dashboard updates at 7 PM each evening.</p>`;
    return;
  }
  el.innerHTML = `<div style="white-space:pre-wrap;font-size:0.875rem;line-height:1.7">${escHtml(entry.summary)}</div>`;
}

// ── Today's Emails ─────────────────────────────────────────
function renderTodayEmails() {
  const today  = todayISO();
  const entry  = DATA.days.find(d => d.date === today);
  const el     = document.getElementById('todayEmails');
  const emails = entry?.emails || [];
  if (!emails.length) { el.innerHTML = '<p class="muted">No school emails processed yet today.</p>'; return; }
  el.innerHTML = emails.map(e => `
    <div class="email-item">
      <div class="email-subject">${escHtml(e.subject)}</div>
      <div class="email-from">From: ${escHtml(e.from)}</div>
      <div class="email-preview">${escHtml(e.summary)}</div>
      <div class="email-tags">${(e.tags||[]).map(t => `<span class="tag tag-${t}">${tagLabel(t)}</span>`).join('')}</div>
    </div>`).join('');
}

function tagLabel(t) {
  return {hw:'Homework',test:'Test/Quiz',chapter:'Chapter',announcement:'Announcement',veracross:'Veracross'}[t] || t;
}

// ── Veracross ─────────────────────────────────────────────
function vcItemId(date, action) {
  let h = 0;
  for (const c of `vc-${date}-${action}`) h = Math.imul(31, h) + c.charCodeAt(0) | 0;
  return 'vc-' + Math.abs(h).toString(16).padStart(8, '0');
}

function renderVcItem(item, date) {
  const id    = vcItemId(date, item.action);
  const done  = isTodoDone(id);
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
  const done  = checkbox.checked;
  const doneAt = done ? new Date().toISOString() : null;
  _todoState[id] = { done, doneAt };
  await _persistTodo(id, done, doneAt);
  renderVeracrossChecklist();
  renderVeracrossTab();
  renderTodosPanel();
};

function renderVeracrossChecklist() {
  const today = todayISO();
  const entry = DATA.days.find(d => d.date === today);
  const el    = document.getElementById('veracrossChecklist');
  const items = entry?.veracrossItems || [];
  if (!items.length) { el.innerHTML = '<p class="muted">No Veracross action items for today.</p>'; return; }
  el.innerHTML = items.map(item => renderVcItem(item, today)).join('');
}

// ── History Tab ────────────────────────────────────────────
function renderHistory(monthFilter) {
  const el     = document.getElementById('historyList');
  let allDays  = [...DATA.days].sort((a,b) => b.date.localeCompare(a.date));
  if (monthFilter) allDays = allDays.filter(d => d.date.startsWith(monthFilter));

  if (!allDays.length) { el.innerHTML = '<p class="muted">No history yet.</p>'; return; }

  const allEntries = [];
  allDays.forEach(day => (day.emails || []).forEach(email => allEntries.push({ date: day.date, email })));

  const sections = {};
  allEntries.forEach(({ date, email }) => {
    const key = email.schoolSubject || 'General';
    if (!sections[key]) sections[key] = [];
    sections[key].push({ date, email });
  });

  const sectionOrder = ['General', ...DATA.coreSubjects];
  const orderedKeys  = [
    ...sectionOrder.filter(k => sections[k]),
    ...Object.keys(sections).filter(k => !sectionOrder.includes(k))
  ];

  el.innerHTML = orderedKeys.map((sectionKey, si) => {
    const entries = sections[sectionKey].sort((a,b) => b.date.localeCompare(a.date));
    const emoji   = subjectEmoji(sectionKey);

    const rows = entries.map(({ date, email }) => {
      const anchorId = emailAnchorId(date, email.from, email.subject);
      return `
        <div class="hist-section-entry email-item" id="${anchorId}">
          <div class="hist-entry-date">${formatDate(date)}</div>
          <div class="hist-entry-content">
            <div class="email-subject">${escHtml(email.subject)}</div>
            <div class="email-from">${escHtml(email.from)}</div>
            <div class="email-preview">${escHtml(email.summary)}</div>
            <div class="email-tags">${(email.tags||[]).map(t => `<span class="tag tag-${t}">${tagLabel(t)}</span>`).join('')}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="hist-section">
        <div class="hist-section-header" onclick="toggleHistSection(${si})">
          <span class="hist-section-title">${emoji} ${sectionKey}</span>
          <span class="hist-section-count">${entries.length} update${entries.length !== 1 ? 's' : ''}</span>
          <span class="hist-section-toggle" id="hst-toggle-${si}">▲</span>
        </div>
        <div class="hist-section-body open" id="hst-body-${si}">${rows}</div>
      </div>`;
  }).join('');
}

window.toggleHistSection = function(i) {
  const body   = document.getElementById('hst-body-' + i);
  const toggle = document.getElementById('hst-toggle-' + i);
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▲' : '▼';
};

// ── Topic Log Tab ──────────────────────────────────────────
function renderTopicLog() {
  const el       = document.getElementById('topicLog');
  const subjects = DATA.coreSubjects;

  // Group topics by subject
  const bySubject = {};
  (DATA.topicLog || []).forEach(t => {
    if (!bySubject[t.subject]) bySubject[t.subject] = [];
    bySubject[t.subject].push(t);
  });

  const hasAnyTopics = Object.keys(bySubject).length > 0;

  if (!hasAnyTopics) {
    el.innerHTML = `
      <div class="waiting-school-state">
        <span class="waiting-icon">📬</span>
        <p>Waiting for update from school</p>
        <p class="muted">Topics will appear here as teacher emails are processed by the nightly fetch script</p>
      </div>`;
    return;
  }

  el.innerHTML = subjects.map((subject, si) => {
    const topics = (bySubject[subject] || []).sort((a,b) => b.date.localeCompare(a.date));
    if (!topics.length) return '';

    const topicTexts     = topics.map(t => t.topic);
    const topicsJsonAttr = escHtml(JSON.stringify(topicTexts));

    return `
      <div class="subject-section">
        <div class="subject-section-header" onclick="toggleTopicSubject(${si})">
          <div class="subject-section-title-row">
            <span class="subject-emoji-large">${subjectEmoji(subject)}</span>
            <h3>${subject}</h3>
            <span class="topic-count-badge">${topics.length} topic${topics.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="subject-section-actions">
            <button class="quiz-generate-btn-small" onclick="event.stopPropagation(); openQuizFlow('${escHtml(subject)}', JSON.parse(this.dataset.topics))" data-topics="${topicsJsonAttr}">
              🎯 Generate Quiz
            </button>
            <span class="topic-toggle-arrow" id="topic-toggle-${si}">▲</span>
          </div>
        </div>
        <div class="topic-list-body open" id="topic-list-${si}">
          <div class="past-quiz-scores" id="quiz-scores-${si}">
            <span class="quiz-scores-loading muted" style="font-size:0.8rem">Loading past scores…</span>
          </div>
          <div class="topic-entries-grid">
            ${topics.map(t => `
              <div class="topic-entry-row">
                <span class="topic-entry-date">${t.date}</span>
                <span class="topic-entry-text">${escHtml(t.topic)}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');

  // Load past quiz scores for each subject async
  subjects.forEach((subject, si) => {
    if (bySubject[subject]?.length) loadQuizScoresForSubject(subject, si);
  });
}

window.toggleTopicSubject = function(i) {
  const body   = document.getElementById('topic-list-' + i);
  const toggle = document.getElementById('topic-toggle-' + i);
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▲' : '▼';
};

async function loadQuizScoresForSubject(subject, si) {
  const el = document.getElementById('quiz-scores-' + si);
  if (!el) return;
  try {
    const res = await fetch('/api/quiz/scores?subject=' + encodeURIComponent(subject));
    if (!res.ok) { el.innerHTML = ''; return; }
    const scores = await res.json();
    if (!scores.length) { el.innerHTML = ''; return; }
    const recent = scores[0];
    const pct    = Math.round((recent.score / recent.total) * 100);
    const badge  = pct >= 80 ? 'quiz-score-high' : pct >= 60 ? 'quiz-score-mid' : 'quiz-score-low';
    el.innerHTML = `
      <div class="quiz-score-strip">
        <span class="quiz-score-label">Last quiz:</span>
        <span class="quiz-score-pill ${badge}">${recent.score}/${recent.total} · ${pct}%</span>
        <span class="quiz-score-date muted">${new Date(recent.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'short'})}</span>
      </div>`;
  } catch { el.innerHTML = ''; }
}

// ── Exam Schedule Tab ──────────────────────────────────────
const EXAM_TYPE_META = {
  'UT1':       { label: 'Unit Test 1',   color: '#3b82f6', emoji: '📝' },
  'UT2':       { label: 'Unit Test 2',   color: '#8b5cf6', emoji: '📝' },
  'MidTerm':   { label: 'Mid Term',      color: '#f59e0b', emoji: '📋' },
  'FinalTerm': { label: 'Final Term',    color: '#ef4444', emoji: '🏁' },
  'ClassTest': { label: 'Class Test',    color: '#10b981', emoji: '✏️' },
  'Other':     { label: 'Other',         color: '#6b7280', emoji: '📌' },
};

function renderExamSchedule() {
  const el    = document.getElementById('examScheduleContainer');
  const exams = DATA.examSchedule || [];

  if (!exams.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>📝 Exam Schedule</h2><span class="badge-info">From school emails only</span></div>
        <div class="waiting-school-state">
          <span class="waiting-icon">📬</span>
          <p>Waiting for update from school</p>
          <p class="muted">Exam schedules will appear here when received via email</p>
        </div>
      </div>`;
    return;
  }

  const today = todayISO();

  // Group by exam type
  const byType = {};
  exams.forEach(e => {
    const t = e.examType || 'Other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(e);
  });

  const typeOrder = ['UT1','UT2','MidTerm','FinalTerm','ClassTest','Other'];
  const orderedTypes = [
    ...typeOrder.filter(t => byType[t]),
    ...Object.keys(byType).filter(t => !typeOrder.includes(t))
  ];

  const html = orderedTypes.map(type => {
    const meta  = EXAM_TYPE_META[type] || EXAM_TYPE_META['Other'];
    const items = byType[type].sort((a,b) => a.examDate.localeCompare(b.examDate));
    const rows  = items.map(e => {
      const daysLeft = Math.ceil((new Date(e.examDate) - new Date()) / 86400000);
      const isPast   = daysLeft < 0;
      const isToday  = e.examDate === today;
      let countdownHtml = '';
      if (isToday)       countdownHtml = '<span class="exam-countdown today-exam">Today!</span>';
      else if (isPast)   countdownHtml = '<span class="exam-countdown past-exam">Done</span>';
      else if (daysLeft <= 7) countdownHtml = `<span class="exam-countdown soon-exam">${daysLeft}d</span>`;
      else                    countdownHtml = `<span class="exam-countdown future-exam">${daysLeft}d</span>`;

      return `
        <tr class="${isPast ? 'exam-row-past' : isToday ? 'exam-row-today' : ''}">
          <td class="exam-date-cell">${formatDate(e.examDate)}</td>
          <td class="exam-subject-cell"><strong>${escHtml(e.subject)}</strong></td>
          <td class="exam-topics-cell">${escHtml(e.topics || '—')}</td>
          <td class="exam-countdown-cell">${countdownHtml}</td>
        </tr>`;
    }).join('');

    return `
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header exam-type-header" style="border-left:4px solid ${meta.color}">
          <h2>${meta.emoji} ${meta.label}</h2>
          <span class="badge-info">${items.length} exam${items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="exam-table-wrap">
          <table class="exam-table">
            <thead><tr><th>Date</th><th>Subject</th><th>Topics</th><th>Countdown</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card-header" style="padding:1.5rem 0 0.5rem">
      <h2>📝 Exam Schedule</h2>
      <span class="badge-info">From school emails only · Never invented</span>
    </div>
    ${html}`;
}

// ── Holiday Calendar Tab ───────────────────────────────────
function renderHolidays() {
  const el       = document.getElementById('holidayContainer');
  const holidays = (DATA.holidays || []).sort((a,b) => a.date.localeCompare(b.date));
  const today    = todayISO();

  if (!holidays.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>🎉 Holiday Calendar</h2><span class="badge-info">From school emails only</span></div>
        <div class="waiting-school-state">
          <span class="waiting-icon">📬</span>
          <p>Waiting for update from school</p>
          <p class="muted">Holiday calendar will appear here when the school circular or attachment is processed</p>
        </div>
      </div>`;
    return;
  }

  const upcoming = holidays.filter(h => h.date >= today);
  const past     = holidays.filter(h => h.date  < today);

  function renderHolidayList(list) {
    return list.map(h => {
      const daysLeft   = Math.ceil((new Date(h.date) - new Date()) / 86400000);
      const isPast     = h.date < today;
      const isToday    = h.date === today;
      const daysLabel  = isToday ? 'Today!' : isPast ? '' : `in ${daysLeft}d`;
      return `
        <div class="holiday-row ${isPast ? 'holiday-past' : isToday ? 'holiday-today' : ''}">
          <div class="holiday-date-block">
            <span class="holiday-month">${new Date(h.date).toLocaleDateString('en-IN',{month:'short'})}</span>
            <span class="holiday-day-num">${new Date(h.date).getDate()}</span>
          </div>
          <div class="holiday-info">
            <span class="holiday-name">${escHtml(h.name)}</span>
            <span class="holiday-weekday muted">${new Date(h.date).toLocaleDateString('en-IN',{weekday:'long'})}</span>
          </div>
          ${daysLabel ? `<span class="holiday-countdown ${isToday ? 'today-badge' : ''}">${daysLabel}</span>` : ''}
        </div>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>🎉 Holiday Calendar</h2>
        <span class="badge-info">${holidays.length} holiday${holidays.length !== 1 ? 's' : ''} · Shiv Nadar</span>
      </div>
      ${upcoming.length ? `
        <div class="holiday-section-label">Upcoming</div>
        <div class="holiday-list">${renderHolidayList(upcoming)}</div>` : ''}
      ${past.length ? `
        <div class="holiday-section-label muted">Past</div>
        <div class="holiday-list holiday-list-past">${renderHolidayList(past)}</div>` : ''}
    </div>`;
}

// ── Veracross Tab ──────────────────────────────────────────
function renderVeracrossTab() {
  const el = document.getElementById('veracrossLog');
  if (!DATA.veracrossLog.length) {
    el.innerHTML = '<p class="muted" style="padding:0 1.5rem 1rem">No Veracross notification emails detected yet.</p>';
    return;
  }
  el.innerHTML = DATA.veracrossLog.map(entry => {
    const items     = entry.items || [];
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

// ── Timetable Tab ─────────────────────────────────────────
function renderTimetable() {
  const el    = document.getElementById('timetableGrid');
  const today = todayDayName();
  const days  = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const slots = DATA.timetableSlots || [];

  function buildFullDay(day) {
    const teaching = [...(DATA.timetable[day] || [])];
    return slots.map(slot => {
      if (slot.fixed) return { subject: slot.label, fixed: true };
      return { subject: teaching.shift() || '', fixed: false };
    });
  }

  let html = '<div class="timetable-grid timetable-grid-with-times">';

  // Time label column
  html += '<div class="tt-time-col">';
  html += '<div class="tt-day-header">Time</div>';
  slots.forEach(slot => { html += `<div class="tt-period tt-time-label">${slot.time}</div>`; });
  html += '</div>';

  // Day columns
  days.forEach(day => {
    const isToday = day === today;
    html += `<div class="tt-day-col">`;
    html += `<div class="tt-day-header ${isToday ? 'today-col' : ''}">${day}${isToday ? '<span class="tt-today-badge">Today</span>' : ''}</div>`;
    buildFullDay(day).forEach(({ subject, fixed }) => {
      if (fixed)        html += `<div class="tt-period tt-fixed">${subject}</div>`;
      else if (!subject) html += `<div class="tt-period"></div>`;
      else {
        const isCore = DATA.coreSubjects.includes(subject);
        html += `<div class="tt-period ${isCore ? 'core' : 'activity'}">${subject}</div>`;
      }
    });
    html += '</div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

// ── Myra Tab ──────────────────────────────────────────────
function renderMyra() {
  const myra       = DATA.myra || {};
  const today      = todayISO();
  const days       = (myra.days || []).sort((a,b) => b.date.localeCompare(a.date));
  const todayEntry = days.find(d => d.date === today);

  document.getElementById('myraTodayDate').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  const sumEl = document.getElementById('myraTodaySummary');
  sumEl.innerHTML = todayEntry?.summary
    ? `<div style="white-space:pre-wrap;font-size:0.875rem;line-height:1.7">${escHtml(todayEntry.summary)}</div>`
    : '<p class="muted">No updates yet for today. Check back after 7 PM.</p>';

  const emailEl     = document.getElementById('myraEmails');
  const todayEmails = todayEntry?.emails || [];
  emailEl.innerHTML = todayEmails.length
    ? todayEmails.map(e => `
        <div class="email-item">
          <div class="email-subject">${escHtml(e.subject)}</div>
          <div class="email-from">${escHtml(e.from)}</div>
          <div class="email-preview">${escHtml(e.summary)}</div>
          ${(e.tags||[]).map(t => `<span class="tag tag-${t}">${tagLabel(t)}</span>`).join('')}
        </div>`).join('')
    : '<p class="muted">No emails today.</p>';

  const histEl = document.getElementById('myraHistory');
  if (!days.length) { histEl.innerHTML = '<p class="muted">No history yet.</p>'; return; }

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
          ${(day.emails||[]).map(e => {
            const aid = emailAnchorId(day.date, e.from, e.subject);
            return `
            <div class="email-item" id="${aid}">
              <div class="email-subject">${escHtml(e.subject)}</div>
              <div class="email-from">${escHtml(e.from)}</div>
              <div class="email-preview">${escHtml(e.summary)}</div>
              ${(e.actions||[]).map(a => `<div class="myra-action">🔔 ${escHtml(a)}</div>`).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

window.toggleMyraDay = function(i) {
  const body   = document.getElementById('myra-body-' + i);
  const toggle = document.getElementById('myra-toggle-' + i);
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▲' : '▼';
};

// ── Todo State (Express API-backed) ───────────────────────
// Replaces the GitHub Contents API approach. The Express server
// writes to SQLite; all devices share state as long as they
// hit the same server instance.

let _todoState = {};  // { id: { done, doneAt } }

async function loadTodoState() {
  try {
    const res = await fetch('/api/todos');
    if (res.ok) _todoState = await res.json();
  } catch (e) {
    console.warn('Could not load todo state (server may not be running):', e.message);
  }
}

async function _persistTodo(id, done, doneAt) {
  try {
    await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done, doneAt }),
    });
  } catch (e) { console.warn('Could not persist todo:', e.message); }
}

function isTodoDone(id) { return !!(_todoState[id]?.done); }

async function toggleTodo(id, checkbox) {
  const done   = checkbox.checked;
  const doneAt = done ? new Date().toISOString() : null;
  _todoState[id] = { done, doneAt };
  _persistTodo(id, done, doneAt); // fire and forget
  renderTodosPanel();
  renderMyraTodosPanel();
}

// ── Collect todos with enrichment ─────────────────────────
let _todoDateFilterDays = 30;   // 0 = all time

window.setTodoDateFilter = function(days) {
  _todoDateFilterDays = days;
  renderTodosPanel();
};

function collectAllTodos(kid) {
  const items = [];
  const days  = kid === 'arjun' ? DATA.days : (DATA.myra?.days || []);

  // Compute cutoff date
  let cutoff = '';
  if (_todoDateFilterDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() - _todoDateFilterDays);
    cutoff = d.toISOString().split('T')[0];
  }

  days.forEach(day => {
    if (cutoff && day.date < cutoff) return; // date filter
    (day.emails || []).forEach(em => {
      const tags    = em.tags || [];
      const subject = em.schoolSubject || null;
      let category;
      if (tags.includes('hw'))          category = 'homework';
      else if (tags.includes('veracross')) category = 'veracross';
      else                              category = 'general';

      (em.todoItems || []).forEach(t => items.push({
        ...t,
        date:         day.date,
        category,
        schoolSubject: subject,
        emailSubject:  em.subject,
        emailFrom:     em.from,
      }));
    });
  });

  return items;
}

// ── Urgent banner (due today/tomorrow) ────────────────────
function renderUrgentBanner(todos) {
  const el      = document.getElementById('urgentBanner');
  const today   = todayISO();
  const tomDate = new Date(); tomDate.setDate(tomDate.getDate() + 1);
  const tomorrow = tomDate.toISOString().split('T')[0];

  const urgent = todos.filter(t =>
    !isTodoDone(t.id) &&
    t.dueDate &&
    (t.dueDate === today || t.dueDate === tomorrow)
  );

  if (!urgent.length) { el.innerHTML = ''; return; }

  const hasDueToday = urgent.some(t => t.dueDate === today);
  el.innerHTML = `
    <div class="urgent-banner">
      <span class="urgent-icon">🔔</span>
      <div class="urgent-content">
        <strong>${urgent.length} item${urgent.length > 1 ? 's' : ''} due ${hasDueToday ? 'today' : 'tomorrow'}!</strong>
        <ul>${urgent.map(t =>
          `<li>${escHtml(t.text)}${t.dueDate === today ? ' <span class="today-badge">Today</span>' : ''}</li>`
        ).join('')}</ul>
      </div>
    </div>`;
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

function renderRow(t, isDone, kid) {
  kid = kid || 'arjun';
  const state   = _todoState[t.id];
  const doneAt  = state?.doneAt
    ? new Date(state.doneAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : '';
  const overdue = !isDone && t.dueDate && new Date(t.dueDate) < new Date();
  const soon    = !isDone && isDueSoon(t.dueDate);
  const dueCls  = overdue ? 'todo-overdue' : soon ? 'todo-soon' : '';

  // Compute anchor for source deep-link
  const anchorId = t.emailFrom
    ? emailAnchorId(t.date, t.emailFrom, t.emailSubject || '')
    : '';

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
        ${anchorId
          ? `<a href="#" class="todo-source-link" onclick="jumpToEmail('${anchorId}','${kid}'); return false;">${escHtml(t.source || t.emailSubject || '—')}</a>`
          : escHtml(t.source || '—')}
      </td>
    </tr>`;
}

function buildTable(todos, tableId, kid) {
  kid = kid || 'arjun';
  if (!todos.length) return '<p class="muted" style="padding:1rem 1.5rem">No items.</p>';
  const { open, closed } = sortTodos(todos);
  let html = `<table class="todo-table" id="${tableId}">
    <thead><tr>
      <th class="todo-check-cell">Done</th>
      <th>To Do</th><th>Due Date</th><th>Reference</th>
    </tr></thead><tbody>`;
  html += open.map(t => renderRow(t, false, kid)).join('');
  if (closed.length) {
    html += `<tr class="todo-divider-row"><td colspan="4">
      <span class="todo-divider-label" onclick="toggleDoneRows(this)">
        ✅ ${closed.length} completed — <span class="toggle-label">show</span>
      </span></td></tr>`;
    html += `<tr class="todo-done-expander" style="display:none"><td colspan="4" style="padding:0">
      <table class="todo-table" style="width:100%"><tbody>
        ${closed.map(t => renderRow(t, true, kid)).join('')}
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

// ── Deep-link: jump to email in History tab ───────────────
window.jumpToEmail = function(anchorId, kid) {
  kid = kid || 'arjun';

  // If switching kids, click the kid switcher button first
  const kidBtn = document.querySelector(`.kid-btn[data-kid="${kid}"]`);
  if (kidBtn && !kidBtn.classList.contains('active')) kidBtn.click();

  // Switch to the correct History tab for this kid
  const tabSelector = kid === 'myra'
    ? '#myra-tabs .tab[data-tab="myra-history"]'
    : '#arjun-tabs .tab[data-tab="history"]';
  const histTab = document.querySelector(tabSelector);
  if (histTab) histTab.click();

  // Wait for render, then scroll and highlight
  setTimeout(() => {
    const el = document.getElementById(anchorId);
    if (el) {
      // Expand parent hist-section-body if collapsed
      const body = el.closest('.hist-section-body');
      if (body && !body.classList.contains('open')) body.classList.add('open');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('email-highlight');
      setTimeout(() => el.classList.remove('email-highlight'), 3000);
    }
  }, 200);
};

// ── Sectioned todo panel ───────────────────────────────────
let _hwSubjectFilter = 'all';

function renderTodosPanel() {
  const all     = collectAllTodos('arjun');
  const el      = document.getElementById('todoList');
  const meta    = document.getElementById('todoPanelMeta');

  const hw      = all.filter(t => t.category === 'homework');
  const vc      = all.filter(t => t.category === 'veracross');
  const general = all.filter(t => t.category === 'general');

  const openCount = all.filter(t => !isTodoDone(t.id)).length;
  const doneCount = all.filter(t =>  isTodoDone(t.id)).length;
  if (meta) meta.textContent = `${openCount} open · ${doneCount} done`;

  // 24h urgent banner
  renderUrgentBanner(all);

  // Subject pills for homework filter
  const subjects = [...new Set(hw.map(t => t.schoolSubject).filter(Boolean))];
  const hwFiltered = _hwSubjectFilter === 'all'
    ? hw
    : hw.filter(t => t.schoolSubject === _hwSubjectFilter);

  const subjectPills = subjects.length > 1
    ? `<div class="todo-subject-pills">
        <span class="subject-pill ${_hwSubjectFilter === 'all' ? 'active' : ''}" onclick="setHwFilter('all')">All subjects</span>
        ${subjects.map(s =>
          `<span class="subject-pill ${_hwSubjectFilter === s ? 'active' : ''}" onclick="setHwFilter('${s}')">${s}</span>`
        ).join('')}
       </div>` : '';

  if (!all.length) {
    el.innerHTML = `
      <div class="waiting-school-state" style="padding:2rem">
        <span class="waiting-icon">📬</span>
        <p>Waiting for update from school</p>
        <p class="muted">Action items will appear here as school emails are processed</p>
      </div>`;
    return;
  }

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
        ${buildTable(visibleItems, tableId, 'arjun')}
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
  const todos = collectAllTodos('myra');
  const el    = document.getElementById('myraTodoList');
  const meta  = document.getElementById('myraTodoPanelMeta');

  if (!todos.length) {
    el.innerHTML = `
      <div class="waiting-school-state" style="padding:2rem">
        <span class="waiting-icon">📬</span>
        <p>Waiting for update from school</p>
        <p class="muted">Action items will appear here as school emails are processed</p>
      </div>`;
    if (meta) meta.textContent = '';
    return;
  }
  const openCount = todos.filter(t => !isTodoDone(t.id)).length;
  const doneCount = todos.filter(t =>  isTodoDone(t.id)).length;
  if (meta) meta.textContent = `${openCount} open · ${doneCount} done`;
  el.innerHTML = buildTable(todos, 'myra-todo-table', 'myra');
}

// ══════════════════════════════════════════════════════════
// QUIZ FLOW
// ══════════════════════════════════════════════════════════

let _quizState = null; // { subject, topics, questions, currentQ, answers }

function _quizEl() { return document.getElementById('quizModal'); }

window.handleQuizOverlayClick = function(e) {
  // Close if user clicks the dark overlay (not the modal itself)
  if (e.target === document.getElementById('quizOverlay')) closeQuiz();
};

window.openQuizFlow = function(subject, topics) {
  _quizState = { subject, topics: Array.isArray(topics) ? topics : [], questions: null, currentQ: 0, answers: [] };
  _renderQuizPromptEditor();
};

function _renderQuizPromptEditor() {
  const { subject, topics } = _quizState;
  const defaultPrompt =
`Generate 20 multiple-choice questions for Arjun, Grade 7, Shiv Nadar School.
Subject: ${subject}
Topics covered in class: ${topics.slice(0, 6).join('; ')}${topics.length > 6 ? '…' : ''}

Make questions based on the CBSE/NCERT Grade 7 curriculum for these specific topics.
Vary difficulty: ~6 easy, ~9 medium, ~5 challenging.
Return ONLY a JSON array (no markdown, no explanation).`;

  _quizEl().innerHTML = `
    <div class="qz-header">
      <h2>🎯 Generate Quiz · ${escHtml(subject)}</h2>
      <button class="qz-close" onclick="closeQuiz()">✕</button>
    </div>
    <div class="qz-body">
      <p class="qz-label">Topics from your class notes:</p>
      <div class="qz-topic-chips">
        ${topics.map(t => `<span class="qz-chip">${escHtml(t)}</span>`).join('') || '<span class="muted">No topics logged yet — quiz will use Grade 7 curriculum</span>'}
      </div>
      <p class="qz-label" style="margin-top:1.5rem">Prompt for Gemini (edit as needed):</p>
      <textarea class="qz-prompt-textarea" id="quizPromptTA" rows="7">${escHtml(defaultPrompt)}</textarea>
      <button class="qz-primary-btn" onclick="doGenerateQuiz()">
        ✨ Generate 20 Questions
      </button>
    </div>`;
  document.getElementById('quizOverlay').style.display = 'flex';
}

window.doGenerateQuiz = async function() {
  const prompt   = document.getElementById('quizPromptTA').value;
  const { subject, topics } = _quizState;

  _quizEl().innerHTML = `
    <div class="qz-loading">
      <div class="qz-spinner"></div>
      <p>Gemini is generating 20 questions…</p>
      <p class="muted" style="font-size:0.85rem">This takes about 5-10 seconds</p>
    </div>`;

  try {
    const res = await fetch('/api/quiz/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subject, topics, customPrompt: prompt }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    _quizState.questions = data.questions;
    _quizState.currentQ  = 0;
    _quizState.answers   = [];
    _renderQuizQuestion();
  } catch (err) {
    _quizEl().innerHTML = `
      <div class="qz-header">
        <h2>❌ Quiz Generation Failed</h2>
        <button class="qz-close" onclick="closeQuiz()">✕</button>
      </div>
      <div class="qz-body">
        <p style="color:var(--red)">${escHtml(err.message)}</p>
        <p class="muted">Make sure GEMINI_API_KEY is set in .env and the server is running.</p>
        <button class="qz-primary-btn" onclick="openQuizFlow('${escHtml(subject)}', ${JSON.stringify(topics)})">
          Try Again
        </button>
      </div>`;
  }
};

function _renderQuizQuestion() {
  const { questions, currentQ, subject } = _quizState;
  const total    = questions.length;
  const q        = questions[currentQ];
  const progress = Math.round((currentQ / total) * 100);

  _quizEl().innerHTML = `
    <div class="qz-header">
      <h2>🎯 ${escHtml(subject)} · Q${currentQ + 1} of ${total}</h2>
      <button class="qz-close" onclick="closeQuiz()">✕</button>
    </div>
    <div class="qz-progress-bar"><div class="qz-progress-fill" style="width:${progress}%"></div></div>
    <div class="qz-body">
      <p class="qz-question-text">${escHtml(q.q)}</p>
      <div class="qz-options" id="qzOptions">
        ${q.options.map((opt, i) => `
          <button class="qz-option-btn" data-letter="${opt[0]}"
            onclick="selectQuizOption(this, '${opt[0]}', '${escHtml(q.answer)}')">
            ${escHtml(opt)}
          </button>`).join('')}
      </div>
      <div id="qzFeedback" class="qz-feedback" style="display:none"></div>
      <div id="qzNext" style="display:none;margin-top:1rem;text-align:center">
        <button class="qz-primary-btn" onclick="nextQuizQuestion()">
          ${currentQ + 1 < total ? 'Next →' : '🏆 See Results'}
        </button>
      </div>
    </div>`;
}

window.selectQuizOption = function(btn, selected, correct) {
  const container = document.getElementById('qzOptions');
  const allBtns   = container.querySelectorAll('.qz-option-btn');
  const isCorrect = selected === correct;

  allBtns.forEach(b => {
    b.disabled = true;
    if (b.dataset.letter === correct)       b.classList.add('qz-opt-correct');
    else if (b === btn && !isCorrect)       b.classList.add('qz-opt-wrong');
  });

  _quizState.answers.push({ correct: isCorrect });

  const fb = document.getElementById('qzFeedback');
  fb.innerHTML = isCorrect
    ? '<span class="qz-fb-correct">✅ Correct!</span>'
    : `<span class="qz-fb-wrong">❌ Wrong. Correct answer: <strong>${escHtml(correct)}</strong></span>`;
  fb.style.display = 'block';
  document.getElementById('qzNext').style.display = 'block';
};

window.nextQuizQuestion = function() {
  _quizState.currentQ++;
  if (_quizState.currentQ >= _quizState.questions.length) _showQuizResults();
  else _renderQuizQuestion();
};

async function _showQuizResults() {
  const { subject, topics, answers, questions } = _quizState;
  const score = answers.filter(a => a.correct).length;
  const total = questions.length;
  const pct   = Math.round((score / total) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚';
  const msg   = pct >= 80 ? 'Excellent, Arjun! 🌟' : pct >= 60 ? 'Good effort! Keep it up 💪' : 'Keep practising — you\'ll get there! 📖';

  // Show results immediately
  _quizEl().innerHTML = `
    <div class="qz-header">
      <h2>${emoji} Quiz Complete!</h2>
      <button class="qz-close" onclick="closeQuiz()">✕</button>
    </div>
    <div class="qz-body qz-results">
      <div class="qz-score-display">
        <span class="qz-score-big">${score}<span class="qz-score-of">/${total}</span></span>
        <span class="qz-score-pct">${pct}%</span>
      </div>
      <p class="qz-result-msg">${msg}</p>
      <div class="qz-breakdown">
        ${answers.map((a, i) => `
          <span class="qz-breakdown-dot ${a.correct ? 'correct' : 'wrong'}" title="Q${i+1}: ${a.correct ? 'Correct' : 'Wrong'}">
            ${a.correct ? '✓' : '✗'}
          </span>`).join('')}
      </div>
      <div class="qz-results-actions">
        <button class="qz-primary-btn" onclick="openQuizFlow('${escHtml(subject)}', ${JSON.stringify(topics)})">
          🔄 Try Again
        </button>
        <button class="qz-secondary-btn" onclick="closeQuiz()">Done</button>
      </div>
    </div>`;

  // Save to DB async
  try {
    await fetch('/api/quiz/score', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subject, score, total, topics: topics.slice(0, 8) }),
    });
    // Refresh topic log quiz scores
    renderTopicLog();
  } catch (e) { console.warn('Could not save quiz score:', e.message); }
}

window.closeQuiz = function() {
  document.getElementById('quizOverlay').style.display = 'none';
  _quizState = null;
};

// ── Init ───────────────────────────────────────────────────
renderHeader();
renderTodaySubjects();
renderTodaySummary();
renderTodayEmails();
renderVeracrossChecklist();
renderHistory();
renderTopicLog();
renderVeracrossTab();
renderTimetable();
renderMyra();
renderExamSchedule();
renderHolidays();
renderFooter();

document.getElementById('historyMonthPicker').addEventListener('change', function() {
  renderHistory(this.value || undefined);
});

// Render todos immediately with empty state (no flicker if API call fails)
renderTodosPanel();
renderMyraTodosPanel();

// Then load persisted state from server and re-render with correct tick marks
loadTodoState().then(() => {
  renderTodosPanel();
  renderMyraTodosPanel();
  renderVeracrossChecklist();
  renderVeracrossTab();
}).catch(() => {
  // Server not running → ticks won't persist, but all items still show
  console.warn('Dashboard running without persistence (server not available)');
});
