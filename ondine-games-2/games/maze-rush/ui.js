// ═══════════════════════════════════════════════════════════════
// games/maze-rush/ui.js
// ═══════════════════════════════════════════════════════════════
import { buildLevel, createGameState, tickGame, cellOf, ACHIEVEMENTS } from './logic.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacter } from '../../core/data/characters.js';

const TOTAL_LEVELS = 10;
const ENEMY_COLORS = { simple: '#f87171', patrol: '#fbbf24', hunter: '#c084fc' };
const BONUS_ICONS = { speed: '⚡', shield: '🛡️', multiplier: '⭐', magnet: '🧲' };

export function createUI(sdk) {
  let selectedCharacterId = DEFAULT_CHARACTER_ID;
  let selectedDifficulty = 'normal';
  let profile = null; // { unlockedLevel, bestScore, bestCombo }
  let state = null;
  let canvas, ctx;
  let rafId = null;
  let desiredDir = null;
  let keysDown = new Set();

  function loadPreferredCharacter() {
    const idx = sdk.stats.get('lastCharacterIdx', null);
    if (idx !== null && CHARACTERS[idx]) selectedCharacterId = CHARACTERS[idx].id;
  }
  function selectCharacter(id) {
    selectedCharacterId = id;
    const idx = CHARACTERS.findIndex(c => c.id === id);
    if (idx >= 0) sdk.stats.set('lastCharacterIdx', idx);
    renderCharacterPicker();
  }
  function selectDifficulty(d) {
    selectedDifficulty = d;
    document.querySelectorAll('.mz-diff-card').forEach(el => el.classList.toggle('sel', el.dataset.diff === d));
  }

  function loadProfile() {
    profile = sdk.save.read() || { unlockedLevel: 0, bestScore: 0, bestCombo: 0, totalCollected: 0 };
  }
  function saveProfile() { sdk.save.write(profile); }

  function goHome() { stopLoop(); renderHome(); sdk.navigation.go('sh'); }
  function goLevelSelect() { renderLevelSelect(); sdk.navigation.go('slevels'); }

  function startLevel(levelIndex) {
    const level = buildLevel(levelIndex, selectedDifficulty);
    state = createGameState(level, selectedCharacterId);
    desiredDir = null;
    sdk.navigation.go('sg');
    canvas = document.getElementById('mazeCanvas');
    ctx = canvas.getContext('2d');
    syncCanvasSize();
    startLoop();
  }

  function syncCanvasSize() {
    const displaySize = canvas.clientWidth || 420;
    canvas.width = displaySize; canvas.height = displaySize;
  }

  function startLoop() {
    stopLoop();
    function frame() {
      if (!state || state.over) return;
      state = tickGame(state, desiredDir);
      render();
      if (state.over) { onLevelEnd(); return; }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  function onLevelEnd() {
    render();
    if (state.won) {
      sdk.audio.play('win');
      profile.bestScore = Math.max(profile.bestScore, state.score);
      profile.bestCombo = Math.max(profile.bestCombo, state.maxCombo);
      profile.totalCollected = (profile.totalCollected || 0) + state.level.collectibles.length;
      profile.unlockedLevel = Math.max(profile.unlockedLevel, state.level.levelIndex + 1);
      saveProfile();
      sdk.stats.increment('levelsCompleted');
      sdk.achievements.unlock('first_level', 'Premiers Pas', '🐾');
      if (state.maxCombo >= 4) sdk.achievements.unlock('combo10', 'Combo Fou', '🔥');
      if (state.lives === 3) sdk.achievements.unlock('no_hit', 'Intouchable', '🛡️');
      if (profile.totalCollected >= 200) sdk.achievements.unlock('collector', 'Collectionneur', '💎');
      if (state.level.levelIndex + 1 >= TOTAL_LEVELS) {
        sdk.achievements.unlock('all_levels', 'Maître du Labyrinthe', '🏆');
        showFinalVictory();
      } else {
        showLevelComplete();
      }
    } else {
      sdk.audio.play('lose');
      profile.bestScore = Math.max(profile.bestScore, state.score);
      saveProfile();
      sdk.stats.increment('gamesOver');
      showGameOver();
    }
  }

  function showLevelComplete() {
    document.getElementById('lcScore').textContent = state.score;
    document.getElementById('lcCombo').textContent = state.maxCombo;
    document.getElementById('lcLevel').textContent = (state.level.levelIndex + 1) + ' / ' + TOTAL_LEVELS;
    document.getElementById('slevelcomplete').classList.remove('hidden');
  }
  function nextLevel() {
    document.getElementById('slevelcomplete').classList.add('hidden');
    startLevel(state.level.levelIndex + 1);
  }

  function showGameOver() {
    document.getElementById('goScore').textContent = state.score;
    document.getElementById('goBest').textContent = profile.bestScore;
    document.getElementById('goLevel').textContent = (state.level.levelIndex + 1) + ' / ' + TOTAL_LEVELS;
    document.getElementById('sgameover').classList.remove('hidden');
  }
  function retryLevel() {
    document.getElementById('sgameover').classList.add('hidden');
    startLevel(state.level.levelIndex);
  }
  function gameOverToLevels() {
    document.getElementById('sgameover').classList.add('hidden');
    goLevelSelect();
  }
  function gameOverToHome() {
    document.getElementById('sgameover').classList.add('hidden');
    goHome();
  }

  function showFinalVictory() {
    document.getElementById('fvScore').textContent = state.score;
    document.getElementById('sfinal').classList.remove('hidden');
  }
  function finalToHome() {
    document.getElementById('sfinal').classList.add('hidden');
    goHome();
  }
  function finalReplay() {
    document.getElementById('sfinal').classList.add('hidden');
    startLevel(0);
  }

  // ── Contrôles ──
  function setDesiredDir(d) { desiredDir = d; }
  function onKeyDown(e) {
    const map = { ArrowUp:'N', ArrowDown:'S', ArrowLeft:'W', ArrowRight:'E', w:'N', s:'S', a:'W', d:'E', W:'N', S:'S', A:'W', D:'E' };
    if (map[e.key]) { setDesiredDir(map[e.key]); e.preventDefault(); }
  }
  window.addEventListener('keydown', onKeyDown);

  // ── Rendu ──
  function render() {
    if (!state || !ctx) return;
    const maze = state.level.maze;
    const size = state.level.size;
    const W = canvas.width, H = canvas.height;
    const cellPx = W / size;
    ctx.fillStyle = '#0a0620';
    ctx.fillRect(0, 0, W, H);

    // murs
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = Math.max(2, cellPx * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = maze.cells[y*size+x];
        const px = x*cellPx, py = y*cellPx;
        if (cell.N) { ctx.moveTo(px, py); ctx.lineTo(px+cellPx, py); }
        if (cell.W) { ctx.moveTo(px, py); ctx.lineTo(px, py+cellPx); }
        if (y === size-1 && cell.S) { ctx.moveTo(px, py+cellPx); ctx.lineTo(px+cellPx, py+cellPx); }
        if (x === size-1 && cell.E) { ctx.moveTo(px+cellPx, py); ctx.lineTo(px+cellPx, py+cellPx); }
      }
    }
    ctx.stroke();

    // collectibles (cristaux originaux, pas des pastilles Pac-Man)
    ctx.fillStyle = '#38bdf8';
    state.collectiblesLeft.forEach((key) => {
      const [x,y] = key.split(',').map(Number);
      const cx = x*cellPx+cellPx/2, cy = y*cellPx+cellPx/2;
      const r = cellPx*0.12;
      ctx.beginPath();
      ctx.moveTo(cx, cy-r); ctx.lineTo(cx+r, cy); ctx.lineTo(cx, cy+r); ctx.lineTo(cx-r, cy);
      ctx.closePath(); ctx.fill();
    });

    // bonus au sol
    state.bonusesLeft.forEach((bonus, key) => {
      const [x,y] = key.split(',').map(Number);
      ctx.font = `${cellPx*0.5}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(BONUS_ICONS[bonus.type], x*cellPx+cellPx/2, y*cellPx+cellPx/2);
    });

    // ennemis
    state.enemies.forEach((e) => {
      const [ex, ey] = e.moveState.pos;
      ctx.fillStyle = ENEMY_COLORS[e.behavior] || '#f87171';
      ctx.beginPath();
      ctx.arc(ex*cellPx+cellPx/2, ey*cellPx+cellPx/2, cellPx*0.32, 0, Math.PI*2);
      ctx.fill();
    });

    // joueur (personnage choisi)
    const char = getCharacter(state.characterId);
    const [px, py] = state.player.pos;
    ctx.font = `${cellPx*0.7}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (state.activeBonuses.shield) {
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px*cellPx+cellPx/2, py*cellPx+cellPx/2, cellPx*0.42, 0, Math.PI*2); ctx.stroke();
    }
    ctx.fillText(char.symbol, px*cellPx+cellPx/2, py*cellPx+cellPx/2);

    // HUD
    document.getElementById('hudScore').textContent = state.score;
    document.getElementById('hudLevel').textContent = (state.level.levelIndex+1) + '/' + TOTAL_LEVELS;
    document.getElementById('hudLives').textContent = '❤️'.repeat(Math.max(0, state.lives));
    document.getElementById('hudCombo').textContent = state.combo > 1 ? `🔥 x${Math.min(4,1+Math.floor(state.combo/3))}` : '';
  }

  // ── Écrans statiques ──
  function renderHome() {
    document.getElementById('homeBestScore').textContent = profile.bestScore;
    document.getElementById('homeLevelUnlocked').textContent = profile.unlockedLevel + 1;
    renderCharacterPicker();
  }
  function renderCharacterPicker() {
    const host = document.getElementById('mzCharacterPicker');
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
  function renderLevelSelect() {
    const host = document.getElementById('levelGrid');
    host.innerHTML = '';
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const unlocked = i <= profile.unlockedLevel;
      const el = document.createElement('div');
      el.className = 'level-card' + (unlocked ? '' : ' locked');
      el.innerHTML = `<div class="lv-num">${i+1}</div>${unlocked ? '' : '<div class="lv-lock">🔒</div>'}`;
      if (unlocked) el.onclick = () => startLevel(i);
      host.appendChild(el);
    }
  }
  function renderAchievements() {
    const list = document.getElementById('achListMaze');
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

  function init() {
    loadPreferredCharacter();
    loadProfile();
    renderHome();
    selectDifficulty('normal');
    attachSwipeControls();
  }

  /** Glisser le doigt pour diriger, comme Snake — même seuil (20px) et
   *  même logique (direction dominante horizontale/verticale). Attaché
   *  UNE SEULE FOIS ici : #mazeCanvas est un élément DOM statique (jamais
   *  recréé entre les niveaux/Rejouer), donc pas de risque d'accumuler
   *  des écouteurs en double au fil des parties. */
  function attachSwipeControls() {
    const canvasEl = document.getElementById('mazeCanvas');
    let touchStartX = 0, touchStartY = 0;
    canvasEl.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      touchStartX = t.clientX; touchStartY = t.clientY;
    }, { passive: true });
    canvasEl.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // tap simple, pas un glissement
      if (Math.abs(dx) > Math.abs(dy)) setDesiredDir(dx > 0 ? 'E' : 'W');
      else setDesiredDir(dy > 0 ? 'S' : 'N');
    }, { passive: true });
  }

  return {
    init, goHome, goLevelSelect, selectCharacter, selectDifficulty, startLevel,
    setDesiredDir, nextLevel, retryLevel, gameOverToLevels, gameOverToHome,
    finalToHome, finalReplay, showStats,
  };
}
