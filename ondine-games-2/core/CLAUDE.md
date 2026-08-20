# core/ — Game SDK Ondine

## Ce que contient ce dossier

```
core/sdk/createSDK.js      → SEULE porte d'entrée pour un jeu
core/sdk/GameRegistry.js   → utilisé par le Hub, pas par un jeu
core/services/             → PRIVÉ — jamais importé par un jeu directement
core/storage/keys.js       → PRIVÉ — convention de clé + migration, jamais importé par un jeu
core/engines/              → semi-public — un jeu peut importer un engine
                              directement s'il en a besoin (Card/Dice/Grid/
                              AI/SnapshotStore/Random)
core/ui/components.js      → semi-public — composants DOM réutilisables
core/design-tokens.css     → palette/typo/rayons partagés
```

## Ce qui est autorisé

Un jeu peut :
```js
import { createSDK } from '../../core/sdk/createSDK.js';
const sdk = createSDK('monjeu');
sdk.stats.increment('games');
```
Un jeu peut aussi importer un **engine** directement (sans état, donc sans
risque d'accès croisé entre jeux) :
```js
import { createGrid, neighbors8 } from '../../core/engines/GridEngine.js';
```

## Ce qui est interdit

- Importer `core/services/*.js` directement (accès direct = risque de lire/
  écrire les données d'un AUTRE jeu en changeant le `gameId` passé —
  `createSDK()` est le SEUL endroit où le `gameId` est figé, par fermeture).
- Importer `core/storage/keys.js` directement.
- Accéder à `localStorage` directement depuis un jeu.
- Modifier `GameRegistry` en écriture depuis un jeu (lecture seule, côté Hub).
- Créer une dépendance d'un jeu vers un autre jeu.

## Pourquoi `sdk.ai` n'existe pas

L'AI Engine (`core/engines/AIEngine.js`, fonction `search()`) est un moteur
de recherche arborescente générique (minimax + élagage alpha-bêta). Il ne
convient QU'AUX jeux dont l'IA est une vraie recherche de coup (Puissance 4
en est la preuve). Rami, Road Trip ont des IA à priorités de règles, pas de
recherche — les forcer dans ce moteur serait un mauvais générique. Un jeu
qui en a besoin l'importe comme un engine, jamais via `sdk.*`.

## API du SDK (15 fonctions)

```
sdk.stats.get/getAll/set/increment/setMax/setMin/reset
sdk.achievements.unlock(id, name, icon)/isUnlocked/unlockedList/reset
sdk.audio.tone(freq, dur, type, vol)/play(presetName)/isEnabled/setEnabled
sdk.toast.show(message, duration)
sdk.dialog.confirm(title, message, confirmLabel, cancelLabel) → Promise<boolean>
sdk.save.read/write/hasSave/clear
sdk.random.shuffle(array)   // ne mute JAMAIS le tableau passé
sdk.navigation.go(screenId)
```

Détail complet (arguments, comportement, exemples) : voir
`architecture-ondine-games-2.0.md` section 2, ou lire directement
`core/sdk/createSDK.js` — le fichier est court et commenté.

## Pièges connus

- **Collision de nom au build.** Tout `core/` est concaténé dans une seule
  IIFE lors du build standalone (`build_standalone.py`). Deux fichiers
  différents ne doivent JAMAIS déclarer une `const`/`let` de même nom au
  niveau racine (`NS`, par exemple — bug réel rencontré et corrigé pendant
  la Phase 2 : `StatsService.js`, `AchievementsService.js` et
  `SaveService.js` utilisaient tous `const NS = ...`). Préfixe tes
  constantes de module (`STATS_NS`, pas `NS`).
- **Imports multi-lignes.** Le build script gère les imports multi-lignes,
  mais préfère les imports sur une seule ligne quand c'est raisonnable —
  plus lisible et moins de surface à bug.
- **`shuffle()` ne mute pas.** Contrairement à l'ancienne version du
  CoreBundle (Batch 1), `RandomEngine.shuffle()` retourne toujours une
  COPIE, ne modifie jamais le tableau passé. Documenté dans le fichier
  lui-même — vérifie avant de migrer un jeu qui comptait sur l'ancien
  comportement mutant.
