// ═══════════════════════════════════════════════════════════════
// AI Engine
// ───────────────────────────────────────
// RÔLE : recherche de meilleur coup par minimax + élagage alpha-bêta,
//        entièrement générique. Le jeu fournit les fonctions pures
//        (getMoves, applyMove, isTerminal, evaluate) ; ce moteur ne
//        connaît aucune règle de Puissance 4, Othello, Morpion ou
//        autre.
// NE DOIT JAMAIS : contenir une notion de "disque", de "colonne",
//        de "grille 3×3" ou toute règle spécifique à un jeu.
// ───────────────────────────────────────
// IMPORTANT — ce moteur reste VOLONTAIREMENT en dehors du SDK
// (pas de `sdk.ai`). Sur les 6 jeux ayant une IA adversaire réelle,
// seul Puissance 4 (et Othello/Morpion en migration future) relèvent
// d'une recherche arborescente généralisable — Dames a une
// heuristique de capture propre, Rami et Road Trip ont des IA à
// PRIORITÉS DE RÈGLES (débloquer > avancer > attaquer), pas de
// recherche. Les y forcer serait exactement l'anti-pattern à éviter
// ("ne pas enfermer toutes les IA dans un moteur monolithique" —
// voir architecture, section 5). Un jeu qui a besoin de ce moteur
// l'importe directement, comme un engine, jamais via `sdk.*`.
//
// Contrat attendu (fns) :
//   getMoves(state)                 → tableau de coups possibles
//   applyMove(state, move)          → nouvel état après le coup (ne mute pas)
//   isTerminal(state)               → true si partie finie
//   evaluate(state, player, depth)  → score du point de vue de `player`.
//     `depth` (profondeur RESTANTE) est optionnel mais recommandé
//     pour un score de victoire/défaite (ex: 1000+depth / -1000-depth)
//     — sinon deux victoires à profondeurs différentes sont à égalité
//     et l'IA peut sembler hésiter (bug réel rencontré en développant
//     Puissance 4 : une "double menace" laissait l'IA ignorer un coup
//     gagnant immédiat au profit d'un coup neutre qui gagnait quand
//     même, 2 coups plus tard — ce commentaire est conservé tel quel
//     du CoreBundle d'origine, la leçon reste valable).
// ═══════════════════════════════════════════════════════════════

function minimax(state, depth, alpha, beta, maximizing, player, fns) {
  if (depth === 0 || fns.isTerminal(state)) {
    return fns.evaluate(state, player, depth);
  }
  const moves = fns.getMoves(state);
  if (moves.length === 0) return fns.evaluate(state, player);

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = fns.applyMove(state, move);
      const val = minimax(next, depth - 1, alpha, beta, false, player, fns);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const next = fns.applyMove(state, move);
      const val = minimax(next, depth - 1, alpha, beta, true, player, fns);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/**
 * Retourne le meilleur coup pour `player` à la profondeur `depth`.
 * Si plusieurs coups sont à égalité, un choix aléatoire parmi eux
 * évite un bot parfaitement déterministe et prévisible.
 */
export function chooseBestMove(state, depth, player, fns) {
  const moves = fns.getMoves(state);
  if (moves.length === 0) return null;
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const move of moves) {
    const next = fns.applyMove(state, move);
    const score = minimax(next, depth - 1, -Infinity, Infinity, false, player, fns);
    if (score > bestScore) { bestScore = score; bestMoves = [move]; }
    else if (score === bestScore) bestMoves.push(move);
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/** Coup aléatoire simple — utile pour une difficulté "facile" sans
 *  avoir à écrire un second moteur. */
export function chooseRandomMove(state, fns) {
  const moves = fns.getMoves(state);
  return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
}

/**
 * Façade unique demandée par l'architecture (section 5/13 du brief) :
 * search({ state, getMoves, applyMove, evaluate, depth, maximizingPlayer })
 * → { move, score }
 * Formalise chooseBestMove sous la forme d'objet plutôt que d'inventer
 * une nouvelle signature.
 */
export function search({ state, getMoves, applyMove, isTerminal, evaluate, depth, maximizingPlayer }) {
  const fns = { getMoves, applyMove, isTerminal, evaluate };
  const move = chooseBestMove(state, depth, maximizingPlayer, fns);
  const score = move === null ? evaluate(state, maximizingPlayer) : undefined;
  return { move, score };
}

export const AIEngine = { chooseBestMove, chooseRandomMove, search };
