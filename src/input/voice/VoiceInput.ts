import type { VoiceStatus } from '@/core/types';

export interface VoiceInput {
  start(): void;
  stop(): void;
  onTranscript(cb: (text: string, isFinal: boolean) => void): void;
  onStatus(cb: (status: VoiceStatus) => void): void;
  dispose(): void;
}
