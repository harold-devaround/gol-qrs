import { EventEmitter } from '../utils/events.js';
import { releaseId, syncNextId, syncColorIndex } from './shapes.js';
import type { Shape } from '../types.js';

/**
 * Central store for all shapes. CRUD + selection + events.
 * Shapes are plain objects with a `type` discriminator.
 */
export class ShapeStore extends EventEmitter {
  shapes: Shape[];

  constructor() {
    super();
    this.shapes = [];
  }

  add(shape: Shape): Shape { this.shapes.push(shape); this.emit('change'); return shape; }
  remove(id: number): void { releaseId(id); this.shapes = this.shapes.filter(s => s.id !== id); this.emit('change'); }
  get(id: number): Shape | undefined { return this.shapes.find(s => s.id === id); }
  getAll(): Shape[] { return this.shapes; }
  getVisible(): Shape[] { return this.shapes.filter(s => s.visible); }
  getSelected(): Shape[] { return this.shapes.filter(s => s.selected); }

  select(id: number): void {
    this.shapes.forEach(s => (s.selected = s.id === id));
    this.emit('selection');
  }

  selectMany(ids: number[]): void {
    const set = new Set(ids);
    this.shapes.forEach(s => (s.selected = set.has(s.id)));
    this.emit('selection');
  }

  toggleSelect(id: number): void {
    const s = this.get(id);
    if (s) { s.selected = !s.selected; this.emit('selection'); }
  }

  deselectAll(): void {
    this.shapes.forEach(s => (s.selected = false));
    this.emit('selection');
  }

  toggleVisibility(id: number): void {
    const s = this.get(id);
    if (s) { s.visible = !s.visible; this.emit('change'); }
  }

  update(id: number, props: Partial<Shape>): void {
    const s = this.get(id);
    if (s) { Object.assign(s, props); this.emit('change'); }
  }

  /**
   * Reorder a shape within the list. `direction` is -1 (move up) or +1 (move down).
   * No-op if the shape is missing or already at the boundary.
   */
  move(id: number, direction: -1 | 1): void {
    const i = this.shapes.findIndex(s => s.id === id);
    if (i < 0) return;
    const j = i + direction;
    if (j < 0 || j >= this.shapes.length) return;
    const [s] = this.shapes.splice(i, 1);
    this.shapes.splice(j, 0, s);
    this.emit('change');
  }

  /**
   * Reorder shapes to match the given id sequence. Ids absent from the
   * current store are ignored; shapes absent from the sequence keep their
   * relative order at the end.
   */
  setOrder(ids: number[]): void {
    const byId = new Map(this.shapes.map(s => [s.id, s]));
    const next: Shape[] = [];
    for (const id of ids) {
      const s = byId.get(id);
      if (s) { next.push(s); byId.delete(id); }
    }
    for (const s of byId.values()) next.push(s);
    this.shapes = next;
    this.emit('change');
  }

  clear(): void {
    for (const s of this.shapes) releaseId(s.id);
    this.shapes = [];
    syncColorIndex(this.shapes);
    this.emit('change');
    this.emit('selection');
  }

  /** Deep-clone current state for undo/redo. */
  snapshot(): Shape[] { return JSON.parse(JSON.stringify(this.shapes)); }

  /** Restore from a snapshot (deep-cloned on restore too). */
  restore(snap: Shape[]): void {
    this.shapes = JSON.parse(JSON.stringify(snap));
    // Rebuild the global ID pool so freed IDs can be reused (e.g. after undo).
    syncNextId(this.shapes);
    // Resync colour rotation so newly created shapes pick the least-used hue.
    syncColorIndex(this.shapes);
    this.emit('change');
    this.emit('selection');
  }
}
