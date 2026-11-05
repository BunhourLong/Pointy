---
description: Execute the next PLAN.md phase via the pipeline.
---

Execute ONE phase of the Pointy build. $ARGUMENTS optionally names the phase; otherwise pick the first incomplete one.

1. Read only that phase's section in PLAN.md plus GOAL.md. Read MEMORY.md for context carried over.
2. Break the phase into vertical slices ordered by dependency. Keep exactly one slice in flight; never parallelize slices in this session.
3. Per slice, run the implement pipeline: short plan as chat text → `builder` brief (slice, expected failing test, config tunables by name) → Protocol battery below. Update MEMORY.md with dated entries as slices land.
4. At phase end: run the full `npm run check`, fix everything, then summarize for the user — what changed and how to manually test it in Chrome or Edge (MediaPipe hand tracking and Web Speech need manual browser verification in Chrome/Edge; Chrome speech recognition needs internet). Stop for user review. Do not start the next phase.

## Protocol
1. Deterministic first: run `npm run check`; nothing goes under model review until it is green. Fix failures from the diff first.
2. Freeze evidence ONCE: capture `git diff` output (uncommitted work is the norm here) + file list; pass the SAME diff to every reviewer.
3. Dispatch through the visible runner, one job at a time: write the lens brief to `scan/prompts/<agent>.md`, then run `bash scripts/battery.sh <agent> scan/prompts/<agent>.md` from the repo root. Each job opens a cmux split beside the session, streams live, and closes itself when done; outside cmux it still runs, unseen. Battery = `reviewer` + `pentester` + `quality` + `test-auditor` on the frozen diff; `scout` when context is missing.
4. Triage: dedupe by path:line; lens severity is authoritative (escalate but never downgrade). Critical/high + all security findings: must fix. Medium: fix or justify in the report. Low: log or accept.
5. Fix + re-run `npm run check` + affected scoped tests; one delta re-review round by only the affected lens. Max 2 review cycles, then stop and report to the user.
6. Context discipline: keep this session small — pass paths and diffs, not file contents; total context target < 60k per task.
