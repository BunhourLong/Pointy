import type { Point, Stroke } from '@/core/types';

export interface Scene {
  strokes: readonly Stroke[];
  /** Bumps whenever `strokes` changes, so the committed layer redraws only then. */
  version: number;
  current: Stroke | null;
  cursor: Point | null;
  /** What the hand is doing: pen (up/down), erasing (fist), or grabbing (pinch). */
  tool: 'pen' | 'eraser' | 'grab';
  penDown: boolean;
  penColor: string;
  /** A grabbed drawing is being carried; `overTrash` = releasing now deletes it. */
  holding: boolean;
  overTrash: boolean;
}

/** Normalized screen-space (as seen, mirrored) rectangle. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Renderer {
  render(scene: Scene): void;
  dispose(): void;
}
