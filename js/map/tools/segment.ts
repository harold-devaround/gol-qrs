// @ts-nocheck
import { ToolBase } from './base.js';
import { createSegment } from '../shapes.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="19" cy="5" r="2" fill="currentColor"/>
</svg>`;

export class SegmentTool extends ToolBase {
  constructor() {
    super('Segment', ICON, 's');
    this._p1 = null;
    this._cursor = null;
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }

  cancel() { this._p1 = null; this._cursor = null; this.dirty(); }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    const pt = this.snap(wp);
    if (!this._p1) {
      this._p1 = pt;
      this._cursor = null;
    } else {
      const end = this.angleSnap(this._p1, pt, e);
      this.addShape(createSegment(this._p1, end));
      this._p1 = null;
      this._cursor = null;
    }
    this.dirty();
  }

  onMouseMove(wp, e) {
    let c = this.snap(wp);
    if (this._p1 && e?.ctrlKey) c = this.angleSnap(this._p1, c, e);
    this._cursor = c;
    this.dirty();
  }

  renderPreview(ctx, vp) {
    if (!this._p1 || !this._cursor) return;
    const a = vp.toScreen(this._p1.x, this._p1.y);
    const b = vp.toScreen(this._cursor.x, this._cursor.y);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(241,196,15,0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    // dots
    ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#f1c40f'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
  }
}
