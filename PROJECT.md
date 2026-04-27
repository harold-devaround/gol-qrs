# GOL-QRS — Documentation Projet

## Vue d'ensemble

Application web d'analyse pour le jeu de piste GOL (Game Of Life). Quatre onglets :
1. **Q&R** — Analyse de QR codes
2. **Carte MHF** — Dessin géométrique sur la WorldMap calibrée (fonctionnalité principale)
3. **Cartes Postales** — Galerie de 10 cartes postales avec lightbox
4. **Tuiles** — Galerie de 24 tuiles avec lightbox

## Architecture

```
index.html                  ← Point d'entrée, charge Fabric.js UMD + app.js
js/
  app.js                    ← Routage par onglets, lazy-init des sections
  map/
    map-section.js          ← Orchestrateur : câble canvas, store, tools, UI
    fabric-canvas.js        ← Wrapper Fabric.js v7 : zoom/pan, rendu overlay, snap
    store.js                ← ShapeStore : CRUD, sélection, visibilité, snapshot/restore
    history.js              ← Undo/redo par snapshots (max 80)
    measurement.js          ← Conversion px ↔ cm, calibration, formatage, GPS (Mercator)
    gps-calibration.js      ← Détection des graduations en bordures, calibration GPS runtime
    save-manager.js         ← Persistance localStorage (slots nommés)
    shapes.js               ← Factories, renderers, hit-test, moveShape, shapeInfo
    tools/
      base.js               ← ToolBase abstraite (activate, mouse handlers, snap)
      manager.js             ← Gestion des 11 outils + raccourcis clavier
      select.js              ← Outil de sélection/déplacement
      point.js, segment.js, line.js, circle.js, triangle.js
      median.js, bisector.js, angle.js
      parallel.js, perpendicular.js
  viewers/
    image-viewer.js          ← Galerie + lightbox pour CP et Tuiles
  qr/
    qr-section.js            ← Section analyse QR
  utils/
    events.js                ← EventEmitter léger (on/off/emit)
    geometry.js              ← Fonctions math (distance, angles, intersections, etc.)
css/
  main.css                   ← Thème sombre, tokens CSS, tous les styles
tests/
  geometry.test.js           ← 72 tests
  store.test.js              ← 16 tests
  events.test.js             ← 9 tests
  shapes.test.js             ← 59 tests
  measurement.test.js        ← 44 tests
  history.test.js            ← 12 tests
  save-manager.test.js       ← 15 tests
  select-tool.test.js        ← 8 tests
  perpendicular-tool.test.js ← 20 tests
  fabric-canvas-touch.test.js← 24 tests (jsdom, hors vitest run standard)
  gps-calibration.test.js    ← 61 tests (interpolateLatY + buildGradGrid + calibration 1°-résolution)
  TOTAL                      ← 308 tests (+ 24 jsdom)
```

## Stack technique

| Élément      | Version | Usage                                       |
|-------------|---------|---------------------------------------------|
| Fabric.js   | 7.2.0   | Rendu canvas, chargé via `<script>` UMD     |
| Vitest      | 4.1.4   | Framework de test (`npx vitest run`)         |
| ES Modules  | —       | `"type": "module"` dans package.json        |
| Pas de bundler | —    | Fichiers servis directement                 |

## Fonctionnalités implémentées

### Carte MHF (section principale)
- **Image WorldMap** : `2019_WorldMap_MHF_1.2x1.6m.jpg` — 160cm (L) × 120cm (H)
- **11 outils de dessin** : Point (P), Segment (S), Ligne (L), Cercle (C), Triangle (T), Médiane (M), Médiatrice (B), Angle (A), Parallèle (H), Perpendiculaire (X), Sélection (V)
- **Snap** : accrochage aux points existants (sommets, intersections, centres)
- **Snap angulaire** : CTRL enfoncé → direction snappée sur multiples d'angle configurable (15°, 30°, 45°, 90°). Segment et Ligne.
- **Calibration multi-ratio** : ratio hauteur (H), largeur (L), moyen (M) — hauteur par défaut. Boutons de sélection dans la barre d'action.
- **Unités px ↔ cm** : toggle switch animé, conversion en temps réel
- **Panneau propriétés** : type, mesures, couleur, épaisseur, rayon (cercles), label (toutes formes), affichage label (checkbox), visibilité, cercles concentriques
- **Undo/Redo** : 80 niveaux, boutons + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
- **Zoom/Pan** : molette, boutons +/−, fit (F), space+drag pour pan
- **Sauvegarde/chargement** : slots nommés en localStorage avec métadonnées + options (unité, ratio, snap, vue)
- **Barre de statut** : coordonnées temps réel, GPS (lon/lat), zoom, outil actif
- **Coordonnées GPS** : affichage lon/lat dans les propriétés d'un point et dans la barre de statut. Calibration auto par détection des cases de graduation 1° (contour bleu, fond blanc) en bordures de la carte (strip y=88-102 pour lon, x=105-145 pour lat, juste avant la bordure sombre mapTop≈105 / mapLeft≈148). mapLeft=148, mapWidth=4149, equatorY=1726, mercRadius=657. Module `gps-calibration.js` : détection runtime 1°-résolution + fallback précis.
- **Lignes guide sur point** : option `showGuides` par point (checkbox dans le panneau propriétés) → croix horizontale + verticale en pointillés colorés. Affiche `lat: XX.XX°` au bord gauche du viewport et `lon: XX.XX°` au bord haut, indiquant les coordonnées GPS du point sur les graduations de la carte.
- **Grille GPS** : dropdown "Grille" dans la barre d'action — 3 modes : Aucune / Principales (15°) / Toutes (1° avec lignes intermédiaires). Les lignes intermédiaires sont calculées depuis les graduations détectées (interpolation linéaire pour la longitude, interpolation Mercator pour la latitude), plus fines et translucides.
- **Constructions** : médianes et médiatrices auto pour les triangles

### Galeries (CP & Tuiles)
- Grille responsive avec miniatures
- Lightbox plein écran avec navigation

### Patterns architecturaux
- **Event-driven** : `EventEmitter` pour la communication inter-modules
- **Shapes = POJOs** : pas de classes, sérialisation facile
- **Store centralisé** : source unique de vérité pour les formes
- **Snapshot-based undo** : deep clone de l'état complet
- **Séparation** : Store (état) → Canvas (rendu) ← Tools (entrée)

## Thème CSS

- Fond : `#0f1117`, surfaces : `#1a1d27`
- Accent : or `#c9a44c`
- Police : Segoe UI
- Tokens : radius 8px, transitions 0.15s

## Commandes

```bash
npm test           # npx vitest run — lance les 308 tests
npm run test:watch # vitest en mode watch
```

## Historique des modifications

| Date       | Modification                                                                 |
|-----------|-----------------------------------------------------------------------------|
| —         | Architecture initiale : 4 onglets, modules ES, 97 tests                    |
| —         | Migration Fabric.js v7, `fabric-canvas.js` en remplacement de `canvas.js`  |
| —         | Audit qualité : suppression fichiers morts, fix memory leak, 154 tests     |
| —         | Fix ghosting overlay, édition rayon cercle, système multi-save, 166 tests  |
| —         | Toggle switch px/cm animé                                                   |
| —         | Fix focus label (guard `_editingProps`), calibration 120cm/160cm, multi-ratio UI |
| —         | Raccourcis clavier Ctrl+Z/Y : listeners sur `document` + garde input       |
| 2026-04-11| Création `.github/copilot-instructions.md` et `PROJECT.md`                 |
| 2026-04-11| Labels sur toutes les formes + showLabel, fond blanc labels, save/load options, fix Ctrl+Z/Y, fix label list update, 177 tests |
| 2026-04-11| showLabel=true par défaut, visibilité labels par type (dropdown), 176 tests |
| 2026-04-11| Fix sélection : single-select par défaut, multi-select avec SHIFT, Escape global pour désélectionner, 184 tests |
| 2026-04-11| Fix collision IDs après reload (syncNextId), 187 tests |
| 2026-04-11| Recyclage d'IDs : gap-filling + releaseId sur suppression, 191 tests |
| 2026-04-11| Outil Parallèle (H) : construction d'un segment parallèle à une ligne/segment (3 étapes : ref, start, projection ortho), 194 tests |
| 2026-04-11| Overlays jaunes (#f1c40f) épais (2.5px) pour tous les outils de construction, 194 tests |
| 2026-04-11| Snap angulaire CTRL : `snapToAngle()` dans geometry.js, wiring segment + line, pas configurable (15°/30°/45°/90°) dans la barre d'action, persistance options, 201 tests |
| 2026-04-11| Cercles concentriques : `generateConcentrics()` dans shapes.js, UI dans panneau propriétés (pas + nombre), 208 tests |
| 2026-04-11| Sauvegarde/restauration de la vue (zoom + centre) : `getViewState()`/`setViewState()` dans fabric-canvas, persistance dans options, restauration au chargement initial et après load slot, 208 tests |
| 2026-04-26| Coordonnées GPS lon/lat dans les propriétés des points et barre de statut, calibration Mercator depuis les graduations 15° de la carte, 242 tests |
| 2026-04-26| Optimisation mobile : pinch-to-zoom + pan 2 doigts (fabric-canvas), panneau props slide-in avec backdrop + bouton toggle flottant, touch targets ≥ 40px, masquage texte action bar, barre de statut compacte, auto-ouverture props sur sélection, 242 tests |
| 2026-04-26| Fix pinch-to-zoom mobile : remplacement touch events par pointer events en capture phase (intercepte avant Fabric.js), `touch-action: none` sur canvas, emit `cancel` pour annuler l'action en cours, 242 tests |
| 2026-04-26| Barre d'outils portrait mobile : `@media (orientation: portrait)` — toolbar masquée, remplacée par bouton flottant bas-gauche + panneau horizontal slide-up, `closeTools()` on orientation change, 242 tests |
| 2026-04-26| Fix pinch zoom : `this.el` → `upperCanvasEl` (bonne cible), `stopImmediatePropagation`, `touch-action:none` sur upper canvas, mise à jour `active` map sur tout `pointermove`, 266 tests |
| 2026-04-26| GPS calibration par détection des graduations en bordures : `gps-calibration.js` (détection runtime + fallback précis), constantes corrigées (mapLeft=148, mapWidth=4149, equatorY=1726, mercRadius=657), lignes guide sur point (showGuides), grille GPS overlay togglable (bouton Grille), 262 tests |
| 2026-04-26| Fix détection graduations : bandes de scan corrigées (lon: y=65–85, lat: x=55–100), seuil brightness 200 (ticks CMYK ≈144), constantes DEFAULT_CALIBRATION mises à jour, 262 tests |
| 2026-04-27| Fix décalage image/graduations : ajout `originX:'left', originY:'top'` sur FabricImage (Fabric v7 par défaut 'center'/'center'), aligne l'image sur les coordonnées monde [0,W]×[0,H], 262 tests |
| 2026-04-27| Guides GPS sur point : labels lat/lon aux bords viewport (gauche=lat, haut=lon) avec fond blanc. Grille GPS : dropdown 3 modes (Aucune / Principales 15° / Toutes 5°) + lignes intermédiaires calculées depuis calibration, 266 tests |
| 2026-04-27| Refonte détection graduations : scan 4 bordures (top+bottom lon, left+right lat), profils blueExcessColumnProfile/blueExcessRowProfile (bleu clair sur blanc), positions moyennées, buildGradGrid avec lonTicksTop/Bottom + latTicksLeft/Right. Lignes de grille en segments clippés aux limites de l'image, solides (pas de tirets), légèrement plus épaisses, semi-transparentes. Tests: blueExcessColumnProfile, blueExcessRowProfile, 2-graduations-par-ligne. 294 tests |
| 2026-04-27| Fix emplacement détection des graduations : scan déplacé des "valeurs" (y=65-85) vers les vraies cases de graduation 1° (y=88-102, juste avant la bordure sombre mapTop≈105). minGap 50→5 pour détecter chaque case ~11.5px. computeCalibration : nouvelles branches 1°-résolution (n≥300 lon, n≥100 lat) avec fit direct mapLeft/mapWidth et fit Mercator. buildGradGrid : filtrage lon%15/lat%15 pour les lignes majeures, utilisation directe des ticks 1° pour les intermédiaires. 308 tests |
