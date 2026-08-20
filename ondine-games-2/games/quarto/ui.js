// ═══════════════════════════════════════════════════════════════
// games/quarto/ui.js
// ═══════════════════════════════════════════════════════════════
import { createGame, checkWin, isDraw, placeAndGive, ACHIEVEMENTS } from './logic.js';
import { aiChoosePlacement, aiChooseNextPiece } from './ai.js';

export function createUI(sdk) {
  let CONFIG = { mode: 'solo', difficulty: 'normal' };
  let state = null;
  let stage = 'place'; // 'place' (le joueur courant place pieceToPlace) | 'give' (il choisit la pièce suivante)
  let pendingCellIdx = null; // case où la pièce vient d'être posée, en attente du choix de la pièce suivante
  let usedHint = false;

  function setMode(m) {
    CONFIG.mode = m;
    document.getElementById('modeSolo').classList.toggle('sel', m === 'solo');
    document.getElementById('modeLocal').classList.toggle('sel', m === 'local');
    document.getElementById('diffTitle').style.display = m === 'solo' ? '' : 'none';
    document.getElementById('diffGrid').style.display = m === 'solo' ? '' : 'none';
  }
  function setDiff(d) {
    CONFIG.difficulty = d;
    ['Easy', 'Normal', 'Hard'].forEach((k) => document.getElementById('diff' + k).classList.toggle('sel', (k === 'Hard' ? 'difficile' : k.toLowerCase()) === d));
  }

  function startGame() {
    state = createGame();
    // amorce : le joueur 0 reçoit arbitrairement la première pièce (0) à placer — règle
    // simplifiée standard pour démarrer (au vrai Quarto, le 1er choix est symbolique).
    state.pieceToPlace = 0;
    state.availablePieces = state.availablePieces.filter((p) => p !== 0);
    stage = 'place';
    usedHint = false;
    sdk.navigation.go('sg');
    render();
    maybeAiTurn();
  }

  function isHumanTurn() { return CONFIG.mode === 'local' || state.current === 0; }

  function onCellClick(cellIdx) {
    if (!state || state.over || stage !== 'place' || !isHumanTurn()) return;
    if (state.board[cellIdx] !== null) return;
    const trial = state.board.slice(); trial[cellIdx] = state.pieceToPlace;
    const win = checkWin(trial);
    const draw = !win && trial.every((c) => c !== null);
    sdk.audio.play('click');
    if (win || draw) {
      state = placeAndGive(state, cellIdx, null);
      finishIfOver();
      render();
      return;
    }
    pendingCellIdx = cellIdx;
    stage = 'give';
    render();
  }

  function onPieceClick(piece) {
    if (!state || state.over) return;
    if (stage === 'give' && isHumanTurn()) {
      if (!state.availablePieces.filter((p) => p !== state.pieceToPlace).includes(piece)) return;
      state = placeAndGive(state, pendingCellIdx, piece);
      pendingCellIdx = null;
      stage = 'place';
      sdk.audio.play('click');
      render();
      maybeAiTurn();
    }
  }

  function finishIfOver() {
    if (!state.over) return;
    sdk.stats.increment('games');
    if (state.winner === 'draw') {
      sdk.stats.increment('draws');
      sdk.audio.play('lose');
    } else if (CONFIG.mode === 'solo') {
      if (state.winner === 0) {
        sdk.stats.increment('wins');
        sdk.audio.play('win');
        sdk.achievements.unlock('first_win', 'Première Victoire', '🎯');
        if (CONFIG.difficulty === 'difficile') sdk.achievements.unlock('beat_hard', 'Stratège', '⭐');
        if (!usedHint) sdk.achievements.unlock('no_help', 'Sans Indice', '🧠');
        const diagonalLines = [[0, 5, 10, 15], [3, 6, 9, 12]];
        if (state.winLine && diagonalLines.some((d) => JSON.stringify(d) === JSON.stringify(state.winLine))) {
          sdk.achievements.unlock('diagonal_win', 'En Diagonale', '↗️');
        }
      } else {
        sdk.stats.increment('losses');
        sdk.audio.play('lose');
      }
    } else {
      sdk.audio.play('win');
    }
  }

  function maybeAiTurn() {
    if (!state || state.over) return;
    if (CONFIG.mode !== 'solo' || state.current !== 1) return;
    setTimeout(() => {
      const cellIdx = aiChoosePlacement(state.board, state.pieceToPlace, CONFIG.difficulty);
      const trial = state.board.slice(); trial[cellIdx] = state.pieceToPlace;
      const win = checkWin(trial);
      const draw = !win && trial.every((c) => c !== null);
      if (win || draw) {
        state = placeAndGive(state, cellIdx, null);
        finishIfOver();
        render();
        return;
      }
      // même mécanisme d'aperçu que côté humain (voir render()) : la
      // pièce doit apparaître immédiatement, avant même le choix de
      // la pièce suivante par l'IA.
      pendingCellIdx = cellIdx;
      stage = 'give';
      render();
      setTimeout(() => {
        const remaining = state.availablePieces.filter((p) => p !== state.pieceToPlace);
        const nextPiece = aiChooseNextPiece(trial, remaining, CONFIG.difficulty);
        state = placeAndGive(state, cellIdx, nextPiece);
        pendingCellIdx = null;
        stage = 'place';
        render();
      }, 500);
    }, 500);
  }

  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  function render() {
    const board = document.getElementById('quartoBoard');
    board.innerHTML = '';
    // Pendant l'étape 'give' (pièce déjà placée par le joueur mais pas
    // encore actée dans `state`, en attente du choix de la pièce
    // suivante), affiche un plateau "d'aperçu" incluant ce placement —
    // sinon la pièce semble disparaître entre les deux étapes.
    const displayBoard = (stage === 'give' && pendingCellIdx !== null)
      ? state.board.map((v, i) => (i === pendingCellIdx ? state.pieceToPlace : v))
      : state.board;
    displayBoard.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'qcell' + (p !== null ? ' filled' : '') + (state.winLine && state.winLine.includes(i) ? ' win' : '');
      if (p !== null) el.textContent = pieceGlyph(p);
      el.onclick = () => onCellClick(i);
      board.appendChild(el);
    });

    const tray = document.getElementById('pieceTray');
    tray.innerHTML = '';
    state.availablePieces.filter((p) => p !== state.pieceToPlace).forEach((p) => {
      const el = document.createElement('div');
      el.className = 'qpiece' + (stage === 'give' ? ' selectable' : '');
      el.textContent = pieceGlyph(p);
      el.onclick = () => onPieceClick(p);
      tray.appendChild(el);
    });

    const status = document.getElementById('quartoStatus');
    if (state.over) {
      status.textContent = state.winner === 'draw' ? '🤝 Match nul !' : (CONFIG.mode === 'solo' ? (state.winner === 0 ? '🏆 Tu as gagné !' : "🤖 L'IA gagne...") : `🏆 Joueur ${state.winner + 1} gagne !`);
    } else if (stage === 'place') {
      status.textContent = isHumanTurn() ? `Place cette pièce : ${pieceGlyph(state.pieceToPlace)}` : "L'IA place…";
    } else {
      status.textContent = isHumanTurn() ? 'Choisis la pièce à donner' : "L'IA choisit…";
    }
  }

  function pieceGlyph(p) {
    const color = (p & 1) ? '🟫' : '⬜';
    const shape = (p & 4) ? '■' : '●';
    const size = (p & 2) ? 'L' : 'S';
    const fill = (p & 8) ? '' : '˚';
    return `${color}${shape}${fill}${size}`;
  }

  function renderHome() {
    const host = document.getElementById('homeStatsQuarto');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('wins'), l: '🏆 Victoires' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListQuarto');
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

  return { setMode, setDiff, startGame, goHome, showStats, renderHome };
}
