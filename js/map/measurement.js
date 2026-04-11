import { EventEmitter } from '../utils/events.js';

/**
 * Manages pixel ↔ cm conversion and display mode.
 */
export class Measurement extends EventEmitter {
  constructor() {
    super();
    this.pixelsPerCm = null;
    this.mode = 'px'; // 'px' | 'cm'
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
}
