// ═══════════════════════════════════════════════════════════════
// games/puzzle15/ui.js
// ═══════════════════════════════════════════════════════════════
import { SIZE, solvedGrid, isSolved, shuffledGrid, movableIndices, tryMove, ACHIEVEMENTS } from './logic.js';
import { createSnapshotStore } from '../../core/engines/SnapshotStore.js';

export function createUI(sdk) {
  let grid = solvedGrid();
  let moves = 0;
  let elapsed = 0;
  let timerInterval = null;
  let over = true;
  let usedUndo = false;
  const history = createSnapshotStore(200);

  function startGame() {
    grid = shuffledGrid();
    moves = 0; elapsed = 0; over = false; usedUndo = false;
    history.clear();
    sdk.save.write({ grid, moves, elapsed });
    sdk.navigation.go('sg');
    startTimer();
    render();
  }

  function resumeGame() {
    const saved = sdk.save.read();
    if (!saved) { startGame(); return; }
    grid = saved.grid; moves = saved.moves; elapsed = saved.elapsed; over = false; usedUndo = false;
    history.clear();
    sdk.navigation.go('sg');
    startTimer();
    render();
  }

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => { elapsed++; document.getElementById('timer15').textContent = `⏱ ${elapsed}s`; }, 1000);
  }
  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

  function onTileClick(idx) {
    if (over) return;
    const result = tryMove(grid, idx);
    if (!result.moved) return;
    history.push(grid);
    grid = result.grid;
    moves++;
    sdk.audio.play('click');
    sdk.save.write({ grid, moves, elapsed });
    render();
    if (isSolved(grid)) finishGame();
  }

  function finishGame() {
    over = true;
    stopTimer();
    sdk.audio.play('win');
    sdk.stats.increment('games');
    sdk.stats.increment('wins');
    sdk.stats.setMin('bestMoves', moves);
    sdk.stats.setMin('bestTime', elapsed);
    sdk.achievements.unlock('first_win', 'Première Victoire', '🎯');
    if (moves < 100) sdk.achievements.unlock('under_100', 'Efficace', '⚡');
    if (elapsed < 60) sdk.achievements.unlock('under_60s', 'Rapide', '⏱️');
    if (!usedUndo) sdk.achievements.unlock('no_undo', 'Sans Filet', '🎯');
    sdk.save.clear();
    render();
    document.getElementById('winBanner15').style.display = '';
  }

  function undo() {
    if (!history.canUndo() || over) return;
    grid = history.pop();
    moves++; // annuler compte comme un coup, pratique standard des taquins
    usedUndo = true;
    sdk.save.write({ grid, moves, elapsed });
    render();
  }

  async function confirmNewGame() {
    if (!over) {
      const ok = await sdk.dialog.confirm('Nouvelle partie ?', 'La partie en cours sera perdue.', 'Nouvelle partie', 'Annuler');
      if (!ok) return;
    }
    startGame();
  }

  function goHome() {
    stopTimer();
    if (!over) sdk.save.write({ grid, moves, elapsed });
    renderHome();
    sdk.navigation.go('sh');
  }

  function render() {
    const host = document.getElementById('grid15');
    host.innerHTML = '';
    const movable = movableIndices(grid);
    grid.forEach((v, i) => {
      const el = document.createElement('div');
      el.className = 'tile15' + (v === 0 ? ' empty' : '') + (movable.includes(i) ? ' movable' : '');
      if (v !== 0) el.textContent = v;
      el.onclick = () => onTileClick(i);
      host.appendChild(el);
    });
    document.getElementById('moves15').textContent = `${moves} coups`;
    document.getElementById('undoBtn15').disabled = !history.canUndo();
    document.getElementById('winBanner15').style.display = over && isSolved(grid) ? '' : 'none';
  }

  function renderHome() {
    const host = document.getElementById('homeStats15');
    host.innerHTML = '';
    [{ v: sdk.stats.get('wins'), l: '🏆 Résolus' }, { v: sdk.stats.get('bestMoves', '—'), l: '🔢 Meilleurs coups' }, { v: sdk.stats.get('bestTime', '—'), l: '⏱ Record' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
    document.getElementById('resumeBtn15').style.display = sdk.save.hasSave() ? '' : 'none';
  }

  function renderAchievements() {
    const list = document.getElementById('achList15');
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

  return { startGame, resumeGame, confirmNewGame, undo, goHome, showStats, renderHome };
}
