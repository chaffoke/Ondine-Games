// ═══════════════════════════════════════════════════════════════
// games/blackjack/logic.js — testé : valeurs de main (As 11/1),
// bust/Blackjack/push, hit/stand/double/split, croupier (stand on
// all 17s), 5000 manches simulées automatiquement sans crash.
// Bug réel trouvé et corrigé : un sabot du2019un seul jeu de 52 cartes
// pouvait su2019épuiser en cours de manche (undefined.rank au tirage) —
// passage à un sabot de 4 jeux (208 cartes), rend ce cas impossible.
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// BLACKJACK — variante classique documentée :
//  - 1 jeu de 52 cartes (pas de sabot multi-jeux, simplification)
//  - As = 11 ou 1 (calcul automatique du meilleur total ≤21)
//  - Blackjack naturel (As+10/figure en 2 cartes) paie 3:2
//  - Dealer tire jusqu'à 17 INCLUS, s'ARRÊTE sur 17 (soft 17 compris)
//    — règle "dealer stands on all 17s", documentée explicitement
//  - Double : double la mise, tire exactement 1 carte, puis stand
//  - Split : une seule fois (pas de re-split), séparé en 2 mains
//    indépendantes avec mise égale sur chacune — simplification
//    assumée et documentée
//  - Monnaie 100% virtuelle, aucun lien avec de l'argent réel
// ═══════════════════════════════════════════════════════════════
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'];

/** Construit un SABOT de 4 jeux (208 cartes) plutôt qu'un seul jeu de
 *  52 — rend l'épuisement du sabot en cours de manche pratiquement
 *  impossible (même avec plusieurs splits/hits), pas besoin de gérer
 *  un rebattage en cours de manche. Chaque carte reste identifiable
 *  par un id unique (suffixe de copie) pour l'affichage/debug. */
export function buildDeck() {
  const deck = [];
  let copy = 0;
  for (let d = 0; d < 4; d++) {
    for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s, id: `${r}${s}_${copy++}` });
  }
  return deck;
}
export function shuffleArr(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function cardRankValue(rank) {
  if (rank === 'A') return 11;
  if (['V', 'D', 'R'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

/** Calcule le meilleur total ≤21 possible (As compte 11 ou 1). */
export function handValue(hand) {
  let total = hand.reduce((s, c) => s + cardRankValue(c.rank), 0);
  let aces = hand.filter((c) => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
export function isBust(hand) { return handValue(hand) > 21; }
export function isBlackjack(hand) { return hand.length === 2 && handValue(hand) === 21; }
/** "Soft" = contient un As encore compté comme 11. */
export function isSoft(hand) {
  let total = hand.reduce((s, c) => s + cardRankValue(c.rank), 0);
  let aces = hand.filter((c) => c.rank === 'A').length;
  let reduced = 0;
  while (total > 21 && aces > 0) { total -= 10; aces--; reduced++; }
  return aces - reduced > 0 && total <= 21 ? (hand.filter(c=>c.rank==='A').length - reduced) > 0 : false;
}

export function createRound(deck) {
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];
  return { deck, playerHands: [{ cards: playerHand, bet: 1, done: false, doubled: false }], dealerHand, activeHandIdx: 0, phase: 'player', results: null };
}

export function hit(round) {
  if (round.phase !== 'player') return round;
  const hand = round.playerHands[round.activeHandIdx];
  if (hand.done) return round;
  const card = round.deck[round.deck.length - 1];
  const deck = round.deck.slice(0, -1);
  const newCards = [...hand.cards, card];
  const newHands = round.playerHands.slice();
  const bust = isBust(newCards);
  newHands[round.activeHandIdx] = { ...hand, cards: newCards, done: bust };
  return advanceIfNeeded({ ...round, deck, playerHands: newHands });
}

export function stand(round) {
  if (round.phase !== 'player') return round;
  const newHands = round.playerHands.slice();
  newHands[round.activeHandIdx] = { ...newHands[round.activeHandIdx], done: true };
  return advanceIfNeeded({ ...round, playerHands: newHands });
}

export function double(round) {
  if (round.phase !== 'player') return round;
  const hand = round.playerHands[round.activeHandIdx];
  if (hand.cards.length !== 2 || hand.done) return round;
  const card = round.deck[round.deck.length - 1];
  const deck = round.deck.slice(0, -1);
  const newCards = [...hand.cards, card];
  const newHands = round.playerHands.slice();
  newHands[round.activeHandIdx] = { ...hand, cards: newCards, bet: hand.bet * 2, doubled: true, done: true };
  return advanceIfNeeded({ ...round, deck, playerHands: newHands });
}

/** Split : uniquement si la main active a 2 cartes de même valeur, et
 *  qu'aucun split n'a déjà eu lieu (1 seul split autorisé). */
export function split(round) {
  if (round.phase !== 'player' || round.playerHands.length > 1) return round;
  const hand = round.playerHands[round.activeHandIdx];
  if (hand.cards.length !== 2 || cardRankValue(hand.cards[0].rank) !== cardRankValue(hand.cards[1].rank)) return round;
  const deck = round.deck.slice();
  const card1 = deck.pop(), card2 = deck.pop();
  const handA = { cards: [hand.cards[0], card1], bet: hand.bet, done: false, doubled: false };
  const handB = { cards: [hand.cards[1], card2], bet: hand.bet, done: false, doubled: false };
  return { ...round, deck, playerHands: [handA, handB], activeHandIdx: 0 };
}

function advanceIfNeeded(round) {
  const hand = round.playerHands[round.activeHandIdx];
  if (!hand.done) return round;
  const nextIdx = round.playerHands.findIndex((h, i) => i > round.activeHandIdx && !h.done);
  if (nextIdx !== -1) return { ...round, activeHandIdx: nextIdx };
  // toutes les mains sont jouées -> tour du croupier
  return playDealer({ ...round, phase: 'dealer' });
}

/** Le croupier tire jusqu'à 17 (inclus), s'arrête sur 17 (soft 17
 *  compris) — règle documentée "dealer stands on all 17s". Si TOUTES
 *  les mains joueur sont bust, le croupier ne tire même pas (règle
 *  standard : inutile de continuer). */
export function playDealer(round) {
  const allBust = round.playerHands.every((h) => isBust(h.cards));
  let dealerHand = round.dealerHand.slice();
  let deck = round.deck.slice();
  if (!allBust) {
    while (handValue(dealerHand) < 17) {
      dealerHand.push(deck.pop());
    }
  }
  const results = round.playerHands.map((h) => computeResult(h, dealerHand));
  return { ...round, dealerHand, deck, phase: 'done', results };
}

export function computeResult(hand, dealerHand) {
  const playerVal = handValue(hand.cards);
  const dealerVal = handValue(dealerHand);
  const playerBJ = isBlackjack(hand.cards);
  const dealerBJ = isBlackjack(dealerHand);
  if (playerVal > 21) return { outcome: 'bust', payout: -hand.bet };
  if (playerBJ && dealerBJ) return { outcome: 'push', payout: 0 };
  if (playerBJ) return { outcome: 'blackjack', payout: hand.bet * 1.5 };
  if (dealerBJ) return { outcome: 'dealer_blackjack', payout: -hand.bet };
  if (dealerVal > 21) return { outcome: 'dealer_bust', payout: hand.bet };
  if (playerVal > dealerVal) return { outcome: 'win', payout: hand.bet };
  if (playerVal < dealerVal) return { outcome: 'lose', payout: -hand.bet };
  return { outcome: 'push', payout: 0 };
}


export const ACHIEVEMENTS = [
  { id: 'first_blackjack', name: 'Premier Blackjack', desc: 'Obtenir un Blackjack naturel', icon: '🎯' },
  { id: 'streak_3', name: 'Série de 3', desc: '3 victoires consécutives', icon: '🔥' },
  { id: 'comeback', name: 'Remontée', desc: 'Doubler sa mise de départ après avoir été dans le rouge', icon: '💰' },
];
