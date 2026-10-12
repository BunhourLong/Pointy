export interface Status {
  fps: number;
  hand: boolean;
  pen: string;
  mic: string;
  /** Last command received, if any. */
  command: string;
}

export class StatusOverlay {
  private readonly el: HTMLElement;
  private last = '';

  constructor(el: HTMLElement) {
    this.el = el;
  }

  update({ fps, hand, pen, mic, command }: Status): void {
    const text =
      `${fps.toFixed(0).padStart(2)} fps · hand ${hand ? '✓' : '✗'} · pen ${pen} · mic ${mic}` +
      (command ? ` · “${command}”` : '');
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
