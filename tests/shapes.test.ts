// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  createPoint, createSegment, createLine, createCircle,
  createTriangle, createAngle, createMedian, createBisector,
  moveShape, shapeInfo, hitTestShape, renderShape, TYPE_LABELS,
  syncNextId, releaseId, generateConcentrics,
} from '../js/map/shapes.ts';
import { Measurement } from '../js/map/measurement.ts';

/* ── Factories ────────────────────────────────────────── */

describe('createPoint', () => {
  it('creates point with coordinates', () => {
    const p = createPoint(10, 20);
    expect(p.type).toBe('point');
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
    expect(p.visible).toBe(true);
    expect(p.selected).toBe(false);
  });

  it('accepts label option', () => {
    const p = createPoint(0, 0, { label: 'A' });
    expect(p.label).toBe('A');
  });

  it('has showLabel defaulting to true', () => {
    const p = createPoint(0, 0, { label: 'A' });
    expect(p.showLabel).toBe(true);
  });

  it('showLabel is true even with no explicit label', () => {
    const p = createPoint(0, 0);
    expect(p.showLabel).toBe(true);
  });

  it('has showGuides defaulting to false', () => {
    const p = createPoint(0, 0);
    expect(p.showGuides).toBe(false);
  });

  it('accepts showGuides option', () => {
    const p = createPoint(0, 0, { showGuides: true });
    expect(p.showGuides).toBe(true);
  });

  it('assigns unique ids', () => {
    const a = createPoint(0, 0);
    const b = createPoint(1, 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe('createSegment', () => {
  it('creates segment with two endpoints', () => {
    const s = createSegment({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(s.type).toBe('segment');
    expect(s.p1).toEqual({ x: 0, y: 0 });
    expect(s.p2).toEqual({ x: 10, y: 10 });
  });

  it('copies points (no aliasing)', () => {
    const p = { x: 1, y: 2 };
    const s = createSegment(p, { x: 3, y: 4 });
    p.x = 999;
    expect(s.p1.x).toBe(1);
  });

  it('has label and showLabel properties', () => {
    const s = createSegment({ x: 0, y: 0 }, { x: 1, y: 1 });
    expect(s.label).toBe('');
    expect(s.showLabel).toBe(true);
  });
});

describe('createLine', () => {
  it('creates line through two points', () => {
    const l = createLine({ x: 0, y: 0 }, { x: 5, y: 5 });
    expect(l.type).toBe('line');
    expect(l.p1).toEqual({ x: 0, y: 0 });
  });

  it('has label and showLabel properties', () => {
    const l = createLine({ x: 0, y: 0 }, { x: 1, y: 1 });
    expect(l.label).toBe('');
    expect(l.showLabel).toBe(true);
  });
});

describe('createCircle', () => {
  it('creates circle with center and radius', () => {
    const c = createCircle({ x: 100, y: 100 }, 50);
    expect(c.type).toBe('circle');
    expect(c.center).toEqual({ x: 100, y: 100 });
    expect(c.radius).toBe(50);
  });

  it('has label and showLabel properties', () => {
    const c = createCircle({ x: 0, y: 0 }, 10);
    expect(c.label).toBe('');
    expect(c.showLabel).toBe(true);
  });
});

describe('createTriangle', () => {
  it('creates triangle with three vertices', () => {
    const t = createTriangle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 });
    expect(t.type).toBe('triangle');
    expect(t.p1).toEqual({ x: 0, y: 0 });
    expect(t.p2).toEqual({ x: 10, y: 0 });
    expect(t.p3).toEqual({ x: 5, y: 10 });
  });

  it('has label and showLabel properties', () => {
    const t = createTriangle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 });
    expect(t.label).toBe('');
    expect(t.showLabel).toBe(true);
  });
});

describe('createAngle', () => {
  it('creates angle with vertex', () => {
    const a = createAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(a.type).toBe('angle');
    expect(a.vertex).toEqual({ x: 0, y: 0 });
  });

  it('has label and showLabel properties', () => {
    const a = createAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(a.label).toBe('');
    expect(a.showLabel).toBe(true);
  });
});

describe('createMedian', () => {
  it('creates median with parent reference', () => {
    const m = createMedian({ x: 0, y: 0 }, { x: 5, y: 5 }, { parentId: 42 });
    expect(m.type).toBe('median');
    expect(m.parentId).toBe(42);
  });
});

describe('createBisector', () => {
  it('creates bisector with midpoint', () => {
    const b = createBisector({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 5, y: 5 });
    expect(b.type).toBe('bisector');
    expect(b.midpt).toEqual({ x: 5, y: 5 });
  });
});

/* ── moveShape ────────────────────────────────────────── */

describe('moveShape', () => {
  it('moves a point', () => {
    const p = createPoint(10, 20);
    moveShape(p, 5, -3);
    expect(p.x).toBe(15);
    expect(p.y).toBe(17);
  });

  it('moves a segment (both endpoints)', () => {
    const s = createSegment({ x: 0, y: 0 }, { x: 10, y: 10 });
    moveShape(s, 5, 5);
    expect(s.p1).toEqual({ x: 5, y: 5 });
    expect(s.p2).toEqual({ x: 15, y: 15 });
  });

  it('moves a circle center', () => {
    const c = createCircle({ x: 50, y: 50 }, 10);
    moveShape(c, -10, 20);
    expect(c.center).toEqual({ x: 40, y: 70 });
  });

  it('moves a triangle (all vertices)', () => {
    const t = createTriangle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 });
    moveShape(t, 1, 1);
    expect(t.p1).toEqual({ x: 1, y: 1 });
    expect(t.p2).toEqual({ x: 11, y: 1 });
    expect(t.p3).toEqual({ x: 6, y: 11 });
  });

  it('moves an angle (vertex + rays)', () => {
    const a = createAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    moveShape(a, 10, 10);
    expect(a.vertex).toEqual({ x: 10, y: 10 });
    expect(a.p1).toEqual({ x: 11, y: 10 });
    expect(a.p2).toEqual({ x: 10, y: 11 });
  });

  it('moves a bisector (p1, p2, midpt)', () => {
    const b = createBisector({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 5, y: 5 });
    moveShape(b, 2, 3);
    expect(b.p1).toEqual({ x: 2, y: 8 });
    expect(b.p2).toEqual({ x: 12, y: 8 });
    expect(b.midpt).toEqual({ x: 7, y: 8 });
  });
});

/* ── hitTestShape ─────────────────────────────────────── */

describe('hitTestShape', () => {
  it('hits a point within threshold', () => {
    const p = createPoint(10, 10);
    expect(hitTestShape(p, { x: 12, y: 10 }, 5)).toBe(true);
  });

  it('misses a point outside threshold', () => {
    const p = createPoint(10, 10);
    expect(hitTestShape(p, { x: 100, y: 100 }, 5)).toBe(false);
  });

  it('returns false for invisible shapes', () => {
    const p = createPoint(10, 10);
    p.visible = false;
    expect(hitTestShape(p, { x: 10, y: 10 }, 5)).toBe(false);
  });

  it('hits a segment near its line', () => {
    const s = createSegment({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(hitTestShape(s, { x: 50, y: 2 }, 5)).toBe(true);
  });

  it('misses a segment far from line', () => {
    const s = createSegment({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(hitTestShape(s, { x: 50, y: 20 }, 5)).toBe(false);
  });

  it('hits a circle near its circumference', () => {
    const c = createCircle({ x: 50, y: 50 }, 30);
    expect(hitTestShape(c, { x: 80, y: 50 }, 5)).toBe(true);
  });

  it('misses a circle far from circumference', () => {
    const c = createCircle({ x: 50, y: 50 }, 30);
    expect(hitTestShape(c, { x: 50, y: 50 }, 5)).toBe(false); // center, far from edge
  });

  it('hits a triangle inside', () => {
    const t = createTriangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
    expect(hitTestShape(t, { x: 50, y: 30 }, 5)).toBe(true);
  });

  it('hits a triangle near edge', () => {
    const t = createTriangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
    expect(hitTestShape(t, { x: 50, y: -2 }, 5)).toBe(true);
  });
});

/* ── shapeInfo ────────────────────────────────────────── */

describe('shapeInfo', () => {
  const m = new Measurement();

  it('formats point as coordinates', () => {
    const p = createPoint(100, 200);
    const info = shapeInfo(p, m);
    expect(info).toContain('100');
    expect(info).toContain('200');
  });

  it('formats segment length', () => {
    const s = createSegment({ x: 0, y: 0 }, { x: 100, y: 0 });
    const info = shapeInfo(s, m);
    expect(info).toContain('Longueur');
    expect(info).toContain('100');
  });

  it('formats circle with radius and area', () => {
    const c = createCircle({ x: 0, y: 0 }, 50);
    const info = shapeInfo(c, m);
    expect(info).toContain('Rayon');
    expect(info).toContain('Aire');
    expect(info).toContain('px²');
  });

  it('formats triangle with sides and area', () => {
    const t = createTriangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 });
    const info = shapeInfo(t, m);
    expect(info).toContain('Côtés');
    expect(info).toContain('Aire');
    expect(info).toContain('px²');
  });

  it('formats angle in degrees', () => {
    const a = createAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    const info = shapeInfo(a, m);
    expect(info).toContain('90');
    expect(info).toContain('°');
  });

  it('formats bisector label', () => {
    const b = createBisector({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 });
    expect(shapeInfo(b, m)).toBe('Médiatrice');
  });

  it('formats line label', () => {
    const l = createLine({ x: 0, y: 0 }, { x: 5, y: 5 });
    expect(shapeInfo(l, m)).toBe('Droite infinie');
  });

  it('uses cm² for area in cm mode', () => {
    const mc = new Measurement();
    mc.calibrate(100, 10); // 10 px/cm
    mc.toggleMode();
    const c = createCircle({ x: 0, y: 0 }, 100);
    const info = shapeInfo(c, mc);
    expect(info).toContain('cm²');
  });
});

/* ── TYPE_LABELS ──────────────────────────────────────── */

describe('TYPE_LABELS', () => {
  it('has labels for all shape types', () => {
    expect(TYPE_LABELS.point).toBe('Point');
    expect(TYPE_LABELS.segment).toBe('Segment');
    expect(TYPE_LABELS.line).toBe('Droite');
    expect(TYPE_LABELS.circle).toBe('Cercle');
    expect(TYPE_LABELS.triangle).toBe('Triangle');
    expect(TYPE_LABELS.angle).toBe('Angle');
    expect(TYPE_LABELS.median).toBe('Médiane');
    expect(TYPE_LABELS.bisector).toBe('Médiatrice');
  });
});

/* ── renderShape ──────────────────────────────────────── */

describe('renderShape', () => {
  it('does not render invisible shapes', () => {
    const p = createPoint(10, 10);
    p.visible = false;
    // If it tried to render, it would throw because ctx is null
    expect(() => renderShape(null, p, {}, {})).not.toThrow();
  });

  it('renders guide lines with lat/lon labels when showGuides is true', () => {
    syncNextId([]);
    const m = new Measurement();
    const p = createPoint(2222, 1726, { showGuides: true, color: '#ff0000' });
    const texts = [];
    const ctx = {
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {},
      fill: () => {}, stroke: () => {}, fillRect: () => {},
      strokeStyle: '', fillStyle: '', lineWidth: 1,
      setLineDash: () => {},
      font: '', textAlign: '', textBaseline: '',
      save: () => {}, restore: () => {},
      measureText: () => ({ width: 40 }),
      fillText: (text) => texts.push(String(text)),
    };
    const vp = {
      toScreen: (wx, wy) => ({ x: wx * 0.1, y: wy * 0.1 }),
      worldRect: () => ({ x: 0, y: 0, w: 8000, h: 6000 }),
      zoom: 0.1,
    };
    renderShape(ctx, p, vp, m);
    expect(texts.some(t => t.includes('lat:'))).toBe(true);
    expect(texts.some(t => t.includes('lon:'))).toBe(true);
  });

  it('does not add lat/lon labels when showGuides is false', () => {
    syncNextId([]);
    const m = new Measurement();
    const p = createPoint(2222, 1726, { showGuides: false, color: '#ff0000' });
    const texts = [];
    const ctx = {
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {},
      fill: () => {}, stroke: () => {}, fillRect: () => {},
      strokeStyle: '', fillStyle: '', lineWidth: 1,
      setLineDash: () => {},
      font: '', textAlign: '', textBaseline: '',
      save: () => {}, restore: () => {},
      measureText: () => ({ width: 40 }),
      fillText: (text) => texts.push(String(text)),
    };
    const vp = {
      toScreen: (wx, wy) => ({ x: wx * 0.1, y: wy * 0.1 }),
      worldRect: () => ({ x: 0, y: 0, w: 8000, h: 6000 }),
      zoom: 0.1,
    };
    renderShape(ctx, p, vp, m);
    expect(texts.some(t => t.includes('lat:'))).toBe(false);
    expect(texts.some(t => t.includes('lon:'))).toBe(false);
  });
});

/* ── syncNextId ───────────────────────────────────────── */

describe('syncNextId', () => {
  it('assigns the first unused id (not colliding with existing)', () => {
    syncNextId([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const p = createPoint(0, 0);
    expect(p.id).toBe(4);
  });

  it('handles empty array', () => {
    syncNextId([]);
    const p = createPoint(0, 0);
    expect(p.id).toBeGreaterThan(0);
  });

  it('handles non-numeric ids gracefully', () => {
    syncNextId([{ id: 'abc' }, { id: 5 }]);
    const p = createPoint(0, 0);
    // 'abc' is ignored, ids 1-4 are free, so next is 1
    expect(p.id).toBe(1);
  });

  it('fills gaps after syncNextId', () => {
    // Shapes 1, 3 exist → next id should be 2 (the gap)
    syncNextId([{ id: 1 }, { id: 3 }]);
    const p = createPoint(0, 0);
    expect(p.id).toBe(2);
  });
});

/* ── releaseId ────────────────────────────────────────── */

describe('releaseId', () => {
  it('recycles a released id', () => {
    syncNextId([]);
    const p1 = createPoint(0, 0);
    const p2 = createPoint(1, 1);
    const p3 = createPoint(2, 2);
    const id2 = p2.id;
    releaseId(id2);
    const p4 = createPoint(3, 3);
    expect(p4.id).toBe(id2);
  });

  it('recycles the lowest released id first', () => {
    syncNextId([]);
    const a = createPoint(0, 0);
    const b = createPoint(1, 1);
    const c = createPoint(2, 2);
    releaseId(c.id);
    releaseId(a.id);
    // Should reuse 'a' id first (lower)
    const d = createPoint(3, 3);
    expect(d.id).toBe(a.id);
    const e = createPoint(4, 4);
    expect(e.id).toBe(c.id);
  });

  it('releasing a non-existent id is a no-op', () => {
    syncNextId([]);
    releaseId(9999);
    const p = createPoint(0, 0);
    expect(p.id).toBeGreaterThan(0);
  });
});

/* ── generateConcentrics ──────────────────────────────── */

describe('generateConcentrics', () => {
  it('returns empty array when count <= 1', () => {
    const c = createCircle({ x: 10, y: 20 }, 50);
    expect(generateConcentrics(c, 50, 1)).toEqual([]);
    expect(generateConcentrics(c, 50, 0)).toEqual([]);
  });

  it('generates 1 concentric circle with default step = radius', () => {
    const c = createCircle({ x: 10, y: 20 }, 50);
    const result = generateConcentrics(c, 50, 2);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('circle');
    expect(result[0].center).toEqual({ x: 10, y: 20 });
    expect(result[0].radius).toBe(100);
  });

  it('generates multiple concentric circles with correct radii', () => {
    const c = createCircle({ x: 5, y: 5 }, 30);
    const result = generateConcentrics(c, 30, 4);
    expect(result).toHaveLength(3);
    expect(result[0].radius).toBe(60);
    expect(result[1].radius).toBe(90);
    expect(result[2].radius).toBe(120);
  });

  it('uses custom step for radius increment', () => {
    const c = createCircle({ x: 0, y: 0 }, 40);
    const result = generateConcentrics(c, 20, 3);
    expect(result).toHaveLength(2);
    expect(result[0].radius).toBe(60);
    expect(result[1].radius).toBe(80);
  });

  it('preserves same center for all generated circles', () => {
    const c = createCircle({ x: 100, y: 200 }, 25);
    const result = generateConcentrics(c, 25, 3);
    for (const circle of result) {
      expect(circle.center).toEqual({ x: 100, y: 200 });
    }
  });

  it('inherits color from source circle', () => {
    const c = createCircle({ x: 0, y: 0 }, 10, { color: '#ff0000' });
    const result = generateConcentrics(c, 10, 2);
    expect(result[0].color).toBe('#ff0000');
  });

  it('each generated circle has a unique id', () => {
    syncNextId([]);
    const c = createCircle({ x: 0, y: 0 }, 10);
    const result = generateConcentrics(c, 10, 4);
    const ids = [c.id, ...result.map(r => r.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
