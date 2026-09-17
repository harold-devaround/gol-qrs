// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { QRA, MAIDENHEAD, locatorCode, makeProjection, locatorLayout, buildLocatorGrid } from '../js/map/locators.js';
import { interpolateLonX, interpolateLatY } from '../js/map/gps-calibration.js';
import grads from '../data/gps-graduations.json';

const qra = (lon, lat) => QRA.locate(lon, lat);
const inQra = (lon, lat) => qra(lon, lat) !== null;

/* ── QRA locator ─────────────────────────────────────────────────────────── */

describe('QRA — big square letters', () => {
  it('counts longitude from Greenwich in 2° steps and latitude from 40°N in 1° steps', () => {
    expect(qra(0.5, 40.5)[1]).toBe('AA');
    expect(qra(2.35, 48.86)[1]).toBe('BI');   // Paris
    expect(qra(4.35, 50.85)[1]).toBe('CK');   // Brussels
    expect(qra(11.58, 48.14)[1]).toBe('FI');  // Munich
    expect(qra(51, 65.5)[1]).toBe('ZZ');
  });

  it('only covers the official field 0°–52°E × 40°–66°N (no repetition)', () => {
    expect(qra(-0.13, 51.51)).toBeNull();  // London, west of Greenwich
    expect(qra(-3.7, 40.4)).toBeNull();    // Madrid
    expect(qra(52.5, 45)).toBeNull();
    expect(qra(10, 39.9)).toBeNull();
    expect(qra(10, 66.1)).toBeNull();
    expect(inQra(0, 40)).toBe(true);
    expect(inQra(52, 66)).toBe(true);
  });

  it('assigns the field edges to the outermost squares', () => {
    expect(locatorCode(QRA, 0, 40)).toBe('AA71f');          // south-west corner
    expect(locatorCode(QRA, 1.99, 40.001)).toBe('AA80d');   // just inside the south-east corner of AA
    expect(qra(2, 40)[1]).toBe('BA');                       // inner edges belong to the next square
    expect(locatorCode(QRA, 52, 66)).toBe('ZZ10b');
  });
});

describe('QRA — subsquare numbers 01–80', () => {
  // Square AA spans 0–2°E, 40–41°N; subsquares are 0.2° × 0.125°
  it('numbers from the north-west corner, 10 per row, 8 rows', () => {
    expect(qra(0.05, 40.99)[2]).toBe('01');
    expect(qra(0.25, 40.99)[2]).toBe('02');
    expect(qra(1.95, 40.99)[2]).toBe('10');
    expect(qra(0.05, 40.86)[2]).toBe('11');
    expect(qra(1.95, 40.01)[2]).toBe('80');
  });

  it('numbers the same way in any square', () => {
    // BL spans 2–4°E, 51–52°N
    expect(qra(3.9, 51.95)[2]).toBe('10');
    expect(qra(2.1, 51.05)[2]).toBe('71');
  });
});

describe('QRA — small square letter a–j', () => {
  // Subsquare AA01 spans 0–0.2°E, 40.875–41°N; its 3×3 cells are 0.0667° × 0.04167°
  const at = (cx, cy) => qra(0.2 * (cx + 0.5) / 3, 41 - 0.125 * (cy + 0.5) / 3)[3];
  it('lays out h a b / g j c / f e d', () => {
    expect([at(0, 0), at(1, 0), at(2, 0)]).toEqual(['h', 'a', 'b']);
    expect([at(0, 1), at(1, 1), at(2, 1)]).toEqual(['g', 'j', 'c']);
    expect([at(0, 2), at(1, 2), at(2, 2)]).toEqual(['f', 'e', 'd']);
  });

  it('builds the full code', () => {
    expect(locatorCode(QRA, 0.1, 40.9375)).toBe('AA01j');
  });
});

/* ── Maidenhead ──────────────────────────────────────────────────────────── */

describe('Maidenhead — codes', () => {
  it('encodes well-known locators', () => {
    expect(locatorCode(MAIDENHEAD, 2.35, 48.86).slice(0, 6)).toBe('JN18eu');   // Paris
    expect(locatorCode(MAIDENHEAD, -0.13, 51.51).slice(0, 6)).toBe('IO91wm');  // London
    expect(locatorCode(MAIDENHEAD, -75.17, 39.95).slice(0, 4)).toBe('FM29');   // Philadelphia
  });

  it('splits into field / square / subsquare / extended square', () => {
    expect(MAIDENHEAD.locate(2.3542, 48.8584)).toEqual(['JN', '18', 'eu', '26']);
  });

  it('covers the whole world from 180°W / 90°S, edges included', () => {
    expect(locatorCode(MAIDENHEAD, -180, -90)).toBe('AA00aa00');
    expect(locatorCode(MAIDENHEAD, 180, 90)).toBe('RR99xx99');
    expect(locatorCode(MAIDENHEAD, 0, 0)).toBe('JJ00aa00');
    expect(locatorCode(MAIDENHEAD, -0.0001, -0.0001)).toBe('II99xx99');
    expect(MAIDENHEAD.locate(180.1, 0)).toBeNull();
  });

  it('uses 24 × 24 subsquares of 5′ × 2.5′ (no 80-cell level)', () => {
    const sq = MAIDENHEAD.levels.find(l => l.key === 'square');
    const sub = MAIDENHEAD.levels.find(l => l.key === 'subsquare');
    expect(Math.round(sq.lonDeg / sub.lonDeg)).toBe(24);
    expect(Math.round(sq.latDeg / sub.latDeg)).toBe(24);
    expect(locatorCode(MAIDENHEAD, 0 + 23.5 * 5 / 60, 0 + 0.5 * 2.5 / 60).slice(4, 6)).toBe('xa');
  });
});

/* ── Projection ──────────────────────────────────────────────────────────── */

describe('makeProjection', () => {
  const proj = makeProjection(grads.lonTicks, grads.latTicks);

  it('matches the existing (rounded) tick interpolation to within a pixel', () => {
    for (const [lon, lat] of [[2.35, 48.86], [-75.17, 39.95], [123.95, 10.31], [40.54, 64.54]]) {
      expect(Math.abs(proj.lonToX(lon) - interpolateLonX(lon, grads.lonTicks))).toBeLessThanOrEqual(1);
      expect(Math.abs(proj.latToY(lat) - interpolateLatY(lat, grads.latTicks))).toBeLessThanOrEqual(1);
    }
  });

  it('does not round (subdivisions finer than a pixel stay distinct)', () => {
    const y1 = proj.latToY(48), y2 = proj.latToY(48 + 1 / 24);
    expect(y1 - y2).toBeGreaterThan(0);
    expect(y1 - y2).toBeLessThan(1.5);
  });

  it('round-trips degrees ↔ pixels', () => {
    for (const lon of [-179.3, -0.1, 0, 2.35, 91.7]) expect(proj.xToLon(proj.lonToX(lon))).toBeCloseTo(lon, 9);
    for (const lat of [-60.2, 0, 40.125, 51.51, 71.9]) expect(proj.yToLat(proj.latToY(lat))).toBeCloseTo(lat, 9);
  });
});

/* ── Layout ──────────────────────────────────────────────────────────────── */

describe('locatorLayout — QRA detail follows the on-screen size of a 2° × 1° square', () => {
  const layout = (bigW, bigH) => locatorLayout(QRA, bigW / 2, bigH);

  it('draws only the field border when squares are tiny', () => {
    expect(layout(4, 3)).toMatchObject({ lines: 'field', labels: null, fullLabels: false });
  });

  it('draws squares, then labels them', () => {
    expect(layout(12, 8)).toMatchObject({ lines: 'big', labels: null });
    expect(layout(40, 20)).toMatchObject({ lines: 'big', labels: 'big', fullLabels: false });
  });

  it('adds subsquares, then labels them with the number, then the full code', () => {
    expect(layout(80, 60)).toMatchObject({ lines: 'sub', labels: 'big' });
    expect(layout(300, 120)).toMatchObject({ lines: 'sub', labels: 'sub', fullLabels: false });
    expect(layout(500, 180)).toMatchObject({ lines: 'sub', labels: 'sub', fullLabels: true });
  });

  it('adds small squares, labelled only once roomy', () => {
    expect(layout(300, 200)).toMatchObject({ lines: 'small', labels: 'sub' });
    expect(layout(450, 400)).toMatchObject({ lines: 'small', labels: 'sub', fullLabels: false });
    expect(layout(900, 700)).toMatchObject({ lines: 'small', labels: 'small', fullLabels: false });
    expect(layout(1900, 1500)).toMatchObject({ lines: 'small', labels: 'small', fullLabels: true });
  });
});

describe('locatorLayout — Maidenhead', () => {
  it('labels fields on a world view', () => {
    // WorldMap fitted to the screen: ~2.5 px per degree
    expect(locatorLayout(MAIDENHEAD, 2.5, 2.5)).toMatchObject({ lines: 'field', labels: 'field' });
  });

  it('goes down to squares, subsquares and extended squares as the zoom grows', () => {
    expect(locatorLayout(MAIDENHEAD, 15, 15)).toMatchObject({ lines: 'square', labels: 'square', fullLabels: false });
    expect(locatorLayout(MAIDENHEAD, 25, 25)).toMatchObject({ lines: 'square', labels: 'square', fullLabels: true });
    expect(locatorLayout(MAIDENHEAD, 100, 100)).toMatchObject({ lines: 'square' }); // subsquares 4 px tall: not yet
    expect(locatorLayout(MAIDENHEAD, 200, 200)).toMatchObject({ lines: 'subsquare', labels: 'square' });
    expect(locatorLayout(MAIDENHEAD, 480, 480)).toMatchObject({ lines: 'subsquare', labels: 'square' }); // subsquares 40 × 20 px: too tight to label
    expect(locatorLayout(MAIDENHEAD, 700, 800)).toMatchObject({ lines: 'subsquare', labels: 'subsquare', fullLabels: false });
    expect(locatorLayout(MAIDENHEAD, 1000, 1000)).toMatchObject({ lines: 'subsquare', labels: 'subsquare', fullLabels: true });
    expect(locatorLayout(MAIDENHEAD, 1500, 1500)).toMatchObject({ lines: 'extended' });
  });
});

/* ── Grid ────────────────────────────────────────────────────────────────── */

describe('buildLocatorGrid — QRA', () => {
  const grid = (view, bigW, bigH) => buildLocatorGrid(QRA, view, bigW / 2, bigH);

  it('tags each line with its coarsest level and never duplicates a line', () => {
    const g = grid({ lonMin: -1, lonMax: 2.5, latMin: 39.5, latMax: 41.5 }, 600, 500);
    expect(g.layout.lines).toBe('small');
    expect(g.bounds).toEqual({ lonMin: 0, lonMax: 2.5, latMin: 40, latMax: 41.5 }); // clipped to the field
    const lonDegs = g.lonLines.map(l => l.deg);
    expect(new Set(lonDegs.map(d => d.toFixed(6))).size).toBe(lonDegs.length);
    const lvl = (lines, deg) => lines.find(l => Math.abs(l.deg - deg) < 1e-9)?.level;
    expect(lvl(g.lonLines, 0)).toBe('field');
    expect(lvl(g.lonLines, 2)).toBe('big');
    expect(lvl(g.lonLines, 0.2)).toBe('sub');
    expect(lvl(g.lonLines, 2 / 30)).toBe('small');
    expect(lvl(g.latLines, 40)).toBe('field');
    expect(lvl(g.latLines, 41)).toBe('big');
    expect(lvl(g.latLines, 40.125)).toBe('sub');
    expect(lvl(g.latLines, 40 + 1 / 24)).toBe('small');
    expect(lonDegs).toHaveLength(Math.floor(2.5 * 15) + 1); // 2.5° at 2°/30 steps
  });

  it('draws only the border of the official field on a world view', () => {
    const g = grid({ lonMin: -180, lonMax: 180, latMin: -80, latMax: 80 }, 4, 3);
    expect(g.bounds).toEqual({ lonMin: 0, lonMax: 52, latMin: 40, latMax: 66 });
    expect(g.lonLines).toEqual([{ deg: 0, level: 'field' }, { deg: 52, level: 'field' }]);
    expect(g.latLines).toEqual([{ deg: 40, level: 'field' }, { deg: 66, level: 'field' }]);
    expect(g.labels).toHaveLength(0);
  });

  it('draws nothing when the field is out of view', () => {
    for (const view of [
      { lonMin: -80, lonMax: -1, latMin: 30, latMax: 60 },
      { lonMin: 10, lonMax: 20, latMin: -30, latMax: 39 },
      { lonMin: 60, lonMax: 120, latMin: 40, latMax: 60 },
    ]) {
      const g = grid(view, 600, 500);
      expect(g.bounds).toBeNull();
      expect(g.lonLines.length + g.latLines.length + g.labels.length).toBe(0);
    }
  });

  it('labels cells of the chosen level with the right text, never outside the field', () => {
    const big = grid({ lonMin: -6, lonMax: 6, latMin: 36, latMax: 42 }, 40, 20);
    expect(big.labels.every(l => inQra(l.lon, l.lat))).toBe(true);
    expect(big.labels.map(l => l.text).sort()).toEqual(['AA', 'AB', 'BA', 'BB', 'CA', 'CB']);
    const sub = grid({ lonMin: 0, lonMax: 0.4, latMin: 40.75, latMax: 41 }, 300, 120);
    expect(sub.labels.map(l => l.text).sort()).toEqual(['01', '02', '11', '12']);
    const subFull = grid({ lonMin: 0, lonMax: 0.2, latMin: 40.875, latMax: 41 }, 500, 180);
    expect(subFull.labels.map(l => l.text)).toEqual(['AA01']);
    const small = grid({ lonMin: 0, lonMax: 0.2, latMin: 40.875, latMax: 41 }, 900, 700);
    expect(small.labels.map(l => l.text).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j']);
  });
});

describe('buildLocatorGrid — Maidenhead', () => {
  it('draws and labels the 18 × 18 fields over the whole world', () => {
    const g = buildLocatorGrid(MAIDENHEAD, { lonMin: -180, lonMax: 180, latMin: -90, latMax: 90 }, 2.5, 2.5);
    expect(g.lonLines).toHaveLength(19);
    expect(g.latLines).toHaveLength(19);
    expect(g.lonLines.every(l => l.level === 'field')).toBe(true);
    expect(g.labels).toHaveLength(18 * 18);
    expect(g.labels.map(l => l.text)).toContain('JN');
    expect(g.labels.map(l => l.text)).toContain('RR');
  });

  it('tags square, subsquare and extended lines', () => {
    const g = buildLocatorGrid(MAIDENHEAD, { lonMin: 0, lonMax: 2.5, latMin: 48, latMax: 49.5 }, 1500, 1500);
    expect(g.layout.lines).toBe('extended');
    const lvl = (lines, deg) => lines.find(l => Math.abs(l.deg - deg) < 1e-9)?.level;
    expect(lvl(g.lonLines, 0)).toBe('field');
    expect(lvl(g.lonLines, 2)).toBe('square');
    expect(lvl(g.lonLines, 5 / 60)).toBe('subsquare');
    expect(lvl(g.lonLines, 0.5 / 60)).toBe('extended');
    expect(lvl(g.latLines, 50)).toBeUndefined(); // outside the window
    expect(lvl(g.latLines, 49)).toBe('square');
    expect(lvl(g.latLines, 48 + 2.5 / 60)).toBe('subsquare');
  });

  it('labels squares around Paris with full codes', () => {
    const g = buildLocatorGrid(MAIDENHEAD, { lonMin: 0, lonMax: 4, latMin: 48, latMax: 50 }, 25, 25);
    expect(g.labels.map(l => l.text).sort()).toEqual(['JN08', 'JN09', 'JN18', 'JN19']);
  });
});
