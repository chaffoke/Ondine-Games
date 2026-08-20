// ═══════════════════════════════════════════════════════════════
// DAMES INTERNATIONALES — plateau 10×10, 50 cases jouables (cases
// sombres), 20 pions par joueur. Règles internationales (PAS les
// dames anglaises simplifiées) :
//  - pions : avancent en diagonale AVANT uniquement (mouvement simple)
//  - captures : pions capturent en diagonale AVANT OU ARRIÈRE
//    (différence clé vs dames anglaises)
//  - capture OBLIGATOIRE dès qu'elle est possible
//  - RÈGLE DE MAJORITÉ : si plusieurs séquences de capture sont
//    possibles, le joueur DOIT choisir celle qui capture le PLUS de
//    pièces (pas de choix libre entre une capture courte et longue)
//  - capture multiple obligatoire : après une prise, si la même
//    pièce peut encore capturer, elle DOIT continuer
//  - dame (roi) : se déplace ET capture à distance illimitée en
//    diagonale ("dame volante"), dans les 4 directions
//  - promotion en dame à l'atteinte de la dernière rangée adverse
// ═══════════════════════════════════════════════════════════════
export const SIZE = 10;

/** Cases jouables : uniquement les cases sombres, indexées 0-49 dans
 *  l'ordre de lecture classique des dames (rangée par rangée). */
export function squareToRC(sq) {
  const row = Math.floor(sq / 5);
  const offset = row % 2 === 0 ? 1 : 0;
  const col = (sq % 5) * 2 + offset;
  return [row, col];
}
export function rcToSquare(row, col) {
  if ((row + col) % 2 === 0) return null; // case claire, non jouable
  const offset = row % 2 === 0 ? 1 : 0;
  return row * 5 + Math.floor((col - offset) / 2);
}

export function createBoard() {
  // board[square] = { color: 'B'|'W', king: bool } | null
  const board = Array(50).fill(null);
  for (let sq = 0; sq < 20; sq++) board[sq] = { color: 'B', king: false }; // Noirs en haut
  for (let sq = 30; sq < 50; sq++) board[sq] = { color: 'W', king: false }; // Blancs en bas
  return board;
}

export const DIRECTIONS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // toutes diagonales

/** Génère les mouvements SIMPLES (non-capture) d'une pièce. Les pions
 *  n'avancent que vers l'avant (Noir vers le bas, Blanc vers le haut). */
export function simpleMoves(board, sq) {
  const piece = board[sq];
  if (!piece) return [];
  const [row, col] = squareToRC(sq);
  const moves = [];
  const dirs = piece.king ? DIRECTIONS : DIRECTIONS.filter(([dr]) => (piece.color === 'B' ? dr === 1 : dr === -1));
  for (const [dr, dc] of dirs) {
    if (piece.king) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        const targetSq = rcToSquare(r, c);
        if (targetSq === null || board[targetSq] !== null) break;
        moves.push({ from: sq, to: targetSq, captures: [] });
        r += dr; c += dc;
      }
    } else {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
      const targetSq = rcToSquare(r, c);
      if (targetSq !== null && board[targetSq] === null) moves.push({ from: sq, to: targetSq, captures: [] });
    }
  }
  return moves;
}

/** Génère toutes les séquences de capture possibles depuis `sq`
 *  (récursif, gère les captures multiples en chaîne). Retourne un
 *  tableau de séquences, chacune { from, to, captures: [squares] }
 *  où `to` est la case finale et `captures` la liste des pièces prises. */
export function captureSequences(board, sq, visitedCaptures = []) {
  const piece = board[sq];
  if (!piece) return [];
  const [row, col] = squareToRC(sq);
  const sequences = [];

  for (const [dr, dc] of DIRECTIONS) {
    if (piece.king) {
      // dame volante : cherche un adversaire à distance, avec des
      // cases vides avant lui, puis peut atterrir sur n'importe
      // quelle case vide après lui dans la même direction
      let r = row + dr, c = col + dc;
      let enemySq = null;
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        const midSq = rcToSquare(r, c);
        if (midSq === null) break;
        if (board[midSq] === null) { r += dr; c += dc; continue; }
        if (board[midSq].color !== piece.color && !visitedCaptures.includes(midSq)) { enemySq = midSq; }
        break;
      }
      if (enemySq !== null) {
        const [er, ec] = squareToRC(enemySq);
        let lr = er + dr, lc = ec + dc;
        while (lr >= 0 && lr < SIZE && lc >= 0 && lc < SIZE) {
          const landSq = rcToSquare(lr, lc);
          if (landSq === null || board[landSq] !== null) break;
          // simule la capture et cherche la suite
          const nextVisited = [...visitedCaptures, enemySq];
          const boardCopy = board.slice();
          boardCopy[sq] = null; boardCopy[landSq] = piece;
          const further = captureSequences(boardCopy, landSq, nextVisited);
          if (further.length) {
            further.forEach((f) => sequences.push({ from: sq, to: f.to, captures: [enemySq, ...f.captures] }));
          } else {
            sequences.push({ from: sq, to: landSq, captures: [enemySq] });
          }
          lr += dr; lc += dc;
        }
      }
    } else {
      const midR = row + dr, midC = col + dc;
      const landR = row + 2 * dr, landC = col + 2 * dc;
      if (landR < 0 || landR >= SIZE || landC < 0 || landC >= SIZE) continue;
      const midSq = rcToSquare(midR, midC);
      const landSq = rcToSquare(landR, landC);
      if (midSq === null || landSq === null) continue;
      if (board[midSq] === null || board[midSq].color === piece.color) continue;
      if (board[landSq] !== null) continue;
      if (visitedCaptures.includes(midSq)) continue;

      const nextVisited = [...visitedCaptures, midSq];
      const boardCopy = board.slice();
      boardCopy[sq] = null; boardCopy[landSq] = piece;
      const further = captureSequences(boardCopy, landSq, nextVisited);
      if (further.length) {
        further.forEach((f) => sequences.push({ from: sq, to: f.to, captures: [midSq, ...f.captures] }));
      } else {
        sequences.push({ from: sq, to: landSq, captures: [midSq] });
      }
    }
  }
  return sequences;
}

/** Tous les coups légaux pour `color` : si des captures existent,
 *  SEULES les séquences capturant le NOMBRE MAXIMAL de pièces sont
 *  légales (règle de majorité) ; sinon, les mouvements simples. */
export function legalMoves(board, color) {
  const pieces = board.map((p, sq) => (p && p.color === color ? sq : null)).filter((sq) => sq !== null);
  let allCaptures = [];
  for (const sq of pieces) allCaptures.push(...captureSequences(board, sq));
  if (allCaptures.length > 0) {
    const maxCaptures = Math.max(...allCaptures.map((c) => c.captures.length));
    return allCaptures.filter((c) => c.captures.length === maxCaptures);
  }
  let moves = [];
  for (const sq of pieces) moves.push(...simpleMoves(board, sq));
  return moves;
}

/** Applique un coup (mouvement simple OU séquence de capture) au
 *  plateau. Retourne un NOUVEAU plateau. Gère la promotion. */
export function applyMove(board, move) {
  const next = board.slice();
  const piece = next[move.from];
  next[move.from] = null;
  move.captures.forEach((sq) => { next[sq] = null; });
  const [toRow] = squareToRC(move.to);
  const promoted = !piece.king && ((piece.color === 'B' && toRow === 9) || (piece.color === 'W' && toRow === 0));
  next[move.to] = { ...piece, king: piece.king || promoted };
  return next;
}

export function countPieces(board, color) { return board.filter((p) => p && p.color === color).length; }
export function hasAnyMove(board, color) { return legalMoves(board, color).length > 0; }

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Victoire', desc: 'Gagner sa première partie', icon: '🎯' },
  { id: 'first_king', name: 'Promotion', desc: 'Promouvoir un pion en dame', icon: '👑' },
  { id: 'multi_capture', name: 'Rafle', desc: 'Capturer 3 pièces ou plus en une seule séquence', icon: '💥' },
  { id: 'beat_hard', name: 'Champion', desc: "Battre l'IA en difficulté Difficile", icon: '⭐' },
];
