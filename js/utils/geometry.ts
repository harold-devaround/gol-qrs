// @ts-nocheck
/**
 * Core geometry math utilities.
 * All functions work with simple {x, y} point objects.
 */

export function distance(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Signed angle from ray(vertex→a) to ray(vertex→b), in radians (-π, π]. */
export function signedAngle(a, vertex, b) {
  const a1 = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const a2 = Math.atan2(b.y - vertex.y, b.x - vertex.x);
  let d = a2 - a1;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Unsigned angle at vertex, in radians [0, π]. */
export function angleBetween(a, vertex, b) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  return Math.atan2(Math.abs(cross), dot);
}

export function angleDeg(a, vertex, b) {
  return angleBetween(a, vertex, b) * 180 / Math.PI;
}

export function pointToSegmentDist(pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(pt, a);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq));
  return distance(pt, { x: a.x + t * dx, y: a.y + t * dy });
}

export function pointToLineDist(pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return distance(pt, a);
  return Math.abs((pt.x - a.x) * dy - (pt.y - a.y) * dx) / len;
}

export function projectOnLine(pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { ...a };
  const t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Returns {p1, p2} defining the perpendicular bisector line of segment [a, b]. */
export function perpBisectorLine(a, b) {
  const mid = midpoint(a, b);
  const dx = b.x - a.x, dy = b.y - a.y;
  return {
    p1: { x: mid.x - dy, y: mid.y + dx },
    p2: { x: mid.x + dy, y: mid.y - dx },
  };
}

/** Returns {p1, p2} defining a line through `pt` parallel to line (a,b). */
export function parallelThrough(a, b, pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return {
    p1: { x: pt.x - dx, y: pt.y - dy },
    p2: { x: pt.x + dx, y: pt.y + dy },
  };
}

/** Snap cursor direction from origin to the nearest multiple of stepDeg. */
export function snapToAngle(origin, cursor, stepDeg) {
  const dx = cursor.x - origin.x, dy = cursor.y - origin.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { ...cursor };
  const ang = Math.atan2(dy, dx);
  const step = stepDeg * Math.PI / 180;
  const snapped = Math.round(ang / step) * step;
  return {
    x: origin.x + Math.cos(snapped) * dist,
    y: origin.y + Math.sin(snapped) * dist,
  };
}

/** Liang-Barsky clipping of an infinite line (through lp1, lp2) to a rect. */
export function clipLineToRect(lp1, lp2, rect) {
  const dx = lp2.x - lp1.x, dy = lp2.y - lp1.y;
  const xmin = rect.x, xmax = rect.x + rect.w;
  const ymin = rect.y, ymax = rect.y + rect.h;
  const p = [-dx, dx, -dy, dy];
  const q = [lp1.x - xmin, xmax - lp1.x, lp1.y - ymin, ymax - lp1.y];
  let tMin = -1e12, tMax = 1e12;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) tMin = Math.max(tMin, t);
      else tMax = Math.min(tMax, t);
    }
  }
  if (tMin > tMax) return null;
  return [
    { x: lp1.x + tMin * dx, y: lp1.y + tMin * dy },
    { x: lp1.x + tMax * dx, y: lp1.y + tMax * dy },
  ];
}

export function lineLineIntersection(a1, a2, b1, b2) {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  return { x: a1.x + t * d1x, y: a1.y + t * d1y };
}

export function triangleArea(a, b, c) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

export function centroid(a, b, c) {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

export function circumcenter(a, b, c) {
  const D = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(D) < 1e-10) return null;
  const A = a.x * a.x + a.y * a.y;
  const B = b.x * b.x + b.y * b.y;
  const C = c.x * c.x + c.y * c.y;
  return {
    x: (A * (b.y - c.y) + B * (c.y - a.y) + C * (a.y - b.y)) / D,
    y: (A * (c.x - b.x) + B * (a.x - c.x) + C * (b.x - a.x)) / D,
  };
}

export function pointInTriangle(p, a, b, c) {
  const s = (a, b) => (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

export function pointInCircle(pt, center, radius) {
  return distance(pt, center) <= radius;
}

/** Snap candidates for known shapes. */
export function getSnapPoints(shape) {
  switch (shape.type) {
    case 'point':    return [{ x: shape.x, y: shape.y }];
    case 'segment':
    case 'median':   return [shape.p1, shape.p2, midpoint(shape.p1, shape.p2)];
    case 'line':
    case 'bisector': return [shape.p1, shape.p2];
    case 'circle':   return [shape.center];
    case 'triangle':
      return [shape.p1, shape.p2, shape.p3,
              midpoint(shape.p1, shape.p2), midpoint(shape.p2, shape.p3), midpoint(shape.p3, shape.p1),
              centroid(shape.p1, shape.p2, shape.p3)];
    case 'angle':    return [shape.p1, shape.vertex, shape.p2];
    default:         return [];
  }
}
