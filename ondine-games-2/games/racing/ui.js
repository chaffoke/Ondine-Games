// ═══════════════════════════════════════════════════════════════
// games/racing/ui.js
// ═══════════════════════════════════════════════════════════════
import { TRACKS, CARS, OPPONENT_NAMES, LAPS_PER_RACE, BOOST_MAX, BOOST_COST, TICK_MS,
  createRace, tickRace, getGeometry, trackPointAt, computeRewards, ACHIEVEMENTS, upgradeBonus } from './logic.js';
import { aiChooseStrategy, aiShouldBoost } from './ai.js';

const UPGRADE_COST = { engine: [80,160,280], turbo: [80,160,280], tires: [80,160,280], boost: [80,160,280] };
const STARTING_CREDITS = 200;

export function createUI(sdk) {
  let profile = null;
  let selectedTrackId = null;
  let selectedDifficulty = 'normal';
  let race = null;
  let raceInterval = null;
  let difficulties = [];
  let over = false;
  let canvas, ctx;
  let rankAtLastLapStart = null; // pour l'achievement "Dépassement de Dernière Seconde"

  function loadProfile() {
    const saved = sdk.save.read();
    profile = saved || {
      credits: STARTING_CREDITS, xp: 0, level: 1, selectedCar: 'purple_rocket',
      upgrades: { engine: 0, turbo: 0, tires: 0, boost: 0 },
      unlockedTracks: ['cote_sirenes'], records: {}, winStreak: 0, tracksWon: [],
    };
  }
  function saveProfile() { sdk.save.write(profile); }

  function xpForNextLevel(level) { return 100 + (level - 1) * 60; }
  function addXp(amount) {
    profile.xp += amount;
    while (profile.xp >= xpForNextLevel(profile.level)) {
      profile.xp -= xpForNextLevel(profile.level);
      profile.level++;
      sdk.toast.show(`🎉 Niveau ${profile.level} !`);
      const nextTrackIdx = profile.level - 1;
      const allTracks = Object.keys(TRACKS);
      if (nextTrackIdx < allTracks.length && !profile.unlockedTracks.includes(allTracks[nextTrackIdx])) {
        profile.unlockedTracks.push(allTracks[nextTrackIdx]);
        sdk.toast.show(`🏁 Nouveau circuit débloqué : ${TRACKS[allTracks[nextTrackIdx]].name}`);
      }
    }
  }

  function goHome() { stopRaceLoop(); renderHome(); sdk.navigation.go('sh'); }
  function goSelect() { renderSelect(); sdk.navigation.go('sselect'); }
  function goGarage() { renderGarage(); sdk.navigation.go('sgarage'); }

  function selectTrack(trackId) { selectedTrackId = trackId; renderSelect(); }
  function selectDifficulty(d) { selectedDifficulty = d; renderSelect(); }
  function selectCar(carId) { profile.selectedCar = carId; saveProfile(); renderGarage(); }

  function buyUpgrade(type) {
    const level = profile.upgrades[type];
    if (level >= 3) { sdk.toast.show('Amélioration maximale atteinte'); return; }
    const cost = UPGRADE_COST[type][level];
    if (profile.credits < cost) { sdk.toast.show('Crédits insuffisants'); sdk.audio.play('error'); return; }
    profile.credits -= cost;
    profile.upgrades[type]++;
    saveProfile();
    sdk.audio.play('success');
    renderGarage();
  }

  function startRace() {
    if (!selectedTrackId) selectedTrackId = profile.unlockedTracks[0];
    race = createRace(selectedTrackId, profile.selectedCar, profile.upgrades, 'balanced');
    const diffKey = selectedDifficulty === 'easy' ? 0 : selectedDifficulty === 'hard' ? 2 : 1;
    difficulties = race.cars.map((c, i) => i === 0 ? null : ['easy','normal','hard'][diffKey]);
    over = false;
    rankAtLastLapStart = null;
    sdk.navigation.go('sg');
    canvas = document.getElementById('raceCanvas');
    ctx = canvas.getContext('2d');
    // synchronise la résolution INTERNE du canvas avec sa taille CSS réelle
    // (sinon le rendu resterait figé à 420×420 en résolution native même si
    // le CSS l'affiche plus grand sur desktop — flou garanti à l'agrandissement)
    const displaySize = canvas.clientWidth || 420;
    canvas.width = displaySize; canvas.height = displaySize;
    renderRaceFrame();
    startRaceLoop();
  }

  /** Avance la course d'un tick (IA + joueur) et capture le rang du
   *  joueur au moment précis où il entre dans le DERNIER tour — sert
   *  uniquement à l'achievement "Dépassement de Dernière Seconde"
   *  (bug réel trouvé lors de l'audit : l'achievement était listé
   *  mais jamais câblé à aucune condition de déclenchement). */
  function advanceTick(boostRequests) {
    race = tickRace(race, boostRequests);
    const player = race.cars.find(c => c.isPlayer);
    if (rankAtLastLapStart === null && player.lap === race.laps) {
      rankAtLastLapStart = player.rank;
    }
    renderRaceFrame();
    if (race.over) finishRace();
  }

  function startRaceLoop() {
    stopRaceLoop();
    raceInterval = setInterval(() => {
      if (!race || race.over) return;
      const boostRequests = new Set();
      race.cars.forEach((c, i) => {
        if (!c.isPlayer && aiShouldBoost(c, difficulties[i], selectedTrackId)) boostRequests.add(c.slotId);
      });
      advanceTick(boostRequests);
    }, TICK_MS);
  }
  function stopRaceLoop() { if (raceInterval) { clearInterval(raceInterval); raceInterval = null; } }

  function onBoostPress() {
    if (!race || race.over || over) return;
    const player = race.cars.find(c => c.isPlayer);
    if (player.boostMeter < BOOST_COST || player.boosting > 0) { sdk.audio.play('error'); return; }
    const boostRequests = new Set([0]);
    race.cars.forEach((c, i) => { if (!c.isPlayer && aiShouldBoost(c, difficulties[i], selectedTrackId)) boostRequests.add(c.slotId); });
    sdk.audio.play('click');
    advanceTick(boostRequests);
  }

  function finishRace() {
    stopRaceLoop();
    over = true;
    const player = race.cars.find(c => c.isPlayer);
    const rewards = computeRewards(player, selectedDifficulty);
    profile.credits += rewards.credits;
    addXp(rewards.xp);

    sdk.stats.increment('races');
    if (player.finishRank === 1) {
      sdk.stats.increment('wins');
      profile.winStreak++;
      if (!profile.tracksWon.includes(selectedTrackId)) profile.tracksWon.push(selectedTrackId);
      sdk.achievements.unlock('first_win', 'Première Victoire', '🏆');
      if (profile.winStreak >= 3) sdk.achievements.unlock('streak_3', '3 Victoires Consécutives', '🔥');
      if (profile.tracksWon.length >= Object.keys(TRACKS).length) sdk.achievements.unlock('champion', 'Champion', '👑');
      sdk.audio.play('win');
    } else {
      profile.winStreak = 0;
      sdk.audio.play(player.finishRank <= 3 ? 'success' : 'lose');
    }
    if (player.finishRank <= 3) sdk.achievements.unlock('first_podium', 'Premier Podium', '🥉');
    if (player.boostsUsed >= 5) sdk.achievements.unlock('perfect_boost', 'Boost Parfait', '⚡');
    if (sdk.stats.get('races') >= 10) sdk.achievements.unlock('races_10', '10 Courses', '🏎️');
    if (player.finishRank === 1 && rankAtLastLapStart !== null && rankAtLastLapStart > 1) {
      sdk.achievements.unlock('late_overtake', 'Dépassement de Dernière Seconde', '💨');
    }

    const raceTimeSec = race.tick * (TICK_MS/1000);
    const prevRecord = profile.records[selectedTrackId];
    if (!prevRecord || raceTimeSec < prevRecord.time) {
      profile.records[selectedTrackId] = { time: raceTimeSec, rank: player.finishRank };
      sdk.stats.setMin('bestTime', raceTimeSec);
    }
    sdk.stats.setMin('bestRank', player.finishRank);
    saveProfile();

    setTimeout(() => showResult(rewards, player, raceTimeSec), 500);
  }

  function showResult(rewards, player, raceTimeSec) {
    const won = player.finishRank === 1;
    document.getElementById('resultIcon').textContent = won ? '🏆' : (player.finishRank <= 3 ? '🥉' : '💥');
    document.getElementById('resultTitle').textContent = won ? 'VICTOIRE !' : 'COURSE TERMINÉE';
    document.getElementById('resultPos').textContent = `${player.finishRank} / 6`;
    document.getElementById('resultTime').textContent = `${raceTimeSec.toFixed(1)}s`;
    document.getElementById('resultCredits').textContent = `+${rewards.credits}`;
    document.getElementById('resultXp').textContent = `+${rewards.xp} XP`;
    document.getElementById('sresult').classList.remove('hidden');
  }

  function replayRace() { document.getElementById('sresult').classList.add('hidden'); startRace(); }
  function nextRace() { document.getElementById('sresult').classList.add('hidden'); goSelect(); }
  function resultToGarage() { document.getElementById('sresult').classList.add('hidden'); goGarage(); }
  function resultToHome() { document.getElementById('sresult').classList.add('hidden'); goHome(); }

  function renderRaceFrame() {
    if (!race) return;
    const W = canvas.width, H = canvas.height;
    const track = TRACKS[selectedTrackId];
    const geo = getGeometry(selectedTrackId);
    ctx.fillStyle = track.colors.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = track.colors.track;
    ctx.lineWidth = W * 0.09;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    geo.wp.forEach(([x,y], i) => {
      const px = (x/100)*W, py = (y/100)*H;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = track.colors.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    race.cars.forEach((car) => {
      const lapProgress = car.progress % geo.total;
      const pt = trackPointAt(selectedTrackId, lapProgress);
      const px = (pt.x/100)*W, py = (pt.y/100)*H;
      if (car.boosting > 0) {
        ctx.beginPath(); ctx.arc(px, py, W*0.035, 0, Math.PI*2);
        ctx.fillStyle = CARS[car.carDef].color + '55'; ctx.fill();
      }
      ctx.save();
      ctx.translate(px, py); ctx.rotate((pt.angle||0) * Math.PI/180);
      ctx.beginPath();
      ctx.moveTo(W*0.018, 0); ctx.lineTo(-W*0.012, W*0.011); ctx.lineTo(-W*0.012, -W*0.011);
      ctx.closePath();
      ctx.fillStyle = CARS[car.carDef].color;
      ctx.fill();
      ctx.strokeStyle = car.isPlayer ? '#fff' : 'rgba(255,255,255,.4)';
      ctx.lineWidth = car.isPlayer ? 2 : 1;
      ctx.stroke();
      ctx.restore();
    });

    const player = race.cars.find(c => c.isPlayer);
    document.getElementById('hudPos').textContent = `${player.rank} / 6`;
    document.getElementById('hudLap').textContent = `${player.lap} / ${race.laps}`;
    document.getElementById('boostFill').style.width = `${player.boostMeter}%`;
    document.getElementById('boostBtn').classList.toggle('ready', player.boostMeter >= BOOST_COST && player.boosting === 0);
    document.getElementById('boostBtn').classList.toggle('active', player.boosting > 0);
  }

  function renderHome() {
    document.getElementById('homeCredits').textContent = `💰 ${profile.credits}`;
    document.getElementById('homeLevel').textContent = `Niveau ${profile.level}`;
  }

  function renderSelect() {
    if (!selectedTrackId) selectedTrackId = profile.unlockedTracks[profile.unlockedTracks.length-1];
    const host = document.getElementById('trackList');
    host.innerHTML = '';
    Object.values(TRACKS).forEach((t) => {
      const unlocked = profile.unlockedTracks.includes(t.id);
      const el = document.createElement('div');
      el.className = 'track-card' + (t.id === selectedTrackId ? ' sel' : '') + (unlocked ? '' : ' locked');
      const record = profile.records[t.id];
      el.innerHTML = `<div class="tc-icon">${t.icon}</div><div class="tc-info"><div class="tc-name">${t.name}</div>
        <div class="tc-sub">${unlocked ? (record ? `🏆 Record : ${record.time.toFixed(1)}s (${record.rank}ᵉ)` : 'Jamais couru') : '🔒 Verrouillé'}</div></div>`;
      if (unlocked) el.onclick = () => selectTrack(t.id);
      host.appendChild(el);
    });
    ['easy','normal','hard'].forEach(d => document.getElementById('diff_'+d)?.classList.toggle('sel', d === selectedDifficulty));
    document.getElementById('launchBtn').disabled = !profile.unlockedTracks.includes(selectedTrackId);
  }

  function renderGarage() {
    document.getElementById('garageCredits').textContent = `💰 ${profile.credits}`;
    const carHost = document.getElementById('carList');
    carHost.innerHTML = '';
    Object.values(CARS).forEach((c) => {
      const el = document.createElement('div');
      el.className = 'car-card' + (c.id === profile.selectedCar ? ' sel' : '');
      el.innerHTML = `<div class="cc-icon" style="background:${c.color}22;color:${c.color};">${c.icon}</div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-stats">V:${Math.round(c.baseSpeed*100)} G:${Math.round(c.cornerGrip*100)} B:${Math.round(c.boostPower*100)}</div>`;
      el.onclick = () => selectCar(c.id);
      carHost.appendChild(el);
    });

    const upgHost = document.getElementById('upgradeList');
    upgHost.innerHTML = '';
    const labels = { engine: ['🔧 Moteur','+ vitesse max'], turbo: ['🌀 Turbo','+ accélération'], tires: ['🛞 Pneus','+ adhérence'], boost: ['⚡ Boost','+ puissance boost'] };
    Object.keys(labels).forEach((key) => {
      const level = profile.upgrades[key];
      const maxed = level >= 3;
      const cost = maxed ? null : UPGRADE_COST[key][level];
      const el = document.createElement('div');
      el.className = 'upg-card';
      el.innerHTML = `<div class="upg-info"><div class="upg-name">${labels[key][0]}</div><div class="upg-sub">${labels[key][1]} — niveau ${level}/3</div></div>
        <button class="ondine-btn ondine-btn-secondary upg-btn" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : `+${cost}💰`}</button>`;
      if (!maxed) el.querySelector('button').onclick = () => buyUpgrade(key);
      upgHost.appendChild(el);
    });
  }

  function renderAchievements() {
    const list = document.getElementById('achListRacing');
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

  function init() { loadProfile(); renderHome(); }

  return {
    init, goHome, goSelect, goGarage, selectTrack, selectDifficulty, selectCar, buyUpgrade,
    startRace, onBoostPress, replayRace, nextRace, resultToGarage, resultToHome, showStats,
  };
}
