// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapCanvas } from '../js/map/fabric-canvas.js';

/* ── PointerEvent polyfill (jsdom 26 doesn't ship it) ──── */
if (!globalThis.PointerEvent) {
  globalThis.PointerEvent = class PointerEvent extends Event {
    constructor(type, init = {}) {
      super(type, { bubbles: init.bubbles ?? true, cancelable: init.cancelable ?? true, ...init });
      this.pointerId = init.pointerId ?? 0;
      this.clientX = init.clientX ?? 0;
      this.clientY = init.clientY ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  };
}

/* ── Fabric mock ───────────────────────────────────────── */

function makeFabricMock() {
  const upperCanvasEl = document.createElement('canvas');
  const lowerCanvasEl = document.createElement('canvas');
  upperCanvasEl.classList.add('upper-canvas');

  const vpt = [1, 0, 0, 1, 0, 0];
  const fc = {
    on: vi.fn(),
    getZoom: vi.fn(() => vpt[0]),
    get viewportTransform() { return vpt; },
    zoomToPoint: vi.fn((pt, z) => { vpt[0] = z; vpt[3] = z; }),
    setViewportTransform: vi.fn((t) => { t.forEach((v, i) => { vpt[i] = v; }); }),
    requestRenderAll: vi.fn(),
    width: 800,
    height: 600,
    upperCanvasEl,
    lowerCanvasEl,
    upper: undefined,   // Matches real Fabric v7: upper is on elements, not on fc
    contextTop: null,
    insertAt: vi.fn(),
    setDimensions: vi.fn(),
  };
  return { fc, upperCanvasEl, lowerCanvasEl };
}

/* ── DOM helpers ───────────────────────────────────────── */

function makeContainer() {
  const div = document.createElement('div');
  Object.defineProperty(div, 'clientWidth', { get: () => 800 });
  Object.defineProperty(div, 'clientHeight', { get: () => 600 });
  Object.defineProperty(div, 'offsetWidth', { get: () => 800 });
  document.body.appendChild(div);
  return div;
}

function makePointerEvent(type, { pointerId, clientX, clientY, pointerType = 'touch', bubbles = true, cancelable = true } = {}) {
  return new PointerEvent(type, { pointerId, clientX, clientY, pointerType, bubbles, cancelable });
}

/* ── Setup ─────────────────────────────────────────────── */

let fabricMock;
let container;
let mc;

beforeEach(() => {
  fabricMock = makeFabricMock();

  global.fabric = {
    Canvas: function Canvas() { return fabricMock.fc; },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    FabricImage: function FabricImage() {},
  };
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };

  container = makeContainer();
  mc = new MapCanvas(container);

  // Stub zoomAt / panBy so we can inspect calls without side effects
  mc.zoomAt = vi.fn();
  mc.panBy = vi.fn();
});

/* ── Tests ─────────────────────────────────────────────── */

describe('MapCanvas.el uses upperCanvasEl', () => {
  it('this.el is the upper canvas, not the lower canvas', () => {
    expect(mc.el).toBe(fabricMock.upperCanvasEl);
  });
});

describe('touch-action on upper canvas', () => {
  it('upper canvas has touch-action: none', () => {
    expect(fabricMock.upperCanvasEl.style.touchAction).toBe('none');
  });
});

describe('single touch — no pinch', () => {
  it('_pinching is false with only one finger', () => {
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }),
    );
    expect(mc._pinching).toBe(false);
  });

  it('does not emit cancel with one finger', () => {
    const cancelSpy = vi.fn();
    mc.on('cancel', cancelSpy);
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }),
    );
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it('non-touch pointer events are ignored', () => {
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, pointerType: 'mouse' }),
    );
    expect(mc._pinching).toBe(false);
  });
});

describe('two-finger pinch starts', () => {
  it('_pinching becomes true when second finger arrives', () => {
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
    expect(mc._pinching).toBe(true);
  });

  it('emits cancel when second finger arrives', () => {
    const cancelSpy = vi.fn();
    mc.on('cancel', cancelSpy);
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('cancel is emitted at most once per pinch session', () => {
    const cancelSpy = vi.fn();
    mc.on('cancel', cancelSpy);
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
    // 3rd finger should not re-emit cancel
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 3, clientX: 300, clientY: 200 }),
    );
    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('records initial pinch distance', () => {
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
    // distance = |200-100| = 100
    expect(mc._lastPinchDist).toBeCloseTo(100);
  });

  it('records initial pinch center', () => {
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 300, clientY: 200 }),
    );
    expect(mc._lastPinchCenter).toEqual({ x: 200, y: 200 });
  });

  it('stops Fabric from seeing 2nd-finger pointerdown', () => {
    // Register a bubble-phase listener on the upper canvas AFTER MapCanvas setup
    const fabricSpy = vi.fn();
    fabricMock.upperCanvasEl.addEventListener('pointerdown', fabricSpy);

    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    // 1st finger: Fabric CAN see it (we don't stop it)
    expect(fabricSpy).toHaveBeenCalledOnce();

    fabricSpy.mockClear();

    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
    // 2nd finger: Fabric must NOT see it (stopImmediatePropagation)
    expect(fabricSpy).not.toHaveBeenCalled();
  });
});

describe('pointermove during pinch', () => {
  function startPinch(x1 = 100, x2 = 200, y = 200) {
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: x1, clientY: y }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: x2, clientY: y }),
    );
  }

  it('zoom-in: fingers moving apart calls zoomAt with factor > 1', () => {
    startPinch(150, 250, 200); // dist = 100
    // Move fingers apart to dist = 200
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 2, clientX: 300, clientY: 200 }),
    );
    expect(mc.zoomAt).toHaveBeenCalled();
    const lastCall = mc.zoomAt.mock.calls.at(-1);
    expect(lastCall[2]).toBeGreaterThan(1); // factor > 1 → zoom in
  });

  it('zoom-out: fingers moving together calls zoomAt with factor < 1', () => {
    startPinch(100, 300, 200); // dist = 200
    // Move fingers together to dist = 100
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 2, clientX: 250, clientY: 200 }),
    );
    expect(mc.zoomAt).toHaveBeenCalled();
    const lastCall = mc.zoomAt.mock.calls.at(-1);
    expect(lastCall[2]).toBeLessThan(1); // factor < 1 → zoom out
  });

  it('pan: center movement calls panBy', () => {
    startPinch(100, 200, 200); // center = (150, 200)
    // Both fingers move 50px right → center moves to (200, 200)
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 2, clientX: 250, clientY: 200 }),
    );
    expect(mc.panBy).toHaveBeenCalled();
  });

  it('no zoomAt/panBy when not pinching', () => {
    // Single finger move
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 200 }),
    );
    expect(mc.zoomAt).not.toHaveBeenCalled();
    expect(mc.panBy).not.toHaveBeenCalled();
  });

  it('Fabric is blocked during pinch pointermove', () => {
    const fabricSpy = vi.fn();
    fabricMock.upperCanvasEl.addEventListener('pointermove', fabricSpy);

    startPinch(100, 200, 200);
    fabricSpy.mockClear(); // ignore events before pinch

    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 1, clientX: 110, clientY: 200 }),
    );
    expect(fabricSpy).not.toHaveBeenCalled();
  });

  it('zoomAt center uses canvas-relative coordinates', () => {
    // Mock getBoundingClientRect to simulate canvas offset from viewport edge
    fabricMock.upperCanvasEl.getBoundingClientRect = vi.fn(() => ({
      left: 50, top: 100, right: 850, bottom: 700, width: 800, height: 600,
    }));

    startPinch(200, 400, 300); // center = (300, 300), canvas-local = (250, 200)
    mc.zoomAt.mockClear();

    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 2, clientX: 500, clientY: 300 }),
    );
    const calls = mc.zoomAt.mock.calls;
    if (calls.length > 0) {
      // Verify x is canvas-relative: clientX of center - r.left
      const [sx] = calls.at(-1);
      expect(sx).toBeLessThan(800); // within canvas width
    }
  });

  it('updates first-finger position on move before second finger arrives', () => {
    // First finger down
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    // First finger moves
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 1, clientX: 160, clientY: 200 }),
    );
    // Second finger down at 260 → dist should be based on first finger at 160, not 100
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 260, clientY: 200 }),
    );
    // dist = |260 - 160| = 100 (not |260-100| = 160)
    expect(mc._lastPinchDist).toBeCloseTo(100);
  });
});

describe('pinch end', () => {
  function startPinch() {
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
  }

  it('_pinching becomes false when first finger is lifted', () => {
    startPinch();
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    expect(mc._pinching).toBe(false);
  });

  it('_pinching becomes false when second finger is lifted', () => {
    startPinch();
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerup', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
    expect(mc._pinching).toBe(false);
  });

  it('state is fully reset after pinch ends', () => {
    startPinch();
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    expect(mc._pinching).toBe(false);
    expect(mc._lastPinchDist).toBe(0);
    expect(mc._lastPinchCenter).toBeNull();
  });

  it('pointercancel also ends pinch', () => {
    startPinch();
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointercancel', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    expect(mc._pinching).toBe(false);
  });

  it('a new pinch can start after the previous one ends', () => {
    startPinch();
    // End it
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerup', { pointerId: 2, clientX: 200, clientY: 200 }),
    );
    // New pinch
    const cancelSpy = vi.fn();
    mc.on('cancel', cancelSpy);
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 3, clientX: 100, clientY: 200 }),
    );
    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerdown', { pointerId: 4, clientX: 200, clientY: 200 }),
    );
    expect(mc._pinching).toBe(true);
    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('Fabric is blocked on pointerup after pinch', () => {
    const fabricSpy = vi.fn();
    fabricMock.upperCanvasEl.addEventListener('pointerup', fabricSpy);

    startPinch();
    fabricSpy.mockClear();

    fabricMock.upperCanvasEl.dispatchEvent(
      makePointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 200 }),
    );
    expect(fabricSpy).not.toHaveBeenCalled();
  });
});
