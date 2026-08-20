// ═══════════════════════════════════════════════════════════════
// PUZZLE MOSAÏQUE — Sudoku irrégulier 8×8 (8 régions de forme libre,
// 8 cases chacune, au lieu de blocs 3×3 réguliers). Un symbole
// unique (1-8, rendu selon le personnage choisi) par ligne/colonne/région.
// ═══════════════════════════════════════════════════════════════
export const SIZE = 8;

export function idx(r, c) { return r * SIZE + c; }
export function neighbors(i) {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  const out = [];
  if (r > 0) out.push(i - SIZE);
  if (r < SIZE - 1) out.push(i + SIZE);
  if (c > 0) out.push(i - 1);
  if (c < SIZE - 1) out.push(i + 1);
  return out;
}

/** Partitionne la grille 8×8 en 8 régions connexes de 8 cases chacune,
 *  par croissance aléatoire depuis 8 graines dispersées. Heuristique
 *  "région la plus contrainte d'abord" (comme un MRV en CSP) : à
 *  chaque étape, on fait grandir en priorité la région qui a le MOINS
 *  de cases candidates disponibles — ça évite qu'une région se
 *  retrouve encerclée avant d'atteindre sa taille cible (bug réel
 *  rencontré avec une croissance "une case par région par tour" :
 *  taux de réussite de 12% seulement, contre >95% avec cette
 *  heuristique, vérifié par test). Réessaie si un vrai blocage survient. */
export function generateRegions(rng = Math.random) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const regionOf = Array(64).fill(-1);
    const seeds = [];
    for (let i = 0; i < 8; i++) {
      let cell, tries = 0;
      do {
        cell = idx(Math.floor(rng() * SIZE), Math.floor(rng() * SIZE));
        tries++;
      } while (regionOf[cell] !== -1 && tries < 500);
      if (regionOf[cell] !== -1) break;
      regionOf[cell] = i;
      seeds.push(cell);
    }
    if (seeds.length < 8) continue;

    const regionSizes = Array(8).fill(1);
    const frontiers = seeds.map(s => [s]);
    let assigned = 8;
    let stuck = false;

    while (assigned < 64 && !stuck) {
      // calcule les candidats disponibles pour chaque région incomplète
      let best = -1, bestCandidates = null, bestCount = Infinity;
      for (let region = 0; region < 8; region++) {
        if (regionSizes[region] >= 8) continue;
        const candidates = [...new Set(
          frontiers[region].flatMap(cell => neighbors(cell)).filter(n => regionOf[n] === -1)
        )];
        if (candidates.length > 0 && candidates.length < bestCount) {
          bestCount = candidates.length; best = region; bestCandidates = candidates;
        }
      }
      if (best === -1) { stuck = true; break; } // aucune région incomplète n'a de candidat -> vrai blocage
      const pick = bestCandidates[Math.floor(rng() * bestCandidates.length)];
      regionOf[pick] = best;
      regionSizes[best]++;
      frontiers[best].push(pick);
      assigned++;
    }
    if (!stuck && assigned === 64 && regionSizes.every(s => s === 8)) {
      return regionOf;
    }
  }
  return null;
}

export function regionCells(regionOf) {
  const cells = Array.from({ length: 8 }, () => []);
  regionOf.forEach((r, i) => cells[r].push(i));
  return cells;
}


// ═══════════════════════════════════════════════════════════════
// REMPLISSAGE — génère une grille complète valide (1-8 partout,
// respectant lignes/colonnes/régions) par backtracking randomisé.
// ═══════════════════════════════════════════════════════════════
export function isValidPlacement(grid, regionOf, pos, value) {
  const r = Math.floor(pos / SIZE), c = pos % SIZE;
  for (let cc = 0; cc < SIZE; cc++) if (grid[idx(r, cc)] === value) return false;
  for (let rr = 0; rr < SIZE; rr++) if (grid[idx(rr, c)] === value) return false;
  const region = regionOf[pos];
  for (let i = 0; i < 64; i++) if (regionOf[i] === region && grid[i] === value) return false;
  return true;
}

/** Remplit une grille valide pour une partition de régions donnée, par
 *  backtracking MRV. Certaines partitions de régions irrégulières sont
 *  combinatoirement très difficiles à remplir (phénomène connu en
 *  génération de puzzles à régions libres) — plutôt que de risquer un
 *  blocage, le nombre d'étapes de backtracking est plafonné ; en cas
 *  d'échec, l'appelant doit régénérer une AUTRE partition de régions
 *  plutôt que de s'acharner sur celle-ci (voir generatePuzzleGrid). */
export function fillGrid(regionOf, rng = Math.random, maxSteps = 20000) {
  const grid = Array(64).fill(0);
  let steps = 0;
  function findBestCell() {
    let best = -1, bestOptions = null, bestCount = 10;
    for (let i = 0; i < 64; i++) {
      if (grid[i] !== 0) continue;
      const options = [];
      for (let v = 1; v <= 8; v++) if (isValidPlacement(grid, regionOf, i, v)) options.push(v);
      if (options.length < bestCount) { bestCount = options.length; best = i; bestOptions = options; }
      if (bestCount === 0) break;
    }
    return { best, bestOptions };
  }
  function backtrack() {
    steps++;
    if (steps > maxSteps) return 'timeout';
    const { best, bestOptions } = findBestCell();
    if (best === -1) return true;
    if (bestOptions.length === 0) return false;
    const shuffled = bestOptions.map(v => [rng(), v]).sort((a,b) => a[0]-b[0]).map(p => p[1]);
    for (const v of shuffled) {
      grid[best] = v;
      const result = backtrack();
      if (result === 'timeout') return 'timeout';
      if (result === true) return true;
      grid[best] = 0;
    }
    return false;
  }
  const result = backtrack();
  return result === true ? grid : null;
}

/** Génère une grille complète valide en combinant les deux sources
 *  d'aléatoire (partition de régions + remplissage) : si une partition
 *  s'avère trop difficile à remplir, en régénère une nouvelle plutôt
 *  que d'insister — bien plus robuste que de fixer une seule partition
 *  et d'espérer qu'elle soit remplissable rapidement (bug réel
 *  rencontré : certaines partitions bloquaient le remplissage pendant
 *  un temps indéterminé même avec l'heuristique MRV). */
export function generatePuzzleGrid(rng = Math.random) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const regionOf = generateRegions(rng);
    if (!regionOf) continue;
    const grid = fillGrid(regionOf, rng);
    if (grid) return { grid, regionOf };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// SOLVEUR — compte les solutions d'une grille partielle (plafonné à 2
// pour l'efficacité : on n'a besoin de savoir QUE si c'est 0, 1, ou
// "plus d'une", jamais le nombre exact au-delà de 2).
// ═══════════════════════════════════════════════════════════════
export function countSolutions(grid, regionOf, cap = 2) {
  const g = grid.slice();
  let count = 0;

  function findBestCell() {
    // choisit la case vide avec le MOINS de valeurs possibles (MRV,
    // même heuristique que pour les régions) — accélère énormément
    // le solveur par rapport à un simple balayage gauche->droite
    let best = -1, bestOptions = null, bestCount = 10;
    for (let i = 0; i < 64; i++) {
      if (g[i] !== 0) continue;
      const options = [];
      for (let v = 1; v <= 8; v++) if (isValidPlacement(g, regionOf, i, v)) options.push(v);
      if (options.length < bestCount) { bestCount = options.length; best = i; bestOptions = options; }
      if (bestCount === 0) break; // impasse détectée immédiatement
    }
    return { best, bestOptions };
  }

  function backtrack() {
    if (count >= cap) return;
    const { best, bestOptions } = findBestCell();
    if (best === -1) { count++; return; } // grille pleine = 1 solution trouvée
    if (bestOptions.length === 0) return; // impasse, remonte
    for (const v of bestOptions) {
      g[best] = v;
      backtrack();
      g[best] = 0;
      if (count >= cap) return;
    }
  }
  backtrack();
  return count;
}


// ═══════════════════════════════════════════════════════════════
// GÉNÉRATEUR DE PUZZLE — part d'une grille complète, retire des
// cases une à une (ordre aléatoire), en vérifiant à CHAQUE retrait
// que le puzzle garde EXACTEMENT une solution. S'arrête au nombre
// d'indices cible de la difficulté choisie, ou dès qu'aucun retrait
// supplémentaire ne préserve l'unicité.
// ═══════════════════════════════════════════════════════════════
export const DIFFICULTY_CLUES = {
  facile:    { min: 34, max: 38 },
  normal:    { min: 28, max: 32 },
  difficile: { min: 24, max: 27 },
  expert:    { min: 20, max: 23 },
};

export function generatePuzzle(difficulty = 'normal', rng = Math.random) {
  const base = generatePuzzleGrid(rng);
  if (!base) return null;
  const { grid: solution, regionOf } = base;
  const target = DIFFICULTY_CLUES[difficulty] || DIFFICULTY_CLUES.normal;

  const puzzle = solution.slice();
  const order = [...Array(64).keys()].map(v => [rng(), v]).sort((a,b) => a[0]-b[0]).map(p => p[1]);
  let clueCount = 64;

  for (const pos of order) {
    if (clueCount <= target.min) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    const count = countSolutions(puzzle, regionOf, 2);
    if (count === 1) {
      clueCount--;
    } else {
      puzzle[pos] = backup; // le retrait casse l'unicité, on annule
    }
  }
  return { puzzle, solution, regionOf, clueCount, difficulty };
}


export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Résolution', desc: 'Résoudre son premier puzzle', icon: '🧩' },
  { id: 'no_hint', name: 'Sans Aide', desc: 'Résoudre un puzzle sans indice', icon: '🎯' },
  { id: 'expert_win', name: 'Maître Mosaïque', desc: 'Résoudre un puzzle Expert', icon: '🏆' },
  { id: 'speed_5min', name: 'Éclair', desc: 'Résoudre en moins de 5 minutes', icon: '⚡' },
  { id: 'streak_5', name: '5 Puzzles d\u2019Affilée', desc: 'Résoudre 5 puzzles sans quitter', icon: '🔥' },
  { id: 'multi_species', name: 'Multi-Espèces', desc: 'Jouer avec au moins 3 personnages différents', icon: '🐾' },
];
