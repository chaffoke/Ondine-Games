// ═══════════════════════════════════════════════════════════════
// Card Engine
// ───────────────────────────────────────
// RÔLE : opérations génériques sur un tableau de cartes (peu importe
//        ce qu'est une "carte" — le jeu décide de sa forme : {color,
//        value} pour Uno, {suit,rank} pour Solitaire/Rami/Spider...).
//        Ne connaît ni Uno, ni Solitaire, ni aucune règle de jeu.
// NE DOIT JAMAIS : contenir une notion de combinaison valide (suite/
//        groupe de Rami, séquence de Spider), de carte "jouable"
//        (Uno), ou de score de main — ça reste dans chaque jeu.
// ───────────────────────────────────────
// Extrait tel quel du CoreBundle Batch 1 (déjà utilisé par Uno).
// Candidat de migration pour Solitaire/Rami/Spider (jamais branchés
// à ce moteur malgré une structure de carte compatible — voir
// architecture, section 5). PAS pertinent pour Road Trip (cartes à
// effet, pas des cartes à jouer), Memory (pas de main/pioche) ni
// Mahjong (tuiles, géométrie différente).
// ═══════════════════════════════════════════════════════════════
import { shuffle } from './RandomEngine.js';

/** Construit un deck mélangé à partir d'une liste de cartes (copie,
 *  ne mute jamais le tableau source — voir RandomEngine.shuffle). */
export function createDeck(cards) {
  return shuffle([...cards]);
}

/** Retire et retourne les `n` cartes du dessus (fin du tableau = dessus). */
export function draw(deck, n = 1) {
  return deck.splice(Math.max(0, deck.length - n), n).reverse();
}

/** Distribue `cardsPerPlayer` cartes à `playerCount` joueurs, à tour de
 *  rôle (comme une vraie distribution), depuis le sommet du deck. */
export function deal(deck, playerCount, cardsPerPlayer) {
  const hands = Array.from({ length: playerCount }, () => []);
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let p = 0; p < playerCount; p++) {
      const card = draw(deck, 1)[0];
      if (card) hands[p].push(card);
    }
  }
  return hands;
}

/**
 * Reconstitue un deck épuisé à partir d'une pile de défausse, en
 * gardant la carte du dessus en place (pattern stock/waste commun à
 * Solitaire, Uno, Rami, Spider).
 */
export function reshuffleDiscardIntoDeck(discardPile, keepTopCard = true) {
  if (discardPile.length <= 1) return [];
  const top = keepTopCard ? discardPile.pop() : null;
  const rest = shuffle(discardPile.splice(0, discardPile.length));
  if (top) discardPile.push(top);
  return rest;
}
