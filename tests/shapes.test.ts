// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  createPoint, createSegment, createLine, createCircle,
  createTriangle, createAngle, createMedian, createBisector,
  moveShape, shapeInfo, hitTestShape, renderShape, TYPE_LABELS,
  syncNextId, releaseId, generateConcentrics, syncColorIndex,
  DIAL_PRESETS, dialLabelStep, normalizeDial, dialScreenRadius,
} from '../js/map/shapes.js';
import { Measurement } from '../js/map/measurement.js';

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

  it('shows the map-wide dial by default (hideDial false)', () => {
    expect(createPoint(0, 0).hideDial).toBe(false);
    expect(createPoint(0, 0, { hideDial: true }).hideDial).toBe(true);
  });

  it('no longer carries a compass rose or per-point dial settings', () => {
    const p = createPoint(0, 0);
    for (const k of ['showCompass', 'showDial', 'dialDivisions', 'dialCentered', 'dialLabels', 'dialOffset']) {
      expect(p).not.toHaveProperty(k);
    }
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

  it('omits lat/lon labels when the active map has no GPS calibration', () => {
    syncNextId([]);
    const m = new Measurement();
    m.setGPSAvailable(false);
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
    expect(texts.some(t => t.includes('lat:'))).toBe(false);
    expect(texts.some(t => t.includes('lon:'))).toBe(false);
  });

  function compassCtx(texts, arcs) {
    return {
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      arc: (x, y, r, a0, a1) => arcs.push({ x, y, r, a0, a1 }),
      fill: () => {}, stroke: () => {}, fillRect: () => {},
      strokeStyle: '', fillStyle: '', lineWidth: 1,
      setLineDash: () => {},
      font: '', textAlign: '', textBaseline: '',
      save: () => {}, restore: () => {},
      measureText: () => ({ width: 20 }),
      fillText: (text) => texts.push(String(text)),
    };
  }

  const compassVp = {
    toScreen: (wx, wy) => ({ x: wx * 0.1, y: wy * 0.1 }),
    worldRect: () => ({ x: 0, y: 0, w: 8000, h: 6000 }),
    zoom: 0.1,
  };

  // Collect the dial's radial lines (endpoints on the circle) as bearings from north, in degrees.
  function dialBearings(dial, pointOpts = {}) {
    syncNextId([]);
    const texts = [], arcs = [], lines = [];
    const labels = [];
    const ctx = compassCtx(texts, arcs);
    ctx.lineTo = (x, y) => lines.push({ x, y });
    ctx.fillText = (text, x, y) => { texts.push(String(text)); labels.push({ text: String(text), x, y }); };
    const point = createPoint(1000, 1000, { color: '#ff0000', ...pointOpts });
    renderShape(ctx, point, compassVp, new Measurement(), dial === undefined ? undefined : { dial });
    const cx = 100, cy = 100, R = 90; // point centre in screen coords (vp scale 0.1)
    const bearings = lines
      .filter(l => Math.abs(Math.hypot(l.x - cx, l.y - cy) - R) < 1e-6)
      .map(l => ((Math.atan2(l.x - cx, cy - l.y) * 180 / Math.PI) + 360) % 360);
    // drawLabel draws at (x, y + 5): undo that to get the label's bearing from north
    const labelBearing = (t) => {
      const l = labels.find(l => l.text === t);
      return ((Math.atan2(l.x - cx, cy - (l.y - 5)) * 180 / Math.PI) + 360) % 360;
    };
    const radii = [...new Set(lines.map(l => Math.round(Math.hypot(l.x - cx, l.y - cy) * 1000) / 1000))];
    return { bearings, texts, lines, labelBearing, radii };
  }
  const onGrid = (deg, step, offset) => {
    const r = (((deg - offset) % step) + step) % step;
    return Math.min(r, step - r) < 1e-6;
  };

  it('draws 80 divisions of 4.5° starting at north, numbered by tens', () => {
    const { bearings, texts } = dialBearings({ show: true });
    expect(bearings).toHaveLength(80);
    for (const b of bearings) expect(onGrid(b, 4.5, 0)).toBe(true);
    expect(bearings.some(b => Math.min(b, 360 - b) < 1e-6)).toBe(true); // a boundary due north
    for (const n of ['0', '10', '20', '30', '40', '50', '60', '70']) expect(texts).toContain(n);
    expect(texts).not.toContain('80');
  });

  it.each(DIAL_PRESETS)('draws the %i-division preset', (n) => {
    const { bearings, texts } = dialBearings({ show: true, divisions: n });
    expect(bearings).toHaveLength(n);
    for (const b of bearings) expect(onGrid(b, 360 / n, 0)).toBe(true);
    const step = dialLabelStep(n);
    expect(texts).toContain('0');
    expect(texts).toContain(String(step * Math.floor((n - 1) / step)));
    expect(texts).not.toContain(String(n));
  });

  it('draws a manually entered division count', () => {
    const { bearings } = dialBearings({ show: true, divisions: 12 });
    expect(bearings).toHaveLength(12);
    for (const b of bearings) expect(onGrid(b, 30, 0)).toBe(true);
  });

  it('centres division 0 on north, shifting every boundary by half a division', () => {
    const { bearings } = dialBearings({ show: true, divisions: 8, centered: true });
    expect(bearings).toHaveLength(8);
    for (const b of bearings) expect(onGrid(b, 45, 22.5)).toBe(true);
    expect(bearings.some(b => Math.min(b, 360 - b) < 1e-6)).toBe(false); // no boundary due north
  });

  it('numbers sectors from 1 when asked', () => {
    const { texts } = dialBearings({ show: true, divisions: 8, labels: 'num1' });
    for (const n of ['1', '2', '3', '4', '5', '6', '7', '8']) expect(texts).toContain(n);
    expect(texts).not.toContain('0');
  });

  it('numbers from 1 show 1, 10, 20… when only some sectors are labelled', () => {
    const { texts } = dialBearings({ show: true, divisions: 80, labels: 'num1' });
    for (const n of ['1', '10', '20', '70', '80']) expect(texts).toContain(n);
    expect(texts).not.toContain('11');
  });

  it('loops the alphabet A–Z around the dial', () => {
    const { texts } = dialBearings({ show: true, divisions: 36, labels: 'alpha' });
    expect(texts.filter(t => t === 'A')).toHaveLength(2); // sector 0 and sector 26
    expect(texts.filter(t => t === 'J')).toHaveLength(2); // sectors 9 and 35
    expect(texts.filter(t => t === 'K')).toHaveLength(1);
    expect(texts).not.toContain('0');
  });

  it('loops A–Z then 0–9 around the dial', () => {
    const { texts } = dialBearings({ show: true, divisions: 36, labels: 'alnum' });
    expect(texts).toHaveLength(36);
    for (const t of ['A', 'Z', '0', '9']) expect(texts.filter(x => x === t)).toHaveLength(1);
  });

  it('labels every letter up to 40 sectors, every other one beyond', () => {
    expect(dialLabelStep(26, 'alpha')).toBe(1);
    expect(dialLabelStep(36, 'alnum')).toBe(1);
    expect(dialLabelStep(80, 'alpha')).toBe(2);
    expect(dialLabelStep(36, 'num0')).toBe(5);
  });

  it('offsets the first sector clockwise from north', () => {
    // 8 sectors, a boundary on north: sector g spans [45g, 45g+45]°, label at its middle
    const plain = dialBearings({ show: true, divisions: 8, labels: 'alpha' });
    expect(plain.labelBearing('A')).toBeCloseTo(22.5, 6);
    const shifted = dialBearings({ show: true, divisions: 8, labels: 'alpha', offset: 2 });
    expect(shifted.labelBearing('A')).toBeCloseTo(112.5, 6);
    expect(shifted.labelBearing('G')).toBeCloseTo(22.5, 6); // index 6 lands on the northern sector
    // The geometry does not move
    expect(shifted.bearings.sort((a, b) => a - b)).toEqual(plain.bearings.sort((a, b) => a - b));
  });

  it('combines the offset with a sector centred on north', () => {
    const { labelBearing } = dialBearings({ show: true, divisions: 4, centered: true, labels: 'num1', offset: 1 });
    expect(labelBearing('1')).toBeCloseTo(90, 6);
    expect(labelBearing('4')).toBeCloseTo(0, 6);
  });

  it('normalizes dial settings: defaults, clamped count, offset modulo count, unknown label mode', () => {
    expect(normalizeDial()).toEqual({ show: false, divisions: 80, centered: false, labels: 'num0', offset: 0, size: 'screen', radius: 90, mapRadius: 400 });
    expect(normalizeDial({ divisions: 1 }).divisions).toBe(2);
    expect(normalizeDial({ divisions: 9999 }).divisions).toBe(360);
    expect(normalizeDial({ divisions: '12.6' }).divisions).toBe(13);
    expect(normalizeDial({ divisions: 8, offset: -1 }).offset).toBe(7);
    expect(normalizeDial({ divisions: 8, offset: 17 }).offset).toBe(1);
    expect(normalizeDial({ labels: 'roman' }).labels).toBe('num0');
  });

  it('keeps a screen-fixed dial at its radius in screen px, whatever the zoom', () => {
    const { radii } = dialBearings({ show: true, divisions: 8, size: 'screen', radius: 150 });
    expect(radii).toEqual([150]);
  });

  it('scales a map-fixed dial with the zoom (radius in map px × zoom)', () => {
    // compassVp zoom is 0.1 → 400 map px = 40 screen px
    const { radii } = dialBearings({ show: true, divisions: 8, size: 'map', mapRadius: 400 });
    expect(radii).toEqual([40]);
    expect(dialScreenRadius(normalizeDial({ size: 'map', mapRadius: 400 }), 2)).toBe(800);
    expect(dialScreenRadius(normalizeDial({ size: 'screen', radius: 120 }), 2)).toBe(120);
  });

  it('skips a map-fixed dial zoomed out below 4 screen px', () => {
    const { lines, texts } = dialBearings({ show: true, divisions: 8, size: 'map', mapRadius: 30 });
    expect(lines).toHaveLength(0);
    expect(texts).toHaveLength(0);
  });

  it('shows more labels as the on-screen radius grows, none when too small', () => {
    expect(dialLabelStep(80, 'num0', 90)).toBe(10);
    expect(dialLabelStep(80, 'num0', 600)).toBe(2);
    expect(dialLabelStep(80, 'num0', 10)).toBe(50);
    expect(dialLabelStep(80, 'num0', 2)).toBe(0);
    const big = dialBearings({ show: true, divisions: 80, size: 'map', mapRadius: 6000 }); // 600 screen px
    expect(big.texts).toContain('2');
    expect(big.texts).toContain('78');
    const tiny = dialBearings({ show: true, divisions: 8, size: 'screen', radius: 20 });
    expect(tiny.radii).toEqual([20]);
  });

  it('normalizes size and radii', () => {
    expect(normalizeDial({ size: 'weird' }).size).toBe('screen');
    expect(normalizeDial({ radius: 5 }).radius).toBe(20);
    expect(normalizeDial({ radius: 5000 }).radius).toBe(1000);
    expect(normalizeDial({ mapRadius: 123.456 }).mapRadius).toBe(123.5);
    expect(normalizeDial({ mapRadius: 'abc' }).mapRadius).toBe(400);
  });

  it('does not draw the dial when it is disabled map-wide', () => {
    const { lines, texts } = dialBearings({ show: false });
    expect(lines).toHaveLength(0);
    expect(texts).not.toContain('10');
  });

  it('does not draw the dial without render options', () => {
    expect(dialBearings(undefined).lines).toHaveLength(0);
  });

  it('does not draw the dial on a point that opts out', () => {
    const { lines, texts } = dialBearings({ show: true }, { hideDial: true });
    expect(lines).toHaveLength(0);
    expect(texts).not.toContain('10');
  });

  it('draws no compass rose around a point, only the dial', () => {
    const { texts } = dialBearings({ show: true, divisions: 8 });
    expect(texts).toContain('0');
    for (const dir of ['N', 'NE', 'SO', 'NO']) expect(texts).not.toContain(dir);
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
    createPoint(0, 0);
    const p2 = createPoint(1, 1);
    createPoint(2, 2);
    const id2 = p2.id;
    releaseId(id2);
    const p4 = createPoint(3, 3);
    expect(p4.id).toBe(id2);
  });

  it('recycles the lowest released id first', () => {
    syncNextId([]);
    const a = createPoint(0, 0);
    createPoint(1, 1);
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

/* -- syncColorIndex ------------------------------------- */

describe('syncColorIndex', () => {
  const PALETTE = [
    '#e74c3c','#3498db','#2ecc71','#f39c12',
    '#9b59b6','#1abc9c','#e67e22','#e91e63',
  ];

  it('after restoring a state where every colour was used once, the next pick can be any (round-robin from start)', () => {
    syncColorIndex([]);
    syncNextId([]);
    const first = createPoint(0, 0).color;
    expect(PALETTE).toContain(first);
  });

  it('biases towards the least-used colour after a restore', () => {
    syncColorIndex([]);
    syncNextId([]);
    // Existing world has many of PALETTE[0] and PALETTE[1] but NONE of PALETTE[2].
    const existing = [
      { type: 'point', color: PALETTE[0] },
      { type: 'point', color: PALETTE[0] },
      { type: 'point', color: PALETTE[1] },
      { type: 'point', color: PALETTE[1] },
      { type: 'point', color: PALETTE[3] },
      { type: 'point', color: PALETTE[4] },
      { type: 'point', color: PALETTE[5] },
      { type: 'point', color: PALETTE[6] },
      { type: 'point', color: PALETTE[7] },
    ];
    syncColorIndex(existing);
    // The next colour assigned MUST be the unused one (PALETTE[2]).
    const next = createPoint(0, 0).color;
    expect(next).toBe(PALETTE[2]);
  });

  it('handles non-array input gracefully (resets index)', () => {
    expect(() => syncColorIndex(null)).not.toThrow();
    expect(() => syncColorIndex(undefined)).not.toThrow();
  });

  it('ignores shapes whose colour is not part of the palette', () => {
    syncColorIndex([]);
    const next = createPoint(0, 0).color;
    syncColorIndex([{ type: 'point', color: '#abcdef' }, { type: 'point', color: '' }]);
    // Index reset to 0, next pick should be PALETTE[0]
    const after = createPoint(0, 0).color;
    expect(PALETTE).toContain(next);
    expect(after).toBe(PALETTE[0]);
  });
});
