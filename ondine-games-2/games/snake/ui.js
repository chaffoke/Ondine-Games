// ═══════════════════════════════════════════════════════════════
// games/snake/ui.js
// ═══════════════════════════════════════════════════════════════
import { GRID, createGame, setDirection, tick, ACHIEVEMENTS } from './logic.js';

export function createUI(sdk) {
  let game = null;
  let tickInterval = null;

  function speedForScore(score) {
    return Math.max(70, 160 - score * 4);
  }

  function startGame() {
    game = createGame();
    sdk.navigation.go('sg');
    render();
    startLoop();
  }

  function startLoop() {
    stopLoop();
    scheduleNext();
  }
  function scheduleNext() {
    tickInterval = setTimeout(() => {
      game = tick(game);
      render();
      if (game.over) { finishGame(); return; }
      scheduleNext();
    }, speedForScore(game.score));
  }
  function stopLoop() { if (tickInterval) { clearTimeout(tickInterval); tickInterval = null; } }

  function finishGame() {
    stopLoop();
    sdk.stats.increment('games');
    sdk.stats.setMax('bestScore', game.score);
    sdk.stats.setMax('maxLength', game.snake.length);
    sdk.audio.play('lose');
    sdk.achievements.unlock('first_apple', 'Première Pomme', '🍎');
    if (game.score >= 10) sdk.achievements.unlock('ten_apples', '10 Pommes', '🍏');
    if (game.snake.length >= 20) sdk.achievements.unlock('long_snake', 'Serpent Géant', '🐍');
    document.getElementById('snakeOverBanner').style.display = '';
  }

  function handleDirection(dir) {
    if (!game || game.over) return;
    const before = game.pendingDirection;
    game = setDirection(game, dir);
    if (game.pendingDirection !== before) sdk.audio.play('click');
  }
  function handleKey(e) {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.key]) { e.preventDefault(); handleDirection(map[e.key]); }
  }
  let touchStartX = 0, touchStartY = 0;
  function handleTouchStart(e) { const t = e.touches[0]; touchStartX = t.clientX; touchStartY = t.clientY; }
  function handleTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) handleDirection(dx > 0 ? 'right' : 'left');
    else handleDirection(dy > 0 ? 'down' : 'up');
  }

  async function confirmNewGame() {
    if (game && !game.over) {
      const ok = await sdk.dialog.confirm('Nouvelle partie ?', 'La partie en cours sera perdue.', 'Nouvelle partie', 'Annuler');
      if (!ok) return;
    }
    startGame();
  }

  function goHome() {
    stopLoop();
    renderHome();
    sdk.navigation.go('sh');
  }

  function render() {
    const host = document.getElementById('snakeGrid');
    host.innerHTML = '';
    const snakeSet = new Set(game.snake.map((s) => `${s.x},${s.y}`));
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const el = document.createElement('div');
        const isHead = game.snake[0].x === x && game.snake[0].y === y;
        const isBody = !isHead && snakeSet.has(`${x},${y}`);
        const isFood = game.food && game.food.x === x && game.food.y === y;
        el.className = 'scell' + (isHead ? ' head' : '') + (isBody ? ' body' : '') + (isFood ? ' food' : '');
        host.appendChild(el);
      }
    }
    document.getElementById('snakeScore').textContent = `🍎 ${game.score}`;
    document.getElementById('snakeBest').textContent = `🏆 ${sdk.stats.get('bestScore', 0)}`;
  }

  function renderHome() {
    const host = document.getElementById('homeStatsSnake');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('bestScore', 0), l: '🏆 Record' }, { v: sdk.stats.get('maxLength', 3), l: '🐍 Max' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListSnake');
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

  return { startGame, confirmNewGame, handleDirection, handleKey, handleTouchStart, handleTouchEnd, goHome, showStats, renderHome };
}
