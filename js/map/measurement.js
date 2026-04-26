import { EventEmitter } from '../utils/events.js';

/**
 * GPS calibration constants for the WorldMap image (4449×3456 px).
 * Derived from the 15° graduation tick marks on the map borders.
 * The map uses a Mercator cylindrical projection covering ±80° latitude.
 *
 * mapLeft/mapWidth set the longitude linear scale (-180° at x=148, 360° over 4150 px).
 * mapTop is the first content row (~80°N). mercRadius is the Mercator Earth radius
 * in pixels (map_width / 2π). mercTop is the Mercator y-coordinate at the top row,
 * computed as (equator_y − mapTop) / mercRadius where equator_y = imageHeight / 2 = 1728.
 */
const _mercRadius = 4150 / (2 * Math.PI); // ~660.5 px
const _equatorY   = 1728;                 // image center y (imageHeight / 2)
const WORLDMAP_GPS = {
  mapLeft:    148,                                    // x-pixel where longitude = −180°
  mapWidth:   4150,                                   // pixel width spanning 360° of longitude
  mapTop:     105,                                    // y-pixel where map content starts (~80°N)
  mercRadius: _mercRadius,
  mercTop:    (_equatorY - 105) / _mercRadius,        // y_merc at map top ≈ 2.457
};

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

  /**
   * Convert image-pixel coordinates to GPS (lon, lat) in decimal degrees.
   * Uses the WorldMap Mercator calibration derived from its 15° border graduations.
   * @returns {{ lon: number, lat: number }}
   */
  toGPS(x, y) {
    const { mapLeft, mapWidth, mapTop, mercRadius, mercTop } = WORLDMAP_GPS;
    const lon = (x - mapLeft) / mapWidth * 360 - 180;
    const yMerc = mercTop - (y - mapTop) / mercRadius;
    const lat = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * 180 / Math.PI;
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
