// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { ShapeStore } from '../js/map/store.ts';

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
});
