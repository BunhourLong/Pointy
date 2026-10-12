import type { EventBus } from '@/core/events';
import type { AppEvents, Command } from '@/core/types';

const KEYS: Record<string, Command> = {
  Space: { type: 'toggle' },
  KeyC: { type: 'clear' },
  KeyZ: { type: 'undo' },
};

/** Dev controls: Space = draw/stop, C = clear, Z = undo. */
export class KeyboardInput {
  private readonly bus: EventBus<AppEvents>;

  constructor(bus: EventBus<AppEvents>) {
    this.bus = bus;
    window.addEventListener('keydown', this.onKeyDown);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts alone
    if (e.target instanceof Element && e.target.closest('dialog')) return; // e.g. Space on a dialog button
    const command = KEYS[e.code];
    if (!command) return;
    e.preventDefault(); // Space would scroll / press a focused button
    this.bus.emit('command', command);
  };
}
