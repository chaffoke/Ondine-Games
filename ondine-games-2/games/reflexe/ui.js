// ═══════════════════════════════════════════════════════════════
// games/reflexe/ui.js
// ───────────────────────────────────────
// Démontre l'usage de TOUTES les briques du SDK minimal :
// stats, achievements, audio, toast, save, random, navigation.
// ═══════════════════════════════════════════════════════════════
import { POSITIONS, classifyReactionTime, ACHIEVEMENTS } from './logic.js';

export function createUI(sdk) {
  let targetShownAt = null;
  let waitTimer = null;
  let falseStartThisRound = false;
  let currentTargetPos = null;

  function startGame() {
    falseStartThisRound = false;
    sdk.navigation.go('sg');
    renderTargets(null);
    document.getElementById('reflexeStatus').textContent = 'Attends la cible…';
    // Démontre sdk.random.shuffle : ordre aléatoire des positions,
    // on prend la première comme position de la cible.
    const order = sdk.random.shuffle(POSITIONS);
    currentTargetPos = order[0];
    targetShownAt = null;
    const delay = 800 + Math.random() * 1800; // 0.8s à 2.6s, imprévisible
    waitTimer = setTimeout(() => {
      targetShownAt = Date.now();
      renderTargets(currentTargetPos);
      document.getElementById('reflexeStatus').textContent = 'MAINTENANT !';
    }, delay);
  }

  function onZoneClick(pos) {
    if (targetShownAt === null) {
      // Clic avant l'apparition de la cible = faux départ
      clearTimeout(waitTimer);
      falseStartThisRound = true;
      sdk.audio.play('error');
      sdk.toast.show('⏱️ Trop tôt ! Attends la cible.');
      document.getElementById('reflexeStatus').textContent = 'Faux départ — retente ta chance';
      setTimeout(startGame, 1200);
      return;
    }
    if (pos !== currentTargetPos) return; // clic sur la mauvaise case, ignoré
    const reactionMs = Date.now() - targetShownAt;
    finishRound(reactionMs);
  }

  function finishRound(reactionMs) {
    targetShownAt = null;
    sdk.audio.play('success');
    sdk.stats.increment('games');
    sdk.stats.setMin('bestTime', reactionMs);
    sdk.save.write({ lastReactionMs: reactionMs, lastPlayedAt: Date.now() });

    sdk.achievements.unlock('first_try', 'Premier Essai', '🎯');
    if (reactionMs < 250) sdk.achievements.unlock('lightning', 'Fulgurant', '⚡');
    if (sdk.stats.get('games') >= 10) sdk.achievements.unlock('veteran', 'Vétéran', '🏅');
    if (!falseStartThisRound) sdk.achievements.unlock('no_false_start', 'Sang-Froid', '🧊');

    const category = classifyReactionTime(reactionMs);
    document.getElementById('reflexeStatus').textContent = `${reactionMs}ms — ${category} !`;
    renderTargets(null);
  }

  function goHome() {
    clearTimeout(waitTimer);
    renderHome();
    sdk.navigation.go('sh');
  }

  function renderTargets(activePos) {
    const host = document.getElementById('targetZone');
    host.innerHTML = '';
    POSITIONS.forEach((pos) => {
      const el = document.createElement('div');
      el.className = 'reflexe-zone' + (pos === activePos ? ' active' : '');
      el.onclick = () => onZoneClick(pos);
      host.appendChild(el);
    });
  }

  function renderHome() {
    const host = document.getElementById('reflexeHomeStats');
    host.innerHTML = '';
    const best = sdk.stats.get('bestTime', null);
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: best !== null ? best + 'ms' : '—', l: '⚡ Record' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });

    // Démontre sdk.save.read()/hasSave() : affiche la dernière tentative.
    const lastEl = document.getElementById('reflexeLastTry');
    if (sdk.save.hasSave()) {
      const last = sdk.save.read();
      lastEl.textContent = `Dernière tentative : ${last.lastReactionMs}ms`;
    } else {
      lastEl.textContent = '';
    }
  }

  function renderAchievements() {
    const list = document.getElementById('reflexeAchList');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = sdk.achievements.isUnlocked(a.id);
      const el = document.createElement('div');
      el.className = 'achCard' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `<div class="ic">${a.icon}</div><div><div class="name">${a.name}</div><div class="desc">${a.desc}</div></div>`;
      list.appendChild(el);
    });
  }

  function showStats() {
    renderAchievements();
    sdk.navigation.go('sstats');
  }

  return { startGame, goHome, renderHome, showStats };
}
