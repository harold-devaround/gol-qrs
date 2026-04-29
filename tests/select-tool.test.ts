// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { ShapeStore } from '../js/map/store.ts';
import { SelectTool } from '../js/map/tools/select.ts';

/* ── helpers ──────────────────────────────────────────── */

function makeCtx(store) {
  return {
    store,
    canvas: { el: { style: {} }, zoom: 1, requestRender: vi.fn() },
    history: { save: vi.fn() },
    measurement: {},
  };
}

function makePoint(id, x, y) {
  return { type: 'point', id, x, y, color: '#f00', visible: true, selected: false };
}

/* ── tests ────────────────────────────────────────────── */

describe('SelectTool', () => {
  describe('single-select (no shift)', () => {
    it('clicking a shape selects it', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      tool.onMouseDown({ x: 10, y: 10 }, { shiftKey: false });
      expect(store.getSelected()).toHaveLength(1);
      expect(store.get('a').selected).toBe(true);
    });

    it('clicking another shape deselects the first', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      store.add(makePoint('b', 50, 50));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      store.select('a');
      tool.onMouseDown({ x: 50, y: 50 }, { shiftKey: false });
      expect(store.getSelected()).toHaveLength(1);
      expect(store.get('b').selected).toBe(true);
      expect(store.get('a').selected).toBe(false);
    });

    it('clicking an already-selected shape deselects all others', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      store.add(makePoint('b', 50, 50));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      // Simulate multi-select state (e.g. from prior shift-click)
      store.selectMany(['a', 'b']);
      expect(store.getSelected()).toHaveLength(2);

      // Click on 'a' without shift → should keep only 'a'
      tool.onMouseDown({ x: 10, y: 10 }, { shiftKey: false });
      expect(store.getSelected()).toHaveLength(1);
      expect(store.get('a').selected).toBe(true);
      expect(store.get('b').selected).toBe(false);
    });

    it('clicking empty area deselects all', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      store.select('a');
      tool.onMouseDown({ x: 900, y: 900 }, { shiftKey: false });
      expect(store.getSelected()).toHaveLength(0);
    });
  });

  describe('multi-select (shift)', () => {
    it('shift-click adds to selection', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      store.add(makePoint('b', 50, 50));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      store.select('a');
      tool.onMouseDown({ x: 50, y: 50 }, { shiftKey: true });
      expect(store.getSelected()).toHaveLength(2);
    });

    it('shift-click deselects if already selected', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      store.add(makePoint('b', 50, 50));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      store.selectMany(['a', 'b']);
      tool.onMouseDown({ x: 50, y: 50 }, { shiftKey: true });
      expect(store.getSelected()).toHaveLength(1);
      expect(store.get('a').selected).toBe(true);
      expect(store.get('b').selected).toBe(false);
    });
  });

  describe('keyboard', () => {
    it('Escape deselects all', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      store.select('a');
      tool.onKeyDown({ key: 'Escape' });
      expect(store.getSelected()).toHaveLength(0);
    });

    it('Delete removes selected shapes', () => {
      const store = new ShapeStore();
      store.add(makePoint('a', 10, 10));
      const tool = new SelectTool();
      tool.ctx = makeCtx(store);

      store.select('a');
      tool.onKeyDown({ key: 'Delete' });
      expect(store.getAll()).toHaveLength(0);
    });
  });
});
