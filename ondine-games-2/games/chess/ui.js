// ═══════════════════════════════════════════════════════════════
// games/chess/ui.js
// ═══════════════════════════════════════════════════════════════
import { createGame, legalMoves, makeMove, isInCheck, findKing, ACHIEVEMENTS } from './logic.js';
import { chooseAIMove } from './ai.js';

const PIECE_GLYPH = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};

export function createUI(sdk) {
  let state, mode = 'solo', difficulty = 'normal', selected = null, legalForSelected = [];

  function setMode(m) {
    mode = m;
    document.getElementById('modeSolo')?.classList.toggle('sel', m === 'solo');
    document.getElementById('modeLocal')?.classList.toggle('sel', m === 'local');
    document.getElementById('diffGrid').style.display = m === 'solo' ? '' : 'none';
  }
  function setDifficulty(d) {
    difficulty = d;
    ['Easy', 'Normal', 'Hard'].forEach((k) => document.getElementById('diff' + k)?.classList.toggle('sel', k.toLowerCase() === d || (k === 'Hard' && d === 'difficile')));
  }

  function startGame() {
    state = createGame();
    selected = null; legalForSelected = [];
    sdk.navigation.go('sg');
    render();
  }

  function isHumanTurn() { return mode === 'local' || state.turn === 'w'; }

  function onSquareClick(sq) {
    if (state.over || !isHumanTurn()) return;
    const piece = state.board[sq];
    if (selected === null) {
      if (piece && piece.color === state.turn) {
        const moves = legalMoves(state, state.turn).filter((m) => m.from === sq);
        if (moves.length) { selected = sq; legalForSelected = moves; render(); }
      }
      return;
    }
    const chosen = legalForSelected.find((m) => m.to === sq);
    if (chosen) { playMove(chosen); return; }
    if (piece && piece.color === state.turn) {
      const moves = legalMoves(state, state.turn).filter((m) => m.from === sq);
      if (moves.length) { selected = sq; legalForSelected = moves; render(); return; }
    }
    selected = null; legalForSelected = []; render();
  }

  function playMove(move) {
    const wasCastle = !!move.castle, wasPromo = !!move.promotion;
    state = makeMove(state, move);
    selected = null; legalForSelected = [];
    sdk.audio.play(move.capture ? 'success' : 'click');
    if (wasCastle) sdk.achievements.unlock('castle', 'À l\u2019Abri', '🏰');
    if (wasPromo) sdk.achievements.unlock('promotion', 'Promotion', '👑');
    if (state.over) { finishGame(); render(); return; }
    render();
    maybeAiTurn();
  }

  function finishGame() {
    sdk.stats.increment('games');
    if (state.result === 'draw_stalemate') { sdk.stats.increment('draws'); sdk.audio.play('click'); return; }
    const humanWon = mode !== 'solo' || (state.result === 'white_wins');
    if (humanWon) {
      sdk.stats.increment('wins');
      sdk.achievements.unlock('first_win', 'Première Victoire', '🎯');
      if (difficulty === 'difficile') sdk.achievements.unlock('beat_hard', 'Grand Maître', '⭐');
      sdk.audio.play('win');
    } else {
      sdk.stats.increment('losses');
      sdk.audio.play('lose');
    }
  }

  function maybeAiTurn() {
    if (state.over || mode !== 'solo' || state.turn !== 'b') return;
    setTimeout(() => {
      const move = chooseAIMove(state, difficulty);
      if (move) playMove(move);
    }, 500);
  }

  async function confirmNewGame() {
    if (state && !state.over) {
      const ok = await sdk.dialog.confirm('Nouvelle partie ?', 'La partie en cours sera perdue.', 'Nouvelle partie', 'Annuler');
      if (!ok) return;
    }
    startGame();
  }
  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  function render() {
    const host = document.getElementById('chessBoard');
    host.innerHTML = '';
    const legalTargets = new Set(legalForSelected.map((m) => m.to));
    const whiteKingSq = findKing(state.board, 'w');
    const blackKingSq = findKing(state.board, 'b');
    const whiteInCheck = isInCheck(state.board, 'w');
    const blackInCheck = isInCheck(state.board, 'b');

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = r * 8 + c;
        const dark = (r + c) % 2 === 1;
        const el = document.createElement('div');
        el.className = 'chesscell ' + (dark ? 'dark' : 'light');
        if (sq === selected) el.classList.add('selected');
        if (legalTargets.has(sq)) el.classList.add('target');
        if ((sq === whiteKingSq && whiteInCheck) || (sq === blackKingSq && blackInCheck)) el.classList.add('check');
        const piece = state.board[sq];
        if (piece) el.textContent = PIECE_GLYPH[piece.color][piece.type];
        el.onclick = () => onSquareClick(sq);
        host.appendChild(el);
      }
    }
    const statusEl = document.getElementById('chessStatus');
    if (state.over) {
      statusEl.textContent = state.result === 'draw_stalemate' ? '🤝 Pat — match nul' : (state.result === 'white_wins' ? '🏆 Mat — Blancs gagnent !' : '🏆 Mat — Noirs gagnent !');
    } else {
      const checkTxt = isInCheck(state.board, state.turn) ? ' — Échec !' : '';
      statusEl.textContent = (state.turn === 'w' ? 'Aux Blancs de jouer' : 'Aux Noirs de jouer') + checkTxt;
    }
  }

  function renderHome() {
    const host = document.getElementById('homeStatsChess');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('wins'), l: '🏆 Victoires' }, { v: sdk.stats.get('draws'), l: '🤝 Nulles' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListChess');
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

  return { setMode, setDifficulty, startGame, confirmNewGame, goHome, showStats, renderHome };
}
