# Copilot Instructions — GOL-QRS

## Workflow obligatoire avant TOUTE modification

1. **Lire `PROJECT.md`** pour avoir le contexte complet du projet.
2. **Lancer les tests** : `npm test` → tous les tests doivent passer avant de commencer.
3. **Vérifier la couverture** : `npm run test:coverage` → vérifier les seuils (≥ 60%).
4. **Vérifier les types** : `npm run typecheck` → zéro erreur TypeScript.
5. Implémenter les changements en TDD (écrire les tests **avant** le code).
6. **Relancer les tests** après chaque modification et corriger tout test cassé.
7. **Mettre à jour `PROJECT.md`** si l'architecture, les fonctionnalités ou le nombre de tests change.

## Règles de développement

### TDD obligatoire — sans exception
- **Red → Green → Refactor** : écrire/mettre à jour le test qui échoue, puis implémenter le code minimal qui le fait passer, puis refactorer.
- **Après CHAQUE modification de code** : lancer `npm test`. Si un test échoue, le corriger immédiatement avant de continuer.
- **Après CHAQUE session** : mettre à jour `PROJECT.md` (nombre de tests, fonctionnalités, historique).
- **Couverture** : toute nouvelle logique (fonctions, classes, branches) doit avoir des tests unitaires correspondants.
- **Le nombre de tests ne doit jamais diminuer** : actuellement **504 tests** dans 15 fichiers.
- Ne jamais sauter les tests, même pour les petits changements, le wiring UI ou les refactors.

### Documentation obligatoire
- **Toujours lire `PROJECT.md`** au début de chaque session pour avoir le contexte complet.
- **Mettre à jour `PROJECT.md`** après chaque modification qui change l'architecture, ajoute des fonctionnalités, ou modifie le nombre de tests. L'historique des modifications doit être tenu à jour.
- La documentation doit permettre à n'importe quel contributeur (ou à Copilot lors d'une nouvelle session) de comprendre immédiatement le contexte, les décisions architecturales et l'état du projet.

### Qualité de code
- **TypeScript strict** : `npm run typecheck` doit passer sans erreur. Utiliser `any` avec parcimonie.
- **Pas de `@ts-nocheck`** dans les nouveaux fichiers — utiliser des types propres.
- Les fichiers UI/DOM complexes (fabric-canvas, map-section, tools) peuvent conserver `@ts-nocheck` temporairement.
- **ESLint** : `npm run lint` pour détecter les problèmes de style et de sécurité.
- **Couverture** : seuils min dans `vitest.config.ts` (60% statements/lines/functions, 55% branches).

### Stack technique
- **TypeScript 6+** — tous les fichiers source sont en `.ts`
- **Vitest 4.1.4** — framework de test (`npm test`)
- **@vitest/coverage-v8** — couverture de code (`npm run test:coverage`)
- **typescript-eslint** — linting TypeScript (`npm run lint`)
- **Fabric.js 7.2.0** — rendu canvas (chargé via `<script>` UMD, `declare const fabric: any` dans les modules)
- **ES Modules** — `"type": "module"` dans package.json
- **Pas de bundler React/Vite** — TypeScript compilé avec `tsc` (`npm run build`) → `dist/`. Fabric.js copié dans `dist/vendor/` à chaque build.
- **Pas de React** — Fabric.js est incompatible avec le virtual DOM React (manipulation DOM directe). Le routage par onglets est minimal et bien testé via `tab-router.ts`.

### Commandes
```bash
npm test               # vitest run — lance les 504 tests
npm run test:watch     # vitest en mode watch
npm run test:coverage  # vitest run --coverage
npm run typecheck      # tsc --noEmit — vérification TypeScript
npm run build          # tsc → dist/ + copie dist/vendor/fabric.js
npm run lint           # eslint js/ tests/
npm run check          # typecheck + test + build (CI complet)
# Note : npm install exécute automatiquement postinstall → npm run build
```

### Déploiement Render (Static Site)
- **Build Command** : `npm ci`  *(postinstall déclenche `npm run build` automatiquement)*
- **Publish Directory** : `.`
- Aucun serveur Node.js requis — tous les assets sont dans `dist/` et à la racine.

### Conventions de code
- Pas de sur-ingénierie : ne changer que ce qui est demandé.
- Pas de commentaires/docstrings ajoutés sur du code non modifié.
- Pas de gestion d'erreur pour des cas impossibles.
- Architecture event-driven : `EventEmitter` pour la communication inter-modules.
- Shapes = plain POJOs (pas de classes) pour faciliter la sérialisation.
- Types partagés dans `js/types.ts` (Point, Rect, Shape, etc.).
