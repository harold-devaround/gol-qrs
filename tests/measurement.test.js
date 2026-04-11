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
});
