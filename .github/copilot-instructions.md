# Copilot Instructions — GOL-QRS

## Workflow obligatoire avant TOUTE modification

1. **Lire `PROJECT.md`** pour avoir le contexte complet du projet.
2. **Lancer les tests** : `npm test` → tous les tests doivent passer avant de commencer.
3. **Vérifier la couverture** : `npm run test:coverage` → vérifier les seuils (≥ 60%).
4. **Vérifier les types** : `npm run typecheck` → zéro erreur TypeScript.
5. Implémenter les changements (TDD : écrire les tests d'abord).
6. **Relancer les tests** après chaque modification.
7. **Mettre à jour `PROJECT.md`** si l'architecture ou le nombre de tests change.

## Règles de développement

### TDD obligatoire
- **Toujours** écrire/mettre à jour les tests **avant** d'implémenter les changements (Red → Green → Refactor).
- **Après chaque modification de code** : lancer `npm test` et corriger tout test cassé avant de continuer.
- **Couverture** : toute nouvelle logique (fonctions, classes, branches) doit avoir des tests unitaires correspondants.
- **Le nombre de tests ne doit jamais diminuer** : actuellement **414 tests** dans 12 fichiers.
- Ne jamais sauter les tests, même pour les petits changements, le wiring UI ou les refactors.

### Qualité de code
- **TypeScript strict** : `npm run typecheck` doit passer sans erreur. Utiliser `any` avec parcimonie.
- **Pas de `@ts-nocheck`** dans les nouveaux fichiers — utiliser des types propres.
- Les fichiers UI/DOM complexes (fabric-canvas, map-section, tools) peuvent conserver `@ts-nocheck` temporairement.
- **ESLint** : `npm run lint` pour détecter les problèmes de style et de sécurité.
- **Couverture** : seuils min dans `vitest.config.ts` (60% statements/lines/functions, 55% branches).

### Documentation projet
- **Toujours lire `PROJECT.md`** au début de chaque session pour avoir le contexte complet du projet.
- **Mettre à jour `PROJECT.md`** après chaque modification qui change l'architecture, ajoute des fonctionnalités, ou modifie le nombre de tests.

### Stack technique
- **TypeScript 6+** — tous les fichiers source sont en `.ts`
- **Vitest 4.1.4** — framework de test (`npm test`)
- **@vitest/coverage-v8** — couverture de code (`npm run test:coverage`)
- **typescript-eslint** — linting TypeScript (`npm run lint`)
- **Fabric.js 7.2.0** — rendu canvas (chargé via `<script>` UMD, `declare const fabric: any` dans les modules)
- **ES Modules** — `"type": "module"` dans package.json
- **Pas de bundler** — fichiers servis directement (TypeScript compilé avec `tsc` pour le navigateur si nécessaire)

### Commandes
```bash
npm test               # npx vitest run — lance les 414 tests
npm run test:watch     # vitest en mode watch
npm run test:coverage  # vitest run --coverage
npm run typecheck      # tsc --noEmit — vérification TypeScript
npm run lint           # eslint js/ tests/
npm run check          # typecheck + test (vérification complète)
```

### Conventions de code
- Pas de sur-ingénierie : ne changer que ce qui est demandé.
- Pas de commentaires/docstrings ajoutés sur du code non modifié.
- Pas de gestion d'erreur pour des cas impossibles.
- Architecture event-driven : `EventEmitter` pour la communication inter-modules.
- Shapes = plain POJOs (pas de classes) pour faciliter la sérialisation.
- Types partagés dans `js/types.ts` (Point, Rect, Shape, etc.).
