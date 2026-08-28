// ═══════════════════════════════════════════════════════════════
// games/racing/ui.js
// ═══════════════════════════════════════════════════════════════
import { TRACKS, CARS, OPPONENT_NAMES, LAPS_PER_RACE, BOOST_MAX, BOOST_COST, TICK_MS,
  createRace, tickRace, getGeometry, trackPointAt, computeRewards, ACHIEVEMENTS, upgradeBonus,
  UPGRADES_DEF, upgradeCost, computeRevenuePerSec, SPORTS, COURSE_TRACK_IDS, RALLY_TRACK_IDS,
  createRallyRun, tickRallyRun, computeRallyResult } from './logic.js';
import { aiChooseStrategy, aiShouldBoost } from './ai.js';

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
  let lastIncomeCheckAt = null; // référence de temps RÉEL pour le calcul du revenu — jamais basé sur le nombre de ticks écoulés (setInterval peut dériver, un timestamp ne dérive pas)

  function loadProfile() {
    const saved = sdk.save.read();
    profile = saved || {
      credits: STARTING_CREDITS, xp: 0, level: 1, selectedCar: 'purple_rocket',
      upgrades: { engine: 0, turbo: 0, tires: 0, boost: 0, marketing: 0, sponsors: 0 },
      unlockedTracks: ['cote_sirenes'], records: {}, winStreak: 0, tracksWon: [],
    };
    // Migration : anciennes sauvegardes n'ont pas les clés économie —
    // les ajouter sans jamais perdre les niveaux déjà acquis (engine/
    // turbo/tires/boost restent intacts, migration additive seulement).
    if (profile.upgrades.marketing === undefined) profile.upgrades.marketing = 0;
    if (profile.upgrades.sponsors === undefined) profile.upgrades.sponsors = 0;
    // Migration additive : structure "sports" (phase 3). N'écrase
    // jamais une progression existante — seulement complétée si
    // absente. Course reste toujours débloqué (racing.defaultUnlocked
    // = true), les autres respectent leur propre défaut.
    if (!profile.racing) profile.racing = { selectedSport: null, sports: {} };
    Object.keys(SPORTS).forEach((id) => {
      if (!profile.racing.sports[id]) {
        profile.racing.sports[id] = { unlocked: SPORTS[id].defaultUnlocked };
      }
    });
    // Migration additive Rallye : meilleurs temps par parcours,
    // jamais écrasés — un parcours jamais joué est juste absent de
    // l'objet (pas de valeur inventée).
    if (!profile.racing.rallyBestTimes) profile.racing.rallyBestTimes = {};
    lastIncomeCheckAt = Date.now();
    checkSportUnlocks();
  }
  function saveProfile() { sdk.save.write(profile); }

  /** Condition de déblocage réelle et persistée : Rallye se débloque
   *  au niveau 2 (réutilise le système XP/niveau déjà existant, pas
   *  de nouvelle monnaie ni de nouvelle mécanique de progression).
   *  Vérifiée au chargement ET après chaque gain d'XP (voir addXp),
   *  jamais un simple `unlocked: true` figé en dur. */
  function checkSportUnlocks() {
    if (!profile.racing.sports.rally.unlocked && profile.level >= 2) {
      profile.racing.sports.rally.unlocked = true;
      sdk.toast.show('🏁 Rallye débloqué !');
    }
  }

  let selectedSportId = null; // sélection en cours sur l'écran "Choisis ton sport", pas encore confirmée

  function currentRevenuePerSec() { return computeRevenuePerSec(profile.upgrades); }

  /** Calcul du revenu idle basé sur un VRAI timestamp écoulé, pas sur
   *  un compteur de ticks — reste juste même si le navigateur ralentit
   *  ou si setInterval dérive. Appelé à chaque tick de la boucle de
   *  course ET par un second intervalle léger hors course (voir
   *  startIncomeLoop), pour que le revenu tourne aussi hors course. */
  function tickIncome() {
    const now = Date.now();
    const elapsedSec = (now - lastIncomeCheckAt) / 1000;
    lastIncomeCheckAt = now;
    if (elapsedSec <= 0) return;
    profile.credits += currentRevenuePerSec() * elapsedSec;
  }

  let incomeInterval = null;
  function startIncomeLoop() {
    stopIncomeLoop();
    incomeInterval = setInterval(() => { tickIncome(); refreshMoneyDisplays(); }, 500);
  }
  function stopIncomeLoop() { if (incomeInterval) { clearInterval(incomeInterval); incomeInterval = null; } }

  /** Met à jour tous les affichages d'argent/revenu présents à l'écran
   *  (accueil, garage, ET le HUD pendant une course), sans dépendre
   *  d'un re-render complet coûteux à chaque tick. */
  function refreshMoneyDisplays() {
    document.querySelectorAll('[data-credits-display]').forEach((el) => { el.textContent = Math.floor(profile.credits); });
    document.querySelectorAll('[data-revenue-display]').forEach((el) => { el.textContent = currentRevenuePerSec().toFixed(2); });
    if (document.getElementById('sg') && !document.getElementById('sg').classList.contains('hidden')) renderUpgradePanel();
  }

  function xpForNextLevel(level) { return 100 + (level - 1) * 60; }
  function addXp(amount) {
    profile.xp += amount;
    while (profile.xp >= xpForNextLevel(profile.level)) {
      profile.xp -= xpForNextLevel(profile.level);
      profile.level++;
      sdk.toast.show(`🎉 Niveau ${profile.level} !`);
      const nextTrackIdx = profile.level - 1;
      const allTracks = COURSE_TRACK_IDS; // JAMAIS Object.keys(TRACKS) — voir commentaire dans logic.js
      if (nextTrackIdx < allTracks.length && !profile.unlockedTracks.includes(allTracks[nextTrackIdx])) {
        profile.unlockedTracks.push(allTracks[nextTrackIdx]);
        sdk.toast.show(`🏁 Nouveau circuit débloqué : ${TRACKS[allTracks[nextTrackIdx]].name}`);
      }
    }
    checkSportUnlocks();
  }

  function goHome() { stopRaceLoop(); renderHome(); sdk.navigation.go('sh'); }
  function goSelect() { renderSelect(); sdk.navigation.go('sselect'); }

  function goSportSelect() { selectedSportId = profile.racing.selectedSport; renderSportSelect(); sdk.navigation.go('ssport'); }

  function selectSport(id) {
    const sport = SPORTS[id];
    if (!profile.racing.sports[id].unlocked) { sdk.toast.show(sport.unlockCondition || 'Verrouillé'); return; }
    selectedSportId = id;
    renderSportSelect();
  }

  function confirmSportSelection() {
    if (!selectedSportId) return;
    const sport = SPORTS[selectedSportId];
    if (!sport.hasEngine) { sdk.toast.show('Ce sport n\u2019a pas encore de moteur de course — bientôt disponible !'); return; }
    profile.racing.selectedSport = selectedSportId;
    saveProfile();
    if (selectedSportId === 'rally') goRallySelect();
    else goSelect(); // Course réutilise l'écran de sélection de circuit existant, inchangé
  }

  // ═══════════════════════════════════════════════════════════════
  // RALLYE — sélection de parcours, boucle de jeu temps réel, résultat.
  // ═══════════════════════════════════════════════════════════════
  let rallySelectedTrackId = null;
  let rallyRun = null;
  let rallyAnimFrame = null;
  let rallyLastTs = null;
  let rallyFinishHandled = false; // garde-fou anti double-crédit/double-déclenchement

  function goRallySelect() {
    if (!rallySelectedTrackId) rallySelectedTrackId = RALLY_TRACK_IDS[0];
    renderRallySelect();
    sdk.navigation.go('srallyselect');
  }

  function selectRallyTrack(id) { rallySelectedTrackId = id; renderRallySelect(); }

  function renderRallySelect() {
    const host = document.getElementById('rallyTrackList');
    host.innerHTML = '';
    RALLY_TRACK_IDS.forEach((id) => {
      const t = TRACKS[id];
      const best = profile.racing.rallyBestTimes[id];
      const el = document.createElement('div');
      el.className = 'rally-track-card' + (id === rallySelectedTrackId ? ' sel' : '');
      el.innerHTML = `
        <div class="rtc-icon">${t.icon}</div>
        <div class="rtc-info">
          <div class="rtc-name">${t.name}</div>
          <div class="rtc-diff">${t.rallyMeta.difficulty} — ${t.rallyMeta.desc}</div>
          <div class="rtc-best">${best ? `🏆 Record : ${formatRallyTime(best)}` : 'Pas encore de temps enregistré'}</div>
        </div>`;
      el.onclick = () => selectRallyTrack(id);
      host.appendChild(el);
    });
  }

  function formatRallyTime(ms) {
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = (totalSec - min * 60).toFixed(2);
    return `${String(min).padStart(2, '0')}:${sec.padStart(5, '0')}`;
  }

  function startRallyRun() {
    if (!rallySelectedTrackId) rallySelectedTrackId = RALLY_TRACK_IDS[0];
    rallyRun = createRallyRun(rallySelectedTrackId, profile.selectedCar, profile.upgrades);
    rallyFinishHandled = false;
    sdk.navigation.go('srally');
    canvas = document.getElementById('rallyCanvas');
    ctx = canvas.getContext('2d');
    const displaySize = canvas.clientWidth || 420;
    canvas.width = displaySize; canvas.height = displaySize;
    renderUpgradePanel();
    rallyLastTs = null;
    if (rallyAnimFrame) cancelAnimationFrame(rallyAnimFrame);
    rallyAnimFrame = requestAnimationFrame(rallyLoop);
  }

  /** Boucle temps réel — dtMs calculé depuis performance.now(), donc
   *  le chronomètre reste juste quel que soit le framerate réel de
   *  l'appareil (exigence explicite : jamais un compteur de frames). */
  function rallyLoop(ts) {
    if (!rallyRun) return;
    if (rallyLastTs === null) rallyLastTs = ts;
    const dtMs = Math.min(100, ts - rallyLastTs); // plafonne les sauts (ex: onglet mis en arrière-plan) pour éviter un bond de progression irréaliste
    rallyLastTs = ts;
    rallyRun = tickRallyRun(rallyRun, dtMs, rallyBoostRequested);
    rallyBoostRequested = false;
    renderRallyFrame();
    if (rallyRun.finished) { finishRallyRun(); return; }
    rallyAnimFrame = requestAnimationFrame(rallyLoop);
  }

  let rallyBoostRequested = false;
  function onRallyBoostPress() {
    if (!rallyRun || rallyRun.finished) return;
    if (rallyRun.boostMeter < BOOST_COST || rallyRun.boosting > 0) { sdk.audio.play('error'); return; }
    rallyBoostRequested = true;
  }

  function renderRallyFrame() {
    if (!rallyRun) return;
    const W = canvas.width, H = canvas.height;
    const track = TRACKS[rallyRun.trackId];
    const geo = getGeometry(rallyRun.trackId);
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

    // ligne de départ — même logique que Course (position géométrique
    // réelle à progress=0, jamais un point arbitraire)
    {
      const startPt = trackPointAt(rallyRun.trackId, 0);
      const spx = (startPt.x/100)*W, spy = (startPt.y/100)*H;
      const trackWidth = W * 0.09;
      const nSquares = 8;
      const squareLen = trackWidth / nSquares;
      const lineThickness = W * 0.014;
      ctx.save();
      ctx.translate(spx, spy);
      ctx.rotate((startPt.angle||0) * Math.PI/180);
      for (let i = 0; i < nSquares; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#0a0a0a' : '#f5f5f5';
        ctx.fillRect(-lineThickness/2, -trackWidth/2 + i*squareLen, lineThickness, squareLen);
      }
      ctx.restore();
    }

    const pt = trackPointAt(rallyRun.trackId, rallyRun.progress % geo.total);
    const px = (pt.x/100)*W, py = (pt.y/100)*H;
    if (rallyRun.boosting > 0) {
      ctx.beginPath(); ctx.arc(px, py, W*0.035, 0, Math.PI*2);
      ctx.fillStyle = CARS[rallyRun.carDef].color + '55'; ctx.fill();
    }
    ctx.save();
    ctx.translate(px, py); ctx.rotate((pt.angle||0) * Math.PI/180);
    ctx.beginPath();
    ctx.moveTo(W*0.018, 0); ctx.lineTo(-W*0.012, W*0.011); ctx.lineTo(-W*0.012, -W*0.011);
    ctx.closePath();
    ctx.fillStyle = CARS[rallyRun.carDef].color;
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    document.getElementById('rallyTimer').textContent = formatRallyTime(rallyRun.elapsedMs);
    document.getElementById('rallyBoostFill').style.width = `${rallyRun.boostMeter}%`;
    document.getElementById('rallyBoostBtn').classList.toggle('ready', rallyRun.boostMeter >= BOOST_COST && rallyRun.boosting === 0);
    document.getElementById('rallyBoostBtn').classList.toggle('active', rallyRun.boosting > 0);
    const creditsEl = document.getElementById('rallyHudCredits');
    if (creditsEl) creditsEl.textContent = Math.floor(profile.credits);
  }

  /** Fin de spéciale — protégée contre le double-déclenchement
   *  (rallyFinishHandled) : rallyLoop pourrait en théorie planifier un
   *  requestAnimationFrame de plus avant que la navigation ne quitte
   *  l'écran, cette garde évite un double-crédit dans ce cas. */
  function finishRallyRun() {
    if (rallyFinishHandled) return;
    rallyFinishHandled = true;
    if (rallyAnimFrame) { cancelAnimationFrame(rallyAnimFrame); rallyAnimFrame = null; }
    const track = TRACKS[rallyRun.trackId];
    const result = computeRallyResult(track, rallyRun.elapsedMs);
    const previousBest = profile.racing.rallyBestTimes[rallyRun.trackId];
    const isNewRecord = !previousBest || rallyRun.elapsedMs < previousBest;
    if (isNewRecord) profile.racing.rallyBestTimes[rallyRun.trackId] = rallyRun.elapsedMs;
    profile.credits += result.credits;
    addXp(Math.round(result.credits / 2));
    sdk.stats.increment('rallyRuns');
    if (result.medal) sdk.stats.increment('rallyMedals');
    saveProfile();

    document.getElementById('rallyResultTime').textContent = formatRallyTime(rallyRun.elapsedMs);
    document.getElementById('rallyResultBest').textContent = formatRallyTime(profile.racing.rallyBestTimes[rallyRun.trackId]);
    document.getElementById('rallyResultMedal').textContent = result.medal ? { gold: '🥇 OR', silver: '🥈 ARGENT', bronze: '🥉 BRONZE' }[result.medal] : 'Pas de médaille — réessaie !';
    document.getElementById('rallyResultRecord').textContent = isNewRecord && previousBest ? '🎉 NOUVEAU RECORD !' : (isNewRecord ? '' : '');
    document.getElementById('rallyResultReward').textContent = `+$${result.credits}`;
    sdk.navigation.go('srallyresult');
    sdk.audio.play(result.medal ? 'win' : 'lose');
  }

  function replayRally() { startRallyRun(); }
  function rallyBackToSelect() { goRallySelect(); }


  /** Débloque un sport — pas encore de vraie condition joueur dans
   *  cette phase (les 5 sports hors Course restent volontairement "à
   *  venir", sans moteur), mais l'architecture de déblocage/sauvegarde
   *  est réelle et testable dès maintenant. */
  function unlockSport(id) {
    if (!profile.racing.sports[id]) return;
    profile.racing.sports[id].unlocked = true;
    saveProfile();
    renderSportSelect();
  }

  function renderSportSelect() {
    const unlockedCount = Object.values(profile.racing.sports).filter((s) => s.unlocked).length;
    const totalCount = Object.keys(SPORTS).length;
    document.getElementById('sportUnlockedCount').textContent = `${unlockedCount} of ${totalCount} unlocked`;
    const grid = document.getElementById('sportGrid');
    grid.innerHTML = '';
    Object.values(SPORTS).sort((a, b) => a.order - b.order).forEach((sport) => {
      const state = profile.racing.sports[sport.id];
      const el = document.createElement('div');
      el.className = 'sport-card' + (state.unlocked ? '' : ' locked') + (selectedSportId === sport.id ? ' sel' : '');
      el.innerHTML = `
        <div class="sc-icon">${sport.icon}</div>
        <div class="sc-name">${sport.name}</div>
        <div class="sc-vehicle">${sport.vehicleType}</div>
        ${state.unlocked ? '' : `<div class="sc-lock">🔒 ${sport.unlockCondition || 'Verrouillé'}</div>`}
      `;
      el.onclick = () => selectSport(sport.id);
      grid.appendChild(el);
    });
    const confirmBtn = document.getElementById('sportConfirmBtn');
    const canConfirm = selectedSportId && profile.racing.sports[selectedSportId].unlocked;
    confirmBtn.disabled = !canConfirm;
    confirmBtn.textContent = canConfirm && SPORTS[selectedSportId].hasEngine ? '🏁 Choisir ce sport' : (canConfirm ? '🔜 Bientôt disponible' : 'Choisir un sport');
  }
  function goGarage() { renderGarage(); sdk.navigation.go('sgarage'); }

  function selectTrack(trackId) { selectedTrackId = trackId; renderSelect(); }
  function selectDifficulty(d) { selectedDifficulty = d; renderSelect(); }
  function selectCar(carId) { profile.selectedCar = carId; saveProfile(); renderGarage(); }

  /** Achat d'amélioration, réutilisable À TOUT MOMENT (garage entre
   *  les courses OU pendant une course en cours). Si une course est
   *  active, modifie DIRECTEMENT race.cars[playerIdx].upgrades — pas
   *  seulement profile.upgrades — car upgradeBonus() est appelée
   *  fraîchement à CHAQUE tick de tickRace() à partir de car.upgrades,
   *  une copie indépendante prise au lancement de la course (voir
   *  createRace). Sans cette synchronisation explicite, l'achat
   *  n'aurait aucun effet avant la course SUIVANTE. */
  function buyUpgrade(type) {
    const level = profile.upgrades[type];
    const cost = upgradeCost(type, level);
    if (profile.credits < cost) { sdk.toast.show('Crédits insuffisants'); sdk.audio.play('error'); return; }
    profile.credits -= cost;
    profile.upgrades[type]++;
    if (race && !race.over) {
      const playerCar = race.cars.find((c) => c.isPlayer);
      if (playerCar) playerCar.upgrades[type] = profile.upgrades[type];
    }
    if (rallyRun && !rallyRun.finished) rallyRun.upgrades[type] = profile.upgrades[type];
    saveProfile();
    sdk.audio.play('success');
    if (document.getElementById('sgarage') && !document.getElementById('sgarage').classList.contains('hidden')) renderGarage();
    renderUpgradePanel();
  }

  /** Panneau d'amélioration générique — rendu commun au garage ET à
   *  l'overlay pendant la course (même structure, même logique de
   *  coût/bonus, un seul endroit à maintenir). */
  function renderUpgradeCards(hostId, { compact = false } = {}) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';
    Object.keys(UPGRADES_DEF).forEach((type) => {
      const def = UPGRADES_DEF[type];
      const level = profile.upgrades[type];
      const cost = upgradeCost(type, level);
      const current = (level * def.bonusPerLevel).toFixed(def.unit === '$/s' ? 2 : 0);
      const next = ((level + 1) * def.bonusPerLevel).toFixed(def.unit === '$/s' ? 2 : 0);
      const canAfford = profile.credits >= cost;
      const card = document.createElement('div');
      card.className = 'upgrade-card' + (compact ? ' compact' : '');
      card.innerHTML = `
        <div class="uc-head"><div class="uc-icon">${def.icon}</div><div class="uc-name">${def.name}<div class="uc-level">Nv. ${level}</div></div></div>
        <div class="uc-values">${current}${def.unit} <span class="uc-arrow">→</span> <span class="uc-next">${next}${def.unit}</span></div>
        <button class="uc-buy${canAfford ? '' : ' disabled'}" data-type="${type}">Améliorer <span class="uc-cost">$${cost}</span></button>
      `;
      card.querySelector('.uc-buy').onclick = () => buyUpgrade(type);
      host.appendChild(card);
    });
  }

  function renderUpgradePanel() {
    // pendant une course (Course OU Rallye) : sous-ensemble compact,
    // visible sans quitter l'écran de course. Rafraîchit les DEUX
    // conteneurs s'ils existent — un seul est réellement affiché à la
    // fois (l'autre écran est caché), donc pas de coût inutile.
    if (document.getElementById('raceUpgrades')) renderUpgradeCards('raceUpgrades', { compact: true });
    if (document.getElementById('rallyUpgrades')) renderUpgradeCards('rallyUpgrades', { compact: true });
  }

  function startRace() {
    if (!selectedTrackId) selectedTrackId = profile.unlockedTracks[0];
    race = createRace(selectedTrackId, profile.selectedCar, profile.upgrades, 'balanced', Math.random, selectedDifficulty);
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
    renderUpgradePanel();
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
    // Le classement (finishRank) est définitif dès qu'une voiture
    // franchit la ligne : une fois assigné, il ne change plus jamais
    // (seules les voitures encore en course peuvent se disputer les
    // rangs ENTRE ELLES, jamais dépasser une voiture déjà classée).
    // Le joueur n'a donc aucune raison d'attendre que les 5 IA aient
    // toutes fini — dès qu'IL a fini, son résultat est acquis.
    if (player.finished) finishRace();
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
      if (profile.tracksWon.length >= COURSE_TRACK_IDS.length) sdk.achievements.unlock('champion', 'Champion', '👑');
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

    // Ligne de départ/arrivée — positionnée à progress=0, exactement là
    // où les voitures démarrent réellement (voir logic.js: `progress: 0`
    // à l'initialisation), pas un point arbitraire. Perpendiculaire au
    // sens de course (angle + 90°), damier noir/blanc classique,
    // largeur cohérente avec celle de la piste tracée ci-dessus.
    {
      const startPt = trackPointAt(selectedTrackId, 0);
      const spx = (startPt.x/100)*W, spy = (startPt.y/100)*H;
      const trackWidth = W * 0.09;
      const nSquares = 8;
      const squareLen = trackWidth / nSquares;
      const lineThickness = W * 0.014;
      ctx.save();
      ctx.translate(spx, spy);
      ctx.rotate((startPt.angle||0) * Math.PI/180);
      // le damier est perpendiculaire au déplacement : on dessine donc
      // les cases le long de l'axe Y local (largeur de la piste), avec
      // une petite épaisseur le long de l'axe X local (sens de course)
      for (let i = 0; i < nSquares; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#0a0a0a' : '#f5f5f5';
        ctx.fillRect(-lineThickness/2, -trackWidth/2 + i*squareLen, lineThickness, squareLen);
      }
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-lineThickness/2, -trackWidth/2, lineThickness, trackWidth);
      ctx.restore();
    }

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
    const creditsEl = document.getElementById('hudCredits');
    const revenueEl = document.getElementById('hudRevenue');
    if (creditsEl) creditsEl.textContent = Math.floor(profile.credits);
    if (revenueEl) revenueEl.textContent = currentRevenuePerSec().toFixed(2);
  }

  function renderHome() {
    document.getElementById('homeCredits').textContent = `💰 ${profile.credits}`;
    document.getElementById('homeLevel').textContent = `Niveau ${profile.level}`;
  }

  function renderSelect() {
    if (!selectedTrackId) selectedTrackId = profile.unlockedTracks[profile.unlockedTracks.length-1];
    const host = document.getElementById('trackList');
    host.innerHTML = '';
    Object.values(TRACKS).filter((t) => COURSE_TRACK_IDS.includes(t.id)).forEach((t) => {
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
    document.getElementById('garageCredits').textContent = `💰 ${Math.floor(profile.credits)}`;
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

    renderUpgradeCards('upgradeList');
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

  function init() { loadProfile(); startIncomeLoop(); renderHome(); }

  return {
    init, goHome, goSelect, goGarage, selectTrack, selectDifficulty, selectCar, buyUpgrade,
    startRace, onBoostPress, replayRace, nextRace, resultToGarage, resultToHome, showStats,
    goSportSelect, selectSport, confirmSportSelection, unlockSport,
    goRallySelect, selectRallyTrack, startRallyRun, onRallyBoostPress, replayRally, rallyBackToSelect,
  };
}
