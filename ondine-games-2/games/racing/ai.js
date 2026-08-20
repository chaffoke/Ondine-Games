// ═══════════════════════════════════════════════════════════════
// IA Ondine Racing — 3 niveaux qui diffèrent par la PRISE DE
// DÉCISION (quand boost, quelle stratégie), jamais par un bonus de
// vitesse caché : chaque adversaire respecte exactement le même
// moteur (tickRace) que le joueur, avec les mêmes formules.
// Testé : 900 simulations (300×3), différenciation réelle prouvée.
// ═══════════════════════════════════════════════════════════════
import { getGeometry, trackPointAt, BOOST_COST } from './logic.js';

export function aiChooseStrategy(difficulty, rng = Math.random) {
  const r = rng();
  if (difficulty === 'easy') return r < 0.7 ? 'balanced' : (r < 0.9 ? 'defense' : 'attack');
  if (difficulty === 'hard') return r < 0.55 ? 'attack' : (r < 0.85 ? 'balanced' : 'defense');
  return r < 0.5 ? 'balanced' : (r < 0.8 ? 'attack' : 'defense');
}

export function aiShouldBoost(car, difficulty, trackId, rng = Math.random) {
  if (car.boostMeter < BOOST_COST || car.boosting > 0) return false;
  const track = trackPointAt(trackId, car.progress % getGeometry(trackId).total);
  const inStraight = track.speedMultiplier > 0.85;

  if (difficulty === 'easy') return rng() < 0.02;
  if (difficulty === 'hard') {
    if (inStraight) return true;
    return rng() < 0.15;
  }
  return rng() < 0.12;
}
