# Copilot Instructions — GOL-QRS

## Règles de développement

### TDD obligatoire
- **Toujours** écrire/mettre à jour les tests **avant** d'implémenter les changements (Red → Green → Refactor).
- **Après chaque modification de code** : lancer `npx vitest run` et corriger tout test cassé avant de continuer.
- **Couverture** : toute nouvelle logique (fonctions, classes, branches) doit avoir des tests unitaires correspondants.
- **Le nombre de tests ne doit jamais diminuer** : actuellement **208 tests** dans 8 fichiers.
- Ne jamais sauter les tests, même pour les petits changements, le wiring UI ou les refactors.

### Documentation projet
- **Toujours lire `PROJECT.md`** au début de chaque session pour avoir le contexte complet du projet.
- **Mettre à jour `PROJECT.md`** après chaque modification qui change l'architecture, ajoute des fonctionnalités, ou modifie le nombre de tests.

### Stack technique
- **Vitest 4.1.4** — framework de test (`npx vitest run`)
- **Fabric.js 7.2.0** — rendu canvas (chargé via `<script>` UMD)
- **ES Modules** — `"type": "module"` dans package.json
- **Pas de bundler** — fichiers servis directement

### Conventions de code
- Pas de sur-ingénierie : ne changer que ce qui est demandé.
- Pas de commentaires/docstrings ajoutés sur du code non modifié.
- Pas de gestion d'erreur pour des cas impossibles.
- Architecture event-driven : `EventEmitter` pour la communication inter-modules.
- Shapes = plain POJOs (pas de classes) pour faciliter la sérialisation.
