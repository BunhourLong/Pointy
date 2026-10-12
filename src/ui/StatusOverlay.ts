export interface Status {
  fps: number;
  /** Detected hand pose, or ✗. */
  hand: string;
  pen: string;
  mic: string;
  /** Last command received, if any. */
  command: string;
}

export class StatusOverlay {
  private readonly el: HTMLElement;
  private last = '';
  private status: Status | null = null;
  private detailText = '';

  constructor(el: HTMLElement) {
    this.el = el;
  }

  update(status: Status): void {
    this.status = status;
    const { fps, hand, pen, mic, command } = status;
    const text =
      `${fps.toFixed(0).padStart(2)} fps · hand ${hand} · pen ${pen} · mic ${mic}` +
      (command ? ` · “${command}”` : '') +
      (this.detailText ? `\n${this.detailText}` : '');
    if (text === this.last) return; // avoid touching the DOM every frame
    this.last = text;
    this.el.textContent = text;
  }

  /** Second line: what the mic heard, or why it isn't hearing anything. */
  detail(text: string): void {
    this.detailText = text;
    if (this.status) this.update(this.status);
  }

  error(message: string): void {
    this.last = '';
    this.el.classList.add('error');
    this.el.textContent = message;
  }
}
