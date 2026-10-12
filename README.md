# Pointy

Draw in the air with your index finger. The webcam tracks your fingertip (MediaPipe Hand Landmarker) and you control the pen with your voice: say **"draw"** to start a line and **"stop"** to lift the pen.

Runs entirely in the browser. No backend.

## Use

| Say | Effect |
|---|---|
| draw / go / start | Pen down |
| stop / up | Pen up |
| clear / undo | Erase everything / remove last line |
| red / blue / green / black / white | Pen color |
| thicker / thinner | Pen width |

- **Pinch mode** (toggle top right): touch thumb and index finger to draw. Used automatically if speech recognition is unavailable or the mic is blocked.
- **Keyboard:** Space = draw/stop, Z = undo, C = clear.
- The toolbar also has color, width, **Save PNG**, and **?** (help).
- The drawing is auto-saved in `localStorage` and restored on reload.

## Run

Requires Node.js 20+, Chrome or Edge, a webcam, a mic, and an internet connection (model, WASM, and Chrome speech recognition load from the network).

```sh
npm install
npm run dev      # open the printed localhost URL, allow camera + mic
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type check + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run test` | Vitest |
| `npm run check` | typecheck + lint + test + build |
