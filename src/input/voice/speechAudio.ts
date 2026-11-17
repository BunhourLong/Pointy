/** 16-bit PCM mono WAV of `samples` (−1…1, clamped). */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (at: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) =>
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 0x7fff), true),
  );
  return view.buffer;
}

export interface SegmenterOptions {
  /** RMS level (0–1) from which an audio chunk counts as speech. */
  threshold: number;
  /** Silence after speech that ends a segment. */
  silenceMs: number;
  /** Segments with less speech than this are dropped (clicks, bumps). */
  minSpeechMs: number;
  /** A segment this long is sent even mid-speech (continuous noise, long talk). */
  maxSegmentMs: number;
  /** Audio kept from before speech starts, so soft onsets (the "s" of "stop") survive. */
  preRollMs: number;
}

/** Energy gate: mic chunks in, one Float32Array per spoken segment out. */
export class Segmenter {
  private readonly threshold: number;
  private readonly silence: number;
  private readonly minSpeech: number;
  private readonly maxSegment: number;
  private readonly preRoll: number;
  private chunks: Float32Array[] = [];
  // All counted in samples.
  private length = 0;
  private speech = 0;
  private silent = 0;

  constructor(o: SegmenterOptions, sampleRate: number) {
    const samples = (ms: number) => (ms * sampleRate) / 1000;
    this.threshold = o.threshold;
    this.silence = samples(o.silenceMs);
    this.minSpeech = samples(o.minSpeechMs);
    this.maxSegment = samples(o.maxSegmentMs);
    this.preRoll = samples(o.preRollMs);
  }

  /** The finished segment, or null while there is none. */
  push(chunk: Float32Array): Float32Array | null {
    this.chunks.push(chunk.slice()); // the audio API reuses its buffers
    this.length += chunk.length;
    if (rms(chunk) >= this.threshold) {
      this.speech += chunk.length;
      this.silent = 0;
    } else this.silent += chunk.length;

    if (this.speech === 0) {
      while (this.chunks.length > 1 && this.length - this.chunks[0]!.length >= this.preRoll) {
        this.length -= this.chunks.shift()!.length;
      }
      return null;
    }
    if (this.silent < this.silence && this.length < this.maxSegment) return null;
    const segment = this.speech >= this.minSpeech ? concat(this.chunks, this.length) : null;
    this.chunks = [];
    this.length = this.speech = this.silent = 0;
    return segment;
  }
}

const rms = (x: Float32Array) => Math.sqrt(x.reduce((sum, v) => sum + v * v, 0) / x.length);

function concat(chunks: Float32Array[], length: number): Float32Array {
  const out = new Float32Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
