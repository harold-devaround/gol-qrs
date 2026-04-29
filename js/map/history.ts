import { EventEmitter } from '../utils/events.js';
import type { ShapeStore } from './store.js';
import type { Shape } from '../types.js';

/**
 * Snapshot-based undo / redo history.
 */
export class History extends EventEmitter {
  private store: ShapeStore;
  private undoStack: Shape[][];
  private redoStack: Shape[][];
  private max: number;

  constructor(store: ShapeStore) {
    super();
    this.store = store;
    this.undoStack = [];
    this.redoStack = [];
    this.max = 80;
  }

  /** Call BEFORE mutating the store. */
  save(): void {
    this.undoStack.push(this.store.snapshot());
    if (this.undoStack.length > this.max) this.undoStack.shift();
    this.redoStack = [];
    this.emit('change');
  }

  undo(): void {
    if (!this.canUndo) return;
    this.redoStack.push(this.store.snapshot());
    this.store.restore(this.undoStack.pop()!);
    this.emit('change');
  }

  redo(): void {
    if (!this.canRedo) return;
    this.undoStack.push(this.store.snapshot());
    this.store.restore(this.redoStack.pop()!);
    this.emit('change');
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
