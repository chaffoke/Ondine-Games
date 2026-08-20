// ═══════════════════════════════════════════════════════════════
// Grid Engine
// ───────────────────────────────────────
// RÔLE : opérations génériques sur une grille 2D (création, accès,
//        voisinage, flood fill). Ne connaît ni Puissance 4, ni
//        Démineur, ni Sudoku, ni aucune règle de jeu.
// NE DOIT JAMAIS : contenir le mot "mine", "disque", "case sûre" ou
//        toute notion spécifique à un jeu.
// ───────────────────────────────────────
// Extrait tel quel du CoreBundle Batch 1 (déjà utilisé par
// Puissance 4 et Démineur). Engine optionnel : un jeu l'importe
// directement s'il en a besoin, pas obligatoirement via le SDK (pas
// d'état interne, donc pas de risque d'accès croisé entre jeux).
// ═══════════════════════════════════════════════════════════════

/** Crée une grille rows×cols, chaque cellule initialisée à `fill`. */
export function createGrid(rows, cols, fill = null) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (typeof fill === 'function' ? fill() : fill))
  );
}

export function inBounds(grid, r, c) {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
}

export function getCell(grid, r, c) {
  return inBounds(grid, r, c) ? grid[r][c] : undefined;
}

export function setCell(grid, r, c, value) {
  if (inBounds(grid, r, c)) grid[r][c] = value;
}

export function forEachCell(grid, fn) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) fn(grid[r][c], r, c);
  }
}

/** Coordonnées des 4 voisins orthogonaux valides. */
export function neighbors4(grid, r, c) {
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([rr, cc]) =>
    inBounds(grid, rr, cc)
  );
}

/** Coordonnées des 8 voisins (orthogonaux + diagonales) valides. */
export function neighbors8(grid, r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr, cc = c + dc;
      if (inBounds(grid, rr, cc)) out.push([rr, cc]);
    }
  }
  return out;
}

/**
 * Flood fill générique à partir de (r,c). `matchFn(value, r, c)` décide
 * si une cellule doit être incluse dans la propagation ; `visitFn(value, r, c)`
 * est appelé pour chaque cellule visitée (une seule fois). Ne décide
 * jamais lui-même de la condition d'arrêt — c'est au jeu de la fournir.
 */
export function floodFill(grid, startR, startC, matchFn, visitFn, useDiagonals = true) {
  const visited = createGrid(grid.length, grid[0].length, false);
  const stack = [[startR, startC]];
  while (stack.length) {
    const [r, c] = stack.pop();
    if (!inBounds(grid, r, c) || visited[r][c]) continue;
    visited[r][c] = true;
    if (!matchFn(grid[r][c], r, c)) continue;
    visitFn(grid[r][c], r, c);
    const neigh = useDiagonals ? neighbors8(grid, r, c) : neighbors4(grid, r, c);
    for (const [rr, cc] of neigh) if (!visited[rr][cc]) stack.push([rr, cc]);
  }
}

/** Compte les cartes de N valeurs identiques consécutives à partir de
 *  (r,c) dans une direction (dr,dc), dans les deux sens. Utile pour
 *  toute détection d'alignement (Puissance 4, Morpion, Othello...). */
export function countAligned(grid, r, c, dr, dc, matchFn) {
  let count = 1;
  let rr = r + dr, cc = c + dc;
  while (inBounds(grid, rr, cc) && matchFn(grid[rr][cc])) { count++; rr += dr; cc += dc; }
  rr = r - dr; cc = c - dc;
  while (inBounds(grid, rr, cc) && matchFn(grid[rr][cc])) { count++; rr -= dr; cc -= dc; }
  return count;
}
