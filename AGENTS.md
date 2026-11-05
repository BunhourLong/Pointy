# AGENTS.md — Pointy

Pointy is a browser drawing app: the webcam tracks your index fingertip and voice commands control the pen ("draw"/"stop"/"clear"/"undo", colors, widths). See GOAL.md for the product.

- Full project doc: CLAUDE.md — read it first. It is the source of truth for architecture invariants, key facts and scripts.
- Session memory: MEMORY.md — read at the start of every session, update at the end. Short, dated entries.

## Cross-cutting rules

- Layered architecture. `src/core/` is pure logic — no DOM, no browser APIs, no MediaPipe; runs under Vitest in Node. Adapters in `input/ render/ ui/ export/ storage/` implement interfaces; they may import `core/` types, but modules never import each other sideways. `src/main.ts` is the only composition root. Every tunable lives in `src/config.ts` — no magic numbers.
- Quality beats speed. TDD: write the failing test first, watch it fail for the right reason, then write the least code that passes.
- Bugs: reproduce end to end the way a real user hits it, then turn the repro into a failing test before fixing.
- Never add dependencies without asking. Minimal, surgical diffs — no drive-by refactors.
- Run `npm run check` (typecheck + lint + test + build) before calling anything done.

## Model / workflow

- GLM 5.3 Flash (opencode) everywhere; keep each session small and delegate verification to fresh-context subagents. No graphify.
