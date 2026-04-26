import { EventEmitter } from '../utils/events.js';
import { DEFAULT_CALIBRATION } from './gps-calibration.js';

/**
 * Manages pixel ↔ cm conversion and display mode.
 */
export class Measurement extends EventEmitter {
  constructor() {
    super();
    this.pixelsPerCm = null;
    this.mode = 'px'; // 'px' | 'cm'
    /** GPS calibration — updated by detectGraduations() after image load */
    this.gpsCalibration = { ...DEFAULT_CALIBRATION };
  }

  /**
   * Update GPS calibration from detected graduation data.
   * @param {{ mapLeft, mapWidth, equatorY, mercRadius }} cal
   */
  setGPSCalibration(cal) {
    this.gpsCalibration = { ...DEFAULT_CALIBRATION, ...cal };
    this.emit('change');
  }

  get calibrated() { return this.pixelsPerCm !== null; }

  calibrate(pxDist, cmDist) {
    if (cmDist <= 0) return;
    this.pixelsPerCm = pxDist / cmDist;
    this.emit('change');
  }

  /** Auto-calibrate from an image's pixel height and its known real-world height in cm. */
  calibrateFromImageHeight(heightPx, heightCm) {
    this.calibrate(heightPx, heightCm);
  }

  reset() {
    this.pixelsPerCm = null;
    this.mode = 'px';
    this.emit('change');
  }

  toggleMode() {
    if (!this.calibrated) return;
    this.mode = this.mode === 'px' ? 'cm' : 'px';
    this.emit('change');
  }

  /** Format a pixel distance for display in the current mode. */
  format(px) {
    if (this.mode === 'cm' && this.calibrated) {
      return (px / this.pixelsPerCm).toFixed(2) + ' cm';
    }
    return Math.round(px) + ' px';
  }

  /** Format an area (in px²) for display in the current mode. */
  formatArea(pxSq) {
    if (this.mode === 'cm' && this.calibrated) {
      return (pxSq / (this.pixelsPerCm * this.pixelsPerCm)).toFixed(2) + ' cm²';
    }
    return Math.round(pxSq) + ' px²';
  }

  /** Format world coordinates. */
  formatCoord(x, y) {
    if (this.mode === 'cm' && this.calibrated) {
      return `${(x / this.pixelsPerCm).toFixed(1)}, ${(y / this.pixelsPerCm).toFixed(1)} cm`;
    }
    return `${Math.round(x)}, ${Math.round(y)} px`;
  }

  /** Convert an input value (in current mode) to pixels. */
  toPx(value) {
    if (this.mode === 'cm' && this.calibrated) return value * this.pixelsPerCm;
    return value;
  }

  /** Convert a pixel value to current mode value. */
  fromPx(px) {
    if (this.mode === 'cm' && this.calibrated) return px / this.pixelsPerCm;
    return px;
  }

  /**
   * Convert image-pixel coordinates to GPS (lon, lat) in decimal degrees.
   * Uses the WorldMap Mercator calibration derived from detected border graduations.
   * @returns {{ lon: number, lat: number }}
   */
  toGPS(x, y) {
    const { mapLeft, mapWidth, equatorY, mercRadius } = this.gpsCalibration;
    const lon   = (x - mapLeft) / mapWidth * 360 - 180;
    const yMerc = (equatorY - y) / mercRadius;
    const lat   = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * 180 / Math.PI;
    return { lon, lat };
  }

  /**
   * Format GPS coordinates as a string: "lon: X.XX°  lat: Y.YY°"
   * Signed decimal degrees (negative = West / South).
   */
  formatGPS(x, y) {
    const { lon, lat } = this.toGPS(x, y);
    return `lon: ${lon.toFixed(2)}°  lat: ${lat.toFixed(2)}°`;
  }
}
