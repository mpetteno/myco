import type { GardenDocument, SavedGarden } from './gardenDocument';
import { gardenStorageError } from './gardenErrors';

type Save = (current: SavedGarden, document: GardenDocument) => Promise<SavedGarden>;
export type GardenSaveStatus = { state: 'saved' | 'saving' | 'error'; message: string; conflict: boolean };

export class GardenSaveQueue {
  private pending: GardenDocument | null = null;
  private running: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private status: GardenSaveStatus = { state: 'saved', message: '', conflict: false };

  constructor(private current: SavedGarden, private save: Save, private onSaved: (garden: SavedGarden) => void) {}

  getSnapshot = () => this.status;
  getCurrent = () => this.current;
  adopt = (garden: SavedGarden) => {
    if (this.pending || this.running) throw new Error('Finish saving before refreshing the current garden.');
    this.current = garden; this.onSaved(garden);
    this.notify({ state:'saved',message:'',conflict:false });
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private notify(status: GardenSaveStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  enqueue = (document: GardenDocument) => {
    this.pending = document;
    if (this.status.state !== 'error') void this.flush().catch(() => {});
  };

  flush = (): Promise<void> => {
    if (this.running) return this.running;
    if (!this.pending) return Promise.resolve();
    this.notify({ state: 'saving', message: '', conflict: false });
    this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  };

  private async drain() {
    while (this.pending) {
      const document = this.pending;
      this.pending = null;
      try {
        this.current = await this.save(this.current, document);
        this.onSaved(this.current);
      } catch (problem) {
        this.pending ??= document;
        const error = gardenStorageError(problem);
        this.notify({ state: 'error', message: error.message, conflict: error.conflict });
        throw error;
      }
    }
    this.notify({ state: 'saved', message: '', conflict: false });
  }
}
