import { EventEmitter } from '../utils/events.js';
import { distance, getSnapPoints } from '../utils/geometry.js';

/* global fabric */

/**
 * Fabric.js-based canvas engine — replaces the legacy hand-rolled canvas.js.
 * Maintains the same public API so tools and map-section work unchanged.
 *
 * Fabric handles: render loop, zoom/pan viewport, hi-DPI, mouse/touch events.
 * We keep shapes as POJOs in ShapeStore and sync Fabric objects for rendering.
 */
export class MapCanvas extends EventEmitter {
  constructor(container) {
    super();
    this.container = container;

    // Create the canvas element Fabric needs
    const canvasEl = document.createElement('canvas');
    canvasEl.className = 'map-canvas';
    canvasEl.tabIndex = 0;
    container.appendChild(canvasEl);

    /** @type {fabric.Canvas} */
    this.fc = new fabric.Canvas(canvasEl, {
      selection: false,           // we handle selection via tools
      renderOnAddRemove: false,   // batch rendering
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      fireMiddleClick: true,
      backgroundColor: '#1a1d27',
    });

    // Alias for backward compat (tools reference canvas.el for cursor, focus, size)
    this.el = this.fc.upperCanvasEl ?? this.fc.lowerCanvasEl ?? canvasEl;

    // State
    this.mapImage = null;
    this._bgImage = null;

    // Snap
    this.snapEnabled = true;
    this.snapThreshold = 10;
    this.currentSnap = null;

    // External callbacks (used by map-section & tools)
    this.onRenderShapes = null;
    this.onRenderPreview = null;

    // Panning state
    this._panning = false;
    this._panStart = null;
    this._spaceDown = false;

    // Pinch-to-zoom state (mobile)
    this._pinching = false;
    this._lastPinchDist = 0;
    this._lastPinchCenter = null;

    this._setupResize();
    this._setupEvents();
    this._setupKeyboard();
    this._setupTouch();
    this._setupOverlay();
  }

  /* ── Zoom / Viewport ───────────────────────────────── */

  get zoom() {
    return this.fc.getZoom();
  }

  get vx() {
    const vpt = this.fc.viewportTransform;
    return -vpt[4] / this.zoom;
  }

  get vy() {
    const vpt = this.fc.viewportTransform;
    return -vpt[5] / this.zoom;
  }

  toScreen(wx, wy) {
    const vpt = this.fc.viewportTransform;
    return {
      x: wx * vpt[0] + vpt[4],
      y: wy * vpt[3] + vpt[5],
    };
  }

  toWorld(sx, sy) {
    const vpt = this.fc.viewportTransform;
    return {
      x: (sx - vpt[4]) / vpt[0],
      y: (sy - vpt[5]) / vpt[3],
    };
  }

  worldRect() {
    const cw = this.fc.width, ch = this.fc.height;
    const tl = this.toWorld(0, 0);
    const br = this.toWorld(cw, ch);
    return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
  }

  zoomAt(sx, sy, factor) {
    const newZoom = Math.max(0.02, Math.min(80, this.zoom * factor));
    this.fc.zoomToPoint(new fabric.Point(sx, sy), newZoom);
    this.requestRender();
  }

  panBy(dsx, dsy) {
    const vpt = this.fc.viewportTransform.slice();
    vpt[4] += dsx;
    vpt[5] += dsy;
    this.fc.setViewportTransform(vpt);
    this.requestRender();
  }

  fitToView(padding = 0.05) {
    const img = this.mapImage;
    if (!img) return;
    const cw = this.fc.width, ch = this.fc.height;
    const scale = Math.min(cw / img.width, ch / img.height) * (1 - padding);
    const cx = cw / 2, cy = ch / 2;
    const vpt = [scale, 0, 0, scale,
      cx - img.width * scale / 2,
      cy - img.height * scale / 2];
    this.fc.setViewportTransform(vpt);
    this.requestRender();
  }

  zoomToFit() { this.fitToView(); }

  getViewState() {
    const cw = this.fc.width, ch = this.fc.height;
    const center = this.toWorld(cw / 2, ch / 2);
    return { zoom: this.zoom, cx: center.x, cy: center.y };
  }

  setViewState({ zoom, cx, cy }) {
    const cw = this.fc.width, ch = this.fc.height;
    const vpt = [zoom, 0, 0, zoom, cw / 2 - cx * zoom, ch / 2 - cy * zoom];
    this.fc.setViewportTransform(vpt);
    this.requestRender();
  }

  requestRender() {
    this.fc.requestRenderAll();
  }

  /* ── Map image ─────────────────────────────────────── */

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.mapImage = img;
        const fImg = new fabric.FabricImage(img, {
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false,
          objectCaching: false,
        });
        this._bgImage = fImg;
        // Put bg image at bottom
        this.fc.insertAt(0, fImg);
        this.fitToView();
        this.emit('image-loaded', img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  /* ── Snap system ───────────────────────────────────── */

  findSnap(worldPt, shapes) {
    if (!this.snapEnabled) return null;
    const threshold = this.snapThreshold / this.zoom;
    let best = null, bestDist = threshold;
    for (const s of shapes) {
      if (!s.visible) continue;
      for (const c of getSnapPoints(s)) {
        const d = distance(worldPt, c);
        if (d < bestDist) { bestDist = d; best = { ...c }; }
      }
    }
    this.currentSnap = best;
    return best;
  }

  /* ── Resize ────────────────────────────────────────── */

  _setupResize() {
    const ro = new ResizeObserver(() => {
      const cw = this.container.clientWidth;
      const ch = this.container.clientHeight;
      this.fc.setDimensions({ width: cw, height: ch });
      this.requestRender();
    });
    ro.observe(this.container);
    // Initial size
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    if (cw && ch) this.fc.setDimensions({ width: cw, height: ch });
  }

  /* ── Overlay rendering (shapes + preview + snap) ───── */

  _setupOverlay() {
    // In Fabric v7, after:render fires for BOTH lower and upper canvas.
    // Only draw our shapes on the lower (main) canvas to avoid ghosting.
    this.fc.on('after:render', ({ ctx }) => {
      if (ctx === this.fc.contextTop) return;
      this._drawOverlay(ctx);
    });
  }

  _drawOverlay(ctx) {
    if (!ctx) return;
    ctx.save();
    // Shapes callback (tools/map-section provides this)
    this.onRenderShapes?.(ctx);
    // Tool preview
    this.onRenderPreview?.(ctx);
    // Snap indicator
    if (this.currentSnap) {
      const sp = this.toScreen(this.currentSnap.x, this.currentSnap.y);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /* ── Mouse / Touch events ──────────────────────────── */

  _canvasXY(e) {
    const r = this.el.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    return { sx: clientX - r.left, sy: clientY - r.top };
  }

  _setupEvents() {
    // Mouse down
    this.fc.on('mouse:down', (opt) => {
      if (this._pinching) return;
      const e = opt.e;
      const { sx, sy } = this._canvasXY(e);

      // Middle button or space+left or right → pan
      if (e.button === 1 || e.button === 2 || (e.button === 0 && this._spaceDown)) {
        this._panning = true;
        this._panStart = { x: sx, y: sy };
        return;
      }

      const wp = this.toWorld(sx, sy);
      this.emit('mousedown', { screen: { x: sx, y: sy }, world: wp, event: e });
    });

    // Mouse move
    this.fc.on('mouse:move', (opt) => {
      if (this._pinching) return;
      const e = opt.e;
      const { sx, sy } = this._canvasXY(e);

      if (this._panning && this._panStart) {
        this.panBy(sx - this._panStart.x, sy - this._panStart.y);
        this._panStart = { x: sx, y: sy };
        return;
      }

      const wp = this.toWorld(sx, sy);
      this.emit('mousemove', { screen: { x: sx, y: sy }, world: wp, event: e });
    });

    // Mouse up
    this.fc.on('mouse:up', (opt) => {
      if (this._pinching) return;
      if (this._panning) {
        this._panning = false;
        this._panStart = null;
        return;
      }
      const e = opt.e;
      const { sx, sy } = this._canvasXY(e);
      const wp = this.toWorld(sx, sy);
      this.emit('mouseup', { screen: { x: sx, y: sy }, world: wp, event: e });
    });

    // Mouse wheel → zoom
    this.fc.on('mouse:wheel', (opt) => {
      const e = opt.e;
      e.preventDefault();
      const { sx, sy } = this._canvasXY(e);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      this.zoomAt(sx, sy, factor);
    });
  }

  /* ── Touch gestures (pinch-to-zoom + 2-finger pan) ─── */
  /*
   * Listeners are attached to the upper canvas (same element as Fabric's listeners).
   * capture:true + stopImmediatePropagation() lets us intercept before Fabric's
   * bubble-phase handlers on the same element, preventing multi-touch from
   * triggering drawing actions.
   */
  _setupTouch() {
    const el = this.el; // upper canvas — where Fabric registers its pointer listeners
    // Upper canvas is created by Fabric without touch-action:none; set it explicitly
    // so the browser forwards pinch/scroll to JS instead of handling natively.
    el.style.touchAction = 'none';

    // Track all active touch pointers by ID
    const active = new Map(); // pointerId → PointerEvent
    // Stable ordered pair of IDs for the current pinch gesture
    let pinchIds = [];

    const getPinchDist = () => {
      const p0 = active.get(pinchIds[0]);
      const p1 = active.get(pinchIds[1]);
      if (!p0 || !p1) return 0;
      return Math.hypot(p1.clientX - p0.clientX, p1.clientY - p0.clientY);
    };
    const getPinchCenter = () => {
      const p0 = active.get(pinchIds[0]);
      const p1 = active.get(pinchIds[1]);
      if (!p0 || !p1) return null;
      return { x: (p0.clientX + p1.clientX) / 2, y: (p0.clientY + p1.clientY) / 2 };
    };

    // Capture phase: fires before Fabric's bubble-phase pointer listeners
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      active.set(e.pointerId, e);
      if (active.size >= 2) {
        // 2nd finger arrived — intercept completely; Fabric must not see this event
        e.stopImmediatePropagation();
        if (!this._pinching) {
          // Lock in the stable pair of pointer IDs for this pinch session
          pinchIds = [...active.keys()].slice(0, 2);
          this._pinching = true;
          this._lastPinchDist = getPinchDist();
          this._lastPinchCenter = getPinchCenter();
          this._panning = false;
          this._panStart = null;
          // Signal active tool to cancel any in-progress action started by finger 1
          this.emit('cancel');
        }
      }
    }, { capture: true });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || !active.has(e.pointerId)) return;
      // Always update position so getPinchCenter/getPinchDist are accurate
      // even when the 2nd finger has not yet arrived.
      active.set(e.pointerId, e);
      if (!this._pinching) return;
      e.stopImmediatePropagation();
      e.preventDefault(); // prevent scroll/browser zoom

      const dist = getPinchDist();
      const center = getPinchCenter();
      if (!center) return;
      const r = el.getBoundingClientRect();

      if (this._lastPinchCenter) {
        this.panBy(center.x - this._lastPinchCenter.x, center.y - this._lastPinchCenter.y);
      }
      if (this._lastPinchDist > 0 && dist > 0) {
        this.zoomAt(center.x - r.left, center.y - r.top, dist / this._lastPinchDist);
      }
      this._lastPinchDist = dist;
      this._lastPinchCenter = center;
    }, { capture: true, passive: false });

    const endPointer = (e) => {
      if (e.pointerType !== 'touch') return;
      const wasPinching = this._pinching;
      active.delete(e.pointerId);
      if (active.size < 2) {
        if (wasPinching) e.stopImmediatePropagation(); // prevent Fabric's mouseup after pinch
        this._pinching = false;
        this._lastPinchDist = 0;
        this._lastPinchCenter = null;
        pinchIds = [];
      }
    };

    el.addEventListener('pointerup', endPointer, { capture: true });
    el.addEventListener('pointercancel', endPointer, { capture: true });
  }

  /* ── Keyboard (space for pan) ──────────────────────── */

  _setupKeyboard() {
    const isVisible = () => this.container.offsetWidth > 0;
    document.addEventListener('keydown', e => {
      if (!isVisible()) return;
      if (e.code === 'Space' && !e.repeat) { this._spaceDown = true; this.el.style.cursor = 'grab'; }
      this.emit('keydown', e);
    });
    document.addEventListener('keyup', e => {
      if (!isVisible()) return;
      if (e.code === 'Space') { this._spaceDown = false; this.el.style.cursor = ''; }
      this.emit('keyup', e);
    });
  }
}
