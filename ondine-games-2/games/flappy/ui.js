// ═══════════════════════════════════════════════════════════════
// games/flappy/ui.js
// ═══════════════════════════════════════════════════════════════
import { createGame, flap, tick, PIPE_WIDTH, PIPE_GAP, ACHIEVEMENTS } from './logic.js';

export function createUI(sdk) {
  let game = null;
  let rafId = null;
  let running = false;

  function startGame() {
    game = createGame();
    sdk.navigation.go('sg');
    render();
    running = true;
    loop();
  }

  function loop() {
    if (!running) return;
    game = tick(game);
    render();
    if (game.over) { finishGame(); return; }
    rafId = setTimeout(loop, 1000 / 50);
  }

  function onFlap() {
    if (!game) return;
    if (game.over) { startGame(); return; }
    const wasStarted = game.started;
    game = flap(game);
    sdk.audio.play('click');
    render();
  }

  function finishGame() {
    running = false;
    sdk.stats.increment('games');
    sdk.stats.setMax('bestScore', game.score);
    sdk.audio.play('lose');
    sdk.achievements.unlock('first_pipe', 'Premier Corail', '🪸');
    if (game.score >= 10) sdk.achievements.unlock('score_10', 'En Vol', '🫧');
    if (game.score >= 25) sdk.achievements.unlock('score_25', 'Courant Marin', '🌊');
    document.getElementById('flappyOverBanner').style.display = '';
  }

  function goHome() {
    running = false;
    if (rafId) clearTimeout(rafId);
    renderHome();
    sdk.navigation.go('sh');
  }

  function render() {
    const bird = document.getElementById('flappyBird');
    bird.style.top = `${game.birdY}%`;
    bird.style.left = `${game.birdX}%`;
    bird.style.transform = `translate(-50%,-50%) rotate(${Math.max(-25, Math.min(70, game.birdVelocity * 6))}deg)`;

    const host = document.getElementById('flappyPipes');
    host.innerHTML = '';
    game.pipes.forEach((p) => {
      const gapTop = p.gapCenter - PIPE_GAP / 2, gapBottom = p.gapCenter + PIPE_GAP / 2;
      const top = document.createElement('div');
      top.className = 'fpipe';
      top.style.left = `${p.x}%`; top.style.width = `${PIPE_WIDTH}%`;
      top.style.top = '0'; top.style.height = `${gapTop}%`;
      const bottom = document.createElement('div');
      bottom.className = 'fpipe';
      bottom.style.left = `${p.x}%`; bottom.style.width = `${PIPE_WIDTH}%`;
      bottom.style.top = `${gapBottom}%`; bottom.style.height = `${100 - gapBottom}%`;
      host.appendChild(top); host.appendChild(bottom);
    });

    document.getElementById('flappyScore').textContent = game.score;
    document.getElementById('flappyOverBanner').style.display = game.over ? '' : 'none';
  }

  function renderHome() {
    const host = document.getElementById('homeStatsFlappy');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('bestScore', 0), l: '🏆 Record' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListFlappy');
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

  return { startGame, onFlap, goHome, showStats, renderHome };
}
