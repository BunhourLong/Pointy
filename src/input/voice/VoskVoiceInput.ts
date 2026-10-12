import type { KaldiRecognizer, Model } from 'vosk-browser';
import type { VoiceStatus } from '@/core/types';
import type { VoiceInput } from './VoiceInput';

export interface VoskOptions {
  /** Vosk model as .tar.gz; cached in IndexedDB after the first download. */
  modelUrl: string;
  /** The only words the recognizer may output; any other speech becomes "[unk]". */
  words: readonly string[];
  /** Audio samples per chunk sent to the recognizer (smaller = lower latency). */
  bufferSize: number;
}

interface Audio {
  stream: MediaStream;
  ctx: AudioContext;
  recognizer: KaldiRecognizer;
}

const MIC_DENIED = ['NotAllowedError', 'SecurityError'];
const NO_MIC = ['NotFoundError', 'NotReadableError', 'OverconstrainedError'];
const RESUME_EVENTS = ['pointerdown', 'keydown'] as const;

/**
 * Offline speech recognition in WebAssembly (Vosk), restricted to the command words.
 * Works in any modern browser (Brave, Firefox, Safari, …) and no audio leaves the device.
 */
export class VoskVoiceInput implements VoiceInput {
  private readonly o: VoskOptions;
  private model: Promise<Model> | null = null;
  private audio: Audio | null = null;
  private opening: Promise<void> | null = null;
  private wanted = false;
  private transcriptCb: (text: string) => void = () => {};
  private statusCb: (status: VoiceStatus) => void = () => {};

  constructor(options: VoskOptions) {
    this.o = options;
  }

  start(): void {
    this.wanted = true;
    if (typeof WebAssembly === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return this.statusCb('unsupported');
    }
    this.opening ??= this.open().finally(() => (this.opening = null));
  }

  stop(): void {
    this.wanted = false;
    this.close();
  }

  /** Text of the current utterance (partial while speaking, then final). */
  onTranscript(cb: (text: string) => void): void {
    this.transcriptCb = cb;
  }

  /** 'listening' also fires after every finished utterance: the next one is a new transcript. */
  onStatus(cb: (status: VoiceStatus) => void): void {
    this.statusCb = cb;
  }

  dispose(): void {
    this.stop();
    void this.model?.then((m) => m.terminate()).catch(() => {});
  }

  private async open(): Promise<void> {
    if (this.audio) return;
    this.statusCb('loading');
    let model: Model;
    let stream: MediaStream;
    try {
      [model, stream] = await Promise.all([
        (this.model ??= loadModel(this.o.modelUrl)),
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        }),
      ]);
    } catch (err) {
      console.warn('Voice could not start:', err);
      const name = err instanceof DOMException ? err.name : '';
      if (!MIC_DENIED.includes(name) && !NO_MIC.includes(name)) this.model = null; // retry download next time
      return this.statusCb(
        MIC_DENIED.includes(name) ? 'denied' : NO_MIC.includes(name) ? 'no-mic' : 'network',
      );
    }
    if (!this.wanted) return stream.getTracks().forEach((t) => t.stop()); // stopped while loading

    const ctx = new AudioContext();
    const grammar = JSON.stringify([...this.o.words, '[unk]']);
    const recognizer = new model.KaldiRecognizer(ctx.sampleRate, grammar);
    recognizer.on('partialresult', (m) => {
      if (m.event === 'partialresult') this.transcriptCb(m.result.partial);
    });
    recognizer.on('result', (m) => {
      if (m.event !== 'result') return;
      this.transcriptCb(m.result.text);
      this.statusCb('listening'); // utterance finished: next transcript starts empty
    });
    // ponytail: ScriptProcessorNode is deprecated but runs everywhere; move to AudioWorklet if it's removed.
    const node = ctx.createScriptProcessor(this.o.bufferSize, 1, 1);
    node.onaudioprocess = (e) => recognizer.acceptWaveform(e.inputBuffer);
    ctx.createMediaStreamSource(stream).connect(node);
    node.connect(ctx.destination); // a ScriptProcessor only runs while connected to an output
    this.audio = { stream, ctx, recognizer };

    // Autoplay policy: without a click on the page first, the AudioContext starts suspended.
    if (ctx.state === 'running') return this.statusCb('listening');
    this.statusCb('suspended');
    RESUME_EVENTS.forEach((e) => window.addEventListener(e, this.resume, { once: true }));
  }

  private resume = (): void => {
    RESUME_EVENTS.forEach((e) => window.removeEventListener(e, this.resume));
    void this.audio?.ctx.resume().then(() => this.statusCb('listening'));
  };

  private close(): void {
    RESUME_EVENTS.forEach((e) => window.removeEventListener(e, this.resume));
    if (!this.audio) return;
    const { stream, ctx, recognizer } = this.audio;
    this.audio = null;
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    recognizer.remove();
    this.statusCb('stopped');
  }
}

/** Like vosk-browser's createModel, but also rejects when the download fails (createModel hangs). */
async function loadModel(url: string): Promise<Model> {
  const { Model } = await import('vosk-browser'); // ~6 MB of WASM: load only when voice is used
  const model = new Model(url);
  return new Promise((resolve, reject) => {
    model.on('load', (m) => (m.event === 'load' && m.result ? resolve(model) : reject(m)));
    model.on('error', (m) => {
      model.terminate();
      reject(new Error(m.event === 'error' ? m.error : 'Voice model failed to load'));
    });
  });
}
