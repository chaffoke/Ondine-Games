// ═══════════════════════════════════════════════════════════════
// games/morpion/logic.js
// ───────────────────────────────────────
// Logique pure, sans DOM, sans SDK — testable directement en Node.
// RÈGLES INCHANGÉES depuis la version Batch 3 (aucune règle modifiée
// pour "faire rentrer" le jeu dans le SDK, conformément à la
// consigne). Le SDK s'adapte au jeu, pas l'inverse.
// ═══════════════════════════════════════════════════════════════

export const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function checkWinner(board) {
  for (const [a,b,c] of LINES) {
    if (board[a] && board[a]===board[b] && board[b]===board[c]) return { winner: board[a], line: [a,b,c] };
  }
  return null;
}
export function isDraw(board) { return board.every(cell => cell !== null) && !checkWinner(board); }
export function getLegalMoves(board) { return board.map((c,i)=>c===null?i:null).filter(i=>i!==null); }

function minimax(board, player, forPlayer) {
  const win = checkWinner(board);
  if (win) return win.winner === forPlayer ? 10 : -10;
  if (isDraw(board)) return 0;
  const moves = getLegalMoves(board);
  const scores = moves.map(m => { const nb=board.slice(); nb[m]=player; return minimax(nb, player==='X'?'O':'X', forPlayer); });
  return player === forPlayer ? Math.max(...scores) : Math.min(...scores);
}

export function aiImpossibleMove(board, player) {
  const moves = getLegalMoves(board);
  let best = moves[0], bestScore = -Infinity;
  for (const m of moves) {
    const nb = board.slice(); nb[m] = player;
    const score = minimax(nb, player==='X'?'O':'X', player);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}
export function aiRandomMove(board) { const moves = getLegalMoves(board); return moves[Math.floor(Math.random()*moves.length)]; }
export function aiNormalMove(board, player) {
  const opponent = player==='X'?'O':'X';
  const moves = getLegalMoves(board);
  for (const m of moves) { const nb=board.slice(); nb[m]=player; if (checkWinner(nb)) return m; }
  for (const m of moves) { const nb=board.slice(); nb[m]=opponent; if (checkWinner(nb)) return m; }
  if (moves.includes(4)) return 4;
  const corners = [0,2,6,8].filter(c=>moves.includes(c));
  if (corners.length) return corners[Math.floor(Math.random()*corners.length)];
  return moves[Math.floor(Math.random()*moves.length)];
}

export const AI_STRATEGIES = { easy: aiRandomMove, normal: aiNormalMove, impossible: aiImpossibleMove };

export const ACHIEVEMENTS = [
  { id:'first_win', name:'Première Victoire', desc:'Gagner sa première partie', icon:'🎯' },
  { id:'perfect', name:'Parfait', desc:'Gagner sans jamais laisser l\u2019adversaire menacer une ligne', icon:'✨' },
  { id:'beat_ai', name:"Battre l'IA", desc:"Battre l'IA Impossible (bug ou coup de chance !)", icon:'💀' },
  { id:'streak_5', name:'Série de 5', desc:'5 victoires consécutives', icon:'🔥' },
  { id:'invincible', name:'Invincible', desc:'10 parties sans défaite', icon:'🛡️' },
];
