// ═══════════════════════════════════════════════════════════════
// games/checkers/ui.js
// ═══════════════════════════════════════════════════════════════
import { SIZE, squareToRC, rcToSquare, createBoard, legalMoves, applyMove, countPieces, hasAnyMove, ACHIEVEMENTS } from './logic.js';
import { chooseAIMove } from './ai.js';

export function createUI(sdk) {
  let board, turn, over, winner, difficulty = 'normal', selected = null, legalForSelected = [];

  function setDifficulty(d) {
    difficulty = d;
    ['Easy', 'Normal', 'Hard'].forEach((k) => document.getElementById('diff' + k)?.classList.toggle('sel', k.toLowerCase() === d || (k === 'Hard' && d === 'difficile')));
  }

  function startGame() {
    board = createBoard();
    turn = 'W'; over = false; winner = null; selected = null; legalForSelected = [];
    sdk.navigation.go('sg');
    render();
  }

  function onSquareClick(sq) {
    if (over || turn !== 'W') return;
    const moves = legalMoves(board, 'W');
    if (selected === null) {
      const forThis = moves.filter((m) => m.from === sq);
      if (forThis.length) { selected = sq; legalForSelected = forThis; render(); }
      return;
    }
    const chosen = legalForSelected.find((m) => m.to === sq);
    if (chosen) { playMove(chosen); return; }
    const forThis = moves.filter((m) => m.from === sq);
    if (forThis.length) { selected = sq; legalForSelected = forThis; render(); }
    else { selected = null; legalForSelected = []; render(); }
  }

  function playMove(move) {
    const wasKing = board[move.from].king;
    board = applyMove(board, move);
    selected = null; legalForSelected = [];
    sdk.audio.play(move.captures.length ? 'success' : 'click');
    if (move.captures.length >= 3) sdk.achievements.unlock('multi_capture', 'Rafle', '💥');
    if (!wasKing && board[move.to].king) { sdk.audio.play('win'); sdk.achievements.unlock('first_king', 'Promotion', '👑'); }
    turn = turn === 'W' ? 'B' : 'W';
    checkGameOver();
    render();
    if (!over) maybeAiTurn();
  }

  function checkGameOver() {
    if (countPieces(board, 'W') === 0) { over = true; winner = 'B'; }
    else if (countPieces(board, 'B') === 0) { over = true; winner = 'W'; }
    else if (!hasAnyMove(board, turn)) { over = true; winner = turn === 'W' ? 'B' : 'W'; }
    if (over) finishGame();
  }

  function finishGame() {
    sdk.stats.increment('games');
    if (winner === 'W') {
      sdk.stats.increment('wins');
      sdk.achievements.unlock('first_win', 'Première Victoire', '🎯');
      if (difficulty === 'difficile') sdk.achievements.unlock('beat_hard', 'Champion', '⭐');
      sdk.audio.play('win');
    } else {
      sdk.stats.increment('losses');
      sdk.audio.play('lose');
    }
  }

  function maybeAiTurn() {
    if (over || turn !== 'B') return;
    setTimeout(() => {
      const move = chooseAIMove(board, 'B', difficulty);
      if (move) playMove(move);
    }, 500);
  }

  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  function render() {
    const host = document.getElementById('checkersBoard');
    host.innerHTML = '';
    const legalTargets = new Set(legalForSelected.map((m) => m.to));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const dark = (r + c) % 2 === 1;
        const el = document.createElement('div');
        el.className = 'ccell' + (dark ? ' dark' : ' light');
        if (dark) {
          const sq = rcToSquare(r, c);
          if (sq === selected) el.classList.add('selected');
          if (legalTargets.has(sq)) el.classList.add('target');
          const piece = board[sq];
          if (piece) {
            const p = document.createElement('div');
            p.className = 'cpiece ' + (piece.color === 'W' ? 'white' : 'black') + (piece.king ? ' king' : '');
            if (piece.king) p.textContent = '♛';
            el.appendChild(p);
          }
          el.onclick = () => onSquareClick(sq);
        }
        host.appendChild(el);
      }
    }
    document.getElementById('checkersTurn').textContent = over ? (winner === 'W' ? '🏆 Tu as gagné !' : '🤖 Défaite...') : (turn === 'W' ? 'À toi de jouer' : "L'IA réfléchit…");
    document.getElementById('checkersCountW').textContent = countPieces(board, 'W');
    document.getElementById('checkersCountB').textContent = countPieces(board, 'B');
  }

  function renderHome() {
    const host = document.getElementById('homeStatsCheckers');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('wins'), l: '🏆 Victoires' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListCheckers');
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

  return { setDifficulty, startGame, goHome, showStats, renderHome };
}
