/**
 * Bridge — exposes the npm `fabric` package as a global `fabric` object so
 * the legacy `js/map/fabric-canvas.ts` code (which expects a UMD global from
 * the original `<script src="dist/vendor/fabric.js">` setup) keeps working
 * unchanged inside the Vite + React app.
 *
 * Imported once for its side-effect from src/main.tsx before any lazy-loaded
 * map module runs.
 */
import * as fabricNs from "fabric";

declare global {
  // eslint-disable-next-line no-var
  var fabric: typeof fabricNs;
}

if (typeof globalThis !== "undefined") {
  // Re-expose every named export under the `fabric.X` shape the legacy code
  // uses (e.g. `new fabric.Canvas(...)`, `new fabric.FabricImage(...)`).
  (globalThis as { fabric?: typeof fabricNs }).fabric = fabricNs;
}

export {};
