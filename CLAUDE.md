# CLAUDE.md — Pointy

Read `GOAL.md` for what we're building and `PLAN.md` for the phased build order. Work one phase at a time and stop for review at the end of each phase. **Phase 0 (scaffolding) is yours to do. The user will not run setup commands manually.**

## Tech stack
- **Build tool / dev server:** Vite (vanilla TypeScript template). No UI framework; the drawing surface is a canvas.
- **Language:** TypeScript, `strict: true`, path alias `@/` → `src/`
- **Hand tracking:** `@mediapipe/tasks-vision` → `HandLandmarker`, `VIDEO` running mode, `numHands: 1`
  - Model `hand_landmarker.task` (float16) from official MediaPipe model storage
  - WASM via `FilesetResolver.forVisionTasks()` from the jsDelivr CDN for `@mediapipe/tasks-vision/wasm`
  - Verify both URLs against current MediaPipe docs. Keep them in `config.ts`, never inline.
- **Rendering:** Canvas 2D, layered canvases (committed strokes / live stroke + cursor)
- **Voice:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Camera:** `navigator.mediaDevices.getUserMedia`
- **Quality tooling:** ESLint (flat config + typescript-eslint), Prettier, Vitest (jsdom where needed)
- **No backend.** Everything runs client-side. A storage interface exists so a backend can be plugged in later.

## Architecture

### Principles
1. **Layered.** `core/` is pure logic with **no DOM, no browser APIs, no MediaPipe**. It must run in Vitest under Node.
2. **Adapters behind interfaces.** Every input source (hand tracker, voice, keyboard, gestures) and every output (renderer, exporter, storage) implements an interface from `core/types.ts` or its own folder's `types.ts`. Swapping MediaPipe for another tracker, or Web Speech for Vosk, means writing one new adapter file, nothing else.
3. **Typed event bus.** Inputs emit events (`hand:frame`, `hand:lost`, `command`), core reacts, render subscribes. Modules never import each other sideways.
4. **Single composition root.** Only `main.ts` constructs concrete classes and wires them together (manual dependency injection). No singletons or module-level side effects elsewhere.
5. **All tunables in `config.ts`.** Thresholds, debounce times, filter params, colors, widths, keyword lists, model URLs. No magic numbers in modules.

### Dependency rule
```
ui  ─┐
render ─┼──► core ◄── input
export ─┤
storage ─┘
main.ts  →  everything (composition root only)
```
`core/` imports nothing outside `core/`. Enforce it with an ESLint `no-restricted-imports` rule.

### Folder structure
```
src/
  main.ts                       # composition root: build + wire + start
  config.ts                     # every tunable value
  app/
    App.ts                      # lifecycle: start(), stop(), dispose(); owns the rAF loop
  core/                         # PURE, fully unit-tested
    types.ts                    # Point, Stroke, HandFrame, Command, PenState, interfaces
    events.ts                   # typed EventBus<EventMap>
    penStateMachine.ts          # idle | drawing | paused transitions
    strokeStore.ts              # start/append/end/undo/clear, color/width, trimRecent(ms)
    commandParser.ts            # transcript text → Command | null (keyword lists from config)
    commandDebouncer.ts
    smoothing/oneEuroFilter.ts
    gestures/pinchDetector.ts   # hysteresis, normalized by hand size
  input/
    camera/webcam.ts
    tracking/
      HandTracker.ts            # interface: init(), detect(video, ts): HandFrame | null, dispose()
      MediaPipeHandTracker.ts
    voice/
      VoiceInput.ts             # interface: start(), stop(), onTranscript, onStatus
      WebSpeechVoiceInput.ts    # auto-restart, error handling, interim results
    keyboard/KeyboardInput.ts   # dev controls: Space / C / Z
  render/
    Renderer.ts                 # interface
    CanvasRenderer.ts           # layered canvases, smooth curves, cursor
    coords.ts                   # normalized landmark → canvas px (mirroring lives here only)
  ui/
    StatusOverlay.ts            # fps, pen state, mic status, last command
    Controls.ts                 # mode toggle, color/width, export button
    Onboarding.ts
  export/PngExporter.ts
  storage/
    DrawingRepository.ts        # interface: save/load/list
    LocalStorageRepository.ts   # Phase 5; a future HttpRepository plugs in here
  styles/main.css
tests/                          # mirrors src/core
```

### Key facts
- **Fingertip = landmark 8**, thumb tip = 4, wrist = 0, middle-finger MCP = 9. Landmarks are normalized 0–1.
- **Mirroring:** the video is flipped with CSS `scaleX(-1)`. The x-flip for drawing happens **only** in `render/coords.ts`.
- **Pen state machine:** only "draw"-type commands open a stroke and only "stop"-type commands close it. Points are never appended while the pen is up.
- **Hand lost** for > `config.handLostMs` ends the current stroke. If the pen is still down, a new stroke starts when the hand returns.
- **Voice latency:** match keywords on **interim** results and debounce per command. On "stop", call `strokeStore.trimRecent(config.stopTrimMs)` to hide overshoot.
- **Speech restart:** Chrome ends continuous recognition on its own, so restart in `onend` unless the user turned the mic off. Handle `no-speech`, `network`, and `not-allowed` errors. On `not-allowed`, emit a status event so the app can fall back to pinch mode.
- **Detection loop:** `requestAnimationFrame`. Only call `detectForVideo` when `video.currentTime` changed. Pass monotonically increasing timestamps.
- **Smoothing:** run the One Euro filter on the fingertip before it reaches the stroke store, and reset it on hand lost.
- **Drawing:** `quadraticCurveTo` through midpoints, `lineCap = lineJoin = "round"`. Redraw the committed layer only when strokes change.
- **Cleanup:** every adapter has `dispose()` that stops tracks, closes the recognizer, and removes listeners.

## Skills (required for all code implementation)
- **`tdd`**: every code implementation is test-first (red → green, one vertical slice at a time). Write the failing Vitest test, then the minimal code to pass it. Installed globally at `~/.claude/skills/tdd`.
- **`ponytail`**: when implementing code, always take the simplest solution that works. YAGNI, standard library and platform features before custom code or new dependencies.
- Invoke both skills via the Skill tool before writing implementation code.

## Project memory
- Read `MEMORY.md` at the start of every session for context carried across sessions.
- Update `MEMORY.md` at the end of every phase (and whenever a non-obvious decision, gotcha, or deviation from this file comes up). Keep entries short and dated.

## Working style
- Minimal, surgical diffs. Don't refactor unrelated code.
- No new dependencies beyond this stack without asking.
- New behavior in `core/` comes with Vitest tests in the same phase.
- After every phase run `npm run check`, fix everything, then summarize what changed and how to test it manually.
- If MediaPipe or Web Speech behaves differently from this file, follow current official docs and note the difference in your summary.

## Scripts (set up in Phase 0)
- `npm run dev`: dev server (localhost counts as a secure context for camera/mic)
- `npm run build`: type check + production build
- `npm run typecheck`: `tsc --noEmit`
- `npm run lint` / `npm run format`
- `npm run test`: Vitest
- `npm run check`: typecheck + lint + test + build

## Testing notes
- Manual testing in **Chrome or Edge** (Firefox has no Web Speech recognition).
- Chrome speech recognition needs internet.
- `core/` must reach high test coverage. Adapters are tested manually.
