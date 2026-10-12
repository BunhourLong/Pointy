import './styles/main.css';
import { App } from './app/App';
import { config } from './config';
import { CommandDebouncer } from './core/commandDebouncer';
import { commandWords, parseCommands } from './core/commandParser';
import { EventBus } from './core/events';
import { HandPoseDetector } from './core/gestures/handPose';
import { PenStateMachine } from './core/penStateMachine';
import { OneEuroFilter } from './core/smoothing/oneEuroFilter';
import { StrokeGrabber } from './core/strokeGrabber';
import { StrokeStore } from './core/strokeStore';
import type { AppEvents, VoiceStatus } from './core/types';
import { PngExporter } from './export/PngExporter';
import { Webcam } from './input/camera/webcam';
import { KeyboardInput } from './input/keyboard/KeyboardInput';
import { MediaPipeHandTracker } from './input/tracking/MediaPipeHandTracker';
import { VoskVoiceInput } from './input/voice/VoskVoiceInput';
import { CanvasRenderer } from './render/CanvasRenderer';
import { drawStroke } from './render/drawStroke';
import { LocalStorageRepository } from './storage/LocalStorageRepository';
import { Controls } from './ui/Controls';
import { Onboarding } from './ui/Onboarding';
import { StatusOverlay } from './ui/StatusOverlay';

// Composition root: the only place that constructs concrete classes.
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const overlay = new StatusOverlay($('status'));
const bus = new EventBus<AppEvents>();
const store = new StrokeStore(config.pen.color, config.pen.width);
const keyboard = new KeyboardInput(bus);
const onboarding = new Onboarding($('onboarding'), config.storage.onboardedKey);
const exporter = new PngExporter(drawStroke);
const controls = new Controls($('controls'), bus, {
  colors: config.pen.colors,
  color: store.color,
  width: { min: config.pen.minWidth, max: config.pen.maxWidth, value: store.width },
  exportPng: () => exporter.export(store.strokes, video.videoWidth, video.videoHeight),
  onHelp: () => onboarding.show(),
});
onboarding.showFirstTime();

// Voice: full interim transcript → commands not emitted yet → bus.
// Vosk runs offline in any browser. For Chrome/Edge's cloud recognizer instead:
// new WebSpeechVoiceInput(config.voice).
const vocab = { keywords: config.voice.keywords, colors: config.pen.colors };
const voice = new VoskVoiceInput({ ...config.voice, words: commandWords(vocab) });
const debouncer = new CommandDebouncer();
// Plain-language reasons the mic isn't hearing anything, shown under the status bar.
const VOICE_HELP: Partial<Record<VoiceStatus, string>> = {
  'no-speech':
    'Mic hears nothing. Check System Settings → Privacy & Security → Microphone allows Chrome, ' +
    'and that the right input device is selected (Sound → Input).',
  'no-mic': 'No microphone found. Plug one in or pick one in Sound → Input.',
  network: 'Could not download the voice model. Check your internet connection and reload.',
  error: 'Speech recognition failed to start. See the browser console for details.',
  denied:
    'Microphone blocked for this site. Allow it via the icon in the address bar, then reload.',
  unsupported: 'This browser cannot run voice recognition. Use a current Chrome, Edge or Firefox.',
};
// Progress, replaced by the next status. Unlike VOICE_HELP, not a problem.
const VOICE_INFO: Partial<Record<VoiceStatus, string>> = {
  loading: 'Loading voice model (~40 MB, first visit only)…',
  suspended: 'Click anywhere on the page to turn on voice.',
  listening: 'Listening… say “draw”',
};
let heard = false;
let problem = false; // keep a help message up across the recognizer's automatic restarts
voice.onStatus((status) => {
  if (status === 'listening') debouncer.reset(); // recognizer restarted: new transcript
  const help = VOICE_HELP[status];
  // Silence after we've heard words is normal, not a problem.
  if (help && !(status === 'no-speech' && heard)) {
    overlay.detail(help);
    problem = true;
  } else if (status === 'stopped' || status === 'loading') problem = false;
  const info = VOICE_INFO[status];
  if (info && !heard && !problem) overlay.detail(info);
  if (status === 'stopped') overlay.detail('');
  bus.emit('voice:status', status);
});
voice.onTranscript((text) => {
  heard = true;
  problem = false;
  overlay.detail(`heard: ${text.trim().split(/\s+/).slice(-6).join(' ')}`);
  for (const command of debouncer.update(parseCommands(text, vocab))) bus.emit('command', command);
});
bus.on('mode', (mode) => (mode === 'voice' ? voice.start() : voice.stop()));
// No usable speech recognition: fall back to hand gestures.
bus.on('voice:status', (status) => {
  if (status !== 'unsupported' && status !== 'denied') return;
  controls.disableVoice(
    status === 'denied'
      ? 'Microphone access was blocked'
      : 'This browser cannot run voice recognition',
  );
  // Deferred: 'unsupported' fires inside voice.start(), i.e. mid-way through a 'mode' emit.
  queueMicrotask(() => bus.emit('mode', 'hand'));
});

const app = new App({
  video,
  webcam: new Webcam(video, config.camera.width, config.camera.height),
  tracker: new MediaPipeHandTracker(config.mediapipe),
  bus,
  renderer: new CanvasRenderer($('committed'), $('live'), {
    cursorRadius: config.cursor.radius,
    cursorUpColor: config.cursor.upColor,
    eraserRadius: config.eraserRadius,
    trash: config.trash,
  }),
  overlay,
  store,
  pen: new PenStateMachine(store),
  filter: new OneEuroFilter(config.smoothing),
  poses: new HandPoseDetector({ ...config.gesture, landmarks: config.landmarks }),
  grabber: new StrokeGrabber(store, config.grabRadius),
  anchors: config.gesture.anchors,
  releaseTrimMs: config.gesture.releaseTrimMs,
  eraserRadius: config.eraserRadius,
  trash: config.trash,
  handLostMs: config.handLostMs,
  stopTrimMs: config.voice.stopTrimMs,
  width: { min: config.pen.minWidth, max: config.pen.maxWidth, step: config.pen.widthStep },
  repo: new LocalStorageRepository(config.storage.prefix),
  drawingName: config.storage.lastDrawing,
  saveThrottleMs: config.storage.throttleMs,
});

overlay.update({ fps: 0, hand: '✗', pen: 'loading…', mic: 'off', command: '' });
app
  .start()
  .then(() => bus.emit('mode', config.defaultMode))
  .catch((err: unknown) => {
    console.error(err);
    const name = err instanceof DOMException ? err.name : '';
    overlay.error(
      name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow it in the site settings and reload.'
        : `Could not start: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
window.addEventListener('pagehide', () => {
  keyboard.dispose();
  voice.dispose();
  controls.dispose();
  onboarding.dispose();
  app.dispose();
});
