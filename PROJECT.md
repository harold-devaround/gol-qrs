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
  app.ts                    ← Routage par onglets, lazy-init des sections
  tab-router.ts             ← Logique de routage par onglets (testable, isolation erreurs)
  types.ts                  ← Interfaces TypeScript partagées (Shape, Point, Rect, etc.)
  map/
    map-section.ts          ← Orchestrateur : câble canvas, store, tools, UI
    fabric-canvas.ts        ← Wrapper Fabric.js v7 : zoom/pan, rendu overlay, snap
    store.ts                ← ShapeStore : CRUD, sélection, visibilité, snapshot/restore
    history.ts              ← Undo/redo par snapshots (max 80)
    measurement.ts          ← Conversion px ↔ cm, calibration, formatage, GPS (Mercator)
    gps-calibration.ts      ← Détection des graduations en bordures, calibration GPS runtime
    save-manager.ts         ← Persistance localStorage (slots nommés)
    shapes.ts               ← Factories, renderers, hit-test, moveShape, shapeInfo
    tools/
      base.ts               ← ToolBase abstraite (activate, mouse handlers, snap)
      manager.ts             ← Gestion des 11 outils + raccourcis clavier
      select.ts              ← Outil de sélection/déplacement
      point.ts, segment.ts, line.ts, circle.ts, triangle.ts
      median.ts, bisector.ts, angle.ts
      parallel.ts, perpendicular.ts
  viewers/
    image-viewer.ts          ← Galerie + lightbox pour CP et Tuiles
  qr/
    qr-section.ts            ← Section analyse QR
  utils/
    events.ts                ← EventEmitter léger (on/off/emit)
    geometry.ts              ← Fonctions math (distance, angles, intersections, etc.)
css/
  main.css                   ← Thème sombre, tokens CSS, tous les styles
tests/
  geometry.test.ts           ← 72 tests
  store.test.ts              ← 19 tests
  events.test.ts             ← 9 tests
  shapes.test.ts             ← 61 tests
  measurement.test.ts        ← 39 tests
  history.test.ts            ← 12 tests
  save-manager.test.ts       ← 20 tests (incl. corrupt storage handling)
  select-tool.test.ts        ← 8 tests
  segment-tool.test.ts       ← 11 tests (création, cancel, régression curseur fantôme, hasMoved)
  perpendicular-tool.test.ts ← 24 tests
  tab-router.test.ts         ← 19 tests (activation, visibilité, lazy-init, isolation erreurs)
  fabric-canvas-touch.test.ts← 42 tests (jsdom, tap/drag/pinch detection, hasMoved)
  gps-calibration.test.ts    ← 97 tests (interpolateLatY + buildGradGrid + calibration 1°-résolution + scan constants coverage + synthetic detection count + expected counts 361/181 + linear-tick variance + GPS accuracy with midpoint-shifted ticks)
  TOTAL                      ← 433 tests (includes 42 jsdom)
```

## Stack technique

| Élément      | Version | Usage                                       |
|-------------|---------|---------------------------------------------|
| TypeScript  | 6.0.x   | Typage statique (`npm run typecheck`) + émission browser (`npm run build`) |
| Fabric.js   | 7.2.0   | Rendu canvas, chargé via `<script>` UMD     |
| Vitest      | 4.1.4   | Framework de test (`npm test`)               |
| @vitest/coverage-v8 | 4.1.x | Couverture de code (`npm run test:coverage`) |
| typescript-eslint | 8.x | Linting TypeScript (`npm run lint`)        |
| ES Modules  | —       | `"type": "module"` dans package.json        |
| Pas de bundler | —    | `tsc` émet `dist/**/*.js` directement consommé par `index.html` (`dist/app.js`) ; pas de Webpack/Vite/Rollup |

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
npm test              # npx vitest run — lance les 433 tests
npm run test:watch    # vitest en mode watch
npm run test:coverage # vitest avec rapport de couverture (v8)
npm run typecheck     # tsc --noEmit — vérification TypeScript
npm run build         # tsc -p tsconfig.build.json — émet dist/**/*.js (consommé par index.html)
npm run check         # typecheck + test + build (CI complet)
# Note : `npm install` exécute automatiquement `postinstall` → `npm run build`,
# de sorte que `dist/` est toujours présent après une installation fraîche.
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
| 2026-04-27| Fix zone détection graduations : LON_Y0=90/LON_H=18 (y=90-108, ± mapTop≈105), LAT_X0=120/LAT_W=32 (x=120-152), corner exclusion LAT 100→5 px. LAT_EXPECTED 161→181 (±90°). Variance check sur R-values dans computeCalibration (évite corruption mercRadius par ticks linéaires). mercRadiusOk resserré 400-1000→550-760. Export LON/LAT_EXPECTED. 8 nouveaux tests (+4 counts + 2 linear-tick + 2 symmetric top/bottom + left/right). 324 tests |
| 2026-04-28| Fix affichage onglet 1 + changement d'onglets cassés : extraction `tab-router.js` (logique testable + try-catch isolation), imports dynamiques dans `app.js` (un module cassé ne bloque plus l'app), `initialized['qr']` pré-renseigné. 19 nouveaux tests. 366 tests |
| 2026-04-28| Fix centrage graduation GPS : `findTickCenters` utilise désormais le milieu géométrique `(from+to)/2` (midpoint) au lieu du centroïde pondéré. Corrige un décalage de 1–2 px : les traits de grille passent maintenant par le centre de l'épaisseur de la graduation. GPS inchangé (mapWidth non affecté). 368 tests |
| 2026-04-29| Validation étapes intermédiaires sur levé de doigt : tous les outils de dessin (Point, Segment, Droite, Cercle, Triangle, Médiane, Médiatrice, Angle, Parallèle, Perpendiculaire) valident les étapes dans `onMouseUp` avec garde `hasMoved`, non plus dans `onMouseDown`. `fabric-canvas.js` émet `hasMoved` dans `mouseup` (touch + souris). Évite les validations indésirées lors d'un déplacement/zoom. 414 tests |
| 2026-04-28| Amélioration UX mobile : détection tap vs drag pour touch unique — `mousedown` bufferisé jusqu'au levé de doigt (tap = pas de déplacement) ou au franchissement du seuil de 10px (drag). Plus d'ajout accidentel de points en dessinant. Pinch 2 doigts annule le tap en attente (plus de sélection accidentelle). jsdom installé, 403 tests |
| —         | Migration TypeScript : renommage .js → .ts (sources + tests), tsconfig.json, vitest.config.ts, eslint.config.js, js/types.ts (interfaces Shape/Point/Rect). `// @ts-nocheck` sur fichiers existants (approche progressive). Scripts npm : typecheck, lint, check, test:coverage. 414 tests, tsc --noEmit ✓ |
| 2026-04-29| Typage strict : suppression `@ts-nocheck` de events.ts, geometry.ts, store.ts, history.ts, measurement.ts, save-manager.ts. Types propres avec imports depuis types.ts. 414 tests, tsc --noEmit ✓. copilot-instructions.md mis à jour avec workflow qualité obligatoire (test + typecheck + coverage). |
| 2026-04-29| Audit complet : (1) `ShapeStore.restore()` re-synchronise désormais le pool d'IDs (`syncNextId`) et `clear()` libère explicitement les IDs — corrige un bug de fuite d'IDs après undo/clear ; (2) `save-manager._readAll()` valide la forme des données — résiste aux entrées localStorage corrompues (chaînes, tableaux, slots invalides) ; (3) Helper `esc()` introduit dans `map-section.ts` pour échapper les chaînes contrôlées par l'utilisateur (labels de formes, noms de slots) interpolées en HTML — corrige un risque d'injection HTML/CSS ; (4) Suppression `@ts-nocheck` de tab-router.ts, qr-section.ts, image-viewer.ts (typage propre) ; (5) eslint.config.js : règles `ban-ts-comment` et `no-unused-vars` ajustées pour s'aligner sur les conventions du projet. 433 tests, lint ✓, typecheck ✓. |
| 2026-04-29| Suite audit PR #24 (follow-up "Out of scope") : pipeline de build TS→JS pour rendre l'app exécutable dans le navigateur. Tous les imports relatifs `.ts` réécrits en `.js` (résolution `.js`→`.ts` côté tsc/Vitest, fichier réel côté navigateur). Nouveau `tsconfig.build.json` (extends `tsconfig.json`, `noEmit:false`, `outDir: dist`). Script `npm run build` ajouté ; `npm run check` enchaîne désormais typecheck + test + build. `index.html` charge maintenant `dist/app.js` (séparation source `js/` vs émission `dist/`). `.gitignore` exclut `dist/`. 433 tests inchangés, typecheck ✓, lint ✓, build ✓. |
| 2026-04-29| Fix « rien ne s'affiche sur le premier tab + tabs morts » : ajout du script `postinstall` (`tsc -p tsconfig.build.json`) dans `package.json`. `dist/` étant gitignoré, après un `git clone` + `npm install`, `dist/app.js` n'existait pas → 404 sur le module ES → aucun JS n'était exécuté (section QR vide, listeners de tabs jamais attachés). Désormais `npm install` régénère automatiquement `dist/`. 433 tests inchangés, typecheck ✓, lint ✓. |
