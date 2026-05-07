import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/qr", label: "Q\u0026R" },
  { to: "/map", label: "Carte" },
  { to: "/cp", label: "CP" },
  { to: "/tuiles", label: "Tuiles" },
] as const;

export function AppLayout() {
  return (
    <div className="flex flex-col h-full">
      <nav
        id="app-nav"
        aria-label="Navigation principale"
        className="flex items-center gap-4 px-4 py-2 border-b border-border bg-bg-elevated"
      >
        <span className="nav-brand font-semibold tracking-wide">GOL</span>
        <div role="tablist" className="flex gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              role="tab"
              className={({ isActive }) =>
                [
                  "px-3 py-1.5 rounded text-sm transition-colors",
                  isActive
                    ? "bg-accent text-white"
                    : "text-text-muted hover:bg-bg-hover hover:text-text",
                ].join(" ")
              }
              aria-selected={undefined /* react-router sets aria-current */}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main id="app-content" className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
