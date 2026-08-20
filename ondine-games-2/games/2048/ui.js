// ═══════════════════════════════════════════════════════════════
// games/2048/ui.js
// ═══════════════════════════════════════════════════════════════
import { SIZE, emptyGrid, spawnTile, move, hasAnyMove, hasReached, maxTile, ACHIEVEMENTS } from './logic.js';
import { createSnapshotStore } from '../../core/engines/SnapshotStore.js';

const TILE_COLORS = {
  2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b',
  128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e',
};
function tileColor(v) { return TILE_COLORS[v] || '#3c3a32'; }
function tileTextColor(v) { return v <= 4 ? '#5a4632' : '#f9f6f2'; }

export function createUI(sdk) {
  let grid = emptyGrid();
  let score = 0;
  let over = false;
  let won = false;
  let continuedAfterWin = false;
  let usedUndo = false;
  const history = createSnapshotStore(20);

  function startGame(resumed) {
    if (!resumed) {
      grid = emptyGrid();
      score = 0; over = false; won = false; continuedAfterWin = false; usedUndo = false;
      history.clear();
      spawnTile(grid); spawnTile(grid);
    }
    sdk.navigation.go('sg');
    render();
  }

  function resumeGame() {
    const saved = sdk.save.read();
    if (!saved) { startGame(false); return; }
    grid = saved.grid; score = saved.score; over = saved.over || false;
    won = saved.won || false; continuedAfterWin = saved.continuedAfterWin || false;
    startGame(true);
  }

  function persist() {
    sdk.save.write({ grid, score, over, won, continuedAfterWin });
  }

  function doMove(dir) {
    if (over) return;
    if (won && !continuedAfterWin) return; // attend le choix "continuer" ou "nouvelle partie"
    const result = move(grid, dir);
    if (!result.moved) return;
    history.push({ grid, score });
    grid = result.grid;
    score += result.gained;
    spawnTile(grid);
    sdk.stats.setMax('bestScore', score);
    if (result.gained > 0) sdk.audio.play('success'); else sdk.audio.play('click');

    if (!won && hasReached(grid, 2048)) {
      won = true;
      sdk.audio.play('win');
      sdk.achievements.unlock('reach_2048', '2048 !', '🏆');
      if (!usedUndo) sdk.achievements.unlock('no_undo_win', 'Sans Filet', '🎯');
    }
    if (hasReached(grid, 4096)) sdk.achievements.unlock('reach_4096', 'Au-delà', '🚀');

    if (!hasAnyMove(grid)) {
      over = true;
      sdk.stats.increment('games');
      sdk.stats.setMax('maxTileEver', maxTile(grid));
      sdk.achievements.unlock('first_game', 'Premier Pas', '🎯');
      if (sdk.stats.get('games') >= 20) sdk.achievements.unlock('veteran', 'Vétéran', '🏅');
      sdk.audio.play('lose');
    }
    persist();
    render();
  }

  function undo() {
    if (!history.canUndo() || over) return;
    const prev = history.pop();
    grid = prev.grid; score = prev.score;
    usedUndo = true;
    persist();
    render();
  }

  function continueAfterWin() {
    continuedAfterWin = true;
    persist();
    render();
  }

  function newGame() { startGame(false); persist(); }

  async function confirmNewGame() {
    if (!over && grid.some((v) => v !== 0)) {
      const ok = await sdk.dialog.confirm('Nouvelle partie ?', 'La partie en cours sera perdue.', 'Nouvelle partie', 'Annuler');
      if (!ok) return;
    }
    newGame();
  }

  function goHome() {
    persist();
    renderHome();
    sdk.navigation.go('sh');
  }

  // ── Rendu ──
  function render() {
    const host = document.getElementById('grid2048');
    host.innerHTML = '';
    grid.forEach((v) => {
      const el = document.createElement('div');
      el.className = 'tile2048' + (v ? ' filled' : '');
      if (v) {
        el.textContent = v;
        el.style.background = tileColor(v);
        el.style.color = tileTextColor(v);
        el.style.fontSize = v >= 1024 ? '20px' : v >= 128 ? '24px' : '28px';
      }
      host.appendChild(el);
    });
    document.getElementById('score2048').textContent = score;
    document.getElementById('best2048').textContent = sdk.stats.get('bestScore', 0);
    document.getElementById('undoBtn2048').disabled = !history.canUndo();

    const banner = document.getElementById('banner2048');
    if (over) { banner.textContent = '💀 Partie terminée'; banner.style.display = ''; }
    else if (won && !continuedAfterWin) { banner.textContent = '🏆 2048 atteint !'; banner.style.display = ''; }
    else { banner.style.display = 'none'; }
    document.getElementById('continueBtn2048').style.display = (won && !continuedAfterWin) ? '' : 'none';
  }

  function renderHome() {
    const host = document.getElementById('homeStats2048');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('bestScore', 0), l: '🏆 Record' }, { v: sdk.stats.get('maxTileEver', 0), l: '🔝 Meilleure tuile' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
    document.getElementById('resumeBtn2048').style.display = sdk.save.hasSave() ? '' : 'none';
  }

  function renderAchievements() {
    const list = document.getElementById('achList2048');
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

  // ── Entrées : clavier + swipe tactile (mobile-first) ──
  function handleKey(e) {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) { e.preventDefault(); doMove(map[e.key]); }
  }
  let touchStartX = 0, touchStartY = 0;
  function handleTouchStart(e) { const t = e.touches[0]; touchStartX = t.clientX; touchStartY = t.clientY; }
  function handleTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return; // trop court, ignore
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
    else doMove(dy > 0 ? 'down' : 'up');
  }

  return {
    startGame: () => startGame(false), resumeGame, newGame, confirmNewGame, undo, continueAfterWin,
    goHome, showStats, renderHome, handleKey, handleTouchStart, handleTouchEnd,
  };
}
