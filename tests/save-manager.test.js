import { describe, it, expect, beforeEach } from 'vitest';
import { listSaves, saveSlot, loadSlot, deleteSlot, renameSlot, saveOptions, loadOptions } from '../js/map/save-manager.js';

// Mock localStorage
const store = {};
const mockStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true });

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('save-manager', () => {
  const shapes = [
    { id: 1, type: 'point', x: 10, y: 20, visible: true, selected: false },
    { id: 2, type: 'segment', p1: { x: 0, y: 0 }, p2: { x: 5, y: 5 }, visible: true, selected: false },
  ];

  describe('saveSlot / loadSlot', () => {
    it('saves and loads shapes by name', () => {
      saveSlot('test1', shapes);
      const loaded = loadSlot('test1');
      expect(loaded).toEqual(shapes);
    });

    it('returns null for non-existent slot', () => {
      expect(loadSlot('nope')).toBeNull();
    });

    it('deep-clones on save (no aliasing)', () => {
      const s = [{ id: 1, type: 'point', x: 0, y: 0 }];
      saveSlot('clone-test', s);
      s[0].x = 999;
      expect(loadSlot('clone-test')[0].x).toBe(0);
    });

    it('deep-clones on load (no aliasing)', () => {
      saveSlot('clone-test2', shapes);
      const a = loadSlot('clone-test2');
      const b = loadSlot('clone-test2');
      a[0].x = 999;
      expect(b[0].x).toBe(10);
    });

    it('overwrites existing slot with same name', () => {
      saveSlot('overwrite', [{ id: 1, type: 'point', x: 1, y: 1 }]);
      saveSlot('overwrite', [{ id: 2, type: 'point', x: 2, y: 2 }]);
      const loaded = loadSlot('overwrite');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe(2);
    });
  });

  describe('listSaves', () => {
    it('returns empty array when no saves', () => {
      expect(listSaves()).toEqual([]);
    });

    it('lists saves with metadata', () => {
      saveSlot('A', shapes);
      const list = listSaves();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('A');
      expect(list[0].count).toBe(2);
      expect(typeof list[0].date).toBe('number');
    });

    it('sorts by date descending', () => {
      // Manually set different timestamps via the storage directly
      const saves = {};
      saves['old'] = { shapes: [{ id: 1 }], date: 1000 };
      saves['new'] = { shapes: [{ id: 2 }], date: 2000 };
      store['gol-qrs-saves'] = JSON.stringify(saves);
      const list = listSaves();
      expect(list[0].name).toBe('new');
      expect(list[1].name).toBe('old');
    });
  });

  describe('deleteSlot', () => {
    it('removes a saved slot', () => {
      saveSlot('to-delete', shapes);
      deleteSlot('to-delete');
      expect(loadSlot('to-delete')).toBeNull();
      expect(listSaves()).toHaveLength(0);
    });

    it('does not throw for non-existent slot', () => {
      expect(() => deleteSlot('nope')).not.toThrow();
    });
  });

  describe('renameSlot', () => {
    it('renames a slot', () => {
      saveSlot('old-name', shapes);
      renameSlot('old-name', 'new-name');
      expect(loadSlot('old-name')).toBeNull();
      expect(loadSlot('new-name')).toEqual(shapes);
    });

    it('ignores rename to same name', () => {
      saveSlot('same', shapes);
      renameSlot('same', 'same');
      expect(loadSlot('same')).toEqual(shapes);
    });
  });

  describe('saveOptions / loadOptions', () => {
    it('saves and loads options', () => {
      saveOptions({ mode: 'cm', calMode: 'width', snapEnabled: false });
      const opts = loadOptions();
      expect(opts.mode).toBe('cm');
      expect(opts.calMode).toBe('width');
      expect(opts.snapEnabled).toBe(false);
    });

    it('returns null when no options saved', () => {
      expect(loadOptions()).toBeNull();
    });

    it('deep-clones options (no aliasing)', () => {
      const opts = { mode: 'px', calMode: 'height', snapEnabled: true };
      saveOptions(opts);
      opts.mode = 'cm';
      expect(loadOptions().mode).toBe('px');
    });
  });
});
