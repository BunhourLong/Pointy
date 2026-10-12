# Pointy — Setup & Build Plan

## What you do
1. Make an empty folder `pointy/`, put `GOAL.md`, `CLAUDE.md`, `PLAN.md` in it.
2. Open Claude Code in that folder and paste the **Phase 0** prompt at the bottom.
3. After each phase: run `npm run dev`, test in Chrome, then send the next phase prompt.

Requirements on your machine: Node.js 20+, Chrome or Edge, webcam, mic, internet.

---

## Phase 0 — Scaffolding (Claude Code does all of this)
- Scaffold Vite `vanilla-ts` **into the current folder** without deleting the three .md files.
- Remove starter content (counter, logos, demo CSS).
- Install: `@mediapipe/tasks-vision`; dev: `vitest`, `jsdom`, `eslint`, `typescript-eslint`, `@eslint/js`, `prettier`, `eslint-config-prettier`.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, path alias `@/*` → `src/*` (mirror the alias in `vite.config.ts` and Vitest config).
- ESLint flat config with a `no-restricted-imports` rule so `src/core/**` cannot import from `input`, `render`, `ui`, `export`, `storage`, or `app`.
- Prettier config + `.prettierignore`.
- Vitest config (node env for `core`, jsdom available).
- Scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `check`.
- Create the full folder structure from CLAUDE.md with **interfaces and types filled in** and empty/stub implementations. Add `config.ts` with all tunables and sensible defaults.
- `core/events.ts`: working typed EventBus with tests.
- `.gitignore`, short `README.md` (what it is, how to run), `git init` + first commit.

✅ **Done when:** `npm run check` passes and `npm run dev` shows a blank page with the app shell.

## Phase 1 — Camera + hand tracking
- `input/camera/webcam.ts`, `input/tracking/MediaPipeHandTracker.ts`
- `render/coords.ts` + cursor dot on landmark 8
- `app/App.ts` rAF loop; `ui/StatusOverlay.ts` shows fps + hand detected

✅ **Done when:** a dot follows your fingertip, mirrored correctly, ~25+ fps.

## Phase 2 — Drawing (keyboard controls)
- `core/strokeStore.ts`, `core/penStateMachine.ts`, `core/smoothing/oneEuroFilter.ts` (+ tests)
- `render/CanvasRenderer.ts` layered canvases, smooth curves
- `input/keyboard/KeyboardInput.ts`: Space = draw/stop, C = clear, Z = undo
- Hand-lost handling

✅ **Done when:** Space toggles drawing, lines are smooth, strokes stay separate.

## Phase 3 — Voice
- `core/commandParser.ts`, `core/commandDebouncer.ts` (+ tests)
- `input/voice/WebSpeechVoiceInput.ts`: interim matching, auto-restart, error handling
- All commands from GOAL.md, stop-overshoot trim
- Mic status + last command in the overlay

✅ **Done when:** 10 minutes of voice-only drawing without reloading.

## Phase 4 — Pinch fallback + modes
- `core/gestures/pinchDetector.ts` with hysteresis (+ tests)
- `ui/Controls.ts`: Voice / Pinch mode toggle; auto-fallback when speech is unsupported or denied

✅ **Done when:** pinch drawing doesn't flicker at the threshold.

## Phase 5 — Polish
- `export/PngExporter.ts`, color/width controls, `ui/Onboarding.ts`
- `storage/LocalStorageRepository.ts`: save/load last drawing
- Review test coverage of `core/`

✅ **Done when:** `npm run check` passes and a first-time user can figure it out from the onboarding overlay.

## Later (the architecture already allows these)
| Feature | What gets added |
|---|---|
| Offline voice | `input/voice/VoskVoiceInput.ts` |
| Different tracker | new class implementing `HandTracker` |
| Cloud save / gallery | `storage/HttpRepository.ts` + an Express or FastAPI backend |
| Eraser gesture | `core/gestures/openPalmDetector.ts` |
| React UI shell | replace `ui/` only; core/input/render untouched |
| Deploy | static host (Vercel / Netlify / GitHub Pages), HTTPS required |

---

## Prompts for Claude Code

**Phase 0:**
> Read GOAL.md, CLAUDE.md, and PLAN.md. Do **Phase 0** completely: scaffold, install, configure tooling, create the full folder structure with interfaces/types/stubs, and make the first commit. Don't delete the .md files. Verify the MediaPipe model and WASM URLs against current docs and put them in config.ts. Run `npm run check` until it passes, then stop and summarize.

**Each following phase:**
> Implement **Phase N** from PLAN.md, following CLAUDE.md. Add tests for any new core logic. Run `npm run check` until it passes, commit, then summarize what changed and how I should test it.

## Troubleshooting
| Problem | Likely cause |
|---|---|
| Camera doesn't start | Not on localhost/HTTPS, or permission blocked in site settings |
| Dot on the wrong side | x not flipped in `coords.ts`, or flipped twice |
| Voice stops after ~1 min | Missing auto-restart in `onend` |
| `network` speech error | Chrome speech needs internet; switch to pinch mode |
| Jittery lines | Smoothing not applied, or One Euro `minCutoff` too high |
| Line overshoots on "stop" | Increase `stopTrimMs`, check interim matching |
| Lint error importing into core | Working as intended: move the code to an adapter |
