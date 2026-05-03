// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { ShapeStore } from '../js/map/store.js';
import { syncNextId } from '../js/map/shapes.js';
import { PointTool } from '../js/map/tools/point.js';

function makeCtx(store) {
  return {
    store,
    canvas: {
      el: { style: {} },
      zoom: 1,
      requestRender: vi.fn(),
      findSnap: () => null,
    },
    history: { save: vi.fn() },
    measurement: {},
  };
}

describe('PointTool labels', () => {
  it('starts at A on an empty store', () => {
    syncNextId([]);
    const store = new ShapeStore();
    const tool = new PointTool();
    tool.ctx = makeCtx(store);
    tool.onMouseUp({ x: 10, y: 10 }, {}, false);
    expect(store.getAll()[0].label).toBe('A');
  });

  it('skips labels already used by existing points', () => {
    syncNextId([]);
    const store = new ShapeStore();
    store.add({
      type: 'point', id: 1, x: 0, y: 0, label: 'A',
      visible: true, selected: false, color: '#000', showLabel: true, showGuides: false,
    });
    store.add({
      type: 'point', id: 2, x: 0, y: 0, label: 'B',
      visible: true, selected: false, color: '#000', showLabel: true, showGuides: false,
    });
    const tool = new PointTool();
    tool.ctx = makeCtx(store);
    tool.onMouseUp({ x: 10, y: 10 }, {}, false);
    expect(store.getAll().at(-1).label).toBe('C');
  });

  it('fills gaps in label sequence (e.g. after deletion)', () => {
    syncNextId([]);
    const store = new ShapeStore();
    // Existing points have labels A and C — next free is B.
    store.add({
      type: 'point', id: 1, x: 0, y: 0, label: 'A',
      visible: true, selected: false, color: '#000', showLabel: true, showGuides: false,
    });
    store.add({
      type: 'point', id: 2, x: 0, y: 0, label: 'C',
      visible: true, selected: false, color: '#000', showLabel: true, showGuides: false,
    });
    const tool = new PointTool();
    tool.ctx = makeCtx(store);
    tool.onMouseUp({ x: 10, y: 10 }, {}, false);
    expect(store.getAll().at(-1).label).toBe('B');
  });

  it('falls back to A1, B1… after Z is used', () => {
    syncNextId([]);
    const store = new ShapeStore();
    for (let i = 0; i < 26; i++) {
      store.add({
        type: 'point', id: 100 + i, x: 0, y: 0,
        label: String.fromCharCode(65 + i),
        visible: true, selected: false, color: '#000', showLabel: true, showGuides: false,
      });
    }
    const tool = new PointTool();
    tool.ctx = makeCtx(store);
    tool.onMouseUp({ x: 10, y: 10 }, {}, false);
    expect(store.getAll().at(-1).label).toBe('A1');
  });

  it('does not validate when hasMoved=true (drag, not tap)', () => {
    syncNextId([]);
    const store = new ShapeStore();
    const tool = new PointTool();
    tool.ctx = makeCtx(store);
    tool.onMouseUp({ x: 10, y: 10 }, {}, true);
    expect(store.getAll()).toHaveLength(0);
  });

  it('non-point shapes do not influence label collision', () => {
    syncNextId([]);
    const store = new ShapeStore();
    // A segment with label 'A' must not block point label 'A'.
    store.add({
      type: 'segment', id: 1, p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 }, label: 'A',
      visible: true, selected: false, color: '#000', showLabel: true, lineWidth: 2,
    });
    const tool = new PointTool();
    tool.ctx = makeCtx(store);
    tool.onMouseUp({ x: 10, y: 10 }, {}, false);
    expect(store.getAll().at(-1).label).toBe('A');
  });
});
