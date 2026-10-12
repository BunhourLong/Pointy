import type { Drawing } from '@/core/types';

/** Async so an HttpRepository can implement it later. */
export interface DrawingRepository {
  save(name: string, drawing: Drawing): Promise<void>;
  load(name: string): Promise<Drawing | null>;
  list(): Promise<string[]>;
}
