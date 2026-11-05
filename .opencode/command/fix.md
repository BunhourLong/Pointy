---
description: Reproduce-first bug fix through the quality battery.
---

Fix ONE bug in Pointy. $ARGUMENTS is the bug.

Reproduce it end to end first, as close as possible to how a real user hits it: video pipeline bugs with a fake or captured frame, voice bugs with a transcript, event bugs with fake events pushed through the typed event bus. If you cannot reproduce it, SAY SO and stop — do not fix on a guess.

1. Turn the reproduction into a failing Vitest test (`test-auditor` later confirms it failed for the right reason).
2. Run the `builder` through the runner to fix the root cause once, in shared code. Never touch tests to make them pass.
3. Run the Protocol below.
4. Update MEMORY.md with a dated entry that names the root cause.
5. Report: reproduction, root cause, check/test evidence, findings triaged, anything untested. Never commit.

## Protocol
1. Deterministic first: run `npm run check`; nothing goes under model review until it is green. Fix failures from the diff first.
2. Freeze evidence ONCE: capture `git diff` output (uncommitted work is the norm here) + file list; pass the SAME diff to every reviewer.
3. Dispatch through the visible runner, one job at a time: write the lens brief to `scan/prompts/<agent>.md`, then run `bash scripts/battery.sh <agent> scan/prompts/<agent>.md` from the repo root. Each job opens a cmux split beside the session, streams live, and closes itself when done; outside cmux it still runs, unseen. Battery = `reviewer` + `pentester` + `quality` + `test-auditor` on the frozen diff; `scout` when context is missing.
4. Triage: dedupe by path:line; lens severity is authoritative (escalate but never downgrade). Critical/high + all security findings: must fix. Medium: fix or justify in the report. Low: log or accept.
5. Fix + re-run `npm run check` + affected scoped tests; one delta re-review round by only the affected lens. Max 2 review cycles, then stop and report to the user.
6. Context discipline: keep this session small — pass paths and diffs, not file contents; total context target < 60k per task.
