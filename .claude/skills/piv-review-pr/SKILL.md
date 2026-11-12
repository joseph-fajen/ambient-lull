---
name: piv-review-pr
description: Full pull-request review for Ambient Lull — fetch the PR, run `piv-validate`, dispatch the code-reviewer agent for a fresh-eyes review against engineering.md and conventions.md, save a report and post it on the PR as a comment. The agentic gate that runs on an open PR before the owner merges. Use after piv-create-pr, or when asked to "review PR 12", "review this PR" or `/piv-review-pr`.
argument-hint: "<pr-number | pr-url | branch>"
---

# Review PR: the agentic gate before the owner

**Input**: $ARGUMENTS

The point of this skill is **fresh eyes**: the `code-reviewer` agent reviews the PR in a clean context, not the
one that wrote the code, so it catches what the author's context rationalizes away. The review is posted as a
comment; the owner makes the final call and merges.

## Phase 1: fetch the PR

Resolve the input to a PR number (a number, a URL, or a branch via
`gh pr list --head <branch> --json number -q '.[0].number'`). Then:

```bash
gh pr view {N} --json number,title,body,headRefName,baseRefName,state,isDraft,files
gh pr diff {N}
gh pr checkout {N}
```

`MERGED` or `CLOSED`: stop, nothing to review. A draft: review the direction, and say it's a draft in the verdict.

## Phase 2: load the bar

Read these before reviewing. They are the rubric; don't restate them in the report, cite them.

- `.claude/references/engineering.md`: what code is judged against. Findings cite its rules by name.
- `.claude/references/conventions.md`, `## review`: the five routing buckets and their limits. For an AI-layer
  or notes change, also `## commit` and `## pr`, to check the PR title and body.
- `CLAUDE.md` and `.claude/references/direction.md`: the ground rules and the scope.
- The PR title and body: the claims to check. Anchor on the original request, not the PR body.

## Phase 3: validate

Run the **`piv-validate`** skill on the PR branch and keep its verdict, counts and whether the audio checks ran.
A FAIL is a finding. Audio checks that were required (`src/audio.js` or `src/samples.js` changed) but didn't
run are a finding too.

## Phase 4: review (dispatch the code-reviewer agent)

Dispatch the **`code-reviewer`** agent with the PR number and branch, the original request, and the Phase 3
result (whether `npm test` and `npm run test:audio` ran, and how they came out). Its checklist, severities,
buckets and output format are in `.claude/agents/code-reviewer.md`; use them as they are. The agent reads its
severities from this table:

| Severity | Meaning |
|----------|---------|
| **Critical** | Blocks merge: too loud or a peak over the limit, old presets that fail to load, music that stops or throws |
| **High** | Fix before merge: logic errors, a missing fallback, a gain guessed rather than measured, required audio checks not run |
| **Medium** | A pattern gap, a missing edge case or test, an *undocumented* deviation |
| **Low** | Polish and suggestions |

Then check its findings against the changed files, read in full: drop any you can't confirm at the cited
`file:line`, and say so in the report. Add the validation result as a finding if the agent didn't.

## Phase 5: save and post

Write the report to `.claude/code-reviews/pr-{N}-review.md` (git ignores it):

- The agent's buckets (AGENT FIXES, HUMAN DECIDES, HUMAN READS, HUMAN TESTS, FYI), each item with `file:line`.
- A validation table: check, result, counts.
- What's good, and the verdict: Ready, Needs changes or Not ready, with counts by severity and what couldn't be
  checked (sound, by ear).

Post it as a comment. GitHub refuses approve and request-changes on the owner's own PRs, so don't use them:

```bash
gh pr comment {N} --body-file .claude/code-reviews/pr-{N}-review.md
```

## Hand off

Print the PR URL, the verdict, counts by severity and the validation result, then: **"Posted on the PR. The
owner reviews it and merges."** If there are AGENT FIXES, the next step is **`piv-fix-review-findings`** on
the report, with the owner's OK. Never merge.

## Running under an orchestrator

Do not narrate routine progress. No one is watching this run live. Put useful detail in the artifact, the report, and the final handoff.

If the launch instructions name an artifact directory, write your plan, report, or review there instead of the default path, and return its absolute path.
