#!/bin/bash
# ============================================================
# update-dashboard.sh — Nightly 7:30 PM trigger (Mon-Sat)
# 1. Fetch + process emails via fetch_emails.py
# 2. Git commit + push updated dashboard-data.js
# ============================================================

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

PROJECT_DIR="/Users/e153Manager/Documents/GitHub/school-dashboard"
LOG_FILE="$PROJECT_DIR/logs/update-$(date +%Y-%m-%d).log"
mkdir -p "$PROJECT_DIR/logs"

echo "[$(date)] ===== 7:30 PM Dashboard Update =====" >> "$LOG_FILE"

cd "$PROJECT_DIR"

# Step 1: Fetch and process today's emails
echo "[$(date)] Running fetch_emails.py..." >> "$LOG_FILE"
python3 backend/fetch_emails.py >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "[$(date)] ERROR: fetch_emails.py exited with code $EXIT_CODE" >> "$LOG_FILE"
  exit $EXIT_CODE
fi

# Step 2: Commit and push updated data
echo "[$(date)] Committing data..." >> "$LOG_FILE"
git add data/dashboard-data.js
git diff --staged --quiet || git commit -m "Dashboard update $(date '+%Y-%m-%d %H:%M')" >> "$LOG_FILE" 2>&1
git push origin main >> "$LOG_FILE" 2>&1

echo "[$(date)] ===== Done =====" >> "$LOG_FILE"

# Keep only last 30 days of logs
find "$PROJECT_DIR/logs" -name "update-*.log" -mtime +30 -delete
