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

## Local speech model: Parakeet or your own (planned 2026-11-16, nothing built)

Goal: a voice adapter that sends mic audio to a **local speech server** (default `nvidia/parakeet-unified-en-0.6b` on the user's Fedora box) instead of Vosk. Vosk stays the default fallback.

**Shape:** Pointy stays browser-only. The adapter talks to any server that serves the OpenAI-compatible `POST /v1/audio/transcriptions` endpoint, so "your own model" just means a different `baseUrl` + `model`. One adapter covers Parakeet, whisper.cpp server, speaches, LocalAI, and LM Studio (if it ever ships STT). It needs no new npm dependency (it uses `fetch`, `FormData`, `AudioWorklet`/`ScriptProcessor`) and no core change: each speech segment = emit `listening`, then `onTranscript(text)`, which fits `VoiceInput` and resets `CommandDebouncer` as it does today.

**Unverified (T0 settles these):** LM Studio has no documented speech-to-text endpoint (open request: lmstudio-ai/lms#320). `parakeet-unified-en-0.6b` officially runs through NeMo (Python). An ONNX/OpenAI-compatible wrapper exists for `parakeet-tdt-0.6b` (achetronic/parakeet), but no wrapper was found for the unified model.

| # | Task | Depends on | Files owned | Done when |
|---|---|---|---|---|
| T0 | **Spike (main session + user, no repo code):** get a Parakeet server on Fedora serving `/v1/audio/transcriptions`. Neither LM Studio nor Ollama does speech-to-text, so use a dedicated server. Start with a ready-made OpenAI-compatible Parakeet server (e.g. achetronic/parakeet, ONNX, CPU OK, `parakeet-tdt-0.6b`). Switch to `parakeet-unified-en-0.6b` via NeMo + a small FastAPI wrapper only if T1 shows a need. Run it on the **CPU** so the 8 GB GPU (RTX 5060) stays free for the Ollama LLM. Check CORS for `http://localhost:5173` and the latency of a 1 s clip, then the same with Ollama loaded (`ollama ps`, `nvidia-smi`). | none | none (notes in MEMORY.md) | `curl -F file=@draw.wav -F model=… http://<host>:<port>/v1/audio/transcriptions` returns `draw`, and latency is recorded |
| T1 | **Accuracy bench:** `scripts/asr-bench.ts` (Node 20, built-in `fetch`/`FormData`) sends each clip in `tests/fixtures/asr/*.wav` to an endpoint, runs the text through the existing `parseCommands`, and prints command accuracy, false triggers and latency p50/p95. The user records ~30 clips (each command word, plus noise and non-command speech). | T0 | `scripts/asr-bench.ts`, `tests/fixtures/asr/`, a `package.json` script | Prints a table for Parakeet; the same run against a second endpoint/model gives a comparison; `npm run check` passes |
| T2 | **Adapter** (done 2026-11-17, real mic verified Mac→Fedora): `input/voice/HttpTranscriptionVoiceInput.ts`: mic → energy-gate segmenter (thresholds in config) → 16 kHz mono WAV → POST → transcript. Statuses: `loading`/`listening`/`network`/`no-mic`. Pure WAV encoder + segmenter tested in Vitest. `config.voice.server = { enabled, baseUrl, model }`; main.ts picks the adapter. | T0 | `src/input/voice/HttpTranscriptionVoiceInput.ts`, its helpers + tests, `src/config.ts` (voice.server), `src/main.ts` (adapter choice) | Draw/stop/colors work by voice through Parakeet in the browser; server down → status + Vosk/Hand fallback; `npm run check` passes |
| T3 | **Model picker in the app:** a toolbar setting for server URL plus a model dropdown filled from `GET /v1/models`, saved in localStorage (with Vosk as an option). | T2 | `src/ui/Controls.ts`, `index.html`, `src/main.ts` | Switching models takes effect without a reload; a bad URL shows a status and keeps the old model |
| T4 | **Docs (main session):** README section "Local speech model": run Parakeet on Fedora, point Pointy at it, use your own model (any OpenAI-compatible STT server), run the bench. Replace "Run" voice text accordingly. | T2 (config names), T5 if done | `README.md` | The steps work as written on a clean Fedora box |
| T5 | **Fedora setup script (optional):** `scripts/setup-parakeet.sh` creates a venv, installs the server from T0, pulls the model from Hugging Face (or `MODEL=<hf-id>` for another one), and starts it with CORS set. | T0 | `scripts/setup-parakeet.sh` | One command on Fedora goes from nothing to a working endpoint |
| — | **Not planned: one-click "download a model" inside the app (like T3 Code).** A browser page can't install or launch a native Python/GPU server. That needs either a local helper daemon (a backend, which breaks "no backend") or running the model in the browser via WASM/ONNX (a new dependency and a ~600 MB+ download per visit cache, too heavy for 0.6B). T3 (pick from what the server has) plus T5 (script downloads it) cover the need. | | | |

Order: T0, then T1 ∥ T2 (no shared files), then T3, then T4 (T5 any time after T0).

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
