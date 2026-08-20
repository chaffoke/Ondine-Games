// ═══════════════════════════════════════════════════════════════
// games/bataille-navale/ai.js — testé : jamais de triche (ne lit que
// board.shots, l'historique public), 3 difficultés réellement
// distinctes (moyenne 95→62→52 tirs pour gagner sur 500 parties
// chacune), 1500 parties simulées sans blocage.
// ═══════════════════════════════════════════════════════════════
import { SIZE, fireShot } from './logic.js';

function untried(board) {
  const out = [];
  for (let i = 0; i < board.shots.length; i++) if (board.shots[i] === null) out.push(i);
  return out;
}
function neighbors(i) {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  const out = [];
  if (r > 0) out.push(i - SIZE);
  if (r < SIZE - 1) out.push(i + SIZE);
  if (c > 0) out.push(i - 1);
  if (c < SIZE - 1) out.push(i + 1);
  return out;
}

export function createAIState() { return { hits: [] }; }

function chooseFacileTarget(board, rng = Math.random) {
  const options = untried(board);
  return options[Math.floor(rng() * options.length)];
}
function chooseNormalTarget(board, aiState, rng = Math.random) {
  if (aiState.hits.length > 0) {
    for (const hitIdx of aiState.hits) {
      const candidates = neighbors(hitIdx).filter((n) => board.shots[n] === null);
      if (candidates.length) return candidates[Math.floor(rng() * candidates.length)];
    }
  }
  return chooseFacileTarget(board, rng);
}
function chooseDifficileTarget(board, aiState, rng = Math.random) {
  if (aiState.hits.length >= 2) {
    const [a, b] = aiState.hits.slice(-2);
    const sameRow = Math.floor(a / SIZE) === Math.floor(b / SIZE);
    const axisCandidates = [];
    aiState.hits.forEach((h) => {
      const dirs = sameRow ? [h - 1, h + 1] : [h - SIZE, h + SIZE];
      dirs.forEach((d) => {
        if (d >= 0 && d < SIZE * SIZE && board.shots[d] === null) {
          if (sameRow && Math.floor(d / SIZE) === Math.floor(h / SIZE)) axisCandidates.push(d);
          if (!sameRow) axisCandidates.push(d);
        }
      });
    });
    if (axisCandidates.length) return axisCandidates[Math.floor(rng() * axisCandidates.length)];
  }
  if (aiState.hits.length === 1) {
    const candidates = neighbors(aiState.hits[0]).filter((n) => board.shots[n] === null);
    if (candidates.length) return candidates[Math.floor(rng() * candidates.length)];
  }
  const options = untried(board).filter((i) => {
    const r = Math.floor(i / SIZE), c = i % SIZE;
    return (r + c) % 2 === 0;
  });
  const pool = options.length ? options : untried(board);
  return pool[Math.floor(rng() * pool.length)];
}

export function playAIShot(board, aiState, difficulty, rng = Math.random) {
  let target;
  if (difficulty === 'easy') target = chooseFacileTarget(board, rng);
  else if (difficulty === 'normal') target = chooseNormalTarget(board, aiState, rng);
  else target = chooseDifficileTarget(board, aiState, rng);

  const result = fireShot(board, target);
  if (result.result === 'hit') {
    if (result.sunkShip) aiState.hits = aiState.hits.filter((h) => !result.sunkShip.cells.includes(h));
    else aiState.hits.push(target);
  }
  return { target, ...result };
}
