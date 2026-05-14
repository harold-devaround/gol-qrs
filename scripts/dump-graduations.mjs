// One-off script that runs the WorldMap graduation detection (formerly in
// js/map/gps-calibration.ts → detectGraduations) and dumps the result to
// data/gps-graduations.json so the runtime no longer needs to redo the work
// on every page load.
//
// Output also includes a +1px shift applied to graduations:
//   – horizontal graduations (latitude lines): y → y + 1 (1px down)
//   – vertical   graduations (longitude lines): x → x + 1 (1px right)
//
// Run with:  node scripts/dump-graduations.mjs

import { createCanvas, loadImage } from 'canvas';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// ── Constants (copied from js/map/gps-calibration.ts) ──────────────────────
const DEFAULT_CALIBRATION = {
  mapLeft:    148,
  mapWidth:   4149,
  equatorY:   1726,
  mercRadius: 657,
};
const LON_Y0 = 107, LON_H = 9, LON_Y0_BOT = 3336, LON_H_BOT = 9;
const LAT_X0 = 143, LAT_W = 8, LAT_X0_RIGHT = 4293, LAT_W_RIGHT = 8;
const LON_EXPECTED = 361, LON_TOL = 30;
const LAT_EXPECTED = 181, LAT_TOL = 20;

// ── Pure helpers (inlined from gps-calibration.ts) ─────────────────────────
function findTickCenters(profile, threshold, minGap = 20) {
  const dark = [];
  for (let i = 0; i < profile.length; i++) if (profile[i] < threshold) dark.push(i);
  if (dark.length === 0) return [];
  const groupCenter = (from, to) => Math.round((from + to) / 2);
  const centers = [];
  let start = dark[0], prev = dark[0];
  for (let k = 1; k < dark.length; k++) {
    if (dark[k] > prev + minGap) { centers.push(groupCenter(start, prev)); start = dark[k]; }
    prev = dark[k];
  }
  centers.push(groupCenter(start, prev));
  return centers;
}

function blueExcessColumnProfile(data, width, height) {
  const profile = new Array(width).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const inv = 255 - Math.max(0, 2 * b - r - g);
      if (inv < profile[x]) profile[x] = inv;
    }
  }
  return profile;
}

function blueExcessRowProfile(data, width, height) {
  const profile = new Array(height).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const inv = 255 - Math.max(0, 2 * b - r - g);
      if (inv < profile[y]) profile[y] = inv;
    }
  }
  return profile;
}

function computeCalibration(lonTicksX, latTicksY) {
  const cal = { ...DEFAULT_CALIBRATION };

  if (lonTicksX && lonTicksX.length >= 2) {
    const n = lonTicksX.length;
    const spanX = lonTicksX[n - 1] - lonTicksX[0];
    if (n >= 300) {
      const firstLon = (n >= 350) ? -180 : -165;
      const step = spanX / (n - 1);
      cal.mapWidth = Math.round(step * 360);
      cal.mapLeft  = Math.round(lonTicksX[0] - (firstLon + 180) / 360 * cal.mapWidth);
    } else {
      const firstLon = -165;
      const spanLon  = (n - 1) * 15;
      cal.mapWidth = Math.round(spanX / spanLon * 360);
      cal.mapLeft  = Math.round(lonTicksX[0] - (firstLon + 180) / 360 * cal.mapWidth);
    }
  }

  if (latTicksY && latTicksY.length >= 2) {
    const mercatorY = (deg) => Math.log(Math.tan(Math.PI / 4 + deg * Math.PI / 360));
    if (latTicksY.length >= 100) {
      const eqDefault = DEFAULT_CALIBRATION.equatorY;
      const eqIdx = latTicksY.reduce((best, y, i) =>
        Math.abs(y - eqDefault) < Math.abs(latTicksY[best] - eqDefault) ? i : best, 0);
      cal.equatorY = latTicksY[eqIdx];
      const rVals = [];
      for (let i = 0; i < latTicksY.length; i++) {
        const lat = eqIdx - i;
        if (lat === 0) continue;
        const yM = mercatorY(lat);
        const R  = (cal.equatorY - latTicksY[i]) / yM;
        if (R > 400 && R < 1500) rVals.push(R);
      }
      if (rVals.length > 0) {
        const mean = rVals.reduce((a, b) => a + b, 0) / rVals.length;
        const isMercatorConsistent = rVals.length < 5 ||
          Math.sqrt(rVals.reduce((s, r) => s + (r - mean) ** 2, 0) / rVals.length) / mean < 0.15;
        if (isMercatorConsistent) cal.mercRadius = Math.round(mean);
      }
    }
  }
  return cal;
}

// ── Main ───────────────────────────────────────────────────────────────────
const IMG_PATH = '2019_WorldMap_MHF_1.2x1.6m.jpg';
const OUT_PATH = 'data/gps-graduations.json';

const img = await loadImage(IMG_PATH);
const W = img.width;
const H = img.height;
console.log(`Loaded ${IMG_PATH}: ${W}×${H}`);

function scanLonStrip(y0, stripH) {
  const c = createCanvas(W, stripH);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, y0, W, stripH, 0, 0, W, stripH);
  const data = ctx.getImageData(0, 0, W, stripH).data;
  const prof = blueExcessColumnProfile(data, W, stripH);
  const sorted = [...prof].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const threshold = Math.min(med - 15, 200);
  const margin = DEFAULT_CALIBRATION.mapLeft;
  for (let x = 0; x < margin; x++) prof[x] = 255;
  for (let x = W - margin; x < W; x++) prof[x] = 255;
  return findTickCenters(prof, threshold, 5);
}

function scanLatStrip(x0, stripW) {
  const c = createCanvas(stripW, H);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, x0, 0, stripW, H, 0, 0, stripW, H);
  const data = ctx.getImageData(0, 0, stripW, H).data;
  const prof = blueExcessRowProfile(data, stripW, H);
  const sorted = [...prof].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const threshold = Math.min(med - 20, 200);
  for (let y = 0; y < 5; y++) prof[y] = 255;
  for (let y = H - 5; y < H; y++) prof[y] = 255;
  return findTickCenters(prof, threshold, 5);
}

const lonTopX    = scanLonStrip(LON_Y0, LON_H);
const lonBottomX = scanLonStrip(LON_Y0_BOT, LON_H_BOT);
const latLeftY   = scanLatStrip(LAT_X0, LAT_W);
const latRightY  = scanLatStrip(LAT_X0_RIGHT, LAT_W_RIGHT);

console.log(`Detected lon: top=${lonTopX.length}, bottom=${lonBottomX.length}`);
console.log(`Detected lat: left=${latLeftY.length}, right=${latRightY.length}`);

let lonTicksX;
const lonTopOk  = lonTopX.length  >= LON_EXPECTED - LON_TOL && lonTopX.length  <= LON_EXPECTED + LON_TOL;
const lonBothOk = lonTopOk && lonBottomX.length === lonTopX.length;
if (lonBothOk)      lonTicksX = lonTopX.map((x, i) => Math.round((x + lonBottomX[i]) / 2));
else if (lonTopOk)  lonTicksX = lonTopX;
else                lonTicksX = lonBottomX;

let latTicksY;
const latLeftOk = latLeftY.length >= LAT_EXPECTED - LAT_TOL && latLeftY.length <= LAT_EXPECTED + LAT_TOL;
const latBothOk = latLeftOk && latRightY.length === latLeftY.length;
if (latBothOk)      latTicksY = latLeftY.map((y, i) => Math.round((y + latRightY[i]) / 2));
else if (latLeftOk) latTicksY = latLeftY;
else                latTicksY = latRightY;

const lonOk = lonTicksX.length >= LON_EXPECTED - LON_TOL && lonTicksX.length <= LON_EXPECTED + LON_TOL;
const latOk = latTicksY.length >= LAT_EXPECTED - LAT_TOL && latTicksY.length <= LAT_EXPECTED + LAT_TOL;
const calInput = computeCalibration(lonOk ? lonTicksX : null, latOk ? latTicksY : null);
const mapWidthOk   = calInput.mapWidth   > 3000 && calInput.mapWidth   < 6000;
const mercRadiusOk = calInput.mercRadius > 550  && calInput.mercRadius < 760;
const calibration = {
  mapLeft:    mapWidthOk   ? calInput.mapLeft    : DEFAULT_CALIBRATION.mapLeft,
  mapWidth:   mapWidthOk   ? calInput.mapWidth   : DEFAULT_CALIBRATION.mapWidth,
  equatorY:   latOk        ? calInput.equatorY   : DEFAULT_CALIBRATION.equatorY,
  mercRadius: mercRadiusOk ? calInput.mercRadius : DEFAULT_CALIBRATION.mercRadius,
};

const lonFirstLon    = (lonTicksX.length >= 350) ? -180 : -165;
const lonTicks       = lonTicksX.map((x, i)  => ({ x, lon: lonFirstLon + i }));
const lonTicksTop    = lonTopX.map((x, i)    => ({ x, lon: lonFirstLon + i }));
const lonTicksBottom = lonBottomX.map((x, i) => ({ x, lon: lonFirstLon + i }));

const eqDefault = DEFAULT_CALIBRATION.equatorY;
const latEqIdx = latTicksY.length > 0
  ? latTicksY.reduce((best, y, i) =>
      Math.abs(y - eqDefault) < Math.abs(latTicksY[best] - eqDefault) ? i : best, 0)
  : 0;
const latTicks      = latTicksY.map((y, i)  => ({ y, lat: latEqIdx - i }));
const latTicksLeft  = latLeftY.map((y, i)   => ({ y, lat: latEqIdx - i }));
const latTicksRight = latRightY.map((y, i)  => ({ y, lat: latEqIdx - i }));

// ── Apply +0.5px shift ────────────────────────────────────────────────────
// Original detection sits at one edge of the blue tick. A naive +1px shift
// lands on the opposite edge. Taking the midpoint between the detected
// position and the +1px shift centres the line on the tick itself.
//   Vertical lines (longitude): x → x + 0.5
//   Horizontal lines (latitude): y → y + 0.5
const shiftLon = (arr) => arr.map(t => ({ ...t, x: t.x + 0.5 }));
const shiftLat = (arr) => arr.map(t => ({ ...t, y: t.y + 0.5 }));

const result = {
  mapLeft:    calibration.mapLeft + 0.5,
  mapWidth:   calibration.mapWidth,
  equatorY:   calibration.equatorY + 0.5,
  mercRadius: calibration.mercRadius,
  lonTicks:        shiftLon(lonTicks),
  latTicks:        shiftLat(latTicks),
  lonTicksTop:     shiftLon(lonTicksTop),
  lonTicksBottom:  shiftLon(lonTicksBottom),
  latTicksLeft:    shiftLat(latTicksLeft),
  latTicksRight:   shiftLat(latTicksRight),
};

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(result));
console.log(`Wrote ${OUT_PATH}`);
console.log(`Calibration: mapLeft=${result.mapLeft}, mapWidth=${result.mapWidth}, equatorY=${result.equatorY}, mercRadius=${result.mercRadius}`);
console.log(`Ticks: lon=${result.lonTicks.length}, lat=${result.latTicks.length}`);
