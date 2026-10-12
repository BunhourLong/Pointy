import type { InputMode } from './core/types';

// Every tunable lives here. Modules receive these values via constructor args from main.ts.
export const config = {
  mediapipe: {
    // Pinned to the installed @mediapipe/tasks-vision version so JS and WASM always match.
    wasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm',
    modelUrl:
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    numHands: 1,
  },
  camera: { width: 1280, height: 720 },
  landmarks: {
    wrist: 0,
    thumbTip: 4,
    indexPip: 6,
    indexTip: 8,
    middleMcp: 9,
    middlePip: 10,
    middleTip: 12,
    ringPip: 14,
    ringTip: 16,
    pinkyPip: 18,
    pinkyTip: 20,
  },
  /** Hand missing this long ends the current stroke. */
  handLostMs: 250,
  /** One Euro filter, in normalized units/second. Lower minCutoff = less jitter, more lag. */
  smoothing: { minCutoff: 1.0, beta: 10, dCutoff: 1.0 },
  pen: {
    color: '#ff3b30',
    width: 6,
    minWidth: 2,
    maxWidth: 40,
    widthStep: 3,
    colors: {
      red: '#ff3b30',
      blue: '#0a84ff',
      green: '#30d158',
      black: '#000000',
      white: '#ffffff',
    } as Record<string, string>,
  },
  cursor: { radius: 8, upColor: 'rgba(255, 255, 255, 0.9)' },
  /** Hand poses, measured on MediaPipe's 3D world landmarks. */
  gesture: {
    /** Thumb–index tip distance / palm size (wrist → middle MCP). Hysteresis: on < off. */
    pinchOn: 0.35,
    pinchOff: 0.5,
    /** Finger extended when wrist→tip > wrist→PIP × this. */
    extendRatio: 1.1,
    /** Frames a new pose must hold before it counts (stops flicker). ~100 ms at 30 fps. */
    stableFrames: 3,
    /** Leaving the draw pose: drop the stroke's last N ms (the finger moves while curling). */
    releaseTrimMs: 150,
    /** Landmarks averaged into the cursor position for each pose. */
    anchors: { open: [8], point: [8], pinch: [4, 8], fist: [9] },
  },
  /** Fist eraser radius, as a fraction of the frame height. */
  eraserRadius: 0.05,
  /** How close (fraction of frame height) a pinch must be to a line to grab its drawing. */
  grabRadius: 0.06,
  /** Drop a grabbed drawing here to delete it. Screen space (as seen, mirrored), 0–1. */
  trash: { x: 0.84, y: 0.74, w: 0.14, h: 0.22 },
  voice: {
    /** Offline Vosk model (small English, ~40 MB .tar.gz with CORS; cached in IndexedDB after first load). */
    modelUrl: 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz',
    /** Samples per audio chunk sent to Vosk; ~43 ms at 48 kHz. */
    bufferSize: 2048,
    /** Web Speech adapter only (Chrome/Edge; swap it in from main.ts). */
    lang: 'en-US',
    /** Web Speech only: delay before restarting recognition after an error (e.g. `network`). */
    errorRestartMs: 1000,
    /** On "stop", drop points drawn in the last N ms (speech latency overshoot). */
    stopTrimMs: 500,
    // Also the recognizer's whole grammar: fewer, distinct words = fewer false triggers.
    keywords: {
      draw: ['draw', 'go', 'start', 'down'],
      stop: ['stop', 'up', 'end', 'done'],
      clear: ['clear', 'reset'],
      undo: ['undo', 'oops'],
      thicker: ['thicker', 'bigger'],
      thinner: ['thinner', 'smaller'],
    },
  },
  defaultMode: 'voice' as InputMode,
  storage: {
    prefix: 'pointy:drawing:',
    /** The drawing auto-saved on every change and restored on load. */
    lastDrawing: 'last',
    onboardedKey: 'pointy:onboarded',
    /** Auto-save at most this often (erasing/dragging change the drawing every frame). */
    throttleMs: 500,
  },
} as const;

export type Config = typeof config;
