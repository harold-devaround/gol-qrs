import { useEffect, useRef } from "react";

/**
 * Legacy map orchestrator (Fabric.js + ShapeStore + ToolManager + 11 tools)
 * is mounted into a React-managed container. The orchestrator builds its own
 * DOM, so we only give it an empty <div> and never let React touch the
 * children — `useEffect` runs once with a cleanup that wipes the container.
 *
 * Long-term plan: replace the Fabric internals of MapCanvas with Konva while
 * keeping the same public API surface (zoom/pan/snap/event-emitter); all
 * tools and UI built on top remain unchanged.
 */
export default function MapSection() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;

    // Dynamic import so a failure inside the legacy module cannot break the
    // rest of the SPA — mirrors the lazy-init isolation from the legacy
    // tab-router.ts.
    (async () => {
      try {
        // Vite resolves the `.js` extension used by the legacy ESM imports
        // via `resolve.extensions` in vite.config.ts.
        const mod = await import("../../../js/map/map-section.js");
        if (disposed) return;
        mod.initMap(el);
      } catch (err) {
        // Surface the error in-place rather than crashing the SPA.
        // eslint-disable-next-line no-console
        console.error("[MapSection] failed to initialise legacy map:", err);
        el.innerHTML =
          '<div style="padding:2rem;color:#e74c3c">Erreur de chargement de la carte. Voir la console.</div>';
      }
    })();

    return () => {
      disposed = true;
      // The legacy module attaches listeners to its own DOM subtree only,
      // so wiping the container detaches them too.
      el.innerHTML = "";
    };
  }, []);

  return <div ref={ref} className="map-section-host h-full w-full" />;
}
