// ═══════════════════════════════════════════════════════════════
// games/simon/ui.js
// ═══════════════════════════════════════════════════════════════
import { COLORS, createGame, growSequence, pressColor, ACHIEVEMENTS } from './logic.js';

const FREQ = { green: 392, red: 330, yellow: 440, blue: 523.25 };

export function createUI(sdk) {
  let game = createGame();
  let mode = 'classic';

  function setMode(m) {
    mode = m;
    ['Classic', 'Speed', 'Hard'].forEach((k) => document.getElementById('mode' + k)?.classList.toggle('sel', k.toLowerCase() === m || (k === 'Classic' && m === 'classic')));
  }

  function startGame() {
    game = createGame();
    sdk.navigation.go('sg');
    nextRound();
  }

  function nextRound() {
    game = growSequence(game);
    render();
    playSequence();
  }

  function speedForLevel() {
    const base = mode === 'speed' ? 380 : mode === 'hard' ? 420 : 550;
    return Math.max(180, base - game.level * 8);
  }

  function playSequence() {
    game = { ...game, showingSequence: true };
    render();
    const delay = speedForLevel();
    game.sequence.forEach((color, i) => {
      setTimeout(() => flashButton(color), i * delay);
    });
    setTimeout(() => { game = { ...game, showingSequence: false }; render(); }, game.sequence.length * delay);
  }

  function flashButton(color) {
    const el = document.getElementById('simonBtn_' + color);
    if (!el) return;
    el.classList.add('lit');
    sdk.audio.tone(FREQ[color], 0.28, 'sine', 0.15);
    setTimeout(() => el.classList.remove('lit'), speedForLevel() * 0.6);
  }

  function onPress(color) {
    const { game: newGame, result } = pressColor(game, color);
    game = newGame;
    if (result === 'ignored') return;
    flashButton(color);
    if (result === 'wrong') {
      sdk.audio.play('error');
      finishGame();
      return;
    }
    if (result === 'sequence_complete') {
      sdk.stats.setMax('bestLevel', game.level);
      if (game.level >= 3) sdk.achievements.unlock('first_round', 'Premier Tour', '🎯');
      if (game.level >= 10) sdk.achievements.unlock('level_10', 'Niveau 10', '🔟');
      if (game.level >= 20) sdk.achievements.unlock('level_20', 'Mémoire de Fer', '🧠');
      setTimeout(nextRound, 700);
    }
    render();
  }

  function finishGame() {
    sdk.stats.increment('games');
    sdk.stats.setMax('bestLevel', game.level - 1);
    render();
    document.getElementById('simonOverBanner').style.display = '';
  }

  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  function render() {
    document.getElementById('simonLevel').textContent = `Niveau ${game.level}`;
    document.querySelectorAll ? null : null;
    COLORS.forEach((c) => {
      const el = document.getElementById('simonBtn_' + c);
      if (el) el.style.pointerEvents = (game.showingSequence || game.over) ? 'none' : '';
    });
    document.getElementById('simonOverBanner').style.display = game.over ? '' : 'none';
  }

  function renderHome() {
    const host = document.getElementById('homeStatsSimon');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('bestLevel', 0), l: '🏆 Meilleur niveau' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListSimon');
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

  return { setMode, startGame, onPress, goHome, showStats, renderHome };
}
