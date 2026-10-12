# Pointy

Draw in the air with your index finger. The webcam tracks your fingertip (MediaPipe Hand Landmarker) and you control the pen with your voice: say **"draw"** to start a line and **"stop"** to lift the pen.

Runs entirely in the browser. No backend.

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
