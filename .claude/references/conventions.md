# Conventions: how Ambient Lull ships work

This is the one place the ship-step conventions live. `piv-commit`, `piv-create-pr` and `piv-review-pr` read it at run time, so the agent writes and reviews this project's way, not a generic default. The decisions behind it are in `notes/brainstorm.md`, section 8.

Each section has **mechanical** rules (a pattern could check them) and **judgment** rules (a reviewer has to weigh them). There are no automatic checks in this repo yet. If some are added, derive them from the mechanical rules here and update both together.

## branch

- Every change goes on its own branch and reaches `main` through a pull request, notes included. Nothing is pushed straight to `main`.
- Branch names are short, lowercase and hyphenated, and say what the work is: `remove-width-control`, `fix-melody-range-check`.
- The owner merges. The agent opens and reviews pull requests, but never merges them.

## commit

**Mechanical (regex-checkable):**
- The subject uses a tag, `feat|fix|docs|refactor|test|chore(area)?:`, then an imperative summary, 72 characters at most. Areas follow the project's parts: `sound`, `composer`, `scheduler`, `settings`, `presets`, `ui`, `samples`, `tests`, `brainstorm`, `ai-layer`. For example `docs(brainstorm): record the v2 workflow decisions`.
- No AI credit anywhere in the message: no "Generated with", no "Co-Authored-By: Claude".

**Judgment (rubric for the judge):** <!-- #commit-quality -->
- The message describes THIS diff: what changed and why, not a generic summary. A reader who sees only the message should roughly predict which files changed.
- The subject says what the change does, and the body (when present) says why it was needed.
- The body has a `What changed:` part, and an `AI layer changes:` part whenever `.claude/`, `CLAUDE.md` or `AGENTS.md` changed. A fix to the AI layer learned during this work rides in the same commit, and its line says what went wrong that it now prevents.
- Plain English, as in the rest of the project's notes and comments.

## pr

**Mechanical (regex-checkable):**
- The body has the sections `## Summary`, `## What changed` and `## Validation`.
- No AI credit in the body.

**Judgment (rubric for the judge):** <!-- #pr-quality -->
- The Summary explains WHY the change exists (the intent), not just what it touches.
- Validation states what was actually run, not what should be. `npm test` always; `npm run test:audio` after any change to `src/audio.js`; and for any change to the sound, the listening clips sent and whether the owner has heard them yet.

## review

**Mechanical (regex-checkable):**
- The report routes every item into one of: AGENT FIXES / HUMAN DECIDES / HUMAN READS / HUMAN TESTS / FYI.
- Every item carries a `file:line` reference. The human buckets hold 3–5 items at most.

**Judgment (rubric for the judge):** <!-- #review-routing -->
- HUMAN READS points at the code that carries this project's promises for THIS diff, not a random sample of touched files:
  - "It can't sound bad": gains, peaks, the master level and the reverb in `src/audio.js` and `src/samples.js`.
  - The composer stays pure: no audio in `src/music.js` or `src/scheduler.js`.
  - Old presets keep loading: `normalizeSettings` and `REPLACED_SOUNDS` in `src/settings.js`, and `src/presets.js`.
- HUMAN TESTS holds anything that has to be heard: a change to the sound goes there with its listening clips, because only the owner can judge it by ear.
- Nothing that changes a level, a peak or how old presets load sits in AGENT FIXES. Those need a measurement or the owner's decision.
