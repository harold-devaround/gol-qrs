/**
 * Simple image gallery viewer — grid of clickable thumbnails with
 * a lightbox for full-size viewing. No drawing tools.
 *
 * All user-controlled strings (title, image names) are inserted via
 * `textContent` / DOM properties — never interpolated into `innerHTML` —
 * so they cannot escape into HTML / break out of attribute context.
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
  // Static skeleton (no user input interpolated).
  container.innerHTML = `
    <div class="viewer">
      <div class="viewer-header">
        <h2></h2>
        <p class="viewer-count"></p>
      </div>
      <div class="viewer-grid"></div>
    </div>`;

  container.querySelector('.viewer-header h2')!.textContent = title;
  container.querySelector('.viewer-count')!.textContent = `${images.length} images`;

  const grid = container.querySelector('.viewer-grid')!;

  for (const img of images) {
    const card = document.createElement('div');
    card.className = 'viewer-card';
    const imgEl = document.createElement('img');
    imgEl.src = img.thumb;
    imgEl.alt = img.name;
    imgEl.loading = 'lazy';
    const label = document.createElement('span');
    label.className = 'viewer-card-label';
    label.textContent = img.name;
    card.append(imgEl, label);
    card.addEventListener('click', () => openLightbox(img));
    grid.appendChild(card);
  }

  // ── Lightbox ──────────────────────────────────────────
  function openLightbox(img: GalleryImage): void {
    const existing = container.querySelector('.viewer-lightbox');
    if (existing) existing.remove();

    const lb = document.createElement('div');
    lb.className = 'viewer-lightbox';

    const backdrop = document.createElement('div');
    backdrop.className = 'lb-backdrop';

    const content = document.createElement('div');
    content.className = 'lb-content';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lb-close';
    closeBtn.title = 'Fermer';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.innerHTML = '&times;';

    const fullImg = document.createElement('img');
    fullImg.src = img.full;
    fullImg.alt = img.name;

    const labelEl = document.createElement('span');
    labelEl.className = 'lb-label';
    labelEl.textContent = img.name;

    content.append(closeBtn, fullImg, labelEl);
    lb.append(backdrop, content);

    const closeLb = (): void => { lb.remove(); document.removeEventListener('keydown', onKey); };
    backdrop.addEventListener('click', closeLb);
    closeBtn.addEventListener('click', closeLb);
    container.appendChild(lb);

    // Escape key to close
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeLb(); };
    document.addEventListener('keydown', onKey);
  }
}
