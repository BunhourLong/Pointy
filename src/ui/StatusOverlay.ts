export interface Status {
  fps: number;
  hand: boolean;
  pen: string;
}

export class StatusOverlay {
  private readonly el: HTMLElement;
  private last = '';

  constructor(el: HTMLElement) {
    this.el = el;
  }

  update({ fps, hand, pen }: Status): void {
    const text = `${fps.toFixed(0).padStart(2)} fps · hand ${hand ? '✓' : '✗'} · pen ${pen}`;
    if (text === this.last) return; // avoid touching the DOM every frame
    this.last = text;
    this.el.textContent = text;
  }

  error(message: string): void {
    this.last = '';
    this.el.classList.add('error');
    this.el.textContent = message;
  }
}
