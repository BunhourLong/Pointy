# Pointy

Draw in the air with your index finger. The webcam tracks your fingertip (MediaPipe Hand Landmarker) and you control the pen with your voice: say **"draw"** to start a line and **"stop"** to lift the pen.

Runs entirely in the browser. No backend.

## Use

| Say | Effect |
|---|---|
| draw / go / start / down | Pen down |
| stop / up / end / done | Pen up |
| clear / reset · undo / oops | Erase everything / remove last line |
| red / blue / green / black / white | Pen color |
| thicker / thinner | Pen width |

- **Hand mode** (toggle top right): ☝️ point with just your index finger to draw, 🖐 open your hand to stop. Used automatically if speech recognition is unavailable or the mic is blocked.
- **Gestures (any mode):** ✊ fist = eraser; 👌 pinch (thumb on index, other fingers open) = grab a drawing and move it, let go over the 🗑️ corner to delete it.
- **Keyboard:** Space = draw/stop, Z = undo, C = clear.
- The toolbar also has color, width, **Save PNG**, and **?** (help).
- The drawing is auto-saved in `localStorage` and restored on reload.

## Run

Requires Node.js 20+, a current browser (Chrome, Edge, Brave, Firefox, Safari), a webcam, and a mic. Voice recognition runs offline in the browser ([Vosk](https://github.com/ccoreilly/vosk-browser), restricted to the command words); the hand model and the ~40 MB voice model download on first visit (the voice model is then cached in IndexedDB).

```sh
npm install
npm run dev      # open the printed localhost URL, allow camera + mic
```

## AI voice commands (planned)

Hold a push-to-talk key, say something like *"draw a rectangle in the top left"* or *"move it a bit right"*, and an LLM turns it into shape commands. The model runs on a separate PC on the home network with [Ollama](https://ollama.com); the app talks to its OpenAI-compatible API (`/v1/chat/completions` with tools), so a hosted provider (Groq, OpenRouter, …) or a Docker server can replace it later by changing `baseUrl` + `model` in `config.ts`.

**Model for the AI PC (RTX 4060 8 GB VRAM, 16 GB RAM): `qwen3.5:9b`.** It fits entirely in VRAM, so commands come back in well under a second, and it supports native tool calling. Backup to compare: `gemma4:e4b` (faster, smaller). Avoid ~30B dense models (e.g. `gemma4:31b`): ~18–20 GB at 4-bit, so most of it would run on the CPU and each command would take 10+ s. Check exact tags on [ollama.com/library](https://ollama.com/library).

### Set up the AI PC

1. Install Ollama, then `ollama pull qwen3.5:9b`.
2. Let other computers reach it: set the environment variables `OLLAMA_HOST=0.0.0.0` and `OLLAMA_ORIGINS=http://localhost:5173`, then restart Ollama (on Windows: quit it from the tray and reopen it).
   ```powershell
   setx OLLAMA_HOST 0.0.0.0
   setx OLLAMA_ORIGINS http://localhost:5173
   ```
3. Allow port 11434 through the firewall (Windows, admin PowerShell):
   ```powershell
   New-NetFirewallRule -DisplayName "Ollama" -Direction Inbound -Protocol TCP -LocalPort 11434 -Action Allow
   ```
4. Give the PC a fixed IP in the router, then from the dev machine check `curl http://<pc-ip>:11434/api/tags` lists the model.

Anyone on the same Wi-Fi can use the model with `OLLAMA_HOST=0.0.0.0`, which is fine at home. Keep the app on `http://localhost`: a page served over `https` can't call a plain `http://` LAN address (needs a proxy then).

### TODO

- [ ] AI PC: install Ollama, pull `qwen3.5:9b` (and `gemma4:e4b` to compare)
- [ ] AI PC: set `OLLAMA_HOST` / `OLLAMA_ORIGINS`, open port 11434, fixed IP
- [ ] Verify `curl http://<pc-ip>:11434/api/tags` works from the dev machine
- [ ] Try ~20 test phrases against both models (correct tool call? latency?), with thinking off (`think: false`); keep the better one
- [ ] Core: shapes stored as strokes (dense edge points so smoothing keeps corners sharp), move/resize/recolor/delete "it" (last shape)
- [ ] Core: map LLM tool calls → `Command`s (Vitest)
- [ ] Input: push-to-talk (hold **A** or a 🎤 button) records free-form speech with Vosk (no grammar while held)
- [ ] Input: `OpenAiCompatibleLlm` adapter, `llm.baseUrl` / `llm.model` in `config.ts`; sends transcript + current shapes, returns tool calls
- [ ] Fallback: rule-based parser for common phrases when the AI PC is unreachable
- [ ] Later: hosted provider or Dockerized Ollama behind a small auth proxy

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type check + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run test` | Vitest |
| `npm run check` | typecheck + lint + test + build |
