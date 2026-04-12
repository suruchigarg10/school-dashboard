#!/usr/bin/env python3
"""
eval_models.py — Compare Gemini vs Claude on same email set
=============================================================
Uses Claude's stored output in dashboard-data.js as ground truth.
Re-fetches the same emails from Gmail and runs them through Gemini.
Scores Gemini on objective metrics and shows side-by-side diffs.

Usage:
  python3 backend/eval_models.py           # last 7 days
  python3 backend/eval_models.py --days 14 # last N days
"""

import os, re, json, imaplib, email, argparse, warnings, logging
from datetime import date, timedelta
from email.header import decode_header
from pathlib import Path
from dataclasses import dataclass, field

import io, pdfplumber
from dotenv import load_dotenv
from google import genai

# suppress noisy warnings
warnings.filterwarnings("ignore")
logging.getLogger("pdfminer").setLevel(logging.ERROR)
logging.getLogger("google").setLevel(logging.ERROR)

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

GMAIL_USER         = "E153.manager@gmail.com"
GMAIL_APP_PASSWORD = os.environ["GMAIL_APP_PASSWORD"].replace(" ", "")
GEMINI_KEY         = os.environ["GEMINI_API_KEY"].strip()
BASE_DIR           = Path(__file__).parent.parent
DATA_FILE          = BASE_DIR / "data" / "dashboard-data.js"

CORE_SUBJECTS = [
    "Math", "English", "Hindi", "Social Science",
    "Physics", "Chemistry", "Biology", "IT", "Spanish"
]

# ── Scoring weights ──────────────────────────────────────────
SCHEMA_REQUIRED_ARJUN = {"kid","summary","tags","schoolSubject","todoItems",
                          "homeworkItems","veracrossItems","topicsCovered",
                          "examSchedule","holidays"}
SCHEMA_REQUIRED_MYRA  = {"kid","summary","tags","todoItems","category"}

# ── Data classes ─────────────────────────────────────────────
@dataclass
class EmailResult:
    subject:       str
    date_str:      str
    claude_kid:    str          # ground truth from stored data
    gemini_kid:    str = ""
    gemini_raw:    dict = field(default_factory=dict)
    claude_stored: dict = field(default_factory=dict)  # the stored email dict
    json_valid:    bool = False
    schema_ok:     bool = False
    kid_match:     bool = False
    subject_match: bool = False   # schoolSubject same?
    topic_count_claude: int = 0
    topic_count_gemini: int = 0
    todo_count_claude:  int = 0
    todo_count_gemini:  int = 0
    errors:        list = field(default_factory=list)


# ── Helpers ──────────────────────────────────────────────────
def _load_data() -> dict:
    text = DATA_FILE.read_text(encoding="utf-8")
    m = re.search(r'window\.DASHBOARD_DATA\s*=\s*(\{.*\})\s*;', text, re.DOTALL)
    if not m:
        raise ValueError("Could not parse dashboard-data.js")
    return json.loads(m.group(1))


def _decode_str(s) -> str:
    if not s: return ""
    parts = decode_header(s)
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result).strip()


def _clean_text(text: str) -> str:
    text = re.sub(r'<https?://\S+>', '', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _extract_pdf_text(data: bytes) -> str:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with pdfplumber.open(io.BytesIO(data)) as pdf:
                pages = [p.extract_text() or "" for p in pdf.pages[:6]]
                return _clean_text("\n\n".join(pages))[:3000]
    except Exception:
        return ""


def _get_body(msg) -> tuple:
    body = ""
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            disposition = str(part.get("Content-Disposition", ""))
            content_type = part.get_content_type()
            filename = part.get_filename()
            if filename:
                raw_data = part.get_payload(decode=True) or b""
                att = {
                    "name": _decode_str(filename),
                    "type": "pdf" if filename.lower().endswith(".pdf") else "other",
                    "text": ""
                }
                if att["type"] == "pdf":
                    att["text"] = _extract_pdf_text(raw_data)
                attachments.append(att)
            elif content_type == "text/plain" and "attachment" not in disposition and not body:
                charset = part.get_content_charset() or "utf-8"
                body = part.get_payload(decode=True).decode(charset, errors="replace")
    else:
        charset = msg.get_content_charset() or "utf-8"
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode(charset, errors="replace")
    return _clean_text(body)[:4000], attachments


def _parse_json(text: str) -> dict:
    # strip markdown fences
    text = re.sub(r'^```(?:json)?\n?', '', text.strip())
    text = re.sub(r'\n?```$', '', text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}


def _run_gemini(raw: dict, target_date: date) -> dict:
    day_name = target_date.strftime("%A")
    date_str = target_date.isoformat()
    att_names = [a["name"] for a in raw.get("attachments", [])]
    att_context = ""
    if att_names:
        att_context = f"\nAttachments: {', '.join(att_names)}"
        pdf_texts = [a["text"] for a in raw.get("attachments", []) if a.get("text")]
        if pdf_texts:
            att_context += "\n\nAttachment content:\n" + "\n---\n".join(pdf_texts)

    prompt = f"""You are processing emails forwarded to a dedicated school-dashboard inbox.
Two children:
  • Arjun Kumar — Grade 7, Shiv Nadar School, Gurugram. Core subjects: {', '.join(CORE_SUBJECTS)}
  • Myra Garg — Kindergarten (K2), Kunskapsskolan, Gurugram

Email:
From: {raw['from']}
Subject: {raw['subject']}
Body:
{raw['body']}{att_context}

Step 1 — Which child? Mentions Shiv Nadar/Grade 7/Arjun/core subjects → "arjun". Mentions Kunskapsskolan/K2/Myra/kindergarten → "myra". Cannot clearly tell → "skip". Do NOT guess.

Step 2 — Reply with ONLY valid JSON, no markdown fences.

If kid="arjun":
{{"kid":"arjun","summary":"2-3 sentences","tags":[],"schoolSubject":null,"todoItems":[],"homeworkItems":[],"veracrossItems":[],"topicsCovered":[],"examSchedule":[],"holidays":[]}}
  tags: any of ["announcement","hw","test","chapter","veracross"]
  schoolSubject: one of {CORE_SUBJECTS} or null
  todoItems: [{{"id":"","text":"...","owner":"Arjun|Parent","dueDate":"YYYY-MM-DD","source":"..."}}]
  topicsCovered: [{{"subject":"Math","topic":"specific chapter/concept"}}] up to 4 DISTINCT topics. [] for admin/fee/event emails.
  examSchedule: Grade 7 exam dates only. [{{"examType":"UT1|UT2|MidTerm|FinalTerm|ClassTest|Other","subject":"...","examDate":"YYYY-MM-DD","topics":"..."}}]
  holidays: [{{"date":"YYYY-MM-DD","name":"...","type":"holiday"}}]

If kid="myra":
{{"kid":"myra","summary":"2-3 sentences","tags":[],"todoItems":[],"category":"general"}}
  category: one of ["general","homework","event","transport","fee","announcement"]

If kid="skip": {{"kid":"skip"}}"""

    client = genai.Client(api_key=GEMINI_KEY)
    resp = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    return _parse_json(resp.text)


# ── Build Claude ground truth index ─────────────────────────
def _build_claude_index(data: dict, days_back: int) -> dict:
    """
    Returns dict keyed by normalised subject → {date, stored_email_dict, kid}
    Covers arjun days + myra days.
    """
    today = date.today()
    cutoff = (today - timedelta(days=days_back)).isoformat()
    index = {}

    # Arjun days
    for day in data.get("days", []):
        if day["date"] < cutoff:
            continue
        for em in day.get("emails", []):
            key = _norm(em.get("subject", ""))
            index[key] = {
                "date":    day["date"],
                "kid":     "arjun",
                "stored":  em,
                "topics":  [t for t in data.get("topicLog", []) if t.get("date") == day["date"]],
            }

    # Myra days
    for day in data.get("myra", {}).get("days", []):
        if day["date"] < cutoff:
            continue
        for em in day.get("emails", []):
            key = _norm(em.get("subject", ""))
            index[key] = {
                "date":  day["date"],
                "kid":   "myra",
                "stored": em,
                "topics": [],
            }

    return index


def _norm(s: str) -> str:
    """Normalise subject for matching: lowercase, strip Fwd/Re, collapse spaces."""
    s = re.sub(r'^(fwd?|re):\s*', '', s.lower().strip())
    s = re.sub(r'\s+', ' ', s)
    return s


# ── Scoring ──────────────────────────────────────────────────
def _score(result: EmailResult, gemini: dict, claude_entry: dict) -> EmailResult:
    result.json_valid = bool(gemini)
    if not gemini:
        result.errors.append("Gemini returned invalid JSON")
        return result

    result.gemini_kid = gemini.get("kid", "")
    result.kid_match = result.gemini_kid == result.claude_kid

    # Schema check
    if result.gemini_kid == "arjun":
        missing = SCHEMA_REQUIRED_ARJUN - set(gemini.keys())
    elif result.gemini_kid == "myra":
        missing = SCHEMA_REQUIRED_MYRA - set(gemini.keys())
    else:
        missing = set()
    result.schema_ok = len(missing) == 0
    if missing:
        result.errors.append(f"Missing fields: {missing}")

    # schoolSubject match (arjun only)
    if result.claude_kid == "arjun":
        claude_subj  = claude_entry["stored"].get("schoolSubject")
        gemini_subj  = gemini.get("schoolSubject")
        result.subject_match = (claude_subj == gemini_subj)

        # Topic counts — Claude topics for this date from topicLog
        result.topic_count_claude = len(claude_entry.get("topics", []))
        result.topic_count_gemini = len(gemini.get("topicsCovered", []))

        # Todo counts
        result.todo_count_claude = len(claude_entry["stored"].get("todoItems", []))
        result.todo_count_gemini = len(gemini.get("todoItems", []))

    return result


# ── Pretty printer ───────────────────────────────────────────
def _bar(val: float, width: int = 20) -> str:
    filled = int(round(val * width))
    return "█" * filled + "░" * (width - filled)


def _print_report(results: list[EmailResult]):
    total      = len(results)
    skipped    = sum(1 for r in results if r.claude_kid == "skip")
    school     = [r for r in results if r.claude_kid != "skip"]
    n          = len(school)

    if n == 0:
        print("\n⚠️  No school emails found in this date range to evaluate.")
        return

    json_ok    = sum(1 for r in school if r.json_valid)
    schema_ok  = sum(1 for r in school if r.schema_ok)
    kid_ok     = sum(1 for r in school if r.kid_match)
    subj_ok    = sum(1 for r in school if r.claude_kid == "arjun" and r.subject_match)
    arjun_n    = sum(1 for r in school if r.claude_kid == "arjun")

    topic_diffs = [abs(r.topic_count_gemini - r.topic_count_claude)
                   for r in school if r.claude_kid == "arjun"]
    todo_diffs  = [abs(r.todo_count_gemini  - r.todo_count_claude)
                   for r in school if r.claude_kid == "arjun"]
    avg_topic_diff = sum(topic_diffs) / len(topic_diffs) if topic_diffs else 0
    avg_todo_diff  = sum(todo_diffs)  / len(todo_diffs)  if todo_diffs  else 0

    print("\n" + "=" * 60)
    print("  📊  GEMINI vs CLAUDE — Model Eval Report")
    print("=" * 60)
    print(f"  Emails evaluated : {total} total  ({n} school, {skipped} non-school skipped)")
    print()

    def pct(num, den):
        return (num / den * 100) if den else 0

    rows = [
        ("JSON validity",        json_ok,  n,       "Did Gemini return valid JSON?"),
        ("Schema compliance",    schema_ok, n,      "All required fields present?"),
        ("Kid classification",   kid_ok,   n,       "arjun / myra / skip — correct?"),
        ("Subject tagging",      subj_ok,  arjun_n, "schoolSubject same as Claude?"),
    ]

    for label, num, den, desc in rows:
        p = pct(num, den)
        bar = _bar(p / 100)
        print(f"  {label:<22} {bar}  {num}/{den}  ({p:.0f}%)  — {desc}")

    print()
    print(f"  Topic count delta    avg ±{avg_topic_diff:.1f} per email  (0 = identical to Claude)")
    print(f"  Todo count delta     avg ±{avg_todo_diff:.1f} per email  (0 = identical to Claude)")

    # ── Per-email detail ──────────────────────────────────────
    print()
    print("─" * 60)
    print("  Per-email breakdown")
    print("─" * 60)

    for r in school:
        kid_icon    = "✅" if r.kid_match    else "❌"
        json_icon   = "✅" if r.json_valid   else "❌"
        schema_icon = "✅" if r.schema_ok    else "⚠️ "
        subj_label  = ""
        if r.claude_kid == "arjun":
            stored_subj  = r.claude_stored.get("stored", {}).get("schoolSubject", "–")
            gemini_subj  = r.gemini_raw.get("schoolSubject", "–")
            subj_icon    = "✅" if r.subject_match else f"❌(claude={stored_subj}, gemini={gemini_subj})"
            topics_g     = r.topic_count_gemini
            topics_c     = r.topic_count_claude
            todos_g      = r.todo_count_gemini
            todos_c      = r.todo_count_claude
            subj_label   = (f"  subject {subj_icon}  "
                            f"topics {topics_g}vs{topics_c}  "
                            f"todos {todos_g}vs{todos_c}")

        print(f"\n  [{r.date_str}] {r.subject[:55]}")
        print(f"    JSON {json_icon}  schema {schema_icon}  kid {kid_icon}"
              f"(claude={r.claude_kid}, gemini={r.gemini_kid}){subj_label}")

        # Show Gemini summary vs Claude summary side-by-side for arjun emails
        if r.claude_kid == "arjun" and r.json_valid:
            claude_summ = r.claude_stored.get("stored", {}).get("summary", "–")
            gemini_summ = r.gemini_raw.get("summary", "–")
            print(f"    Claude summary : {claude_summ[:100]}")
            print(f"    Gemini summary : {gemini_summ[:100]}")

            # Show topic diffs if any
            gemini_topics = [t.get("topic","") for t in r.gemini_raw.get("topicsCovered", [])]
            if gemini_topics:
                print(f"    Gemini topics  : {'; '.join(gemini_topics)[:100]}")

        if r.errors:
            print(f"    ⚠️  {'; '.join(r.errors)}")

    # ── Overall verdict ───────────────────────────────────────
    overall = pct(kid_ok + schema_ok + json_ok, n * 3)
    print()
    print("─" * 60)
    verdict = ("🟢 Gemini matches Claude well — safe to use"       if overall >= 80 else
               "🟡 Mostly good, minor gaps — review topics/todos"  if overall >= 60 else
               "🔴 Significant gaps — consider prompt tuning")
    print(f"  Overall score: {overall:.0f}%  {verdict}")
    print("=" * 60)


# ── Main ─────────────────────────────────────────────────────
def _write_html_report(results: list[EmailResult], days: int):
    """Write a full side-by-side HTML comparison report."""
    import html as html_lib
    out_path = BASE_DIR / "eval_report.html"

    def h(s): return html_lib.escape(str(s))
    def fmt_list(items, key=None):
        if not items: return "<em>—</em>"
        if key:
            rows = "".join(f"<li>{h(i.get(key,''))}</li>" for i in items)
        else:
            rows = "".join(f"<li>{h(i)}</li>" for i in items)
        return f"<ul>{rows}</ul>"
    def fmt_topics(items):
        if not items: return "<em>—</em>"
        rows = "".join(f"<li><b>{h(i.get('subject',''))}</b>: {h(i.get('topic',''))}</li>"
                       for i in items)
        return f"<ul>{rows}</ul>"
    def fmt_todos(items):
        if not items: return "<em>—</em>"
        rows = "".join(
            f"<li>[{h(i.get('owner','?'))}] {h(i.get('text',''))} "
            f"<span style='color:#888'>due {h(i.get('dueDate','?'))}</span></li>"
            for i in items)
        return f"<ul>{rows}</ul>"
    def badge(ok, label=""):
        color = "#22c55e" if ok else "#ef4444"
        return f"<span style='background:{color};color:#fff;padding:2px 8px;border-radius:9px;font-size:12px'>{h(label) or ('✓' if ok else '✗')}</span>"

    school = [r for r in results if r.claude_kid != "skip"]
    skipped = [r for r in results if r.claude_kid == "skip"]
    n = len(school)
    json_ok   = sum(1 for r in school if r.json_valid)
    schema_ok = sum(1 for r in school if r.schema_ok)
    kid_ok    = sum(1 for r in school if r.kid_match)
    subj_ok   = sum(1 for r in school if r.claude_kid=="arjun" and r.subject_match)
    arjun_n   = sum(1 for r in school if r.claude_kid=="arjun")

    def pct(a,b): return f"{a/b*100:.0f}%" if b else "–"

    cards = []
    for r in school:
        ce = r.claude_stored
        stored = ce.get("stored", {}) if ce else {}
        ge = r.gemini_raw

        # field-by-field rows
        def row(label, cval, gval, match=None):
            if match is None:
                match = (str(cval).strip().lower() == str(gval).strip().lower())
            bg = "" if match else "background:#fff3cd"
            return (f"<tr style='{bg}'>"
                    f"<td style='font-weight:600;padding:4px 8px;width:130px'>{h(label)}</td>"
                    f"<td style='padding:4px 8px;width:40%'>{cval}</td>"
                    f"<td style='padding:4px 8px;width:40%'>{gval}</td>"
                    f"<td style='padding:4px 8px'>{badge(match)}</td>"
                    f"</tr>")

        claude_topics = [{"subject":t.get("subject",""),"topic":t.get("topic","")}
                         for t in ce.get("topics",[]) if ce] if ce else []
        gemini_topics = ge.get("topicsCovered", [])
        topics_match  = len(claude_topics) == len(gemini_topics)

        claude_todos  = stored.get("todoItems", [])
        gemini_todos  = ge.get("todoItems", [])
        todos_match   = len(claude_todos) == len(gemini_todos)

        rows_html = "".join([
            row("kid",          r.claude_kid,                       r.gemini_kid,              r.kid_match),
            row("schoolSubject",stored.get("schoolSubject","–"),    ge.get("schoolSubject","–"),r.subject_match),
            row("tags",         ", ".join(stored.get("tags",[])),   ", ".join(ge.get("tags",[])) ),
            row("summary",      h(stored.get("summary","–")),       h(ge.get("summary","–")),   True),
            row("topics",       fmt_topics(claude_topics),          fmt_topics(gemini_topics),  topics_match),
            row("todos",        fmt_todos(claude_todos),            fmt_todos(gemini_todos),    todos_match),
            row("JSON valid",   "✓",                                "✓" if r.json_valid else "✗", r.json_valid),
            row("schema ok",    "✓",                                "✓" if r.schema_ok  else "✗", r.schema_ok),
        ])

        overall_ok = r.kid_match and r.json_valid and r.schema_ok
        header_bg  = "#f0fdf4" if overall_ok else "#fff7ed"
        cards.append(f"""
<div style="border:1px solid #e2e8f0;border-radius:10px;margin:16px 0;overflow:hidden">
  <div style="background:{header_bg};padding:10px 16px;border-bottom:1px solid #e2e8f0;display:flex;gap:12px;align-items:center">
    <span style="font-weight:700">{h(r.subject)}</span>
    <span style="color:#64748b;font-size:13px">{h(r.date_str)}</span>
    {badge(r.kid_match, r.gemini_kid)}
    {badge(r.json_valid, 'JSON')}
    {badge(r.schema_ok, 'schema')}
    {"".join(f'<span style="color:#dc2626;font-size:12px">{h(e)}</span>' for e in r.errors)}
  </div>
  <div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:#f8fafc;font-size:12px;color:#64748b">
      <th style="padding:4px 8px;text-align:left">Field</th>
      <th style="padding:4px 8px;text-align:left">Claude (stored)</th>
      <th style="padding:4px 8px;text-align:left">Gemini</th>
      <th style="padding:4px 8px;text-align:left">Match</th>
    </tr></thead>
    <tbody>{rows_html}</tbody>
  </table>
  </div>
</div>""")

    skipped_rows = "".join(
        f"<tr><td style='padding:3px 8px;color:#64748b'>{h(r.subject)}</td>"
        f"<td style='padding:3px 8px'>{badge(r.kid_match, r.gemini_kid or 'skip')}</td></tr>"
        for r in skipped)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Gemini vs Claude — Eval Report</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         max-width: 1100px; margin: 0 auto; padding: 24px; color: #1e293b; }}
  h1   {{ font-size: 22px; margin-bottom: 4px; }}
  .stat-grid {{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:20px 0; }}
  .stat {{ background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;
           padding:14px; text-align:center; }}
  .stat .num {{ font-size:28px; font-weight:700; }}
  .stat .lbl {{ font-size:12px; color:#64748b; margin-top:2px; }}
  ul {{ margin:4px 0; padding-left:18px; }}
  li {{ margin:2px 0; }}
</style>
</head>
<body>
<h1>🔬 Gemini 2.5 Flash vs Claude — Eval Report</h1>
<p style="color:#64748b">Last {days} days &nbsp;·&nbsp; {n} school emails evaluated &nbsp;·&nbsp;
{len(skipped)} non-school correctly skipped</p>

<div class="stat-grid">
  <div class="stat"><div class="num">{pct(json_ok,n)}</div><div class="lbl">JSON valid</div></div>
  <div class="stat"><div class="num">{pct(schema_ok,n)}</div><div class="lbl">Schema correct</div></div>
  <div class="stat"><div class="num">{pct(kid_ok,n)}</div><div class="lbl">Kid classification</div></div>
  <div class="stat"><div class="num">{pct(subj_ok,arjun_n)}</div><div class="lbl">Subject tagging</div></div>
</div>

<h2 style="font-size:17px;margin-top:28px">School emails — full comparison</h2>
{''.join(cards)}

<h2 style="font-size:17px;margin-top:28px">Non-school emails (skipped by Claude)</h2>
<table style="font-size:13px;border-collapse:collapse">
  <thead><tr><th style="padding:3px 8px;text-align:left">Subject</th>
  <th style="padding:3px 8px;text-align:left">Gemini said</th></tr></thead>
  <tbody>{skipped_rows}</tbody>
</table>

</body></html>"""

    out_path.write_text(html, encoding="utf-8")
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Eval Gemini vs Claude on stored email data")
    parser.add_argument("--days",   type=int,  default=7,    help="How many days back to evaluate")
    parser.add_argument("--report", action="store_true",     help="Write full HTML report and open in browser")
    args = parser.parse_args()

    print(f"\n🔬  Model Eval: Gemini 2.5 Flash vs Claude (stored ground truth)")
    print(f"    Evaluating last {args.days} days of emails\n")

    # Load Claude ground truth
    data = _load_data()
    claude_index = _build_claude_index(data, args.days)
    print(f"    Claude stored emails found: {len(claude_index)}\n")

    # Connect to Gmail
    mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)
    mail.select("INBOX")

    today  = date.today()
    cutoff = today - timedelta(days=args.days)
    imap_since = cutoff.strftime("%d-%b-%Y")

    _, msg_ids = mail.search(None, f"(SINCE {imap_since})")
    ids = msg_ids[0].split()
    print(f"    Gmail emails in range: {len(ids)}\n")

    results = []
    for uid in ids:
        _, msg_data = mail.fetch(uid, "(RFC822)")
        raw_msg = email.message_from_bytes(msg_data[0][1])
        subject = _decode_str(raw_msg.get("Subject", ""))
        from_   = _decode_str(raw_msg.get("From", ""))
        body, attachments = _get_body(raw_msg)

        norm_subj = _norm(subject)
        claude_entry = claude_index.get(norm_subj)

        # Determine what Claude said about this email
        if claude_entry:
            claude_kid = claude_entry["kid"]
        else:
            claude_kid = "skip"   # Claude skipped it (not in stored data)

        print(f"  📧 {subject[:60]}")
        print(f"     Claude: {claude_kid}", end="  →  Gemini: ", flush=True)

        raw = {"subject": subject, "from": from_, "body": body, "attachments": attachments}

        # Parse date from stored entry or fallback to today
        if claude_entry:
            target_date = date.fromisoformat(claude_entry["date"])
        else:
            target_date = today

        try:
            gemini_out = _run_gemini(raw, target_date)
            gemini_kid = gemini_out.get("kid", "?")
            print(gemini_kid)
        except Exception as e:
            print(f"ERROR: {e}")
            gemini_out = {}
            gemini_kid = "error"

        r = EmailResult(
            subject       = subject,
            date_str      = target_date.isoformat(),
            claude_kid    = claude_kid,
            gemini_kid    = gemini_kid,
            gemini_raw    = gemini_out,
            claude_stored = claude_entry or {},
        )
        r = _score(r, gemini_out, claude_entry or {})
        results.append(r)

    mail.logout()
    _print_report(results)

    if args.report:
        out = _write_html_report(results, args.days)
        print(f"\n📄  HTML report written → {out}")
        import subprocess
        subprocess.run(["open", str(out)])  # opens in default browser on macOS


if __name__ == "__main__":
    main()
