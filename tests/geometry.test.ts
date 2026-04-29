// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  distance, midpoint, signedAngle, angleBetween, angleDeg,
  pointToSegmentDist, pointToLineDist, projectOnLine,
  perpBisectorLine, clipLineToRect, lineLineIntersection,
  triangleArea, centroid, circumcenter,
  pointInTriangle, pointInCircle, getSnapPoints,
  parallelThrough, snapToAngle,
} from '../js/utils/geometry.ts';

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(0);
  });

  it('computes horizontal distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(5);
  });

  it('computes vertical distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 7 })).toBe(7);
  });

  it('computes diagonal (3-4-5 triangle)', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is symmetric', () => {
    const a = { x: 1, y: 2 }, b = { x: 4, y: 6 };
    expect(distance(a, b)).toBe(distance(b, a));
  });

  it('handles negative coordinates', () => {
    expect(distance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('midpoint', () => {
  it('returns exact center of two points', () => {
    const m = midpoint({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(m).toEqual({ x: 5, y: 5 });
  });

  it('handles negative coordinates', () => {
    const m = midpoint({ x: -4, y: -2 }, { x: 4, y: 2 });
    expect(m).toEqual({ x: 0, y: 0 });
  });

  it('returns same point when a === b', () => {
    const m = midpoint({ x: 7, y: 3 }, { x: 7, y: 3 });
    expect(m).toEqual({ x: 7, y: 3 });
  });
});

describe('angleBetween / angleDeg', () => {
  it('returns 90° for perpendicular rays', () => {
    const deg = angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(deg).toBeCloseTo(90, 5);
  });

  it('returns 180° for opposite rays', () => {
    const deg = angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(deg).toBeCloseTo(180, 5);
  });

  it('returns 0° for coincident rays', () => {
    const deg = angleDeg({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(deg).toBeCloseTo(0, 5);
  });

  it('returns 60° for equilateral triangle vertex', () => {
    const deg = angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0.5, y: Math.sqrt(3) / 2 });
    expect(deg).toBeCloseTo(60, 5);
  });

  it('returns 45° for diagonal', () => {
    const deg = angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(deg).toBeCloseTo(45, 5);
  });

  it('angleBetween returns radians in [0, π]', () => {
    const rad = angleBetween({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(rad).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('signedAngle', () => {
  it('returns positive for counter-clockwise rotation', () => {
    const a = signedAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(a).toBeCloseTo(Math.PI / 2, 5);
  });

  it('returns negative for clockwise rotation', () => {
    const a = signedAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(a).toBeCloseTo(-Math.PI / 2, 5);
  });
});

describe('pointToSegmentDist', () => {
  it('returns 0 for a point on the segment', () => {
    expect(pointToSegmentDist({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it('returns perpendicular distance for projection inside segment', () => {
    expect(pointToSegmentDist({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it('returns distance to nearest endpoint if projection is outside', () => {
    expect(pointToSegmentDist({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });

  it('handles zero-length segment (degenerates to point)', () => {
    expect(pointToSegmentDist({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('pointToLineDist', () => {
  it('returns perpendicular distance to infinite line', () => {
    expect(pointToLineDist({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it('works even when projection is outside segment endpoints', () => {
    expect(pointToLineDist({ x: -5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it('handles zero-length line (degenerates to point)', () => {
    expect(pointToLineDist({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('projectOnLine', () => {
  it('projects onto horizontal line', () => {
    const p = projectOnLine({ x: 5, y: 7 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(0);
  });

  it('projects onto vertical line', () => {
    const p = projectOnLine({ x: 7, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(5);
  });

  it('returns point on diagonal', () => {
    const p = projectOnLine({ x: 0, y: 2 }, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(1);
  });

  it('handles degenerate line (same points)', () => {
    const p = projectOnLine({ x: 5, y: 7 }, { x: 3, y: 3 }, { x: 3, y: 3 });
    expect(p).toEqual({ x: 3, y: 3 });
  });
});

describe('perpBisectorLine', () => {
  it('midpoint of bisector line lies at segment midpoint', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
    const { p1, p2 } = perpBisectorLine(a, b);
    const mid = midpoint(p1, p2);
    expect(mid.x).toBeCloseTo(5);
    expect(mid.y).toBeCloseTo(0);
  });

  it('bisector is perpendicular to original segment', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
    const { p1, p2 } = perpBisectorLine(a, b);
    // segment is horizontal → bisector should be vertical (dx ≈ 0)
    expect(p2.x - p1.x).toBeCloseTo(0);
  });

  it('points on the bisector are equidistant from both endpoints', () => {
    const a = { x: 2, y: 3 }, b = { x: 8, y: 7 };
    const { p1, p2 } = perpBisectorLine(a, b);
    expect(distance(p1, a)).toBeCloseTo(distance(p1, b));
    expect(distance(p2, a)).toBeCloseTo(distance(p2, b));
  });
});

describe('clipLineToRect', () => {
  const rect = { x: 0, y: 0, w: 100, h: 100 };

  it('clips horizontal line to rect bounds', () => {
    const result = clipLineToRect({ x: -50, y: 50 }, { x: 150, y: 50 }, rect);
    expect(result).not.toBeNull();
    expect(result[0].x).toBeCloseTo(0);
    expect(result[1].x).toBeCloseTo(100);
  });

  it('clips vertical line to rect bounds', () => {
    const result = clipLineToRect({ x: 50, y: -50 }, { x: 50, y: 150 }, rect);
    expect(result).not.toBeNull();
    expect(result[0].y).toBeCloseTo(0);
    expect(result[1].y).toBeCloseTo(100);
  });

  it('returns null when line is outside rect', () => {
    const result = clipLineToRect({ x: -50, y: -50 }, { x: -10, y: -10 }, rect);
    // The line through these two points extends infinitely, check direction
    // Actually (-50,-50) to (-10,-10) is y=x, which goes through (0,0) to (100,100)
    // so it DOES intersect the rect
    expect(result).not.toBeNull();
  });

  it('returns null for a line parallel and outside the rect', () => {
    // Horizontal line at y=-10, clearly outside
    const result = clipLineToRect({ x: 0, y: -10 }, { x: 100, y: -10 }, rect);
    expect(result).toBeNull();
  });
});

describe('lineLineIntersection', () => {
  it('finds intersection of perpendicular lines', () => {
    const p = lineLineIntersection({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 5, y: 0 }, { x: 5, y: 10 });
    expect(p).not.toBeNull();
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(5);
  });

  it('returns null for parallel lines', () => {
    const p = lineLineIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
    expect(p).toBeNull();
  });

  it('finds diagonal intersection', () => {
    // y=x and y=-x+10 → intersection at (5, 5)
    const p = lineLineIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(5);
  });
});

describe('triangleArea', () => {
  it('computes area of a right triangle', () => {
    expect(triangleArea({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 })).toBeCloseTo(6);
  });

  it('returns 0 for collinear points', () => {
    expect(triangleArea({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it('is invariant to vertex order', () => {
    const a = { x: 1, y: 1 }, b = { x: 5, y: 1 }, c = { x: 3, y: 4 };
    expect(triangleArea(a, b, c)).toBeCloseTo(triangleArea(c, a, b));
    expect(triangleArea(a, b, c)).toBeCloseTo(triangleArea(b, c, a));
  });
});

describe('centroid', () => {
  it('returns center of equilateral triangle', () => {
    const g = centroid({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 3 * Math.sqrt(3) });
    expect(g.x).toBeCloseTo(3);
    expect(g.y).toBeCloseTo(Math.sqrt(3));
  });

  it('returns arithmetic mean of coordinates', () => {
    const g = centroid({ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 });
    expect(g.x).toBeCloseTo(3);
    expect(g.y).toBeCloseTo(4);
  });
});

describe('circumcenter', () => {
  it('returns center of circumscribed circle of a right triangle', () => {
    // Right triangle at origin: hypotenuse midpoint = circumcenter
    const cc = circumcenter({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 });
    expect(cc).not.toBeNull();
    expect(cc.x).toBeCloseTo(2);
    expect(cc.y).toBeCloseTo(1.5);
  });

  it('returns null for collinear points', () => {
    const cc = circumcenter({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 });
    expect(cc).toBeNull();
  });

  it('is equidistant from all three vertices', () => {
    const a = { x: 1, y: 1 }, b = { x: 5, y: 1 }, c = { x: 3, y: 5 };
    const cc = circumcenter(a, b, c);
    expect(cc).not.toBeNull();
    const r1 = distance(cc, a);
    const r2 = distance(cc, b);
    const r3 = distance(cc, c);
    expect(r1).toBeCloseTo(r2, 5);
    expect(r2).toBeCloseTo(r3, 5);
  });
});

describe('pointInTriangle', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 }, c = { x: 5, y: 10 };

  it('returns true for centroid', () => {
    expect(pointInTriangle({ x: 5, y: 3 }, a, b, c)).toBe(true);
  });

  it('returns true for vertex', () => {
    expect(pointInTriangle({ x: 0, y: 0 }, a, b, c)).toBe(true);
  });

  it('returns false for clearly outside point', () => {
    expect(pointInTriangle({ x: -5, y: -5 }, a, b, c)).toBe(false);
  });

  it('returns true for point on edge', () => {
    expect(pointInTriangle({ x: 5, y: 0 }, a, b, c)).toBe(true);
  });
});

describe('pointInCircle', () => {
  it('returns true for center', () => {
    expect(pointInCircle({ x: 5, y: 5 }, { x: 5, y: 5 }, 3)).toBe(true);
  });

  it('returns true for point on boundary', () => {
    expect(pointInCircle({ x: 8, y: 5 }, { x: 5, y: 5 }, 3)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(pointInCircle({ x: 9, y: 5 }, { x: 5, y: 5 }, 3)).toBe(false);
  });
});

describe('getSnapPoints', () => {
  it('returns single point for point shape', () => {
    const pts = getSnapPoints({ type: 'point', x: 10, y: 20 });
    expect(pts).toEqual([{ x: 10, y: 20 }]);
  });

  it('returns endpoints + midpoint for segment', () => {
    const pts = getSnapPoints({ type: 'segment', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } });
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 10, y: 0 });
    expect(pts[2]).toEqual({ x: 5, y: 0 });
  });

  it('returns endpoints + midpoint for median', () => {
    const pts = getSnapPoints({ type: 'median', p1: { x: 0, y: 0 }, p2: { x: 6, y: 0 } });
    expect(pts).toHaveLength(3);
    expect(pts[2]).toEqual({ x: 3, y: 0 });
  });

  it('returns endpoints for line', () => {
    const pts = getSnapPoints({ type: 'line', p1: { x: 0, y: 0 }, p2: { x: 5, y: 5 } });
    expect(pts).toHaveLength(2);
  });

  it('returns endpoints for bisector', () => {
    const pts = getSnapPoints({ type: 'bisector', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } });
    expect(pts).toHaveLength(2);
  });

  it('returns center for circle', () => {
    const pts = getSnapPoints({ type: 'circle', center: { x: 50, y: 50 }, radius: 10 });
    expect(pts).toEqual([{ x: 50, y: 50 }]);
  });

  it('returns vertices + midpoints + centroid for triangle', () => {
    const pts = getSnapPoints({
      type: 'triangle',
      p1: { x: 0, y: 0 }, p2: { x: 6, y: 0 }, p3: { x: 3, y: 6 },
    });
    expect(pts).toHaveLength(7); // 3 vertices + 3 midpoints + 1 centroid
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 6, y: 0 });
    expect(pts[2]).toEqual({ x: 3, y: 6 });
  });

  it('returns vertex + ray endpoints for angle', () => {
    const pts = getSnapPoints({ type: 'angle', p1: { x: 1, y: 0 }, vertex: { x: 0, y: 0 }, p2: { x: 0, y: 1 } });
    expect(pts).toHaveLength(3);
    expect(pts[1]).toEqual({ x: 0, y: 0 }); // vertex
  });

  it('returns empty for unknown type', () => {
    expect(getSnapPoints({ type: 'unknown' })).toEqual([]);
  });
});

describe('parallelThrough', () => {
  it('returns a line through the point with same direction', () => {
    const { p1, p2 } = parallelThrough({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 });
    // Direction should be horizontal (same as original)
    expect(p2.y - p1.y).toBeCloseTo(0);
    // Must pass through the given point
    // p1 and p2 should share the same y as the through-point
    expect(p1.y).toBeCloseTo(5);
    expect(p2.y).toBeCloseTo(5);
  });

  it('preserves direction for a diagonal line', () => {
    const { p1, p2 } = parallelThrough({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 3, y: 0 });
    // Direction vector of result should be proportional to (1,1)
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    expect(dx).toBeCloseTo(dy);
  });

  it('passes through the given point', () => {
    const pt = { x: 7, y: 3 };
    const { p1, p2 } = parallelThrough({ x: 0, y: 0 }, { x: 4, y: 2 }, pt);
    // Point should lie on the returned line — check using cross product
    const cross = (p2.x - p1.x) * (pt.y - p1.y) - (p2.y - p1.y) * (pt.x - p1.x);
    expect(cross).toBeCloseTo(0);
  });
});

describe('snapToAngle', () => {
  it('snaps to 0° (horizontal right)', () => {
    const p = snapToAngle({ x: 0, y: 0 }, { x: 10, y: 2 }, 45);
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeGreaterThan(0);
  });

  it('snaps to 45°', () => {
    const p = snapToAngle({ x: 0, y: 0 }, { x: 10, y: 8 }, 45);
    expect(p.x).toBeCloseTo(p.y);
  });

  it('snaps to 90° (vertical down)', () => {
    const p = snapToAngle({ x: 0, y: 0 }, { x: 1, y: 10 }, 45);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeGreaterThan(0);
  });

  it('snaps to 180° (horizontal left)', () => {
    const p = snapToAngle({ x: 0, y: 0 }, { x: -10, y: 1 }, 45);
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeLessThan(0);
  });

  it('preserves distance from origin', () => {
    const origin = { x: 5, y: 5 };
    const cursor = { x: 15, y: 8 };
    const p = snapToAngle(origin, cursor, 45);
    const d1 = distance(origin, cursor);
    const d2 = distance(origin, p);
    expect(d2).toBeCloseTo(d1);
  });

  it('works with 30° step', () => {
    // cursor at ~20° from horizontal → should snap to either 0° or 30°
    const p = snapToAngle({ x: 0, y: 0 }, { x: 10, y: 3.6 }, 30);
    const ang = Math.atan2(p.y, p.x) * 180 / Math.PI;
    const remainder = ((ang % 30) + 30) % 30; // normalized to [0,30)
    expect(Math.min(remainder, 30 - remainder)).toBeCloseTo(0);
  });

  it('returns cursor when distance is zero', () => {
    const p = snapToAngle({ x: 5, y: 5 }, { x: 5, y: 5 }, 45);
    expect(p.x).toBe(5);
    expect(p.y).toBe(5);
  });
});
