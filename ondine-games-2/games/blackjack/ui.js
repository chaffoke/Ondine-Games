// ═══════════════════════════════════════════════════════════════
// games/blackjack/ui.js
// ═══════════════════════════════════════════════════════════════
import { buildDeck, shuffleArr, handValue, isBust, isBlackjack, createRound, hit, stand, double, split, computeResult, ACHIEVEMENTS } from './logic.js';

const STARTING_BANKROLL = 500;

export function createUI(sdk) {
  let round = null;
  let bet = 25;
  let bankroll = sdk.stats.get('bankroll', STARTING_BANKROLL);
  let winStreak = 0;

  function setBet(amount) {
    bet = Math.max(5, Math.min(bankroll, amount));
    document.getElementById('currentBet').textContent = bet;
  }

  function startRound() {
    if (bankroll < bet) { sdk.toast.show('Solde insuffisant pour cette mise'); return; }
    const deck = shuffleArr(buildDeck());
    round = createRound(deck);
    round.playerHands[0].bet = bet;
    sdk.navigation.go('sg');
    if (isBlackjack(round.playerHands[0].cards)) {
      // Blackjack naturel : la main est automatiquement terminée, on
      // passe directement au croupier via stand() (chemin normal du
      // moteur, pas un court-circuit de phase à la main).
      round = stand(round);
    }
    render();
    checkRoundEnd();
  }

  function onHit() { round = hit(round); render(); checkRoundEnd(); }
  function onStand() { round = stand(round); render(); checkRoundEnd(); }
  function onDouble() {
    if (bankroll < round.playerHands[round.activeHandIdx].bet * 2) { sdk.toast.show('Solde insuffisant pour doubler'); return; }
    round = double(round); render(); checkRoundEnd();
  }
  function onSplit() {
    if (bankroll < round.playerHands[0].bet * 2) { sdk.toast.show('Solde insuffisant pour split'); return; }
    round = split(round); render();
  }

  function checkRoundEnd() {
    if (round.phase !== 'done' || !round.results) return;
    let totalPayout = 0;
    round.results.forEach((r) => { totalPayout += r.payout; });
    bankroll += totalPayout;
    sdk.stats.set('bankroll', bankroll);
    sdk.stats.increment('roundsPlayed');

    const anyBlackjack = round.results.some((r) => r.outcome === 'blackjack');
    const anyWin = round.results.some((r) => ['win', 'dealer_bust', 'blackjack'].includes(r.outcome));
    if (anyBlackjack) sdk.achievements.unlock('first_blackjack', 'Premier Blackjack', '🎯');
    if (anyWin) { winStreak++; sdk.audio.play('win'); if (winStreak >= 3) sdk.achievements.unlock('streak_3', 'Série de 3', '🔥'); }
    else { winStreak = 0; sdk.audio.play(totalPayout < 0 ? 'error' : 'click'); }
    if (bankroll >= STARTING_BANKROLL * 2) sdk.achievements.unlock('comeback', 'Remontée', '💰');
    sdk.stats.setMax('bestBankroll', bankroll);
    render();
  }

  function nextRound() { startRound(); }
  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  function cardLabel(c) { return `${c.rank}${c.suit}`; }
  function renderHandRow(hostId, cards, hideSecond) {
    const host = document.getElementById(hostId);
    host.innerHTML = '';
    cards.forEach((c, i) => {
      const el = document.createElement('div');
      const hidden = hideSecond && i === 1;
      const isRed = c.suit === '♥' || c.suit === '♦';
      el.className = 'bjcard' + (hidden ? ' back' : '');
      if (!hidden) { el.style.color = isRed ? '#dc2626' : '#111'; el.textContent = cardLabel(c); }
      host.appendChild(el);
    });
  }

  function render() {
    if (!round) return;
    const hideDealer = round.phase === 'player';
    renderHandRow('dealerHand', round.dealerHand, hideDealer);
    document.getElementById('dealerValue').textContent = hideDealer ? '?' : handValue(round.dealerHand);

    const handsHost = document.getElementById('playerHands');
    handsHost.innerHTML = '';
    round.playerHands.forEach((h, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'bj-hand-wrap' + (i === round.activeHandIdx && round.phase === 'player' ? ' active' : '');
      const row = document.createElement('div'); row.className = 'bjhand-row';
      h.cards.forEach((c) => {
        const el = document.createElement('div');
        const isRed = c.suit === '♥' || c.suit === '♦';
        el.className = 'bjcard'; el.style.color = isRed ? '#dc2626' : '#111'; el.textContent = cardLabel(c);
        row.appendChild(el);
      });
      wrap.appendChild(row);
      const info = document.createElement('div'); info.className = 'bj-hand-info';
      info.textContent = `${handValue(h.cards)}${isBust(h.cards) ? ' 💥 Bust' : ''} — mise ${h.bet}`;
      wrap.appendChild(info);
      handsHost.appendChild(wrap);
    });

    document.getElementById('bankrollDisplay').textContent = `💰 ${bankroll}`;
    document.getElementById('currentBet').textContent = bet;

    const isPlayerTurn = round.phase === 'player';
    document.getElementById('bjActions').style.display = isPlayerTurn ? '' : 'none';
    const hand = round.playerHands[round.activeHandIdx];
    document.getElementById('doubleBtn').style.display = (isPlayerTurn && hand && hand.cards.length === 2) ? '' : 'none';
    document.getElementById('splitBtn').style.display = (isPlayerTurn && round.playerHands.length === 1 && hand && hand.cards.length === 2 &&
      require_same_value(hand.cards)) ? '' : 'none';

    const resultsHost = document.getElementById('bjResults');
    if (round.phase === 'done' && round.results) {
      const labels = { blackjack: '🎉 Blackjack !', win: '🏆 Gagné', dealer_bust: '🏆 Croupier bust', push: '🤝 Égalité', lose: '😔 Perdu', bust: '💥 Bust', dealer_blackjack: '😔 Blackjack croupier' };
      resultsHost.innerHTML = round.results.map((r) => `<div>${labels[r.outcome] || r.outcome} (${r.payout >= 0 ? '+' : ''}${r.payout})</div>`).join('');
      resultsHost.style.display = '';
      document.getElementById('nextRoundBtn').style.display = '';
    } else {
      resultsHost.style.display = 'none';
      document.getElementById('nextRoundBtn').style.display = 'none';
    }
  }
  function require_same_value(cards) {
    const val = (c) => (c.rank === 'A' ? 11 : ['V', 'D', 'R'].includes(c.rank) ? 10 : parseInt(c.rank, 10));
    return cards.length === 2 && val(cards[0]) === val(cards[1]);
  }

  function renderHome() {
    bankroll = sdk.stats.get('bankroll', STARTING_BANKROLL);
    const host = document.getElementById('homeStatsBlackjack');
    host.innerHTML = '';
    [{ v: bankroll, l: '💰 Solde' }, { v: sdk.stats.get('roundsPlayed'), l: '🎮 Manches' }, { v: sdk.stats.get('bestBankroll', STARTING_BANKROLL), l: '🏆 Record' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }
  function renderAchievements() {
    const list = document.getElementById('achListBlackjack');
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

  async function resetBankroll() {
    const ok = await sdk.dialog.confirm('Réinitialiser le solde ?', `Retrouve ${STARTING_BANKROLL} jetons virtuels.`, 'Réinitialiser', 'Annuler');
    if (!ok) return;
    bankroll = STARTING_BANKROLL;
    sdk.stats.set('bankroll', bankroll);
    renderHome();
  }

  return { setBet, startRound, onHit, onStand, onDouble, onSplit, nextRound, goHome, showStats, renderHome, resetBankroll };
}
