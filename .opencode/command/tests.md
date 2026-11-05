---
description: Audit test quality and write missing tests (tests only).
---

Audit and strengthen tests for the given target. $ARGUMENTS is the module name or glob.

1. Run the `test-auditor` through the runner on the target files' tests first.
2. Then run the `builder` through the runner with a test-only brief: only the missing tests the auditor found. Builder touches test files only, never production code — its edit deny list keeps this enforced.
3. For every test added, assert in the report that it fails against a broken variant, stating which mutation was used.
4. Run scoped Vitest only. Skip the full `npm run check`; typecheck + lint are enough.
5. In the Protocol below, the `pentester` lens applies only if production code changed.
6. Report: auditor findings, tests added, mutation evidence, remaining gaps. Never commit.

## Protocol
1. Deterministic first: run `npm run check`; nothing goes under model review until it is green. Fix failures from the diff first.
2. Freeze evidence ONCE: capture `git diff` output (uncommitted work is the norm here) + file list; pass the SAME diff to every reviewer.
3. Dispatch through the visible runner, one job at a time: write the lens brief to `scan/prompts/<agent>.md`, then run `bash scripts/battery.sh <agent> scan/prompts/<agent>.md` from the repo root. Each job opens a cmux split beside the session, streams live, and closes itself when done; outside cmux it still runs, unseen. Battery = `reviewer` + `pentester` + `quality` + `test-auditor` on the frozen diff; `scout` when context is missing.
4. Triage: dedupe by path:line; lens severity is authoritative (escalate but never downgrade). Critical/high + all security findings: must fix. Medium: fix or justify in the report. Low: log or accept.
5. Fix + re-run `npm run check` + affected scoped tests; one delta re-review round by only the affected lens. Max 2 review cycles, then stop and report to the user.
6. Context discipline: keep this session small — pass paths and diffs, not file contents; total context target < 60k per task.
