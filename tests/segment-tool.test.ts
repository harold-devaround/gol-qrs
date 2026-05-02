// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { ShapeStore } from '../js/map/store.js';
import { SegmentTool } from '../js/map/tools/segment.js';

/* ── helpers ──────────────────────────────────────────── */

function makeCtx(store) {
  return {
    store,
    canvas: {
      el: { style: {} },
      zoom: 1,
      requestRender: vi.fn(),
      findSnap: vi.fn(() => null),
      currentSnap: null,
    },
    history: { save: vi.fn() },
    measurement: {},
    angleSnapStep: 45,
  };
}

function tap(tool, wp) {
  tool.onMouseDown?.(wp);
  tool.onMouseUp(wp, undefined, false);
}

/* ── tests ──────────────────────────────────────────────── */

describe('SegmentTool', () => {

  describe('basic properties', () => {
    it('has correct name', () => {
      expect(new SegmentTool().name).toBe('Segment');
    });
    it('has shortcut s', () => {
      expect(new SegmentTool().shortcut).toBe('s');
    });
    it('has a non-empty icon', () => {
      const icon = new SegmentTool().icon;
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    });
  });

  describe('two-click creation', () => {
    it('creates a segment after two clicks', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 10, y: 20 });
      tap(tool, { x: 50, y: 60 });

      const shapes = store.getAll();
      expect(shapes).toHaveLength(1);
      expect(shapes[0].type).toBe('segment');
      expect(shapes[0].p1).toEqual({ x: 10, y: 20 });
      expect(shapes[0].p2).toEqual({ x: 50, y: 60 });
    });

    it('resets internal state after completing a segment', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 0, y: 0 });
      tap(tool, { x: 100, y: 0 });

      expect(tool._p1).toBeNull();
      expect(tool._cursor).toBeNull();
    });
  });

  describe('cancel', () => {
    it('cancel resets state', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 10, y: 20 });
      expect(tool._p1).not.toBeNull();

      tool.cancel();
      expect(tool._p1).toBeNull();
      expect(tool._cursor).toBeNull();
    });

    it('cancel after first click does not create a segment', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      tap(tool, { x: 10, y: 20 });
      tool.cancel();

      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe('cursor reset on first click — regression: stale cursor causes phantom preview', () => {
    it('_cursor is null immediately after placing the first point', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      // Simulate cursor at a far-away position (stale, e.g. set before zoom/pan)
      tool.onMouseMove({ x: 9999, y: 9999 }, undefined);
      expect(tool._cursor).toEqual({ x: 9999, y: 9999 });

      // Place first point at a completely different position
      tap(tool, { x: 100, y: 200 });

      // _p1 is placed correctly
      expect(tool._p1).toEqual({ x: 100, y: 200 });
      // _cursor must be null so renderPreview shows no line until mouse moves
      expect(tool._cursor).toBeNull();
    });

    it('renderPreview draws first-point ring marker when _cursor is null after first click', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      // Set a stale cursor
      tool.onMouseMove({ x: 5000, y: 5000 }, undefined);
      // Place first point
      tap(tool, { x: 100, y: 200 });

      // Mock canvas context and viewport
      const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), setLineDash: vi.fn(), arc: vi.fn(), fill: vi.fn(), strokeStyle: '', lineWidth: 0, fillStyle: '' };
      const vp = { toScreen: vi.fn((x, y) => ({ x, y })) };

      tool.renderPreview(ctx, vp);

      // Ring marker (stroke) + inner dot (fill) drawn at first point; no line yet
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalledWith(100, 200, 7, 0, Math.PI * 2);
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.moveTo).not.toHaveBeenCalled();
      expect(ctx.lineTo).not.toHaveBeenCalled();
    });

    it('renderPreview draws after mouse moves post first click', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      // Place first point
      tap(tool, { x: 100, y: 200 });
      // Move mouse to second position
      tool.onMouseMove({ x: 300, y: 400 }, undefined);

      const ctx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        setLineDash: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
        fillStyle: '',
      };
      const vp = { toScreen: vi.fn((x, y) => ({ x, y })) };

      tool.renderPreview(ctx, vp);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalledWith(100, 200);
      expect(ctx.lineTo).toHaveBeenCalledWith(300, 400);
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('hasMoved guard', () => {
    it('does not set _p1 when hasMoved is true (drag, not tap)', () => {
      const store = new ShapeStore();
      const tool = new SegmentTool();
      tool.ctx = makeCtx(store);

      tool.onMouseUp({ x: 10, y: 20 }, undefined, true);
      expect(tool._p1).toBeNull();
    });
  });
});
