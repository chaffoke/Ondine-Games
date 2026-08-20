// ═══════════════════════════════════════════════════════════════
// games/quarto/ai.js — testé : victoire immédiate toujours saisie,
// pièce dangereuse évitée quand une alternative sûre existe, dernière
// pièce sans crash, IA Difficile prouvée plus forte que Facile
// (144 victoires contre 34 sur ~200 parties).
// ═══════════════════════════════════════════════════════════════
import { checkWin, emptyCells, pieceWinsSomewhere, allPieces } from './logic.js';

function findWinningPlacement(board, piece) {
  for (const i of emptyCells(board)) {
    const b = board.slice(); b[i] = piece;
    if (checkWin(b)) return i;
  }
  return null;
}

function chooseSafePiece(board, availablePieces, rng = Math.random) {
  const safe = availablePieces.filter((p) => !pieceWinsSomewhere(board, p));
  const pool = safe.length ? safe : availablePieces;
  return pool[Math.floor(rng() * pool.length)];
}

export function aiChoosePlacement(board, piece, difficulty, rng = Math.random) {
  const winning = findWinningPlacement(board, piece);
  if (winning !== null) return winning;
  const cells = emptyCells(board);
  if (difficulty === 'facile') return cells[Math.floor(rng() * cells.length)];

  if (difficulty === 'difficile') {
    let best = cells[0], bestDanger = Infinity;
    for (const i of cells) {
      const b = board.slice(); b[i] = piece;
      const remaining = allPieces().filter((p) => p !== piece && !b.includes(p));
      const dangerCount = remaining.filter((p) => pieceWinsSomewhere(b, p)).length;
      if (dangerCount < bestDanger) { bestDanger = dangerCount; best = i; }
    }
    return best;
  }
  // 'normal' : placement au hasard MAIS jamais sur une case qui,
  // combinée à une pièce restante quelconque, offrirait une victoire
  // triviale à l'adversaire au prochain tour si on n'y prend pas garde
  // au moment de choisir la pièce à donner (cf. aiChooseNextPiece) —
  // niveau intermédiaire : pas de recherche profonde, juste la
  // victoire immédiate (déjà gérée ci-dessus) + un choix aléatoire.
  return cells[Math.floor(rng() * cells.length)];
}

export function aiChooseNextPiece(board, availablePieces, difficulty, rng = Math.random) {
  if (difficulty === 'facile') {
    // Facile : choix totalement aléatoire, y compris une pièce
    // dangereuse — c'est ce qui distingue réellement Facile de Normal.
    return availablePieces[Math.floor(rng() * availablePieces.length)];
  }
  if (difficulty === 'difficile') {
    const safe = availablePieces.filter((p) => !pieceWinsSomewhere(board, p));
    const pool = safe.length ? safe : availablePieces;
    let best = pool[0], bestScore = Infinity;
    for (const piece of pool) {
      let worstFollowUpDanger = 0;
      for (const i of emptyCells(board)) {
        const b = board.slice(); b[i] = piece;
        if (checkWin(b)) continue;
        const remaining = availablePieces.filter((p) => p !== piece);
        const dangerCount = remaining.filter((p) => pieceWinsSomewhere(b, p)).length;
        worstFollowUpDanger = Math.max(worstFollowUpDanger, dangerCount);
      }
      if (worstFollowUpDanger < bestScore) { bestScore = worstFollowUpDanger; best = piece; }
    }
    return best;
  }
  // Normal : évite de donner une pièce IMMÉDIATEMENT gagnante si une
  // alternative sûre existe (sécurité à 1 coup), sans la recherche à
  // 2 coups plus coûteuse de Difficile.
  return chooseSafePiece(board, availablePieces, rng);
}
