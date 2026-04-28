import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CALIBRATION,
  findTickCenters,
  columnProfile,
  rowProfile,
  blueExcessColumnProfile,
  blueExcessRowProfile,
  computeCalibration,
  buildGradGrid,
  interpolateLatY,
  interpolateLonX,
  interpolateLonFromX,
  interpolateLatFromY,
  LON_EXPECTED,
  LAT_EXPECTED,
  LON_TOL,
  LAT_TOL,
  LON_Y0,
  LON_H,
  LON_Y0_BOT,
  LON_H_BOT,
  LAT_X0,
  LAT_W,
  LAT_X0_RIGHT,
  LAT_W_RIGHT,
} from '../js/map/gps-calibration.js';

describe('DEFAULT_CALIBRATION', () => {
  it('has expected calibration constants', () => {
    expect(DEFAULT_CALIBRATION.mapLeft).toBe(148);
    expect(DEFAULT_CALIBRATION.mapWidth).toBe(4149);
    expect(DEFAULT_CALIBRATION.equatorY).toBe(1726);
    expect(DEFAULT_CALIBRATION.mercRadius).toBe(657);
  });
});

describe('expected graduation counts', () => {
  it('LON_EXPECTED is 361 (−180° to +180° inclusive)', () => {
    expect(LON_EXPECTED).toBe(361);
  });

  it('LAT_EXPECTED is 181 (−90° to +90° inclusive)', () => {
    expect(LAT_EXPECTED).toBe(181);
  });

  it('top and bottom borders have the same expected LON count', () => {
    // Verify the constant itself has the right value for ±180° + zero
    expect(LON_EXPECTED).toBe(360 + 1);
  });

  it('left and right borders have the same expected LAT count', () => {
    // Verify the constant itself has the right value for ±90° + zero
    expect(LAT_EXPECTED).toBe(180 + 1);
  });
});


describe('findTickCenters', () => {
  it('returns empty array when no dark pixels', () => {
    const profile = new Array(100).fill(200);
    expect(findTickCenters(profile, 100)).toEqual([]);
  });

  it('finds single isolated dark spot', () => {
    const profile = new Array(200).fill(200);
    profile[50] = 50;
    profile[51] = 60;
    const centers = findTickCenters(profile, 100, 20);
    expect(centers).toHaveLength(1);
    // Weighted centroid: w50=(100-50)=50, w51=(100-60)=40
    // center = round((50*50 + 51*40) / 90) = round(50.44) = 50
    expect(centers[0]).toBe(50);
  });

  it('finds two separated groups', () => {
    const profile = new Array(500).fill(200);
    // First group around x=100
    for (let i = 98; i <= 102; i++) profile[i] = 60;
    // Second group around x=300
    for (let i = 298; i <= 302; i++) profile[i] = 60;
    const centers = findTickCenters(profile, 100, 20);
    expect(centers).toHaveLength(2);
    expect(centers[0]).toBeCloseTo(100, 0);
    expect(centers[1]).toBeCloseTo(300, 0);
  });

  it('finds 23 evenly-spaced groups simulating lon ticks', () => {
    const profile = new Array(4449).fill(200);
    const expectedX = [];
    for (let i = 0; i < 23; i++) {
      const x = 324 + i * 173;
      expectedX.push(x);
      profile[x - 1] = 90;
      profile[x]     = 80;
      profile[x + 1] = 90;
    }
    const centers = findTickCenters(profile, 95, 50);
    expect(centers).toHaveLength(23);
    centers.forEach((c, i) => expect(c).toBeCloseTo(expectedX[i], 0));
  });
});

describe('columnProfile', () => {
  it('returns 255 for fully white strip', () => {
    const data = new Uint8ClampedArray(4 * 10 * 5).fill(255); // 10×5 RGBA
    const profile = columnProfile(data, 10, 5);
    expect(profile).toHaveLength(10);
    profile.forEach(v => expect(v).toBe(255));
  });

  it('picks minimum brightness across rows for each column', () => {
    // 3×2 image (width=3, height=2), RGBA
    const data = new Uint8ClampedArray([
      // Row 0: col0=(255,255,255), col1=(100,100,100), col2=(200,200,200)
      255, 255, 255, 255,   100, 100, 100, 255,   200, 200, 200, 255,
      // Row 1: col0=(50,50,50),   col1=(200,200,200), col2=(150,150,150)
       50,  50,  50, 255,   200, 200, 200, 255,   150, 150, 150, 255,
    ]);
    const profile = columnProfile(data, 3, 2);
    expect(profile[0]).toBe(50);   // min(255, 50)
    expect(profile[1]).toBe(100);  // min(100, 200)
    expect(profile[2]).toBe(150);  // min(200, 150)
  });
});

describe('rowProfile', () => {
  it('returns 255 for fully white strip', () => {
    const data = new Uint8ClampedArray(4 * 5 * 10).fill(255); // 5×10 RGBA
    const profile = rowProfile(data, 5, 10);
    expect(profile).toHaveLength(10);
    profile.forEach(v => expect(v).toBe(255));
  });

  it('picks minimum brightness across columns for each row', () => {
    // 3×2 image, RGBA
    const data = new Uint8ClampedArray([
      // Row 0: col0=(255,255,255), col1=(100,100,100), col2=(200,200,200)
      255, 255, 255, 255,   100, 100, 100, 255,   200, 200, 200, 255,
      // Row 1: col0=(50,50,50),   col1=(200,200,200), col2=(150,150,150)
       50,  50,  50, 255,   200, 200, 200, 255,   150, 150, 150, 255,
    ]);
    const profile = rowProfile(data, 3, 2);
    expect(profile[0]).toBe(100);  // min of row 0
    expect(profile[1]).toBe(50);   // min of row 1
  });
});

describe('computeCalibration', () => {
  it('derives mapWidth and mapLeft from 23 lon ticks', () => {
    // Simulate 23 ticks at x=324..4118, spaced by 173 px
    const lonTicks = Array.from({ length: 23 }, (_, i) => 324 + i * 173);
    const cal = computeCalibration(lonTicks, null);
    // span = 22*173 = 3806 px, degrees = 330° → mapWidth ≈ 3806/330*360 ≈ 4152
    expect(cal.mapWidth).toBeGreaterThan(3000);
    expect(cal.mapWidth).toBeLessThan(5000);
    // -165° at x=324: mapLeft = 324 - 15/360*mapWidth
    const expectedMapLeft = 324 - (15 / 360) * cal.mapWidth;
    expect(cal.mapLeft).toBeCloseTo(expectedMapLeft, 0);
  });

  it('derives equatorY and mercRadius from 11 lat ticks', () => {
    // Use the actual detected positions from the image analysis
    const latTicks = [391, 860, 1147, 1365, 1552, 1726, 1900, 2086, 2305, 2592, 3059];
    const cal = computeCalibration(null, latTicks);
    expect(cal.equatorY).toBe(1726);
    expect(cal.mercRadius).toBeGreaterThan(600);
    expect(cal.mercRadius).toBeLessThan(750);
    expect(cal.mercRadius).toBeCloseTo(657, -1); // within 10
  });

  it('falls back to defaults when no ticks provided', () => {
    const cal = computeCalibration(null, null);
    expect(cal.mapLeft).toBe(DEFAULT_CALIBRATION.mapLeft);
    expect(cal.mapWidth).toBe(DEFAULT_CALIBRATION.mapWidth);
    expect(cal.equatorY).toBe(DEFAULT_CALIBRATION.equatorY);
    expect(cal.mercRadius).toBe(DEFAULT_CALIBRATION.mercRadius);
  });

  it('uses real detected positions and produces accurate GPS', () => {
    const lonTicks = [321, 493, 666, 839, 1012, 1184, 1357, 1530, 1703, 1876,
      2049, 2221, 2395, 2568, 2740, 2913, 3086, 3259, 3432, 3605, 3778, 3951, 4124];
    const latTicks = [391, 860, 1147, 1365, 1552, 1726, 1900, 2086, 2305, 2592, 3059];
    const cal = computeCalibration(lonTicks, latTicks);

    // -165° tick at x=321
    const lon165 = (321 - cal.mapLeft) / cal.mapWidth * 360 - 180;
    expect(lon165).toBeCloseTo(-165, 0.5);

    // Equator at y=1726
    const yMerc0 = (cal.equatorY - 1726) / cal.mercRadius;
    const lat0 = (2 * Math.atan(Math.exp(yMerc0)) - Math.PI / 2) * 180 / Math.PI;
    expect(lat0).toBeCloseTo(0, 1);

    // 75°N at y=391
    const yMerc75 = (cal.equatorY - 391) / cal.mercRadius;
    const lat75 = (2 * Math.atan(Math.exp(yMerc75)) - Math.PI / 2) * 180 / Math.PI;
    expect(lat75).toBeCloseTo(75, 0.5);
  });
});

describe('buildGradGrid', () => {
  it('returns 23 lon lines and 11 lat lines with default calibration', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, null);
    expect(grid.lonLines).toHaveLength(23);
    expect(grid.latLines).toHaveLength(11);
  });

  it('lon lines span -165° to +165° at 15° intervals', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, null);
    expect(grid.lonLines[0].lon).toBe(-165);
    expect(grid.lonLines[22].lon).toBe(165);
    for (let i = 1; i < 23; i++) {
      expect(grid.lonLines[i].lon - grid.lonLines[i - 1].lon).toBe(15);
    }
  });

  it('lat lines span +75° to -75° at 15° intervals', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, null);
    expect(grid.latLines[0].lat).toBe(75);
    expect(grid.latLines[10].lat).toBe(-75);
    for (let i = 1; i < 11; i++) {
      expect(grid.latLines[i - 1].lat - grid.latLines[i].lat).toBe(15);
    }
  });

  it('uses detected tick positions when provided', () => {
    const detected = {
      lonTicks: Array.from({ length: 23 }, (_, i) => ({ x: 324 + i * 173, lon: -165 + i * 15 })),
      latTicks: [387, 857, 1145, 1364, 1551, 1726, 1900, 2087, 2306, 2594, 3064]
        .map((y, i) => ({ y, lat: 75 - i * 15 })),
    };
    const grid = buildGradGrid(DEFAULT_CALIBRATION, detected);
    expect(grid.lonLines).toHaveLength(23);
    expect(grid.lonLines[0].x).toBe(324);
    expect(grid.latLines[0].y).toBe(387);
  });

  it('includes intermediate 1° lines when includeIntermediate is true', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, null, true);
    // Major lines still present (23 lon + 11 lat)
    const majorLon = grid.lonLines.filter(l => !l.intermediate);
    const majorLat = grid.latLines.filter(l => !l.intermediate);
    expect(majorLon).toHaveLength(23);
    expect(majorLat).toHaveLength(11);
    // Intermediate lines added
    const intermLon = grid.lonLines.filter(l => l.intermediate);
    const intermLat = grid.latLines.filter(l => l.intermediate);
    expect(intermLon.length).toBeGreaterThan(0);
    expect(intermLat.length).toBeGreaterThan(0);
    // Intermediate lon lines are at 1° steps, not multiples of 15
    for (const l of intermLon) {
      expect(l.lon % 15 !== 0).toBe(true);
      expect(Number.isInteger(l.lon)).toBe(true);
    }
    // Intermediate lat lines are at 1° steps, not multiples of 15
    for (const l of intermLat) {
      expect(l.lat % 15 !== 0).toBe(true);
      expect(Number.isInteger(l.lat)).toBe(true);
    }
  });

  it('does not include intermediate lines by default', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, null);
    expect(grid.lonLines.every(l => !l.intermediate)).toBe(true);
    expect(grid.latLines.every(l => !l.intermediate)).toBe(true);
    expect(grid.lonLines).toHaveLength(23);
    expect(grid.latLines).toHaveLength(11);
  });

  it('intermediate lat lines are between their adjacent major lines (Mercator spacing)', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, null, true);
    const major = grid.latLines.filter(l => !l.intermediate);
    for (const inter of grid.latLines.filter(l => l.intermediate)) {
      // Find the adjacent major lines (above = higher lat, below = lower lat)
      const above = major.find(m => m.lat > inter.lat);
      const below = major.find(m => m.lat < inter.lat);
      expect(above).toBeDefined();
      expect(below).toBeDefined();
      // y of intermediate must be strictly between the two bracketing major lines
      expect(inter.y).toBeGreaterThan(above.y);
      expect(inter.y).toBeLessThan(below.y);
    }
  });

  it('intermediate lat lines with detected ticks are consistent with major detected positions', () => {
    // Use known detected tick positions from the actual map image
    const latTickPositions = [387, 857, 1145, 1364, 1551, 1726, 1900, 2087, 2306, 2594, 3064];
    const detected = {
      lonTicks: Array.from({ length: 23 }, (_, i) => ({ x: 324 + i * 173, lon: -165 + i * 15 })),
      latTicks: latTickPositions.map((y, i) => ({ y, lat: 75 - i * 15 })),
    };
    const grid = buildGradGrid(DEFAULT_CALIBRATION, detected, true);
    const major = grid.latLines.filter(l => !l.intermediate);
    // Major lines should match detected positions exactly
    latTickPositions.forEach((y, i) => {
      expect(major[i].y).toBe(y);
    });
    // Each intermediate line must lie strictly between its adjacent major lines
    for (const inter of grid.latLines.filter(l => l.intermediate)) {
      const above = major.find(m => m.lat > inter.lat);
      const below = major.find(m => m.lat < inter.lat);
      expect(above).toBeDefined();
      expect(below).toBeDefined();
      expect(inter.y).toBeGreaterThan(above.y);
      expect(inter.y).toBeLessThan(below.y);
    }
  });
});

describe('interpolateLatY', () => {
  const ticks = [
    { y: 387,  lat: 75 },
    { y: 857,  lat: 60 },
    { y: 1145, lat: 45 },
    { y: 1364, lat: 30 },
    { y: 1551, lat: 15 },
    { y: 1726, lat: 0  },
    { y: 1900, lat: -15 },
    { y: 2087, lat: -30 },
    { y: 2306, lat: -45 },
    { y: 2594, lat: -60 },
    { y: 3064, lat: -75 },
  ];

  it('returns exact tick y for known major latitudes', () => {
    expect(interpolateLatY(75,  ticks)).toBe(387);
    expect(interpolateLatY(0,   ticks)).toBe(1726);
    expect(interpolateLatY(-75, ticks)).toBe(3064);
  });

  it('interpolated value lies strictly between adjacent major ticks', () => {
    // 70° is between 75° (y=387) and 60° (y=857)
    const y70 = interpolateLatY(70, ticks);
    expect(y70).toBeGreaterThan(387);
    expect(y70).toBeLessThan(857);

    // 5° is between 15° (y=1551) and 0° (y=1726)
    const y5 = interpolateLatY(5, ticks);
    expect(y5).toBeGreaterThan(1551);
    expect(y5).toBeLessThan(1726);

    // -10° is between 0° (y=1726) and -15° (y=1900)
    const ym10 = interpolateLatY(-10, ticks);
    expect(ym10).toBeGreaterThan(1726);
    expect(ym10).toBeLessThan(1900);
  });

  it('spacing is NOT equal — Mercator spacing increases near the poles', () => {
    // In Mercator projection, the same degree interval spans MORE pixels near the poles.
    const y75 = interpolateLatY(75, ticks); // exact match for the first tick
    const y70 = interpolateLatY(70, ticks);
    const y65 = interpolateLatY(65, ticks);
    const gap70_75 = y70 - y75;  // pixels from 75°N to 70°N
    const gap65_70 = y65 - y70;  // pixels from 70°N to 65°N
    // Closer to pole → larger pixel gap
    expect(gap70_75).toBeGreaterThan(gap65_70);
  });

  it('returns null when lat is out of tick range', () => {
    expect(interpolateLatY(80, ticks)).toBeNull();  // above highest tick
    expect(interpolateLatY(-80, ticks)).toBeNull(); // below lowest tick
  });

  it('returns null for empty or single-tick arrays', () => {
    expect(interpolateLatY(0, [])).toBeNull();
    expect(interpolateLatY(0, [{ y: 1726, lat: 0 }])).toBeNull();
  });
});

describe('interpolateLonX', () => {
  const lonLines = [
    { x: 324,  lon: -165 },
    { x: 497,  lon: -150 },
    { x: 670,  lon: -135 },
    { x: 843,  lon: -120 },
    { x: 1016, lon: -105 },
    { x: 1189, lon: -90  },
    { x: 1362, lon: -75  },
    { x: 1535, lon: -60  },
    { x: 1708, lon: -45  },
    { x: 1881, lon: -30  },
    { x: 2054, lon: -15  },
    { x: 2227, lon: 0    },
    { x: 2400, lon: 15   },
    { x: 2573, lon: 30   },
    { x: 2746, lon: 45   },
    { x: 2919, lon: 60   },
    { x: 3092, lon: 75   },
    { x: 3265, lon: 90   },
    { x: 3438, lon: 105  },
    { x: 3611, lon: 120  },
    { x: 3784, lon: 135  },
    { x: 3957, lon: 150  },
    { x: 4130, lon: 165  },
  ];

  it('returns exact x for known major longitudes', () => {
    expect(interpolateLonX(-165, lonLines)).toBe(324);
    expect(interpolateLonX(0,    lonLines)).toBe(2227);
    expect(interpolateLonX(165,  lonLines)).toBe(4130);
  });

  it('interpolated value lies strictly between adjacent major ticks', () => {
    // 7° is between 0° (x=2227) and 15° (x=2400)
    const x7 = interpolateLonX(7, lonLines);
    expect(x7).toBeGreaterThan(2227);
    expect(x7).toBeLessThan(2400);

    // -100° is between -105° (x=1016) and -90° (x=1189)
    const xm100 = interpolateLonX(-100, lonLines);
    expect(xm100).toBeGreaterThan(1016);
    expect(xm100).toBeLessThan(1189);
  });

  it('spacing is equal — longitude mapping is linear (equirectangular)', () => {
    const x1 = interpolateLonX(1, lonLines);
    const x2 = interpolateLonX(2, lonLines);
    const x3 = interpolateLonX(3, lonLines);
    // Rounding to integer pixels can cause ±1px difference; allow 1px tolerance
    expect(Math.abs((x2 - x1) - (x3 - x2))).toBeLessThanOrEqual(1);
  });

  it('returns null when lon is out of tick range', () => {
    expect(interpolateLonX(-170, lonLines)).toBeNull(); // west of -165°
    expect(interpolateLonX(170,  lonLines)).toBeNull(); // east of +165°
  });

  it('returns null for empty or single-tick arrays', () => {
    expect(interpolateLonX(0, [])).toBeNull();
    expect(interpolateLonX(0, [{ x: 2227, lon: 0 }])).toBeNull();
  });

  it('ignores intermediate entries when bracketing', () => {
    const linesWithInter = [
      ...lonLines,
      { x: 2250, lon: 2, intermediate: true },
    ];
    const x1 = interpolateLonX(1, linesWithInter);
    // Should give same result as without the intermediate entry
    const x1_clean = interpolateLonX(1, lonLines);
    expect(x1).toBe(x1_clean);
  });
});

// ── Simulated tick data reused across the two-graduation tests ─────────────
const SIM_LON_X      = [324, 497, 670, 843, 1016, 1189, 1362, 1535, 1708, 1881, 2054, 2227, 2400, 2573, 2746, 2919, 3092, 3265, 3438, 3611, 3784, 3957, 4130];
const SIM_LAT_Y      = [387, 857, 1145, 1364, 1551, 1726, 1900, 2087, 2306, 2594, 3064];
const SIM_LAT_VALUES = [75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75];

/** Build a side's tick array with a per-tick pixel offset. */
function makeLonSide(xs, offset) {
  return xs.map((x, i) => ({ x: x + offset, lon: -165 + i * 15 }));
}
function makeLatSide(ys, offset) {
  return ys.map((y, i) => ({ y: y + offset, lat: SIM_LAT_VALUES[i] }));
}

describe('blueExcessColumnProfile', () => {
  it('returns 255 for a fully white strip', () => {
    // White pixel: R=255, G=255, B=255 → blueExcess=0 → inv=255
    const data = new Uint8ClampedArray(4 * 6 * 4).fill(255);
    const prof = blueExcessColumnProfile(data, 6, 4);
    expect(prof).toHaveLength(6);
    prof.forEach(v => expect(v).toBe(255));
  });

  it('detects a light-blue column in an otherwise-white strip', () => {
    // 5×2 strip, col 2 has light-blue pixels (R=150, G=180, B=230)
    const data = new Uint8ClampedArray(5 * 2 * 4).fill(255);
    for (let row = 0; row < 2; row++) {
      const idx = (row * 5 + 2) * 4;
      data[idx]     = 150; // R
      data[idx + 1] = 180; // G
      data[idx + 2] = 230; // B
      data[idx + 3] = 255; // A
    }
    const prof = blueExcessColumnProfile(data, 5, 2);
    // col 2: excess = 2*230 - 150 - 180 = 130 → inv = 125 (well below 255)
    expect(prof[2]).toBeLessThan(200);
    // other cols remain white (inv = 255)
    [0, 1, 3, 4].forEach(x => expect(prof[x]).toBe(255));
  });

  it('chooses the minimum inverted value (= maximum blue excess) across rows', () => {
    // 3×3 strip: col 1 row 0 is slightly blue, row 1 is more blue, row 2 is white
    const data = new Uint8ClampedArray(3 * 3 * 4).fill(255);
    // row 0 col 1: slight blue (excess = 2*210-200-195 = 25 → inv=230)
    let idx = (0 * 3 + 1) * 4;
    data[idx]=200; data[idx+1]=195; data[idx+2]=210; data[idx+3]=255;
    // row 1 col 1: more blue (excess = 2*240-160-170 = 150 → inv=105)
    idx = (1 * 3 + 1) * 4;
    data[idx]=160; data[idx+1]=170; data[idx+2]=240; data[idx+3]=255;
    const prof = blueExcessColumnProfile(data, 3, 3);
    // Should pick the row with highest blue excess → inv=105
    expect(prof[1]).toBe(105);
  });
});

describe('blueExcessRowProfile', () => {
  it('returns 255 for a fully white strip', () => {
    const data = new Uint8ClampedArray(4 * 4 * 6).fill(255);
    const prof = blueExcessRowProfile(data, 4, 6);
    expect(prof).toHaveLength(6);
    prof.forEach(v => expect(v).toBe(255));
  });

  it('detects a light-blue row in an otherwise-white strip', () => {
    // 4×5 strip, row 2 has light-blue pixels
    const data = new Uint8ClampedArray(4 * 5 * 4).fill(255);
    for (let col = 0; col < 4; col++) {
      const idx = (2 * 4 + col) * 4;
      data[idx]     = 160; // R
      data[idx + 1] = 185; // G
      data[idx + 2] = 230; // B
      data[idx + 3] = 255;
    }
    const prof = blueExcessRowProfile(data, 4, 5);
    // row 2: excess = 2*230-160-185 = 115 → inv = 140
    expect(prof[2]).toBeLessThan(200);
    [0, 1, 3, 4].forEach(y => expect(prof[y]).toBe(255));
  });

  it('is symmetric to blueExcessColumnProfile on transposed data', () => {
    // A single pixel at row=1, col=2 with high blue excess
    const W = 4, H = 4;
    const data = new Uint8ClampedArray(W * H * 4).fill(255);
    const idx = (1 * W + 2) * 4;
    data[idx]=100; data[idx+1]=120; data[idx+2]=220; data[idx+3]=255;
    const colProf = blueExcessColumnProfile(data, W, H);
    const rowProf = blueExcessRowProfile(data, W, H);
    // Column 2 should be low, row 1 should be low
    expect(colProf[2]).toBeLessThan(200);
    expect(rowProf[1]).toBeLessThan(200);
    // Others remain 255
    [0, 1, 3].forEach(x => expect(colProf[x]).toBe(255));
    [0, 2, 3].forEach(y => expect(rowProf[y]).toBe(255));
  });
});

describe('buildGradGrid — grid lines through 2 graduations (one each side)', () => {
  // ── Longitude: each vertical grid line should align with ticks on BOTH
  //    top border (lonTicksTop) AND bottom border (lonTicksBottom) ──────────
  it('each major lon line is within 1 px of a tick on the top border', () => {
    const top    = makeLonSide(SIM_LON_X, 0);
    const bottom = makeLonSide(SIM_LON_X, 1); // 1 px offset
    const grid   = buildGradGrid(DEFAULT_CALIBRATION, { lonTicksTop: top, lonTicksBottom: bottom });
    const major  = grid.lonLines.filter(l => !l.intermediate);
    expect(major).toHaveLength(23);
    for (const line of major) {
      const match = top.find(t => Math.abs(t.x - line.x) <= 1);
      expect(match, `lon ${line.lon}° not within 1px of top tick`).toBeDefined();
    }
  });

  it('each major lon line is within 1 px of a tick on the bottom border', () => {
    const top    = makeLonSide(SIM_LON_X, 0);
    const bottom = makeLonSide(SIM_LON_X, 1);
    const grid   = buildGradGrid(DEFAULT_CALIBRATION, { lonTicksTop: top, lonTicksBottom: bottom });
    const major  = grid.lonLines.filter(l => !l.intermediate);
    for (const line of major) {
      const match = bottom.find(t => Math.abs(t.x - line.x) <= 1);
      expect(match, `lon ${line.lon}° not within 1px of bottom tick`).toBeDefined();
    }
  });

  it('lon grid lines use the average of top and bottom tick x positions', () => {
    const top    = makeLonSide(SIM_LON_X, 0);   // x values: SIM_LON_X
    const bottom = makeLonSide(SIM_LON_X, 2);   // x values: SIM_LON_X + 2
    const grid   = buildGradGrid(DEFAULT_CALIBRATION, { lonTicksTop: top, lonTicksBottom: bottom });
    const major  = grid.lonLines.filter(l => !l.intermediate);
    major.forEach((line, i) => {
      const expected = Math.round((SIM_LON_X[i] + SIM_LON_X[i] + 2) / 2);
      expect(line.x).toBe(expected);
    });
  });

  // ── Latitude: each horizontal grid line should align with ticks on BOTH
  //    left border (latTicksLeft) AND right border (latTicksRight) ──────────
  it('each major lat line is within 1 px of a tick on the left border', () => {
    const left  = makeLatSide(SIM_LAT_Y, 0);
    const right = makeLatSide(SIM_LAT_Y, 1);
    const grid  = buildGradGrid(DEFAULT_CALIBRATION, { latTicksLeft: left, latTicksRight: right });
    const major = grid.latLines.filter(l => !l.intermediate);
    expect(major).toHaveLength(11);
    for (const line of major) {
      const match = left.find(t => Math.abs(t.y - line.y) <= 1);
      expect(match, `lat ${line.lat}° not within 1px of left tick`).toBeDefined();
    }
  });

  it('each major lat line is within 1 px of a tick on the right border', () => {
    const left  = makeLatSide(SIM_LAT_Y, 0);
    const right = makeLatSide(SIM_LAT_Y, 1);
    const grid  = buildGradGrid(DEFAULT_CALIBRATION, { latTicksLeft: left, latTicksRight: right });
    const major = grid.latLines.filter(l => !l.intermediate);
    for (const line of major) {
      const match = right.find(t => Math.abs(t.y - line.y) <= 1);
      expect(match, `lat ${line.lat}° not within 1px of right tick`).toBeDefined();
    }
  });

  it('lat grid lines use the average of left and right tick y positions', () => {
    const left  = makeLatSide(SIM_LAT_Y, 0);
    const right = makeLatSide(SIM_LAT_Y, 4);  // 4 px offset
    const grid  = buildGradGrid(DEFAULT_CALIBRATION, { latTicksLeft: left, latTicksRight: right });
    const major = grid.latLines.filter(l => !l.intermediate);
    major.forEach((line, i) => {
      const expected = Math.round((SIM_LAT_Y[i] + SIM_LAT_Y[i] + 4) / 2);
      expect(line.y).toBe(expected);
    });
  });

  it('falls back to lonTicks when only one side detected for lon', () => {
    const ticks = makeLonSide(SIM_LON_X, 0);
    // Only lonTicks provided (no lonTicksTop/Bottom)
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { lonTicks: ticks });
    const major = grid.lonLines.filter(l => !l.intermediate);
    expect(major).toHaveLength(23);
    major.forEach((line, i) => expect(line.x).toBe(SIM_LON_X[i]));
  });

  it('falls back to latTicks when only one side detected for lat', () => {
    const ticks = makeLatSide(SIM_LAT_Y, 0);
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { latTicks: ticks });
    const major = grid.latLines.filter(l => !l.intermediate);
    expect(major).toHaveLength(11);
    major.forEach((line, i) => expect(line.y).toBe(SIM_LAT_Y[i]));
  });

  it('falls back to calibration formula when no ticks at all', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, null);
    expect(grid.lonLines).toHaveLength(23);
    expect(grid.latLines).toHaveLength(11);
  });
});

// ── 1°-resolution graduation box detection tests ─────────────────────────────

const MAP_LEFT  = 148;
const MAP_WIDTH = 4149;
const EQUATOR_Y = 1726;
const MERC_RADIUS = 657;

describe('computeCalibration — 1°-resolution longitude (graduation boxes)', () => {
  it('derives accurate mapLeft and mapWidth from ~361 1° boundaries spanning ±180°', () => {
    const step = MAP_WIDTH / 360;
    const lonTicks = Array.from({ length: 361 }, (_, i) => Math.round(MAP_LEFT + i * step));
    const cal = computeCalibration(lonTicks, null);
    expect(cal.mapLeft).toBeCloseTo(MAP_LEFT, 0);
    expect(cal.mapWidth).toBeCloseTo(MAP_WIDTH, 5);
  });

  it('derives accurate mapLeft and mapWidth from ~331 1° boundaries spanning ±165°', () => {
    // 331 boundaries starting at −165° (x≈321)
    const step = MAP_WIDTH / 360;
    const x165W = Math.round(MAP_LEFT + 15 * step); // x at −165°
    const lonTicks = Array.from({ length: 331 }, (_, i) => Math.round(x165W + i * step));
    const cal = computeCalibration(lonTicks, null);
    expect(cal.mapLeft).toBeCloseTo(MAP_LEFT, 2);
    expect(cal.mapWidth).toBeCloseTo(MAP_WIDTH, 5);
  });

  it('produces GPS-accurate results: boundary at −180° maps to mapLeft', () => {
    const step = MAP_WIDTH / 360;
    const lonTicks = Array.from({ length: 361 }, (_, i) => Math.round(MAP_LEFT + i * step));
    const cal = computeCalibration(lonTicks, null);
    const lonAtFirst = (lonTicks[0] - cal.mapLeft) / cal.mapWidth * 360 - 180;
    expect(lonAtFirst).toBeCloseTo(-180, 0);
  });

  it('still handles legacy 23-tick input (15°-resolution path)', () => {
    const lonTicks = [321, 493, 666, 839, 1012, 1184, 1357, 1530, 1703, 1876,
      2049, 2221, 2395, 2568, 2740, 2913, 3086, 3259, 3432, 3605, 3778, 3951, 4124];
    const cal = computeCalibration(lonTicks, null);
    const lon165 = (lonTicks[0] - cal.mapLeft) / cal.mapWidth * 360 - 180;
    expect(lon165).toBeCloseTo(-165, 0.5);
  });
});

describe('computeCalibration — 1°-resolution latitude (graduation boxes)', () => {
  const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const latTicks1deg = Array.from({ length: 161 }, (_, i) => {
    const lat = 80 - i;
    return lat === 0 ? EQUATOR_Y : Math.round(EQUATOR_Y - mercY(lat) * MERC_RADIUS);
  });

  it('derives equatorY close to 1726', () => {
    const cal = computeCalibration(null, latTicks1deg);
    expect(cal.equatorY).toBeCloseTo(EQUATOR_Y, 0);
  });

  it('derives mercRadius within 10 of 657', () => {
    const cal = computeCalibration(null, latTicks1deg);
    expect(cal.mercRadius).toBeCloseTo(MERC_RADIUS, -1);
  });

  it('GPS-accuracy: boundary at 75°N maps correctly', () => {
    const cal = computeCalibration(null, latTicks1deg);
    const y75 = latTicks1deg[5]; // index 5 = 80−5 = 75°N
    const yMerc = (cal.equatorY - y75) / cal.mercRadius;
    const lat75 = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * 180 / Math.PI;
    expect(lat75).toBeCloseTo(75, 0.5);
  });

  it('still handles legacy 11-tick input (15°-resolution path)', () => {
    const legacyTicks = [391, 860, 1147, 1365, 1552, 1726, 1900, 2086, 2305, 2592, 3059];
    const cal = computeCalibration(null, legacyTicks);
    expect(cal.equatorY).toBe(EQUATOR_Y);
    expect(cal.mercRadius).toBeCloseTo(MERC_RADIUS, -1);
  });
});

describe('computeCalibration — linear (non-Mercator) lat ticks', () => {
  it('falls back to default mercRadius for linearly-spaced lat ticks', () => {
    // 181 linear ticks evenly spanning IMG_H (simulating ±90° marks)
    const H = 3456;
    const linearTicks = Array.from({ length: 181 }, (_, i) =>
      Math.round(i * H / 180));
    const cal = computeCalibration(null, linearTicks);
    // Linear ticks have high R-value variance → variance check rejects mercRadius
    expect(cal.mercRadius).toBe(DEFAULT_CALIBRATION.mercRadius);
  });

  it('still derives equatorY correctly from linearly-spaced lat ticks', () => {
    // The 0° mark is at i=90: y = round(90 * 3456/180) = round(1728) = 1728
    const H = 3456;
    const linearTicks = Array.from({ length: 181 }, (_, i) =>
      Math.round(i * H / 180));
    const cal = computeCalibration(null, linearTicks);
    // equatorY should be set to the 0° mark (≈1728, very close to default 1726)
    expect(Math.abs(cal.equatorY - DEFAULT_CALIBRATION.equatorY)).toBeLessThan(5);
  });
});


describe('buildGradGrid — 1°-resolution detected ticks', () => {
  const step = MAP_WIDTH / 360;
  const gradLonTicks = Array.from({ length: 361 }, (_, i) => ({
    x: Math.round(MAP_LEFT + i * step),
    lon: -180 + i,
  }));

  const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const gradLatTicks = Array.from({ length: 161 }, (_, i) => {
    const lat = 80 - i;
    const y = lat === 0 ? EQUATOR_Y : Math.round(EQUATOR_Y - mercY(lat) * MERC_RADIUS);
    return { y, lat };
  });

  it('produces exactly 23 major lon lines (−165° to +165° at 15° steps)', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { lonTicks: gradLonTicks });
    const major = grid.lonLines.filter(l => !l.intermediate);
    expect(major).toHaveLength(23);
    expect(major[0].lon).toBe(-165);
    expect(major[22].lon).toBe(165);
  });

  it('major lon lines use detected x positions (not formula)', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { lonTicks: gradLonTicks });
    const major = grid.lonLines.filter(l => !l.intermediate);
    // The −165° boundary is at index 15 (lon = −180 + 15 = −165)
    expect(major[0].x).toBe(gradLonTicks[15].x);
  });

  it('produces exactly 11 major lat lines (+75° to −75° at 15° steps)', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { latTicks: gradLatTicks });
    const major = grid.latLines.filter(l => !l.intermediate);
    expect(major).toHaveLength(11);
    expect(major[0].lat).toBe(75);
    expect(major[10].lat).toBe(-75);
  });

  it('major lat lines use detected y positions (not formula)', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { latTicks: gradLatTicks });
    const major = grid.latLines.filter(l => !l.intermediate);
    // 75°N is at index 80−75=5 in gradLatTicks
    expect(major[0].y).toBe(gradLatTicks[5].y);
  });

  it('intermediate lon lines use detected 1° tick positions when available', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { lonTicks: gradLonTicks }, true);
    const inter = grid.lonLines.filter(l => l.intermediate);
    expect(inter.length).toBeGreaterThan(0);
    // lon=1° is in gradLonTicks at index 181 (lon = −180 + 181 = 1)
    const line1 = inter.find(l => l.lon === 1);
    expect(line1).toBeDefined();
    expect(line1.x).toBe(gradLonTicks[181].x);
  });

  it('intermediate lat lines use detected 1° tick positions when available', () => {
    const grid = buildGradGrid(DEFAULT_CALIBRATION, { latTicks: gradLatTicks }, true);
    const inter = grid.latLines.filter(l => l.intermediate);
    expect(inter.length).toBeGreaterThan(0);
    // lat=1°N is at index 79 in gradLatTicks (80−79=1)
    const line1 = inter.find(l => l.lat === 1);
    expect(line1).toBeDefined();
    expect(line1.y).toBe(gradLatTicks[79].y);
  });
});

// ── Scan-strip constants coverage tests ──────────────────────────────────────

const MAP_TOP   = 116; // inner top border (outer: 107)
const MAP_RIGHT = 4293; // inner right border (outer: 4301)
const IMG_W    = 4449;
const IMG_H    = 3456;

describe('scan-strip constants — coverage of inner borders', () => {
  it('LON strip starts before mapTop', () => {
    expect(LON_Y0).toBeLessThan(MAP_TOP);
  });

  it('LON strip reaches mapTop (top scan crosses inner border)', () => {
    expect(LON_Y0 + LON_H).toBeGreaterThanOrEqual(MAP_TOP);
  });

  it('bottom LON strip starts before mapBottom', () => {
    const mapBottom = IMG_H - MAP_TOP;
    expect(LON_Y0_BOT).toBeLessThanOrEqual(mapBottom);
  });

  it('bottom LON strip covers its stated outer row y=3344', () => {
    // LON_H_BOT must include row 3344 (outer border of bottom graduation area).
    // drawImage draws rows [LON_Y0_BOT, LON_Y0_BOT + LON_H_BOT), so last row = LON_Y0_BOT + LON_H_BOT - 1.
    expect(LON_Y0_BOT + LON_H_BOT - 1).toBeGreaterThanOrEqual(3344);
  });

  it('LAT strip starts before mapLeft', () => {
    expect(LAT_X0).toBeLessThan(MAP_LEFT);
  });

  it('LAT strip reaches mapLeft (left scan crosses inner border)', () => {
    expect(LAT_X0 + LAT_W).toBeGreaterThanOrEqual(MAP_LEFT);
  });

  it('right LAT scan starts at or before mapRight', () => {
    expect(LAT_X0_RIGHT).toBeLessThanOrEqual(MAP_RIGHT);
  });
});

describe('scan-strip detection count — synthetic strips', () => {
  // Helpers to build a synthetic RGBA pixel strip with N evenly-spaced
  // blue-excess "column" boundaries (for LON) or "row" boundaries (for LAT).
  function makeBlueColumnStrip(width, height, boundaries) {
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const x of boundaries) {
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        data[idx]     = 150; // R (low)
        data[idx + 1] = 170; // G (low)
        data[idx + 2] = 235; // B (high) → blue excess = 2*235−150−170=150 → inv=105
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  function makeBlueRowStrip(width, height, boundaries) {
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const y of boundaries) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx]     = 150;
        data[idx + 1] = 170;
        data[idx + 2] = 235;
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  it('detects ~361 LON boundaries in a synthetic full-width strip', () => {
    // 361 boundaries evenly spaced across mapLeft..mapRight (4149 px / 360 steps)
    const step = DEFAULT_CALIBRATION.mapWidth / 360;
    const boundaries = Array.from({ length: 361 }, (_, i) =>
      Math.round(DEFAULT_CALIBRATION.mapLeft + i * step));
    const W = IMG_W, H = LON_H;
    const data = makeBlueColumnStrip(W, H, boundaries);
    const prof = blueExcessColumnProfile(data, W, H);
    // Apply same margin exclusion as detectGraduations
    const margin = DEFAULT_CALIBRATION.mapLeft;
    for (let x = 0; x < margin; x++) prof[x] = 255;
    for (let x = W - margin; x < W; x++) prof[x] = 255;
    const sorted = [...prof].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.min(med - 15, 200);
    const centers = findTickCenters(prof, threshold, 5);
    // Expect close to 361 boundaries (within tolerance 30)
    expect(centers.length).toBeGreaterThanOrEqual(361 - 30);
    expect(centers.length).toBeLessThanOrEqual(361 + 30);
  });

  it('detects ~181 LAT boundaries in a synthetic full-height strip', () => {
    // 181 boundaries: linearly spaced from −90° to +90°, placed within [5, H−5]
    // to be compatible with the corner exclusion of 5 px in detectGraduations
    const W = LAT_W, H = IMG_H;
    const boundaries = Array.from({ length: 181 }, (_, i) =>
      5 + Math.round(i * (H - 10) / 180));
    const data = makeBlueRowStrip(W, H, boundaries);
    const prof = blueExcessRowProfile(data, W, H);
    // Apply same margin exclusion as detectGraduations (5 pixels)
    for (let y = 0; y < 5; y++) prof[y] = 255;
    for (let y = H - 5; y < H; y++) prof[y] = 255;
    const sorted = [...prof].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.min(med - 20, 200);
    const centers = findTickCenters(prof, threshold, 5);
    // Expect close to 181 boundaries (within tolerance 20)
    expect(centers.length).toBeGreaterThanOrEqual(181 - 20);
    expect(centers.length).toBeLessThanOrEqual(181 + 20);
  });

  it('top and bottom LON strips detect equal count for symmetric data', () => {
    // A symmetric strip (same marks in both positions) should produce identical counts
    const step = DEFAULT_CALIBRATION.mapWidth / 360;
    const boundaries = Array.from({ length: 361 }, (_, i) =>
      Math.round(DEFAULT_CALIBRATION.mapLeft + i * step));
    const W = IMG_W, H = LON_H;
    // Both top and bottom strips use the same scan algorithm → same synthetic data
    const dataTop    = makeBlueColumnStrip(W, H, boundaries);
    const dataBottom = makeBlueColumnStrip(W, H, boundaries);
    const margin = DEFAULT_CALIBRATION.mapLeft;
    const getCount = (data) => {
      const prof = blueExcessColumnProfile(data, W, H);
      for (let x = 0; x < margin; x++) prof[x] = 255;
      for (let x = W - margin; x < W; x++) prof[x] = 255;
      const sorted = [...prof].sort((a, b) => a - b);
      const threshold = Math.min(sorted[Math.floor(sorted.length / 2)] - 15, 200);
      return findTickCenters(prof, threshold, 5).length;
    };
    expect(getCount(dataTop)).toBe(getCount(dataBottom));
  });

  it('left and right LAT strips detect equal count for symmetric data', () => {
    // A symmetric strip should produce identical counts on both sides
    const H = IMG_H;
    const boundaries = Array.from({ length: 181 }, (_, i) =>
      5 + Math.round(i * (H - 10) / 180));
    const W = LAT_W;
    const dataLeft  = makeBlueRowStrip(W, H, boundaries);
    const dataRight = makeBlueRowStrip(W, H, boundaries);
    const getCount = (data) => {
      const prof = blueExcessRowProfile(data, W, H);
      for (let y = 0; y < 5; y++) prof[y] = 255;
      for (let y = H - 5; y < H; y++) prof[y] = 255;
      const sorted = [...prof].sort((a, b) => a - b);
      const threshold = Math.min(sorted[Math.floor(sorted.length / 2)] - 20, 200);
      return findTickCenters(prof, threshold, 5).length;
    };
    expect(getCount(dataLeft)).toBe(getCount(dataRight));
  });
});

// ── Known 15°-resolution tick data used for inverse-interpolation tests ──────

const LON_TICKS_15 = [
  { x:  321, lon: -165 }, { x:  494, lon: -150 }, { x:  668, lon: -135 },
  { x:  841, lon: -120 }, { x: 1014, lon: -105 }, { x: 1187, lon:  -90 },
  { x: 1360, lon:  -75 }, { x: 1533, lon:  -60 }, { x: 1706, lon:  -45 },
  { x: 1879, lon:  -30 }, { x: 2052, lon:  -15 }, { x: 2225, lon:    0 },
  { x: 2398, lon:   15 }, { x: 2571, lon:   30 }, { x: 2744, lon:   45 },
  { x: 2917, lon:   60 }, { x: 3090, lon:   75 }, { x: 3263, lon:   90 },
  { x: 3436, lon:  105 }, { x: 3609, lon:  120 }, { x: 3782, lon:  135 },
  { x: 3956, lon:  150 }, { x: 4129, lon:  165 },
];

const LAT_TICKS_15 = [
  { y:  391, lat:  75 }, { y:  860, lat:  60 }, { y: 1147, lat:  45 },
  { y: 1365, lat:  30 }, { y: 1552, lat:  15 }, { y: 1726, lat:   0 },
  { y: 1900, lat: -15 }, { y: 2087, lat: -30 }, { y: 2306, lat: -45 },
  { y: 2594, lat: -60 }, { y: 3064, lat: -75 },
];

describe('interpolateLonFromX', () => {
  it('returns exact lon for a known tick x', () => {
    expect(interpolateLonFromX(321,  LON_TICKS_15)).toBeCloseTo(-165, 5);
    expect(interpolateLonFromX(2225, LON_TICKS_15)).toBeCloseTo(0,    5);
    expect(interpolateLonFromX(4129, LON_TICKS_15)).toBeCloseTo(165,  5);
  });

  it('linearly interpolates lon for x between two ticks', () => {
    // midpoint between 0° (x=2225) and 15° (x=2398): x=2311.5 → lon≈7.5°
    const mid = Math.round((2225 + 2398) / 2);
    const lon = interpolateLonFromX(mid, LON_TICKS_15);
    expect(lon).toBeCloseTo(7.5, 0);
  });

  it('returns null for x before the first tick', () => {
    expect(interpolateLonFromX(100, LON_TICKS_15)).toBeNull();
  });

  it('returns null for x after the last tick', () => {
    expect(interpolateLonFromX(5000, LON_TICKS_15)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(interpolateLonFromX(1000, [])).toBeNull();
  });

  it('returns null for single-element array', () => {
    expect(interpolateLonFromX(1000, [{ x: 1000, lon: 0 }])).toBeNull();
  });

  it('ignores intermediate entries', () => {
    const withInter = [...LON_TICKS_15, { x: 2300, lon: 5, intermediate: true }];
    // x=2300 is between 2225 (0°) and 2398 (15°), should interpolate ~4.3°, not 5°
    const lon = interpolateLonFromX(2300, withInter);
    expect(lon).not.toBeCloseTo(5, 0);
    expect(lon).toBeGreaterThan(0);
    expect(lon).toBeLessThan(15);
  });

  it('is the inverse of interpolateLonX (round-trip)', () => {
    for (const deg of [-165, -90, -15, 0, 45, 165]) {
      const x   = interpolateLonX(deg, LON_TICKS_15);
      const lon = interpolateLonFromX(x, LON_TICKS_15);
      expect(lon).toBeCloseTo(deg, 3);
    }
  });
});

describe('interpolateLatFromY', () => {
  it('returns exact lat for a known tick y', () => {
    expect(interpolateLatFromY(391,  LAT_TICKS_15)).toBeCloseTo(75,  5);
    expect(interpolateLatFromY(1726, LAT_TICKS_15)).toBeCloseTo(0,   5);
    expect(interpolateLatFromY(3064, LAT_TICKS_15)).toBeCloseTo(-75, 5);
  });

  it('returns Mercator-correct lat for y between two ticks', () => {
    // y=1813 is between equator (y=1726, lat=0) and 15°S (y=1900, lat=-15)
    const lat = interpolateLatFromY(1813, LAT_TICKS_15);
    expect(lat).toBeGreaterThan(-15);
    expect(lat).toBeLessThan(0);
  });

  it('returns null for y before the northernmost tick', () => {
    expect(interpolateLatFromY(200, LAT_TICKS_15)).toBeNull();
  });

  it('returns null for y after the southernmost tick', () => {
    expect(interpolateLatFromY(3200, LAT_TICKS_15)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(interpolateLatFromY(1726, [])).toBeNull();
  });

  it('returns null for single-element array', () => {
    expect(interpolateLatFromY(1726, [{ y: 1726, lat: 0 }])).toBeNull();
  });

  it('ignores intermediate entries', () => {
    const withInter = [...LAT_TICKS_15, { y: 1800, lat: -7, intermediate: true }];
    const lat = interpolateLatFromY(1800, withInter);
    expect(lat).not.toBeCloseTo(-7, 0);
    expect(lat).toBeGreaterThan(-15);
    expect(lat).toBeLessThan(0);
  });

  it('is the inverse of interpolateLatY (round-trip)', () => {
    for (const deg of [75, 45, 15, 0, -30, -75]) {
      const y   = interpolateLatY(deg, LAT_TICKS_15);
      const lat = interpolateLatFromY(y, LAT_TICKS_15);
      expect(lat).toBeCloseTo(deg, 3);
    }
  });

  it('Mercator spacing is non-linear: wider near poles than at equator', () => {
    // 1° of latitude near 75°N spans more pixels than 1° near the equator
    const y74N = interpolateLatY(74, LAT_TICKS_15);
    const y75N = interpolateLatY(75, LAT_TICKS_15);
    const y0   = interpolateLatY(0,  LAT_TICKS_15);
    const y1N  = interpolateLatY(1,  LAT_TICKS_15);
    const spacingPolar   = Math.abs(y74N - y75N);
    const spacingEquator = Math.abs(y0   - y1N);
    expect(spacingPolar).toBeGreaterThan(spacingEquator);
  });
});
