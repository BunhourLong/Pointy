import type { VoiceStatus } from '@/core/types';

export interface VoiceInput {
  start(): void;
  stop(): void;
  /** Full transcript (interim included) since the recognizer last emitted 'listening'. */
  onTranscript(cb: (text: string) => void): void;
  /** 'listening' fires on every (re)start, i.e. whenever a new transcript begins. */
  onStatus(cb: (status: VoiceStatus) => void): void;
  dispose(): void;
}
