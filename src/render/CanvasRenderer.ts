import type { Point, Stroke } from '@/core/types';
import { toCanvas } from './coords';
import type { Renderer, Scene } from './Renderer';

export interface CanvasRendererOptions {
  cursorRadius: number;
  cursorUpColor: string;
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
      scene.strokes.forEach((s) => this.drawStroke(this.committed, s));
    }
    this.live.clearRect(0, 0, this.width, this.height);
    if (scene.current) this.drawStroke(this.live, scene.current);
    if (scene.cursor) this.drawCursor(scene.cursor, scene.penDown, scene.penColor);
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
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    this.drawnVersion = -1; // resizing wiped the committed layer
  }

  /** Quadratic curves through the midpoints of consecutive points. */
  private drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    const pts = stroke.points.map((p) => toCanvas(p, this.width, this.height));
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (!first || !last) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i]!;
      const next = pts[i + 1]!;
      ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
    }
    ctx.lineTo(last.x, last.y); // a single point draws a round dot
    ctx.stroke();
  }

  private drawCursor(p: Point, penDown: boolean, penColor: string): void {
    const ctx = this.live;
    const { x, y } = toCanvas(p, this.width, this.height);
    ctx.beginPath();
    ctx.arc(x, y, this.options.cursorRadius, 0, Math.PI * 2);
    if (penDown) {
      ctx.fillStyle = penColor;
      ctx.fill();
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.options.cursorUpColor;
      ctx.stroke();
    }
  }
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  return ctx;
}
