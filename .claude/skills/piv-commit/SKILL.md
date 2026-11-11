---
name: piv-commit
description: Creates a new git commit for all uncommitted changes with an atomic, conventionally-tagged message whose body records both the work and any AI-layer changes it produced. Use when work is complete and ready to be committed.
---

# Commit: Create a New Commit

Create a new commit for all of our uncommitted changes. The commit message is the repository's history, so it
records two things: the work, and what the work changed in the AI layer.

## Process

0. **Read this project's conventions.** If `.claude/references/conventions.md` exists, read its `## commit`
   section and follow it — those rules win over the defaults below. That file is where a project's specifics
   live; this skill stays general.
1. Run `git status && git diff HEAD && git status --porcelain` to see what files are uncommitted.
2. Add the untracked and changed files.
3. Write the message in the format below and commit.

## Message format

```
<tag>: <atomic description>

What changed:
<One short paragraph (2–5 sentences): the feature, fix or refactor, the problem it solves, and the key files.>

AI layer changes:
- <path>: <what changed in it, and what in this work made it necessary>
```

- `<tag>` is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc., matching the work. The subject
  says what the change does.
- **AI layer changes** lists every changed file under `.claude/`, plus `CLAUDE.md` and `AGENTS.md`, one line
  each. Omit the whole part, heading included, when none of them changed.
- **A layer fix learned while doing this work belongs in this commit**, under AI layer changes, not in a
  separate commit. The line says what went wrong during the work that the change now prevents, so the history
  shows why the layer changed.
- An AI-layer change made on its own, with no other work (a retrospective finding, a drift fix), is still one
  commit: its What changed part describes the layer change, and AI layer changes lists the files.

## Output

A single commit containing all uncommitted changes, in the format above. After it succeeds, print the commit
hash and the full message exactly as committed (`git log -1 --format='%h%n%n%B'`).
