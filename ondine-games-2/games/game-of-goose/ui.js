// ═══════════════════════════════════════════════════════════════
// games/game-of-goose/ui.js
// ═══════════════════════════════════════════════════════════════
import { BOARD_SIZE, GEESE, BRIDGE, INN, WELL, LABYRINTH, DEATH, GOAL, createGame, playTurn, ACHIEVEMENTS } from './logic.js';

export function createUI(sdk) {
  let game = null;
  let playerCount = 2;
  let vsAI = false;

  function setPlayerCount(n) {
    playerCount = n;
    [2, 3, 4].forEach((n2) => document.getElementById('pcount' + n2)?.classList.toggle('sel', n2 === n));
  }
  function setVsAI(v) {
    vsAI = v;
    document.getElementById('vsAiBtn')?.classList.toggle('sel', v);
  }

  function startGame() {
    game = createGame(playerCount);
    sdk.navigation.go('sg');
    render();
  }

  function rollForCurrentPlayer() {
    if (!game || game.over) return;
    if (vsAI && game.current !== 0) return; // pas au joueur humain
    const gooseCountBefore = game.log.filter((l) => l.includes('Oie')).length;
    game = playTurn(game);
    const gooseCountAfter = game.log.filter((l) => l.includes('Oie')).length;
    if (gooseCountAfter - gooseCountBefore >= 3) sdk.achievements.unlock('goose_chain', 'Vol d\u2019Oies', '🦢');
    sdk.audio.play('click');
    render();
    if (game.over) { finishGame(); return; }
    maybeAiTurn();
  }

  function maybeAiTurn() {
    if (!game || game.over || !vsAI) return;
    if (game.current === 0) return;
    setTimeout(() => {
      game = playTurn(game);
      sdk.audio.play('click');
      render();
      if (game.over) { finishGame(); return; }
      maybeAiTurn();
    }, 600);
  }

  function finishGame() {
    sdk.stats.increment('games');
    const humanWon = !vsAI || game.winner === 0;
    if (humanWon) {
      sdk.stats.increment('wins');
      sdk.achievements.unlock('first_win', 'Première Arrivée', '🎯');
      const fellInWell = game.log.some((l) => l.includes('Puits') && l.startsWith('Joueur 1'));
      if (!fellInWell) sdk.achievements.unlock('no_well', 'Chemin Sûr', '🍀');
      sdk.audio.play('win');
    } else {
      sdk.audio.play('lose');
    }
    document.getElementById('gooseOverBanner').style.display = '';
  }

  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  function squareLabel(n) {
    if (n === BRIDGE) return '🌉';
    if (n === INN) return '🏠';
    if (n === WELL) return '🕳️';
    if (n === LABYRINTH) return '🌀';
    if (n === DEATH) return '💀';
    if (n === GOAL) return '🏁';
    if (GEESE.has(n)) return '🦢';
    return '';
  }

  function render() {
    const board = document.getElementById('gooseBoard');
    board.innerHTML = '';
    for (let n = 1; n <= BOARD_SIZE; n++) {
      const el = document.createElement('div');
      el.className = 'gsquare';
      const special = squareLabel(n);
      el.innerHTML = `<span class="gnum">${n}</span>${special ? `<span class="gspecial">${special}</span>` : ''}`;
      const here = game.positions.map((p, i) => (p === n ? i : -1)).filter((i) => i !== -1);
      here.forEach((i) => {
        const token = document.createElement('div');
        token.className = `gtoken p${i}`;
        el.appendChild(token);
      });
      board.appendChild(el);
    }
    document.getElementById('gooseTurn').textContent = game.over ? '' : `Au tour du Joueur ${game.current + 1}${vsAI && game.current !== 0 ? ' (IA)' : ''}`;
    document.getElementById('gooseLog').textContent = game.log.slice(-2).join(' ');
    document.getElementById('gooseOverBanner').textContent = game.over ? `🏆 Joueur ${game.winner + 1} gagne !` : '';
    document.getElementById('rollBtn').style.display = (!game.over && (!vsAI || game.current === 0)) ? '' : 'none';
  }

  function renderHome() {
    const host = document.getElementById('homeStatsGoose');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('wins'), l: '🏆 Victoires' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListGoose');
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

  return { setPlayerCount, setVsAI, startGame, rollForCurrentPlayer, goHome, showStats, renderHome };
}
