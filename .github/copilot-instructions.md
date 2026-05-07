# Copilot Instructions — GOL-QRS

## Workflow obligatoire avant TOUTE modification

1. **Lire `PROJECT.md`** pour avoir le contexte complet du projet.
2. **Lancer les tests** : `npm test` → tous les tests doivent passer avant de commencer.
3. **Vérifier la couverture** : `npm run test:coverage` → vérifier les seuils (≥ 60%).
4. **Vérifier les types** : `npm run typecheck` → zéro erreur TypeScript (app + legacy).
5. Implémenter les changements en TDD (écrire les tests **avant** le code).
6. **Relancer les tests** après chaque modification et corriger tout test cassé.
7. **Mettre à jour `PROJECT.md`** si l'architecture, les fonctionnalités ou le nombre de tests change.

## Règles de développement

### TDD obligatoire — sans exception

- **Red → Green → Refactor** : écrire/mettre à jour le test qui échoue, puis implémenter le code minimal qui le fait passer, puis refactorer.
- **Après CHAQUE modification de code** : lancer `npm test`. Si un test échoue, le corriger immédiatement avant de continuer.
- **Après CHAQUE session** : mettre à jour `PROJECT.md` (nombre de tests, fonctionnalités, historique).
- **Couverture** : toute nouvelle logique (fonctions, classes, branches, composants React) doit avoir des tests unitaires correspondants.
- **Le nombre de tests ne doit jamais diminuer** : actuellement **522 tests** (504 legacy dans `tests/` + 18 React dans `src/**/*.test.tsx`).
- Ne jamais sauter les tests, même pour les petits changements, le wiring UI ou les refactors.

### Documentation obligatoire

- **Toujours lire `PROJECT.md`** au début de chaque session pour avoir le contexte complet.
- **Mettre à jour `PROJECT.md`** après chaque modification qui change l'architecture, ajoute des fonctionnalités, ou modifie le nombre de tests. L'historique des modifications doit être tenu à jour.

### Qualité de code

- **TypeScript strict** : `npm run typecheck` doit passer (deux projets : `tsconfig.app.json` pour `src/`, `tsconfig.json` pour `js/` + `tests/`).
- **Pas de `@ts-nocheck` dans `src/`** — typage propre obligatoire pour le code React.
- Les fichiers UI/DOM legacy (`fabric-canvas`, `map-section`, `tools/*`) conservent leur `@ts-nocheck` historique.
- **ESLint** : `npm run lint` (couvre `js/`, `tests/`, `src/`).
- **Couverture** : seuils min dans `vitest.config.ts` (60% statements/lines/functions, 55% branches).

### Stack technique

- **React 18** + **react-router-dom v7** (`createHashRouter`) — UI shell + routage SPA
- **Vite 6** + **@vitejs/plugin-react** — bundler dev/prod, HMR, code-splitting
- **Tailwind 3** — styling utility-first ; tokens du dark theme legacy mappés dans `tailwind.config.ts`
- **TypeScript 6** — strict, deux projets (`tsconfig.app.json` + `tsconfig.json` legacy)
- **Vitest 4 + jsdom** + **@testing-library/react** — tests unitaires (Node + React)
- **Fabric.js 7** — moteur canvas du legacy `js/map/fabric-canvas.ts`. Exposé en global via `src/legacy-bridge.ts` (`globalThis.fabric = fabric`).
- **Konva 9** + **react-konva** — installés pour une future migration de `fabric-canvas.ts` (cf. PROJECT.md).
- **CSS legacy** : `css/main.css` importé par `src/index.css`, complète Tailwind.
- ES Modules (`"type": "module"`).

### Architecture

- **`src/`** = code React (composants, router, layout, viewers, sections).
- **`js/`** = code historique non-React (moteur carte, store, outils, utils). `MapSection` React le monte via dynamic `import()` + `useEffect`.
- **`tests/`** = tests legacy (504, Vitest + jsdom).
- **`src/**/\*.test.tsx`** = tests des composants React (18, `@testing-library/react`).
- Pour ajouter une nouvelle section UI : composant React dans `src/sections/<name>/`, route ajoutée dans `src/router.tsx`.

### Commandes

```bash
npm run dev            # Vite dev server (HMR) sur http://localhost:5173
npm start              # Alias de `npm run dev`
npm run build          # tsc -p tsconfig.app.json && vite build → dist/
npm run preview        # Prévisualise dist/
npm test               # vitest run — lance les 522 tests
npm run test:watch     # vitest en mode watch
npm run test:coverage  # vitest run --coverage
npm run typecheck      # tsc app + tsc legacy
npm run lint           # eslint js/ tests/ src/
npm run check          # typecheck + test + build (CI complet)
npm run build:legacy   # Ancien pipeline (tsc → dist/app.js + dist/vendor/fabric.js, rollback)
```

### Déploiement Render (Static Site)

- **Build Command** : `npm ci && npm run build`
- **Publish Directory** : `dist`
- **Rewrite (SPA)** : optionnel — le hash router (`#/qr`, `#/map`, …) fonctionne sans rewrite serveur.
- Aucun serveur Node.js requis.

### Conventions de code

- Pas de sur-ingénierie : ne changer que ce qui est demandé.
- Pas de commentaires/docstrings ajoutés sur du code non modifié.
- Pas de gestion d'erreur pour des cas impossibles.
- React : composants fonction + hooks ; éviter `useEffect` quand un calcul dérivé suffit.
- Tailwind d'abord, CSS legacy si déjà existant. Pas de styled-components.
- Code legacy `js/` : `EventEmitter` pour la communication inter-modules ; shapes = POJOs ; types partagés dans `js/types.ts`.
