import { ToolBase } from './base.js';
import { createLine } from '../shapes.js';
import { clipLineToRect } from '../../utils/geometry.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="2" y1="22" x2="22" y2="2"/><polyline points="2,18 2,22 6,22"/><polyline points="18,2 22,2 22,6"/>
</svg>`;

export class LineTool extends ToolBase {
  constructor() {
    super('Droite', ICON, 'l');
    this._p1 = null;
    this._cursor = null;
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }
  cancel() { this._p1 = null; this._cursor = null; this.dirty(); }

  onMouseDown(wp, e) {
    const pt = this.snap(wp);
    if (!this._p1) {
      this._p1 = pt;
    } else {
      const end = this.angleSnap(this._p1, pt, e);
      this.addShape(createLine(this._p1, end));
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
    const rect = vp.worldRect();
    const clipped = clipLineToRect(this._p1, this._cursor, rect);
    if (!clipped) return;
    const a = vp.toScreen(clipped[0].x, clipped[0].y);
    const b = vp.toScreen(clipped[1].x, clipped[1].y);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(241,196,15,0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    const r1 = vp.toScreen(this._p1.x, this._p1.y);
    ctx.beginPath(); ctx.arc(r1.x, r1.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#f1c40f'; ctx.fill();
  }
}
