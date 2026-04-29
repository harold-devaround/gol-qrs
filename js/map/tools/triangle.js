import { ToolBase } from './base.js';
import { createTriangle } from '../shapes.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M12 3L3 21h18z"/>
</svg>`;

export class TriangleTool extends ToolBase {
  constructor() {
    super('Triangle', ICON, 't');
    this._pts = [];
    this._cursor = null;
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }
  cancel() { this._pts = []; this._cursor = null; this.dirty(); }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    const pt = this.snap(wp);
    this._pts.push(pt);
    if (this._pts.length === 3) {
      this.addShape(createTriangle(this._pts[0], this._pts[1], this._pts[2]));
      this._pts = [];
      this._cursor = null;
    }
    this.dirty();
  }

  onMouseMove(wp) {
    this._cursor = this.snap(wp);
    this.dirty();
  }

  renderPreview(ctx, vp) {
    if (this._pts.length === 0) return;
    const screenPts = this._pts.map(p => vp.toScreen(p.x, p.y));
    const cur = this._cursor ? vp.toScreen(this._cursor.x, this._cursor.y) : null;
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].x, screenPts[i].y);
    if (cur) ctx.lineTo(cur.x, cur.y);
    if (this._pts.length === 2 && cur) ctx.closePath();
    ctx.strokeStyle = 'rgba(241,196,15,0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    // dots
    for (const p of screenPts) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#f1c40f'; ctx.fill(); }
  }
}
