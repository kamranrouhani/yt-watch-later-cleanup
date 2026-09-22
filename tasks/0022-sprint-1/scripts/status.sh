#!/usr/bin/env bash
# Orientation for one loop cycle. Read-only: never writes, never commits.
set -uo pipefail

REPO="/root/projects/yt-watch-later-playlist-cleanup"
SPRINT="$REPO/tasks/0022-sprint-1"
SPRINT_LOG="$SPRINT/implementation/2026-09-22-sprint-1-progress.md"
MILESTONE="Sprint 1: scan, rules, preview, remove"

cd "$REPO" || { echo "FATAL: $REPO not found"; exit 1; }

line() { printf '%s\n' "------------------------------------------------------------"; }

last_entry() {
  awk '
    /append entries below this line/ { n=0; delete l; next }
    /^## / { n=NR }
    { l[NR]=$0 }
    END { if (n) { for (i=n; i<=NR; i++) print l[i] } else print "(no entries yet)" }
  ' "$1"
}

line; echo "WHERE"; line
echo "repo:   $REPO"
echo "date:   $(date '+%Y-%m-%d %H:%M')"
echo "branch: $(git rev-parse --abbrev-ref HEAD)"
echo "head:   $(git rev-parse --short HEAD)"
echo "remote: $(git rev-list --left-right --count origin/main...main 2>/dev/null | awk '{print "main is " $2 " ahead, " $1 " behind origin/main (last fetch)"}')"

line; echo "STATE"; line
if [ -f "$SPRINT/implementation/STATE.md" ]; then
  cat "$SPRINT/implementation/STATE.md"
else
  echo "STATE.md missing. Create it from the shape at the end of LOOP.md"
fi

line; echo "WORKTREE"; line
if [ -z "$(git status --porcelain)" ]; then echo "clean"; else git status --short; fi

line; echo "LAST 5 COMMITS"; line
git log --oneline -5

line; echo "LAST SPRINT LOG ENTRY"; line
last_entry "$SPRINT_LOG"

CURRENT=$(grep -oE 'CURRENT ISSUE: #[0-9]+' "$SPRINT/implementation/STATE.md" 2>/dev/null | grep -oE '[0-9]+$')
if [ -n "${CURRENT:-}" ]; then
  TASK_DIR=$(ls -d "$REPO"/tasks/"$(printf '%04d' "$CURRENT")"-* 2>/dev/null | head -1)
  line; echo "CURRENT ISSUE TASK FOLDER"; line
  if [ -n "$TASK_DIR" ]; then
    echo "${TASK_DIR#$REPO/}"
    for LOG in "$TASK_DIR"/implementation/*-progress.md; do
      [ -f "$LOG" ] || continue
      echo; echo "last entry in ${LOG#$REPO/}:"
      last_entry "$LOG"
    done
  else
    echo "none yet for #$CURRENT"
  fi
fi

line; echo "BLOCKED"; line
awk '/append entries below this line/ { s=1; next } s' "$SPRINT/implementation/BLOCKED.md" 2>/dev/null \
  | grep -q '[^[:space:]]' \
  && awk '/append entries below this line/ { s=1; next } s' "$SPRINT/implementation/BLOCKED.md" \
  || echo "nothing"

line; echo "OPEN SPRINT ISSUES WITHOUT blocked"; line
gh issue list --milestone "$MILESTONE" --state open --search "-label:blocked" \
  --json number,title --jq '.[] | "#\(.number) \(.title)"' 2>/dev/null | sort -t'#' -k2 -n \
  || echo "(gh unavailable)"

line; echo "OPEN PULL REQUESTS"; line
gh pr list --json number,title,headRefName --jq '.[] | "#\(.number) \(.headRefName) \(.title)"' 2>/dev/null \
  | grep . || echo "none"

line; echo "CHECKS"; line
if [ -f package.json ]; then
  npm run --silent check 2>&1 | tail -3
  npm test 2>&1 | grep -E '^# (tests|pass|fail)|^not ok|Cannot find' | head -20
else
  echo "no package.json yet, expected until #1 lands"
fi

line; echo "DRIFT: manifest content script files vs files on disk"; line
if [ -f manifest.json ]; then
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
    const listed = (m.content_scripts || []).flatMap((c) => c.js || []);
    if (!listed.length) { console.log("no content scripts yet, expected until #11"); process.exit(0); }
    for (const f of listed) console.log((fs.existsSync(f) ? "  ok      " : "  MISSING ") + f);
  '
else
  echo "no manifest.json yet"
fi
line
