import type { Drawing, Stroke } from '@/core/types';
import type { DrawingRepository } from './DrawingRepository';

/** Drawings as JSON under `<prefix><name>`. */
export class LocalStorageRepository implements DrawingRepository {
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  async save(name: string, drawing: Drawing): Promise<void> {
    localStorage.setItem(this.prefix + name, JSON.stringify(drawing));
  }

  async load(name: string): Promise<Drawing | null> {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(this.prefix + name) ?? 'null');
      const strokes = (data as Drawing | null)?.strokes;
      // Stored data is untrusted (other versions, manual edits): keep only well-formed strokes.
      return Array.isArray(strokes) ? { strokes: strokes.filter(isStroke) } : null;
    } catch {
      return null;
    }
  }

  async list(): Promise<string[]> {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(this.prefix))
      .map((k) => k.slice(this.prefix.length));
  }
}

function isStroke(s: Stroke): boolean {
  return (
    typeof s?.color === 'string' &&
    typeof s.width === 'number' &&
    Array.isArray(s.points) &&
    s.points.every((p) => typeof p?.x === 'number' && typeof p.y === 'number')
  );
}
