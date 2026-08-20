// ═══════════════════════════════════════════════════════════════
// games/simon/logic.js — testé : séquence longue (20 étapes) sans
// erreur, mauvaise touche = game over, aucune interaction possible
// pendant l'affichage de la séquence ni après game over.
// ═══════════════════════════════════════════════════════════════
export const COLORS = ['green', 'red', 'yellow', 'blue'];

export function createGame() {
  return { sequence: [], playerProgress: 0, level: 0, over: false, showingSequence: false };
}

export function growSequence(game, rng = Math.random) {
  const color = COLORS[Math.floor(rng() * COLORS.length)];
  return { ...game, sequence: [...game.sequence, color], playerProgress: 0, level: game.sequence.length + 1 };
}

export function pressColor(game, color) {
  if (game.over || game.showingSequence) return { game, result: 'ignored' };
  const expected = game.sequence[game.playerProgress];
  if (color !== expected) return { game: { ...game, over: true }, result: 'wrong' };
  const newProgress = game.playerProgress + 1;
  if (newProgress === game.sequence.length) return { game: { ...game, playerProgress: newProgress }, result: 'sequence_complete' };
  return { game: { ...game, playerProgress: newProgress }, result: 'correct' };
}

export const ACHIEVEMENTS = [
  { id: 'first_round', name: 'Premier Tour', desc: 'Reproduire une séquence de 3', icon: '🎯' },
  { id: 'level_10', name: 'Niveau 10', desc: 'Atteindre le niveau 10', icon: '🔟' },
  { id: 'level_20', name: 'Mémoire de Fer', desc: 'Atteindre le niveau 20', icon: '🧠' },
];
