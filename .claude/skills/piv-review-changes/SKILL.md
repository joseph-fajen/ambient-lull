---
name: piv-review-changes
description: Reviews Ambient Lull's uncommitted changes before a commit — runs `piv-validate`, dispatches the code-reviewer agent on the working-tree diff against engineering.md and conventions.md, and saves a routed report. Use before committing, as a pre-commit quality gate, or when asked to "review my changes", "review before I commit" or `/piv-review-changes`. For an open pull request, use piv-review-pr instead.
# A reviewer reads, diffs, validates, dispatches the reviewer agent and saves its report — nothing more.
allowed-tools: Read, Grep, Glob, Write, Agent, Skill, Bash(git *), Bash(npm *)
---

# Review changes: the pre-commit gate

Review the uncommitted changes in the working tree the same way `piv-review-pr` reviews a PR, before they are
committed.

## 1. Load the bar

Read `.claude/references/engineering.md`, `.claude/references/conventions.md` (`## review`), `CLAUDE.md` and
`.claude/references/direction.md`. They are the rubric: cite them, don't restate them.

## 2. Gather the change

```bash
git status
git diff HEAD --stat
git diff HEAD
git ls-files --others --exclude-standard
```

Nothing changed: stop and say so. Read each changed and new file in full, not only the diff.

## 3. Validate

Run the **`piv-validate`** skill and keep its verdict, counts and whether the audio checks ran. A FAIL, or
audio checks that were required but didn't run, is a finding.

## 4. Review (dispatch the code-reviewer agent)

Dispatch the **`code-reviewer`** agent with the list of changed and new files, the diff, what the change is for,
and the step 3 result. Its checklist, buckets and output format are in `.claude/agents/code-reviewer.md`, and
severities are the table in `.claude/skills/piv-review-pr/SKILL.md`. Use them as they are.

Check each finding at its `file:line` and drop any you can't confirm, saying so.

## 5. Save the report

Write it to `.claude/code-reviews/changes-{branch}-{YYYY-MM-DD}.md` (git ignores it): the stats (files added,
changed and deleted, lines added and removed), the agent's buckets, the validation result and the verdict.
Clean: "Review passed. No findings."

Print the verdict and the report path. Don't fix anything without the owner's OK; the next step is
**`piv-fix-review-findings`** on the report, or **`piv-commit`** if it passed.
