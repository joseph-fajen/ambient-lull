#!/bin/bash
#
# stop-gate.sh: a Stop hook. When the agent tries to finish with changed
# files, it runs `npm test`. If the tests fail, it blocks the stop (exit 2)
# and hands the failures back as the reason, so "done means `npm test`
# passes" (CLAUDE.md) is enforced, not just asked.
#
# The audio checks are left out on purpose: they take 5 to 7 minutes, and
# `piv-validate` runs them when src/audio.js or src/samples.js changed.
#
# Only exit 2 blocks. npm exits 1 on a failure, so this script converts it.
# Anything unexpected (no git, no npm) lets the stop through.

set -uo pipefail

TEST_COMMAND="npm test"   # the one line to change
MAX_ATTEMPTS=3            # this try lets the stop through, so 3 means it blocks twice

INPUT=$(cat)
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v npm >/dev/null 2>&1 || exit 0

# A clean tree means nothing changed, so there is nothing to check.
git status --porcelain 2>/dev/null | grep -q . || exit 0

# Count blocks per session on disk. stop_hook_active is only true or false,
# so it can't count; a gate bounded by it blocks once and then waves
# everything through.
session_id=$(echo "$INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo unknown)
state_dir=".claude/hooks/.gate-state"
mkdir -p "$state_dir"
counter_file="$state_dir/$session_id.count"
attempt=$(( $(cat "$counter_file" 2>/dev/null || echo 0) + 1 ))

if output=$($TEST_COMMAND 2>&1); then
  rm -f "$counter_file"
  exit 0
fi

if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
  rm -f "$counter_file"
  {
    echo "npm test still fails after $MAX_ATTEMPTS tries. Letting the stop through so the owner can look; the tests did NOT pass. Last output:"
    echo
    echo "$output" | tail -30
  } >&2
  exit 0
fi

echo "$attempt" > "$counter_file"
{
  echo "npm test fails (try $attempt of $MAX_ATTEMPTS). Fix the failures before finishing. Output:"
  echo
  echo "$output" | tail -30
} >&2
exit 2
