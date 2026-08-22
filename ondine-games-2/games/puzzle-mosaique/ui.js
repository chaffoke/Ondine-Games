// ═══════════════════════════════════════════════════════════════
// games/puzzle-mosaique/ui.js
// ═══════════════════════════════════════════════════════════════
import { SIZE, regionCells, generatePuzzle, countSolutions, isValidPlacement, DIFFICULTY_CLUES, ACHIEVEMENTS } from './logic.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacter } from '../../core/data/characters.js';
import { UI } from '../../core/ui/components.js';

// Les 8 valeurs (1-8) du puzzle sont distinguées par une couleur de
// badge, PAS par 8 animaux différents — le personnage choisi (un
// seul) apparaît identique dans toutes les cases, c'est la couleur
// du badge qui porte la contrainte visuelle (comme un vrai Sudoku où
// c'est le CHIFFRE qui varie, pas le style). Ce choix rend le rendu
// naturellement extensible à N'IMPORTE QUEL personnage futur, sans
// dépendre de l'existence de 8 emoji distincts pour cet animal.
const VALUE_COLORS = ['#f87171','#fb923c','#fbbf24','#34d399','#22d3ee','#818cf8','#c084fc','#f472b6'];
const REGION_TINTS = ['#1e3a5f22','#3f1e5f22','#5f1e3a22','#1e5f3a22','#5f4a1e22','#1e4a5f22','#4a5f1e22','#5f1e4a22'];

export function createUI(sdk) {
  let state = null; // { puzzle, solution, regionOf, difficulty, given (Set des cases de départ), startTime, hintsUsed, selectedCell, characterId }
  let selectedCharacterId = DEFAULT_CHARACTER_ID;
  let timerInterval = null;
  let winStreak = 0;

  function goHome() { stopTimer(); renderHome(); sdk.navigation.go('sh'); }

  /** Le personnage préféré doit survivre à sdk.save.clear() (appelé en
   *  fin de partie) — il ne peut donc pas vivre uniquement dans la
   *  sauvegarde de la partie en cours. StatsService ne stocke QUE des
   *  nombres (voir sa documentation) : on stocke donc l'INDEX du
   *  personnage dans CHARACTERS plutôt que son id (chaîne). */
  function loadPreferredCharacter() {
    const idx = sdk.stats.get('lastCharacterIdx', null);
    if (idx !== null && CHARACTERS[idx]) selectedCharacterId = CHARACTERS[idx].id;
  }
  function savePreferredCharacter(id) {
    const idx = CHARACTERS.findIndex(c => c.id === id);
    if (idx >= 0) sdk.stats.set('lastCharacterIdx', idx);
  }
  function selectCharacter(id) {
    selectedCharacterId = id;
    savePreferredCharacter(id);
    renderCharacterPicker();
  }

  function selectDifficulty(d) {
    document.querySelectorAll('.diff-card').forEach(el => el.classList.toggle('sel', el.dataset.diff === d));
  }
  function getSelectedDifficulty() {
    const sel = document.querySelector('.diff-card.sel');
    return sel ? sel.dataset.diff : 'normal';
  }

  function startNewPuzzle() {
    const difficulty = getSelectedDifficulty();
    document.getElementById('genOverlay').style.display = '';
    setTimeout(() => {
      const result = generatePuzzle(difficulty);
      document.getElementById('genOverlay').style.display = 'none';
      if (!result) { sdk.toast.show('Erreur de génération, réessaie'); return; }
      beginState(result, difficulty);
      sdk.navigation.go('sg');
      renderPalette();
      render();
      startTimer();
    }, 30);
  }

  function beginState(result, difficulty) {
    state = {
      puzzle: result.puzzle.slice(),
      solution: result.solution,
      regionOf: result.regionOf,
      difficulty,
      characterId: selectedCharacterId,
      given: new Set(result.puzzle.map((v, i) => v !== 0 ? i : -1).filter(i => i >= 0)),
      startTime: Date.now(),
      elapsedBeforePause: 0,
      hintsUsed: 0,
      selectedCell: null,
      over: false,
    };
    persist();
  }

  function persist() {
    if (!state) return;
    sdk.save.write({
      puzzle: state.puzzle, solution: state.solution, regionOf: state.regionOf,
      difficulty: state.difficulty, given: [...state.given], characterId: state.characterId,
      elapsedBeforePause: Date.now() - state.startTime + state.elapsedBeforePause,
      hintsUsed: state.hintsUsed,
    });
  }

  function resumePuzzle() {
    const saved = sdk.save.read();
    if (!saved) { startNewPuzzle(); return; }
    state = {
      puzzle: saved.puzzle.slice(), solution: saved.solution, regionOf: saved.regionOf,
      difficulty: saved.difficulty, given: new Set(saved.given),
      characterId: saved.characterId || DEFAULT_CHARACTER_ID,
      startTime: Date.now(), elapsedBeforePause: saved.elapsedBeforePause || 0,
      hintsUsed: saved.hintsUsed || 0, selectedCell: null, over: false,
    };
    selectedCharacterId = state.characterId; // la reprise réaffiche bien le même personnage
    sdk.navigation.go('sg');
    renderPalette();
    render();
    startTimer();
  }

  /** Recommence LE MÊME puzzle depuis le début (les cases "given" ne
   *  changent jamais, on repart de la solution pour les reconstruire
   *  et on vide le reste). */
  function restartSamePuzzle() {
    if (!state) return;
    const startPuzzle = state.solution.map((v, i) => state.given.has(i) ? v : 0);
    beginState({ puzzle: startPuzzle, solution: state.solution, regionOf: state.regionOf }, state.difficulty);
    renderPalette();
    render();
    startTimer();
  }

  function nextPuzzle() {
    document.getElementById('sresult').classList.add('hidden');
    startNewPuzzle();
  }
  function resultToHome() {
    document.getElementById('sresult').classList.add('hidden');
    goHome();
  }
  function replaySame() {
    document.getElementById('sresult').classList.add('hidden');
    restartSamePuzzle();
  }

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      const el = document.getElementById('gameTimer');
      if (el) el.textContent = formatTime(elapsedMs());
    }, 1000);
  }
  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
  function elapsedMs() { return state ? (Date.now() - state.startTime + state.elapsedBeforePause) : 0; }
  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }

  function selectCell(pos) {
    if (!state || state.over || state.given.has(pos)) return;
    state.selectedCell = pos;
    render();
  }

  function placeCat(value) {
    if (!state || state.over || state.selectedCell === null) return;
    const pos = state.selectedCell;
    if (state.given.has(pos)) return;
    state.puzzle[pos] = value;
    sdk.audio.play('click');
    persist();
    render();
    checkCompletion();
  }

  function eraseCell() {
    if (!state || state.over || state.selectedCell === null) return;
    if (state.given.has(state.selectedCell)) return;
    state.puzzle[state.selectedCell] = 0;
    persist();
    render();
  }

  function useHint() {
    if (!state || state.over) return;
    const empties = state.puzzle.map((v,i) => v === 0 ? i : -1).filter(i => i >= 0);
    if (!empties.length) return;
    const pos = empties[Math.floor(Math.random() * empties.length)];
    state.puzzle[pos] = state.solution[pos];
    state.hintsUsed++;
    sdk.audio.play('success');
    persist();
    render();
    checkCompletion();
  }

  function checkCompletion() {
    if (state.puzzle.some(v => v === 0)) return;
    // revalidation réelle des contraintes (pas seulement "identique à la
    // solution stockée") au cas où une autre solution valide existerait
    const isValid = state.puzzle.every((v, i) => {
      const savedVal = state.puzzle[i];
      state.puzzle[i] = 0;
      const ok = isValidPlacement(state.puzzle, state.regionOf, i, savedVal);
      state.puzzle[i] = savedVal;
      return ok;
    });
    if (!isValid) { sdk.toast.show('❌ Il y a une erreur quelque part'); sdk.audio.play('error'); return; }
    finishPuzzle();
  }

  function finishPuzzle() {
    state.over = true;
    stopTimer();
    const timeMs = elapsedMs();
    sdk.stats.increment('puzzlesSolved');
    sdk.stats.setMin('bestTime_' + state.difficulty, Math.floor(timeMs/1000));
    winStreak++;
    sdk.achievements.unlock('first_win', 'Première Résolution', '🧩');
    if (state.hintsUsed === 0) sdk.achievements.unlock('no_hint', 'Sans Aide', '🎯');
    if (state.difficulty === 'expert') sdk.achievements.unlock('expert_win', 'Maître Mosaïque', '🏆');
    if (timeMs < 5*60*1000) sdk.achievements.unlock('speed_5min', 'Éclair', '⚡');
    if (winStreak >= 5) sdk.achievements.unlock('streak_5', '5 Puzzles d\u2019Affilée', '🔥');
    // achievement générique lié aux personnages (masque de bits — reste
    // un nombre, seul type accepté par StatsService)
    const charIdx = CHARACTERS.findIndex(c => c.id === state.characterId);
    if (charIdx >= 0) {
      const mask = sdk.stats.get('charactersPlayedMask', 0) | (1 << charIdx);
      sdk.stats.set('charactersPlayedMask', mask);
      const distinctCount = mask.toString(2).split('1').length - 1;
      if (distinctCount >= 3) sdk.achievements.unlock('multi_species', 'Multi-Espèces', '🐾');
    }
    sdk.audio.play('win');
    sdk.save.clear();

    document.getElementById('resultTime').textContent = formatTime(timeMs);
    document.getElementById('resultHints').textContent = state.hintsUsed;
    document.getElementById('resultDiff').textContent = state.difficulty;
    render();
    document.getElementById('sresult').classList.remove('hidden');
  }

  function render() {
    if (!state) return;
    const grid = document.getElementById('puzzleGrid');
    grid.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const pos = r * SIZE + c;
        const el = document.createElement('div');
        const region = state.regionOf[pos];
        el.className = 'pc-cell';
        el.style.background = REGION_TINTS[region];
        if (state.given.has(pos)) el.classList.add('given');
        if (state.selectedCell === pos) el.classList.add('selected');
        // bordures épaisses entre régions différentes (dérivées de la même
        // donnée regionOf que la logique — une seule source de vérité)
        const rightPos = c < 7 ? r*SIZE+c+1 : -1;
        const downPos = r < 7 ? (r+1)*SIZE+c : -1;
        if (rightPos === -1 || state.regionOf[rightPos] !== region) el.style.borderRight = '2.5px solid var(--text)';
        if (downPos === -1 || state.regionOf[downPos] !== region) el.style.borderBottom = '2.5px solid var(--text)';
        if (c === 0) el.style.borderLeft = '2.5px solid var(--text)';
        if (r === 0) el.style.borderTop = '2.5px solid var(--text)';

        const val = state.puzzle[pos];
        if (val) {
          const char = getCharacter(state.characterId);
          el.innerHTML = `<span class="pc-token" style="background:${VALUE_COLORS[val-1]};">${char.symbol}<b>${val}</b></span>`;
          const conflict = !isValidPlacementIgnoringSelf(state.puzzle, state.regionOf, pos, val);
          if (conflict) el.classList.add('conflict');
        }
        el.onclick = () => selectCell(pos);
        grid.appendChild(el);
      }
    }
    document.getElementById('gameTimer').textContent = formatTime(elapsedMs());
    document.getElementById('hintsUsedLabel').textContent = state.hintsUsed;
    document.getElementById('diffLabel').textContent = state.difficulty;
  }

  function isValidPlacementIgnoringSelf(puzzle, regionOf, pos, value) {
    const saved = puzzle[pos];
    puzzle[pos] = 0;
    const ok = isValidPlacement(puzzle, regionOf, pos, value);
    puzzle[pos] = saved;
    return ok;
  }

  function renderPalette() {
    const host = document.getElementById('catPalette');
    host.innerHTML = '';
    const char = getCharacter(state ? state.characterId : selectedCharacterId);
    VALUE_COLORS.forEach((color, i) => {
      const el = document.createElement('div');
      el.className = 'cat-btn';
      el.innerHTML = `<span class="pc-token" style="background:${color};">${char.symbol}<b>${i+1}</b></span>`;
      el.onclick = () => placeCat(i + 1);
      host.appendChild(el);
    });
    const eraseBtn = document.createElement('div');
    eraseBtn.className = 'cat-btn erase-btn';
    eraseBtn.textContent = '✖️';
    eraseBtn.onclick = () => eraseCell();
    host.appendChild(eraseBtn);
  }

  function renderHome() {
    const host = document.getElementById('homeStatsPuzzleMosaique');
    host.innerHTML = '';
    [{ v: sdk.stats.get('puzzlesSolved'), l: '🧩 Résolus' }, { v: sdk.stats.get('bestTime_normal') ? formatTime(sdk.stats.get('bestTime_normal')*1000) : '—', l: '⏱ Record Normal' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
    document.getElementById('resumeBtnPC').style.display = sdk.save.hasSave() ? '' : 'none';
    renderCharacterPicker();
  }

  function renderCharacterPicker() {
    const host = document.getElementById('characterPicker');
    if (!host) return;
    host.innerHTML = '';
    CHARACTERS.forEach((c) => {
      const el = document.createElement('div');
      el.className = 'char-card' + (c.id === selectedCharacterId ? ' sel' : '');
      el.innerHTML = `<div class="char-symbol">${c.symbol}</div><div class="char-name">${c.name}</div>`;
      el.onclick = () => selectCharacter(c.id);
      host.appendChild(el);
    });
  }

  function renderAchievements() {
    const list = document.getElementById('achListPC');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = sdk.achievements.isUnlocked(a.id);
      const el = document.createElement('div');
      el.className = 'achCard' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `<div class="ic">${a.icon}</div><div><div class="name">${a.name}</div><div class="desc">${a.desc}</div></div>`;
      list.appendChild(el);
    });
  }
  function showStats() { renderAchievements(); sdk.navigation.go('sstats'); }

  /** Écran de règles — formulé pour un joueur qui ne connaît PAS déjà
   *  le concept de Sudoku irrégulier. Décrit le fonctionnement RÉEL du
   *  jeu (triple contrainte ligne/colonne/région, badges colorés),
   *  pas une explication générique de Sudoku classique. */
  function showRules() {
    const body = document.createElement('div');
    body.innerHTML = `
      <p><b>🎯 Objectif</b><br>
      Remplis toute la grille de symboles, sans jamais qu'un même symbole apparaisse deux fois dans une même ligne, une même colonne, ou une même région.</p>
      <p><b>🐾 Comment jouer</b><br>
      1. Touche une case vide pour la sélectionner (elle s'entoure de bleu).<br>
      2. Touche un des 8 symboles en bas de l'écran pour le placer dedans.</p>
      <p><b>📋 Règles importantes</b><br>
      • Un symbole (repéré par sa couleur ET son numéro) ne peut apparaître qu'une seule fois par ligne.<br>
      • Une seule fois par colonne.<br>
      • Une seule fois par région — la zone délimitée par un contour blanc épais, de forme libre (pas forcément un carré).<br>
      • Une case qui devient rouge signale qu'elle enfreint une de ces trois règles.</p>
      <p><b>🏆 Victoire</b><br>
      La grille est entièrement remplie, sans aucune case en erreur.</p>
      <p style="color:var(--text2);font-size:12px;">💡 Un indice ne résout pas le puzzle à ta place — il révèle juste une case au hasard si tu es bloqué.</p>
    `;
    const closeBtn = UI.button('Compris !', { variant: 'primary', onClick: () => modal.close() });
    const modal = UI.modal({ title: '🐱 Comment jouer au Meowdoku ?', bodyEl: body, actions: [closeBtn] });
    document.body.appendChild(modal.el);
  }

  async function confirmQuit() {
    if (state && !state.over) {
      const ok = await sdk.dialog.confirm('Quitter le puzzle ?', 'Ta progression est sauvegardée automatiquement.', 'Quitter', 'Annuler');
      if (!ok) return;
    }
    goHome();
  }

  function init() {
    loadPreferredCharacter();
    renderHome();
    renderPalette();
    selectDifficulty('normal');
  }

  return {
    init, goHome, selectDifficulty, selectCharacter, startNewPuzzle, resumePuzzle, nextPuzzle, resultToHome, replaySame,
    useHint, confirmQuit, showStats, showRules,
  };
}
