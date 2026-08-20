# ONDINE GAMES 2.0 — PHASE 2 : RAPPORT FINAL
### Construction du Core + migration du jeu pilote

---

## CONSTRUIT

**Core modulaire** (`core/`), extrait du CoreBundle existant du Batch 1 — pas réécrit :
- `sdk/createSDK.js` (+ `sdk/GameRegistry.js`, prêt mais pas branché au Hub)
- `services/` : NotificationService, StatsService, AchievementsService, AudioService, SaveService, DialogService — code repris tel quel du CoreBundle ; `NavigationService` — **nouveau**, formalise le pattern `showScreen()` qui n'avait jamais été extrait, même dans le Batch 1
- `engines/` : GridEngine, CardEngine, DiceEngine, AIEngine (exposé aussi sous `search()`), RandomEngine (déviation documentée : ne mute plus le tableau, contrairement à l'ancienne version), SnapshotStore (**nouveau**)
- `storage/keys.js` (**nouveau**) : convention `ondine.games.<id>.<namespace>` + migration transparente depuis les anciennes clés
- `ui/components.js`, `design-tokens.css`
- `build/build_standalone.py` : adapté de l'original (même principe IIFE), étendu pour la nouvelle arborescence et la séparation `logic.js`/`ui.js`/`game.js`
- `games/_template/` : squelette minimal à copier pour un nouveau jeu
- 3 fichiers `CLAUDE.md` (racine, `core/`, `games/`, + `_template/CLAUDE.md`)

## MIGRÉ

**Morpion uniquement**, comme prévu. Règles, IA, difficultés, sons (valeurs exactes préservées), écrans, statistiques et succès strictement identiques à la version Batch 3 — aucune règle changée pour "rentrer" dans le SDK.

## DÉMONSTRATEUR

**Réflexe** : jeu neuf créé à partir du template, mobilise les 15 fonctions du SDK (stats, achievements, audio, toast, save, random, navigation). Confirme qu'un 19e jeu peut être développé sans toucher au Core.

## NON TOUCHÉ

Hub, YAMS, Sudoku, Solitaire, et les 14 autres jeux des Batch 1/2/3 (Puissance 4, Uno, Shut the Box, Démineur, Rhythm Hero, Othello, 421, Mastermind, Mahjong, Dames, Rami, Spider, Memory, Road Trip). Vérifié par comparaison de timestamps avant/après cette session : **0 fichier modifié** en dehors de `ondine-games-2/`.

## TESTS — résultats réels

Jsdom indisponible (réseau bloqué dans ce bac à sable) : un shim DOM minimal a été écrit à la main pour exécuter réellement le code (pas seulement vérifier sa syntaxe).

| Test | Résultat |
|---|---|
| Syntaxe — tous les fichiers JS source (core + jeux) | ✅ 100% |
| Logique Morpion migrée vs suite de tests pré-existante (60 parties + preuve d'invincibilité) | ✅ 0 régression |
| Morpion end-to-end (partie humaine, coups invalides, IA sur 3 difficultés, achievements idempotents, save/clear, navigation, audio on/off) | ✅ 11/11 assertions |
| Réflexe end-to-end (stats, achievements, audio, toast, save, random, navigation) | ✅ 7/7 assertions |
| Migration ancienne clé → nouvelle clé (avec une fausse ancienne sauvegarde réaliste) | ✅ 11/11 assertions — aucune perte, ancienne clé jamais supprimée |
| Fichier standalone exécuté en VM isolée (pas de source, pas de cache de module partagé) | ✅ Morpion + Réflexe, tous deux fonctionnels seuls |
| Non-régression Hub / 17 autres jeux | ✅ 0 fichier modifié |

**Un bug réel a été trouvé et corrigé grâce à ces tests**, pas malgré eux : `StatsService.js`, `AchievementsService.js` et `SaveService.js` déclaraient chacun `const NS = ...` au niveau racine — invisible en développement modulaire (chaque fichier est dans son propre scope de module), mais provoquait une `SyntaxError` de double-déclaration une fois concaténés dans la même IIFE au moment du build standalone. Seul le test du fichier *généré* (pas juste des sources) l'a révélé. Corrigé en préfixant chaque constante (`STATS_NS`, `ACH_NS`, `SAVE_NS`) — documenté dans `/core/CLAUDE.md` comme piège connu.

## COMPATIBILITÉ STANDALONE — preuve

`games-dist/morpion.html` et `games-dist/reflexe.html` :
- 0 balise `<script type="module">` résiduelle
- 0 ligne `import`/`export` résiduelle (hors commentaires)
- 6-7 mentions de "core/" restantes, **toutes dans des commentaires**, aucune référence fonctionnelle
- Exécutés avec succès dans un contexte VM Node isolé, sans accès au système de fichiers source ni au cache de modules ES — la preuve la plus forte possible sans navigateur réel que le fichier fonctionne vraiment seul en `file://`

## TEMPS / COMPLEXITÉ POUR UN NOUVEAU JEU

Concrètement, à partir de maintenant :
1. `cp -r games/_template games/monjeu`
2. Modifier `manifest.json`
3. Écrire `logic.js` (testable en Node avant toute interface — c'est ce qui a évité de vraies régressions sur Rami/Road Trip/Morpion dans les phases précédentes, le réflexe est à garder)
4. Écrire `ui.js` en s'appuyant sur les 15 fonctions `sdk.*` (référence : `/core/CLAUDE.md`)
5. Copier `game.js` du template, changer l'id
6. `python3 build/build_standalone.py monjeu`
7. `games-dist/monjeu.html` est prêt, testable directement en `file://`

Aucune de ces étapes ne nécessite de comprendre l'implémentation interne des services, ni de toucher à `core/` ou au Hub. C'est le test de réussite du brief ("si ça nécessite de modifier 15 fichiers du Core : ÉCHEC") — validé.

## DETTE RESTANTE

- **17 jeux non migrés.** Ordre et risque déjà détaillés dans le rapport d'architecture (section 21) — pas fait ici, volontairement (règle "pas de big bang").
- **Hub non branché au `GameRegistry`.** Le tableau `GAMES` reste en dur ; brancher la découverte automatique n'a de sens qu'une fois plusieurs jeux migrés (Phase 10 de la roadmap).
- **`DialogService` — deux générations d'API à réconcilier définitivement** une fois un 2e jeu migré (Morpion seul ne suffit pas à trancher tous les cas d'usage réels).
- **`sdk.audio.play(presetName)` vs sons sur mesure.** Morpion a dû contourner les presets génériques (valeurs légèrement différentes de l'original) en utilisant `sdk.audio.tone()` directement. Fonctionne bien, mais si plusieurs futurs jeux répètent ce contournement, ça vaudra la peine de revoir les presets par défaut.
- **Tests automatisés dépendants d'un shim DOM maison**, pas d'un outil standard (jsdom bloqué par le réseau de ce bac à sable). Si un vrai environnement de dev est disponible côté Kevin (CETEC), `npm install jsdom` en local résoudrait ça proprement — le shim actuel reste une solution de repli correcte mais rudimentaire (pas de vrai parsing HTML, par exemple).

## PROCHAINE ÉTAPE — UNE seule recommandation

**Migrer Mastermind ensuite** (2e jeu de la Phase 5 de la roadmap), pas un 19e jeu neuf. Raison : Morpion a validé le SDK avec un engine (AI Engine) branché ; Mastermind validera le SDK **seul**, sans aucun engine — c'est le test qui manque encore pour confirmer que le socle actuel (les 15 fonctions `sdk.*`) suffit vraiment à un jeu simple sans rien d'autre. Une fois ces 2 jeux migrés et re-testés avec la même rigueur qu'ici, le Core peut être considéré comme validé pour de bon — pas besoin d'une "Phase 2.1" ni d'un nouvel audit avant de reprendre le développement de nouveaux jeux ou la migration des 16 autres.
