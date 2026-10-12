import type { Point } from '@/core/types';
import { toCanvas } from './coords';
import { drawStroke } from './drawStroke';
import type { Rect, Renderer, Scene } from './Renderer';

export interface CanvasRendererOptions {
  cursorRadius: number;
  cursorUpColor: string;
  /** Fraction of the canvas height. */
  eraserRadius: number;
  trash: Rect;
}

/** Two layers: `committed` (finished strokes) and `live` (current stroke + cursor). */
export class CanvasRenderer implements Renderer {
  private readonly committed: CanvasRenderingContext2D;
  private readonly live: CanvasRenderingContext2D;
  private readonly options: CanvasRendererOptions;
  private readonly resizeObserver: ResizeObserver;
  private width = 0;
  private height = 0;
  /** Version of the strokes last drawn on the committed layer; -1 forces a redraw. */
  private drawnVersion = -1;

  constructor(
    committed: HTMLCanvasElement,
    live: HTMLCanvasElement,
    options: CanvasRendererOptions,
  ) {
    this.committed = getContext(committed);
    this.live = getContext(live);
    this.options = options;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(live);
  }

  render(scene: Scene): void {
    if (scene.version !== this.drawnVersion) {
      this.drawnVersion = scene.version;
      this.committed.clearRect(0, 0, this.width, this.height);
      scene.strokes.forEach((s) => drawStroke(this.committed, s, this.width, this.height));
    }
    this.live.clearRect(0, 0, this.width, this.height);
    if (scene.current) drawStroke(this.live, scene.current, this.width, this.height);
    if (scene.holding) this.drawTrash(scene.overTrash);
    if (scene.cursor) this.drawCursor(scene.cursor, scene);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.live.canvas.clientWidth;
    this.height = this.live.canvas.clientHeight;
    for (const ctx of [this.committed, this.live]) {
      ctx.canvas.width = Math.round(this.width * dpr);
      ctx.canvas.height = Math.round(this.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px
    }
    this.drawnVersion = -1; // resizing wiped the committed layer
  }

  private drawCursor(p: Point, { tool, penDown, penColor, holding }: Scene): void {
    const ctx = this.live;
    const { x, y } = toCanvas(p, this.width, this.height);
    const { cursorRadius, cursorUpColor, eraserRadius } = this.options;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = cursorUpColor;
    ctx.fillStyle = cursorUpColor;
    if (tool === 'eraser') {
      ctx.arc(x, y, eraserRadius * this.height, 0, Math.PI * 2);
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tool === 'grab') {
      ctx.arc(x, y, cursorRadius * 1.5, 0, Math.PI * 2);
      if (holding) ctx.fill();
      else ctx.stroke();
    } else if (penDown) {
      ctx.arc(x, y, cursorRadius, 0, Math.PI * 2);
      ctx.fillStyle = penColor;
      ctx.fill();
    } else {
      ctx.arc(x, y, cursorRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawTrash(hot: boolean): void {
    const ctx = this.live;
    const { x, y, w, h } = this.options.trash;
    const [px, py, pw, ph] = [x * this.width, y * this.height, w * this.width, h * this.height];
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 12);
    ctx.fillStyle = hot ? 'rgba(255, 59, 48, 0.6)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hot ? '#ff3b30' : 'rgba(255, 255, 255, 0.6)';
    ctx.stroke();
    ctx.font = `${Math.round(ph * 0.45)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗑️', px + pw / 2, py + ph / 2);
  }
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  return ctx;
}
