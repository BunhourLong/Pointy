import type { Drawing } from '@/core/types';
import type { DrawingRepository } from './DrawingRepository';

// Phase 5.
export class LocalStorageRepository implements DrawingRepository {
  save(): Promise<void> {
    throw new Error('Not implemented (Phase 5)');
  }
  load(): Promise<Drawing | null> {
    throw new Error('Not implemented (Phase 5)');
  }
  list(): Promise<string[]> {
    throw new Error('Not implemented (Phase 5)');
  }
}
