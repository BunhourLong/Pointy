import type { Command } from './types';

/**
 * Speech recognizers re-send the whole transcript on every interim update.
 * Feed it the commands parsed from that transcript; it returns only the ones not emitted yet.
 */
export class CommandDebouncer {
  private emitted = 0;

  update(commands: Command[]): Command[] {
    // The recognizer may revise earlier words away; never emit those again.
    this.emitted = Math.min(this.emitted, commands.length);
    const fresh = commands.slice(this.emitted);
    this.emitted = commands.length;
    return fresh;
  }

  /** Call when a new transcript starts (recognizer restarted). */
  reset(): void {
    this.emitted = 0;
  }
}
