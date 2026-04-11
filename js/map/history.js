import { EventEmitter } from '../utils/events.js';

/**
 * Snapshot-based undo / redo history.
 */
export class History extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.undoStack = [];
    this.redoStack = [];
    this.max = 80;
  }

  /** Call BEFORE mutating the store. */
  save() {
    this.undoStack.push(this.store.snapshot());
    if (this.undoStack.length > this.max) this.undoStack.shift();
    this.redoStack = [];
    this.emit('change');
  }

  undo() {
    if (!this.canUndo) return;
    this.redoStack.push(this.store.snapshot());
    this.store.restore(this.undoStack.pop());
    this.emit('change');
  }

  redo() {
    if (!this.canRedo) return;
    this.undoStack.push(this.store.snapshot());
    this.store.restore(this.redoStack.pop());
    this.emit('change');
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}
