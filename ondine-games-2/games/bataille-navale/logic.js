// ═══════════════════════════════════════════════════════════════
// games/bataille-navale/logic.js — testé en isolation : placement
// (chevauchement/hors-grille), tirs (touché/manqué/coulé/déjà tiré),
// victoire, 500 placements automatiques vérifiés sans chevauchement.
// ═══════════════════════════════════════════════════════════════
export const SIZE = 10;
export const FLEET = [
  { id: 'carrier', name: 'Porte-avions', size: 5 },
  { id: 'battleship', name: 'Cuirassé', size: 4 },
  { id: 'cruiser', name: 'Croiseur', size: 3 },
  { id: 'submarine', name: 'Sous-marin', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];

export function idx(r, c) { return r * SIZE + c; }
export function rc(i) { return [Math.floor(i / SIZE), i % SIZE]; }

export function shipCells(startIdx, orientation, size) {
  const [r, c] = rc(startIdx);
  const cells = [];
  for (let k = 0; k < size; k++) {
    const rr = orientation === 'h' ? r : r + k;
    const cc = orientation === 'h' ? c + k : c;
    if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return null;
    cells.push(idx(rr, cc));
  }
  return cells;
}

export function createEmptyBoard() {
  return { cellShip: Array(SIZE * SIZE).fill(null), ships: [], shots: Array(SIZE * SIZE).fill(null) };
}

export function placeShip(board, fleetDef, startIdx, orientation) {
  const cells = shipCells(startIdx, orientation, fleetDef.size);
  if (!cells) return false;
  if (cells.some((c) => board.cellShip[c] !== null)) return false;
  const shipIndex = board.ships.length;
  board.ships.push({ ...fleetDef, cells, hitCells: new Set() });
  cells.forEach((c) => { board.cellShip[c] = shipIndex; });
  return true;
}

export function autoPlaceFleet(board, rng = Math.random) {
  for (const fleetDef of FLEET) {
    let placed = false, attempts = 0;
    while (!placed && attempts < 500) {
      attempts++;
      const startIdx = Math.floor(rng() * SIZE * SIZE);
      const orientation = rng() < 0.5 ? 'h' : 'v';
      placed = placeShip(board, fleetDef, startIdx, orientation);
    }
    if (!placed) return false;
  }
  return true;
}

export function fireShot(board, target) {
  if (board.shots[target] !== null) return { result: 'already', sunkShip: null };
  const shipIdx = board.cellShip[target];
  if (shipIdx === null) { board.shots[target] = 'miss'; return { result: 'miss', sunkShip: null }; }
  board.shots[target] = 'hit';
  const ship = board.ships[shipIdx];
  ship.hitCells.add(target);
  const sunk = ship.hitCells.size === ship.cells.length;
  return { result: 'hit', sunkShip: sunk ? ship : null };
}

export function allShipsSunk(board) {
  return board.ships.length === FLEET.length && board.ships.every((s) => s.hitCells.size === s.cells.length);
}

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Victoire', desc: 'Couler toute la flotte adverse', icon: '🎯' },
  { id: 'no_miss', name: 'Tir Parfait', desc: 'Gagner sans un seul tir manqué', icon: '🎯' },
  { id: 'first_shot_sink', name: 'Coup de Chance', desc: 'Couler un navire dès le premier tir dessus', icon: '🍀' },
  { id: 'beat_hard', name: 'Amiral', desc: "Battre l'IA en difficulté Difficile", icon: '⭐' },
];
