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

/** One tracked hand: 21 normalized landmarks (MediaPipe order). */
export interface HandFrame {
  landmarks: Point[];
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

/** Who controls the pen: voice commands or the thumb–index pinch. */
export type InputMode = 'voice' | 'pinch';

export type VoiceStatus = 'listening' | 'stopped' | 'unsupported' | 'denied' | 'error';

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
