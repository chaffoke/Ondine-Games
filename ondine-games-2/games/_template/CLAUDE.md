# Créer un nouveau jeu Ondine — à partir de ce template

## Étapes

1. Copie ce dossier : `cp -r games/_template games/monjeu`
2. Modifie `manifest.json` (id, name, icon, category, description, joueurs)
3. Écris ta logique PURE dans `logic.js` — aucun `document`, aucun `sdk`,
   testable directement avec Node avant même d'écrire une interface. Fais-le
   en premier, toujours (voir `games/morpion/logic.js` pour un vrai exemple,
   et le rapport de Phase 2 pour l'exemple concret où ça a évité une
   régression : le comportement de l'IA impossible re-testé après migration).
4. Écris `ui.js` — reçoit le SDK déjà créé, importe `logic.js`. N'importe
   JAMAIS `core/services/*` directement, seulement `sdk.*` (voir
   `/core/CLAUDE.md`).
5. `game.js` — copie celui du template, change juste l'id passé à
   `createSDK()`.
6. `index.html` — copie celui du template, ajuste les écrans à ton jeu.
7. `styles.css` — uniquement ce qui est spécifique à ton jeu. Boutons/
   toast/modale/écrans/logo viennent déjà de `core/design-tokens.css`,
   ne les redéfinis pas.
8. Build : `cd build && python3 build_standalone.py monjeu`
9. Le jeu apparaît dans `games-dist/monjeu.html`, ouvrable directement.

## Ce qui est minimal ici, volontairement

Ce template n'a qu'un écran d'accueil et un écran de jeu, un seul compteur.
Pas de stats/achievements/save avancés — regarde `games/reflexe/` pour un
exemple complet qui utilise TOUTES les briques du SDK (stats, achievements,
audio, toast, save, random, navigation), et `games/morpion/` pour un
exemple avec un engine (AI Engine via minimax) et des règles plus riches.

## Ne pas faire

- Ne pas accéder à `localStorage` directement.
- Ne pas importer un service de `core/services/` directement.
- Ne pas inventer de nouveau service SDK pour un besoin propre à ton seul
  jeu — utilise `sdk.audio.tone()` pour un son sur mesure plutôt que de
  demander l'ajout d'un preset générique, par exemple.
