/**
 * Tab router — manages the navigation between app sections.
 *
 * Extracted from app.js so the routing logic can be unit-tested
 * independently of the browser environment.
 */

interface TabRouterResult {
  initialized: Record<string, boolean>;
}

type InitFn = (el: Element) => unknown | Promise<unknown>;

export function initTabRouter(
  tabs: Element[],
  sections: Element[],
  inits: Record<string, InitFn>,
  alreadyInited: string[] = []
): TabRouterResult {
  const initialized: Record<string, boolean> = Object.fromEntries(alreadyInited.map(k => [k, true]));

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = (tab as HTMLElement).dataset.section;
      if (!target) return;

      // Toggle active class on tabs (and sync aria-selected when available)
      tabs.forEach(t => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        // Defensive: tests use lightweight mocks without setAttribute
        if (typeof (t as Element).setAttribute === 'function') {
          (t as Element).setAttribute('aria-selected', String(isActive));
        }
      });

      // Toggle active class on sections
      sections.forEach(s => s.classList.toggle('active', s.id === `section-${target}`));

      // Lazy-initialize the section on first visit
      if (!initialized[target]) {
        initialized[target] = true;
        const el = sections.find(s => s.id === `section-${target}`);
        const initFn = inits[target];
        if (initFn && el) {
          // Catch BOTH synchronous throws and rejected promises so a broken
          // section module never breaks the whole app.
          try {
            const result = initFn(el);
            if (result && typeof (result as Promise<unknown>).then === 'function') {
              (result as Promise<unknown>).catch(e => {
                console.error(`[tab-router] Failed to initialize section "${target}":`, e);
              });
            }
          } catch (e) {
            console.error(`[tab-router] Failed to initialize section "${target}":`, e);
          }
        }
      }
    });
  });

  return { initialized };
}
