# games/ — jeux Ondine

## Ce que contient ce dossier

Un sous-dossier par jeu, chacun contenant :
```
manifest.json   → métadonnées (id, name, icon, category, description, joueurs, version)
logic.js        → logique pure, sans DOM ni SDK — testable en Node
ui.js           → rendu DOM + gestion d'écran, reçoit le SDK déjà créé
game.js         → point d'entrée : crée le SDK, monte le toast, câble window.*
styles.css      → CSS spécifique à CE jeu uniquement
index.html      → squelette HTML de développement (charge core/ + le jeu via modules ES)
```

`_template/` est un exemple minimal à copier pour démarrer un nouveau jeu
(voir `_template/CLAUDE.md`). `reflexe/` est un exemple complet qui utilise
toutes les briques du SDK. `morpion/` est le seul jeu réellement migré à ce
jour — les 17 autres jeux (YAMS, Sudoku, Solitaire, et les 15 des Batch
1/2/3) restent des fichiers standalone indépendants, hors de ce dossier,
non touchés par cette phase.

## Comment enregistrer un jeu dans le Registry

`core/sdk/GameRegistry.js` existe mais n'est pas encore branché au Hub
(le Hub actuel garde son tableau `GAMES` en dur — voir architecture,
section 16 et Phase 10 de la roadmap : ce n'est PAS fait avant que
plusieurs jeux soient réellement migrés). Quand ce sera le cas, chaque
`game.js` appellera `GameRegistry.register(manifest)` au chargement.

## Pièges connus (leçons des sessions précédentes, à ne pas refaire)

- **Rami** : sous des règles strictes "piocher puis défausser", un joueur
  à 1 carte ne peut jamais mathématiquement revenir à 0 sans une règle de
  victoire-par-pose-complète ET une règle de fin-par-blocage. Si ton jeu a
  un cycle pioche/défausse, teste une partie complète simulée IA-contre-IA
  AVANT de considérer la logique terminée.
- **Sur-échappement JSON** : en écrivant du JS contenant des apostrophes
  ou des séquences unicode (`\u2019`) via les outils de création de
  fichier, vérifie toujours le fichier final avec `grep '\\\\'` — un
  double-échappement silencieux est une source d'erreurs fréquente dans
  ce projet.
- **Collision de nom au build** : voir `/core/CLAUDE.md`.
