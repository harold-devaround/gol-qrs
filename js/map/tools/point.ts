// @ts-nocheck
import { ToolBase } from './base.js';
import { createPoint } from '../shapes.js';

const ICON = `<svg viewBox="0 0 24 24" fill="currentColor">
  <circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
</svg>`;

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Pick the next free single-letter label (A-Z) by inspecting existing point
 * labels in the store. After Z, fall back to A1, B1, … so we never collide
 * with an existing label.
 */
function nextFreeLabel(store) {
  const used = new Set();
  for (const s of store.getAll()) {
    if (s.type === 'point' && typeof s.label === 'string' && s.label) used.add(s.label);
  }
  for (let suffix = 0; suffix < 100; suffix++) {
    const tag = suffix === 0 ? '' : String(suffix);
    for (const c of LABELS) {
      const candidate = c + tag;
      if (!used.has(candidate)) return candidate;
    }
  }
  return '';
}

export class PointTool extends ToolBase {
  constructor() {
    super('Point', ICON, 'p');
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    const pt = this.snap(wp);
    const label = nextFreeLabel(this.store);
    this.addShape(createPoint(pt.x, pt.y, { label }));
  }
}
