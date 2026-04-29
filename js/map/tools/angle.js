import { ToolBase } from './base.js';
import { createAngle } from '../shapes.js';
import { angleDeg } from '../../utils/geometry.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M4 20h16"/><path d="M4 20L14 4"/><path d="M8 20a8 8 0 0 1 3.5-6.6"/>
</svg>`;

/**
 * Angle measurement tool.
 * Click 3 points: A, B (vertex), C → measures angle at B.
 */
export class AngleTool extends ToolBase {
  constructor() {
    super('Angle', ICON, 'a');
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
      this.addShape(createAngle(this._pts[0], this._pts[1], this._pts[2]));
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
    const spts = this._pts.map(p => vp.toScreen(p.x, p.y));
    const cur = this._cursor ? vp.toScreen(this._cursor.x, this._cursor.y) : null;

    // Draw existing rays
    ctx.strokeStyle = 'rgba(241,196,15,0.8)';
    ctx.lineWidth = 2.5;

    if (spts.length >= 1 && cur) {
      ctx.beginPath();
      ctx.moveTo(spts[0].x, spts[0].y);
      if (spts.length === 1) {
        ctx.lineTo(cur.x, cur.y);
      } else {
        ctx.lineTo(spts[1].x, spts[1].y);
        ctx.lineTo(cur.x, cur.y);
        // Preview angle value
        const deg = angleDeg(this._pts[0], this._pts[1], this._cursor);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#f1c40f';
        ctx.textAlign = 'center';
        ctx.fillText(deg.toFixed(1) + '°', spts[1].x + 20, spts[1].y - 20);
        ctx.textAlign = 'start';
      }
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const p of spts) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f1c40f'; ctx.fill();
    }
  }
}
