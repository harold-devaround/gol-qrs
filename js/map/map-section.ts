// @ts-nocheck
import { MapCanvas } from './fabric-canvas.js';
import { ShapeStore } from './store.js';
import { History } from './history.js';
import { Measurement } from './measurement.js';
import { ToolManager } from './tools/manager.js';
import { renderShape, shapeInfo, TYPE_LABELS, generateConcentrics, normalizeDial, DIAL_DEFAULTS, DIAL_RADIUS_LIMITS, DIAL_PRESETS, DIAL_LABEL_MODES, DIAL_MIN_DIVISIONS, DIAL_MAX_DIVISIONS } from './shapes.js';
import { listSaves, saveSlot, loadSlot, deleteSlot, saveOptions, loadOptions } from './save-manager.js';
import { buildGradGrid, LON_Y0, LON_H, LON_Y0_BOT, LON_H_BOT, LAT_X0, LAT_W, LAT_X0_RIGHT, LAT_W_RIGHT } from './gps-calibration.js';
import { distance, azimuthDeg, compassCodeBoussolaire, angleDeg } from '../utils/geometry.js';
import gpsGraduations from '../../data/gps-graduations.json';

/**
 * Fonds de carte disponibles (combobox « Carte » dans la barre d'action).
 * - `widthCm`/`heightCm` : dimensions physiques du poster → calibration px/cm.
 *   `null` quand elles sont inconnues : les mesures restent en pixels.
 * - `gps` : la calibration GPS pré-détectée (data/gps-graduations.json) ne vaut
 *   que pour la WorldMap MHF ; sur les autres images lon/lat serait faux.
 */
const MAPS = {
  worldmap: {
    label: 'WorldMap MHF',
    src: '2019_WorldMap_MHF_1.2x1.6m.jpg',
    widthCm: 160,
    heightCm: 120,
    gps: true,
  },
  multiline: {
    label: 'Multiline',
    src: '2019_Multiline.jpg',
    widthCm: null,
    heightCm: null,
    gps: false,
  },
};
const DEFAULT_MAP_KEY = 'worldmap';

/** Escape user-controlled text for safe HTML interpolation (text and attribute contexts). */
const _escEl = typeof document !== 'undefined' ? document.createElement('div') : null;
function esc(s) {
  if (s === undefined || s === null) return '';
  if (!_escEl) return String(s);
  _escEl.textContent = String(s);
  // textContent escapes &, <, >; we additionally escape " and ' for safe attribute use.
  return _escEl.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Map section orchestrator — wires together canvas, store, tools, and UI.
 */
export function initMap(container) {
  container.innerHTML = `
    <div class="map-layout">
      <div class="map-actionbar" id="map-actionbar" role="toolbar" aria-label="Barre d'actions"></div>
      <div class="map-main" id="map-main">
        <div class="map-canvas-wrap" id="map-canvas-wrap"></div>
        <div class="map-toolbar" id="map-toolbar" role="toolbar" aria-label="Outils de dessin"></div>
        <div class="map-props-backdrop" id="map-props-backdrop" aria-hidden="true"></div>
        <button class="btn-props-toggle" id="btn-props-toggle" type="button" aria-label="Afficher les propriétés" title="Propriétés">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="map-props-resizer" id="map-props-resizer" role="separator" aria-orientation="vertical" aria-label="Redimensionner le panneau" title="Glisser pour redimensionner"></div>
        <aside class="map-props" id="map-props" aria-label="Propriétés"></aside>
      </div>
      <div class="map-statusbar" id="map-statusbar" role="status" aria-live="polite"></div>
    </div>`;

  // Core modules
  const store = new ShapeStore();
  const canvasWrap = container.querySelector('#map-canvas-wrap');
  const canvas = new MapCanvas(canvasWrap);
  const history = new History(store);
  const measurement = new Measurement();

  const toolCtx = { store, canvas, history, measurement, angleSnapStep: 45, onCalibrated: () => updateUI() };
  const tools = new ToolManager(toolCtx);

  // Calibration ratios (computed on image load)
  let calRatios = null; // { height, width, avg }
  let calMode = 'height'; // 'height' | 'width' | 'avg'

  // Active background map (key of MAPS)
  let mapKey = DEFAULT_MAP_KEY;

  // Graduation grid state
  let gradGridMode  = 'none'; // 'none' | 'major' | 'all'
  let gradGridData  = null; // { lonLines, latLines } from buildGradGrid (includes intermediates)

  // Pre-detected graduation tick positions (dumped from detectGraduations,
  // see scripts/dump-graduations.mjs). Includes a +1px shift on lon/lat ticks.
  const detectedGrads = gpsGraduations;
  // Map-wide divided circle around points (points opt out with `hideDial`)
  let dialSettings = { ...DIAL_DEFAULTS };
  const labelVisibility = {
    point: true, segment: true, line: true, circle: true,
    triangle: true, angle: true, median: true, bisector: true,
  };

  // ──── Mobile props panel toggle ───────────────────────
  const propsEl = container.querySelector('#map-props');
  const backdropEl = container.querySelector('#map-props-backdrop');
  const propsToggleBtn = container.querySelector('#btn-props-toggle');

  function openProps() {
    propsEl.classList.add('open');
    backdropEl.classList.add('open');
    backdropEl.setAttribute('aria-hidden', 'false');
    propsToggleBtn.classList.add('active');
    propsToggleBtn.setAttribute('aria-expanded', 'true');
    propsToggleBtn.setAttribute('aria-label', 'Masquer les propriétés');
  }
  function closeProps() {
    propsEl.classList.remove('open');
    backdropEl.classList.remove('open');
    backdropEl.setAttribute('aria-hidden', 'true');
    propsToggleBtn.classList.remove('active');
    propsToggleBtn.setAttribute('aria-expanded', 'false');
    propsToggleBtn.setAttribute('aria-label', 'Afficher les propriétés');
  }
  propsToggleBtn.setAttribute('aria-expanded', 'false');
  propsToggleBtn.addEventListener('click', () => {
    if (propsEl.classList.contains('open')) closeProps(); else openProps();
  });
  backdropEl.addEventListener('click', closeProps);

  // ──── Props panel resizer (desktop) ───────────────────
  const resizerEl = container.querySelector('#map-props-resizer');
  const mainEl = container.querySelector('#map-main');
  const PROPS_WIDTH_KEY = 'gol-qrs:props-width';
  const PROPS_WIDTH_MIN = 220;
  const PROPS_WIDTH_MAX = 800;
  try {
    const saved = parseInt(localStorage.getItem(PROPS_WIDTH_KEY) || '');
    if (saved >= PROPS_WIDTH_MIN && saved <= PROPS_WIDTH_MAX) {
      mainEl.style.setProperty('--props-width', saved + 'px');
    }
  } catch { /* localStorage unavailable */ }
  let _resizing = false;
  resizerEl.addEventListener('pointerdown', (e) => {
    _resizing = true;
    resizerEl.setPointerCapture(e.pointerId);
    resizerEl.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    e.preventDefault();
  });
  resizerEl.addEventListener('pointermove', (e) => {
    if (!_resizing) return;
    const rect = mainEl.getBoundingClientRect();
    const w = Math.max(PROPS_WIDTH_MIN, Math.min(PROPS_WIDTH_MAX, rect.right - e.clientX));
    mainEl.style.setProperty('--props-width', w + 'px');
  });
  const endResize = (e) => {
    if (!_resizing) return;
    _resizing = false;
    try { resizerEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    resizerEl.classList.remove('dragging');
    document.body.style.cursor = '';
    const cur = mainEl.style.getPropertyValue('--props-width');
    const px = parseInt(cur);
    if (px) { try { localStorage.setItem(PROPS_WIDTH_KEY, String(px)); } catch { /* ignore */ } }
  };
  resizerEl.addEventListener('pointerup', endResize);
  resizerEl.addEventListener('pointercancel', endResize);

  // ──── (Tools toolbar is always visible — bottom strip on mobile, side rail on desktop) ────
  function closeTools() { /* no-op : la toolbar est toujours visible */ }

  // Render shapes via canvas callback
  canvas.onRenderShapes = (ctx) => {
    // Graduation grid overlay
    if (gradGridMode !== 'none' && gradGridData) {
      renderGradGrid(ctx, gradGridData, gradGridMode);
    }
    // Always show raw detected tick positions in red (debugging aid)
    renderDetectedTicks(ctx);
    for (const s of store.getVisible()) {
      renderShape(ctx, s, canvas, measurement, { labelVisibility, dial: dialSettings });
    }
  };

  // Refresh on store changes — skip props rebuild when editing inside panel
  let _editingProps = false;
  store.on('change', () => {
    canvas.requestRender();
    if (_editingProps) {
      // Update shape list labels without full rebuild
      const panel = container.querySelector('#map-props');
      if (panel) {
        panel.querySelectorAll('.shape-item').forEach(item => {
          const id = parseInt(item.dataset.id);
          const s = store.get(id);
          if (!s) return;
          const lbl = item.querySelector('.shape-label');
          if (lbl) lbl.textContent = `${TYPE_LABELS[s.type] || s.type} #${s.id}${s.label ? ' — ' + s.label : ''}`;
        });
      }
    } else {
      updateProps();
    }
  });
  store.on('selection', () => {
    canvas.requestRender();
    updateProps();
    // Auto-open props sheet on small screens when a shape is selected
    if (window.matchMedia('(max-width: 899px)').matches && store.getSelected().length > 0) {
      openProps();
    }
  });
  history.on('change', () => updateActionBar());
  measurement.on('change', () => { canvas.requestRender(); updateActionBar(); updateProps(); });
  tools.on('change', () => updateToolbar());

  // ──── Action Bar ──────────────────────────────────────

  // Position a dropdown menu below its trigger button using fixed positioning,
  // so it is never clipped by the action bar's overflow-x: auto.
  function openDropdown(menu, btn) {
    const rect = btn.getBoundingClientRect();
    menu.style.top  = rect.bottom + 'px';
    menu.style.left = rect.left + 'px';
    menu.classList.add('open');
    const overflow = rect.left + menu.offsetWidth - (window.innerWidth - 8);
    if (overflow > 0) menu.style.left = Math.max(8, rect.left - overflow) + 'px';
  }

  // ──── Divided circle (map-wide) ───────────────────────

  // Radius shown in the menu: screen px, or map radius in the current unit (px or cm)
  const dialRadiusInCm = () => dialSettings.size === 'map' && measurement.mode === 'cm' && measurement.calibrated;
  function dialRadiusUnit() {
    if (dialSettings.size === 'screen') return 'px écran';
    return dialRadiusInCm() ? 'cm sur la carte' : 'px carte';
  }
  function dialRadiusValue() {
    if (dialSettings.size === 'screen') return dialSettings.radius;
    return parseFloat(measurement.fromPx(dialSettings.mapRadius).toFixed(2));
  }

  function dialMenuHtml() {
    const d = dialSettings;
    const presets = DIAL_PRESETS.map(n =>
      `<button class="props-preset-btn ${d.divisions === n ? 'active' : ''}" data-dial-preset="${n}">${n}</button>`).join('');
    const labelOpts = Object.entries(DIAL_LABEL_MODES).map(([k, m]) =>
      `<option value="${k}" ${d.labels === k ? 'selected' : ''}>${m.name}</option>`).join('');
    return `
      <label class="abar-dropdown-item">
        <input type="checkbox" id="dial-show" ${d.show ? 'checked' : ''}>
        <span>Afficher sur les points</span>
      </label>
      <div class="dial-menu-row"><span>Divisions</span><div class="props-presets">${presets}<input type="number" value="${d.divisions}" min="${DIAL_MIN_DIVISIONS}" max="${DIAL_MAX_DIVISIONS}" step="1" id="dial-divisions" class="props-input-sm props-input-xs" title="Nombre de secteurs (${DIAL_MIN_DIVISIONS}–${DIAL_MAX_DIVISIONS})"></div></div>
      <div class="dial-menu-row"><span>Grille</span><select id="dial-align" class="props-input">
        <option value="start" ${d.centered ? '' : 'selected'}>Une limite sur le nord</option>
        <option value="center" ${d.centered ? 'selected' : ''}>Un secteur centré sur le nord</option>
      </select></div>
      <div class="dial-menu-row"><span>Index</span><select id="dial-labels" class="props-input">${labelOpts}</select></div>
      <div class="dial-menu-row"><span>Taille</span><select id="dial-size" class="props-input">
        <option value="screen" ${d.size === 'screen' ? 'selected' : ''}>Fixe à l'écran</option>
        <option value="map" ${d.size === 'map' ? 'selected' : ''}>Fixe sur la carte (zoomable)</option>
      </select></div>
      <div class="dial-menu-row"><span>Rayon</span><div class="props-presets"><input type="number" value="${dialRadiusValue()}" min="0" step="any" id="dial-radius" class="props-input-sm props-input-xs"><span class="props-unit">${dialRadiusUnit()}</span></div></div>
      <div class="dial-menu-row"><span>Décalage</span><div class="props-presets"><input type="number" value="${d.offset}" step="1" id="dial-offset" class="props-input-sm props-input-xs" title="Secteurs entre le nord et le premier secteur, sens horaire"><span class="props-unit">secteurs, sens horaire</span></div></div>`;
  }

  // The menu stays open while editing: changes redraw the canvas and patch the
  // menu in place instead of rebuilding the action bar (which would close it).
  function bindDialMenu(menu, btn) {
    const apply = (patch, { refreshInputs = false } = {}) => {
      dialSettings = normalizeDial({ ...dialSettings, ...patch });
      btn.classList.toggle('active', dialSettings.show);
      menu.querySelectorAll('[data-dial-preset]').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.dialPreset) === dialSettings.divisions));
      if (refreshInputs) {
        menu.querySelector('#dial-divisions').value = dialSettings.divisions;
        menu.querySelector('#dial-offset').value = dialSettings.offset;
        menu.querySelector('#dial-radius').value = dialRadiusValue();
      }
      persistOptions();
      canvas.requestRender();
    };
    menu.querySelector('#dial-show').onchange = (e) => apply({ show: e.target.checked });
    menu.querySelectorAll('[data-dial-preset]').forEach(b => {
      b.onclick = () => apply({ divisions: parseInt(b.dataset.dialPreset) }, { refreshInputs: true });
    });
    const divInput = menu.querySelector('#dial-divisions');
    divInput.oninput = () => {
      const val = parseInt(divInput.value);
      if (val >= DIAL_MIN_DIVISIONS && val <= DIAL_MAX_DIVISIONS) apply({ divisions: val });
    };
    // On blur, show the clamped count and the offset reduced modulo the new count
    divInput.onchange = () => apply({ divisions: divInput.value }, { refreshInputs: true });
    menu.querySelector('#dial-align').onchange = (e) => apply({ centered: e.target.value === 'center' });
    menu.querySelector('#dial-labels').onchange = (e) => apply({ labels: e.target.value });
    // Switching size keeps the circle's current on-screen size, then rebuilds the
    // menu in place (radius unit changes) — the menu element stays open.
    menu.querySelector('#dial-size').onchange = (e) => {
      const size = e.target.value;
      const [lo, hi] = DIAL_RADIUS_LIMITS.screen;
      const patch = size === 'map'
        ? { size, mapRadius: dialSettings.radius / canvas.zoom }
        : { size, radius: Math.min(hi, Math.max(lo, dialSettings.mapRadius * canvas.zoom)) };
      apply(patch);
      menu.innerHTML = dialMenuHtml();
      bindDialMenu(menu, btn);
    };
    const radiusInput = menu.querySelector('#dial-radius');
    const radiusPatch = (raw) => {
      const val = parseFloat(raw);
      if (!(val > 0)) return null;
      return dialSettings.size === 'screen' ? { radius: val } : { mapRadius: measurement.toPx(val) };
    };
    radiusInput.oninput = () => {
      const patch = radiusPatch(radiusInput.value);
      if (patch) apply(patch);
    };
    radiusInput.onchange = () => apply(radiusPatch(radiusInput.value) ?? {}, { refreshInputs: true });
    const offInput = menu.querySelector('#dial-offset');
    offInput.oninput = () => {
      const val = parseInt(offInput.value);
      if (Number.isFinite(val)) apply({ offset: val });
    };
    offInput.onchange = () => apply({ offset: offInput.value }, { refreshInputs: true });
  }

  function updateActionBar() {
    const bar = container.querySelector('#map-actionbar');
    bar.innerHTML = `
      <div class="abar-group">
        <button class="abar-btn ${history.canUndo ? '' : 'disabled'}" id="btn-undo" title="Annuler (Ctrl+Z)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/><polyline points="7,6 3,10 7,14"/></svg>
        </button>
        <button class="abar-btn ${history.canRedo ? '' : 'disabled'}" id="btn-redo" title="Rétablir (Ctrl+Y)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H8a4 4 0 0 0 0 8h10"/><polyline points="17,6 21,10 17,14"/></svg>
        </button>
      </div>
      <div class="abar-sep"></div>
      <div class="abar-group">
        <button class="abar-btn" id="btn-zin" title="Zoom +">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <span class="abar-label" id="zoom-label">${Math.round(canvas.zoom * 100)}%</span>
        <button class="abar-btn" id="btn-zout" title="Zoom −">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button class="abar-btn" id="btn-fit" title="Ajuster à la vue (F)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
      </div>
      <div class="abar-sep"></div>
      <div class="abar-group">
        <button class="abar-btn abar-toggle ${canvas.snapEnabled ? 'active' : ''}" id="btn-snap" title="Accrochage aux points">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
          <span>Snap</span>
        </button>
        <div class="abar-dropdown" id="grad-grid-dropdown">
          <button class="abar-btn abar-toggle ${gradGridMode !== 'none' ? 'active' : ''} ${gradGridData ? '' : 'disabled'}" id="btn-grad-grid" title="${gradGridData ? 'Afficher la grille des graduations GPS' : 'Pas de calibration GPS pour cette carte'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            <span>${gradGridMode === 'none' ? 'Grille' : gradGridMode === 'major' ? 'Grille 15°' : 'Grille 1°'}</span>
          </button>
          <div class="abar-dropdown-menu" id="grad-grid-menu">
            <label class="abar-dropdown-item">
              <input type="radio" name="grad-grid-mode" value="none" ${gradGridMode === 'none' ? 'checked' : ''}>
              <span>Aucune</span>
            </label>
            <label class="abar-dropdown-item">
              <input type="radio" name="grad-grid-mode" value="major" ${gradGridMode === 'major' ? 'checked' : ''}>
              <span>Principales (15°)</span>
            </label>
            <label class="abar-dropdown-item">
              <input type="radio" name="grad-grid-mode" value="all" ${gradGridMode === 'all' ? 'checked' : ''}>
              <span>Toutes (1°)</span>
            </label>
          </div>
        </div>
        <div class="abar-dropdown" id="label-vis-dropdown">
          <button class="abar-btn abar-toggle" id="btn-label-vis" title="Visibilité des labels par type">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span>Labels</span>
          </button>
          <div class="abar-dropdown-menu" id="label-vis-menu">
            ${Object.entries(TYPE_LABELS).map(([type, lbl]) =>
              `<label class="abar-dropdown-item">
                <input type="checkbox" data-lbl-type="${type}" ${labelVisibility[type] ? 'checked' : ''}>
                <span>${lbl}</span>
              </label>`).join('')}
          </div>
        </div>
        <div class="abar-dropdown" id="dial-dropdown">
          <button class="abar-btn abar-toggle ${dialSettings.show ? 'active' : ''}" id="btn-dial" title="Cercle divisé autour des points">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>
            <span>Cercle</span>
          </button>
          <div class="abar-dropdown-menu abar-dial-menu" id="dial-menu">
            ${dialMenuHtml()}
          </div>
        </div>
        <div class="abar-dropdown" id="angle-snap-dropdown">
          <button class="abar-btn abar-toggle" id="btn-angle-snap" title="Pas d'angle pour le snap CTRL">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16"/><path d="M4 20L14 4"/><path d="M8 20a8 8 0 0 1 3.5-6.6"/></svg>
            <span>${toolCtx.angleSnapStep}°</span>
          </button>
          <div class="abar-dropdown-menu" id="angle-snap-menu">
            ${[15, 30, 45, 90].map(v =>
              `<label class="abar-dropdown-item">
                <input type="radio" name="angle-snap-step" value="${v}" ${toolCtx.angleSnapStep === v ? 'checked' : ''}>
                <span>${v}°</span>
              </label>`).join('')}
          </div>
        </div>
      </div>
      <div class="abar-sep"></div>
      <div class="abar-group">
        <label class="abar-select-wrap" for="select-map" title="Choisir le fond de carte">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/></svg>
          <select class="abar-select" id="select-map" aria-label="Fond de carte">
            ${Object.entries(MAPS).map(([key, cfg]) =>
              `<option value="${key}" ${key === mapKey ? 'selected' : ''}>${esc(cfg.label)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="abar-sep"></div>
      <div class="abar-group">
        <div class="unit-switch ${measurement.calibrated ? '' : 'disabled'}" id="unit-switch" title="Basculer px ↔ cm">
          <span class="unit-switch-label ${measurement.mode === 'px' ? 'active' : ''}">px</span>
          <div class="unit-switch-track ${measurement.mode === 'cm' ? 'on' : ''}">
            <div class="unit-switch-thumb"></div>
          </div>
          <span class="unit-switch-label ${measurement.mode === 'cm' ? 'active' : ''}">cm</span>
        </div>
        ${calRatios ? `<div class="abar-ratios">
          <button class="abar-ratio-btn ${calMode === 'height' ? 'active' : ''}" data-cal="height" title="Ratio hauteur (${MAPS[mapKey].heightCm}cm)">H ${calRatios.height.toFixed(1)}</button>
          <button class="abar-ratio-btn ${calMode === 'width' ? 'active' : ''}" data-cal="width" title="Ratio largeur (${MAPS[mapKey].widthCm}cm)">L ${calRatios.width.toFixed(1)}</button>
          <button class="abar-ratio-btn ${calMode === 'avg' ? 'active' : ''}" data-cal="avg" title="Ratio moyen">M ${calRatios.avg.toFixed(1)}</button>
          <span class="abar-label abar-cal-info">${measurement.pixelsPerCm.toFixed(1)} px/cm</span>
        </div>` : ''}
      </div>
      <div class="abar-spacer"></div>
      <div class="abar-group">
        <button class="abar-btn" id="btn-save" title="Sauvegarder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Sauver</span>
        </button>
        <button class="abar-btn" id="btn-load" title="Charger une sauvegarde">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Charger</span>
        </button>
        <button class="abar-btn" id="btn-report" title="Rapport (points + segments avec azimut)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></svg>
          <span>Rapport</span>
        </button>
      </div>
      <div class="abar-sep"></div>
      <div class="abar-group">
        <button class="abar-btn abar-danger" id="btn-clear" title="Tout effacer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;

    // Event bindings
    bar.querySelector('#btn-undo').onclick = () => { history.undo(); canvas.requestRender(); };
    bar.querySelector('#btn-redo').onclick = () => { history.redo(); canvas.requestRender(); };
    bar.querySelector('#btn-zin').onclick = () => canvas.zoomAt(canvas.el.clientWidth / 2, canvas.el.clientHeight / 2, 1.3);
    bar.querySelector('#btn-zout').onclick = () => canvas.zoomAt(canvas.el.clientWidth / 2, canvas.el.clientHeight / 2, 1 / 1.3);
    bar.querySelector('#btn-fit').onclick = () => canvas.fitToView();
    bar.querySelector('#btn-snap').onclick = () => { canvas.snapEnabled = !canvas.snapEnabled; updateActionBar(); };
    // Graduation grid dropdown
    const gradBtn = bar.querySelector('#btn-grad-grid');
    const gradMenu = bar.querySelector('#grad-grid-menu');
    if (gradBtn && gradMenu) {
      gradBtn.onclick = (e) => {
        e.stopPropagation();
        if (gradMenu.classList.contains('open')) {
          gradMenu.classList.remove('open');
        } else {
          openDropdown(gradMenu, gradBtn);
        }
      };
      gradMenu.querySelectorAll('[name="grad-grid-mode"]').forEach(radio => {
        radio.onchange = () => {
          gradGridMode = radio.value;
          canvas.requestRender();
          updateActionBar();
        };
      });
      document.addEventListener('click', (e) => {
        if (!bar.querySelector('#grad-grid-dropdown')?.contains(e.target)) {
          gradMenu.classList.remove('open');
        }
      });
    }
    // Background map selection
    const mapSelect = bar.querySelector('#select-map');
    if (mapSelect) {
      mapSelect.onchange = () => loadMap(mapSelect.value);
    }
    bar.querySelector('#unit-switch').onclick = () => { measurement.toggleMode(); };
    bar.querySelector('#btn-clear').onclick = () => {
      if (store.getAll().length === 0) return;
      if (!confirm('Supprimer toutes les formes ?')) return;
      history.save();
      store.clear();
    };
    bar.querySelector('#btn-save').onclick = () => openSaveModal();
    bar.querySelector('#btn-load').onclick = () => openLoadModal();
    bar.querySelector('#btn-report').onclick = () => openReportModal();

    // Calibration ratio selection
    bar.querySelectorAll('[data-cal]').forEach(btn => {
      btn.onclick = () => {
        calMode = btn.dataset.cal;
        applyCalRatio();
      };
    });

    // Label visibility dropdown
    const lblBtn = bar.querySelector('#btn-label-vis');
    const lblMenu = bar.querySelector('#label-vis-menu');
    if (lblBtn && lblMenu) {
      lblBtn.onclick = (e) => {
        e.stopPropagation();
        if (lblMenu.classList.contains('open')) {
          lblMenu.classList.remove('open');
        } else {
          openDropdown(lblMenu, lblBtn);
        }
      };
      lblMenu.querySelectorAll('[data-lbl-type]').forEach(chk => {
        chk.onchange = () => {
          labelVisibility[chk.dataset.lblType] = chk.checked;
          canvas.requestRender();
        };
      });
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!bar.querySelector('#label-vis-dropdown')?.contains(e.target)) {
          lblMenu.classList.remove('open');
        }
      });
    }

    // Divided circle dropdown (map-wide settings)
    const dialBtn = bar.querySelector('#btn-dial');
    const dialMenu = bar.querySelector('#dial-menu');
    if (dialBtn && dialMenu) {
      dialBtn.onclick = (e) => {
        e.stopPropagation();
        if (dialMenu.classList.contains('open')) {
          dialMenu.classList.remove('open');
        } else {
          openDropdown(dialMenu, dialBtn);
        }
      };
      bindDialMenu(dialMenu, dialBtn);
      document.addEventListener('click', (e) => {
        if (!bar.querySelector('#dial-dropdown')?.contains(e.target)) {
          dialMenu.classList.remove('open');
        }
      });
    }

    // Angle snap step dropdown
    const angBtn = bar.querySelector('#btn-angle-snap');
    const angMenu = bar.querySelector('#angle-snap-menu');
    if (angBtn && angMenu) {
      angBtn.onclick = (e) => {
        e.stopPropagation();
        if (angMenu.classList.contains('open')) {
          angMenu.classList.remove('open');
        } else {
          openDropdown(angMenu, angBtn);
        }
      };
      angMenu.querySelectorAll('[name="angle-snap-step"]').forEach(radio => {
        radio.onchange = () => {
          toolCtx.angleSnapStep = Number(radio.value);
          updateActionBar();
        };
      });
      document.addEventListener('click', (e) => {
        if (!bar.querySelector('#angle-snap-dropdown')?.contains(e.target)) {
          angMenu.classList.remove('open');
        }
      });
    }
  }

  // ──── Save / Load Modals ──────────────────────────────

  function persistOptions() {
    saveOptions({ mode: measurement.mode, calMode, snapEnabled: canvas.snapEnabled, labelVisibility: { ...labelVisibility }, angleSnapStep: toolCtx.angleSnapStep, dial: { ...dialSettings }, view: canvas.getViewState(), mapKey });
  }

  function openSaveModal() {
    const defaultName = 'Sauvegarde ' + new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const saves = listSaves();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>Sauvegarder</h3>
        <label class="modal-label">Nom de la sauvegarde</label>
        <div class="modal-input-row">
          <input type="text" class="modal-input" id="save-name" value="${esc(defaultName)}" maxlength="60">
        </div>
        ${saves.length ? `<p class="modal-subtitle">Sauvegardes existantes (cliquer pour écraser) :</p>
        <div class="save-slot-list">${saves.map(s =>
          `<div class="save-slot" data-name="${esc(s.name)}">
            <span class="save-slot-name">${esc(s.name)}</span>
            <span class="save-slot-meta">${s.count} formes · ${esc(new Date(s.date).toLocaleString('fr-FR'))}</span>
          </div>`).join('')}
        </div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-secondary" id="save-cancel">Annuler</button>
          <button class="btn btn-primary" id="save-confirm">Sauvegarder</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('#save-name');
    nameInput.select();

    overlay.querySelector('#save-cancel').onclick = () => overlay.remove();
    overlay.querySelector('.modal-overlay')?.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.save-slot').forEach(slot => {
      slot.onclick = () => { nameInput.value = slot.dataset.name; nameInput.select(); };
    });

    overlay.querySelector('#save-confirm').onclick = () => {
      const name = nameInput.value.trim();
      if (!name) return;
      saveSlot(name, store.getAll());
      persistOptions();
      overlay.remove();
    };

    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#save-confirm').click(); });
  }

  function openLoadModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    function renderList() {
      const current = listSaves();
      if (current.length === 0) {
        overlay.querySelector('.modal').innerHTML = `
          <h3>Charger une sauvegarde</h3>
          <p class="modal-subtitle">Aucune sauvegarde disponible.</p>
          <div class="modal-actions"><button class="btn btn-secondary" id="load-cancel">Fermer</button></div>`;
        overlay.querySelector('#load-cancel').onclick = () => overlay.remove();
        return;
      }
      const listHtml = current.map(s => `
        <div class="save-slot" data-name="${esc(s.name)}">
          <div class="save-slot-main">
            <span class="save-slot-name">${esc(s.name)}</span>
            <span class="save-slot-meta">${s.count} formes · ${esc(new Date(s.date).toLocaleString('fr-FR'))}</span>
          </div>
          <div class="save-slot-actions">
            <button class="btn btn-sm btn-primary save-load-btn" data-name="${esc(s.name)}">Charger</button>
            <button class="btn btn-sm btn-danger save-del-btn" data-name="${esc(s.name)}">×</button>
          </div>
        </div>`).join('');

      overlay.querySelector('.modal').innerHTML = `
        <h3>Charger une sauvegarde</h3>
        <div class="save-slot-list">${listHtml}</div>
        <div class="modal-actions"><button class="btn btn-secondary" id="load-cancel">Fermer</button></div>`;

      overlay.querySelector('#load-cancel').onclick = () => overlay.remove();
      overlay.querySelectorAll('.save-load-btn').forEach(btn => {
        btn.onclick = () => {
          const shapes = loadSlot(btn.dataset.name);
          if (!shapes) return;
          history.save();
          store.restore(shapes);
          // Restore saved options
          const opts = loadOptions();
          if (opts) {
            if (opts.mapKey && MAPS[opts.mapKey] && opts.mapKey !== mapKey) loadMap(opts.mapKey, { view: opts.view ?? null });
            if (opts.calMode && calRatios) { calMode = opts.calMode; applyCalRatio(); }
            if (opts.mode && opts.mode !== measurement.mode) measurement.toggleMode();
            if (opts.snapEnabled !== undefined) canvas.snapEnabled = opts.snapEnabled;
            if (opts.labelVisibility) Object.assign(labelVisibility, opts.labelVisibility);
            if (opts.angleSnapStep) toolCtx.angleSnapStep = opts.angleSnapStep;
            if (opts.dial) dialSettings = normalizeDial(opts.dial);
            if (opts.view) canvas.setViewState(opts.view);
          }
          overlay.remove();
          updateUI();
        };
      });
      overlay.querySelectorAll('.save-del-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          if (!confirm(`Supprimer « ${btn.dataset.name} » ?`)) return;
          deleteSlot(btn.dataset.name);
          renderList();
        };
      });
    }

    overlay.innerHTML = `<div class="modal"><h3>Charger une sauvegarde</h3></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    renderList();
  }

  // ──── Report Modal ────────────────────────────────────

  function openReportModal() {
    const isVisible = (s) => s.visible !== false;
    const all = store.getAll();
    const points   = all.filter(s => s.type === 'point' && isVisible(s));
    const segments = all.filter(s => s.type === 'segment' && isVisible(s));

    const labelOf = (s) => (s.label && s.label.trim()) ? s.label : `#${s.id}`;

    // Look up a point shape that coincides with the given (x,y) within 0.5 px.
    const pointAt = (p) => {
      let best = null, bestD = 0.5;
      for (const pt of points) {
        const d = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (d <= bestD) { best = pt; bestD = d; }
      }
      return best;
    };
    const endpointLabel = (p) => {
      const m = pointAt(p);
      return m ? esc(labelOf(m)) : `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
    };

    const pointsRows = points.length
      ? points.map(p => {
          let gpsCell = '—'; // carte sans calibration GPS
          if (measurement.gpsAvailable) {
            const { lon, lat } = measurement.toGPS(p.x, p.y);
            gpsCell = `${lon.toFixed(2)}°, ${lat.toFixed(2)}°`;
          }
          return `<tr>
            <td>${esc(labelOf(p))}</td>
            <td>${esc(measurement.formatCoord(p.x, p.y))}</td>
            <td>${gpsCell}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="3" class="report-empty">Aucun point.</td></tr>`;

    const segRows = segments.length
      ? segments.map(s => {
          const az = azimuthDeg(s.p1, s.p2);
          const code = compassCodeBoussolaire(az);
          const len = measurement.format(distance(s.p1, s.p2));
          return `<tr>
            <td>${esc(labelOf(s))}</td>
            <td>${endpointLabel(s.p1)} → ${endpointLabel(s.p2)}</td>
            <td>${len}</td>
            <td>${az.toFixed(1)}°</td>
            <td><span class="compass-code">${esc(code)}</span></td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="5" class="report-empty">Aucun segment visible.</td></tr>`;

    // Detect connected segments sharing a common endpoint → they form an angle.
    const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= 0.5;
    const angles = [];
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i], s2 = segments[j];
        const ends1 = [s1.p1, s1.p2], ends2 = [s2.p1, s2.p2];
        let vertex = null, arm1 = null, arm2 = null;
        for (const e1 of ends1) {
          for (const e2 of ends2) {
            if (same(e1, e2)) {
              vertex = e1;
              arm1 = e1 === s1.p1 ? s1.p2 : s1.p1;
              arm2 = e2 === s2.p1 ? s2.p2 : s2.p1;
            }
          }
        }
        if (vertex) angles.push({ s1, s2, vertex, arm1, arm2 });
      }
    }

    const angleRows = angles.length
      ? angles.map(({ s1, s2, vertex, arm1, arm2 }) => {
          const deg = angleDeg(arm1, vertex, arm2);
          const code = compassCodeBoussolaire(deg);
          return `<tr>
            <td>${esc(labelOf(s1))} ∠ ${esc(labelOf(s2))}</td>
            <td>${endpointLabel(vertex)}</td>
            <td>${deg.toFixed(1)}°</td>
            <td><span class="compass-code">${esc(code)}</span></td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="4" class="report-empty">Aucun angle.</td></tr>`;


    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-wide">
        <h3>Rapport</h3>
        <h4 class="report-section-title">Points (${points.length})</h4>
        <div class="report-table-wrap">
          <table class="report-table">
            <thead><tr><th>Label</th><th>Coordonnées</th><th>GPS (lon, lat)</th></tr></thead>
            <tbody>${pointsRows}</tbody>
          </table>
        </div>
        <h4 class="report-section-title">Segments visibles (${segments.length})</h4>
        <div class="report-table-wrap">
          <table class="report-table">
            <thead><tr><th>Label</th><th>Extrémités</th><th>Longueur</th><th>Azimut</th><th>Code</th></tr></thead>
            <tbody>${segRows}</tbody>
          </table>
        </div>
        <h4 class="report-section-title">Angles (segments connectés) (${angles.length})</h4>
        <div class="report-table-wrap">
          <table class="report-table">
            <thead><tr><th>Segments</th><th>Sommet</th><th>Angle</th><th>Code</th></tr></thead>
            <tbody>${angleRows}</tbody>
          </table>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="report-close">Fermer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#report-close').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // Update zoom label on viewport changes
  const _origZoomAt = canvas.zoomAt.bind(canvas);
  canvas.zoomAt = (...args) => { _origZoomAt(...args); updateZoomLabel(); };
  const _origFit = canvas.fitToView.bind(canvas);
  canvas.fitToView = (...args) => { _origFit(...args); updateZoomLabel(); };

  function updateZoomLabel() {
    const el = container.querySelector('#zoom-label');
    if (el) el.textContent = Math.round(canvas.zoom * 100) + '%';
  }

  // ──── Graduation grid rendering ───────────────────────

  function renderGradGrid(ctx, grid, mode) {
    if (!grid || mode === 'none') return;
    const { lonLines, latLines } = grid;

    // Clip grid lines to the map image bounds so they never extend beyond the image.
    const imgW = canvas.mapImage?.naturalWidth  ?? canvas.mapImage?.width  ?? 0;
    const imgH = canvas.mapImage?.naturalHeight ?? canvas.mapImage?.height ?? 0;
    if (!imgW || !imgH) return;

    ctx.save();
    ctx.font = '9px sans-serif';

    // Longitude lines (vertical) — segment from image top to image bottom
    ctx.textAlign = 'center';
    for (const { x, lon, intermediate } of lonLines) {
      if (mode === 'major' && intermediate) continue;
      const startS = canvas.toScreen(x, 0);
      const endS   = canvas.toScreen(x, imgH);
      ctx.lineWidth   = intermediate ? 0.7 : 1.5;
      ctx.strokeStyle = intermediate ? 'rgba(255,200,0,0.30)' : 'rgba(255,200,0,0.65)';
      ctx.beginPath();
      ctx.moveTo(startS.x, startS.y);
      ctx.lineTo(endS.x, endS.y);
      ctx.stroke();
      if (!intermediate) {
        ctx.fillStyle = 'rgba(255,200,0,0.9)';
        const topS = canvas.toScreen(x, 0);
        const ly = Math.max(12, topS.y + 4);
        ctx.fillText(lon + '°', topS.x, ly);
      }
    }

    // Latitude lines (horizontal) — segment from image left to image right
    ctx.textAlign = 'left';
    for (const { y, lat, intermediate } of latLines) {
      if (mode === 'major' && intermediate) continue;
      const startS = canvas.toScreen(0, y);
      const endS   = canvas.toScreen(imgW, y);
      ctx.lineWidth   = intermediate ? 0.7 : 1.5;
      ctx.strokeStyle = intermediate ? 'rgba(0,200,255,0.30)' : 'rgba(0,200,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(startS.x, startS.y);
      ctx.lineTo(endS.x, endS.y);
      ctx.stroke();
      if (!intermediate) {
        ctx.fillStyle = 'rgba(0,200,255,0.9)';
        const leftS = canvas.toScreen(0, y);
        const lx = Math.max(4, leftS.x + 4);
        ctx.fillText(lat + '°', lx, leftS.y - 2);
      }
    }

    ctx.restore();
  }

  // ──── Detected-tick overlay (debug — red marks) ───────

  function renderDetectedTicks(ctx) {
    if (!detectedGrads || !MAPS[mapKey].gps) return;
    const imgW = canvas.mapImage?.naturalWidth  ?? canvas.mapImage?.width  ?? 0;
    const imgH = canvas.mapImage?.naturalHeight ?? canvas.mapImage?.height ?? 0;
    if (!imgW || !imgH) return;

    // Scan-strip centre positions derived from the scan-strip constants in gps-calibration.js.
    // Rendered at the centre of each strip so the red marks align with where the scan happened.
    const LON_Y_CENTER  = Math.round(LON_Y0     + LON_H     / 2);  // top lon strip centre
    const LON_YB_CENTER = Math.round(LON_Y0_BOT + LON_H_BOT / 2);  // bottom lon strip centre
    const LAT_X_CENTER  = Math.round(LAT_X0     + LAT_W     / 2);  // left lat strip centre
    const LAT_XR_CENTER = Math.round(LAT_X0_RIGHT + LAT_W_RIGHT / 2); // right lat strip centre
    const HALF = 8;                         // half-length of tick marks (screen px)

    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth   = 1.5;

    // Longitude ticks — vertical marks at detected x positions
    for (const { x } of (detectedGrads.lonTicksTop ?? [])) {
      const s = canvas.toScreen(x, LON_Y_CENTER);
      ctx.beginPath(); ctx.moveTo(s.x, s.y - HALF); ctx.lineTo(s.x, s.y + HALF); ctx.stroke();
    }
    for (const { x } of (detectedGrads.lonTicksBottom ?? [])) {
      const s = canvas.toScreen(x, LON_YB_CENTER);
      ctx.beginPath(); ctx.moveTo(s.x, s.y - HALF); ctx.lineTo(s.x, s.y + HALF); ctx.stroke();
    }

    // Latitude ticks — horizontal marks at detected y positions
    for (const { y } of (detectedGrads.latTicksLeft ?? [])) {
      const s = canvas.toScreen(LAT_X_CENTER, y);
      ctx.beginPath(); ctx.moveTo(s.x - HALF, s.y); ctx.lineTo(s.x + HALF, s.y); ctx.stroke();
    }
    for (const { y } of (detectedGrads.latTicksRight ?? [])) {
      const s = canvas.toScreen(LAT_XR_CENTER, y);
      ctx.beginPath(); ctx.moveTo(s.x - HALF, s.y); ctx.lineTo(s.x + HALF, s.y); ctx.stroke();
    }

    ctx.restore();
  }

  // ──── Toolbar (left) ──────────────────────────────────

  function updateToolbar() {
    const tb = container.querySelector('#map-toolbar');
    tb.innerHTML = tools.tools.map(t => `
      <button class="tool-btn ${t === tools.active ? 'active' : ''}" data-tool="${t.name}" title="${t.name} (${t.shortcut.toUpperCase()})">
        ${t.icon}
      </button>`).join('');
    tb.onclick = e => {
      const btn = e.target.closest('.tool-btn');
      if (btn) { tools.select(btn.dataset.tool); closeTools(); }
    };
  }

  // ──── Properties Panel (right) ────────────────────────

  function updateProps() {
    const panel = container.querySelector('#map-props');
    const sel = store.getSelected();
    let html = '<div class="props-section"><h4>Propriétés</h4>';
    if (sel.length === 0) {
      html += '<p class="props-empty">Aucune sélection</p>';
    } else if (sel.length === 1) {
      const s = sel[0];
      html += `<div class="props-type">${TYPE_LABELS[s.type] || s.type} <span class="props-id">#${s.id}</span></div>`;
      html += `<div class="props-info">${shapeInfo(s, measurement)}</div>`;
      html += `<div class="props-row"><label>Couleur</label><input type="color" value="${s.color}" data-prop="color" class="props-color"></div>`;
      if (s.lineWidth !== undefined) {
        html += `<div class="props-row"><label>Épaisseur</label><input type="number" value="${s.lineWidth}" min="0.5" max="10" step="0.5" data-prop="lineWidth" class="props-input-sm"></div>`;
      }
      if (s.type === 'circle') {
        const rVal = measurement.fromPx(s.radius);
        const unit = measurement.mode === 'cm' && measurement.calibrated ? 'cm' : 'px';
        html += `<div class="props-row"><label>Rayon</label><input type="number" value="${parseFloat(rVal.toFixed(2))}" min="1" step="1" id="input-radius" class="props-input-sm"><span class="props-unit">${unit}</span></div>`;
      }
      if (s.label !== undefined) {
        html += `<div class="props-row"><label>Label</label><input type="text" value="${esc(s.label)}" data-prop="label" class="props-input"></div>`;
        html += `<div class="props-row"><label>Afficher</label><input type="checkbox" ${s.showLabel ? 'checked' : ''} id="chk-show-label"></div>`;
      }
      if (s.type === 'point') {
        html += `<div class="props-row"><label>Lignes guide</label><input type="checkbox" ${s.showGuides ? 'checked' : ''} id="chk-show-guides"></div>`;
        html += `<div class="props-row"><label>Cercle divisé</label><input type="checkbox" ${s.hideDial ? '' : 'checked'} id="chk-show-dial" title="${dialSettings.show ? 'Afficher le cercle divisé sur ce point' : 'Le cercle divisé est désactivé pour toute la carte (menu Cercle)'}"></div>`;
      }
      html += `<div class="props-actions">
        <button class="btn btn-danger btn-sm" id="btn-delete-shape">Supprimer</button>
      </div>`;
      // Construction buttons for triangles
      if (s.type === 'triangle') {
        html += `<div class="props-construct">
          <button class="btn btn-sm" id="btn-add-medians">+ Médianes</button>
          <button class="btn btn-sm" id="btn-add-bisectors">+ Médiatrices</button>
        </div>`;
      }
      // Concentric circles
      if (s.type === 'circle') {
        const rStep = measurement.fromPx(s.radius);
        const unit = measurement.mode === 'cm' && measurement.calibrated ? 'cm' : 'px';
        html += `<div class="props-construct">
          <div class="props-row"><label>Pas</label><input type="number" value="${parseFloat(rStep.toFixed(2))}" min="1" step="1" id="input-concentric-step" class="props-input-sm"><span class="props-unit">${unit}</span></div>
          <div class="props-row"><label>Nombre</label><input type="number" value="1" min="1" max="50" step="1" id="input-concentric-count" class="props-input-sm"></div>
          <button class="btn btn-sm" id="btn-add-concentrics">+ Concentriques</button>
        </div>`;
      }
    } else {
      html += `<p class="props-multi">${sel.length} formes sélectionnées</p>`;
      html += `<button class="btn btn-danger btn-sm" id="btn-delete-shape">Supprimer tout</button>`;
    }
    html += '</div>';

    // Shape list
    html += '<div class="props-section"><h4>Formes <span class="props-count">' + store.getAll().length + '</span></h4>';
    html += '<div class="shape-list">';
    const allShapes = store.getAll();
    for (let i = 0; i < allShapes.length; i++) {
      const s = allShapes[i];
      html += `<div class="shape-item ${s.selected ? 'selected' : ''}" data-id="${s.id}" draggable="true">
        <span class="shape-drag" title="Glisser pour réordonner" aria-label="Glisser pour réordonner">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
        </span>
        <span class="shape-color-dot" style="background:${esc(s.color)}"></span>
        <span class="shape-label">${TYPE_LABELS[s.type] || s.type} #${s.id}${s.label ? ' — ' + esc(s.label) : ''}</span>
        <button class="shape-vis ${s.visible ? '' : 'hidden'}" data-vis="${s.id}" title="Visibilité">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="shape-del" data-del="${s.id}" title="Supprimer">×</button>
      </div>`;
    }
    html += '</div></div>';
    panel.innerHTML = html;

    // Bind events
    let _propSaved = false;
    panel.querySelectorAll('[data-prop]').forEach(input => {
      input.oninput = () => {
        const s = sel[0];
        if (!s) return;
        let val = input.value;
        if (input.type === 'number') val = parseFloat(val);
        if (!_propSaved) { history.save(); _propSaved = true; }
        _editingProps = true;
        store.update(s.id, { [input.dataset.prop]: val });
        _editingProps = false;
      };
      input.addEventListener('change', () => { _propSaved = false; });
    });

    // Circle radius input
    const radiusInput = panel.querySelector('#input-radius');
    if (radiusInput) {
      let _radiusSaved = false;
      radiusInput.oninput = () => {
        const s = sel[0];
        if (!s || s.type !== 'circle') return;
        const val = parseFloat(radiusInput.value);
        if (!val || val <= 0) return;
        if (!_radiusSaved) { history.save(); _radiusSaved = true; }
        _editingProps = true;
        store.update(s.id, { radius: measurement.toPx(val) });
        _editingProps = false;
      };
      radiusInput.addEventListener('change', () => { _radiusSaved = false; });
    }

    // Show label checkbox
    const showLabelChk = panel.querySelector('#chk-show-label');
    if (showLabelChk) {
      showLabelChk.onchange = () => {
        const s = sel[0];
        if (!s) return;
        history.save();
        store.update(s.id, { showLabel: showLabelChk.checked });
      };
    }

    const showGuidesChk = panel.querySelector('#chk-show-guides');
    if (showGuidesChk) {
      showGuidesChk.onchange = () => {
        const s = sel[0];
        if (!s) return;
        history.save();
        store.update(s.id, { showGuides: showGuidesChk.checked });
      };
    }

    const showDialChk = panel.querySelector('#chk-show-dial');
    if (showDialChk) {
      showDialChk.onchange = () => {
        const s = sel[0];
        if (!s) return;
        history.save();
        store.update(s.id, { hideDial: !showDialChk.checked });
      };
    }

    panel.querySelector('#btn-delete-shape')?.addEventListener('click', () => {
      history.save();
      for (const s of sel) store.remove(s.id);
    });

    panel.querySelector('#btn-add-medians')?.addEventListener('click', () => {
      const tri = sel[0];
      if (!tri || tri.type !== 'triangle') return;
      const medianTool = tools.tools.find(t => t.name === 'Médiane');
      medianTool._addMediansForTriangle(tri);
    });

    panel.querySelector('#btn-add-bisectors')?.addEventListener('click', () => {
      const tri = sel[0];
      if (!tri || tri.type !== 'triangle') return;
      const bisectorTool = tools.tools.find(t => t.name === 'Médiatrice');
      bisectorTool._addForTriangle(tri);
    });

    panel.querySelector('#btn-add-concentrics')?.addEventListener('click', () => {
      const s = sel[0];
      if (!s || s.type !== 'circle') return;
      const stepInput = panel.querySelector('#input-concentric-step');
      const countInput = panel.querySelector('#input-concentric-count');
      const step = measurement.toPx(parseFloat(stepInput.value) || s.radius);
      const count = parseInt(countInput.value) || 1;
      if (count <= 1) return;
      const circles = generateConcentrics(s, step, count);
      history.save();
      for (const c of circles) store.add(c);
      canvas.requestRender();
    });

    // Shape list clicks
    panel.querySelectorAll('.shape-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.shape-vis') || e.target.closest('.shape-del') || e.target.closest('.shape-drag')) return;
        const id = parseInt(item.dataset.id);
        if (e.shiftKey) store.toggleSelect(id);
        else store.select(id);
      });
    });

    // Drag-and-drop reordering
    const list = panel.querySelector('.shape-list');
    let _dragId = null;
    function clearDropMarkers() {
      list?.querySelectorAll('.drop-above, .drop-below').forEach(el => {
        el.classList.remove('drop-above', 'drop-below');
      });
    }
    panel.querySelectorAll('.shape-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        _dragId = parseInt(item.dataset.id);
        item.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', String(_dragId)); } catch { /* ignore */ }
        }
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        clearDropMarkers();
        _dragId = null;
      });
      item.addEventListener('dragover', (e) => {
        if (_dragId === null) return;
        const targetId = parseInt(item.dataset.id);
        if (targetId === _dragId) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        clearDropMarkers();
        item.classList.add(before ? 'drop-above' : 'drop-below');
      });
      item.addEventListener('dragleave', () => {
        item.classList.remove('drop-above', 'drop-below');
      });
      item.addEventListener('drop', (e) => {
        if (_dragId === null) return;
        e.preventDefault();
        const targetId = parseInt(item.dataset.id);
        if (targetId === _dragId) return;
        const rect = item.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        const order = store.getAll().map(s => s.id).filter(id => id !== _dragId);
        const targetIdx = order.indexOf(targetId);
        if (targetIdx < 0) return;
        order.splice(before ? targetIdx : targetIdx + 1, 0, _dragId);
        history.save();
        store.setOrder(order);
      });
    });

    panel.querySelectorAll('[data-vis]').forEach(btn => {
      btn.onclick = () => store.toggleVisibility(parseInt(btn.dataset.vis));
    });

    panel.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => { history.save(); store.remove(parseInt(btn.dataset.del)); };
    });
  }

  // ──── Status Bar ──────────────────────────────────────

  canvas.on('mousemove', ({ world }) => {
    const sb = container.querySelector('#map-statusbar');
    if (sb) {
      const gps = measurement.formatGPS(world.x, world.y);
      sb.innerHTML = `<span>${measurement.formatCoord(world.x, world.y)}</span>
        <span class="sb-sep">|</span>
        <span>${gps}</span>
        <span class="sb-sep">|</span>
        <span>Zoom: ${Math.round(canvas.zoom * 100)}%</span>
        <span class="sb-sep">|</span>
        <span>Outil: ${tools.active.name}</span>`;
    }
  });

  // ──── Init ────────────────────────────────────────────

  function updateUI() {
    updateActionBar();
    updateToolbar();
    updateProps();
  }

  // Load a background map and re-derive its calibration (px/cm + GPS).
  // `view` (optional) is applied once the image is in place — loadImage() fits
  // the image to the viewport, which would otherwise overwrite a restored view.
  let _pendingView = null;
  function loadMap(key, { view = null } = {}) {
    mapKey = MAPS[key] ? key : DEFAULT_MAP_KEY;
    _pendingView = view;
    updateActionBar(); // reflect the new selection immediately
    canvas.loadImage(MAPS[mapKey].src).catch(err => {
      console.error('[map-section] Échec du chargement de la carte:', err);
    });
  }

  canvas.on('image-loaded', (img) => {
    const cfg = MAPS[mapKey];

    // px ↔ cm calibration — only for maps whose physical size is known
    if (cfg.widthCm && cfg.heightCm) {
      calRatios = {
        height: img.height / cfg.heightCm,
        width:  img.width  / cfg.widthCm,
      };
      calRatios.avg = (calRatios.height + calRatios.width) / 2;
      applyCalRatio();
    } else {
      calRatios = null;
      measurement.reset(); // back to px-only
    }

    // GPS calibration and graduation ticks are pre-loaded from
    // data/gps-graduations.json (no runtime detection needed) — WorldMap only.
    if (cfg.gps) {
      measurement.setGPSCalibration(detectedGrads);
      gradGridData = buildGradGrid(measurement.gpsCalibration, detectedGrads, true);
    } else {
      gradGridData = null;
      gradGridMode = 'none';
    }
    measurement.setGPSAvailable(cfg.gps);

    // Restore a requested view state; otherwise keep the fitToView applied by
    // loadImage (a plain map switch re-fits, since image sizes differ).
    if (_pendingView) {
      canvas.setViewState(_pendingView);
      _pendingView = null;
    }
    updateUI();
  });

  function applyCalRatio() {
    if (!calRatios) return;
    measurement.pixelsPerCm = calRatios[calMode];
    measurement.emit('change');
  }

  // Auto-load the last used background map (WorldMap MHF by default)
  const startupOpts = loadOptions();
  if (startupOpts?.dial) dialSettings = normalizeDial(startupOpts.dial);
  loadMap(startupOpts?.mapKey ?? DEFAULT_MAP_KEY, { view: startupOpts?.view ?? null });

  updateUI();
}
