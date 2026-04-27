import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CALIBRATION,
  findTickCenters,
  columnProfile,
  rowProfile,
  computeCalibration,
  buildGradGrid,
  interpolateLatY,
} from '../js/map/gps-calibration.js';

describe('DEFAULT_CALIBRATION', () => {
  it('has expected calibration constants', () => {
    expect(DEFAULT_CALIBRATION.mapLeft).toBe(148);
    expect(DEFAULT_CALIBRATION.mapWidth).toBe(4149);
    expect(DEFAULT_CALIBRATION.equatorY).toBe(1726);
    expect(DEFAULT_CALIBRATION.mercRadius).toBe(657);
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
    // center of [50,51] = Math.round((50+51)/2) = 51
    expect(centers[0]).toBe(51);
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

  it('includes intermediate 5° lines when includeIntermediate is true', () => {
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
    // Intermediate lon lines are at 5° steps, not multiples of 15
    for (const l of intermLon) {
      expect(l.lon % 15 !== 0).toBe(true);
      expect(Math.abs(l.lon % 5)).toBe(0);
    }
    // Intermediate lat lines are at 5° steps, not multiples of 15
    for (const l of intermLat) {
      expect(l.lat % 15 !== 0).toBe(true);
      expect(Math.abs(l.lat % 5)).toBe(0);
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
