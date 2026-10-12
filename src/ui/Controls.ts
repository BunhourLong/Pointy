import type { EventBus } from '@/core/events';
import type { AppEvents, InputMode } from '@/core/types';

export interface ControlsOptions {
  /** Color name → CSS color. */
  colors: Readonly<Record<string, string>>;
  color: string;
  width: { min: number; max: number; value: number };
  exportPng: () => Promise<Blob>;
  onHelp: () => void;
}

/** Binds the toolbar in index.html to the bus. */
export class Controls {
  private readonly form: HTMLFormElement;
  private readonly bus: EventBus<AppEvents>;
  private readonly options: ControlsOptions;
  private readonly unsubscribe: (() => void)[];

  constructor(form: HTMLFormElement, bus: EventBus<AppEvents>, options: ControlsOptions) {
    this.form = form;
    this.bus = bus;
    this.options = options;

    const colors = form.querySelector('#colors')!;
    for (const [name, value] of Object.entries(options.colors)) {
      const label = document.createElement('label');
      label.title = name;
      label.style.setProperty('--swatch', value);
      const input = Object.assign(document.createElement('input'), {
        type: 'radio',
        name: 'color',
        value,
      });
      input.setAttribute('aria-label', name);
      label.append(input);
      colors.append(label);
    }
    Object.assign(this.widthInput, { min: options.width.min, max: options.width.max });
    this.showStyle(options.color, options.width.value);

    form.addEventListener('input', this.onInput);
    form.addEventListener('click', this.onClick);
    this.unsubscribe = [
      bus.on('mode', (m) => (this.input('mode', m).checked = true)),
      bus.on('pen:style', ({ color, width }) => this.showStyle(color, width)),
    ];
  }

  /** Voice can't work here (unsupported or mic denied): lock the toggle to hand mode. */
  disableVoice(reason: string): void {
    const voice = this.input('mode', 'voice');
    voice.disabled = true;
    voice.parentElement!.title = reason;
  }

  dispose(): void {
    this.form.removeEventListener('input', this.onInput);
    this.form.removeEventListener('click', this.onClick);
    this.unsubscribe.forEach((off) => off());
  }

  private onInput = (e: Event): void => {
    const { name, value } = e.target as HTMLInputElement;
    if (name === 'mode') this.bus.emit('mode', value as InputMode);
    if (name === 'color') this.bus.emit('command', { type: 'color', color: value });
    if (name === 'width') this.bus.emit('command', { type: 'width', width: Number(value) });
  };

  private onClick = (e: Event): void => {
    const action = (e.target as HTMLElement).closest('button')?.dataset.action;
    if (action === 'help') this.options.onHelp();
    if (action === 'export') this.exportPng();
  };

  private exportPng(): void {
    this.options
      .exportPng()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
        Object.assign(document.createElement('a'), {
          href: url,
          download: `pointy-${stamp}.png`,
        }).click();
        setTimeout(() => URL.revokeObjectURL(url));
      })
      .catch((err: unknown) => console.error('PNG export failed:', err));
  }

  private showStyle(color: string, width: number): void {
    const swatch = this.form.querySelector<HTMLInputElement>(
      `input[name=color][value="${CSS.escape(color)}"]`,
    );
    if (swatch) swatch.checked = true;
    this.widthInput.value = String(width);
  }

  private get widthInput(): HTMLInputElement {
    return this.form.querySelector('input[name=width]')!;
  }

  private input(name: string, value: string): HTMLInputElement {
    return this.form.querySelector(`input[name=${name}][value=${value}]`)!;
  }
}
