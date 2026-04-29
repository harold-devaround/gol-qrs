// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { ShapeStore } from '../js/map/store.js';
import { History } from '../js/map/history.js';

const makeShape = (id, extra = {}) => ({
  id,
  type: 'point',
  visible: true,
  selected: false,
  ...extra,
});

describe('History', () => {
  const setup = () => {
    const store = new ShapeStore();
    const history = new History(store);
    return { store, history };
  };

  describe('initial state', () => {
    it('starts with empty undo/redo', () => {
      const { history } = setup();
      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(false);
    });
  });

  describe('save / undo', () => {
    it('enables undo after save', () => {
      const { store, history } = setup();
      store.add(makeShape('a'));
      history.save();
      store.add(makeShape('b'));
      expect(history.canUndo).toBe(true);
    });

    it('undo restores previous state', () => {
      const { store, history } = setup();
      store.add(makeShape('a'));
      history.save(); // snapshot: [a]
      store.add(makeShape('b')); // current: [a, b]
      history.undo(); // back to [a]
      expect(store.getAll()).toHaveLength(1);
      expect(store.get('a')).toBeDefined();
      expect(store.get('b')).toBeUndefined();
    });

    it('undo does nothing when stack is empty', () => {
      const { store, history } = setup();
      store.add(makeShape('a'));
      history.undo(); // should be no-op
      expect(store.getAll()).toHaveLength(1);
    });
  });

  describe('redo', () => {
    it('enables redo after undo', () => {
      const { store, history } = setup();
      history.save();
      store.add(makeShape('a'));
      history.undo();
      expect(history.canRedo).toBe(true);
    });

    it('redo restores the undone state', () => {
      const { store, history } = setup();
      history.save(); // snapshot: []
      store.add(makeShape('a')); // current: [a]
      history.undo(); // back to []
      expect(store.getAll()).toHaveLength(0);
      history.redo(); // forward to [a]
      expect(store.getAll()).toHaveLength(1);
    });

    it('redo stack is cleared on new save', () => {
      const { store, history } = setup();
      history.save();
      store.add(makeShape('a'));
      history.undo();
      expect(history.canRedo).toBe(true);
      history.save(); // new action clears redo
      expect(history.canRedo).toBe(false);
    });
  });

  describe('multiple undo/redo', () => {
    it('supports multiple levels of undo', () => {
      const { store, history } = setup();
      history.save(); // []
      store.add(makeShape('a'));
      history.save(); // [a]
      store.add(makeShape('b'));
      history.save(); // [a, b]
      store.add(makeShape('c'));
      // current: [a, b, c]
      history.undo(); // [a, b]
      expect(store.getAll()).toHaveLength(2);
      history.undo(); // [a]
      expect(store.getAll()).toHaveLength(1);
      history.undo(); // []
      expect(store.getAll()).toHaveLength(0);
    });

    it('supports undo then redo then undo', () => {
      const { store, history } = setup();
      history.save();
      store.add(makeShape('a'));
      history.save();
      store.add(makeShape('b'));
      // current: [a, b]
      history.undo(); // [a]
      history.redo(); // [a, b]
      expect(store.getAll()).toHaveLength(2);
      history.undo(); // [a]
      expect(store.getAll()).toHaveLength(1);
    });
  });

  describe('max stack size', () => {
    it('trims undo stack at max (80)', () => {
      const { store, history } = setup();
      for (let i = 0; i < 100; i++) {
        history.save();
        store.add(makeShape(`s${i}`));
      }
      expect(history.undoStack.length).toBe(80);
    });
  });

  describe('events', () => {
    it('emits change on save', () => {
      const { history } = setup();
      const spy = vi.fn();
      history.on('change', spy);
      history.save();
      expect(spy).toHaveBeenCalledOnce();
    });

    it('emits change on undo', () => {
      const { store, history } = setup();
      history.save();
      store.add(makeShape('a'));
      const spy = vi.fn();
      history.on('change', spy);
      history.undo();
      expect(spy).toHaveBeenCalledOnce();
    });
  });
});
