import { describe, it, expect, vi } from 'vitest';
import { Measurement } from '../js/map/measurement.js';

describe('Measurement', () => {
  describe('initial state', () => {
    it('starts uncalibrated in px mode', () => {
      const m = new Measurement();
      expect(m.calibrated).toBe(false);
      expect(m.mode).toBe('px');
      expect(m.pixelsPerCm).toBeNull();
    });
  });

  describe('calibrate', () => {
    it('computes pixelsPerCm from pixel and cm distances', () => {
      const m = new Measurement();
      m.calibrate(1728, 160); // WorldMap MHF: 1728px height = 160cm
      expect(m.calibrated).toBe(true);
      expect(m.pixelsPerCm).toBeCloseTo(10.8);
    });

    it('emits change event on calibration', () => {
      const m = new Measurement();
      const spy = vi.fn();
      m.on('change', spy);
      m.calibrate(100, 10);
      expect(spy).toHaveBeenCalledOnce();
    });

    it('ignores zero or negative cm distance', () => {
      const m = new Measurement();
      m.calibrate(100, 0);
      expect(m.calibrated).toBe(false);
      m.calibrate(100, -5);
      expect(m.calibrated).toBe(false);
    });
  });

  describe('calibrateFromImageHeight', () => {
    it('calibrates using image height and known real height in cm', () => {
      const m = new Measurement();
      m.calibrateFromImageHeight(1728, 160);
      expect(m.calibrated).toBe(true);
      expect(m.pixelsPerCm).toBeCloseTo(10.8);
    });
  });

  describe('toggleMode', () => {
    it('switches from px to cm when calibrated', () => {
      const m = new Measurement();
      m.calibrate(1080, 100);
      m.toggleMode();
      expect(m.mode).toBe('cm');
    });

    it('switches back from cm to px', () => {
      const m = new Measurement();
      m.calibrate(1080, 100);
      m.toggleMode();
      m.toggleMode();
      expect(m.mode).toBe('px');
    });

    it('does not toggle when uncalibrated', () => {
      const m = new Measurement();
      m.toggleMode();
      expect(m.mode).toBe('px');
    });
  });

  describe('format', () => {
    it('formats as pixels when in px mode', () => {
      const m = new Measurement();
      expect(m.format(123.7)).toBe('124 px');
    });

    it('formats as cm when calibrated and in cm mode', () => {
      const m = new Measurement();
      m.calibrate(1080, 100); // 10.8 px/cm
      m.toggleMode();
      expect(m.format(108)).toBe('10.00 cm');
    });
  });

  describe('formatCoord', () => {
    it('formats as pixel coords by default', () => {
      const m = new Measurement();
      expect(m.formatCoord(100, 200)).toBe('100, 200 px');
    });

    it('formats as cm coords when in cm mode', () => {
      const m = new Measurement();
      m.calibrate(1080, 100); // 10.8 px/cm
      m.toggleMode();
      expect(m.formatCoord(108, 216)).toBe('10.0, 20.0 cm');
    });
  });

  describe('toPx / fromPx', () => {
    it('converts cm to pixels', () => {
      const m = new Measurement();
      m.calibrate(1080, 100);
      m.toggleMode();
      expect(m.toPx(10)).toBeCloseTo(108);
    });

    it('passes through in px mode', () => {
      const m = new Measurement();
      expect(m.toPx(42)).toBe(42);
    });

    it('converts pixels to cm', () => {
      const m = new Measurement();
      m.calibrate(1080, 100);
      m.toggleMode();
      expect(m.fromPx(108)).toBeCloseTo(10);
    });
  });

  describe('reset', () => {
    it('clears calibration and resets to px mode', () => {
      const m = new Measurement();
      m.calibrate(1080, 100);
      m.toggleMode();
      m.reset();
      expect(m.calibrated).toBe(false);
      expect(m.mode).toBe('px');
    });
  });

  describe('formatArea', () => {
    it('formats as px² in px mode', () => {
      const m = new Measurement();
      expect(m.formatArea(1000)).toBe('1000 px²');
    });

    it('formats as cm² when calibrated and in cm mode', () => {
      const m = new Measurement();
      m.calibrate(100, 10); // 10 px/cm → 100 px²/cm²
      m.toggleMode();
      expect(m.formatArea(10000)).toBe('100.00 cm²');
    });

    it('divides by scale squared', () => {
      const m = new Measurement();
      m.calibrate(1080, 100); // 10.8 px/cm → 116.64 px²/cm²
      m.toggleMode();
      const areaPxSq = 116.64;
      expect(m.formatArea(areaPxSq)).toBe('1.00 cm²');
    });
  });

  describe('toGPS', () => {
    it('returns lon=0 at the Greenwich meridian center pixel', () => {
      const m = new Measurement();
      // x = MAP_LEFT + MAP_WIDTH/2 = 148 + 4150/2 = 2223
      const { lon } = m.toGPS(2223, 1728);
      expect(lon).toBeCloseTo(0, 1);
    });

    it('returns lat=0 at the equator center pixel', () => {
      const m = new Measurement();
      // equator is at y=1728 (image center)
      const { lat } = m.toGPS(2223, 1728);
      expect(lat).toBeCloseTo(0, 1);
    });

    it('returns lat≈75°N at the 75°N graduation mark (y≈391)', () => {
      const m = new Measurement();
      const { lat } = m.toGPS(2223, 391);
      expect(lat).toBeCloseTo(75, 0.5);
    });

    it('returns lat≈60°N at the 60°N graduation mark (y≈860)', () => {
      const m = new Measurement();
      const { lat } = m.toGPS(2223, 860);
      expect(lat).toBeCloseTo(60, 0.5);
    });

    it('returns lat≈45°N at the 45°N graduation mark (y≈1147)', () => {
      const m = new Measurement();
      const { lat } = m.toGPS(2223, 1147);
      expect(lat).toBeCloseTo(45, 0.5);
    });

    it('returns lat≈75°S at the 75°S graduation mark (y≈3059)', () => {
      const m = new Measurement();
      const { lat } = m.toGPS(2223, 3059);
      expect(Math.abs(lat + 75)).toBeLessThan(0.5);
    });

    it('returns lon≈-165° at the first longitude graduation mark (x≈321)', () => {
      const m = new Measurement();
      const { lon } = m.toGPS(321, 1728);
      expect(lon).toBeCloseTo(-165, 1);
    });

    it('returns lon≈165° at the last longitude graduation mark (x≈4125)', () => {
      const m = new Measurement();
      const { lon } = m.toGPS(4125, 1728);
      expect(lon).toBeCloseTo(165, 1);
    });

    it('returns lon=-180° at left edge of map', () => {
      const m = new Measurement();
      const { lon } = m.toGPS(148, 1728);
      expect(lon).toBeCloseTo(-180, 1);
    });

    it('returns lon=+180° at right edge of map', () => {
      const m = new Measurement();
      const { lon } = m.toGPS(4298, 1728);
      expect(lon).toBeCloseTo(180, 1);
    });
  });

  describe('formatGPS', () => {
    it('formats GPS as signed decimal degrees with lon and lat labels', () => {
      const m = new Measurement();
      // At equator + Greenwich: lon≈0, lat≈0
      const result = m.formatGPS(2223, 1728);
      expect(result).toMatch(/lon: [-\d.]+°\s+lat: [-\d.]+°/);
    });

    it('shows negative lon for western longitudes', () => {
      const m = new Measurement();
      // x=148 → lon=-180°
      const result = m.formatGPS(148, 1728);
      expect(result).toContain('lon: -180.00°');
    });

    it('shows negative lat for southern latitudes', () => {
      const m = new Measurement();
      // y=3059 → lat≈-75°S
      const result = m.formatGPS(2223, 3059);
      expect(result).toMatch(/lat: -7[0-9]\.[0-9]+°/);
    });

    it('rounds to 2 decimal places', () => {
      const m = new Measurement();
      const result = m.formatGPS(2223, 1728);
      expect(result).toMatch(/lon: -?\d+\.\d{2}°\s+lat: -?\d+\.\d{2}°/);
    });
  });
});
