import { ToolBase } from './base.js';
import { createSegment, hitTestShape } from '../shapes.js';
import { projectOnLine } from '../../utils/geometry.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="2" y1="6" x2="22" y2="6"/><line x1="2" y1="18" x2="22" y2="18"/>
  <circle cx="12" cy="18" r="2" fill="currentColor"/>
</svg>`;

/**
 * Parallel tool:
 * 1. Click on an existing line or segment to pick the direction.
 * 2. Click a start point on the parallel.
 * 3. Mouse moves → preview segment from start to orthogonal projection of cursor
 *    onto the parallel direction through start.
 * 4. Click → creates the segment.
 */
export class ParallelTool extends ToolBase {
  constructor() {
    super('Parallèle', ICON, 'h');
    this._ref = null;    // reference shape (line or segment)
    this._start = null;  // start point of the parallel segment
    this._cursor = null;
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }
  cancel() { this._ref = null; this._start = null; this._cursor = null; this.dirty(); }

  /** Project cursor onto the parallel line through _start. */
  _projectEnd(cursor) {
    const dx = this._ref.p2.x - this._ref.p1.x;
    const dy = this._ref.p2.y - this._ref.p1.y;
    const b = { x: this._start.x + dx, y: this._start.y + dy };
    return projectOnLine(cursor, this._start, b);
  }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    if (!this._ref) {
      // Step 1: pick a line or segment as direction reference
      const threshold = 8 / this.canvas.zoom;
      const shapes = this.store.getVisible();
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if ((s.type === 'line' || s.type === 'segment') && hitTestShape(s, wp, threshold)) {
          this._ref = s;
          this.dirty();
          return;
        }
      }
    } else if (!this._start) {
      // Step 2: pick the start point
      this._start = this.snap(wp);
    } else {
      // Step 3: validate end point (projection of cursor)
      const end = this._projectEnd(this.snap(wp));
      this.addShape(createSegment(this._start, end));
      this._ref = null;
      this._start = null;
      this._cursor = null;
    }
    this.dirty();
  }

  onMouseMove(wp) {
    this._cursor = this.snap(wp);
    this.dirty();
  }

  renderPreview(ctx, vp) {
    if (!this._ref) return;

    // Highlight the reference line/segment
    const r1 = vp.toScreen(this._ref.p1.x, this._ref.p1.y);
    const r2 = vp.toScreen(this._ref.p2.x, this._ref.p2.y);
    ctx.beginPath();
    ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y);
    ctx.strokeStyle = 'rgba(241,196,15,0.9)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    if (!this._start || !this._cursor) return;

    const end = this._projectEnd(this._cursor);

    // Preview the parallel segment
    const a = vp.toScreen(this._start.x, this._start.y);
    const b = vp.toScreen(end.x, end.y);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(241,196,15,0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Construction line: cursor → projected point (perpendicular guide)
    const cp = vp.toScreen(this._cursor.x, this._cursor.y);
    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(241,196,15,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dots: start + projected end
    ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f1c40f'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f1c40f'; ctx.fill();
  }
}
