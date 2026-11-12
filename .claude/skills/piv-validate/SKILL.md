---
name: piv-validate
description: Runs Ambient Lull's checks and reports one PASS/FAIL verdict. It always runs the unit tests (`npm test`), and runs the audio checks (`npm run test:audio`) when the branch changed `src/audio.js` or `src/samples.js`. Use before committing, before opening a PR, after finishing a chunk of work, or when asked to "validate", "run the checks", "check nothing broke" or `/piv-validate`.
---

# Validate

Run the checks this project has and report one PASS/FAIL verdict. Keep going after a failure, so the report
covers everything. Report only; fixing is a separate step.

There is no type checker, linter or build step, and none should be added (`direction.md §no-build-step`).

## 1. Unit tests (always)

```bash
npm test
```

Read the summary counts: tests, pass and fail. They show as `ℹ tests` on Node 23 and later, and as `# tests`
on Node 22 when there's no terminal. For each failure, note the test name (the `✖` line) and
its error.

## 2. Decide whether the audio checks are needed

CLAUDE.md (Testing) requires them after any change to `src/audio.js` or `src/samples.js`.

1. Find the base branch: the open PR's base if there is one, otherwise `main`.
   ```bash
   gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo main
   ```
   Note which it was, for the report: "from PR #N" or "no PR found".
2. List every changed file since the base: committed, uncommitted and untracked.
   ```bash
   BASE=$(git merge-base HEAD <base>)
   { git diff --name-only "$BASE"; git ls-files --others --exclude-standard; } | sort -u
   ```
   `git diff` against a commit includes changes not yet committed. If `<base>` isn't known locally, try
   `origin/<base>`.
3. If neither `src/audio.js` nor `src/samples.js` is in the list, skip step 3 and report:
   "skipped: no change to src/audio.js or src/samples.js since `<base>` (from PR #N, or no PR found)."

## 3. Audio checks (only when needed)

Before starting, make sure they can run:

- **Node 22 or newer** (`node --version`). If older: "required but not run: needs Node 22+, found vX."
- **A browser:** the first that exists of `$CHROME` and the paths in `BROWSERS` in `tests/browser.mjs`. A
  `CHROME` that points at a missing file falls through to the others. If none exists: "required but not run: no Chrome found; set CHROME=/path/to/browser." In a cloud session, use the
  wrapper in CLAUDE.md (Commands).

If both are there, say the checks take about 5–7 minutes, then run them with a 10-minute timeout:

```bash
npm run test:audio
```

The last line gives the count ("All N checks passed." or "N check(s) failed."). For each failure, note its
`FAIL` line.

**Required but not run counts as a FAIL.** A skipped check means not ready (`engineering.md`, Review posture).

## 4. Report

One line per check, then the verdict:

```
✅ Unit tests: 104 passed, 0 failed
⏭️ Audio checks: skipped, no change to src/audio.js or src/samples.js since main (no PR found)
Overall: PASS
```

- ✅ passed, ❌ failed or required but not run, ⏭️ skipped because not needed.
- Under each ❌: the command, the failing test or check names, and the relevant output (or why it couldn't run
  and how to fix that).
- **Overall: PASS** only if every line is ✅ or ⏭️.
