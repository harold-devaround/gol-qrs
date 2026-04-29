/**
 * Q&R section — refactored from the original single-page app.
 */
interface QRItem {
  n: number;
  q: string;
  a: string;
  src: string;
  date: string;
  themes: string[];
}

export function initQR(container: Element): void {
  container.innerHTML = `
    <div class="qr-header">
      <h1>Guardians of Legends — Q&amp;R</h1>
      <p>Questions / Réponses officielles de la chasse au trésor</p>
    </div>
    <div class="qr-controls">
      <div class="search-box">
        <input type="text" id="qr-search" placeholder="Rechercher dans les questions et réponses…" autocomplete="off">
        <span id="qr-count"></span>
      </div>
      <div class="tags" id="qr-tags"></div>
    </div>
    <div id="qr-list" class="qr-list"></div>`;

  fetch('data.json')
    .then(r => r.json())
    .then((data: QRItem[]) => setup(container, data))
    .catch(err => {
      const p = document.createElement('p');
      p.style.cssText = 'color:#e74c3c;padding:2rem';
      p.textContent = `Erreur de chargement : ${err.message}`;
      container.querySelector('#qr-list')!.replaceChildren(p);
    });
}

function setup(root: Element, data: QRItem[]): void {
  const allThemes = [...new Set(data.flatMap(d => d.themes))].filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'fr'));
  const activeThemes = new Set<string>();
  let searchTerm = '';

  const esc = (s: string): string => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  function highlight(text: string, term: string): string {
    if (!term) return esc(text);
    const h = esc(text);
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return h.replace(re, '<span class="highlight">$1</span>');
  }

  function render(): void {
    const list = root.querySelector('#qr-list')!;
    const countEl = root.querySelector('#qr-count')!;
    const t = searchTerm.toLowerCase();
    const filtered = data.filter(d => {
      if (activeThemes.size > 0 && !d.themes.some(th => activeThemes.has(th))) return false;
      if (t && !(d.q + ' ' + d.a).toLowerCase().includes(t)) return false;
      return true;
    });
    countEl.textContent = `${filtered.length} / ${data.length}`;
    list.innerHTML = filtered.map(d => `
      <div class="qa-card">
        <div class="qa-meta">
          <span class="qa-num">#${d.n}</span>
          <span class="qa-source">${esc(d.src)}</span>
          <span class="qa-date">${esc(d.date)}</span>
          <div class="qa-themes">${d.themes.map(t => `<span>${esc(t)}</span>`).join('')}</div>
        </div>
        <div class="qa-question"><strong>Q :</strong> ${highlight(d.q, searchTerm)}</div>
        <div class="qa-answer"><strong>R :</strong> ${highlight(d.a, searchTerm)}</div>
      </div>`).join('');
  }

  function renderTags(): void {
    const c = root.querySelector('#qr-tags')!;
    c.innerHTML =
      `<span class="tag all-tag${activeThemes.size === 0 ? ' active' : ''}" data-theme="__all__">Tous</span>` +
      allThemes.map(t =>
        `<span class="tag${activeThemes.has(t) ? ' active' : ''}" data-theme="${esc(t)}">${esc(t)}</span>`
      ).join('');
  }

  root.querySelector('#qr-tags')!.addEventListener('click', e => {
    const tag = (e.target as Element).closest('.tag') as HTMLElement | null;
    if (!tag) return;
    const theme = tag.dataset.theme!;
    if (theme === '__all__') activeThemes.clear();
    else if (activeThemes.has(theme)) activeThemes.delete(theme);
    else activeThemes.add(theme);
    renderTags();
    render();
  });

  root.querySelector('#qr-search')!.addEventListener('input', e => {
    searchTerm = (e.target as HTMLInputElement).value;
    render();
  });

  renderTags();
  render();
}
