---
description: TDD-implement one change through the quality battery.
---

Implement ONE change in Pointy. $ARGUMENTS is the change.

1. Read MEMORY.md and only the relevant CLAUDE.md sections. If context is still missing, run `scout` through the runner first — never guess.
2. Write a short plan as chat text: files touched, tests to add. Never create a PLAN doc file.
3. Run the `builder` through the runner with a precise brief: the slice, the expected failing test, and config tunables by name. One slice per task; keep it inside ~30 files of context.
4. Run the Protocol below.
5. Update MEMORY.md with a short dated entry.
6. Report: what changed, `npm run check`/test evidence, findings triaged, anything untested. Never commit.

## Protocol
1. Deterministic first: run `npm run check`; nothing goes under model review until it is green. Fix failures from the diff first.
2. Freeze evidence ONCE: capture `git diff` output (uncommitted work is the norm here) + file list; pass the SAME diff to every reviewer.
3. Dispatch through the visible runner, one job at a time: write the lens brief to `scan/prompts/<agent>.md`, then run `bash scripts/battery.sh <agent> scan/prompts/<agent>.md` from the repo root. Each job opens a cmux split beside the session, streams live, and closes itself when done; outside cmux it still runs, unseen. Battery = `reviewer` + `pentester` + `quality` + `test-auditor` on the frozen diff; `scout` when context is missing.
4. Triage: dedupe by path:line; lens severity is authoritative (escalate but never downgrade). Critical/high + all security findings: must fix. Medium: fix or justify in the report. Low: log or accept.
5. Fix + re-run `npm run check` + affected scoped tests; one delta re-review round by only the affected lens. Max 2 review cycles, then stop and report to the user.
6. Context discipline: keep this session small — pass paths and diffs, not file contents; total context target < 60k per task.
