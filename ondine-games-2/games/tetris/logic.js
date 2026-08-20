// ═══════════════════════════════════════════════════════════════
// TETRIS — grille 10×20 (col×row), 7 pièces classiques (SRS simplifié
// : rotation par table de formes précalculées par état 0-3, pas de
// wall-kick complexe — documenté comme simplification ; les
// rotations proches d'un mur/pièce sont simplement refusées si elles
// provoqueraient une collision, plutôt que "kické").
// ═══════════════════════════════════════════════════════════════
export const COLS = 10, ROWS = 20;

// Chaque pièce : 4 états de rotation, chacun un tableau de [dx,dy]
// relatifs à un point de pivot. Formes classiques standard.
export const SHAPES = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  O: [
    [[0,0],[1,0],[0,1],[1,1]],
    [[0,0],[1,0],[0,1],[1,1]],
    [[0,0],[1,0],[0,1],[1,1]],
    [[0,0],[1,0],[0,1],[1,1]],
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ],
};
export const PIECE_TYPES = Object.keys(SHAPES);

export function createEmptyGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }

export function randomBag(rng = Math.random) {
  // "7-bag" : chaque sac de 7 pièces contient exactement une fois
  // chaque type, mélangé — évite les longues sécheresses d'une pièce
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  return bag;
}

export function spawnPiece(type) {
  return { type, rotation: 0, x: 3, y: 0 };
}

export function pieceCells(piece) {
  return SHAPES[piece.type][piece.rotation].map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
}

export function isValidPosition(grid, piece) {
  return pieceCells(piece).every(([x, y]) => {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y < 0) return true; // au-dessus de la grille (spawn), toléré
    return grid[y][x] === null;
  });
}

export function move(grid, piece, dx, dy) {
  const next = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return isValidPosition(grid, next) ? next : piece;
}

export function rotate(grid, piece) {
  const next = { ...piece, rotation: (piece.rotation + 1) % 4 };
  if (isValidPosition(grid, next)) return next;
  return piece; // rotation refusée si collision (pas de wall-kick — simplification documentée)
}

export function hardDrop(grid, piece) {
  let p = piece;
  while (isValidPosition(grid, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  return p;
}

/** Verrouille la pièce dans la grille. Retourne une NOUVELLE grille. */
export function lockPiece(grid, piece) {
  const next = grid.map((row) => row.slice());
  pieceCells(piece).forEach(([x, y]) => { if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = piece.type; });
  return next;
}

/** Supprime les lignes complètes. Retourne { grid, linesCleared }. */
export function clearLines(grid) {
  const remaining = grid.filter((row) => row.some((cell) => cell === null));
  const linesCleared = ROWS - remaining.length;
  const newRows = Array.from({ length: linesCleared }, () => Array(COLS).fill(null));
  return { grid: [...newRows, ...remaining], linesCleared };
}

export function isGameOver(grid, piece) {
  return !isValidPosition(grid, piece);
}

const SCORE_TABLE = { 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 };
export function scoreForLines(n, level) { return (SCORE_TABLE[n] || 0) * level; }
export function levelForLines(totalLines) { return 1 + Math.floor(totalLines / 10); }
export function speedForLevel(level) { return Math.max(80, 800 - (level - 1) * 60); }

export const ACHIEVEMENTS = [
  { id: 'first_line', name: 'Première Ligne', desc: 'Supprimer sa première ligne', icon: '🎯' },
  { id: 'tetris_clear', name: 'TETRIS !', desc: 'Supprimer 4 lignes simultanément', icon: '🏆' },
  { id: 'level_10', name: 'Niveau 10', desc: 'Atteindre le niveau 10', icon: '🔥' },
];
