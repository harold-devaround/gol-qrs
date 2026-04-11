import { ToolBase } from './base.js';
import { hitTestShape, moveShape } from '../shapes.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 3l7.07 16.97 2.51-6.39 6.39-2.51z"/><path d="M13 13l6 6"/>
</svg>`;

/**
 * Select / move / delete shapes.
 */
export class SelectTool extends ToolBase {
  constructor() {
    super('Sélection', ICON, 'v');
    this._dragging = false;
    this._dragStart = null;
    this._moved = false;
  }

  activate() { this.canvas.el.style.cursor = 'default'; }

  onMouseDown(wp, e) {
    const threshold = 8 / this.canvas.zoom;
    const shapes = this.store.getVisible();

    // Hit test top-to-bottom (last rendered = on top)
    let hit = null;
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (hitTestShape(shapes[i], wp, threshold)) { hit = shapes[i]; break; }
    }

    if (hit) {
      if (e.shiftKey) {
        this.store.toggleSelect(hit.id);
      } else {
        this.store.select(hit.id);
      }
      this._dragging = true;
      this._dragStart = { ...wp };
      this._moved = false;
    } else {
      this.store.deselectAll();
    }
    this.dirty();
  }

  onMouseMove(wp) {
    if (!this._dragging) return;
    const sel = this.store.getSelected();
    if (sel.length === 0) return;
    const dx = wp.x - this._dragStart.x;
    const dy = wp.y - this._dragStart.y;
    if (!this._moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      this._moved = true;
      this.history.save();
    }
    if (this._moved) {
      for (const s of sel) moveShape(s, dx, dy);
      this._dragStart = { ...wp };
      this.store.emit('change');
      this.dirty();
    }
  }

  onMouseUp() {
    this._dragging = false;
    this._dragStart = null;
    this._moved = false;
  }

  onKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const sel = this.store.getSelected();
      if (sel.length === 0) return;
      this.history.save();
      for (const s of sel) this.store.remove(s.id);
      this.dirty();
    }
    if (e.key === 'Escape') this.store.deselectAll();
  }

  cancel() {
    this._dragging = false;
  }
}
