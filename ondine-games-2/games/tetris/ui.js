// ═══════════════════════════════════════════════════════════════
// games/tetris/ui.js
// ═══════════════════════════════════════════════════════════════
import {
  COLS, ROWS, PIECE_TYPES, createEmptyGrid, randomBag, spawnPiece, pieceCells,
  isValidPosition, move, rotate, hardDrop, lockPiece, clearLines, isGameOver,
  scoreForLines, levelForLines, speedForLevel, ACHIEVEMENTS,
} from './logic.js';

const PIECE_COLORS = { I: '#38bdf8', O: '#fbbf24', T: '#c084fc', S: '#34d399', Z: '#f87171', J: '#818cf8', L: '#fb923c' };

export function createUI(sdk) {
  let grid, current, bag, bagIdx, nextQueue, holdPiece, canHold;
  let score, linesTotal, level, over;
  let dropTimer = null;
  let softDropping = false;

  function refillBag() { bag = randomBag(); bagIdx = 0; }
  function drawFromBag() {
    if (bagIdx >= bag.length) refillBag();
    return bag[bagIdx++];
  }

  function startGame() {
    grid = createEmptyGrid();
    refillBag();
    nextQueue = [drawFromBag(), drawFromBag(), drawFromBag()];
    current = spawnPiece(drawFromBag());
    holdPiece = null; canHold = true;
    score = 0; linesTotal = 0; level = 1; over = false;
    sdk.navigation.go('sg');
    render();
    startDropTimer();
  }

  function startDropTimer() {
    stopDropTimer();
    dropTimer = setTimeout(tickDrop, softDropping ? 50 : speedForLevel(level));
  }
  function stopDropTimer() { if (dropTimer) { clearTimeout(dropTimer); dropTimer = null; } }

  function tickDrop() {
    if (over) return;
    const moved = move(grid, current, 0, 1);
    if (moved === current) {
      lockCurrentPiece();
    } else {
      current = moved;
      render();
      startDropTimer();
    }
  }

  function lockCurrentPiece() {
    grid = lockPiece(grid, current);
    const result = clearLines(grid);
    grid = result.grid;
    if (result.linesCleared > 0) {
      score += scoreForLines(result.linesCleared, level);
      linesTotal += result.linesCleared;
      const newLevel = levelForLines(linesTotal);
      if (newLevel > level) level = newLevel;
      sdk.audio.play(result.linesCleared === 4 ? 'win' : 'success');
      sdk.achievements.unlock('first_line', 'Première Ligne', '🎯');
      if (result.linesCleared === 4) sdk.achievements.unlock('tetris_clear', 'TETRIS !', '🏆');
      if (level >= 10) sdk.achievements.unlock('level_10', 'Niveau 10', '🔥');
    } else {
      sdk.audio.play('click');
    }
    canHold = true;
    spawnNext();
  }

  function spawnNext() {
    const type = nextQueue.shift();
    nextQueue.push(drawFromBag());
    current = spawnPiece(type);
    if (isGameOver(grid, current)) { finishGame(); return; }
    render();
    startDropTimer();
  }

  function finishGame() {
    over = true;
    stopDropTimer();
    sdk.stats.increment('games');
    sdk.stats.setMax('bestScore', score);
    sdk.stats.setMax('bestLines', linesTotal);
    sdk.stats.setMax('bestLevel', level);
    sdk.audio.play('lose');
    render();
    // audit visuel : le bandeau affichait juste "Game Over" sans score, à
    // peine lisible (14px) — le score final et le record doivent être mis
    // en avant directement dans le bandeau, pas seulement dans le header
    const bestScore = sdk.stats.get('bestScore', 0);
    document.getElementById('tetrisOverBanner').innerHTML =
      `💀 Game Over<div class="tetris-over-score">Score : ${score}</div>` +
      (bestScore > score ? `<div class="tetris-over-best">🏆 Record : ${bestScore}</div>` : `<div class="tetris-over-best">🎉 Nouveau record !</div>`);
    document.getElementById('tetrisOverBanner').style.display = '';
  }

  function onMove(dx) { if (over) return; current = move(grid, current, dx, 0); render(); }
  function onRotate() { if (over) return; current = rotate(grid, current); sdk.audio.play('click'); render(); }
  function onSoftDropStart() { softDropping = true; startDropTimer(); }
  function onSoftDropEnd() { softDropping = false; startDropTimer(); }
  function onHardDrop() {
    if (over) return;
    current = hardDrop(grid, current);
    sdk.audio.play('click');
    lockCurrentPiece();
    render();
  }
  function onHold() {
    if (over || !canHold) return;
    canHold = false;
    if (holdPiece === null) {
      holdPiece = current.type;
      spawnNext();
    } else {
      const swapped = holdPiece;
      holdPiece = current.type;
      current = spawnPiece(swapped);
      render();
    }
  }

  async function confirmNewGame() {
    if (!over) {
      const ok = await sdk.dialog.confirm('Nouvelle partie ?', 'La partie en cours sera perdue.', 'Nouvelle partie', 'Annuler');
      if (!ok) return;
    }
    startGame();
  }
  function goHome() { stopDropTimer(); renderHome(); sdk.navigation.go('sh'); }

  function ghostPiece() {
    return hardDrop(grid, current);
  }

  function render() {
    const host = document.getElementById('tetrisGrid');
    host.innerHTML = '';
    const ghost = ghostPiece();
    const ghostCells = new Set(pieceCells(ghost).map(([x, y]) => `${x},${y}`));
    const activeCells = new Set(pieceCells(current).map(([x, y]) => `${x},${y}`));
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const el = document.createElement('div');
        el.className = 'tcell';
        const key = `${x},${y}`;
        if (activeCells.has(key)) { el.style.background = PIECE_COLORS[current.type]; el.classList.add('filled'); }
        else if (grid[y][x]) { el.style.background = PIECE_COLORS[grid[y][x]]; el.classList.add('filled'); }
        else if (ghostCells.has(key)) { el.classList.add('ghost'); el.style.borderColor = PIECE_COLORS[current.type]; }
        host.appendChild(el);
      }
    }
    document.getElementById('tetrisScore').textContent = score;
    document.getElementById('tetrisLines').textContent = linesTotal;
    document.getElementById('tetrisLevel').textContent = level;
    renderMini('tetrisNext', nextQueue[0]);
    renderMini('tetrisHold', holdPiece);
  }
  function renderMini(hostId, type) {
    const host = document.getElementById(hostId);
    host.innerHTML = '';
    if (!type) return;
    const shape = { I: [[0,0],[1,0],[2,0],[3,0]], O: [[0,0],[1,0],[0,1],[1,1]], T: [[1,0],[0,1],[1,1],[2,1]], S: [[1,0],[2,0],[0,1],[1,1]], Z: [[0,0],[1,0],[1,1],[2,1]], J: [[0,0],[0,1],[1,1],[2,1]], L: [[2,0],[0,1],[1,1],[2,1]] }[type];
    const grid4 = document.createElement('div');
    grid4.className = 'mini-grid';
    const occupied = new Set(shape.map(([x, y]) => `${x},${y}`));
    for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) {
      const el = document.createElement('div');
      el.className = 'mini-cell';
      if (occupied.has(`${x},${y}`)) el.style.background = PIECE_COLORS[type];
      grid4.appendChild(el);
    }
    host.appendChild(grid4);
  }

  function renderHome() {
    const host = document.getElementById('homeStatsTetris');
    host.innerHTML = '';
    [{ v: sdk.stats.get('bestScore', 0), l: '🏆 Record' }, { v: sdk.stats.get('bestLines', 0), l: '📏 Lignes' }, { v: sdk.stats.get('bestLevel', 1), l: '🔥 Niveau' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListTetris');
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

  function handleKey(e) {
    const map = { ArrowLeft: () => onMove(-1), ArrowRight: () => onMove(1), ArrowUp: onRotate, ArrowDown: onSoftDropStart, ' ': onHardDrop, c: onHold, C: onHold };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  }
  function handleKeyUp(e) { if (e.key === 'ArrowDown') onSoftDropEnd(); }

  return {
    startGame, confirmNewGame, onMove, onRotate, onSoftDropStart, onSoftDropEnd, onHardDrop, onHold,
    goHome, showStats, renderHome, handleKey, handleKeyUp,
  };
}
