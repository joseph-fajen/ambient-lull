#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///
"""
SubagentStart hook - hand the reviewer the team's bar, every time.

Fires when a subagent is spawned. The matcher in settings.json limits it to the
`code-reviewer` agent, so the main session and every other subagent never pay for
the file. The reviewer gets `.claude/references/engineering.md` in its context
before its first turn, whether or not anything told it to read the file.

That is the difference from the pointer in the review skills: the pointer asks the
agent to read the file, the hook guarantees it is there.

    exit 0, and print JSON with additionalContext INSIDE hookSpecificOutput.

Every load is also appended to `.claude/logs/steering-loads.log` (gitignored), so
you can see it happen. Fails OPEN and silent: no file, no context, never an error.
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path

STEERING_DOC = ".claude/references/engineering.md"


def main() -> None:
    try:
        event = json.load(sys.stdin)
    except Exception:
        event = {}
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or ".")
    doc = root / STEERING_DOC
    if not doc.is_file():
        sys.exit(0)
    text = doc.read_text(encoding="utf-8")
    agent = event.get("agent_type", "subagent")
    lines = len(text.splitlines())
    # A visible record of every load (gitignored), so you can watch it happen.
    try:
        log = root / ".claude" / "logs" / "steering-loads.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        with log.open("a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S}  SubagentStart  {agent}  <-  "
                    f"{STEERING_DOC} ({lines} lines)\n")
    except OSError:
        pass
    print(json.dumps({
        "systemMessage": f"Loaded {STEERING_DOC} ({lines} lines) into the {agent} subagent",
        "hookSpecificOutput": {
            "hookEventName": "SubagentStart",
            "additionalContext": (
                f"This project's engineering steering document ({STEERING_DOC}) follows. "
                "It is the bar this review is judged against. When a finding violates one "
                "of its rules, cite the rule by its section.\n\n" + text
            ),
        },
    }))


if __name__ == "__main__":
    main()
