// ═══════════════════════════════════════════════════════════════
// games/quarto/logic.js — testé en isolation : détection de victoire
// sur les 10 lignes (dont diagonales), match nul, mécanique complète
// pose+don-de-pièce, cas limites (case occupée, pièce déjà utilisée,
// victoire immédiate qui court-circuite le don de pièce suivante).
// Pièce = entier 0-15 (4 bits = 4 attributs binaires).
// ═══════════════════════════════════════════════════════════════
export const LINES = [
  [0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],
  [0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],
  [0,5,10,15],[3,6,9,12],
];

export function allPieces() { return Array.from({ length: 16 }, (_, i) => i); }

export function createGame() {
  return {
    board: Array(16).fill(null),
    availablePieces: allPieces(),
    pieceToPlace: null,
    current: 0,
    over: false,
    winner: null,
    winLine: null,
  };
}

export function lineSharesAttribute(pieces) {
  if (pieces.some((p) => p === null)) return false;
  for (let bit = 0; bit < 4; bit++) {
    const first = (pieces[0] >> bit) & 1;
    if (pieces.every((p) => ((p >> bit) & 1) === first)) return true;
  }
  return false;
}

export function checkWin(board) {
  for (const line of LINES) {
    const pieces = line.map((i) => board[i]);
    if (lineSharesAttribute(pieces)) return { line };
  }
  return null;
}
export function isDraw(board) { return board.every((c) => c !== null) && !checkWin(board); }

export function placeAndGive(state, cellIdx, nextPieceForOpponent) {
  if (state.over) return state;
  if (state.board[cellIdx] !== null) return state;
  if (state.pieceToPlace === null) return state;

  const board = state.board.slice();
  board[cellIdx] = state.pieceToPlace;
  const availablePieces = state.availablePieces.filter((p) => p !== state.pieceToPlace);

  const win = checkWin(board);
  if (win) return { ...state, board, availablePieces, over: true, winner: state.current, winLine: win.line, pieceToPlace: null };
  if (isDraw(board)) return { ...state, board, availablePieces, over: true, winner: 'draw', pieceToPlace: null };

  if (nextPieceForOpponent === undefined || nextPieceForOpponent === null) {
    return { ...state, board, availablePieces, pieceToPlace: null };
  }
  if (!availablePieces.includes(nextPieceForOpponent)) return state;
  return { ...state, board, availablePieces, current: 1 - state.current, pieceToPlace: nextPieceForOpponent };
}

export function giveNextPiece(state, nextPiece) {
  if (state.over) return state;
  if (!state.availablePieces.includes(nextPiece)) return state;
  return { ...state, current: 1 - state.current, pieceToPlace: nextPiece };
}

export function emptyCells(board) {
  const out = [];
  board.forEach((v, i) => { if (v === null) out.push(i); });
  return out;
}

export function pieceWinsSomewhere(board, piece) {
  for (const i of emptyCells(board)) {
    const b = board.slice(); b[i] = piece;
    if (checkWin(b)) return true;
  }
  return false;
}

/** Libellé lisible d'une pièce pour l'affichage (4 attributs). */
export function pieceLabel(piece) {
  const color = (piece & 1) ? '🟤' : '⚪';
  const size = (piece & 2) ? 'grande' : 'petite';
  const shape = (piece & 4) ? '■' : '●';
  const fill = (piece & 8) ? 'pleine' : 'creuse';
  return `${color}${shape} ${size} ${fill}`;
}

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Victoire', desc: 'Gagner sa première partie', icon: '🎯' },
  { id: 'beat_hard', name: 'Stratège', desc: "Battre l'IA en difficulté Difficile", icon: '⭐' },
  { id: 'diagonal_win', name: 'En Diagonale', desc: 'Gagner sur une ligne diagonale', icon: '↗️' },
  { id: 'no_help', name: 'Sans Indice', desc: 'Gagner sans utiliser un indice', icon: '🧠' },
];
