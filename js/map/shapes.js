/**
 * Shape factories, renderers, hit-testers, and utilities.
 * Shapes are plain objects — no classes — for trivial serialization.
 */
import {
  distance, midpoint, angleDeg,
  pointToSegmentDist, pointToLineDist,
  clipLineToRect,
  triangleArea, pointInTriangle,
} from '../utils/geometry.js';

/* ── ID & colour generators ───────────────────────────── */

const _usedIds = new Set();

function nextId() {
  let id = 1;
  while (_usedIds.has(id)) id++;
  _usedIds.add(id);
  return id;
}

/** Rebuild used-ID set from loaded shapes so new IDs fill gaps. */
export function syncNextId(shapes) {
  _usedIds.clear();
  for (const s of shapes) {
    if (typeof s.id === 'number') _usedIds.add(s.id);
  }
}

/** Free an ID for reuse (call when a shape is removed). */
export function releaseId(id) {
  _usedIds.delete(id);
}

const PALETTE = [
  '#e74c3c','#3498db','#2ecc71','#f39c12',
  '#9b59b6','#1abc9c','#e67e22','#e91e63',
];
let _ci = 0;
function nextColor() { return PALETTE[_ci++ % PALETTE.length]; }

/* ── Factories ────────────────────────────────────────── */

export function createPoint(x, y, opts = {}) {
  return { type: 'point', id: nextId(), x, y, label: opts.label ?? '', showLabel: opts.showLabel ?? true, color: opts.color ?? nextColor(), visible: true, selected: false };
}

export function createSegment(p1, p2, opts = {}) {
  return { type: 'segment', id: nextId(), p1: { ...p1 }, p2: { ...p2 }, label: opts.label ?? '', showLabel: opts.showLabel ?? true, color: opts.color ?? nextColor(), lineWidth: opts.lineWidth ?? 2, visible: true, selected: false };
}

export function createLine(p1, p2, opts = {}) {
  return { type: 'line', id: nextId(), p1: { ...p1 }, p2: { ...p2 }, label: opts.label ?? '', showLabel: opts.showLabel ?? true, color: opts.color ?? nextColor(), lineWidth: opts.lineWidth ?? 2, visible: true, selected: false };
}

export function createCircle(center, radius, opts = {}) {
  return { type: 'circle', id: nextId(), center: { ...center }, radius, label: opts.label ?? '', showLabel: opts.showLabel ?? true, color: opts.color ?? nextColor(), lineWidth: opts.lineWidth ?? 2, visible: true, selected: false };
}

export function generateConcentrics(srcCircle, step, count) {
  if (count <= 1) return [];
  const circles = [];
  for (let i = 1; i < count; i++) {
    circles.push(createCircle(srcCircle.center, srcCircle.radius + step * i, { color: srcCircle.color }));
  }
  return circles;
}

export function createTriangle(p1, p2, p3, opts = {}) {
  return { type: 'triangle', id: nextId(), p1: { ...p1 }, p2: { ...p2 }, p3: { ...p3 }, label: opts.label ?? '', showLabel: opts.showLabel ?? true, color: opts.color ?? nextColor(), lineWidth: opts.lineWidth ?? 2, visible: true, selected: false };
}

export function createAngle(p1, vertex, p2, opts = {}) {
  return { type: 'angle', id: nextId(), p1: { ...p1 }, vertex: { ...vertex }, p2: { ...p2 }, label: opts.label ?? '', showLabel: opts.showLabel ?? true, color: opts.color ?? nextColor(), visible: true, selected: false };
}

export function createMedian(vertex, mid, opts = {}) {
  return { type: 'median', id: nextId(), p1: { ...vertex }, p2: { ...mid }, parentId: opts.parentId ?? null, color: opts.color ?? '#f39c12', lineWidth: 1.5, visible: true, selected: false };
}

export function createBisector(lp1, lp2, mid, opts = {}) {
  return { type: 'bisector', id: nextId(), p1: { ...lp1 }, p2: { ...lp2 }, midpt: { ...mid }, parentId: opts.parentId ?? null, color: opts.color ?? '#1abc9c', lineWidth: 1.5, visible: true, selected: false };
}

/* ── Render helpers ───────────────────────────────────── */

function dot(ctx, sx, sy, r, color) {
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function selectionGlow(ctx, sx, sy, r) {
  ctx.beginPath();
  ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLabel(ctx, text, sx, sy, color, offsetX = 0, offsetY = -12) {
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const tx = sx + offsetX;
  const ty = sy + offsetY;
  const metrics = ctx.measureText(text);
  const pad = 3;
  const w = metrics.width + pad * 2;
  const h = 14 + pad;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(tx - w / 2, ty - h + 2, w, h);
  ctx.fillStyle = color;
  ctx.fillText(text, tx, ty);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/* ── Renderers ────────────────────────────────────────── */

const RENDERERS = {
  point(ctx, s, vp, m) {
    const p = vp.toScreen(s.x, s.y);
    if (s.selected) selectionGlow(ctx, p.x, p.y, 5);
    dot(ctx, p.x, p.y, 5, s.color);
    if (s.label && s.showLabel) drawLabel(ctx, s.label, p.x, p.y, s.color, 10, -10);
  },

  segment(ctx, s, vp, m) {
    const a = vp.toScreen(s.p1.x, s.p1.y);
    const b = vp.toScreen(s.p2.x, s.p2.y);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = s.selected ? '#ffffff' : s.color;
    ctx.lineWidth = s.selected ? 3 : s.lineWidth;
    ctx.stroke();
    dot(ctx, a.x, a.y, 3, s.color);
    dot(ctx, b.x, b.y, 3, s.color);
    // length label
    const len = distance(s.p1, s.p2);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = b.x - a.x, dy = b.y - a.y;
    const sl = Math.sqrt(dx * dx + dy * dy);
    if (sl > 40) {
      const nx = -dy / sl, ny = dx / sl;
      drawLabel(ctx, m.format(len), mid.x + nx * 14, mid.y + ny * 14 + 6, s.color);
    }
    if (s.label && s.showLabel) drawLabel(ctx, s.label, mid.x, mid.y, s.color, 0, -20);
  },

  line(ctx, s, vp, m) {
    const rect = vp.worldRect();
    const clipped = clipLineToRect(s.p1, s.p2, rect);
    if (!clipped) return;
    const a = vp.toScreen(clipped[0].x, clipped[0].y);
    const b = vp.toScreen(clipped[1].x, clipped[1].y);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = s.selected ? '#ffffff' : s.color;
    ctx.lineWidth = s.selected ? 3 : s.lineWidth;
    ctx.stroke();
    // reference points
    const r1 = vp.toScreen(s.p1.x, s.p1.y);
    const r2 = vp.toScreen(s.p2.x, s.p2.y);
    dot(ctx, r1.x, r1.y, 3, s.color);
    dot(ctx, r2.x, r2.y, 3, s.color);
    if (s.label && s.showLabel) {
      const mid = { x: (r1.x + r2.x) / 2, y: (r1.y + r2.y) / 2 };
      drawLabel(ctx, s.label, mid.x, mid.y, s.color, 0, -14);
    }
  },

  circle(ctx, s, vp, m) {
    const c = vp.toScreen(s.center.x, s.center.y);
    const r = s.radius * vp.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = s.selected ? '#ffffff' : s.color;
    ctx.lineWidth = s.selected ? 3 : s.lineWidth;
    ctx.stroke();
    dot(ctx, c.x, c.y, 3, s.color);
    if (r > 30) drawLabel(ctx, 'r=' + m.format(s.radius), c.x, c.y - r - 4, s.color);
    if (s.label && s.showLabel) drawLabel(ctx, s.label, c.x, c.y, s.color, 0, -14);
  },

  triangle(ctx, s, vp, m) {
    const a = vp.toScreen(s.p1.x, s.p1.y);
    const b = vp.toScreen(s.p2.x, s.p2.y);
    const c = vp.toScreen(s.p3.x, s.p3.y);
    // fill
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
    ctx.fillStyle = s.color + '18';
    ctx.fill();
    // stroke
    ctx.strokeStyle = s.selected ? '#ffffff' : s.color;
    ctx.lineWidth = s.selected ? 3 : s.lineWidth;
    ctx.stroke();
    // vertices
    dot(ctx, a.x, a.y, 3, s.color);
    dot(ctx, b.x, b.y, 3, s.color);
    dot(ctx, c.x, c.y, 3, s.color);
    // side lengths
    const sides = [[s.p1, s.p2, a, b], [s.p2, s.p3, b, c], [s.p3, s.p1, c, a]];
    for (const [w1, w2, sc1, sc2] of sides) {
      const len = distance(w1, w2);
      const mid = { x: (sc1.x + sc2.x) / 2, y: (sc1.y + sc2.y) / 2 };
      const dx = sc2.x - sc1.x, dy = sc2.y - sc1.y;
      const sl = Math.sqrt(dx * dx + dy * dy);
      if (sl > 50) {
        const nx = -dy / sl, ny = dx / sl;
        drawLabel(ctx, m.format(len), mid.x + nx * 14, mid.y + ny * 14 + 6, s.color);
      }
    }
    if (s.label && s.showLabel) {
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
      drawLabel(ctx, s.label, cx, cy, s.color, 0, -6);
    }
  },

  angle(ctx, s, vp, m) {
    const a = vp.toScreen(s.p1.x, s.p1.y);
    const v = vp.toScreen(s.vertex.x, s.vertex.y);
    const b = vp.toScreen(s.p2.x, s.p2.y);
    // rays
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(v.x, v.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = s.selected ? '#ffffff' : s.color;
    ctx.lineWidth = s.selected ? 3 : 2;
    ctx.stroke();
    dot(ctx, v.x, v.y, 4, s.color);
    dot(ctx, a.x, a.y, 3, s.color);
    dot(ctx, b.x, b.y, 3, s.color);
    // arc — always sweep the shorter angle
    const angA = Math.atan2(a.y - v.y, a.x - v.x);
    const angB = Math.atan2(b.y - v.y, b.x - v.x);
    const deg = angleDeg(s.p1, s.vertex, s.p2);
    const arcR = Math.min(30, Math.max(18, Math.min(distance(a, v), distance(b, v)) * 0.3));
    let sweep = angB - angA;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(v.x, v.y, arcR, angA, angB, sweep > 0);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // label — positioned at the arc midpoint
    const midAng = angA + sweep / 2;
    const lx = v.x + Math.cos(midAng) * (arcR + 14);
    const ly = v.y + Math.sin(midAng) * (arcR + 14);
    drawLabel(ctx, deg.toFixed(1) + '°', lx, ly + 5, s.color);
  },

  median(ctx, s, vp, m) {
    const a = vp.toScreen(s.p1.x, s.p1.y);
    const b = vp.toScreen(s.p2.x, s.p2.y);
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = s.selected ? '#ffffff' : s.color;
    ctx.lineWidth = s.selected ? 3 : s.lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
    dot(ctx, a.x, a.y, 3, s.color);
    dot(ctx, b.x, b.y, 3, s.color);
    const len = distance(s.p1, s.p2);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    drawLabel(ctx, m.format(len), mid.x, mid.y - 6, s.color);
  },

  bisector(ctx, s, vp, m) {
    const rect = vp.worldRect();
    const clipped = clipLineToRect(s.p1, s.p2, rect);
    if (!clipped) return;
    const a = vp.toScreen(clipped[0].x, clipped[0].y);
    const b = vp.toScreen(clipped[1].x, clipped[1].y);
    ctx.beginPath();
    ctx.setLineDash([8, 4]);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = s.selected ? '#ffffff' : s.color;
    ctx.lineWidth = s.selected ? 3 : s.lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
    // right-angle indicator at midpoint
    const mp = vp.toScreen(s.midpt.x, s.midpt.y);
    dot(ctx, mp.x, mp.y, 3, s.color);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const ux = dx / len, uy = dy / len;
      const sz = 8;
      ctx.beginPath();
      ctx.moveTo(mp.x + uy * sz, mp.y - ux * sz);
      ctx.lineTo(mp.x + uy * sz + ux * sz, mp.y - ux * sz + uy * sz);
      ctx.lineTo(mp.x + ux * sz, mp.y + uy * sz);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  },
};

/* ── Hit testers ──────────────────────────────────────── */

const HIT_TESTERS = {
  point:    (s, p, t) => distance({ x: s.x, y: s.y }, p) <= t,
  segment:  (s, p, t) => pointToSegmentDist(p, s.p1, s.p2) <= t,
  line:     (s, p, t) => pointToLineDist(p, s.p1, s.p2) <= t,
  circle:   (s, p, t) => Math.abs(distance(p, s.center) - s.radius) <= t,
  triangle: (s, p, t) => {
    if (pointInTriangle(p, s.p1, s.p2, s.p3)) return true;
    return pointToSegmentDist(p, s.p1, s.p2) <= t
        || pointToSegmentDist(p, s.p2, s.p3) <= t
        || pointToSegmentDist(p, s.p3, s.p1) <= t;
  },
  angle:    (s, p, t) => pointToSegmentDist(p, s.vertex, s.p1) <= t || pointToSegmentDist(p, s.vertex, s.p2) <= t,
  median:   (s, p, t) => pointToSegmentDist(p, s.p1, s.p2) <= t,
  bisector: (s, p, t) => pointToLineDist(p, s.p1, s.p2) <= t,
};

/* ── Move helpers ─────────────────────────────────────── */

export function moveShape(shape, dx, dy) {
  switch (shape.type) {
    case 'point':
      shape.x += dx; shape.y += dy; break;
    case 'segment': case 'line': case 'median':
      shape.p1.x += dx; shape.p1.y += dy;
      shape.p2.x += dx; shape.p2.y += dy; break;
    case 'bisector':
      shape.p1.x += dx; shape.p1.y += dy;
      shape.p2.x += dx; shape.p2.y += dy;
      shape.midpt.x += dx; shape.midpt.y += dy; break;
    case 'circle':
      shape.center.x += dx; shape.center.y += dy; break;
    case 'triangle':
      shape.p1.x += dx; shape.p1.y += dy;
      shape.p2.x += dx; shape.p2.y += dy;
      shape.p3.x += dx; shape.p3.y += dy; break;
    case 'angle':
      shape.p1.x += dx; shape.p1.y += dy;
      shape.vertex.x += dx; shape.vertex.y += dy;
      shape.p2.x += dx; shape.p2.y += dy; break;
  }
}

/* ── Measurement info ─────────────────────────────────── */

export function shapeInfo(shape, measurement) {
  const m = measurement;
  switch (shape.type) {
    case 'point':
      return `(${m.formatCoord(shape.x, shape.y)})<br>${m.formatGPS(shape.x, shape.y)}`;
    case 'segment':
    case 'median':
      return `Longueur: ${m.format(distance(shape.p1, shape.p2))}`;
    case 'line':
      return 'Droite infinie';
    case 'circle':
      return `Rayon: ${m.format(shape.radius)} · Ø ${m.format(shape.radius * 2)} · Périmètre: ${m.format(2 * Math.PI * shape.radius)} · Aire: ${m.formatArea(Math.PI * shape.radius * shape.radius)}`;
    case 'triangle': {
      const a = distance(shape.p1, shape.p2), b = distance(shape.p2, shape.p3), c = distance(shape.p3, shape.p1);
      const area = triangleArea(shape.p1, shape.p2, shape.p3);
      return `Côtés: ${m.format(a)}, ${m.format(b)}, ${m.format(c)} · Périmètre: ${m.format(a + b + c)} · Aire: ${m.formatArea(area)}`;
    }
    case 'angle':
      return `Angle: ${angleDeg(shape.p1, shape.vertex, shape.p2).toFixed(2)}°`;
    case 'bisector':
      return 'Médiatrice';
    default:
      return '';
  }
}

/* ── Type labels (French) ─────────────────────────────── */

export const TYPE_LABELS = {
  point: 'Point', segment: 'Segment', line: 'Droite', circle: 'Cercle',
  triangle: 'Triangle', angle: 'Angle', median: 'Médiane', bisector: 'Médiatrice',
};

/* ── Public API ───────────────────────────────────────── */

export function renderShape(ctx, shape, viewport, measurement, opts) {
  if (!shape.visible) return;
  if (opts?.labelVisibility && opts.labelVisibility[shape.type] === false) {
    const saved = shape.showLabel;
    shape.showLabel = false;
    RENDERERS[shape.type]?.(ctx, shape, viewport, measurement);
    shape.showLabel = saved;
  } else {
    RENDERERS[shape.type]?.(ctx, shape, viewport, measurement);
  }
}

export function hitTestShape(shape, worldPt, threshold) {
  if (!shape.visible) return false;
  return HIT_TESTERS[shape.type]?.(shape, worldPt, threshold) ?? false;
}
