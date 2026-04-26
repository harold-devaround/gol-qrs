import { MapCanvas } from './fabric-canvas.js';
import { ShapeStore } from './store.js';
import { History } from './history.js';
import { Measurement } from './measurement.js';
import { ToolManager } from './tools/manager.js';
import { renderShape, hitTestShape, shapeInfo, TYPE_LABELS, syncNextId, generateConcentrics } from './shapes.js';
import { listSaves, saveSlot, loadSlot, deleteSlot, saveOptions, loadOptions } from './save-manager.js';

/** WorldMap MHF — auto-loaded on init. Physical: 160cm wide × 120cm tall. */
const WORLDMAP_SRC = '2019_WorldMap_MHF_1.2x1.6m.jpg';
const WORLDMAP_HEIGHT_CM = 120;
const WORLDMAP_WIDTH_CM = 160;

/**
 * Map section orchestrator — wires together canvas, store, tools, and UI.
 */
export function initMap(container) {
  container.innerHTML = `
    <div class="map-layout">
      <div class="map-actionbar" id="map-actionbar"></div>
      <div class="map-main">
        <div class="map-toolbar" id="map-toolbar"></div>
        <div class="map-canvas-wrap" id="map-canvas-wrap"></div>
        <div class="map-props" id="map-props"></div>
      </div>
      <div class="map-statusbar" id="map-statusbar"></div>
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

  // Per-type label visibility (all visible by default)
  const labelVisibility = {
    point: true, segment: true, line: true, circle: true,
    triangle: true, angle: true, median: true, bisector: true,
  };

  // Render shapes via canvas callback
  canvas.onRenderShapes = (ctx) => {
    for (const s of store.getVisible()) {
      renderShape(ctx, s, canvas, measurement, { labelVisibility });
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
  store.on('selection', () => { canvas.requestRender(); updateProps(); });
  history.on('change', () => updateActionBar());
  measurement.on('change', () => { canvas.requestRender(); updateActionBar(); updateProps(); });
  tools.on('change', () => updateToolbar());

  // ──── Action Bar ──────────────────────────────────────

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
        <div class="unit-switch ${measurement.calibrated ? '' : 'disabled'}" id="unit-switch" title="Basculer px ↔ cm">
          <span class="unit-switch-label ${measurement.mode === 'px' ? 'active' : ''}">px</span>
          <div class="unit-switch-track ${measurement.mode === 'cm' ? 'on' : ''}">
            <div class="unit-switch-thumb"></div>
          </div>
          <span class="unit-switch-label ${measurement.mode === 'cm' ? 'active' : ''}">cm</span>
        </div>
        ${calRatios ? `<div class="abar-ratios">
          <button class="abar-ratio-btn ${calMode === 'height' ? 'active' : ''}" data-cal="height" title="Ratio hauteur (${WORLDMAP_HEIGHT_CM}cm)">H ${calRatios.height.toFixed(1)}</button>
          <button class="abar-ratio-btn ${calMode === 'width' ? 'active' : ''}" data-cal="width" title="Ratio largeur (${WORLDMAP_WIDTH_CM}cm)">L ${calRatios.width.toFixed(1)}</button>
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
    bar.querySelector('#unit-switch').onclick = () => { measurement.toggleMode(); };
    bar.querySelector('#btn-clear').onclick = () => {
      if (store.getAll().length === 0) return;
      if (!confirm('Supprimer toutes les formes ?')) return;
      history.save();
      store.clear();
    };
    bar.querySelector('#btn-save').onclick = () => openSaveModal();
    bar.querySelector('#btn-load').onclick = () => openLoadModal();

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
        lblMenu.classList.toggle('open');
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

    // Angle snap step dropdown
    const angBtn = bar.querySelector('#btn-angle-snap');
    const angMenu = bar.querySelector('#angle-snap-menu');
    if (angBtn && angMenu) {
      angBtn.onclick = (e) => {
        e.stopPropagation();
        angMenu.classList.toggle('open');
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
          <input type="text" class="modal-input" id="save-name" value="${defaultName}" maxlength="60">
        </div>
        ${saves.length ? `<p class="modal-subtitle">Sauvegardes existantes (cliquer pour écraser) :</p>
        <div class="save-slot-list">${saves.map(s =>
          `<div class="save-slot" data-name="${s.name}">
            <span class="save-slot-name">${s.name}</span>
            <span class="save-slot-meta">${s.count} formes · ${new Date(s.date).toLocaleString('fr-FR')}</span>
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
      saveOptions({ mode: measurement.mode, calMode, snapEnabled: canvas.snapEnabled, labelVisibility: { ...labelVisibility }, angleSnapStep: toolCtx.angleSnapStep, view: canvas.getViewState() });
      overlay.remove();
    };

    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#save-confirm').click(); });
  }

  function openLoadModal() {
    const saves = listSaves();
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
        <div class="save-slot" data-name="${s.name}">
          <div class="save-slot-main">
            <span class="save-slot-name">${s.name}</span>
            <span class="save-slot-meta">${s.count} formes · ${new Date(s.date).toLocaleString('fr-FR')}</span>
          </div>
          <div class="save-slot-actions">
            <button class="btn btn-sm btn-primary save-load-btn" data-name="${s.name}">Charger</button>
            <button class="btn btn-sm btn-danger save-del-btn" data-name="${s.name}">×</button>
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
          syncNextId(shapes);
          // Restore saved options
          const opts = loadOptions();
          if (opts) {
            if (opts.calMode && calRatios) { calMode = opts.calMode; applyCalRatio(); }
            if (opts.mode && opts.mode !== measurement.mode) measurement.toggleMode();
            if (opts.snapEnabled !== undefined) canvas.snapEnabled = opts.snapEnabled;
            if (opts.labelVisibility) Object.assign(labelVisibility, opts.labelVisibility);
            if (opts.angleSnapStep) toolCtx.angleSnapStep = opts.angleSnapStep;
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

  // Update zoom label on viewport changes
  const _origZoomAt = canvas.zoomAt.bind(canvas);
  canvas.zoomAt = (...args) => { _origZoomAt(...args); updateZoomLabel(); };
  const _origFit = canvas.fitToView.bind(canvas);
  canvas.fitToView = (...args) => { _origFit(...args); updateZoomLabel(); };

  function updateZoomLabel() {
    const el = container.querySelector('#zoom-label');
    if (el) el.textContent = Math.round(canvas.zoom * 100) + '%';
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
      if (btn) tools.select(btn.dataset.tool);
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
        html += `<div class="props-row"><label>Label</label><input type="text" value="${s.label}" data-prop="label" class="props-input"></div>`;
        html += `<div class="props-row"><label>Afficher</label><input type="checkbox" ${s.showLabel ? 'checked' : ''} id="chk-show-label"></div>`;
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
    for (const s of store.getAll()) {
      html += `<div class="shape-item ${s.selected ? 'selected' : ''}" data-id="${s.id}">
        <span class="shape-color-dot" style="background:${s.color}"></span>
        <span class="shape-label">${TYPE_LABELS[s.type] || s.type} #${s.id}${s.label ? ' — ' + s.label : ''}</span>
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
        if (e.target.closest('.shape-vis') || e.target.closest('.shape-del')) return;
        const id = parseInt(item.dataset.id);
        if (e.shiftKey) store.toggleSelect(id);
        else store.select(id);
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

  // Auto-load WorldMap MHF and auto-calibrate
  canvas.loadImage(WORLDMAP_SRC);
  canvas.on('image-loaded', (img) => {
    calRatios = {
      height: img.height / WORLDMAP_HEIGHT_CM,
      width:  img.width  / WORLDMAP_WIDTH_CM,
    };
    calRatios.avg = (calRatios.height + calRatios.width) / 2;
    applyCalRatio();
    // Restore saved view state or keep fitToView default
    const opts = loadOptions();
    if (opts?.view) canvas.setViewState(opts.view);
    updateUI();
  });

  function applyCalRatio() {
    if (!calRatios) return;
    measurement.pixelsPerCm = calRatios[calMode];
    measurement.emit('change');
  }

  updateUI();
}
