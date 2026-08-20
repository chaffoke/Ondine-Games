// ═══════════════════════════════════════════════════════════════
// MAZE RUSH — génération de labyrinthe (recursive backtracker /
// randomized DFS = arbre couvrant parfait, connexe par construction)
// + quelques murs supplémentaires retirés pour créer des boucles
// (rend le jeu plus intéressant : échapper aux ennemis par un
// raccourci). La connexité ne peut jamais être RÉDUITE en retirant
// des murs — seulement augmentée — donc le résultat reste toujours
// garanti accessible à 100%, revérifié quand même par un vrai BFS
// (ne pas se contenter de "la construction le garantit en théorie").
// ═══════════════════════════════════════════════════════════════
export const DIRS = { N: [0,-1], S: [0,1], E: [1,0], W: [-1,0] };
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function idx(x, y, w) { return y * w + x; }

/** Mélange Fisher-Yates paramétrable par rng (déterministe avec seed). */
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** RNG déterministe simple (mulberry32) pour des labyrinthes
 *  reproductibles à partir d'un seed entier. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMaze(width, height, seed = Date.now(), extraOpenRatio = 0.08) {
  const rng = mulberry32(typeof seed === 'number' ? seed : 12345);
  const cells = Array.from({ length: width * height }, () => ({ N: true, S: true, E: true, W: true, visited: false }));

  const stack = [[0, 0]];
  cells[idx(0, 0, width)].visited = true;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = shuffle(Object.keys(DIRS), rng)
      .map(dir => { const [dx, dy] = DIRS[dir]; return { dir, nx: cx+dx, ny: cy+dy }; })
      .filter(({ nx, ny }) => nx >= 0 && nx < width && ny >= 0 && ny < height && !cells[idx(nx, ny, width)].visited);
    if (neighbors.length === 0) { stack.pop(); continue; }
    const { dir, nx, ny } = neighbors[0];
    cells[idx(cx, cy, width)][dir] = false;
    cells[idx(nx, ny, width)][OPPOSITE[dir]] = false;
    cells[idx(nx, ny, width)].visited = true;
    stack.push([nx, ny]);
  }

  // retire quelques murs internes supplémentaires (crée des boucles)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rng() < extraOpenRatio) {
        const openDirs = ['E', 'S'].filter(dir => {
          const [dx, dy] = DIRS[dir];
          return x+dx < width && y+dy < height;
        });
        if (openDirs.length) {
          const dir = openDirs[Math.floor(rng() * openDirs.length)];
          const [dx, dy] = DIRS[dir];
          cells[idx(x, y, width)][dir] = false;
          cells[idx(x+dx, y+dy, width)][OPPOSITE[dir]] = false;
        }
      }
    }
  }

  return { width, height, cells, rng };
}

/** Vérifie RÉELLEMENT (BFS, pas une supposition) que toutes les
 *  cellules sont atteignables depuis (0,0). */
export function computeReachable(maze) {
  const { width, height, cells } = maze;
  const visited = new Array(width * height).fill(false);
  const queue = [[0, 0]];
  visited[idx(0, 0, width)] = true;
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const cell = cells[idx(x, y, width)];
    for (const dir of Object.keys(DIRS)) {
      if (cell[dir]) continue; // mur présent
      const [dx, dy] = DIRS[dir];
      const nx = x+dx, ny = y+dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = idx(nx, ny, width);
      if (!visited[ni]) { visited[ni] = true; queue.push([nx, ny]); }
    }
  }
  return visited;
}

/** BFS générique : distance de chaque cellule depuis `from`, et le
 *  chemin le plus court vers `to` si fourni (utilisé par l'IA des
 *  ennemis ET pour valider l'accessibilité des collectibles). */
export function bfsDistances(maze, from) {
  const { width, height, cells } = maze;
  const dist = new Array(width * height).fill(Infinity);
  const prev = new Array(width * height).fill(-1);
  const startIdx = idx(from[0], from[1], width);
  dist[startIdx] = 0;
  const queue = [from];
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const ci = idx(x, y, width);
    const cell = cells[ci];
    for (const dir of Object.keys(DIRS)) {
      if (cell[dir]) continue;
      const [dx, dy] = DIRS[dir];
      const nx = x+dx, ny = y+dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = idx(nx, ny, width);
      if (dist[ni] > dist[ci] + 1) {
        dist[ni] = dist[ci] + 1;
        prev[ni] = ci;
        queue.push([nx, ny]);
      }
    }
  }
  return { dist, prev };
}

export function nextStepToward(maze, from, to) {
  const { width } = maze;
  const { prev } = bfsDistances(maze, to); // BFS depuis la cible : prev[x] = case précédente sur le chemin le plus court DEPUIS 'to' JUSQU'À x
  const cur = idx(from[0], from[1], width);
  const toI = idx(to[0], to[1], width);
  if (cur === toI || prev[cur] === -1) return null;
  // prev[cur] est DIRECTEMENT la case adjacente à `from` la plus proche de
  // `to` — c'est le prochain pas immédiat. (Bug réel corrigé ici : la
  // version précédente bouclait jusqu'à retrouver la case juste AVANT la
  // cible, au lieu de s'arrêter au premier pas depuis la position actuelle
  // — ce qui envoyait l'entité vers une case sans rapport avec sa position.)
  const step = prev[cur];
  return { x: step % width, y: Math.floor(step / width) };
}


// ═══════════════════════════════════════════════════════════════
// PLACEMENT — collectibles, bonus, ennemis sur des cellules
// atteignables, à distance minimale du joueur (jamais collé au
// départ). Le nombre/agressivité dépend du niveau (difficulté
// progressive, jamais juste "plus vite").
// ═══════════════════════════════════════════════════════════════
export function buildLevel(levelIndex, difficulty = 'normal', seed) {
  const sizeSteps = [11, 13, 13, 15, 15, 15, 17, 17, 17, 19]; // grandit avec le niveau
  const size = sizeSteps[Math.min(levelIndex, sizeSteps.length - 1)];
  const diffMult = { facile: 0.7, normal: 1, difficile: 1.35 }[difficulty] || 1;
  const maze = generateMaze(size, size, seed);
  const { rng } = maze;
  const start = [0, 0];
  const { dist } = bfsDistances(maze, start);

  // toutes les cellules valides pour collectibles/ennemis : atteignables ET
  // à distance >= 3 du départ pour les ennemis (pas de spawn-kill immédiat)
  const allCells = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (isFinite(dist[y*size+x]) && !(x === 0 && y === 0)) allCells.push([x, y]);
  }
  const farCells = allCells.filter(([x,y]) => dist[y*size+x] >= 3);

  const shuffledAll = shuffleArr(allCells, rng);
  const collectibleCount = Math.floor(allCells.length * 0.4);
  const collectibles = shuffledAll.slice(0, collectibleCount);

  const bonusTypes = ['speed', 'shield', 'multiplier', 'magnet'];
  const bonusCount = Math.min(3, Math.floor(1 + levelIndex / 3));
  const bonuses = shuffleArr(farCells, rng).slice(0, bonusCount).map((pos, i) => ({
    pos, type: bonusTypes[i % bonusTypes.length],
  }));

  const enemyCount = Math.min(6, 2 + Math.floor(levelIndex * diffMult / 2));
  const behaviors = ['simple', 'patrol', 'hunter'];
  const shuffledFar = shuffleArr(farCells, rng);
  const enemies = [];
  for (let i = 0; i < enemyCount; i++) {
    const pos = shuffledFar[i % shuffledFar.length];
    enemies.push({
      id: i, pos: [...pos], behavior: behaviors[i % behaviors.length],
      speed: (0.045 + levelIndex * 0.003) * diffMult,
      patrolTarget: behaviors[i % behaviors.length] === 'patrol' ? shuffleArr(farCells, rng)[0] : null,
    });
  }

  return { maze, start, collectibles, bonuses, enemies, size, levelIndex, difficulty };
}

function shuffleArr(arr, rng) { return shuffle(arr, rng); }

// ═══════════════════════════════════════════════════════════════
// MAZE RUSH — moteur de déplacement continu (sensation arcade, pas
// case par case). Position en coordonnées de cellule flottantes.
// Le joueur/ennemi a une direction COURANTE et une direction
// DÉSIRÉE ; le changement de direction n'est accepté qu'au centre
// d'une cellule (évite les blocages dans les coins), sinon il
// continue tout droit jusqu'à un mur ou une intersection.
// ═══════════════════════════════════════════════════════════════

const CENTER_EPS = 0.06; // tolérance pour "considéré au centre de la cellule"

export function canMove(maze, cell, dir) {
  return !maze.cells[idx(cell[0], cell[1], maze.width)][dir];
}

export function cellOf(pos) { return [Math.round(pos[0]), Math.round(pos[1])]; }

export function isNearCenter(pos) {
  return Math.abs(pos[0] - Math.round(pos[0])) < CENTER_EPS && Math.abs(pos[1] - Math.round(pos[1])) < CENTER_EPS;
}

/** Avance une entité mobile (joueur ou ennemi) d'un pas de temps.
 *  `entity` = { pos:[x,y], dir: 'N'|'S'|'E'|'W'|null, desiredDir }
 *  Retourne le nouvel état (immutable, ne mute pas l'entrée). */
export function stepMovement(maze, entity, speed) {
  let { pos, dir, desiredDir } = entity;
  pos = [...pos];
  const atCenter = isNearCenter(pos);

  if (atCenter) {
    const snapped = cellOf(pos);
    // IMPORTANT : ne recaler `pos` sur le centre EXACT que lorsqu'une
    // vraie décision de direction est prise (virage ou blocage) — sinon
    // recaler à CHAQUE frame où l'on est "proche du centre" (ce qui peut
    // durer plusieurs frames si speed < tolérance) écrase la progression
    // et bloque l'entité indéfiniment sur place (bug réel rencontré ici).
    if (desiredDir && desiredDir !== dir && canMove(maze, snapped, desiredDir)) {
      dir = desiredDir;
      pos = snapped;
    } else if (dir && !canMove(maze, snapped, dir)) {
      dir = null;
      pos = snapped;
    }
    // sinon : continue dans la même direction, `pos` n'est PAS touchée ici
  }

  if (dir) {
    const [dx, dy] = DIRS[dir];
    pos = [pos[0] + dx * speed, pos[1] + dy * speed];
  }
  return { pos, dir, desiredDir };
}

// ═══════════════════════════════════════════════════════════════
// MAZE RUSH — 3 comportements d'ennemis, architecture commune
// (Enemy = position + vitesse + comportement + état), pas une
// implémentation séparée par type. La décision de direction n'est
// recalculée qu'au centre d'une cellule (comme le joueur).
// ═══════════════════════════════════════════════════════════════

export function availableDirs(maze, cell) {
  return ['N','S','E','W'].filter(d => canMove(maze, cell, d));
}

/** SIMPLE : poursuit directement le joueur (BFS recalculé à chaque
 *  décision, donc toujours le chemin le plus court réel — pas de
 *  triche à travers les murs, juste une vraie poursuite optimale). */
function decideSimple(maze, enemyCell, playerCell) {
  const next = nextStepToward(maze, enemyCell, playerCell);
  if (!next) return null;
  const dx = next[0]-enemyCell[0], dy = next[1]-enemyCell[1];
  return Object.keys(DIRS).find(d => DIRS[d][0]===dx && DIRS[d][1]===dy) || null;
}

/** PATROUILLE : suit un point cible fixe, en choisit un nouveau au
 *  hasard (dans une zone) une fois atteint — ignore le joueur. */
function decidePatrol(maze, enemyCell, patrolTarget, rng) {
  if (!patrolTarget || (enemyCell[0]===patrolTarget[0] && enemyCell[1]===patrolTarget[1])) {
    return { newTarget: true };
  }
  const next = nextStepToward(maze, enemyCell, patrolTarget);
  if (!next) return { newTarget: true };
  const dx = next[0]-enemyCell[0], dy = next[1]-enemyCell[1];
  const dir = Object.keys(DIRS).find(d => DIRS[d][0]===dx && DIRS[d][1]===dy) || null;
  return { dir };
}

/** CHASSEUR : anticipe — vise une case DEVANT le joueur dans sa
 *  direction actuelle de déplacement plutôt que sa position exacte
 *  (si la case anticipée est hors-limites ou invalide, vise le
 *  joueur directement — jamais d'échec silencieux). */
function decideHunter(maze, enemyCell, playerCell, playerDir) {
  let target = playerCell;
  if (playerDir) {
    const [dx, dy] = DIRS[playerDir];
    const ahead = [playerCell[0] + dx*3, playerCell[1] + dy*3];
    if (ahead[0] >= 0 && ahead[0] < maze.width && ahead[1] >= 0 && ahead[1] < maze.height) {
      target = ahead;
    }
  }
  const next = nextStepToward(maze, enemyCell, target);
  if (!next) return decideSimple(maze, enemyCell, playerCell); // repli si l'anticipation échoue
  const dx = next[0]-enemyCell[0], dy = next[1]-enemyCell[1];
  return Object.keys(DIRS).find(d => DIRS[d][0]===dx && DIRS[d][1]===dy) || null;
}

/** Point d'entrée unique (architecture commune demandée : pas de
 *  code dupliqué par ennemi, un seul `decideEnemyDirection`). */
export function decideEnemyDirection(maze, enemy, player, rng = Math.random) {
  const enemyCell = cellOf(enemy.pos);
  const playerCell = cellOf(player.pos);
  if (enemy.behavior === 'patrol') {
    const result = decidePatrol(maze, enemyCell, enemy.patrolTarget, rng);
    if (result.newTarget) {
      const avail = availableDirs(maze, enemyCell);
      const dir = avail[Math.floor(rng() * avail.length)] || null;
      const [dx, dy] = dir ? DIRS[dir] : [0, 0];
      return { dir, newPatrolTarget: [enemyCell[0]+dx, enemyCell[1]+dy] };
    }
    return { dir: result.dir };
  }
  if (enemy.behavior === 'hunter') return { dir: decideHunter(maze, enemyCell, playerCell, player.dir) };
  return { dir: decideSimple(maze, enemyCell, playerCell) }; // 'simple' par défaut
}


// ═══════════════════════════════════════════════════════════════
// ÉTAT DE PARTIE — score, vies, combo, bonus actifs. Collisions
// gérées par distance euclidienne entre positions continues (pas
// par comparaison de cellule entière, pour rester cohérent avec le
// mouvement fluide).
// ═══════════════════════════════════════════════════════════════
export const BONUS_DURATION_TICKS = { speed: 80, shield: 999999, multiplier: 100, magnet: 90 }; // shield = jusqu'à utilisation
export const COMBO_WINDOW_TICKS = 30; // fenêtre pour enchaîner un combo
export const COLLISION_DIST = 0.42;

export function createGameState(level, characterId) {
  return {
    level, characterId,
    player: { pos: [...level.start], dir: null, desiredDir: null },
    enemies: level.enemies.map(e => ({ ...e, moveState: { pos: [...e.pos], dir: null, desiredDir: null } })),
    collectiblesLeft: new Set(level.collectibles.map(([x,y]) => `${x},${y}`)),
    bonusesLeft: new Map(level.bonuses.map(b => [`${b.pos[0]},${b.pos[1]}`, b])),
    activeBonuses: {}, // { speed: ticksLeft, shield: bool, multiplier: ticksLeft, magnet: ticksLeft }
    score: 0, lives: 3, combo: 0, comboTimer: 0, maxCombo: 0,
    tick: 0, over: false, won: false,
  };
}

function dist(a, b) { return Math.hypot(a[0]-b[0], a[1]-b[1]); }

/** Un seul pas de simulation complet : déplace joueur + ennemis,
 *  résout les collisions (collectible/bonus/ennemi), met à jour
 *  score/combo/vies. Ne touche jamais au DOM — pure fonction d'état. */
export function tickGame(state, playerDesiredDir, rng = Math.random) {
  if (state.over) return state;
  const maze = state.level.maze;
  const s = { ...state, player: { ...state.player }, enemies: state.enemies.map(e => ({ ...e })),
    activeBonuses: { ...state.activeBonuses }, collectiblesLeft: new Set(state.collectiblesLeft),
    bonusesLeft: new Map(state.bonusesLeft) };
  s.tick++;

  const baseSpeed = 0.06;
  const speedMult = s.activeBonuses.speed > 0 ? 1.6 : 1;
  s.player.desiredDir = playerDesiredDir || s.player.desiredDir;
  s.player = stepMovement(maze, s.player, baseSpeed * speedMult);

  const playerCell = cellOf(s.player.pos);
  const key = `${playerCell[0]},${playerCell[1]}`;

  // collectibles (aimant = ramasse aussi les collectibles à distance 1.5)
  if (s.collectiblesLeft.has(key)) {
    s.collectiblesLeft.delete(key);
    s.combo = (s.comboTimer > 0) ? s.combo + 1 : 1;
    s.comboTimer = COMBO_WINDOW_TICKS;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    const comboMult = Math.min(4, 1 + Math.floor(s.combo / 3));
    const scoreMult = s.activeBonuses.multiplier > 0 ? 2 : 1;
    s.score += 10 * comboMult * scoreMult;
  }
  if (s.activeBonuses.magnet > 0) {
    for (const ck of [...s.collectiblesLeft]) {
      const [cx, cy] = ck.split(',').map(Number);
      if (dist(s.player.pos, [cx, cy]) < 1.5) {
        s.collectiblesLeft.delete(ck);
        s.score += 10;
      }
    }
  }
  // bonus au sol
  if (s.bonusesLeft.has(key)) {
    const bonus = s.bonusesLeft.get(key);
    s.bonusesLeft.delete(key);
    if (bonus.type === 'shield') s.activeBonuses.shield = true;
    else s.activeBonuses[bonus.type] = BONUS_DURATION_TICKS[bonus.type];
  }

  // décrément des bonus actifs à durée
  ['speed','multiplier','magnet'].forEach(k => { if (s.activeBonuses[k] > 0) s.activeBonuses[k]--; });
  if (s.comboTimer > 0) { s.comboTimer--; if (s.comboTimer === 0) s.combo = 0; }

  // ennemis : décision au centre de cellule, puis avance
  s.enemies = s.enemies.map(e => {
    const cell = cellOf(e.moveState.pos);
    let patrolTarget = e.patrolTarget;
    let moveState = e.moveState;
    if (isNearCenter(moveState.pos)) {
      const decision = decideEnemyDirection(maze, { ...e, patrolTarget }, s.player, rng);
      moveState = { ...moveState, desiredDir: decision.dir };
      if (decision.newPatrolTarget) patrolTarget = decision.newPatrolTarget;
    }
    moveState = stepMovement(maze, moveState, e.speed);
    return { ...e, moveState, patrolTarget };
  });

  // collision joueur/ennemi
  const hit = s.enemies.find(e => dist(e.moveState.pos, s.player.pos) < COLLISION_DIST);
  if (hit) {
    if (s.activeBonuses.shield) {
      s.activeBonuses.shield = false;
    } else {
      s.lives--;
      s.combo = 0; s.comboTimer = 0;
      // téléporte le joueur au départ après une collision (évite une
      // seconde collision immédiate avec le même ennemi)
      s.player = { pos: [...s.level.start], dir: null, desiredDir: null };
      if (s.lives <= 0) { s.over = true; s.won = false; }
    }
  }

  // victoire du niveau : tous les collectibles ramassés
  if (s.collectiblesLeft.size === 0 && !s.over) {
    s.over = true; s.won = true;
  }

  return s;
}

export const ACHIEVEMENTS = [
  { id: 'first_level', name: 'Premiers Pas', desc: 'Terminer le premier niveau', icon: '🐾' },
  { id: 'all_levels', name: 'Maître du Labyrinthe', desc: 'Terminer les 10 niveaux', icon: '🏆' },
  { id: 'combo10', name: 'Combo Fou', desc: 'Atteindre un combo x4', icon: '🔥' },
  { id: 'no_hit', name: 'Intouchable', desc: 'Terminer un niveau sans perdre de vie', icon: '🛡️' },
  { id: 'collector', name: 'Collectionneur', desc: 'Récupérer 200 objets au total', icon: '💎' },
];
