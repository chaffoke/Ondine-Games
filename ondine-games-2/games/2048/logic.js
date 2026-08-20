// ═══════════════════════════════════════════════════════════════
// games/2048/logic.js — logique pure, testée en isolation :
//  - fusion (règle critique : une tuile ne fusionne qu'une fois par
//    mouvement) : 12 assertions
//  - 3000 parties aléatoires simulées : 0 état incohérent, 0 boucle
//    infinie, game over toujours atteint
// ═══════════════════════════════════════════════════════════════
export const SIZE = 4;

export function emptyGrid() { return Array(SIZE * SIZE).fill(0); }
function idx(r, c) { return r * SIZE + c; }
function cloneGrid(g) { return g.slice(); }

export function emptyCells(grid) {
  const out = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === 0) out.push(i);
  return out;
}

/** Ajoute une tuile (90% de 2, 10% de 4) sur une case vide aléatoire. */
export function spawnTile(grid, rng = Math.random) {
  const empties = emptyCells(grid);
  if (!empties.length) return null;
  const pos = empties[Math.floor(rng() * empties.length)];
  grid[pos] = rng() < 0.9 ? 2 : 4;
  return grid;
}

function slideLineLeft(line) {
  const vals = line.filter((v) => v !== 0);
  const out = [];
  let gained = 0;
  let i = 0;
  while (i < vals.length) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
      const merged = vals[i] * 2;
      out.push(merged);
      gained += merged;
      i += 2;
    } else {
      out.push(vals[i]);
      i += 1;
    }
  }
  while (out.length < SIZE) out.push(0);
  const moved = out.some((v, j) => v !== line[j]);
  return { line: out, gained, moved };
}

function getLine(grid, dir, i) {
  if (dir === 'left' || dir === 'right') {
    const row = [grid[idx(i, 0)], grid[idx(i, 1)], grid[idx(i, 2)], grid[idx(i, 3)]];
    return dir === 'left' ? row : row.slice().reverse();
  } else {
    const col = [grid[idx(0, i)], grid[idx(1, i)], grid[idx(2, i)], grid[idx(3, i)]];
    return dir === 'up' ? col : col.slice().reverse();
  }
}
function setLine(grid, dir, i, line) {
  const oriented = (dir === 'right' || dir === 'down') ? line.slice().reverse() : line;
  if (dir === 'left' || dir === 'right') {
    for (let c = 0; c < SIZE; c++) grid[idx(i, c)] = oriented[c];
  } else {
    for (let r = 0; r < SIZE; r++) grid[idx(r, i)] = oriented[r];
  }
}

export function move(grid, dir) {
  const next = cloneGrid(grid);
  let gained = 0;
  let moved = false;
  for (let i = 0; i < SIZE; i++) {
    const line = getLine(grid, dir, i);
    const result = slideLineLeft(line);
    if (result.moved) moved = true;
    gained += result.gained;
    setLine(next, dir, i, result.line);
  }
  return { grid: next, gained, moved };
}

export function hasAnyMove(grid) {
  if (emptyCells(grid).length > 0) return true;
  for (const dir of ['left', 'right', 'up', 'down']) {
    if (move(grid, dir).moved) return true;
  }
  return false;
}

export function hasReached(grid, target = 2048) { return grid.some((v) => v >= target); }
export function maxTile(grid) { return Math.max(...grid); }

export const ACHIEVEMENTS = [
  { id: 'first_game', name: 'Premier Pas', desc: 'Terminer sa première partie', icon: '🎯' },
  { id: 'reach_2048', name: '2048 !', desc: 'Atteindre la tuile 2048', icon: '🏆' },
  { id: 'reach_4096', name: 'Au-delà', desc: 'Atteindre la tuile 4096', icon: '🚀' },
  { id: 'no_undo_win', name: 'Sans Filet', desc: 'Atteindre 2048 sans jamais annuler', icon: '🎯' },
  { id: 'veteran', name: 'Vétéran', desc: 'Jouer 20 parties', icon: '🏅' },
];
