// @ts-nocheck
import { ToolBase } from './base.js';
import { createPoint } from '../shapes.js';

const ICON = `<svg viewBox="0 0 24 24" fill="currentColor">
  <circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
</svg>`;

let _labelIdx = 0;
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class PointTool extends ToolBase {
  constructor() {
    super('Point', ICON, 'p');
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    const pt = this.snap(wp);
    const label = LABELS[_labelIdx++ % LABELS.length];
    this.addShape(createPoint(pt.x, pt.y, { label }));
  }
}
