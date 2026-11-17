import type { VoiceStatus } from '@/core/types';
import { encodeWav, Segmenter, type SegmenterOptions } from './speechAudio';
import type { VoiceInput } from './VoiceInput';

export interface HttpTranscriptionOptions {
  /** OpenAI-compatible API root, e.g. `http://localhost:5092/v1`. */
  baseUrl: string;
  model: string;
  /** Mic audio is recorded and sent at this rate (Hz). */
  sampleRate: number;
  /** Samples per audio chunk fed to the segmenter. */
  bufferSize: number;
  requestTimeoutMs: number;
  segmenter: SegmenterOptions;
}

interface Audio {
  stream: MediaStream;
  ctx: AudioContext;
}

const MIC_DENIED = ['NotAllowedError', 'SecurityError'];
const NO_MIC = ['NotFoundError', 'NotReadableError', 'OverconstrainedError'];
const RESUME_EVENTS = ['pointerdown', 'keydown'] as const;

/**
 * Speech recognition by a local server with the OpenAI `POST /audio/transcriptions` API
 * (Parakeet, whisper.cpp, speaches, …): each spoken segment is sent as WAV, its text returned.
 */
export class HttpTranscriptionVoiceInput implements VoiceInput {
  private readonly o: HttpTranscriptionOptions;
  private audio: Audio | null = null;
  private opening: Promise<void> | null = null;
  private wanted = false;
  private requests: Promise<void> = Promise.resolve(); // one at a time, so results stay in order
  private transcriptCb: (text: string) => void = () => {};
  private statusCb: (status: VoiceStatus) => void = () => {};

  constructor(options: HttpTranscriptionOptions) {
    this.o = options;
  }

  start(): void {
    this.wanted = true;
    if (!navigator.mediaDevices?.getUserMedia) return this.statusCb('unsupported');
    this.opening ??= this.open().finally(() => (this.opening = null));
  }

  stop(): void {
    this.wanted = false;
    this.close();
  }

  /** Text of one spoken segment. */
  onTranscript(cb: (text: string) => void): void {
    this.transcriptCb = cb;
  }

  /** 'listening' also fires after every segment: the next one is a new transcript. */
  onStatus(cb: (status: VoiceStatus) => void): void {
    this.statusCb = cb;
  }

  dispose(): void {
    this.stop();
  }

  private async open(): Promise<void> {
    if (this.audio) return;
    this.statusCb('loading');
    try {
      // Any HTTP answer means the server is up; only an unreachable one throws.
      await fetch(`${this.o.baseUrl}/models`, {
        signal: AbortSignal.timeout(this.o.requestTimeoutMs),
      });
    } catch (err) {
      console.warn(`Speech server ${this.o.baseUrl} unreachable:`, err);
      if (this.wanted) this.statusCb('network'); // not after stop(): it would start the fallback
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      console.warn('Voice could not start:', err);
      const name = err instanceof DOMException ? err.name : '';
      return this.statusCb(
        MIC_DENIED.includes(name) ? 'denied' : NO_MIC.includes(name) ? 'no-mic' : 'error',
      );
    }
    if (!this.wanted) return stream.getTracks().forEach((t) => t.stop()); // stopped while loading

    // ponytail: the browser resamples the mic to 16 kHz. Older Firefox can't connect a mic to a
    // context at another rate; resample in JS if Firefox support matters.
    let ctx: AudioContext | undefined;
    try {
      ctx = new AudioContext({ sampleRate: this.o.sampleRate });
      const audio: Audio = { stream, ctx };
      const rate = ctx.sampleRate;
      const segmenter = new Segmenter(this.o.segmenter, rate);
      // ponytail: ScriptProcessorNode is deprecated but runs everywhere; move to AudioWorklet if it's removed.
      const node = ctx.createScriptProcessor(this.o.bufferSize, 1, 1);
      node.onaudioprocess = (e) => {
        const segment = segmenter.push(e.inputBuffer.getChannelData(0));
        if (segment) this.send(audio, encodeWav(segment, rate));
      };
      ctx.createMediaStreamSource(stream).connect(node);
      node.connect(ctx.destination); // a ScriptProcessor only runs while connected to an output
      this.audio = audio;
    } catch (err) {
      console.warn('Voice audio could not start:', err);
      stream.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      return this.statusCb('error');
    }

    // Autoplay policy: without a click on the page first, the AudioContext starts suspended.
    if (ctx.state === 'running') return this.statusCb('listening');
    this.statusCb('suspended');
    RESUME_EVENTS.forEach((e) => window.addEventListener(e, this.resume, { once: true }));
  }

  private send(audio: Audio, wav: ArrayBuffer): void {
    const body = new FormData();
    body.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav');
    body.append('model', this.o.model);
    this.requests = this.requests
      .then(async () => {
        if (this.audio !== audio) return; // stopped while queued
        let res: Response;
        try {
          res = await fetch(`${this.o.baseUrl}/audio/transcriptions`, {
            method: 'POST',
            body,
            signal: AbortSignal.timeout(this.o.requestTimeoutMs),
          });
        } catch (err) {
          // Only this means "server down": main.ts then switches to Vosk.
          console.warn('Speech server unreachable:', err);
          if (this.audio === audio) this.statusCb('network');
          return;
        }
        let text: unknown;
        try {
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          ({ text } = (await res.json()) as { text?: unknown });
          if (typeof text !== 'string') throw new Error('response has no "text" string');
        } catch (err) {
          console.warn('Transcription failed:', err);
          if (this.audio === audio) this.statusCb('error');
          return;
        }
        if (this.audio !== audio) return;
        this.transcriptCb(text);
        this.statusCb('listening');
      })
      // A throwing listener must not reject the chain, or every later phrase would be skipped.
      .catch((err: unknown) => console.error('Voice transcript handler failed:', err));
  }

  private resume = (): void => {
    RESUME_EVENTS.forEach((e) => window.removeEventListener(e, this.resume));
    void this.audio?.ctx.resume().then(() => this.statusCb('listening'));
  };

  private close(): void {
    RESUME_EVENTS.forEach((e) => window.removeEventListener(e, this.resume));
    if (!this.audio) return;
    const { stream, ctx } = this.audio;
    this.audio = null;
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    this.statusCb('stopped');
  }
}
