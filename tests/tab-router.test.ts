// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { initTabRouter } from '../js/tab-router.ts';

/* ── DOM helpers ──────────────────────────────────────────── */

function makeTab(section, active = false) {
  const classes = new Set(active ? ['nav-tab', 'active'] : ['nav-tab']);
  const listeners = {};
  return {
    dataset: { section },
    classList: {
      toggle(cls, force) { if (force) classes.add(cls); else classes.delete(cls); },
      contains(cls) { return classes.has(cls); },
    },
    addEventListener(event, fn) { listeners[event] = fn; },
    click() { listeners['click']?.(); },
  };
}

function makeSection(name, active = false) {
  const classes = new Set(active ? ['app-section', 'active'] : ['app-section']);
  return {
    id: `section-${name}`,
    classList: {
      toggle(cls, force) { if (force) classes.add(cls); else classes.delete(cls); },
      contains(cls) { return classes.has(cls); },
    },
  };
}

function setup() {
  const tabs = [
    makeTab('qr', true),
    makeTab('map'),
    makeTab('cp'),
    makeTab('tuiles'),
  ];
  const sections = [
    makeSection('qr', true),
    makeSection('map'),
    makeSection('cp'),
    makeSection('tuiles'),
  ];
  const initMap = vi.fn();
  const initCP = vi.fn();
  const initTuiles = vi.fn();
  const inits = { map: initMap, cp: initCP, tuiles: initTuiles };
  return { tabs, sections, inits, initMap, initCP, initTuiles };
}

/* ── Tests ────────────────────────────────────────────────── */

describe('initTabRouter', () => {
  describe('tab activation', () => {
    it('clicking a tab marks it active and deactivates others', () => {
      const { tabs, sections, inits } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map
      expect(tabs[1].classList.contains('active')).toBe(true);
      expect(tabs[0].classList.contains('active')).toBe(false);
      expect(tabs[2].classList.contains('active')).toBe(false);
      expect(tabs[3].classList.contains('active')).toBe(false);
    });

    it('clicking a different tab changes the active tab', () => {
      const { tabs, sections, inits } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map
      tabs[2].click(); // cp
      expect(tabs[2].classList.contains('active')).toBe(true);
      expect(tabs[1].classList.contains('active')).toBe(false);
    });

    it('clicking the already-active tab keeps it active', () => {
      const { tabs, sections, inits } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[0].click(); // qr (already active)
      expect(tabs[0].classList.contains('active')).toBe(true);
    });
  });

  describe('section visibility', () => {
    it('clicking a tab shows the corresponding section', () => {
      const { tabs, sections, inits } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map
      expect(sections[1].classList.contains('active')).toBe(true);
    });

    it('clicking a tab hides all other sections', () => {
      const { tabs, sections, inits } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map
      expect(sections[0].classList.contains('active')).toBe(false);
      expect(sections[2].classList.contains('active')).toBe(false);
      expect(sections[3].classList.contains('active')).toBe(false);
    });

    it('switching tabs hides the previously active section', () => {
      const { tabs, sections, inits } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map — becomes active
      tabs[2].click(); // cp — becomes active, map hides
      expect(sections[1].classList.contains('active')).toBe(false);
      expect(sections[2].classList.contains('active')).toBe(true);
    });
  });

  describe('lazy initialization', () => {
    it('init function is called on the first click', () => {
      const { tabs, sections, inits, initMap } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map
      expect(initMap).toHaveBeenCalledOnce();
    });

    it('init function receives the correct section element', () => {
      const { tabs, sections, inits, initMap } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map
      expect(initMap).toHaveBeenCalledWith(sections[1]);
    });

    it('init function is NOT called a second time on repeated clicks', () => {
      const { tabs, sections, inits, initMap } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click();
      tabs[1].click();
      expect(initMap).toHaveBeenCalledOnce();
    });

    it('init function is NOT called again after switching away and back', () => {
      const { tabs, sections, inits, initMap } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map → initialized
      tabs[0].click(); // back to qr
      tabs[1].click(); // map again → already initialized
      expect(initMap).toHaveBeenCalledOnce();
    });

    it('each section is initialized independently', () => {
      const { tabs, sections, inits, initMap, initCP, initTuiles } = setup();
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map
      tabs[2].click(); // cp
      tabs[3].click(); // tuiles
      expect(initMap).toHaveBeenCalledOnce();
      expect(initCP).toHaveBeenCalledOnce();
      expect(initTuiles).toHaveBeenCalledOnce();
    });
  });

  describe('pre-initialized sections (alreadyInited)', () => {
    it('pre-initialized section is not re-initialized on click', () => {
      const { tabs, sections } = setup();
      const initQR = vi.fn();
      const inits = { qr: initQR };
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[0].click(); // qr (already inited)
      expect(initQR).not.toHaveBeenCalled();
    });

    it('pre-initialized section appears in the initialized state', () => {
      const { tabs, sections, inits } = setup();
      const { initialized } = initTabRouter(tabs, sections, inits, ['qr']);

      expect(initialized['qr']).toBe(true);
      expect(initialized['map']).toBeUndefined();
    });

    it('non-pre-initialized section is recorded as initialized after first click', () => {
      const { tabs, sections, inits } = setup();
      const { initialized } = initTabRouter(tabs, sections, inits, ['qr']);

      expect(initialized['map']).toBeUndefined();
      tabs[1].click();
      expect(initialized['map']).toBe(true);
    });
  });

  describe('error isolation', () => {
    it('an error in one init does not prevent other tabs from being activated', () => {
      const { tabs, sections } = setup();
      const initCP = vi.fn();
      const inits = {
        map: () => { throw new Error('map init failed'); },
        cp: initCP,
      };
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map — throws
      tabs[2].click(); // cp — should still work
      expect(initCP).toHaveBeenCalledOnce();
      consoleError.mockRestore();
    });

    it('an error in one init does not prevent section classes from being updated', () => {
      const { tabs, sections } = setup();
      const inits = {
        map: () => { throw new Error('map init failed'); },
      };
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click(); // map — throws but section should still become active
      expect(sections[1].classList.contains('active')).toBe(true);
      expect(tabs[1].classList.contains('active')).toBe(true);
      consoleError.mockRestore();
    });

    it('an error is logged to console.error', () => {
      const { tabs, sections } = setup();
      const err = new Error('bang');
      const inits = { map: () => { throw err; } };
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      initTabRouter(tabs, sections, inits, ['qr']);

      tabs[1].click();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('sections without an init function', () => {
    it('clicking a tab with no init function does not throw', () => {
      const { tabs, sections } = setup();
      initTabRouter(tabs, sections, {}, ['qr']); // no inits at all

      expect(() => tabs[1].click()).not.toThrow();
    });

    it('section still becomes active even without an init function', () => {
      const { tabs, sections } = setup();
      initTabRouter(tabs, sections, {}, ['qr']);

      tabs[1].click(); // map — no init
      expect(sections[1].classList.contains('active')).toBe(true);
    });
  });
});
