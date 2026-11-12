# Hooks

A hook is a script Claude Code runs on its own when something happens, such as the agent finishing a turn.
The agent doesn't choose to run it. A rule in CLAUDE.md asks; a hook makes sure.

## What's wired

| File | Event | What it does |
|---|---|---|
| `stop-gate.sh` | Stop | When the agent tries to finish with changed files, it runs `npm test`. If the tests fail, it blocks the stop and hands the failures back, so the agent has to fix them first. After 3 blocks in one session it lets the stop through and says the tests did not pass. |

It's wired in `.claude/settings.json`. Its block counts are kept in `.claude/hooks/.gate-state/`, which git
ignores.

- **Why `npm test` and not the audio checks:** `npm test` takes under a second. The audio checks take 5 to 7
  minutes, which is too long to run every time a turn ends. `piv-validate` runs them when `src/audio.js` or
  `src/samples.js` changed.
- **Only exit 2 blocks.** `npm test` exits 1 when a test fails, so the script converts it. If git or npm is
  missing, the stop goes through.
- **To change the command**, edit `TEST_COMMAND` at the top of the script.

## Test it without the agent

```sh
echo '{"session_id":"t"}' | CLAUDE_PROJECT_DIR=$PWD .claude/hooks/stop-gate.sh; echo "exit=$?"
```

`exit=0` with a clean tree or passing tests. `exit=2`, with the failures printed, when a test fails and files
have changed.

## Removed, and why

The course pack shipped more hooks, written for its Python demo app. They were removed on 2026-11-12 (see
`notes/brainstorm.md`, section 8):

- `pre_tool_use.py` guarded secrets and `rm -rf`. This repo has no secrets, and it blocked any command that
  mentions `process.env`, which the audio-check scripts use.
- `post_tool_use.py` logged every tool call to a file nobody read.
- `subagent_start_engineering.py` loaded `engineering.md` into the `code-reviewer` agent, which already reads it.
- `format-touched.sh` ran a Python formatter. This project has no formatter (`direction.md §no-build-step`).
- `baton.sh` started the next skill from an issue file. There are no issue files here yet.

`baton.sh`, `format-touched.sh` and the course's `stop-gate.sh` are kept as templates in
`.claude/skills/compose-hook-workflow/references/`. To write a new hook, use the `hooks-create` skill.

A hook runs code automatically, with your access, on every matching event. Read one before wiring it.
