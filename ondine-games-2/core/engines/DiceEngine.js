// ═══════════════════════════════════════════════════════════════
// Dice Engine
// ───────────────────────────────────────
// RÔLE : lancer et gérer des pools de dés (valeur + verrou), compter
//        les valeurs obtenues. Ne connaît ni YAMS, ni Shut the Box,
//        ni 421, ni aucune règle de score.
// NE DOIT JAMAIS : contenir une notion de catégorie de score, de
//        combinaison gagnante (Brelan, Suite, 421, Nénette...), ou
//        de règle spécifique à un jeu.
// ───────────────────────────────────────
// Extrait tel quel du CoreBundle Batch 1 (déjà utilisé par Shut the
// Box). Candidat de migration pour YAMS et 421 (jamais branchés,
// leurs règles de score restent entièrement différentes et propres
// à chacun — voir architecture, section 5).
// ═══════════════════════════════════════════════════════════════

export function rollDie(sides = 6) {
  return 1 + Math.floor(Math.random() * sides);
}

export function rollDice(count, sides = 6) {
  return Array.from({ length: count }, () => rollDie(sides));
}

/** Crée un pool de dés à l'état initial : valeur nulle, non verrouillé. */
export function createDicePool(count) {
  return Array.from({ length: count }, () => ({ value: null, locked: false }));
}

/** Relance uniquement les dés non verrouillés du pool (mutation + retour). */
export function rollUnlocked(pool, sides = 6) {
  pool.forEach((d) => { if (!d.locked) d.value = rollDie(sides); });
  return pool;
}

export function toggleLock(pool, index) {
  if (pool[index]) pool[index].locked = !pool[index].locked;
  return pool;
}

/** Compte les occurrences de chaque valeur — utile à toute règle de
 *  score basée sur des combinaisons (brelan, suite, etc.). */
export function countValues(values) {
  const counts = {};
  values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  return counts;
}
