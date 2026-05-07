import { useEffect, useState, useCallback } from "react";

export interface GalleryImage {
  name: string;
  thumb: string;
  full: string;
}

interface ImageGalleryProps {
  title: string;
  images: GalleryImage[];
}

/**
 * Replaces the legacy js/viewers/image-viewer.ts.
 * Renders a thumbnail grid and a lightbox overlay (Escape/arrow-key driven).
 *
 * Anti-XSS: image names are rendered as text via JSX (React escapes by
 * default), preserving the property tested in the legacy
 * `image-viewer.test.ts`.
 */
export function ImageGallery({ title, images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);
  const next = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  );
  const prev = useCallback(
    () =>
      setActiveIndex((i) =>
        i === null ? null : (i - 1 + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, close, next, prev]);

  return (
    <section className="p-4">
      <h1 className="text-xl font-semibold mb-4">{title}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {images.map((img, i) => (
          <button
            key={img.name}
            type="button"
            onClick={() => setActiveIndex(i)}
            className="group block bg-bg-elevated rounded overflow-hidden border border-border hover:border-accent transition-colors"
          >
            <img
              src={img.thumb}
              alt={img.name}
              loading="lazy"
              className="w-full h-32 object-cover"
            />
            <div className="px-2 py-1 text-xs text-text-muted group-hover:text-text">
              {img.name}
            </div>
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={images[activeIndex].name}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={close}
        >
          <img
            src={images[activeIndex].full}
            alt={images[activeIndex].name}
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Fermer"
            onClick={close}
            className="absolute top-3 right-3 text-white text-2xl leading-none px-2"
          >
            ×
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Précédent"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-3xl px-3"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Suivant"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-3xl px-3"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
