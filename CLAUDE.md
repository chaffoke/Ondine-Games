# Ondine Games

Plateforme de jeux familiaux. Les jeux sont des plugins ; le SDK est
l'outil pour les créer ; le Hub est la vitrine ; les services sont
invisibles. Voir `core/CLAUDE.md` pour les règles internes du core.

## Philosophie (ne pas dévier)
- Simplicité avant tout : un service/moteur n'est ajouté que s'il
  rend réellement le développement du prochain jeu plus simple.
- Un jeu ne parle à la plateforme QUE via `sdk.*` et `UI.*`.
- Un service ne connaît jamais un jeu par son nom.
- Migration progressive, un petit pas validé à la fois — jamais de
  réécriture complète d'un jeu en une fois.

## Plan de migration — suivi

- [x] **Étape 1** — Squelette SDK + UI, un seul composant réel
      (`UI.toastHost` / `sdk.toast`), un seul service réel
      (`NotificationService`), branché sur **Solitaire uniquement**.
      Sudoku et YAMS non touchés. Diff vérifié : seuls les appels
      `toast()` et leur CSS/DOM associés ont changé, aucune ligne de
      règle de jeu modifiée.
- [ ] **Étape 2** — Appliquer `sdk.toast` à Sudoku puis YAMS (même
      recette que Solitaire).
- [ ] **Étape 3** — `AudioService` + `sdk.audio` (Solitaire d'abord).
- [ ] **Étape 4** — `AnimationService` (particules, confettis,
      score-float, combo-text).
- [ ] **Étape 5** — `StatsService` + `sdk.stats`, généralisé depuis
      le schéma commun aux 3 jeux.
- [ ] **Étape 6** — `ThemeService` + `RewardService`.
- [ ] **Étape 7** — `SaveService`, généralisé depuis le mécanisme
      `sud_save`/`autoSave` de Sudoku.
- [ ] **Étape 8** — `CloudService`, généralisé depuis
      `SyncEngine`/`FirestoreProvider` de YAMS.
- [ ] **Étape 9** — Card Engine / Dice Engine / Grid Engine extraits
      de la logique de jeu restante.
- [ ] **Étape 10** — `AIService` + `AI.*`, remonté depuis le Studio
      IA de YAMS.
- [ ] **Étape 11** — `GameRegistry` + `manifest.json` par jeu + Hub.

Chaque étape cochée doit avoir été validée par Kevin avant de passer
à la suivante.

## Structure
```
core/           ← SDK, services, moteurs, UI, design tokens (privé aux jeux)
games/<jeu>/    ← un dossier autonome par jeu (manifest, logique, CLAUDE.md)
build.py        ← (pas encore créé — arrivera à l'étape 11)
```
