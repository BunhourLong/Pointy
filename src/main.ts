import './styles/main.css';
import { App } from './app/App';
import { config } from './config';
import { EventBus } from './core/events';
import type { AppEvents } from './core/types';
import { Webcam } from './input/camera/webcam';
import { MediaPipeHandTracker } from './input/tracking/MediaPipeHandTracker';
import { CanvasRenderer } from './render/CanvasRenderer';
import { StatusOverlay } from './ui/StatusOverlay';

// Composition root: the only place that constructs concrete classes.
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const overlay = new StatusOverlay($('status'));

const app = new App({
  video,
  webcam: new Webcam(video, config.camera.width, config.camera.height),
  tracker: new MediaPipeHandTracker(config.mediapipe),
  bus: new EventBus<AppEvents>(),
  renderer: new CanvasRenderer($('committed'), $('live'), {
    cursorRadius: config.cursor.radius,
    cursorUpColor: config.cursor.upColor,
  }),
  overlay,
  indexTip: config.landmarks.indexTip,
  handLostMs: config.handLostMs,
});

overlay.update({ fps: 0, hand: false, pen: 'loading…' });
app.start().catch((err: unknown) => {
  console.error(err);
  const name = err instanceof DOMException ? err.name : '';
  overlay.error(
    name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow it in the site settings and reload.'
      : `Could not start: ${err instanceof Error ? err.message : String(err)}`,
  );
});
window.addEventListener('pagehide', () => app.dispose());
