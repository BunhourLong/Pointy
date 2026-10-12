import type { Exporter, Stroke } from '@/core/types';

export type StrokePainter = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
) => void;

/** Strokes on a transparent background, drawn by the same painter the screen uses. */
export class PngExporter implements Exporter {
  private readonly paint: StrokePainter;

  constructor(paint: StrokePainter) {
    this.paint = paint;
  }

  export(strokes: readonly Stroke[], width: number, height: number): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('Canvas 2D is not supported'));
    strokes.forEach((s) => this.paint(ctx, s, width, height));
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
    );
  }
}
