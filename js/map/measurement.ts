import { EventEmitter } from '../utils/events.ts';
import { DEFAULT_CALIBRATION, interpolateLonFromX, interpolateLatFromY } from './gps-calibration.ts';

interface GPSCalibration {
  mapLeft: number;
  mapWidth: number;
  equatorY: number;
  mercRadius: number;
  lonTicks?: Array<{ x: number; lon: number }>;
  latTicks?: Array<{ y: number; lat: number }>;
}

/**
 * Manages pixel ↔ cm conversion and display mode.
 */
export class Measurement extends EventEmitter {
  pixelsPerCm: number | null;
  mode: 'px' | 'cm';
  /** GPS calibration — updated by detectGraduations() after image load */
  gpsCalibration: GPSCalibration;

  constructor() {
    super();
    this.pixelsPerCm = null;
    this.mode = 'px';
    this.gpsCalibration = { ...DEFAULT_CALIBRATION };
  }

  /**
   * Update GPS calibration from detected graduation data.
   */
  setGPSCalibration(cal: Partial<GPSCalibration>): void {
    this.gpsCalibration = { ...DEFAULT_CALIBRATION, ...cal };
    this.emit('change');
  }

  get calibrated(): boolean { return this.pixelsPerCm !== null; }

  calibrate(pxDist: number, cmDist: number): void {
    if (cmDist <= 0) return;
    this.pixelsPerCm = pxDist / cmDist;
    this.emit('change');
  }

  /** Auto-calibrate from an image's pixel height and its known real-world height in cm. */
  calibrateFromImageHeight(heightPx: number, heightCm: number): void {
    this.calibrate(heightPx, heightCm);
  }

  reset(): void {
    this.pixelsPerCm = null;
    this.mode = 'px';
    this.emit('change');
  }

  toggleMode(): void {
    if (!this.calibrated) return;
    this.mode = this.mode === 'px' ? 'cm' : 'px';
    this.emit('change');
  }

  /** Format a pixel distance for display in the current mode. */
  format(px: number): string {
    if (this.mode === 'cm' && this.calibrated) {
      return (px / this.pixelsPerCm!).toFixed(2) + ' cm';
    }
    return Math.round(px) + ' px';
  }

  /** Format an area (in px²) for display in the current mode. */
  formatArea(pxSq: number): string {
    if (this.mode === 'cm' && this.calibrated) {
      return (pxSq / (this.pixelsPerCm! * this.pixelsPerCm!)).toFixed(2) + ' cm²';
    }
    return Math.round(pxSq) + ' px²';
  }

  /** Format world coordinates. */
  formatCoord(x: number, y: number): string {
    if (this.mode === 'cm' && this.calibrated) {
      return `${(x / this.pixelsPerCm!).toFixed(1)}, ${(y / this.pixelsPerCm!).toFixed(1)} cm`;
    }
    return `${Math.round(x)}, ${Math.round(y)} px`;
  }

  /** Convert an input value (in current mode) to pixels. */
  toPx(value: number): number {
    if (this.mode === 'cm' && this.calibrated) return value * this.pixelsPerCm!;
    return value;
  }

  /** Convert a pixel value to current mode value. */
  fromPx(px: number): number {
    if (this.mode === 'cm' && this.calibrated) return px / this.pixelsPerCm!;
    return px;
  }

  /**
   * Convert image-pixel coordinates to GPS (lon, lat) in decimal degrees.
   * Uses detected graduation ticks for accurate interpolation when available,
   * falling back to the Mercator formula from global calibration parameters.
   * @returns {{ lon: number, lat: number }}
   */
  toGPS(x: number, y: number): { lon: number; lat: number } {
    const { mapLeft, mapWidth, equatorY, mercRadius, lonTicks, latTicks } = this.gpsCalibration;

    // Prefer direct interpolation from detected graduation ticks (more accurate).
    if (lonTicks && lonTicks.length >= 2 && latTicks && latTicks.length >= 2) {
      const lon = interpolateLonFromX(x, lonTicks);
      const lat = interpolateLatFromY(y, latTicks);
      if (lon !== null && lat !== null) return { lon, lat };
    }

    // Fallback: global Mercator formula from calibration parameters.
    const lon   = (x - mapLeft) / mapWidth * 360 - 180;
    const yMerc = (equatorY - y) / mercRadius;
    const lat   = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * 180 / Math.PI;
    return { lon, lat };
  }

  /**
   * Format GPS coordinates as a string: "lon: X.XX°  lat: Y.YY°"
   * Signed decimal degrees (negative = West / South).
   */
  formatGPS(x: number, y: number): string {
    const { lon, lat } = this.toGPS(x, y);
    return `lon: ${lon.toFixed(2)}°  lat: ${lat.toFixed(2)}°`;
  }
}
