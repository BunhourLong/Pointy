import type { Point, Stroke } from '@/core/types';

export interface Scene {
  strokes: readonly Stroke[];
  /** Bumps whenever `strokes` changes, so the committed layer redraws only then. */
  version: number;
  current: Stroke | null;
  cursor: Point | null;
  penDown: boolean;
  penColor: string;
}

export interface Renderer {
  render(scene: Scene): void;
  dispose(): void;
}
