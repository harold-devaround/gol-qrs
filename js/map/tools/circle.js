import { ToolBase } from './base.js';
import { createCircle } from '../shapes.js';
import { distance } from '../../utils/geometry.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
</svg>`;

export class CircleTool extends ToolBase {
  constructor() {
    super('Cercle', ICON, 'c');
    this._center = null;
    this._cursor = null;
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }
  cancel() { this._center = null; this._cursor = null; this.dirty(); }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    const pt = this.snap(wp);
    if (!this._center) {
      this._center = pt;
    } else {
      const r = distance(this._center, pt);
      if (r > 1) this.addShape(createCircle(this._center, r));
      this._center = null;
      this._cursor = null;
    }
    this.dirty();
  }

  onMouseMove(wp) {
    this._cursor = this.snap(wp);
    this.dirty();
  }

  renderPreview(ctx, vp) {
    if (!this._center || !this._cursor) return;
    const c = vp.toScreen(this._center.x, this._center.y);
    const r = distance(this._center, this._cursor) * vp.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(241,196,15,0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#f1c40f'; ctx.fill();
    // radius line
    const e = vp.toScreen(this._cursor.x, this._cursor.y);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(e.x, e.y);
    ctx.strokeStyle = 'rgba(241,196,15,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}
