// @ts-nocheck
/**
 * Abstract base for all drawing tools.
 */
import { snapToAngle } from '../../utils/geometry.js';

export class ToolBase {
  constructor(name, icon, shortcut) {
    this.name = name;
    this.icon = icon;       // SVG string
    this.shortcut = shortcut;
    this.ctx = null;         // set by ToolManager: { store, canvas, history, measurement }
  }

  /** Called when tool becomes active. */
  activate() {}
  /** Called when tool becomes inactive. */
  deactivate() { this.cancel(); }
  /** Cancel current in-progress operation. */
  cancel() {}

  // Override these in subclasses
  onMouseDown(_world, _e) {}
  onMouseMove(_world, _e) {}
  onMouseUp(_world, _e, _hasMoved) {}
  onKeyDown(e) { if (e.key === 'Escape') this.cancel(); }

  /** Render tool-specific preview (rubber-bands, etc.) in screen coords. */
  renderPreview(_ctx, _viewport) {}

  /* ── Convenience ───────────────────────────────────── */

  get store()       { return this.ctx.store; }
  get canvas()      { return this.ctx.canvas; }
  get history()     { return this.ctx.history; }
  get measurement() { return this.ctx.measurement; }

  /** World point with optional snap. */
  snap(worldPt) {
    return this.canvas.findSnap(worldPt, this.store.getVisible()) ?? worldPt;
  }

  /** Constrain cursor direction from origin to nearest angle step when Ctrl is held. */
  angleSnap(origin, cursor, e) {
    if (!e?.ctrlKey) return cursor;
    const step = this.ctx.angleSnapStep ?? 45;
    return snapToAngle(origin, cursor, step);
  }

  addShape(shape) {
    this.history.save();
    this.store.add(shape);
    this.canvas.requestRender();
  }

  dirty() { this.canvas.requestRender(); }
}
