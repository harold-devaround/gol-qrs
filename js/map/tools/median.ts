// @ts-nocheck
import { ToolBase } from './base.js';
import { createMedian, hitTestShape } from '../shapes.js';
import { midpoint } from '../../utils/geometry.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M12 3L3 21h18z"/><line x1="12" y1="3" x2="10.5" y2="21" stroke-dasharray="3 2"/>
</svg>`;

/**
 * Median tool:
 * - Click on an existing triangle → adds its 3 medians.
 * - Otherwise, click 3 points (vertex, then two endpoints of the opposite side)
 *   → draws the median from vertex to the midpoint of the side.
 */
export class MedianTool extends ToolBase {
  constructor() {
    super('Médiane', ICON, 'm');
    this._pts = [];
    this._cursor = null;
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }
  cancel() { this._pts = []; this._cursor = null; this.dirty(); }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    // Try to hit an existing triangle
    if (this._pts.length === 0) {
      const threshold = 8 / this.canvas.zoom;
      const triangles = this.store.getVisible().filter(s => s.type === 'triangle');
      for (let i = triangles.length - 1; i >= 0; i--) {
        if (hitTestShape(triangles[i], wp, threshold)) {
          this._addMediansForTriangle(triangles[i]);
          return;
        }
      }
    }

    // Manual mode: 3 clicks
    const pt = this.snap(wp);
    this._pts.push(pt);
    if (this._pts.length === 3) {
      const [vertex, a, b] = this._pts;
      const mid = midpoint(a, b);
      this.addShape(createMedian(vertex, mid));
      this._pts = [];
      this._cursor = null;
    }
    this.dirty();
  }

  onMouseMove(wp) {
    this._cursor = this.snap(wp);
    this.dirty();
  }

  _addMediansForTriangle(tri) {
    this.history.save();
    const { p1, p2, p3 } = tri;
    this.store.add(createMedian(p1, midpoint(p2, p3), { parentId: tri.id, color: '#f39c12' }));
    this.store.add(createMedian(p2, midpoint(p1, p3), { parentId: tri.id, color: '#f39c12' }));
    this.store.add(createMedian(p3, midpoint(p1, p2), { parentId: tri.id, color: '#f39c12' }));
    this.dirty();
  }

  renderPreview(ctx, vp) {
    if (this._pts.length === 0) return;
    const screenPts = this._pts.map(p => vp.toScreen(p.x, p.y));
    const cur = this._cursor ? vp.toScreen(this._cursor.x, this._cursor.y) : null;
    // Draw existing points
    for (const p of screenPts) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#f1c40f'; ctx.fill(); }
    // Preview line from vertex to midpoint of partial side
    if (this._pts.length === 2 && cur) {
      const mid = { x: (screenPts[1].x + cur.x) / 2, y: (screenPts[1].y + cur.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y); ctx.lineTo(mid.x, mid.y);
      ctx.strokeStyle = 'rgba(241,196,15,0.8)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      // show opposite side preview
      ctx.beginPath();
      ctx.moveTo(screenPts[1].x, screenPts[1].y); ctx.lineTo(cur.x, cur.y);
      ctx.strokeStyle = 'rgba(241,196,15,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
