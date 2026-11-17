import { describe, expect, it } from 'vitest';
import { encodeWav, Segmenter } from '@/input/voice/speechAudio';

const ascii = (view: DataView, at: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(at + i)));

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM WAV header', () => {
    const view = new DataView(encodeWav(new Float32Array(3), 16000));
    expect(view.byteLength).toBe(44 + 3 * 2);
    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 3 * 2);
    expect(ascii(view, 8, 8)).toBe('WAVEfmt ');
    expect(view.getUint32(16, true)).toBe(16); // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint32(28, true)).toBe(32000); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(3 * 2);
  });

  it('scales samples to int16 and clamps out-of-range values', () => {
    const view = new DataView(encodeWav(new Float32Array([0, 0.5, -1, 1, 2, -2]), 16000));
    const samples = Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 16384, -32767, 32767, 32767, -32767]);
  });
});

describe('Segmenter', () => {
  // 1 sample = 1 ms, so chunk lengths below read as milliseconds.
  const rate = 1000;
  const options = {
    threshold: 0.1,
    silenceMs: 30,
    minSpeechMs: 20,
    maxSegmentMs: 200,
    preRollMs: 20,
  };
  const quiet = (ms: number) => new Float32Array(ms).fill(0.01);
  const loud = (ms: number) => new Float32Array(ms).fill(0.5);
  const feed = (s: Segmenter, chunks: Float32Array[]) =>
    chunks.map((c) => s.push(c)).filter((x) => x !== null);

  it('emits nothing while it is quiet', () => {
    expect(
      feed(new Segmenter(options, rate), [quiet(10), quiet(10), quiet(10), quiet(10)]),
    ).toEqual([]);
  });

  it('emits pre-roll + speech + trailing silence once the silence lasts long enough', () => {
    const s = new Segmenter(options, rate);
    const out = feed(s, [
      quiet(10),
      quiet(10),
      quiet(10),
      loud(10),
      loud(10),
      quiet(10),
      quiet(10),
    ]);
    expect(out).toEqual([]); // 20 ms of silence < 30 ms
    const segment = s.push(quiet(10));
    // Two quiet chunks of pre-roll (20 ms), 20 ms speech, 30 ms silence.
    expect(segment).toEqual(new Float32Array([...quiet(20), ...loud(20), ...quiet(30)]));
  });

  it('drops a blip shorter than minSpeechMs (a click, a bump)', () => {
    const s = new Segmenter(options, rate);
    expect(feed(s, [loud(10), quiet(10), quiet(10), quiet(10)])).toEqual([]);
    // …and starts fresh afterwards.
    expect(feed(s, [loud(20), quiet(30)])).toHaveLength(1);
  });

  it('a short pause inside an utterance does not split it', () => {
    const s = new Segmenter(options, rate);
    expect(feed(s, [loud(10), quiet(20), loud(10), quiet(30)])).toEqual([
      new Float32Array([...loud(10), ...quiet(20), ...loud(10), ...quiet(30)]),
    ]);
  });

  it('cuts a segment at maxSegmentMs (continuous noise)', () => {
    const s = new Segmenter(options, rate);
    const out = feed(
      s,
      Array.from({ length: 25 }, () => loud(10)),
    );
    expect(out.map((x) => x.length)).toEqual([200]);
  });

  it('works without pre-roll', () => {
    const s = new Segmenter({ ...options, preRollMs: 0 }, rate);
    expect(feed(s, [quiet(10), quiet(10), loud(20), quiet(30)])).toHaveLength(1);
  });

  it('copies chunks (the audio API reuses its buffers)', () => {
    const s = new Segmenter(options, rate);
    const chunk = loud(20);
    s.push(chunk);
    chunk.fill(0);
    expect(s.push(quiet(30))).toEqual(new Float32Array([...loud(20), ...quiet(30)]));
  });
});
