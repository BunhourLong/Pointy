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
  landmarks: { wrist: 0, thumbTip: 4, indexTip: 8, middleMcp: 9 },
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
  voice: {
    lang: 'en-US',
    /** Delay before restarting recognition after an error (e.g. `network`). */
    errorRestartMs: 1000,
    /** On "stop", drop points drawn in the last N ms (speech latency overshoot). */
    stopTrimMs: 300,
    keywords: {
      draw: ['draw', 'go', 'start'],
      stop: ['stop', 'up'],
      clear: ['clear'],
      undo: ['undo'],
      thicker: ['thicker'],
      thinner: ['thinner'],
    },
  },
  defaultMode: 'voice' as InputMode,
  /** Pinch distance / hand size (wrist → middle MCP). Hysteresis: on < off. */
  pinch: { onRatio: 0.35, offRatio: 0.5 },
  storageKey: 'pointy:last-drawing',
} as const;

export type Config = typeof config;
