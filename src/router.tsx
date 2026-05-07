import { createHashRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppLayout } from "./layout/AppLayout";

// Lazy-load each section so a failure in one module (e.g. Konva canvas)
// cannot break the whole app — mirrors the legacy lazy-init behaviour.
const QrSection = lazy(() => import("./sections/qr/QrSection"));
const MapSection = lazy(() => import("./sections/map/MapSection"));
const CpSection = lazy(() => import("./sections/cp/CpSection"));
const TuilesSection = lazy(() => import("./sections/tuiles/TuilesSection"));

function SectionFallback() {
  return (
    <div className="flex items-center justify-center h-full text-text-muted">
      Chargement…
    </div>
  );
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<SectionFallback />}>{node}</Suspense>;
}

/**
 * Hash-based router so the app stays deployable as a static site (Render,
 * GitHub Pages, etc.) without server-side URL rewrites.
 */
export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/qr" replace /> },
      { path: "qr", element: withSuspense(<QrSection />) },
      { path: "map", element: withSuspense(<MapSection />) },
      { path: "cp", element: withSuspense(<CpSection />) },
      { path: "tuiles", element: withSuspense(<TuilesSection />) },
      { path: "*", element: <Navigate to="/qr" replace /> },
    ],
  },
]);
