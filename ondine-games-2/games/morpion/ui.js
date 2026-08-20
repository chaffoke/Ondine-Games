// ═══════════════════════════════════════════════════════════════
// games/morpion/ui.js
// ───────────────────────────────────────
// Rendu DOM + gestion d'écran. Importe logic.js pour les règles et
// le SDK pour la plateforme (stats/achievements/audio/toast/save/
// navigation) — ne contient AUCUNE règle de jeu elle-même.
// ═══════════════════════════════════════════════════════════════
import { checkWinner, isDraw, AI_STRATEGIES, ACHIEVEMENTS } from './logic.js';

// Sons IDENTIQUES à la version Batch 3 d'origine, valeur par valeur.
// Les presets génériques du CoreBundle (win/lose/unlock) existent
// mais ont des paramètres légèrement différents (durée/volume/pas de
// temps) — la consigne est de préserver le comportement EXACT du
// jeu, donc on repasse par sdk.audio.tone() avec les valeurs
// d'origine plutôt que d'accepter une petite dérive sonore.
function playSound(sdk, name) {
  const P = {
    place: () => sdk.audio.tone(500, 0.07, 'sine', 0.13),
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sdk.audio.tone(f, 0.2, 'sine', 0.16), i * 100)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => sdk.audio.tone(f, 0.2, 'sine', 0.12), i * 120)),
    draw: () => sdk.audio.tone(440, 0.15, 'triangle', 0.1),
    unlock: () => [660, 880, 1100].forEach((f, i) => setTimeout(() => sdk.audio.tone(f, 0.14, 'sine', 0.14), i * 80)),
  };
  (P[name] || (() => {}))();
}

export function createUI(sdk) {
  let CONFIG = { mode: 'solo', difficulty: 'easy' };
  let G = null;
  let roundScores = { X: 0, O: 0, draw: 0 };
  let currentStreak = 0;

  function setMode(m) {
    CONFIG.mode = m;
    document.getElementById('modeSolo').classList.toggle('sel', m === 'solo');
    document.getElementById('mode2p').classList.toggle('sel', m === '2p');
    document.getElementById('diffTitle').style.display = m === 'solo' ? '' : 'none';
    document.getElementById('diffGrid').style.display = m === 'solo' ? '' : 'none';
  }
  function setDiff(d) {
    CONFIG.difficulty = d;
    ['Easy', 'Normal', 'Impossible'].forEach((k) =>
      document.getElementById('diff' + k).classList.toggle('sel', k.toLowerCase() === d));
  }

  function startGame() {
    roundScores = { X: 0, O: 0, draw: 0 };
    G = { board: Array(9).fill(null), current: 'X', over: false, winner: null, winLine: null, oppEverThreatened: false };
    sdk.navigation.go('sg');
    renderAll();
    maybeAiTurn();
  }
  function nextRound() {
    if (!G) return;
    G = { board: Array(9).fill(null), current: 'X', over: false, winner: null, winLine: null, oppEverThreatened: false };
    renderAll();
    maybeAiTurn();
  }
  function goHome() { updateHomeStats(); sdk.navigation.go('sh'); }
  async function confirmLeaveGame() {
    if (G && !G.over && G.board.some((c) => c !== null)) {
      const ok = await sdk.dialog.confirm('Quitter la partie ?', 'La partie en cours sera perdue.', 'Quitter', 'Continuer');
      if (!ok) return;
    }
    goHome();
  }

  function playAt(i) {
    if (!G || G.over || G.board[i] !== null) return;
    if (CONFIG.mode === 'solo' && G.current === 'O') return;
    makeMove(i);
  }
  function makeMove(i) {
    G.board[i] = G.current;
    playSound(sdk, 'place'); vibrate(10);
    if (G.current === 'O') {
      for (const [a, b, c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) {
        const vals = [G.board[a], G.board[b], G.board[c]];
        const oCount = vals.filter((v) => v === 'O').length, emptyCount = vals.filter((v) => v === null).length;
        if (oCount === 2 && emptyCount === 1) { G.oppEverThreatened = true; break; }
      }
    }
    const win = checkWinner(G.board);
    if (win) { G.over = true; G.winner = win.winner; G.winLine = win.line; renderAll(); setTimeout(endRound, 400); return; }
    if (isDraw(G.board)) { G.over = true; G.winner = null; renderAll(); setTimeout(endRound, 400); return; }
    G.current = G.current === 'X' ? 'O' : 'X';
    renderAll();
    maybeAiTurn();
  }
  function maybeAiTurn() {
    if (!G || G.over) return;
    if (CONFIG.mode !== 'solo' || G.current !== 'O') return;
    setTimeout(() => {
      const move = AI_STRATEGIES[CONFIG.difficulty](G.board, 'O');
      if (move !== undefined) makeMove(move);
    }, 450);
  }

  function endRound() {
    if (G.winner) roundScores[G.winner]++; else roundScores.draw++;
    sdk.stats.increment('games');
    if (CONFIG.mode === 'solo') {
      if (G.winner === 'X') {
        sdk.stats.increment('wins'); currentStreak++;
        playSound(sdk, 'win'); vibrate([20, 40, 20]);
        sdk.achievements.unlock('first_win', 'Première Victoire', '🎯');
        if (!G.oppEverThreatened) sdk.achievements.unlock('perfect', 'Parfait', '✨');
        if (CONFIG.difficulty === 'impossible') sdk.achievements.unlock('beat_ai', "Battre l'IA", '💀');
        if (currentStreak >= 5) sdk.achievements.unlock('streak_5', 'Série de 5', '🔥');
        if (sdk.stats.get('wins') >= 10 && sdk.stats.get('losses', 0) === 0) sdk.achievements.unlock('invincible', 'Invincible', '🛡️');
      } else if (G.winner === 'O') {
        sdk.stats.increment('losses'); currentStreak = 0; playSound(sdk, 'lose');
      } else {
        // 'draw' (match nul) n'est pas un preset du CoreBundle (qui a
        // click/place/success/error/win/lose/flip/unlock, pas 'draw').
        // Son d'origine préservé exactement via tone() plutôt que de
        // forcer un preset approximatif — conforme à la consigne de
        // ne pas changer les règles/comportements pour "rentrer" dans
        // le SDK.
        sdk.stats.increment('draws'); playSound(sdk, 'draw');
      }
    } else {
      if (G.winner) playSound(sdk, 'win'); else playSound(sdk, 'draw');
    }
    showResult();
  }
  function showResult() {
    const badge = document.getElementById('turnBadge');
    if (G.winner) {
      badge.innerHTML = (CONFIG.mode === 'solo')
        ? (G.winner === 'X' ? '🏆 Tu as gagné !' : "🤖 L'IA gagne...")
        : `🏆 ${G.winner} gagne !`;
    } else {
      badge.textContent = '🤝 Match nul';
    }
  }

  function renderAll() { renderBoard(); renderHud(); }
  function renderHud() {
    if (!G.over) {
      const badge = document.getElementById('turnBadge');
      const aiThinking = CONFIG.mode === 'solo' && G.current === 'O';
      badge.textContent = aiThinking ? "L'IA réfléchit…" : (CONFIG.mode === 'solo' ? (G.current === 'X' ? 'À toi (❌)' : 'IA (⭕)') : `Tour de ${G.current}`);
    }
    document.getElementById('scoreRow').innerHTML = `
      <span class="score-x">❌ ${roundScores.X}</span>
      <span class="score-d">🤝 ${roundScores.draw}</span>
      <span class="score-o">⭕ ${roundScores.O}</span>`;
  }
  function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    G.board.forEach((mark, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell' + (mark ? ' filled ' + mark.toLowerCase() : '') + (G.winLine && G.winLine.includes(i) ? ' win' : '');
      if (mark) cell.innerHTML = `<span class="mark">${mark === 'X' ? '❌' : '⭕'}</span>`;
      cell.onclick = () => playAt(i);
      board.appendChild(cell);
    });
  }

  function updateHomeStats() {
    const host = document.getElementById('homeStats'); host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('wins'), l: '🏆 Victoires' }, { v: currentStreak, l: '🔥 Série' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderStatsScreen() {
    const grid = document.getElementById('statsGrid'); grid.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: 'Parties' }, { v: sdk.stats.get('wins'), l: 'Victoires' }, { v: sdk.stats.get('losses'), l: 'Défaites' }, { v: sdk.stats.get('draws'), l: 'Égalités' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; grid.appendChild(el); });
    const list = document.getElementById('achList'); list.innerHTML = '';
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = sdk.achievements.isUnlocked(a.id);
      const el = document.createElement('div'); el.className = 'achCard' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `<div class="ic">${a.icon}</div><div><div class="name">${a.name}</div><div class="desc">${a.desc}</div></div>`;
      list.appendChild(el);
    });
  }
  function showRules() {
    const overlay = document.getElementById('modalOverlay');
    overlay.innerHTML = `<div class="ondine-modal-box"><div class="ondine-modal-title">❌⭕ Règles</div>
      <div class="ondine-modal-body">Aligne 3 symboles horizontalement, verticalement ou en diagonale avant ton adversaire.<br><br>
      En difficulté <b>Impossible</b>, l'IA joue parfaitement (minimax) — elle ne perd jamais, au mieux tu obtiens un match nul.</div>
      <div class="ondine-modal-actions"><button class="ondine-btn ondine-btn-primary" id="mdClose">Compris !</button></div></div>`;
    overlay.classList.remove('hidden');
    document.getElementById('mdClose').onclick = () => overlay.classList.add('hidden');
  }
  function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

  function showScreen(id) {
    sdk.navigation.go(id);
    if (id === 'sstats') renderStatsScreen();
  }

  return {
    setMode, setDiff, startGame, nextRound, goHome, showScreen,
    confirmLeaveGame, showRules, updateHomeStats,
  };
}
