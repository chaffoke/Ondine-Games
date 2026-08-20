// ═══════════════════════════════════════════════════════════════
// games/reflexe/logic.js — logique pure, sans DOM ni SDK.
// ═══════════════════════════════════════════════════════════════

/** 5 positions possibles pour la cible (grille 5 cases). */
export const POSITIONS = [0, 1, 2, 3, 4];

/** Choisit une position aléatoire — utilise sdk.random.shuffle côté
 *  appelant (voir ui.js), cette fonction reste pure pour rester
 *  testable : elle prend le tableau déjà mélangé en entrée. */
export function pickPosition(shuffledPositions) {
  return shuffledPositions[0];
}

/** Un essai est "raté" si le joueur clique avant que la cible
 *  apparaisse (impatience) — pénalité classique des jeux de réflexe. */
export function isFalseStart(clickedBeforeTargetShown) {
  return clickedBeforeTargetShown === true;
}

export function classifyReactionTime(ms) {
  if (ms < 250) return 'fulgurant';
  if (ms < 400) return 'rapide';
  if (ms < 600) return 'normal';
  return 'lent';
}

export const ACHIEVEMENTS = [
  { id: 'first_try', name: 'Premier Essai', desc: 'Terminer sa première partie', icon: '🎯' },
  { id: 'lightning', name: 'Fulgurant', desc: 'Réagir en moins de 250ms', icon: '⚡' },
  { id: 'veteran', name: 'Vétéran', desc: 'Jouer 10 parties', icon: '🏅' },
  { id: 'no_false_start', name: 'Sang-Froid', desc: 'Terminer sans faux départ', icon: '🧊' },
];
