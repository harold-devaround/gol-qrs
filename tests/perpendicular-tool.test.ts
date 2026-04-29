// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { ShapeStore } from '../js/map/store.js';
import { PerpendicularTool } from '../js/map/tools/perpendicular.js';

/* ── helpers ──────────────────────────────────────────── */

function makeCtx(store) {
  return {
    store,
    canvas: {
      el: { style: {} },
      zoom: 1,
      requestRender: vi.fn(),
      findSnap: vi.fn(() => null), // no snap by default
      currentSnap: null,
    },
    history: { save: vi.fn() },
    measurement: {},
    angleSnapStep: 45,
  };
}

function makeSegment(id, x1, y1, x2, y2) {
  return {
    type: 'segment', id,
    p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 },
    color: '#f00', lineWidth: 2, visible: true, selected: false,
  };
}

function makeLine(id, x1, y1, x2, y2) {
  return {
    type: 'line', id,
    p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 },
    color: '#f00', lineWidth: 2, visible: true, selected: false,
  };
}

/** Simulate a clean tap: mousedown then mouseup with no movement. */
function tap(tool, wp) {
  tool.onMouseDown(wp);
  tool.onMouseUp(wp, undefined, false);
}

/* ── tests ────────────────────────────────────────────── */

describe('PerpendicularTool', () => {

  describe('basic properties', () => {
    it('has correct name', () => {
      expect(new PerpendicularTool().name).toBe('Perpendiculaire');
    });
    it('has shortcut x', () => {
      expect(new PerpendicularTool().shortcut).toBe('x');
    });
    it('has an icon (non-empty string)', () => {
      const icon = new PerpendicularTool().icon;
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 1 — picking the reference', () => {
    it('tapping on a segment picks it as reference', () => {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0); // horizontal segment
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 50, y: 0 }); // tap on the segment
      expect(tool._ref).toBe(seg);
      expect(tool._start).toBeNull();
    });

    it('mousedown alone does not pick the reference (step validates on mouseup)', () => {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0);
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);

      tool.onMouseDown({ x: 50, y: 0 });
      expect(tool._ref).toBeNull(); // not yet picked — awaiting mouseup
    });

    it('drag (hasMoved=true) does not pick the reference', () => {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0);
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);

      tool.onMouseDown({ x: 50, y: 0 });
      tool.onMouseUp({ x: 50, y: 0 }, undefined, true); // drag: hasMoved=true
      expect(tool._ref).toBeNull(); // drag must not pick ref
    });

    it('tapping on a line picks it as reference', () => {
      const store = new ShapeStore();
      const line = makeLine(2, 0, 0, 100, 0);
      store.add(line);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 50, y: 1 }); // close enough to line
      expect(tool._ref).toBe(line);
    });

    it('tapping on empty space does nothing', () => {
      const store = new ShapeStore();
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 500, y: 500 });
      expect(tool._ref).toBeNull();
    });

    it('tapping a non-line/segment shape does nothing', () => {
      const store = new ShapeStore();
      store.add({ type: 'point', id: 3, x: 50, y: 50, color: '#f00', visible: true, selected: false });
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 50, y: 50 });
      expect(tool._ref).toBeNull();
    });
  });

  describe('Phase 2 — picking the start (foot of perpendicular)', () => {
    function setupWithRef() {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0); // horizontal segment (y=0)
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);
      tap(tool, { x: 50, y: 0 }); // pick seg as ref
      expect(tool._ref).toBe(seg);
      return { store, tool, seg };
    }

    it('mouse move shows projected start on the ref', () => {
      const { tool } = setupWithRef();
      tool.onMouseMove({ x: 30, y: 40 }); // cursor off the line
      // Projected onto horizontal line y=0: (30, 0)
      expect(tool._previewStart).toMatchObject({ x: 30, y: 0 });
    });

    it('tap confirms start as projection of cursor on ref', () => {
      const { tool } = setupWithRef();
      tool.onMouseMove({ x: 30, y: 40 });
      tap(tool, { x: 30, y: 40 }); // step 2
      expect(tool._start).toMatchObject({ x: 30, y: 0 });
      expect(tool._ref).not.toBeNull(); // ref still held
    });

    it('drag during phase 2 does not set start', () => {
      const { tool } = setupWithRef();
      tool.onMouseDown({ x: 30, y: 40 });
      tool.onMouseUp({ x: 30, y: 40 }, undefined, true); // drag
      expect(tool._start).toBeNull();
    });

    it('tap confirms start even when cursor is exactly on the ref', () => {
      const { tool } = setupWithRef();
      tap(tool, { x: 60, y: 0 });
      expect(tool._start).toMatchObject({ x: 60, y: 0 });
    });
  });

  describe('Phase 3 — picking the end (constrained to perpendicular)', () => {
    function setupWithRefAndStart() {
      const store = new ShapeStore();
      // Horizontal segment at y=0
      const seg = makeSegment(1, 0, 0, 100, 0);
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);
      // Phase 1: pick ref
      tap(tool, { x: 50, y: 0 });
      // Phase 2: set start at (40, 0) — projection of (40, 50) on y=0
      tap(tool, { x: 40, y: 50 });
      expect(tool._start).toMatchObject({ x: 40, y: 0 });
      return { store, tool, seg };
    }

    it('mouse move shows end projected onto perpendicular through start', () => {
      const { tool } = setupWithRefAndStart();
      // cursor at (70, 30) — perpendicular to horizontal at x=40 is vertical (x=40)
      // projection of (70,30) onto vertical x=40 is (40, 30)
      tool.onMouseMove({ x: 70, y: 30 });
      expect(tool._previewEnd).toMatchObject({ x: 40, y: 30 });
    });

    it('tap creates a segment from start to projected end', () => {
      const { store, tool } = setupWithRefAndStart();
      const countBefore = store.getAll().length;
      tap(tool, { x: 70, y: 30 }); // end is projected to (40, 30)
      expect(store.getAll().length).toBe(countBefore + 1);
      const newSeg = store.getAll().at(-1);
      expect(newSeg.type).toBe('segment');
      expect(newSeg.p1).toMatchObject({ x: 40, y: 0 });
      expect(newSeg.p2).toMatchObject({ x: 40, y: 30 });
    });

    it('drag during phase 3 does not create a segment', () => {
      const { store, tool } = setupWithRefAndStart();
      const countBefore = store.getAll().length;
      tool.onMouseDown({ x: 70, y: 30 });
      tool.onMouseUp({ x: 70, y: 30 }, undefined, true); // drag
      expect(store.getAll().length).toBe(countBefore); // nothing created
      expect(tool._start).not.toBeNull(); // still in phase 3
    });

    it('created segment is perpendicular to the reference (dot product ≈ 0)', () => {
      const { store, tool } = setupWithRefAndStart();
      tap(tool, { x: 70, y: 30 });
      const newSeg = store.getAll().at(-1);
      const ref = store.getAll()[0];
      const refDx = ref.p2.x - ref.p1.x, refDy = ref.p2.y - ref.p1.y;
      const segDx = newSeg.p2.x - newSeg.p1.x, segDy = newSeg.p2.y - newSeg.p1.y;
      const dot = refDx * segDx + refDy * segDy;
      expect(Math.abs(dot)).toBeLessThan(1e-8);
    });

    it('after creation, tool resets to phase 1 (no ref, start, cursor)', () => {
      const { tool } = setupWithRefAndStart();
      tap(tool, { x: 70, y: 30 });
      expect(tool._ref).toBeNull();
      expect(tool._start).toBeNull();
      expect(tool._previewStart).toBeNull();
      expect(tool._previewEnd).toBeNull();
    });

    it('history.save is called when creating the segment', () => {
      const { tool } = setupWithRefAndStart();
      const saveSpy = tool.ctx.history.save;
      tap(tool, { x: 70, y: 30 });
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('diagonal reference', () => {
    it('creates segment perpendicular to a diagonal reference', () => {
      // Ref: from (0,0) to (10,10) — direction 45°
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 10, 10);
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);

      // Phase 1: pick ref
      tap(tool, { x: 5, y: 5 }); // tap on the diagonal
      expect(tool._ref).toBe(seg);

      // Phase 2: start = projection of (0, 10) onto line (0,0)-(10,10)
      // t = ((0-0)*10 + (10-0)*10) / (100+100) = 100/200 = 0.5 → (5,5)
      tap(tool, { x: 0, y: 10 });
      expect(tool._start.x).toBeCloseTo(5, 5);
      expect(tool._start.y).toBeCloseTo(5, 5);

      // Phase 3: end = projection of (10, 0) onto perpendicular through (5,5)
      // Perp direction to (10,10) is (-10, 10) i.e. direction (-1,1) normalized
      // Line through (5,5) in direction (-1,1): project (10,0)
      // dot product of perpendicular segment with ref should ≈ 0
      tap(tool, { x: 10, y: 0 });
      const newSeg = store.getAll().at(-1);
      const refDx = 10, refDy = 10;
      const segDx = newSeg.p2.x - newSeg.p1.x;
      const segDy = newSeg.p2.y - newSeg.p1.y;
      const dot = refDx * segDx + refDy * segDy;
      expect(Math.abs(dot)).toBeLessThan(1e-6);
    });
  });

  describe('cancel', () => {
    it('cancel resets all state', () => {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0);
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);
      tap(tool, { x: 50, y: 0 });
      tap(tool, { x: 30, y: 40 }); // set start
      tool.cancel();
      expect(tool._ref).toBeNull();
      expect(tool._start).toBeNull();
      expect(tool._previewStart).toBeNull();
      expect(tool._previewEnd).toBeNull();
    });

    it('Escape key triggers cancel', () => {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0);
      store.add(seg);
      const tool = new PerpendicularTool();
      tool.ctx = makeCtx(store);
      tap(tool, { x: 50, y: 0 });
      tool.onKeyDown({ key: 'Escape' });
      expect(tool._ref).toBeNull();
    });
  });

  describe('snap integration', () => {
    it('snapped cursor is used for projecting start onto ref', () => {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0);
      store.add(seg);
      const tool = new PerpendicularTool();
      const ctx = makeCtx(store);
      // Snap returns a specific point
      ctx.canvas.findSnap = vi.fn(() => ({ x: 20, y: 5 }));
      tool.ctx = ctx;

      tap(tool, { x: 50, y: 0 }); // pick ref
      tap(tool, { x: 99, y: 99 }); // cursor far away; snap returns (20, 5)
      // Start = project (20, 5) onto y=0 → (20, 0)
      expect(tool._start).toMatchObject({ x: 20, y: 0 });
    });

    it('snapped cursor is used for projecting end onto perpendicular', () => {
      const store = new ShapeStore();
      const seg = makeSegment(1, 0, 0, 100, 0); // horizontal
      store.add(seg);
      const tool = new PerpendicularTool();
      const ctx = makeCtx(store);
      tool.ctx = ctx;

      tap(tool, { x: 50, y: 0 }); // pick ref
      tap(tool, { x: 40, y: 50 }); // start = (40, 0)

      // In phase 3, snap returns (80, 25)
      ctx.canvas.findSnap = vi.fn(() => ({ x: 80, y: 25 }));
      tap(tool, { x: 99, y: 99 }); // cursor far; snap to (80,25)
      // End = project (80, 25) onto vertical x=40 → (40, 25)
      const newSeg = store.getAll().at(-1);
      expect(newSeg.p2).toMatchObject({ x: 40, y: 25 });
    });
  });
});
