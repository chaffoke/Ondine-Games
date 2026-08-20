# Ondine Games 2.0 — vue d'ensemble

Plateforme de jeux familiale. Développée pour un environnement verrouillé
(CETEC) : Firefox/Edge uniquement, aucun exécutable, pas de serveur HTTP,
ouverture en `file://`. Ça conditionne toutes les décisions techniques
ci-dessous.

## Principe fondamental

> Le SDK sert les jeux. Les jeux ne sont jamais remodelés pour servir le SDK.

Si migrer un jeu vers le SDK exigerait de changer une règle, une valeur
sonore, ou un comportement existant : c'est le SDK qui doit s'adapter
(exposer une primitive plus bas niveau), pas le jeu qui doit céder.

## Où trouver quoi

```
core/         → SDK public (sdk.*) + services privés + engines optionnels
games/<id>/   → un jeu : manifest.json, logic.js, ui.js, game.js, styles.css
games-dist/   → fichiers .html standalone générés par build/ (jamais édités à la main)
build/        → build_standalone.py, seul outil de build
hub/          → le Hub (non touché par cette phase)
docs/         → ce dossier
```

## Lancer un build

```
cd build && python3 build_standalone.py <id-du-jeu> [<autre-id>...]
```
Produit `games-dist/<id>.html` — un fichier unique, sans dépendance vers
`core/`, ouvrable directement en `file://`.

## Règles absolues

- Un jeu n'importe **jamais** `core/services/*` ni `core/storage/*`
  directement — uniquement `core/sdk/createSDK.js`. Voir `/core/CLAUDE.md`.
- Les fichiers dans `games-dist/` sont un ARTEFACT de build, jamais une
  source de vérité. Ne jamais les éditer à la main.
- Aucune règle de jeu ne doit migrer dans `core/` — voir `/core/CLAUDE.md`
  pour la liste de ce qui doit rester spécifique à chaque jeu.

## État actuel (Phase 2)

18 jeux existent. Seul **Morpion** est migré sur ce Core (pilote). Les 17
autres restent des fichiers standalone indépendants, non touchés,
pleinement fonctionnels — ils seront migrés progressivement, jeu par jeu,
selon l'ordre proposé dans le rapport d'architecture (pas dans cette
phase). Un jeu de démonstration, **Réflexe**, prouve qu'un 19e jeu peut
être créé rapidement à partir de `games/_template/`.
