import type { VoiceInput } from './VoiceInput';

// Phase 3.
export class WebSpeechVoiceInput implements VoiceInput {
  start(): void {
    throw new Error('Not implemented (Phase 3)');
  }
  stop(): void {}
  onTranscript(): void {}
  onStatus(): void {}
  dispose(): void {}
}
