// ═══════════════════════════════════════════════════════════════
// games/chess/ai.js
// ───────────────────────────────────────
// Facile : coup légal aléatoire, biaisé vers les captures.
// Normal : recherche à 1 coup (matériel + petite prime positionnelle
//   centre), évite de perdre du matériel gratuitement quand possible.
// Difficile : AI Engine du Core, profondeur 2 (2 demi-coups complets)
//   — volontairement modeste : ce N'EST PAS une IA "niveau maître",
//   juste une recherche réelle et raisonnable pour un jeu mobile
//   standalone, comme demandé explicitement. Une profondeur plus
//   élevée deviendrait trop lente en JS pur sans table de transposition.
// ═══════════════════════════════════════════════════════════════
import { legalMoves, makeMove, isInCheck } from './logic.js';
import { search } from '../../core/engines/AIEngine.js';

const PIECE_VALUES = { P: 1, N: 3, B: 3.2, R: 5, Q: 9, K: 0 };
const CENTER = new Set([27, 28, 35, 36]); // d5,e5,d4,e4 (indices plateau)

function evaluateBoard(board, color) {
  let score = 0;
  board.forEach((p, sq) => {
    if (!p) return;
    let value = PIECE_VALUES[p.type];
    if (CENTER.has(sq) && (p.type === 'N' || p.type === 'P')) value += 0.15;
    score += p.color === color ? value : -value;
  });
  return score;
}

export function chooseAIMove(state, difficulty, rng = Math.random) {
  const moves = legalMoves(state, state.turn);
  if (!moves.length) return null;

  if (difficulty === 'easy') {
    const captures = moves.filter((m) => m.capture);
    if (captures.length && rng() < 0.6) return captures[Math.floor(rng() * captures.length)];
    return moves[Math.floor(rng() * moves.length)];
  }

  if (difficulty === 'normal') {
    let best = moves[0], bestScore = -Infinity;
    for (const m of moves) {
      const next = makeMove(state, m);
      let score = evaluateBoard(next.board, state.turn);
      if (next.over && next.result && next.result.includes('wins')) score += 1000;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // Difficile : recherche via AI Engine générique, profondeur 2
  const color = state.turn;
  const fns = {
    getMoves: (s) => legalMoves(s, s.turn),
    applyMove: (s, move) => makeMove(s, move),
    isTerminal: (s) => s.over,
    evaluate: (s, forColor, depth = 0) => {
      if (s.over) {
        if (s.result === 'draw_stalemate') return 0;
        const winnerIsColor = (s.result === 'white_wins' && forColor === 'w') || (s.result === 'black_wins' && forColor === 'b');
        return winnerIsColor ? 500 + (depth || 0) : -500 - (depth || 0);
      }
      return evaluateBoard(s.board, forColor);
    },
  };
  const result = search({ state, ...fns, depth: 2, maximizingPlayer: color });
  return result.move || moves[Math.floor(rng() * moves.length)];
}
