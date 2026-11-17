import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpTranscriptionVoiceInput } from '@/input/voice/HttpTranscriptionVoiceInput';

// 1 kHz, 100-sample chunks: one loud chunk + one quiet chunk = one phrase.
const options = {
  baseUrl: 'http://asr/v1',
  model: 'm',
  sampleRate: 1000,
  bufferSize: 100,
  requestTimeoutMs: 1000,
  segmenter: { threshold: 0.1, silenceMs: 100, minSpeechMs: 100, maxSegmentMs: 5000, preRollMs: 0 },
};

/** Fake mic, AudioContext and server; `reply` answers each transcription request. */
function setup(reply: () => Promise<Response>, ctxThrows = false) {
  const track = { stop: vi.fn() };
  let node: { onaudioprocess?: (e: unknown) => void } = {};
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) },
  });
  vi.stubGlobal(
    'AudioContext',
    class {
      sampleRate = 1000;
      state = 'running';
      destination = {};
      constructor() {
        if (ctxThrows) throw new DOMException('unsupported rate', 'NotSupportedError');
      }
      createScriptProcessor() {
        node = { connect: () => {} } as typeof node;
        return node;
      }
      createMediaStreamSource() {
        return { connect: () => {} };
      }
      close() {
        return Promise.resolve();
      }
    },
  );
  vi.stubGlobal('fetch', (url: string) =>
    url.endsWith('/models') ? Promise.resolve(new Response('{}')) : reply(),
  );
  const voice = new HttpTranscriptionVoiceInput(options);
  const statuses: string[] = [];
  const texts: string[] = [];
  voice.onStatus((s) => statuses.push(s));
  voice.onTranscript((t) => texts.push(t));
  const speak = () =>
    [0.5, 0].forEach((v) =>
      node.onaudioprocess!({
        inputBuffer: { getChannelData: () => new Float32Array(100).fill(v) },
      }),
    );
  return { voice, track, statuses, texts, speak };
}

const json = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));

afterEach(() => vi.unstubAllGlobals());

describe('HttpTranscriptionVoiceInput', () => {
  it('sends a phrase and reports its text, then listens for the next', async () => {
    const t = setup(json({ text: 'Draw.' }));
    t.voice.start();
    await vi.waitFor(() => expect(t.statuses).toContain('listening'));
    t.speak();
    await vi.waitFor(() => expect(t.texts).toEqual(['Draw.']));
    expect(t.statuses.at(-1)).toBe('listening');
  });

  it('reports network when the server is unreachable mid-session', async () => {
    const t = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    t.voice.start();
    await vi.waitFor(() => expect(t.statuses).toContain('listening'));
    t.speak();
    await vi.waitFor(() => expect(t.statuses.at(-1)).toBe('network'));
  });

  it.each([
    ['invalid JSON', () => Promise.resolve(new Response('not json'))],
    ['no text field', json({ error: 'busy' })],
    ['HTTP 500', () => Promise.resolve(new Response('boom', { status: 500 }))],
  ])('reports error, not network (which would drop to Vosk), on %s', async (_, reply) => {
    const t = setup(reply);
    t.voice.start();
    await vi.waitFor(() => expect(t.statuses).toContain('listening'));
    t.speak();
    await vi.waitFor(() => expect(t.statuses.at(-1)).toBe('error'));
    expect(t.statuses).not.toContain('network');
    expect(t.texts).toEqual([]);
  });

  it('keeps sending phrases after a transcript handler throws', async () => {
    const t = setup(json({ text: 'draw' }));
    let calls = 0;
    t.voice.onTranscript(() => {
      calls++;
      throw new Error('handler bug');
    });
    t.voice.start();
    await vi.waitFor(() => expect(t.statuses).toContain('listening'));
    t.speak();
    t.speak();
    await vi.waitFor(() => expect(calls).toBe(2));
    expect(t.statuses).not.toContain('network');
  });

  it('releases the mic and reports error when audio cannot start', async () => {
    const t = setup(json({ text: 'x' }), true);
    t.voice.start();
    await vi.waitFor(() => expect(t.statuses.at(-1)).toBe('error'));
    expect(t.track.stop).toHaveBeenCalled();
  });
});
