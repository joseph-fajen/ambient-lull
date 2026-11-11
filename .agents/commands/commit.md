Create a new commit for all of our uncommitted changes.

If `.claude/references/conventions.md` exists, read its `## commit` section first; its rules win.

Run `git status && git diff HEAD && git status --porcelain` to see what is uncommitted, then add the untracked and changed files.

Write the commit message in this format. The message is the repository's history, so it records the work and what the work changed in the AI layer:

```
<tag>: <atomic description>

What changed:
<One short paragraph: the feature, fix or refactor, the problem it solves, and the key files.>

AI layer changes:
- <path>: <what changed in it, and what in this work made it necessary>
```

Use a tag such as `feat`, `fix`, `docs`, `refactor`, `test` or `chore` that reflects the work.

List every changed file under `.claude/`, plus `CLAUDE.md` and `AGENTS.md`, under AI layer changes. Leave that part out entirely when none of them changed.

A layer fix learned while doing this work belongs in this same commit, with a line saying what went wrong during the work that it now prevents.

After committing, print the hash and the full message as committed.
