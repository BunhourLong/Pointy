import type { EventBus } from '@/core/events';
import type { AppEvents, InputMode } from '@/core/types';

/** Binds the toolbar in index.html to the bus. */
export class Controls {
  private readonly form: HTMLFormElement;
  private readonly bus: EventBus<AppEvents>;
  private readonly offMode: () => void;

  constructor(form: HTMLFormElement, bus: EventBus<AppEvents>) {
    this.form = form;
    this.bus = bus;
    form.addEventListener('change', this.onChange);
    this.offMode = bus.on('mode', (m) => (this.modeInput(m).checked = true));
  }

  /** Voice can't work here (unsupported or mic denied): lock the toggle to pinch. */
  disableVoice(reason: string): void {
    const voice = this.modeInput('voice');
    voice.disabled = true;
    voice.parentElement!.title = reason;
  }

  dispose(): void {
    this.form.removeEventListener('change', this.onChange);
    this.offMode();
  }

  private onChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'mode') this.bus.emit('mode', input.value as InputMode);
  };

  private modeInput(mode: InputMode): HTMLInputElement {
    return this.form.querySelector(`input[name=mode][value=${mode}]`)!;
  }
}
