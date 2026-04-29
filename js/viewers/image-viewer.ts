/**
 * Simple image gallery viewer — grid of clickable thumbnails with
 * a lightbox for full-size viewing. No drawing tools.
 */
interface GalleryImage {
  name: string;
  thumb: string;
  full: string;
}

export function initImageViewer(
  container: Element,
  { title, images }: { title: string; images: GalleryImage[] }
): void {
  container.innerHTML = `
    <div class="viewer">
      <div class="viewer-header">
        <h2>${title}</h2>
        <p class="viewer-count">${images.length} images</p>
      </div>
      <div class="viewer-grid"></div>
    </div>`;

  const grid = container.querySelector('.viewer-grid')!;

  for (const img of images) {
    const card = document.createElement('div');
    card.className = 'viewer-card';
    card.innerHTML = `
      <img src="${img.thumb}" alt="${img.name}" loading="lazy">
      <span class="viewer-card-label">${img.name}</span>`;
    card.addEventListener('click', () => openLightbox(img));
    grid.appendChild(card);
  }

  // ── Lightbox ──────────────────────────────────────────
  function openLightbox(img: GalleryImage): void {
    const existing = container.querySelector('.viewer-lightbox');
    if (existing) existing.remove();

    const lb = document.createElement('div');
    lb.className = 'viewer-lightbox';
    lb.innerHTML = `
      <div class="lb-backdrop"></div>
      <div class="lb-content">
        <button class="lb-close" title="Fermer">&times;</button>
        <img src="${img.full}" alt="${img.name}">
        <span class="lb-label">${img.name}</span>
      </div>`;

    const closeLb = (): void => { lb.remove(); document.removeEventListener('keydown', onKey); };
    lb.querySelector('.lb-backdrop')!.addEventListener('click', closeLb);
    lb.querySelector('.lb-close')!.addEventListener('click', closeLb);
    container.appendChild(lb);

    // Escape key to close
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeLb(); };
    document.addEventListener('keydown', onKey);
  }
}
