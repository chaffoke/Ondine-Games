// ═══════════════════════════════════════════════════════════════
// ÉCHECS — plateau 8×8, règles complètes : roque, prise en passant,
// promotion (auto-Dame, simplification documentée), échec/mat/pat,
// interdiction de laisser son propre roi en échec.
// Représentation : board[64], index = row*8+col, row 0 = rangée 8
// (noir), row 7 = rangée 1 (blanc). Pièce = {type, color, hasMoved}.
// ═══════════════════════════════════════════════════════════════
export const FILES = 'abcdefgh';

export function idx(r, c) { return r * 8 + c; }
export function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
export function squareName(i) { const r = Math.floor(i / 8), c = i % 8; return FILES[c] + (8 - r); }

export function createInitialBoard() {
  const board = Array(64).fill(null);
  const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) {
    board[idx(0, c)] = { type: backRank[c], color: 'b', hasMoved: false };
    board[idx(1, c)] = { type: 'P', color: 'b', hasMoved: false };
    board[idx(6, c)] = { type: 'P', color: 'w', hasMoved: false };
    board[idx(7, c)] = { type: backRank[c], color: 'w', hasMoved: false };
  }
  return board;
}

export function createGame() {
  return { board: createInitialBoard(), turn: 'w', enPassantTarget: null, over: false, result: null, history: [] };
}

const KNIGHT_DELTAS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_DELTAS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

/** Coups PSEUDO-légaux d'une pièce (ignore si ça laisse le roi en
 *  échec — filtré séparément par legalMoves). Inclut roque/en passant. */
export function pseudoMoves(state, sq) {
  const { board } = state;
  const piece = board[sq];
  if (!piece) return [];
  const r = Math.floor(sq / 8), c = sq % 8;
  const moves = [];
  const enemy = piece.color === 'w' ? 'b' : 'w';

  function tryAdd(rr, cc, mustCapture = null) {
    if (!inBounds(rr, cc)) return false;
    const target = idx(rr, cc);
    const occ = board[target];
    if (occ && occ.color === piece.color) return false;
    if (mustCapture === true && !occ) return false;
    if (mustCapture === false && occ) return false;
    moves.push({ from: sq, to: target, piece, capture: !!occ });
    return !occ; // true = case vide, peut continuer la glissade
  }

  if (piece.type === 'P') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRow = piece.color === 'w' ? 6 : 1;
    const promoRow = piece.color === 'w' ? 0 : 7;
    // avance simple
    if (inBounds(r + dir, c) && !board[idx(r + dir, c)]) {
      moves.push({ from: sq, to: idx(r + dir, c), piece, capture: false, promotion: r + dir === promoRow });
      if (r === startRow && !board[idx(r + 2 * dir, c)]) {
        moves.push({ from: sq, to: idx(r + 2 * dir, c), piece, capture: false, doubleStep: true });
      }
    }
    // captures diagonales
    for (const dc of [-1, 1]) {
      const rr = r + dir, cc = c + dc;
      if (!inBounds(rr, cc)) continue;
      const target = idx(rr, cc);
      if (board[target] && board[target].color === enemy) {
        moves.push({ from: sq, to: target, piece, capture: true, promotion: rr === promoRow });
      } else if (target === state.enPassantTarget) {
        moves.push({ from: sq, to: target, piece, capture: true, enPassant: true });
      }
    }
  } else if (piece.type === 'N') {
    for (const [dr, dc] of KNIGHT_DELTAS) tryAdd(r + dr, c + dc);
  } else if (piece.type === 'K') {
    for (const [dr, dc] of KING_DELTAS) tryAdd(r + dr, c + dc);
    // roque géré séparément dans legalMoves (nécessite l'état d'échec)
  } else {
    const dirs = piece.type === 'B' ? BISHOP_DIRS : piece.type === 'R' ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        if (!tryAdd(rr, cc)) break;
        rr += dr; cc += dc;
      }
    }
  }
  return moves;
}

/** Vrai si `sq` est attaquée par une pièce de couleur `byColor`. */
export function isSquareAttacked(board, sq, byColor) {
  const r = Math.floor(sq / 8), c = sq % 8;
  // pions
  const pawnDir = byColor === 'w' ? 1 : -1; // un pion attaque "vers l'arrière" depuis la perspective de la case attaquée
  for (const dc of [-1, 1]) {
    const rr = r + pawnDir, cc = c + dc;
    if (inBounds(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p && p.type === 'P' && p.color === byColor) return true;
    }
  }
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const rr = r + dr, cc = c + dc;
    if (inBounds(rr, cc)) { const p = board[idx(rr, cc)]; if (p && p.type === 'N' && p.color === byColor) return true; }
  }
  for (const [dr, dc] of KING_DELTAS) {
    const rr = r + dr, cc = c + dc;
    if (inBounds(rr, cc)) { const p = board[idx(rr, cc)]; if (p && p.type === 'K' && p.color === byColor) return true; }
  }
  for (const [dr, dc] of BISHOP_DIRS) {
    let rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p) { if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  for (const [dr, dc] of ROOK_DIRS) {
    let rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p) { if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

export function findKing(board, color) {
  return board.findIndex((p) => p && p.type === 'K' && p.color === color);
}
export function isInCheck(board, color) {
  const kingSq = findKing(board, color);
  return kingSq !== -1 && isSquareAttacked(board, kingSq, color === 'w' ? 'b' : 'w');
}

/** Applique un coup à une COPIE du plateau (ne mute pas). Gère
 *  capture, en passant, roque, promotion (auto-Dame). */
export function applyMoveToBoard(board, move) {
  const next = board.slice();
  const piece = { ...next[move.from], hasMoved: true };
  next[move.from] = null;
  if (move.enPassant) {
    const dir = piece.color === 'w' ? 1 : -1;
    const capturedSq = move.to + dir * 8;
    next[capturedSq] = null;
  }
  if (move.castle) {
    const row = Math.floor(move.from / 8);
    if (move.castle === 'king') {
      next[idx(row, 5)] = { ...next[idx(row, 7)], hasMoved: true };
      next[idx(row, 7)] = null;
    } else {
      next[idx(row, 3)] = { ...next[idx(row, 0)], hasMoved: true };
      next[idx(row, 0)] = null;
    }
  }
  next[move.to] = move.promotion ? { type: 'Q', color: piece.color, hasMoved: true } : piece;
  return next;
}

/** Génère les coups de roque légaux pour `color`. */
export function castleMoves(state, color) {
  const { board } = state;
  const row = color === 'w' ? 7 : 0;
  const kingSq = idx(row, 4);
  const king = board[kingSq];
  if (!king || king.type !== 'K' || king.hasMoved) return [];
  if (isInCheck(board, color)) return [];
  const enemy = color === 'w' ? 'b' : 'w';
  const moves = [];
  // petit roque (roi-tour h)
  const rookK = board[idx(row, 7)];
  if (rookK && rookK.type === 'R' && !rookK.hasMoved && !board[idx(row, 5)] && !board[idx(row, 6)]) {
    if (!isSquareAttacked(board, idx(row, 5), enemy) && !isSquareAttacked(board, idx(row, 6), enemy)) {
      moves.push({ from: kingSq, to: idx(row, 6), piece: king, capture: false, castle: 'king' });
    }
  }
  // grand roque (roi-tour a)
  const rookQ = board[idx(row, 0)];
  if (rookQ && rookQ.type === 'R' && !rookQ.hasMoved && !board[idx(row, 1)] && !board[idx(row, 2)] && !board[idx(row, 3)]) {
    if (!isSquareAttacked(board, idx(row, 3), enemy) && !isSquareAttacked(board, idx(row, 2), enemy)) {
      moves.push({ from: kingSq, to: idx(row, 2), piece: king, capture: false, castle: 'queen' });
    }
  }
  return moves;
}

/** Tous les coups LÉGAUX de `color` (filtre les coups qui laissent
 *  son propre roi en échec — règle fondamentale). */
export function legalMoves(state, color) {
  const { board } = state;
  const pieces = board.map((p, sq) => (p && p.color === color ? sq : null)).filter((sq) => sq !== null);
  let moves = [];
  for (const sq of pieces) moves.push(...pseudoMoves(state, sq));
  moves.push(...castleMoves(state, color));
  return moves.filter((m) => {
    const nextBoard = applyMoveToBoard(board, m);
    return !isInCheck(nextBoard, color);
  });
}

/** Applique un coup complet à l'état de jeu (plateau + tour + en
 *  passant + détection fin de partie). Ne mute pas `state`. */
export function makeMove(state, move) {
  const board = applyMoveToBoard(state.board, move);
  const nextTurn = state.turn === 'w' ? 'b' : 'w';
  const enPassantTarget = move.doubleStep ? (move.from + move.to) / 2 : null;
  const nextState = { ...state, board, turn: nextTurn, enPassantTarget, history: [...state.history, move] };
  const legal = legalMoves(nextState, nextTurn);
  const inCheck = isInCheck(board, nextTurn);
  if (legal.length === 0) {
    nextState.over = true;
    nextState.result = inCheck ? (nextTurn === 'w' ? 'black_wins' : 'white_wins') : 'draw_stalemate';
  }
  return nextState;
}

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Victoire', desc: 'Gagner sa première partie', icon: '🎯' },
  { id: 'castle', name: 'À l\u2019Abri', desc: 'Roquer pour la première fois', icon: '🏰' },
  { id: 'promotion', name: 'Promotion', desc: 'Promouvoir un pion en Dame', icon: '👑' },
  { id: 'beat_hard', name: 'Grand Maître', desc: "Battre l'IA en difficulté Difficile", icon: '⭐' },
];
