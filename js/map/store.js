import { EventEmitter } from '../utils/events.js';
import { releaseId } from './shapes.js';

/**
 * Central store for all shapes. CRUD + selection + events.
 * Shapes are plain objects with a `type` discriminator.
 */
export class ShapeStore extends EventEmitter {
  constructor() {
    super();
    this.shapes = [];
  }

  add(shape)      { this.shapes.push(shape); this.emit('change'); return shape; }
  remove(id)      { releaseId(id); this.shapes = this.shapes.filter(s => s.id !== id); this.emit('change'); }
  get(id)         { return this.shapes.find(s => s.id === id); }
  getAll()        { return this.shapes; }
  getVisible()    { return this.shapes.filter(s => s.visible); }
  getSelected()   { return this.shapes.filter(s => s.selected); }

  select(id) {
    this.shapes.forEach(s => (s.selected = s.id === id));
    this.emit('selection');
  }

  selectMany(ids) {
    const set = new Set(ids);
    this.shapes.forEach(s => (s.selected = set.has(s.id)));
    this.emit('selection');
  }

  toggleSelect(id) {
    const s = this.get(id);
    if (s) { s.selected = !s.selected; this.emit('selection'); }
  }

  deselectAll() {
    this.shapes.forEach(s => (s.selected = false));
    this.emit('selection');
  }

  toggleVisibility(id) {
    const s = this.get(id);
    if (s) { s.visible = !s.visible; this.emit('change'); }
  }

  update(id, props) {
    const s = this.get(id);
    if (s) { Object.assign(s, props); this.emit('change'); }
  }

  clear() { this.shapes = []; this.emit('change'); this.emit('selection'); }

  /** Deep-clone current state for undo/redo. */
  snapshot() { return JSON.parse(JSON.stringify(this.shapes)); }

  /** Restore from a snapshot (deep-cloned on restore too). */
  restore(snap) {
    this.shapes = JSON.parse(JSON.stringify(snap));
    this.emit('change');
    this.emit('selection');
  }
}
