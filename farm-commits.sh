#!/bin/bash
# farm-commits.sh
# Generates between 1-15 commits with randomized timestamps from the past week.
# Usage: bash farm-commits.sh

set -euo pipefail

COMMIT_COUNT=$(( (RANDOM % 15) + 1 ))
CONTRIB_FILE=".contributions"

echo "🌱 Farming ${COMMIT_COUNT} commit(s)..."

for i in $(seq 1 "$COMMIT_COUNT"); do
  # Random offset: 0-6 days ago, random hour/minute/second
  DAYS_AGO=$(( RANDOM % 7 ))
  HOURS=$(( RANDOM % 24 ))
  MINUTES=$(( RANDOM % 60 ))
  SECONDS=$(( RANDOM % 60 ))

  COMMIT_DATE=$(date -d "${DAYS_AGO} days ago ${HOURS}:${MINUTES}:${SECONDS}" \
    '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || \
    date -v-"${DAYS_AGO}"d -v"${HOURS}"H -v"${MINUTES}"M -v"${SECONDS}"S \
    '+%Y-%m-%dT%H:%M:%S')

  # Append a unique line to the contributions file
  echo "commit ${i} — $(date +%s%N)" >> "$CONTRIB_FILE"

  git add "$CONTRIB_FILE"

  GIT_AUTHOR_DATE="$COMMIT_DATE" GIT_COMMITTER_DATE="$COMMIT_DATE" \
    git commit -m "chore: update contributions [${i}/${COMMIT_COUNT}]" --quiet

  echo "  ✔ Commit ${i}/${COMMIT_COUNT}  (${COMMIT_DATE})"
done

echo ""
echo "✅ Done! ${COMMIT_COUNT} commit(s) created."
echo "   Run 'git push' when you're ready to push them upstream."
