// ═══════════════════════════════════════════════════════════════
// games/belote/ui.js — solo (joueur en siège 0) contre 3 IA (sièges
// 1,2,3). Équipes : 0+2 contre 1+3. Ordre d'enchère simplifié :
// joueur puis les 3 IA dans l'ordre des sièges (documenté comme
// simplification — la règle réelle fait enchérir après le donneur).
// ═══════════════════════════════════════════════════════════════
import { deal, trickWinner, legalMoves, computeHandPoints, checkBeloteBonus, cardValue, ACHIEVEMENTS } from './logic.js';
import { aiDecideTake, aiChooseCard } from './ai.js';

const TARGET_SCORE = 501;
const teamOf = (i) => i % 2;

export function createUI(sdk) {
  let CONFIG = { difficulty: 'normal' };
  let matchScore = { 0: 0, 1: 0 };
  let hands, trumpSuit, takerIdx, tricksWon, currentTrick, leader, handsCopy;
  let phase = 'bidding'; // bidding | playing | handOver | matchOver
  let bidStep = 0;
  let beloteAnnounced = { 0: false, 1: false };
  let lastTrickWinnerLabel = '';

  function setDifficulty(d) {
    CONFIG.difficulty = d;
    ['Easy', 'Normal', 'Hard'].forEach((k) => document.getElementById('diff' + k).classList.toggle('sel', (k === 'Hard' ? 'difficile' : k.toLowerCase()) === d));
  }

  function startMatch() {
    matchScore = { 0: 0, 1: 0 };
    sdk.navigation.go('sg');
    startHand();
  }

  function startHand(rng = Math.random) {
    const dealt = deal(rng);
    hands = dealt.hands;
    trumpSuit = dealt.proposedSuit;
    takerIdx = null;
    bidStep = 0;
    phase = 'bidding';
    render();
    processBidStep();
  }

  function processBidStep() {
    if (bidStep >= 4) { startHand(); return; } // personne n'a pris : redistribution
    if (bidStep === 0) { render(); return; } // attend la décision du joueur (siège 0)
    // IA décide
    const takes = aiDecideTake(hands[bidStep], trumpSuit, CONFIG.difficulty);
    if (takes) { takerIdx = bidStep; beginPlay(); return; }
    bidStep++;
    setTimeout(processBidStep, 350);
  }

  function playerBid(takes) {
    if (phase !== 'bidding' || bidStep !== 0) return;
    if (takes) { takerIdx = 0; beginPlay(); return; }
    bidStep = 1;
    processBidStep();
  }

  function beginPlay() {
    phase = 'playing';
    tricksWon = { 0: [], 1: [] };
    currentTrick = [];
    leader = 0;
    handsCopy = hands.map((h) => [...h]);
    beloteAnnounced = { 0: false, 1: false };
    render();
    maybeAiPlay();
  }

  function myTurn() { return currentTrick.length === 0 ? leader === 0 : (leader + currentTrick.length) % 4 === 0; }

  function onCardClick(card) {
    if (phase !== 'playing') return;
    const playerIdx = (leader + currentTrick.length) % 4;
    if (playerIdx !== 0) return;
    const legal = legalMoves(handsCopy[0], currentTrick, trumpSuit, teamOf, 0);
    if (!legal.some((c) => c.id === card.id)) { sdk.audio.play('error'); sdk.toast.show('Coup non autorisé — tu dois fournir ou couper si possible'); return; }
    playCard(0, card);
  }

  function playCard(playerIdx, card) {
    const hand = handsCopy[playerIdx];
    const idx = hand.findIndex((c) => c.id === card.id);
    hand.splice(idx, 1);
    currentTrick.push({ playerIdx, card });
    sdk.audio.play('click');
    // Belote/Rebelote : annonce automatique si le joueur (équipe 0 en solo) pose K puis Q d'atout (ou l'inverse)
    if (card.suit === trumpSuit && (card.rank === 'K' || card.rank === 'Q')) {
      const beloteTeam = checkBeloteBonus([hands[0], hands[1], hands[2], hands[3]], trumpSuit, teamOf);
      if (beloteTeam !== null) {
        // vérifie si l'AUTRE carte du couple a déjà été jouée par la même équipe cette manche
        const otherRank = card.rank === 'K' ? 'Q' : 'K';
        const alreadyPlayedOther = [...tricksWon[0], ...tricksWon[1], ...currentTrick.map((p) => p.card)]
          .some((c) => c.suit === trumpSuit && c.rank === otherRank);
        if (alreadyPlayedOther && !beloteAnnounced[beloteTeam]) {
          beloteAnnounced[beloteTeam] = true;
          sdk.toast.show(beloteTeam === teamOf(0) ? '💑 Belote-Rebelote pour vous ! +20' : '💑 Belote-Rebelote pour l\u2019adversaire');
        }
      }
    }
    render();
    if (currentTrick.length === 4) { setTimeout(resolveTrick, 700); return; }
    maybeAiPlay();
  }

  function maybeAiPlay() {
    if (phase !== 'playing') return;
    const playerIdx = (leader + currentTrick.length) % 4;
    if (playerIdx === 0) return;
    setTimeout(() => {
      const card = aiChooseCard(handsCopy[playerIdx], currentTrick, trumpSuit, teamOf, playerIdx, CONFIG.difficulty);
      playCard(playerIdx, card);
    }, 500);
  }

  function resolveTrick() {
    const winnerIdx = trickWinner(currentTrick, trumpSuit);
    tricksWon[teamOf(winnerIdx)].push(...currentTrick.map((p) => p.card));
    lastTrickWinnerLabel = winnerIdx === 0 ? 'Toi' : teamOf(winnerIdx) === 0 ? 'Ton partenaire' : `Adversaire (siège ${winnerIdx})`;
    leader = winnerIdx;
    currentTrick = [];
    if (handsCopy.every((h) => h.length === 0)) { endHand(); return; }
    render();
    maybeAiPlay();
  }

  function endHand() {
    phase = 'handOver';
    let pts = computeHandPoints(tricksWon, trumpSuit);
    const beloteTeam = checkBeloteBonus(hands, trumpSuit, teamOf);
    if (beloteTeam !== null && beloteAnnounced[beloteTeam]) pts[beloteTeam] += 20;
    pts[teamOf(leader)] += 10; // dix de der

    const takerTeam = teamOf(takerIdx);
    const capotTeam = tricksWon[0].length === 32 ? 0 : tricksWon[1].length === 32 ? 1 : null;
    let handScore = { 0: 0, 1: 0 };
    if (capotTeam !== null) {
      handScore[capotTeam] = 250;
      if (capotTeam === takerTeam) sdk.achievements.unlock('capot', 'Capot', '👑');
    } else if (pts[takerTeam] > 81) {
      handScore = pts;
    } else {
      // "dans les choux" : l'équipe preneuse n'a pas dépassé 81 points,
      // tout (162) va à l'équipe adverse. La Belote reste acquise à
      // l'équipe qui l'a annoncée même dans ce cas (règle standard).
      handScore[1 - takerTeam] = 162;
      if (beloteTeam === takerTeam) { handScore[takerTeam] = 20; handScore[1 - takerTeam] = 142; }
    }
    matchScore[0] += handScore[0];
    matchScore[1] += handScore[1];

    if (beloteAnnounced[0] || beloteAnnounced[1]) sdk.achievements.unlock('belote', 'Belote-Rebelote', '💑');
    if (handScore[0] >= 150 || handScore[1] >= 150) sdk.achievements.unlock('big_win', 'Écrasant', '💪');

    render();
    if (matchScore[0] >= TARGET_SCORE || matchScore[1] >= TARGET_SCORE) {
      setTimeout(finishMatch, 1500);
    }
  }

  function finishMatch() {
    phase = 'matchOver';
    sdk.stats.increment('games');
    const humanWon = matchScore[0] > matchScore[1];
    if (humanWon) {
      sdk.stats.increment('wins');
      sdk.achievements.unlock('first_win', 'Première Victoire', '🎯');
      sdk.audio.play('win');
    } else {
      sdk.stats.increment('losses');
      sdk.audio.play('lose');
    }
    render();
  }

  function nextHand() { startHand(); }
  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  // ── Rendu ──
  function render() {
    const handHost = document.getElementById('myHandBelote');
    handHost.innerHTML = '';
    if (hands) {
      const legal = phase === 'playing' && myTurn() ? legalMoves(handsCopy[0], currentTrick, trumpSuit, teamOf, 0).map((c) => c.id) : [];
      (handsCopy ? handsCopy[0] : hands[0]).forEach((card) => {
        const el = document.createElement('div');
        const isRed = card.suit === '♥' || card.suit === '♦';
        el.className = 'bcard' + (legal.includes(card.id) ? ' playable' : '');
        el.style.color = isRed ? '#dc2626' : '#111';
        el.innerHTML = `<div class="r">${card.rank}</div><div class="s">${card.suit}</div>`;
        el.onclick = () => onCardClick(card);
        handHost.appendChild(el);
      });
    }

    const trickHost = document.getElementById('trickBelote');
    trickHost.innerHTML = '';
    (currentTrick || []).forEach((p) => {
      const el = document.createElement('div');
      const isRed = p.card.suit === '♥' || p.card.suit === '♦';
      el.className = 'bcard small';
      el.style.color = isRed ? '#dc2626' : '#111';
      el.innerHTML = `<div class="r">${p.card.rank}</div><div class="s">${p.card.suit}</div>`;
      trickHost.appendChild(el);
    });

    document.getElementById('scoreBelote').textContent = `${matchScore[0]} — ${matchScore[1]}`;
    document.getElementById('trumpBelote').textContent = trumpSuit ? `Atout : ${trumpSuit}` : '';

    document.getElementById('biddingBelote').style.display = phase === 'bidding' && bidStep === 0 ? '' : 'none';
    document.getElementById('handOverBelote').style.display = phase === 'handOver' ? '' : 'none';
    document.getElementById('matchOverBelote').style.display = phase === 'matchOver' ? '' : 'none';
    if (phase === 'matchOver') {
      document.getElementById('matchOverBelote').textContent = matchScore[0] > matchScore[1] ? '🏆 Ton équipe gagne la partie !' : '💀 L\u2019équipe adverse gagne...';
    }

    document.getElementById('statusBelote').textContent =
      phase === 'bidding' ? (bidStep === 0 ? `On te propose l'atout ${trumpSuit} — prends-tu ?` : 'Les autres joueurs enchérissent…') :
      phase === 'playing' ? (myTurn() ? 'À toi de jouer' : 'En attente des autres joueurs…') :
      phase === 'handOver' ? `Manche terminée (dernier pli : ${lastTrickWinnerLabel})` : '';
  }

  function renderHome() {
    const host = document.getElementById('homeStatsBelote');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('wins'), l: '🏆 Victoires' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListBelote');
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
  function showRules() {
    const overlay = document.getElementById('modalOverlay');
    overlay.innerHTML = `<div class="ondine-modal-box"><div class="ondine-modal-title">🃏 Règles de Belote</div>
      <div class="ondine-modal-body">Variante française classique, 4 joueurs en 2 équipes (toi + partenaire face à toi contre 2 adversaires).<br><br>
      Une seule enchère : prends l'atout proposé ou passe. Si tout le monde passe, nouvelle donne.<br><br>
      <b>Obligatoire</b> : fournir la couleur demandée ; si impossible, couper (sauf si ton partenaire est déjà maître du pli).<br><br>
      Valet et 9 d'atout sont les cartes les plus fortes. Belote-Rebelote (Roi+Dame d'atout) = 20 points. Premier à ${TARGET_SCORE} points gagne la partie.</div>
      <div class="ondine-modal-actions"><button class="ondine-btn ondine-btn-primary" id="mdCloseB">Compris !</button></div></div>`;
    overlay.classList.remove('hidden');
    document.getElementById('mdCloseB').onclick = () => overlay.classList.add('hidden');
  }

  return { setDifficulty, startMatch, playerBid, nextHand, goHome, showStats, showRules, renderHome };
}
