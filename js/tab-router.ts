// @ts-nocheck
/**
 * Tab router — manages the navigation between app sections.
 *
 * Extracted from app.js so the routing logic can be unit-tested
 * independently of the browser environment.
 *
 * @param {Element[]} tabs         - Tab button elements (must have data-section attribute)
 * @param {Element[]} sections     - Section elements (must have id="section-{name}")
 * @param {Object}    inits        - Map of section name → init function(el). May be async.
 * @param {string[]}  [alreadyInited] - Section names already initialized before this call.
 *                                    Their init function will NOT be called on first click.
 * @returns {{ initialized: Object }} - The initialization tracking state (for introspection/tests)
 */
export function initTabRouter(tabs, sections, inits, alreadyInited = []) {
  const initialized = Object.fromEntries(alreadyInited.map(k => [k, true]));

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.section;

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
