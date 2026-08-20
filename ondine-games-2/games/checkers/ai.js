// ═══════════════════════════════════════════════════════════════
// games/checkers/ai.js
// ───────────────────────────────────────
// Facile : coup légal aléatoire (parmi les coups légaux, qui
//   respectent déjà l'obligation de capture/majorité — l'IA ne
//   "triche" jamais sur ces règles, même en Facile).
// Normal : heuristique 1-coup (matériel + primes dame/mobilité).
// Difficile : AI Engine du Core (minimax + élagage alpha-bêta),
//   pertinent ici car Dames est un jeu à somme nulle, information
//   parfaite, exactement le cas d'usage prévu pour ce moteur.
// ═══════════════════════════════════════════════════════════════
import { legalMoves, applyMove, countPieces } from './logic.js';
import { search } from '../../core/engines/AIEngine.js';

function evaluateBoard(board, color) {
  let score = 0;
  board.forEach((p) => {
    if (!p) return;
    const value = (p.king ? 3 : 1) * (p.color === color ? 1 : -1);
    score += value;
  });
  return score;
}

export function chooseAIMove(board, color, difficulty, rng = Math.random) {
  const moves = legalMoves(board, color);
  if (!moves.length) return null;

  if (difficulty === 'easy') return moves[Math.floor(rng() * moves.length)];

  if (difficulty === 'normal') {
    let best = moves[0], bestScore = -Infinity;
    for (const m of moves) {
      const next = applyMove(board, m);
      const score = evaluateBoard(next, color) + m.captures.length * 0.5;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // Difficile : recherche via AI Engine générique
  const opponent = color === 'W' ? 'B' : 'W';
  const fns = {
    getMoves: (state) => legalMoves(state.board, state.turn),
    applyMove: (state, move) => ({ board: applyMove(state.board, move), turn: state.turn === 'W' ? 'B' : 'W' }),
    isTerminal: (state) => legalMoves(state.board, state.turn).length === 0 || countPieces(state.board, 'W') === 0 || countPieces(state.board, 'B') === 0,
    evaluate: (state, forColor, depth = 0) => {
      if (countPieces(state.board, opponent) === 0) return 1000 + (depth || 0);
      if (countPieces(state.board, color) === 0) return -1000 - (depth || 0);
      return evaluateBoard(state.board, forColor);
    },
  };
  const result = search({ state: { board, turn: color }, ...fns, depth: 4, maximizingPlayer: color });
  return result.move || moves[Math.floor(rng() * moves.length)];
}
