import type { VoiceStatus } from '@/core/types';
import type { VoiceInput } from './VoiceInput';

// lib.dom has the event types but not the (still prefixed in Chrome) constructor.
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

export interface WebSpeechOptions {
  lang: string;
  /** Wait before restarting after an error, so e.g. `network` doesn't spin. */
  errorRestartMs: number;
}

const FATAL_ERRORS = ['not-allowed', 'service-not-allowed'];

/** Continuous Web Speech recognition with interim results; restarts itself when Chrome ends it. */
export class WebSpeechVoiceInput implements VoiceInput {
  private readonly rec: Recognition | null;
  private readonly options: WebSpeechOptions;
  private wanted = false;
  private failed = false;
  private denied = false;
  private restartTimer = 0;
  private transcriptCb: (text: string) => void = () => {};
  private statusCb: (status: VoiceStatus) => void = () => {};

  constructor(options: WebSpeechOptions) {
    this.options = options;
    const w = window as unknown as Record<string, RecognitionCtor | undefined>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    this.rec = Ctor ? new Ctor() : null;
    if (!this.rec) return;
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.lang = options.lang;
    this.rec.onstart = () => this.statusCb('listening');
    this.rec.onresult = (e) =>
      this.transcriptCb(Array.from(e.results, (r) => r[0]?.transcript ?? '').join(' '));
    this.rec.onerror = (e) => this.onError(e.error);
    this.rec.onend = () => this.onEnd();
  }

  start(): void {
    if (!this.rec) return this.statusCb('unsupported');
    this.wanted = true;
    this.denied = false;
    this.begin();
  }

  stop(): void {
    this.wanted = false;
    clearTimeout(this.restartTimer);
    this.rec?.stop();
  }

  onTranscript(cb: (text: string) => void): void {
    this.transcriptCb = cb;
  }

  onStatus(cb: (status: VoiceStatus) => void): void {
    this.statusCb = cb;
  }

  dispose(): void {
    this.wanted = false;
    clearTimeout(this.restartTimer);
    if (!this.rec) return;
    this.rec.onstart = this.rec.onresult = this.rec.onerror = this.rec.onend = null;
    this.rec.abort();
  }

  private begin(): void {
    try {
      this.rec?.start();
    } catch {
      // InvalidStateError: already running. Nothing to do.
    }
  }

  private onError(error: string): void {
    if (error === 'no-speech' || error === 'aborted') return; // normal; onend restarts
    console.warn('Speech recognition error:', error);
    if (FATAL_ERRORS.includes(error)) {
      this.wanted = false;
      this.denied = true;
      this.statusCb('denied');
    } else {
      this.failed = true;
      this.statusCb('error');
    }
  }

  /** Chrome ends continuous recognition on its own (silence, ~1 min, errors): restart. */
  private onEnd(): void {
    if (!this.wanted) {
      if (!this.denied) this.statusCb('stopped');
      return;
    }
    const delay = this.failed ? this.options.errorRestartMs : 0;
    this.failed = false;
    this.restartTimer = window.setTimeout(() => this.begin(), delay);
  }
}
