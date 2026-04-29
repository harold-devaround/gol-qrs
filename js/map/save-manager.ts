import type { Shape } from '../types.ts';

/**
 * Multi-slot save system using localStorage.
 * Each save is a named snapshot of the full shape store state.
 */

const STORAGE_KEY = 'gol-qrs-saves';
const OPTIONS_KEY = 'gol-qrs-options';

interface SaveSlot {
  shapes: Shape[];
  date: number;
}

interface SavesMap {
  [name: string]: SaveSlot;
}

function _readAll(): SavesMap {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    // Validate: must be a non-null plain object whose values look like SaveSlots.
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: SavesMap = {};
    for (const [name, data] of Object.entries(raw as Record<string, unknown>)) {
      if (data && typeof data === 'object' && Array.isArray((data as SaveSlot).shapes)) {
        out[name] = data as SaveSlot;
      }
    }
    return out;
  } catch { return {}; }
}

function _writeAll(saves: SavesMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

/** List all saved slots: [{ name, date, count }] sorted by date desc. */
export function listSaves(): Array<{ name: string; date: number; count: number }> {
  const saves = _readAll();
  return Object.entries(saves)
    .map(([name, data]) => ({ name, date: data.date, count: data.shapes.length }))
    .sort((a, b) => b.date - a.date);
}

/** Save current shapes under a given name (overwrites if exists). */
export function saveSlot(name: string, shapes: Shape[]): void {
  const saves = _readAll();
  saves[name] = { shapes: JSON.parse(JSON.stringify(shapes)), date: Date.now() };
  _writeAll(saves);
}

/** Load shapes from a named slot. Returns the array or null. */
export function loadSlot(name: string): Shape[] | null {
  const saves = _readAll();
  const slot = saves[name];
  return slot ? JSON.parse(JSON.stringify(slot.shapes)) : null;
}

/** Delete a named slot. */
export function deleteSlot(name: string): void {
  const saves = _readAll();
  delete saves[name];
  _writeAll(saves);
}

/** Rename a slot. */
export function renameSlot(oldName: string, newName: string): void {
  if (oldName === newName) return;
  const saves = _readAll();
  if (!saves[oldName]) return;
  saves[newName] = saves[oldName];
  delete saves[oldName];
  _writeAll(saves);
}

/** Save user options (unit mode, calibration mode, snap, etc.). */
export function saveOptions(opts: Record<string, unknown>): void {
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
}

/** Load user options. Returns the object or null. */
export function loadOptions(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
