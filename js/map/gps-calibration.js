/**
 * GPS graduation detection from WorldMap image borders.
 *
 * Detects the 1°-resolution graduation boxes (blue outline, white fill) along
 * all four borders of the WorldMap image, then derives the Mercator GPS
 * calibration parameters used for lon/lat conversion.
 *
 * Image: 2019_WorldMap_MHF_1.2x1.6m.jpg (4449×3456 px, CMYK JPEG)
 *   mapLeft=148, mapWidth=4149, equatorY=1726, mercRadius=657
 *   Graduation boxes: top strip y=107–116, bottom y=3336–3344 (LON),
 *                     left strip x=143–151, right x=4293–4301 (LAT)
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

/**
 * Scan-strip constants for graduation box detection.
 *
 * Outer/inner border coordinates (px):
 *   top:    outer y=107, inner y=116
 *   bottom: inner y=3336, outer y=3344
 *   left:   outer x=143, inner x=151
 *   right:  inner x=4293, outer x=4301
 */
export const LON_Y0       = 107;   // top strip outer y
export const LON_H        = 9;     // top strip height (107→116)
export const LON_Y0_BOT   = 3336;  // bottom strip inner y
export const LON_H_BOT    = 8;     // bottom strip height (3336→3344)
export const LAT_X0       = 143;   // left strip outer x
export const LAT_W        = 8;     // left strip width (143→151)
export const LAT_X0_RIGHT = 4293;  // right strip inner x
export const LAT_W_RIGHT  = 8;     // right strip width (4293→4301)

/**
 * Expected graduation counts and tolerances for detection validation.
 *   LON: 361 boundaries from −180° to +180° (inclusive)
 *   LAT: 181 boundaries from −90° to +90° (inclusive)
 */
export const LON_EXPECTED = 361;
export const LON_TOL      = 30;
export const LAT_EXPECTED = 181;
export const LAT_TOL      = 20;

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
 * Handles two resolutions:
 *   – 1°-resolution (n ≥ 300 lon / n ≥ 100 lat): boundaries of 1° graduation boxes,
 *     as found in the inner graduation strip just before the dark map border.
 *   – 15°-resolution (n < 300 / n < 100): major tick marks in the outer label area
 *     (legacy path, kept for fallback).
 *
 * @param {number[]} lonTicksX  – x positions of detected longitude boundaries
 * @param {number[]} latTicksY  – y positions of detected latitude boundaries
 * @returns {object} calibration – { mapLeft, mapWidth, equatorY, mercRadius }
 */
export function computeCalibration(lonTicksX, latTicksY) {
  const cal = { ...DEFAULT_CALIBRATION };

  // ── Longitude calibration ────────────────────────────────────────────────
  if (lonTicksX && lonTicksX.length >= 2) {
    const n = lonTicksX.length;
    const spanX = lonTicksX[n - 1] - lonTicksX[0];

    if (n >= 300) {
      // 1°-resolution: each detected position is a 1° box boundary.
      // Determine the longitude of the first detected boundary:
      //   – ~361 boundaries → full ±180° coverage → firstLon = −180°
      //   – ~331 boundaries → ±165° coverage      → firstLon = −165°
      const firstLon = (n >= 350) ? -180 : -165;
      const step = spanX / (n - 1);
      cal.mapWidth = Math.round(step * 360);
      cal.mapLeft  = Math.round(lonTicksX[0] - (firstLon + 180) / 360 * cal.mapWidth);
    } else {
      // 15°-resolution: first tick = −165°, ticks every 15°
      const firstLon = -165;
      const spanLon  = (n - 1) * 15;
      cal.mapWidth = Math.round(spanX / spanLon * 360);
      cal.mapLeft  = Math.round(lonTicksX[0] - (firstLon + 180) / 360 * cal.mapWidth);
    }
  }

  // ── Latitude calibration (Mercator) ─────────────────────────────────────
  if (latTicksY && latTicksY.length >= 2) {
    const mercatorY = (deg) => Math.log(Math.tan(Math.PI / 4 + deg * Math.PI / 360));

    if (latTicksY.length >= 100) {
      // 1°-resolution: find the equator boundary by proximity to the default equatorY.
      // Boundaries are labelled lat = eqIdx − i (north-to-south, 1°/step).
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
        // Only accept Mercator-consistent tick sets (low relative stddev).
        // Linearly-spaced ticks produce widely varying R values and are rejected.
        const isMercatorConsistent = rVals.length < 5 ||
          Math.sqrt(rVals.reduce((s, r) => s + (r - mean) ** 2, 0) / rVals.length) / mean < 0.15;
        if (isMercatorConsistent) cal.mercRadius = Math.round(mean);
      }
    } else {
      // 15°-resolution: lat values top→bottom: 75, 60, 45, 30, 15, 0, −15, …, −75
      const latValues = [75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75];
      const n = latTicksY.length;
      const eqIdx = latValues.indexOf(0);
      if (eqIdx >= 0 && eqIdx < n) {
        cal.equatorY = latTicksY[eqIdx];
      }
      const rValues = [];
      for (let i = 0; i < n; i++) {
        const lat = latValues[i];
        if (lat === 0) continue;
        const yMercExpected = mercatorY(lat);
        const R = Math.abs(cal.equatorY - latTicksY[i]) / Math.abs(yMercExpected);
        rValues.push(R);
      }
      if (rValues.length > 0) {
        cal.mercRadius = Math.round(rValues.reduce((a, b) => a + b, 0) / rValues.length);
      }
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
 * Extract a column profile based on blue-channel excess, optimised for detecting
 * light-blue tick marks on a white border background.
 *
 * Each pixel contributes `max(0, 2*B - R - G)` (blue excess).  The profile value
 * for a column is `255 - maxBlueExcess` across all rows so that it can be passed
 * directly to `findTickCenters` (low value = blue tick present).
 *
 * @param {Uint8ClampedArray} data   – ImageData.data (RGBA)
 * @param {number}            width  – strip width in pixels
 * @param {number}            height – strip height in pixels
 * @returns {number[]} profile[x] = 255 − max blue excess across rows for column x
 */
export function blueExcessColumnProfile(data, width, height) {
  const profile = new Array(width).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const excess = Math.max(0, 2 * b - r - g);
      const inv = 255 - excess;
      if (inv < profile[x]) profile[x] = inv;
    }
  }
  return profile;
}

/**
 * Extract a row profile based on blue-channel excess, optimised for detecting
 * light-blue tick marks on a white border background.
 *
 * @param {Uint8ClampedArray} data   – ImageData.data (RGBA)
 * @param {number}            width  – strip width in pixels
 * @param {number}            height – strip height in pixels
 * @returns {number[]} profile[y] = 255 − max blue excess across cols for row y
 */
export function blueExcessRowProfile(data, width, height) {
  const profile = new Array(height).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const excess = Math.max(0, 2 * b - r - g);
      const inv = 255 - excess;
      if (inv < profile[y]) profile[y] = inv;
    }
  }
  return profile;
}

/**
 * Detect GPS graduation tick marks from the WorldMap image.
 *
 * Scans all four border strips using blue-channel excess profiles (light-blue
 * ticks on white background are more reliably detected via chromatic difference
 * than plain brightness). Both the top and bottom borders are scanned for
 * longitude ticks; both the left and right borders for latitude ticks.
 * The x/y positions from opposite sides are averaged for better accuracy.
 *
 * Returns computed calibration or DEFAULT_CALIBRATION if detection produces
 * implausible results.
 *
 * @param {HTMLImageElement} img – fully loaded image element
 * @returns {object} calibration – { mapLeft, mapWidth, equatorY, mercRadius,
 *                                   lonTicks, latTicks,
 *                                   lonTicksTop, lonTicksBottom,
 *                                   latTicksLeft, latTicksRight }
 *   lonTicks / latTicks: [{x/y, lon/lat}] averaged (top+bottom or left+right)
 *   lonTicksTop / lonTicksBottom: tick arrays from each border individually
 *   latTicksLeft / latTicksRight: tick arrays from each border individually
 */
export function detectGraduations(img) {
  const W = img.naturalWidth  || img.width;
  const H = img.naturalHeight || img.height;

  // We can only do this if we have access to a canvas (browser environment)
  if (typeof document === 'undefined') {
    return { ...DEFAULT_CALIBRATION, lonTicks: [], latTicks: [],
             lonTicksTop: [], lonTicksBottom: [], latTicksLeft: [], latTicksRight: [] };
  }

  const tmpCanvas = document.createElement('canvas');
  const ctx = tmpCanvas.getContext('2d');
  if (!ctx) {
    return { ...DEFAULT_CALIBRATION, lonTicks: [], latTicks: [],
             lonTicksTop: [], lonTicksBottom: [], latTicksLeft: [], latTicksRight: [] };
  }

  // Helper: scan a horizontal strip for longitude tick centers.
  // Targets the 1°-graduation box area (just before the dark map border).
  // Uses blue-channel excess to detect the blue outlines of the 1° boxes.
  // minGap=5 detects individual ~11px-wide box boundaries (not 15° clusters).
  const scanLonStrip = (y0, stripH) => {
    tmpCanvas.width = W;
    tmpCanvas.height = stripH;
    ctx.clearRect(0, 0, W, stripH);
    ctx.drawImage(img, 0, y0, W, stripH, 0, 0, W, stripH);
    const imgData = ctx.getImageData(0, 0, W, stripH);
    const prof = blueExcessColumnProfile(imgData.data, W, stripH);
    // Adaptive threshold: values below median indicate blue outlines
    const sorted = [...prof].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.min(med - 15, 200);
    // Exclude corner areas outside the graduation box strip
    // (graduation boxes span from mapLeft to mapRight)
    const margin = DEFAULT_CALIBRATION.mapLeft;
    for (let x = 0; x < margin; x++) prof[x] = 255;
    for (let x = W - margin; x < W; x++) prof[x] = 255;
    return findTickCenters(prof, threshold, 5);
  };

  // Helper: scan a vertical strip for latitude tick centers.
  // Targets the 1°-graduation box area just before the dark left/right border.
  const scanLatStrip = (x0, stripW) => {
    tmpCanvas.width = stripW;
    tmpCanvas.height = H;
    ctx.clearRect(0, 0, stripW, H);
    ctx.drawImage(img, x0, 0, stripW, H, 0, 0, stripW, H);
    const imgData = ctx.getImageData(0, 0, stripW, H);
    const prof = blueExcessRowProfile(imgData.data, stripW, H);
    const sorted = [...prof].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.min(med - 20, 200);
    // Exclude corner areas (graduation boxes start after the map top/bottom margins)
    for (let y = 0; y < 5; y++) prof[y] = 255;
    for (let y = H - 5; y < H; y++) prof[y] = 255;
    return findTickCenters(prof, threshold, 5);
  };

  // ── Detect longitude graduation box boundaries ───────────────────────────
  const lonTopX    = scanLonStrip(LON_Y0, LON_H);
  const lonBottomX = scanLonStrip(LON_Y0_BOT, LON_H_BOT);

  // ── Detect latitude graduation box boundaries ────────────────────────────
  const latLeftY  = scanLatStrip(LAT_X0, LAT_W);
  const latRightY = scanLatStrip(LAT_X0_RIGHT, LAT_W_RIGHT);

  // ── Average opposite-border positions when both sides agree ─────────────
  // 1°-resolution: expect ~361 lon boundaries (±180°) or ~331 (±165°)
  //                expect ~181 lat boundaries (±90°)

  // Use averaged x positions for longitude ticks when both borders match
  let lonTicksX;
  const lonTopOk  = lonTopX.length  >= LON_EXPECTED - LON_TOL && lonTopX.length  <= LON_EXPECTED + LON_TOL;
  const lonBothOk = lonTopOk && lonBottomX.length === lonTopX.length;
  if (lonBothOk) {
    lonTicksX = lonTopX.map((x, i) => Math.round((x + lonBottomX[i]) / 2));
  } else if (lonTopOk) {
    lonTicksX = lonTopX;
  } else {
    lonTicksX = lonBottomX;
  }

  // Use averaged y positions for latitude ticks when both borders match
  let latTicksY;
  const latLeftOk  = latLeftY.length  >= LAT_EXPECTED - LAT_TOL && latLeftY.length  <= LAT_EXPECTED + LAT_TOL;
  const latBothOk  = latLeftOk && latRightY.length === latLeftY.length;
  if (latBothOk) {
    latTicksY = latLeftY.map((y, i) => Math.round((y + latRightY[i]) / 2));
  } else if (latLeftOk) {
    latTicksY = latLeftY;
  } else {
    latTicksY = latRightY;
  }

  // ── Validate and build calibration ──────────────────────────────────────
  const lonOk = lonTicksX.length >= LON_EXPECTED - LON_TOL && lonTicksX.length <= LON_EXPECTED + LON_TOL;
  const latOk = latTicksY.length >= LAT_EXPECTED - LAT_TOL && latTicksY.length <= LAT_EXPECTED + LAT_TOL;

  const calInput = computeCalibration(
    lonOk ? lonTicksX : null,
    latOk ? latTicksY : null,
  );

  // Sanity checks on derived values
  const mapWidthOk   = calInput.mapWidth   > 3000 && calInput.mapWidth   < 6000;
  const mercRadiusOk = calInput.mercRadius > 550  && calInput.mercRadius < 760;

  const calibration = {
    mapLeft:    mapWidthOk   ? calInput.mapLeft    : DEFAULT_CALIBRATION.mapLeft,
    mapWidth:   mapWidthOk   ? calInput.mapWidth   : DEFAULT_CALIBRATION.mapWidth,
    equatorY:   latOk        ? calInput.equatorY   : DEFAULT_CALIBRATION.equatorY,
    mercRadius: mercRadiusOk ? calInput.mercRadius : DEFAULT_CALIBRATION.mercRadius,
  };

  // ── Annotate detected tick arrays with their degree values ───────────────
  // Longitude: first boundary is at firstLon (-180° for ~361 detected, else -165°)
  const lonFirstLon = (lonTicksX.length >= 350) ? -180 : -165;
  const lonTicks       = lonTicksX.map((x, i)  => ({ x, lon: lonFirstLon + i }));
  const lonTicksTop    = lonTopX.map((x, i)     => ({ x, lon: lonFirstLon + i }));
  const lonTicksBottom = lonBottomX.map((x, i)  => ({ x, lon: lonFirstLon + i }));

  // Latitude: find equator boundary (closest to known equatorY ≈ 1726)
  const eqDefault = DEFAULT_CALIBRATION.equatorY;
  const latEqIdx = latTicksY.length > 0
    ? latTicksY.reduce((best, y, i) =>
        Math.abs(y - eqDefault) < Math.abs(latTicksY[best] - eqDefault) ? i : best, 0)
    : 0;
  const latTicks       = latTicksY.map((y, i)   => ({ y, lat: latEqIdx - i }));
  const latTicksLeft   = latLeftY.map((y, i)     => ({ y, lat: latEqIdx - i }));
  const latTicksRight  = latRightY.map((y, i)    => ({ y, lat: latEqIdx - i }));

  return { ...calibration, lonTicks, latTicks, lonTicksTop, lonTicksBottom, latTicksLeft, latTicksRight };
}

/**
 * Interpolate the x-pixel position for a given longitude using adjacent major
 * tick positions and linear interpolation (longitude mapping is equirectangular).
 *
 * @param {number} lon   – Target longitude in degrees
 * @param {Array<{x: number, lon: number}>} lonLines – Major tick positions sorted
 *                          west-to-east (ascending longitude, ascending x).
 *                          Only non-intermediate entries are used.
 * @returns {number|null} Pixel x position, or null if out of tick range
 */
export function interpolateLonX(lon, lonLines) {
  if (!lonLines || lonLines.length < 2) return null;
  const majors = lonLines.filter(l => !l.intermediate);
  if (majors.length < 2) return null;
  let left = null, right = null;
  for (const tick of majors) {
    if (tick.lon <= lon) left = tick;
    else if (right === null) { right = tick; break; }
  }
  if (left === null) return null;
  if (left.lon === lon) return left.x; // exact match (handles right boundary too)
  if (right === null) return null;
  const t = (lon - left.lon) / (right.lon - left.lon);
  return Math.round(left.x + t * (right.x - left.x));
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
 * Handles both 1°-resolution detected ticks (from the graduation box strip) and
 * legacy 15°-resolution ticks.  For major (15°) lines, only entries whose lon/lat
 * is a multiple of 15° and within ±165°/±75° are kept.  For intermediate (1°)
 * lines, directly-detected positions are preferred over interpolation.
 *
 * @param {object} cal – { mapLeft, mapWidth, equatorY, mercRadius }
 * @param {{ lonTicks, latTicks, lonTicksTop, lonTicksBottom,
 *           latTicksLeft, latTicksRight }} detected – optional detected ticks
 * @param {boolean} includeIntermediate – when true, also add 1° intermediate lines
 *                                        tagged with { intermediate: true }
 * @returns {{ lonLines: [{x,lon,intermediate?}], latLines: [{y,lat,intermediate?}] }}
 */
export function buildGradGrid(cal, detected, includeIntermediate = false) {
  // ── Major longitude lines: every 15° from −165° to +165° ─────────────────
  const lonLines = [];
  // Prefer averaged top+bottom tick positions when both borders were detected.
  // Filter to keep only 15°-interval entries within the ±165° range.
  if (detected?.lonTicksTop?.length >= 10 && detected?.lonTicksBottom?.length >= 10
      && detected.lonTicksTop.length === detected.lonTicksBottom.length) {
    for (let i = 0; i < detected.lonTicksTop.length; i++) {
      const top = detected.lonTicksTop[i];
      if (top.lon == null || top.lon % 15 !== 0) continue;
      if (top.lon < -165 || top.lon > 165) continue;
      const bot = detected.lonTicksBottom[i];
      const x = Math.round((top.x + bot.x) / 2);
      lonLines.push({ x, lon: top.lon });
    }
  } else if (detected?.lonTicks?.length >= 10) {
    for (const t of detected.lonTicks) {
      if (t.lon == null || t.lon % 15 !== 0) continue;
      if (t.lon < -165 || t.lon > 165) continue;
      lonLines.push({ x: t.x, lon: t.lon });
    }
  } else {
    for (let lon = -165; lon <= 165; lon += 15) {
      const x = Math.round(cal.mapLeft + (lon + 180) / 360 * cal.mapWidth);
      lonLines.push({ x, lon });
    }
  }

  // ── Major latitude lines: every 15° from +75° to −75° ────────────────────
  const latLines = [];
  // Prefer averaged left+right tick positions when both borders were detected.
  // Filter to keep only 15°-interval entries within the ±75° range.
  if (detected?.latTicksLeft?.length >= 8 && detected?.latTicksRight?.length >= 8
      && detected.latTicksLeft.length === detected.latTicksRight.length) {
    for (let i = 0; i < detected.latTicksLeft.length; i++) {
      const left  = detected.latTicksLeft[i];
      const right = detected.latTicksRight[i];
      const lat   = left.lat ?? right.lat;
      if (lat == null || lat % 15 !== 0) continue;
      if (lat < -75 || lat > 75) continue;
      const y = Math.round((left.y + right.y) / 2);
      latLines.push({ y, lat });
    }
  } else if (detected?.latTicks?.length >= 8) {
    for (const t of detected.latTicks) {
      if (t.lat == null || t.lat % 15 !== 0) continue;
      if (t.lat < -75 || t.lat > 75) continue;
      latLines.push({ y: t.y, lat: t.lat });
    }
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

  // ── Intermediate lines at 1° intervals ───────────────────────────────────
  // When 1°-resolution detected ticks are available (lonTicks.length > 50),
  // use them directly for accurate positions.  Otherwise fall back to
  // interpolation from the major tick positions.
  if (includeIntermediate) {
    if (detected?.lonTicks?.length > 50) {
      for (const t of detected.lonTicks) {
        if (t.lon == null || t.lon % 15 === 0) continue; // skip majors
        if (t.lon < -179 || t.lon > 179) continue;
        lonLines.push({ x: t.x, lon: t.lon, intermediate: true });
      }
    } else {
      for (let lon = -179; lon <= 179; lon += 1) {
        if (lon % 15 === 0) continue;
        let x = interpolateLonX(lon, lonLines);
        if (x === null) {
          x = Math.round(cal.mapLeft + (lon + 180) / 360 * cal.mapWidth);
        }
        lonLines.push({ x, lon, intermediate: true });
      }
    }

    if (detected?.latTicks?.length > 50) {
      for (const t of detected.latTicks) {
        if (t.lat == null || t.lat % 15 === 0) continue; // skip majors
        if (t.lat < -74 || t.lat > 74) continue;
        latLines.push({ y: t.y, lat: t.lat, intermediate: true });
      }
    } else {
      for (let lat = 74; lat >= -74; lat -= 1) {
        if (lat % 15 === 0) continue;
        let y = interpolateLatY(lat, latLines);
        if (y === null) {
          const yMerc = lat === 0 ? 0 : Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
          y = Math.round(cal.equatorY - yMerc * cal.mercRadius);
        }
        latLines.push({ y, lat, intermediate: true });
      }
    }
  }

  return { lonLines, latLines };
}
