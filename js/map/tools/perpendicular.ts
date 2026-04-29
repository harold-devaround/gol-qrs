// @ts-nocheck
import { ToolBase } from './base.js';
import { createSegment, hitTestShape } from '../shapes.js';
import { projectOnLine } from '../../utils/geometry.js';

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="2" y1="12" x2="22" y2="12"/>
  <line x1="12" y1="12" x2="12" y2="2"/>
  <rect x="12" y="8" width="4" height="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
</svg>`;

/**
 * Perpendicular segment tool:
 * 1. Click on an existing line or segment to pick the reference direction.
 * 2. Mouse moves → preview start point = projection of cursor onto ref.
 *    Click → confirm start.
 * 3. Mouse moves → preview end point = projection of cursor onto the
 *    perpendicular line through start. Click → create the segment.
 * Snap to existing points is supported in both phases 2 and 3.
 */
export class PerpendicularTool extends ToolBase {
  constructor() {
    super('Perpendiculaire', ICON, 'x');
    this._ref = null;         // reference shape (line or segment)
    this._start = null;       // confirmed start point (on ref)
    this._previewStart = null; // live preview of start (projection on ref)
    this._previewEnd = null;   // live preview of end (projection on perp)
  }

  activate() { this.canvas.el.style.cursor = 'crosshair'; }

  cancel() {
    this._ref = null;
    this._start = null;
    this._previewStart = null;
    this._previewEnd = null;
    this.dirty();
  }

  /** Return the perpendicular direction to the reference at the start point. */
  _perpDirection() {
    const dx = this._ref.p2.x - this._ref.p1.x;
    const dy = this._ref.p2.y - this._ref.p1.y;
    // Perpendicular direction: (-dy, dx)
    return { dx: -dy, dy: dx };
  }

  /** Project a point onto the reference line. */
  _projectOnRef(pt) {
    return projectOnLine(pt, this._ref.p1, this._ref.p2);
  }

  /** Project a point onto the perpendicular through _start. */
  _projectOnPerp(pt) {
    const { dx, dy } = this._perpDirection();
    const perpP2 = { x: this._start.x + dx, y: this._start.y + dy };
    return projectOnLine(pt, this._start, perpP2);
  }

  onMouseUp(wp, e, hasMoved) {
    if (hasMoved) return;
    if (!this._ref) {
      // Phase 1: pick a line or segment as reference
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
      // Phase 2: confirm start as projection of snapped cursor onto ref
      const snapped = this.snap(wp);
      this._start = this._projectOnRef(snapped);
      this._previewStart = null;
    } else {
      // Phase 3: confirm end, create segment
      const snapped = this.snap(wp);
      const end = this._projectOnPerp(snapped);
      this.addShape(createSegment(this._start, end));
      this._ref = null;
      this._start = null;
      this._previewStart = null;
      this._previewEnd = null;
    }
    this.dirty();
  }

  onMouseMove(wp) {
    if (!this._ref) return;
    const snapped = this.snap(wp);
    if (!this._start) {
      this._previewStart = this._projectOnRef(snapped);
    } else {
      this._previewEnd = this._projectOnPerp(snapped);
    }
    this.dirty();
  }

  renderPreview(ctx, vp) {
    if (!this._ref) return;

    // Highlight the reference
    const r1 = vp.toScreen(this._ref.p1.x, this._ref.p1.y);
    const r2 = vp.toScreen(this._ref.p2.x, this._ref.p2.y);
    ctx.beginPath();
    ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y);
    ctx.strokeStyle = 'rgba(241,196,15,0.9)';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([]);
    ctx.stroke();

    if (!this._start) {
      // Phase 2: show the projected start on the ref
      if (!this._previewStart) return;
      const ps = vp.toScreen(this._previewStart.x, this._previewStart.y);
      ctx.beginPath(); ctx.arc(ps.x, ps.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(241,196,15,0.9)'; ctx.fill();

      // Right-angle indicator at previewStart
      this._drawRightAngleMarker(ctx, vp, this._previewStart);
    } else {
      // Draw confirmed start dot
      const sa = vp.toScreen(this._start.x, this._start.y);
      ctx.beginPath(); ctx.arc(sa.x, sa.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f1c40f'; ctx.fill();

      // Right-angle marker at start
      this._drawRightAngleMarker(ctx, vp, this._start);

      // Phase 3: show the perpendicular segment preview
      if (!this._previewEnd) return;
      const sb = vp.toScreen(this._previewEnd.x, this._previewEnd.y);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
      ctx.strokeStyle = 'rgba(241,196,15,0.8)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(sb.x, sb.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f1c40f'; ctx.fill();
    }
  }

  /** Draw a small square right-angle marker at `pt` on the ref. */
  _drawRightAngleMarker(ctx, vp, pt) {
    const MARKER = 10; // px
    const dx = this._ref.p2.x - this._ref.p1.x;
    const dy = this._ref.p2.y - this._ref.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return;
    const ux = dx / len, uy = dy / len; // unit along ref
    const nx = -uy, ny = ux;            // unit along perp

    const origin = vp.toScreen(pt.x, pt.y);
    const px = origin.x + ux * MARKER;
    const py = origin.y + uy * MARKER;
    const qx = px + nx * MARKER;
    const qy = py + ny * MARKER;
    const rx = origin.x + nx * MARKER;
    const ry = origin.y + ny * MARKER;

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(qx, qy);
    ctx.lineTo(rx, ry);
    ctx.strokeStyle = 'rgba(241,196,15,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke();
  }
}
