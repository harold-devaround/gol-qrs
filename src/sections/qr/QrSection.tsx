import { useEffect, useMemo, useState } from "react";

interface QRItem {
  n: number;
  q: string;
  a: string;
  src: string;
  date: string;
  themes: string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight matches of `term` inside `text`. Splits text safely so React
 * still escapes everything (no dangerouslySetInnerHTML, no XSS risk).
 */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(term)})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() && part.length > 0 ? (
          <span key={i} className="highlight">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function QrSection() {
  const [data, setData] = useState<QRItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeThemes, setActiveThemes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/data.json")
      .then((r) => r.json())
      .then((d: QRItem[]) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allThemes = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.flatMap((d) => d.themes))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const t = search.toLowerCase();
    return data.filter((d) => {
      if (activeThemes.size > 0 && !d.themes.some((th) => activeThemes.has(th)))
        return false;
      if (t && !(d.q + " " + d.a).toLowerCase().includes(t)) return false;
      return true;
    });
  }, [data, search, activeThemes]);

  function toggleTheme(theme: string) {
    setActiveThemes((prev) => {
      if (theme === "__all__") return new Set();
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }

  if (error) {
    return (
      <div className="p-8 text-red-400">Erreur de chargement : {error}</div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="qr-header mb-4">
        <h1 className="text-2xl font-semibold">
          Guardians of Legends — Q&amp;R
        </h1>
        <p className="text-text-muted">
          Questions / Réponses officielles de la chasse au trésor
        </p>
      </div>

      <div className="qr-controls mb-4 space-y-3">
        <div className="search-box flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les questions et réponses…"
            autoComplete="off"
            className="flex-1 px-3 py-2 bg-bg-elevated border border-border rounded text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <span className="text-sm text-text-muted">
            {data ? `${filtered.length} / ${data.length}` : "…"}
          </span>
        </div>

        <div className="tags flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleTheme("__all__")}
            className={[
              "tag all-tag px-2 py-1 rounded text-xs border",
              activeThemes.size === 0
                ? "active bg-accent border-accent text-white"
                : "border-border hover:border-accent text-text-muted",
            ].join(" ")}
          >
            Tous
          </button>
          {allThemes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTheme(t)}
              className={[
                "tag px-2 py-1 rounded text-xs border",
                activeThemes.has(t)
                  ? "active bg-accent border-accent text-white"
                  : "border-border hover:border-accent text-text-muted",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="qr-list space-y-3">
        {filtered.map((d) => (
          <article
            key={d.n}
            className="qa-card p-3 bg-bg-elevated border border-border rounded"
          >
            <div className="qa-meta flex flex-wrap items-center gap-2 text-xs text-text-muted mb-2">
              <span className="qa-num font-mono">#{d.n}</span>
              <span className="qa-source">{d.src}</span>
              <span className="qa-date">{d.date}</span>
              <div className="qa-themes flex flex-wrap gap-1 ml-auto">
                {[...new Set(d.themes)].map((t) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 bg-bg-hover rounded text-[10px]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="qa-question mb-1">
              <strong>Q :</strong> <Highlight text={d.q} term={search} />
            </div>
            <div className="qa-answer">
              <strong>R :</strong> <Highlight text={d.a} term={search} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
