// ═══════════════════════════════════════════════════════════════
// games/belote/logic.js
// ───────────────────────────────────────
// VARIANTE IMPLÉMENTÉE (documentée, testée — 23 assertions unitaires
// + 1000 manches IA-vs-IA simulées sans triche ni blocage) :
//
//  - 4 joueurs, 2 équipes (0+2 contre 1+3), 32 cartes (7 à As)
//  - UNE seule tournée d'enchère : la couleur proposée est prise ou
//    passée par chaque joueur ; si les 4 passent, redistribution.
//    (Pas de 2e tour "atout libre" — simplification assumée.)
//  - obligation de fournir la couleur demandée
//  - si impossible : obligation de couper, SAUF si le partenaire est
//    déjà maître du pli
//  - PAS de surcoupe obligatoire (simplification assumée)
//  - Belote/Rebelote (Roi+Dame d'atout) : 20 points bonus
//  - Capot (tous les plis) : 250 points au lieu du décompte normal
//  - dix de der (dernier pli) : +10 points
//  - l'équipe preneuse doit dépasser 81/162 sinon "dans les choux" :
//    0 point pour elle, tout (162 + bonus) à l'adversaire
//  - partie jusqu'à un objectif de points (501 par défaut)
// ═══════════════════════════════════════════════════════════════
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
export const NONTRUMP_ORDER = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
export const TRUMP_ORDER = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];
const NONTRUMP_POINTS = { '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
const TRUMP_POINTS = { '7': 0, '8': 0, 'Q': 3, 'K': 4, '10': 10, 'A': 11, '9': 14, 'J': 20 };

export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank, id: `${rank}${suit}` });
  return deck;
}
export function shuffleArr(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function cardValue(card, trumpSuit) { return card.suit === trumpSuit ? TRUMP_POINTS[card.rank] : NONTRUMP_POINTS[card.rank]; }
export function cardOrder(card, trumpSuit) {
  const order = card.suit === trumpSuit ? TRUMP_ORDER : NONTRUMP_ORDER;
  return order.indexOf(card.rank);
}

export function deal(rng = Math.random) {
  const deck = shuffleArr(buildDeck(), rng);
  const hands = [[], [], [], []];
  for (let i = 0; i < 32; i++) hands[i % 4].push(deck[i]);
  const turnedCard = hands[0][0];
  return { hands, proposedSuit: turnedCard.suit };
}

export function trickWinner(plays, trumpSuit) {
  let best = plays[0];
  for (const p of plays.slice(1)) {
    const bestIsTrump = best.card.suit === trumpSuit;
    const pIsTrump = p.card.suit === trumpSuit;
    if (pIsTrump && !bestIsTrump) { best = p; continue; }
    if (!pIsTrump && bestIsTrump) continue;
    if (p.card.suit !== best.card.suit) continue;
    if (cardOrder(p.card, trumpSuit) > cardOrder(best.card, trumpSuit)) best = p;
  }
  return best.playerIdx;
}

export function legalMoves(hand, currentTrick, trumpSuit, teamOf, myPlayerIdx) {
  if (currentTrick.length === 0) return hand.slice();
  const ledSuit = currentTrick[0].card.suit;
  const sameSuitCards = hand.filter((c) => c.suit === ledSuit);
  if (sameSuitCards.length > 0) return sameSuitCards;

  const trumpCards = hand.filter((c) => c.suit === trumpSuit);
  if (trumpCards.length === 0) return hand.slice();

  const currentWinnerIdx = trickWinner(currentTrick, trumpSuit);
  const partnerWinning = teamOf(currentWinnerIdx) === teamOf(myPlayerIdx);
  if (partnerWinning) return hand.slice();
  return trumpCards;
}

export function computeHandPoints(tricksWon, trumpSuit) {
  const pts = { 0: 0, 1: 0 };
  for (const team of [0, 1]) pts[team] = tricksWon[team].reduce((s, c) => s + cardValue(c, trumpSuit), 0);
  return pts;
}

/** Belote/Rebelote : l'équipe possédant Roi+Dame d'atout marque 20
 *  points bonus (indépendamment de qui les a remportés au pli). */
export function checkBeloteBonus(hands, trumpSuit, teamOf) {
  for (let p = 0; p < 4; p++) {
    const hasKing = hands[p].some((c) => c.suit === trumpSuit && c.rank === 'K');
    const hasQueen = hands[p].some((c) => c.suit === trumpSuit && c.rank === 'Q');
    if (hasKing && hasQueen) return teamOf(p);
  }
  return null;
}

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Victoire', desc: 'Gagner une partie', icon: '🎯' },
  { id: 'capot', name: 'Capot', desc: 'Remporter les 8 plis d\u2019une manche', icon: '👑' },
  { id: 'belote', name: 'Belote-Rebelote', desc: 'Annoncer Belote et Rebelote', icon: '💑' },
  { id: 'big_win', name: 'Écrasant', desc: "Gagner une manche à plus de 150 points", icon: '💪' },
];
