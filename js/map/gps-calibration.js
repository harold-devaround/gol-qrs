/**
 * GPS graduation detection from WorldMap image borders.
 *
 * Detects tick marks at the top and left borders of the WorldMap image, then
 * derives the Mercator GPS calibration parameters used for lon/lat conversion.
 *
 * Fallback constants were derived by pixel-analysing the actual
 * 2019_WorldMap_MHF_1.2x1.6m.jpg (4449×3456 px, CMYK JPEG):
 *   – Longitude ticks: scan strip y=65–85, 23 marks at 15° intervals
 *   – Latitude  ticks: scan column x=55–100, 11 marks at 15° intervals
 *   – 0°/0° is at the image centre: lon=0 at x≈2224, lat=0 at y≈1726
 */

/**
 * GPS calibration constants derived from the detected 15° tick marks.
 *  mapLeft   – x pixel where longitude = −180°
 *  mapWidth  – pixels spanning 360° of longitude
 *  equatorY  – y pixel where latitude  = 0°
 *  mercRadius– Mercator Earth radius in pixels (px per radian)
 */
export const DEFAULT_CALIBRATION = {
  mapLeft:    148,
  mapWidth:   4149,
  equatorY:   1726,
  mercRadius: 657,
};

// ---------------------------------------------------------------------------
// Pure computation helpers (unit-testable without DOM)
// ---------------------------------------------------------------------------

/**
 * Given a brightness array for a 1-D strip, return the center x (or y)
 * positions of dark "dips" (local minima below `threshold`).
 *
 * @param {number[]} profile  – brightness values indexed by position
 * @param {number}   threshold
 * @param {number}   minGap   – minimum gap between separate groups
 * @returns {number[]} sorted array of group-centre positions
 */
export function findTickCenters(profile, threshold, minGap = 20) {
  const dark = [];
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] < threshold) dark.push(i);
  }
  if (dark.length === 0) return [];

  const centers = [];
  let start = dark[0];
  let prev  = dark[0];
  for (let k = 1; k < dark.length; k++) {
    if (dark[k] > prev + minGap) {
      centers.push(Math.round((start + prev) / 2));
      start = dark[k];
    }
    prev = dark[k];
  }
  centers.push(Math.round((start + prev) / 2));
  return centers;
}

/**
 * Compute GPS calibration parameters from detected tick center positions.
 *
 * @param {number[]} lonTicksX  – x positions of 15° longitude ticks (at least 2)
 *                                Assumed to start at −165° and end at +165°
 *                                (i.e. length = 23).
 * @param {number[]} latTicksY  – y positions of 15° latitude ticks (at least 2)
 *                                Order: 75°N first, 75°S last (length = 11).
 * @returns {object} calibration – { mapLeft, mapWidth, equatorY, mercRadius }
 */
export function computeCalibration(lonTicksX, latTicksY) {
  const cal = { ...DEFAULT_CALIBRATION };

  // ── Longitude calibration ────────────────────────────────────────────────
  if (lonTicksX && lonTicksX.length >= 2) {
    // Assign expected longitude values; first tick = −165°
    const n = lonTicksX.length;
    // Build lon → x table using least-squares (linear)
    const lonStep = 15;
    const firstLon = -165;
    // mapWidth = span_x / span_lon * 360
    const spanX   = lonTicksX[n - 1] - lonTicksX[0];
    const spanLon = (n - 1) * lonStep; // degrees
    cal.mapWidth = Math.round(spanX / spanLon * 360);
    // mapLeft = x_first - (firstLon + 180) / 360 * mapWidth
    cal.mapLeft = Math.round(lonTicksX[0] - (firstLon + 180) / 360 * cal.mapWidth);
  }

  // ── Latitude calibration (Mercator) ─────────────────────────────────────
  if (latTicksY && latTicksY.length >= 2) {
    // lat values top→bottom: 75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75
    const latValues = [75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75];
    const n = latTicksY.length;
    // Find equator (lat=0)
    const eqIdx = latValues.indexOf(0);
    if (eqIdx >= 0 && eqIdx < n) {
      cal.equatorY = latTicksY[eqIdx];
    }
    // Compute mercRadius from all non-equator ticks
    const rValues = [];
    for (let i = 0; i < n; i++) {
      const lat = latValues[i];
      if (lat === 0) continue;
      const yMercExpected = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
      const R = Math.abs(cal.equatorY - latTicksY[i]) / Math.abs(yMercExpected);
      rValues.push(R);
    }
    if (rValues.length > 0) {
      cal.mercRadius = Math.round(rValues.reduce((a, b) => a + b, 0) / rValues.length);
    }
  }

  return cal;
}

// ---------------------------------------------------------------------------
// Runtime detection from image pixel data (browser / canvas)
// ---------------------------------------------------------------------------

/**
 * Extract the column-brightness profile from an RGBA pixel strip.
 * @param {Uint8ClampedArray} data   – ImageData.data (RGBA)
 * @param {number}            width  – strip width in pixels
 * @param {number}            height – strip height in pixels
 * @returns {number[]} brightness[x] = min brightness across all rows for column x
 */
export function columnProfile(data, width, height) {
  const profile = new Array(width).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const br = Math.round((r + g + b) / 3);
      if (br < profile[x]) profile[x] = br;
    }
  }
  return profile;
}

/**
 * Extract the row-brightness profile from an RGBA pixel strip.
 * @param {Uint8ClampedArray} data   – ImageData.data (RGBA)
 * @param {number}            width  – strip width in pixels
 * @param {number}            height – strip height in pixels
 * @returns {number[]} brightness[y] = min brightness across all cols for row y
 */
export function rowProfile(data, width, height) {
  const profile = new Array(height).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const br = Math.round((r + g + b) / 3);
      if (br < profile[y]) profile[y] = br;
    }
  }
  return profile;
}

/**
 * Detect GPS graduation tick marks from the WorldMap image.
 *
 * Reads pixel data from small border strips of the image (avoids loading the
 * full image into memory). Returns computed calibration or DEFAULT_CALIBRATION
 * if detection produces implausible results.
 *
 * @param {HTMLImageElement} img – fully loaded image element
 * @returns {object} calibration – { mapLeft, mapWidth, equatorY, mercRadius,
 *                                   lonTicks, latTicks }
 *                   lonTicks: [{x, lon}] detected longitude ticks
 *                   latTicks: [{y, lat}] detected latitude ticks
 */
export function detectGraduations(img) {
  const W = img.naturalWidth  || img.width;
  const H = img.naturalHeight || img.height;

  // We can only do this if we have access to a canvas (browser environment)
  if (typeof document === 'undefined') {
    return { ...DEFAULT_CALIBRATION, lonTicks: [], latTicks: [] };
  }

  const tmpCanvas = document.createElement('canvas');
  const ctx = tmpCanvas.getContext('2d');
  if (!ctx) {
    return { ...DEFAULT_CALIBRATION, lonTicks: [], latTicks: [] };
  }

  // ── Detect longitude ticks ───────────────────────────────────────────────
  // Scan horizontal strip y=65–85: tick marks have brightness ~144 on a 255 background
  const LON_Y0 = 65, LON_H = 20;
  tmpCanvas.width = W;
  tmpCanvas.height = LON_H;
  ctx.clearRect(0, 0, W, LON_H);
  ctx.drawImage(img, 0, LON_Y0, W, LON_H, 0, 0, W, LON_H);
  const lonImageData = ctx.getImageData(0, 0, W, LON_H);
  const colBr = columnProfile(lonImageData.data, W, LON_H);

  // Adaptive threshold: median brightness of the strip minus offset
  const sortedBr = [...colBr].sort((a, b) => a - b);
  const medBr = sortedBr[Math.floor(sortedBr.length / 2)];
  const lonThreshold = Math.min(medBr - 15, 200);

  // Exclude outer frame (first/last ~50 px are always dark border lines)
  for (let x = 0; x < 55; x++) colBr[x] = 255;
  for (let x = W - 55; x < W; x++) colBr[x] = 255;

  const lonTicksX = findTickCenters(colBr, lonThreshold, 50);

  // ── Detect latitude ticks ────────────────────────────────────────────────
  // Scan vertical strip x=55–100 (left margin where tick marks are located)
  const LAT_X0 = 55, LAT_W = 45;
  tmpCanvas.width = LAT_W;
  tmpCanvas.height = H;
  ctx.clearRect(0, 0, LAT_W, H);
  ctx.drawImage(img, LAT_X0, 0, LAT_W, H, 0, 0, LAT_W, H);
  const latImageData = ctx.getImageData(0, 0, LAT_W, H);
  const rowBr = rowProfile(latImageData.data, LAT_W, H);

  // Adaptive threshold for lat ticks
  const sortedRowBr = [...rowBr].sort((a, b) => a - b);
  const medRowBr = sortedRowBr[Math.floor(sortedRowBr.length / 2)];
  const latThreshold = Math.min(medRowBr - 20, 200);

  // Exclude top/bottom frame areas
  for (let y = 0; y < 60; y++) rowBr[y] = 255;
  for (let y = H - 60; y < H; y++) rowBr[y] = 255;

  const latTicksY = findTickCenters(rowBr, latThreshold, 50);

  // ── Validate and build calibration ──────────────────────────────────────
  const LON_EXPECTED = 23;  // -165° to +165° at 15° intervals
  const LAT_EXPECTED = 11;  // +75° to -75° at 15° intervals

  // Only accept if we got roughly the right number of ticks
  const lonOk = lonTicksX.length >= LON_EXPECTED - 4 && lonTicksX.length <= LON_EXPECTED + 2;
  const latOk = latTicksY.length >= LAT_EXPECTED - 2 && latTicksY.length <= LAT_EXPECTED + 2;

  const calInput = computeCalibration(
    lonOk ? lonTicksX : null,
    latOk ? latTicksY : null,
  );

  // Sanity checks on derived values
  const mapWidthOk   = calInput.mapWidth   > 3000 && calInput.mapWidth   < 6000;
  const mercRadiusOk = calInput.mercRadius > 400  && calInput.mercRadius < 1000;

  const calibration = {
    mapLeft:    mapWidthOk ? calInput.mapLeft    : DEFAULT_CALIBRATION.mapLeft,
    mapWidth:   mapWidthOk ? calInput.mapWidth   : DEFAULT_CALIBRATION.mapWidth,
    equatorY:   latOk      ? calInput.equatorY   : DEFAULT_CALIBRATION.equatorY,
    mercRadius: mercRadiusOk ? calInput.mercRadius : DEFAULT_CALIBRATION.mercRadius,
  };

  // Build annotated tick arrays for grid overlay
  const lonTicks = lonTicksX.map((x, i) => ({ x, lon: -165 + i * 15 }));
  const latValues = [75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75];
  const latTicks = latTicksY.map((y, i) => ({ y, lat: latValues[i] ?? null }));

  return { ...calibration, lonTicks, latTicks };
}

/**
 * Interpolate the y-pixel position for a given latitude using adjacent major
 * tick positions and the Mercator relationship.
 *
 * Given two bracketing ticks (above = higher latitude, below = lower latitude),
 * the local Mercator scale is derived from their positions and used to
 * accurately compute the y position of any latitude between them.
 *
 * @param {number} lat   – Target latitude in degrees
 * @param {Array<{y: number, lat: number}>} ticks – Major tick positions sorted
 *                          north-to-south (descending latitude, ascending y)
 * @returns {number|null} Pixel y position, or null if out of tick range
 */
export function interpolateLatY(lat, ticks) {
  if (!ticks || ticks.length < 2) return null;
  const m = (deg) => Math.log(Math.tan(Math.PI / 4 + deg * Math.PI / 360));

  // Find the two adjacent ticks that bracket the requested latitude.
  // Ticks are sorted north-to-south (descending lat, ascending y).
  let above = null, below = null;
  for (const tick of ticks) {
    if (tick.lat > lat) above = tick;
    else if (tick.lat < lat) { below = tick; break; }
    else return tick.y; // exact match
  }
  if (above === null || below === null) return null;

  // Derive the local Mercator scale from the two bracketing ticks.
  // y = y_above + R * (m(above.lat) - m(lat))
  // where R = (above.y - below.y) / (m(below.lat) - m(above.lat))
  const dm = m(below.lat) - m(above.lat); // negative (above.lat > below.lat)
  if (Math.abs(dm) < 1e-10) return null;
  const R = (above.y - below.y) / dm;
  return Math.round(above.y + R * (m(above.lat) - m(lat)));
}

/**
 * Build a complete graduation grid from calibration parameters.
 * Returns arrays of lines to draw as overlay.
 *
 * @param {object} cal – { mapLeft, mapWidth, equatorY, mercRadius }
 * @param {{ lonTicks, latTicks }} detected – optional detected ticks
 * @param {boolean} includeIntermediate – when true, also add 5° intermediate lines
 *                                        tagged with { intermediate: true }
 * @returns {{ lonLines: [{x,lon,intermediate?}], latLines: [{y,lat,intermediate?}] }}
 */
export function buildGradGrid(cal, detected, includeIntermediate = false) {
  // Longitude lines: every 15° from -165 to +165 (major)
  const lonLines = [];
  if (detected?.lonTicks?.length >= 10) {
    for (const t of detected.lonTicks) lonLines.push({ x: t.x, lon: t.lon });
  } else {
    for (let lon = -165; lon <= 165; lon += 15) {
      const x = Math.round(cal.mapLeft + (lon + 180) / 360 * cal.mapWidth);
      lonLines.push({ x, lon });
    }
  }

  // Latitude lines: every 15° from +75 to -75 (major)
  const latLines = [];
  if (detected?.latTicks?.length >= 8) {
    const latValues = [75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75];
    detected.latTicks.forEach((t, i) => {
      if (latValues[i] !== undefined) latLines.push({ y: t.y, lat: latValues[i] });
    });
  } else {
    for (let lat = 75; lat >= -75; lat -= 15) {
      let y;
      if (lat === 0) {
        y = cal.equatorY;
      } else {
        const yMerc = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        y = Math.round(cal.equatorY - yMerc * cal.mercRadius);
      }
      latLines.push({ y, lat });
    }
  }

  // Intermediate lines at 5° intervals (between the 15° major marks)
  if (includeIntermediate) {
    for (let lon = -175; lon <= 175; lon += 5) {
      if (lon % 15 === 0) continue; // already a major line
      const x = Math.round(cal.mapLeft + (lon + 180) / 360 * cal.mapWidth);
      lonLines.push({ x, lon, intermediate: true });
    }

    for (let lat = 70; lat >= -70; lat -= 5) {
      if (lat % 15 === 0) continue; // already a major line
      // Use the already-built major lat lines for Mercator-accurate interpolation
      // so intermediate lines are consistent with the detected/computed major lines.
      let y = interpolateLatY(lat, latLines);
      if (y === null) {
        // Fallback to global calibration constants (should not happen when
        // latLines has ≥ 2 entries covering the requested latitude range)
        const yMerc = lat === 0 ? 0 : Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        y = Math.round(cal.equatorY - yMerc * cal.mercRadius);
      }
      latLines.push({ y, lat, intermediate: true });
    }
  }

  return { lonLines, latLines };
}
