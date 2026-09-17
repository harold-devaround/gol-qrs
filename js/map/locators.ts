/**
 * Locator grids drawn over the GPS-calibrated map: the old QRA locator and
 * Maidenhead. Each system is a list of nested levels (coarse → fine) plus an
 * encoder; one generic engine picks the levels to draw from the zoom and lists
 * the visible lines and labels.
 *
 * QRA locator (IARU Region 1, 1959–1980) — e.g. "BI23h". Only the official field
 * 0°–52°E × 40°–66°N (the system repeats its letters beyond it; not supported).
 *  - 2 letters: square of 2° lon × 1° lat, counted from 0°E / 40°N (A–Z × A–Z)
 *  - 2 digits 01–80: 10 columns × 8 rows (12′ × 7.5′), numbered from the NW corner
 *  - 1 letter a–j (no i): 3 × 3, laid out  h a b / g j c / f e d
 *
 * Maidenhead — e.g. "JN18eu26". Whole world, counted from 180°W / 90°S.
 *  - 2 letters A–R: field 20° × 10° (18 × 18)
 *  - 2 digits 0–9: square 2° × 1° (10 × 10)
 *  - 2 letters a–x: subsquare 5′ × 2.5′ (24 × 24)
 *  - 2 digits 0–9: extended square 30″ × 15″ (10 × 10)
 *
 * Also provides float (non-rounded) degree ↔ image-pixel conversions from the
 * map's 1° graduation ticks, so sub-pixel subdivisions stay accurate.
 */

const EPS = 1e-9;
const clampIdx = (v: number, max: number) => Math.min(max, Math.max(0, v));
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface Extent { lonMin: number; lonMax: number; latMin: number; latMax: number }

export interface GridLevel {
  key: string;
  /** Cell size in degrees; each level's size divides the previous one exactly. */
  lonDeg: number;
  latDeg: number;
  /** Minimum on-screen size (px, smaller side) for the level's lines; 0 = always drawn. */
  lines: number;
  /** Minimum cell size (px) to label cells, and width from which labels show the full code. */
  label: { w: number; h: number; full: number } | null;
}

export interface LocatorSystem {
  id: string;
  name: string;
  /** Lines and cells are counted from this corner. */
  origin: { lon: number; lat: number };
  /** Area covered by the system (edges included). */
  extent: Extent;
  levels: GridLevel[];
  /** Code part of each level (joined = full code), or null outside the extent. */
  locate(lon: number, lat: number): string[] | null;
}

const inExtent = (e: Extent, lon: number, lat: number) =>
  lon >= e.lonMin && lon <= e.lonMax && lat >= e.latMin && lat <= e.latMax;

/* ── QRA locator ─────────────────────────────────────────────────────────── */

const QRA_SMALL_LAYOUT = [['h', 'a', 'b'], ['g', 'j', 'c'], ['f', 'e', 'd']];

export const QRA: LocatorSystem = {
  id: 'qra',
  name: 'QRA locator (ancien)',
  origin: { lon: 0, lat: 40 },
  extent: { lonMin: 0, lonMax: 52, latMin: 40, latMax: 66 },
  levels: [
    { key: 'field', lonDeg: 52, latDeg: 26, lines: 0, label: null }, // border of the official field
    { key: 'big', lonDeg: 2, latDeg: 1, lines: 6, label: { w: 26, h: 14, full: Infinity } },
    { key: 'sub', lonDeg: 2 / 10, latDeg: 1 / 8, lines: 6, label: { w: 26, h: 14, full: 46 } },
    // small squares labelled only when roomy, so the map stays readable
    { key: 'small', lonDeg: 2 / 30, latDeg: 1 / 24, lines: 8, label: { w: 28, h: 28, full: 60 } },
  ],
  locate(lon, lat) {
    if (!inExtent(this.extent, lon, lat)) return null;
    // East / north field edges belong to the last square
    const bigLon = clampIdx(Math.floor(lon / 2 + EPS), 25);
    const bigLat = clampIdx(Math.floor(lat - 40 + EPS), 25);
    const west = bigLon * 2, north = 40 + bigLat + 1;
    const col = clampIdx(Math.floor((lon - west) / 0.2 + EPS), 9);
    const row = clampIdx(Math.floor((north - lat) / 0.125 + EPS), 7);
    const cx = clampIdx(Math.floor((lon - west - col * 0.2) / (0.2 / 3) + EPS), 2);
    const cy = clampIdx(Math.floor((north - row * 0.125 - lat) / (0.125 / 3) + EPS), 2);
    return ['', LETTERS[bigLon] + LETTERS[bigLat], String(row * 10 + col + 1).padStart(2, '0'), QRA_SMALL_LAYOUT[cy][cx]];
  },
};

/* ── Maidenhead ──────────────────────────────────────────────────────────── */

export const MAIDENHEAD: LocatorSystem = {
  id: 'maidenhead',
  name: 'Maidenhead',
  origin: { lon: -180, lat: -90 },
  extent: { lonMin: -180, lonMax: 180, latMin: -90, latMax: 90 },
  levels: [
    { key: 'field', lonDeg: 20, latDeg: 10, lines: 0, label: { w: 22, h: 14, full: Infinity } },
    { key: 'square', lonDeg: 2, latDeg: 1, lines: 6, label: { w: 26, h: 14, full: 44 } },
    // subsquares and extended squares labelled only when roomy, so the map stays readable
    { key: 'subsquare', lonDeg: 2 / 24, latDeg: 1 / 24, lines: 6, label: { w: 48, h: 32, full: 64 } },
    { key: 'extended', lonDeg: 2 / 240, latDeg: 1 / 240, lines: 6, label: { w: 48, h: 32, full: 90 } },
  ],
  locate(lon, lat) {
    if (!inExtent(this.extent, lon, lat)) return null;
    // Work in integer units of an extended square; east / north edges belong to the last cells
    const x = clampIdx(Math.floor((lon + 180) * 120 + EPS), 360 * 120 - 1);
    const y = clampIdx(Math.floor((lat + 90) * 240 + EPS), 180 * 240 - 1);
    const lower = 'abcdefghijklmnopqrstuvwx';
    return [
      LETTERS[Math.floor(x / 2400)] + LETTERS[Math.floor(y / 2400)],
      String(Math.floor(x / 240) % 10) + String(Math.floor(y / 240) % 10),
      lower[Math.floor(x / 10) % 24] + lower[Math.floor(y / 10) % 24],
      String(x % 10) + String(y % 10),
    ];
  },
};

export const LOCATOR_SYSTEMS: LocatorSystem[] = [QRA, MAIDENHEAD];

/** Full code of a position, e.g. "BI23h" or "JN18eu26", or null outside the system. */
export function locatorCode(system: LocatorSystem, lon: number, lat: number): string | null {
  return system.locate(lon, lat)?.join('') ?? null;
}

/* ── Degrees ↔ image pixels (from the 1° graduation ticks) ─────────────── */

export interface LonTick { x: number; lon: number; intermediate?: boolean }
export interface LatTick { y: number; lat: number; intermediate?: boolean }

const mercator = (deg: number) => Math.log(Math.tan(Math.PI / 4 + deg * Math.PI / 360));
const mercatorInv = (v: number) => (2 * Math.atan(Math.exp(v)) - Math.PI / 2) * 180 / Math.PI;

/** Index i of the bracket [arr[i], arr[i+1]] containing v (arr ascending by key), clamped. */
function bracket<T>(arr: T[], key: (t: T) => number, v: number): number {
  let lo = 0, hi = arr.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (key(arr[mid]) <= v) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/**
 * Float conversions between degrees and image pixels. Longitude is linear
 * between ticks; latitude follows the local Mercator scale between ticks.
 * Values outside the tick range are extrapolated from the outermost bracket.
 */
export function makeProjection(lonTicks: LonTick[], latTicks: LatTick[]) {
  const lons = lonTicks.filter(t => !t.intermediate).sort((a, b) => a.lon - b.lon);
  // Latitude ticks ascending by latitude, restricted to the Mercator-valid range
  const lats = latTicks.filter(t => !t.intermediate && Math.abs(t.lat) < 90).sort((a, b) => a.lat - b.lat);

  const lonToX = (lon: number) => {
    const i = bracket(lons, t => t.lon, lon), a = lons[i], b = lons[i + 1];
    return a.x + (lon - a.lon) / (b.lon - a.lon) * (b.x - a.x);
  };
  const xToLon = (x: number) => {
    const i = bracket(lons, t => t.x, x), a = lons[i], b = lons[i + 1];
    return a.lon + (x - a.x) / (b.x - a.x) * (b.lon - a.lon);
  };
  const latToY = (lat: number) => {
    const i = bracket(lats, t => t.lat, lat), a = lats[i], b = lats[i + 1];
    const t = (mercator(lat) - mercator(a.lat)) / (mercator(b.lat) - mercator(a.lat));
    return a.y + t * (b.y - a.y);
  };
  // y decreases as latitude increases → search on -y (ascending)
  const yToLat = (y: number) => {
    const i = bracket(lats, t => -t.y, -y), a = lats[i], b = lats[i + 1];
    const t = (y - a.y) / (b.y - a.y);
    return mercatorInv(mercator(a.lat) + t * (mercator(b.lat) - mercator(a.lat)));
  };
  return {
    lonToX, xToLon, latToY, yToLat,
    lonRange: [lons[0].lon, lons[lons.length - 1].lon] as [number, number],
    latRange: [lats[0].lat, lats[lats.length - 1].lat] as [number, number],
  };
}

/* ── Zoom-dependent grid layout ─────────────────────────────────────────── */

export interface LocatorLayout {
  /** Finest level whose lines are drawn (key and index in `levels`). */
  lines: string;
  linesIndex: number;
  /** Level whose cells get labels, or null. */
  labels: string | null;
  labelsIndex: number | null;
  /** Labels show the full code (e.g. "JN18eu") rather than just their level's part. */
  fullLabels: boolean;
}

/** Pick what to draw from the on-screen scale (px per degree of longitude / latitude). */
export function locatorLayout(system: LocatorSystem, pxPerLon: number, pxPerLat: number): LocatorLayout {
  const size = (l: GridLevel) => ({ w: l.lonDeg * pxPerLon, h: l.latDeg * pxPerLat });
  let li = 0;
  for (let i = 1; i < system.levels.length; i++) {
    const { w, h } = size(system.levels[i]);
    if (Math.min(w, h) < system.levels[i].lines) break;
    li = i;
  }
  for (let i = li; i >= 0; i--) {
    const lvl = system.levels[i], { w, h } = size(lvl);
    if (lvl.label && w >= lvl.label.w && h >= lvl.label.h) {
      return { lines: system.levels[li].key, linesIndex: li, labels: lvl.key, labelsIndex: i, fullLabels: w >= lvl.label.full };
    }
  }
  return { lines: system.levels[li].key, linesIndex: li, labels: null, labelsIndex: null, fullLabels: false };
}

export interface LocatorLine { deg: number; level: string }
export interface LocatorLabel { lon: number; lat: number; text: string }

/** Grid lines of one axis within [min, max] down to level `finest`, each tagged with its coarsest level. */
function axisLines(system: LocatorSystem, axis: 'lon' | 'lat', min: number, max: number, finest: number): LocatorLine[] {
  const deg = (l: GridLevel) => (axis === 'lon' ? l.lonDeg : l.latDeg);
  const origin = axis === 'lon' ? system.origin.lon : system.origin.lat;
  const unit = deg(system.levels[system.levels.length - 1]);       // finest cell, in degrees
  const units = system.levels.map(l => Math.round(deg(l) / unit)); // cell size of each level, in units
  const step = units[finest];
  const out: LocatorLine[] = [];
  for (let k = Math.ceil((min - origin) / unit / step - EPS) * step; origin + k * unit <= max + EPS; k += step) {
    const level = units.findIndex(u => k % u === 0);
    out.push({ deg: origin + k * unit, level: system.levels[level].key });
  }
  return out;
}

/**
 * Lines and labels of a locator grid inside a lon/lat window, at the given
 * on-screen scale. Everything is clipped to the system's extent; `bounds` is the
 * visible part of it (null when out of view) — the extent lines are drawn over.
 */
export function buildLocatorGrid(system: LocatorSystem, view: Extent, pxPerLon: number, pxPerLat: number) {
  const layout = locatorLayout(system, pxPerLon, pxPerLat);
  const E = system.extent;
  const b: Extent = {
    lonMin: Math.max(view.lonMin, E.lonMin), lonMax: Math.min(view.lonMax, E.lonMax),
    latMin: Math.max(view.latMin, E.latMin), latMax: Math.min(view.latMax, E.latMax),
  };
  if (b.lonMin >= b.lonMax || b.latMin >= b.latMax) {
    return { layout, bounds: null, lonLines: [] as LocatorLine[], latLines: [] as LocatorLine[], labels: [] as LocatorLabel[] };
  }
  const lonLines = axisLines(system, 'lon', b.lonMin, b.lonMax, layout.linesIndex);
  const latLines = axisLines(system, 'lat', b.latMin, b.latMax, layout.linesIndex);

  const labels: LocatorLabel[] = [];
  if (layout.labelsIndex !== null) {
    const li = layout.labelsIndex;
    const { lonDeg: cw, latDeg: ch } = system.levels[li];
    const O = system.origin;
    const i0 = Math.floor((b.lonMin - O.lon) / cw), i1 = Math.ceil((b.lonMax - O.lon) / cw);
    const j0 = Math.floor((b.latMin - O.lat) / ch), j1 = Math.ceil((b.latMax - O.lat) / ch);
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const lon = O.lon + (i + 0.5) * cw, lat = O.lat + (j + 0.5) * ch;
        if (lon < b.lonMin || lon > b.lonMax || lat < b.latMin || lat > b.latMax) continue;
        const parts = system.locate(lon, lat);
        if (!parts) continue;
        labels.push({ lon, lat, text: layout.fullLabels ? parts.slice(0, li + 1).join('') : parts[li] });
      }
    }
  }
  return { layout, bounds: b, lonLines, latLines, labels };
}
