import type { Exporter } from '@/core/types';

// Phase 5.
export class PngExporter implements Exporter {
  export(): Promise<Blob> {
    throw new Error('Not implemented (Phase 5)');
  }
}
