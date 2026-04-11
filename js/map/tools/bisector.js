import { ToolBase } from './base.js';
import { createBisector, hitTestShape } from '../shapes.js';
import { midpoint, perpBisectorLine } from '../../utils/geometry.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="4" y1="20" x2="20" y2="4"/><line x1="7" y1="7" x2="17" y2="17" stroke-dasharray="3 2"/>
  <rect x="10" y="10" width="4" height="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
</svg>`;

/**
 * Perpendicular bisector (médiatrice) tool:
 * - Click on an existing segment → adds its perpendicular bisector.
 * - Click on an existing triangle → adds bisectors of all 3 sides.
 * - Otherwise, click 2 points → bisector of the implicit segment.
 */
export class BisectorTool extends ToolBase {
  constructor() {
    super('Médiatrice', ICON, 'b');
    this._pts = [];
    this._cursor = null;
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }
  cancel() { this._pts = []; this._cursor = null; this.dirty(); }

  onMouseDown(wp) {
    if (this._pts.length === 0) {
      const threshold = 8 / this.canvas.zoom;
      const shapes = this.store.getVisible();

      // Hit test triangles first
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.type === 'triangle' && hitTestShape(s, wp, threshold)) {
          this._addForTriangle(s);
          return;
        }
      }

      // Hit test segments
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.type === 'segment' && hitTestShape(s, wp, threshold)) {
          this._addForSegment(s.p1, s.p2, s.id);
          return;
        }
      }
    }

    // Manual: 2 clicks
    const pt = this.snap(wp);
    this._pts.push(pt);
    if (this._pts.length === 2) {
      this._addForSegment(this._pts[0], this._pts[1]);
      this._pts = [];
      this._cursor = null;
    }
    this.dirty();
  }

  onMouseMove(wp) {
    this._cursor = this.snap(wp);
    this.dirty();
  }

  _addForSegment(a, b, parentId = null) {
    const mid = midpoint(a, b);
    const { p1, p2 } = perpBisectorLine(a, b);
    this.addShape(createBisector(p1, p2, mid, { parentId }));
  }

  _addForTriangle(tri) {
    this.history.save();
    const sides = [[tri.p1, tri.p2], [tri.p2, tri.p3], [tri.p3, tri.p1]];
    for (const [a, b] of sides) {
      const mid = midpoint(a, b);
      const { p1, p2 } = perpBisectorLine(a, b);
      this.store.add(createBisector(p1, p2, mid, { parentId: tri.id, color: '#1abc9c' }));
    }
    this.dirty();
  }

  renderPreview(ctx, vp) {
    if (this._pts.length === 0 || !this._cursor) return;
    const a = vp.toScreen(this._pts[0].x, this._pts[0].y);
    const b = vp.toScreen(this._cursor.x, this._cursor.y);
    // Show the segment
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    // Show perpendicular bisector preview
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 5) {
      const nx = -dy / len, ny = dx / len;
      const ext = 2000;
      ctx.beginPath();
      ctx.moveTo(mid.x - nx * ext, mid.y - ny * ext);
      ctx.lineTo(mid.x + nx * ext, mid.y + ny * ext);
      ctx.strokeStyle = 'rgba(26,188,156,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }
}
