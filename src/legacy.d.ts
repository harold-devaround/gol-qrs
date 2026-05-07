/**
 * Ambient declarations for the legacy `js/` modules consumed from `src/`.
 * They are kept out of the app tsconfig `include` so we don't pay their
 * `// @ts-nocheck` overhead, but we still need TypeScript to accept the
 * dynamic imports referencing them by `.js` extension.
 */
declare module "*/js/map/map-section.js" {
  export function initMap(container: HTMLElement): void;
}
