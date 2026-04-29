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

      // Toggle active class on tabs
      tabs.forEach(t => t.classList.toggle('active', t === tab));

      // Toggle active class on sections
      sections.forEach(s => s.classList.toggle('active', s.id === `section-${target}`));

      // Lazy-initialize the section on first visit
      if (!initialized[target]) {
        initialized[target] = true;
        const el = sections.find(s => s.id === `section-${target}`);
        const initFn = inits[target];
        if (initFn && el) {
          try {
            initFn(el);
          } catch (e) {
            console.error(`[tab-router] Failed to initialize section "${target}":`, e);
          }
        }
      }
    });
  });

  return { initialized };
}
