// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { ShapeStore } from '../js/map/store.ts';
import { createPoint, syncNextId } from '../js/map/shapes.ts';

const makeShape = (id, extra = {}) => ({
  id,
  type: 'point',
  visible: true,
  selected: false,
  ...extra,
});

describe('ShapeStore', () => {
  describe('CRUD', () => {
    it('starts empty', () => {
      const s = new ShapeStore();
      expect(s.getAll()).toEqual([]);
    });

    it('adds a shape and emits change', () => {
      const s = new ShapeStore();
      const spy = vi.fn();
      s.on('change', spy);
      const shape = makeShape('a');
      s.add(shape);
      expect(s.getAll()).toHaveLength(1);
      expect(spy).toHaveBeenCalledOnce();
    });

    it('gets shape by id', () => {
      const s = new ShapeStore();
      s.add(makeShape('x'));
      expect(s.get('x')).toBeDefined();
      expect(s.get('x').id).toBe('x');
      expect(s.get('missing')).toBeUndefined();
    });

    it('removes shape by id', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      s.add(makeShape('b'));
      s.remove('a');
      expect(s.getAll()).toHaveLength(1);
      expect(s.get('a')).toBeUndefined();
    });

    it('updates shape properties', () => {
      const s = new ShapeStore();
      s.add(makeShape('a', { x: 0 }));
      s.update('a', { x: 42 });
      expect(s.get('a').x).toBe(42);
    });

    it('clears all shapes', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      s.add(makeShape('b'));
      s.clear();
      expect(s.getAll()).toHaveLength(0);
    });
  });

  describe('visibility', () => {
    it('getVisible returns only visible shapes', () => {
      const s = new ShapeStore();
      s.add(makeShape('a', { visible: true }));
      s.add(makeShape('b', { visible: false }));
      expect(s.getVisible()).toHaveLength(1);
      expect(s.getVisible()[0].id).toBe('a');
    });

    it('toggleVisibility flips the flag', () => {
      const s = new ShapeStore();
      s.add(makeShape('a', { visible: true }));
      s.toggleVisibility('a');
      expect(s.get('a').visible).toBe(false);
      s.toggleVisibility('a');
      expect(s.get('a').visible).toBe(true);
    });
  });

  describe('selection', () => {
    it('select sets one shape selected, deselects others', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      s.add(makeShape('b'));
      s.select('a');
      expect(s.get('a').selected).toBe(true);
      expect(s.get('b').selected).toBe(false);
    });

    it('selectMany sets multiple', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      s.add(makeShape('b'));
      s.add(makeShape('c'));
      s.selectMany(['a', 'c']);
      expect(s.getSelected()).toHaveLength(2);
    });

    it('toggleSelect flips selection on one shape', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      s.toggleSelect('a');
      expect(s.get('a').selected).toBe(true);
      s.toggleSelect('a');
      expect(s.get('a').selected).toBe(false);
    });

    it('deselectAll clears all selections', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      s.add(makeShape('b'));
      s.selectMany(['a', 'b']);
      s.deselectAll();
      expect(s.getSelected()).toHaveLength(0);
    });

    it('emits selection event', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      const spy = vi.fn();
      s.on('selection', spy);
      s.select('a');
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('snapshot / restore', () => {
    it('snapshot returns a deep clone', () => {
      const s = new ShapeStore();
      s.add(makeShape('a', { x: 1 }));
      const snap = s.snapshot();
      s.update('a', { x: 999 });
      expect(snap[0].x).toBe(1); // original snapshot unchanged
    });

    it('restore replaces all shapes', () => {
      const s = new ShapeStore();
      s.add(makeShape('a'));
      s.add(makeShape('b'));
      const snap = s.snapshot();
      s.clear();
      expect(s.getAll()).toHaveLength(0);
      s.restore(snap);
      expect(s.getAll()).toHaveLength(2);
    });

    it('restore deep-clones so further mutation is independent', () => {
      const s = new ShapeStore();
      s.add(makeShape('a', { x: 1 }));
      const snap = s.snapshot();
      s.clear();
      s.restore(snap);
      s.update('a', { x: 99 });
      // snap should still be [{ x: 1, ... }]
      expect(snap[0].x).toBe(1);
    });
  });

  describe('ID lifecycle (gap-fill after clear / restore)', () => {
    it('clear releases IDs so newly added shapes can reuse them', () => {
      syncNextId([]);                       // start from a clean ID pool
      const s = new ShapeStore();
      const a = createPoint(0, 0); s.add(a);
      const b = createPoint(1, 1); s.add(b);
      expect([a.id, b.id]).toEqual([1, 2]);
      s.clear();
      // After clear, IDs 1 & 2 should be free again — gap-fill restarts at 1.
      const c = createPoint(2, 2); s.add(c);
      expect(c.id).toBe(1);
    });

    it('restore re-syncs the global ID pool so freed IDs are reusable after undo', () => {
      syncNextId([]);
      const s = new ShapeStore();
      const a = createPoint(0, 0); s.add(a); // id 1
      const snap = s.snapshot();             // contains [id:1]
      const b = createPoint(1, 1); s.add(b); // id 2
      // Undo back to snapshot: only id 1 in the store; id 2 must be released.
      s.restore(snap);
      const c = createPoint(2, 2);
      // Must NOT collide with surviving id 1, but must reuse the now-free id 2.
      expect(c.id).toBe(2);
    });

    it('restore frees IDs that are no longer in the snapshot', () => {
      syncNextId([]);
      const s = new ShapeStore();
      const a = createPoint(0, 0); s.add(a); // id 1
      const b = createPoint(1, 1); s.add(b); // id 2
      const c = createPoint(2, 2); s.add(c); // id 3
      // Snapshot containing only id 2 — restoring drops ids 1 and 3.
      s.restore([{ ...b }]);
      const d = createPoint(3, 3);
      // First gap-fill should pick id 1 (lowest free).
      expect(d.id).toBe(1);
    });
  });
});
