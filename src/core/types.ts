/** Normalized 0–1 coordinates in camera (unmirrored) space. */
export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One tracked hand: 21 landmarks (MediaPipe order). */
export interface HandFrame {
  /** Normalized 0–1 image coordinates. */
  landmarks: Point[];
  /** Metric 3D coordinates around the hand's center: rotation-robust, for pose detection. */
  world: Vec3[];
  /** ms, monotonically increasing (performance.now()). */
  timestamp: number;
}

/** idle = pen up; drawing = pen down + hand visible; paused = pen down, hand lost. */
export type PenState = 'idle' | 'drawing' | 'paused';

export type Command =
  | { type: 'draw' }
  | { type: 'stop' }
  | { type: 'toggle' }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'color'; color: string }
  | { type: 'width'; width: number }
  | { type: 'thicker' }
  | { type: 'thinner' };

/** point = index only extended; pinch = thumb on index, other fingers open (👌). */
export type HandPose = 'open' | 'point' | 'fist' | 'pinch';

/** Who controls the pen: voice commands or the hand pose (point = draw). */
export type InputMode = 'voice' | 'hand';

export type VoiceStatus =
  /** Downloading / starting the recognizer. */
  | 'loading'
  | 'listening'
  /** Ready, but the browser needs a click on the page before audio can run. */
  | 'suspended'
  | 'stopped'
  | 'unsupported'
  | 'denied'
  | 'error'
  /** Recognizer heard no speech for a while (silence, muted or wrong mic). */
  | 'no-speech'
  /** No microphone could be opened. */
  | 'no-mic'
  /** Speech service or model download unreachable. */
  | 'network';

export interface AppEvents {
  'hand:frame': HandFrame;
  'hand:lost': { timestamp: number };
  command: Command;
  'voice:status': VoiceStatus;
  mode: InputMode;
  /** Pen color/width changed (by any input), so UI can reflect it. */
  'pen:style': { color: string; width: number };
}

export interface Drawing {
  strokes: Stroke[];
}

export interface Exporter {
  export(strokes: readonly Stroke[], width: number, height: number): Promise<Blob>;
}
