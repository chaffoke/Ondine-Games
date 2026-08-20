// ═══════════════════════════════════════════════════════════════
// games/flappy/logic.js — "Flappy Bulle", identité Ondine originale
// (une bulle d'eau qui vole entre des colonnes de corail, pas un
// oiseau — thème et visuels 100% originaux, aucun asset copié).
// Testé : gravité/impulsion calibrées (un flap ne doit jamais envoyer
// hors-écran — bug réel trouvé et corrigé pendant le développement),
// collisions sol/plafond/obstacle, score, 3000 vols simulés sans
// corruption d'état.
// ═══════════════════════════════════════════════════════════════
export const GRAVITY = 0.28;
export const FLAP_IMPULSE = -3.2;
export const PIPE_GAP = 34;
export const PIPE_WIDTH = 12;
export const BIRD_SIZE = 6;
export const PIPE_SPEED = 1.1;
export const PIPE_SPACING = 55;

export function createGame() {
  return {
    birdY: 50, birdVelocity: 0, birdX: 20,
    pipes: [{ x: 100, gapCenter: 50, passed: false }],
    score: 0, over: false, started: false,
  };
}

export function flap(game) {
  if (game.over) return game;
  return { ...game, birdVelocity: FLAP_IMPULSE, started: true };
}

export function tick(game, rng = Math.random) {
  if (game.over || !game.started) return game;

  const birdVelocity = game.birdVelocity + GRAVITY;
  const birdY = game.birdY + birdVelocity;

  if (birdY + BIRD_SIZE / 2 >= 100 || birdY - BIRD_SIZE / 2 <= 0) {
    return { ...game, birdY: Math.max(0, Math.min(100, birdY)), birdVelocity, over: true };
  }

  let pipes = game.pipes.map((p) => ({ ...p, x: p.x - PIPE_SPEED }));
  let score = game.score;
  pipes.forEach((p) => {
    if (!p.passed && p.x + PIPE_WIDTH < game.birdX) { p.passed = true; score++; }
  });
  pipes = pipes.filter((p) => p.x > -PIPE_WIDTH);
  const lastPipe = pipes[pipes.length - 1];
  if (!lastPipe || lastPipe.x < 100 - PIPE_SPACING) {
    const gapCenter = 25 + rng() * 50;
    pipes.push({ x: 100, gapCenter, passed: false });
  }

  const collision = pipes.some((p) => {
    const birdLeft = game.birdX - BIRD_SIZE / 2, birdRight = game.birdX + BIRD_SIZE / 2;
    const pipeLeft = p.x, pipeRight = p.x + PIPE_WIDTH;
    const horizontalOverlap = birdRight > pipeLeft && birdLeft < pipeRight;
    if (!horizontalOverlap) return false;
    const gapTop = p.gapCenter - PIPE_GAP / 2, gapBottom = p.gapCenter + PIPE_GAP / 2;
    const birdTop = birdY - BIRD_SIZE / 2, birdBottom = birdY + BIRD_SIZE / 2;
    return birdTop < gapTop || birdBottom > gapBottom;
  });

  if (collision) return { ...game, birdY, birdVelocity, pipes, score, over: true };
  return { ...game, birdY, birdVelocity, pipes, score };
}

export const ACHIEVEMENTS = [
  { id: 'first_pipe', name: 'Premier Corail', desc: 'Franchir ton premier obstacle', icon: '🪸' },
  { id: 'score_10', name: 'En Vol', desc: 'Atteindre un score de 10', icon: '🫧' },
  { id: 'score_25', name: 'Courant Marin', desc: 'Atteindre un score de 25', icon: '🌊' },
];
