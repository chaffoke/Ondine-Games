// ═══════════════════════════════════════════════════════════════
// core/storage/keys.js
// ───────────────────────────────────────
// RÔLE : point UNIQUE de calcul des clés localStorage, et mécanisme
//        de migration transparente depuis les anciennes conventions
//        (og_<id>_v1, <id>_ondine_v1, ondine_stats_<id>, sol_*,
//        sud_*, y*...) vers la nouvelle convention :
//
//            ondine.games.<gameId>.<namespace>
//
//        namespace ∈ { stats, achievements, save, settings }
//
// NE DOIT JAMAIS : être importé directement par un jeu — seuls les
//        services (StatsService, AchievementsService, SaveService)
//        l'utilisent. Un jeu ne voit jamais une clé localStorage.
//
// GARANTIE : aucune sauvegarde existante n'est perdue. Au premier
//        accès après mise à jour, si la nouvelle clé est absente,
//        l'ancienne est lue, migrée vers la nouvelle clé, puis
//        utilisée exclusivement ensuite. L'ancienne clé n'est
//        JAMAIS supprimée automatiquement (voir section 24 de
//        l'architecture — suppression = décision humaine ultérieure,
//        pas automatique).
// ═══════════════════════════════════════════════════════════════

function newKey(gameId, namespace) {
  return `ondine.games.${gameId}.${namespace}`;
}

/**
 * Registre des anciennes clés, par jeu. Deux formes possibles :
 *  - { type: 'blob', key, fields } : une seule ancienne clé JSON
 *    contenant plusieurs namespaces en sous-champs (ex: Batch 2/3 :
 *    { stats, achievements, save }).
 *  - { type: 'flat', keys: { stats: 'xxx', achievements: 'yyy' } } :
 *    une ancienne clé dédiée par namespace (ex: Batch 1 SDK,
 *    ondine_stats_<id> / ondine_ach_<id> / ondine_save_<id>).
 *
 * Volontairement minimal : seul Morpion (jeu pilote) est renseigné
 * pour l'instant. Les 17 autres entrées seront ajoutées au moment
 * où chaque jeu sera réellement migré (voir architecture, section 21)
 * — les y ajouter maintenant sans les tester serait spéculatif.
 */
const LEGACY_REGISTRY = {
  morpion: { type: 'blob', key: 'og_morpion_v1', fields: ['stats', 'achievements'] },
};

function readLegacy(gameId, namespace) {
  const entry = LEGACY_REGISTRY[gameId];
  if (!entry) return undefined;

  if (entry.type === 'blob') {
    if (!entry.fields.includes(namespace)) return undefined;
    try {
      const raw = localStorage.getItem(entry.key);
      if (raw === null) return undefined;
      const blob = JSON.parse(raw);
      return namespace in blob ? blob[namespace] : undefined;
    } catch (e) {
      console.warn('[storage/keys] ancienne clé blob corrompue pour', gameId, e);
      return undefined;
    }
  }

  if (entry.type === 'flat') {
    const legacyKey = entry.keys && entry.keys[namespace];
    if (!legacyKey) return undefined;
    try {
      const raw = localStorage.getItem(legacyKey);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (e) {
      console.warn('[storage/keys] ancienne clé plate corrompue pour', gameId, e);
      return undefined;
    }
  }

  return undefined;
}

/**
 * Lit `namespace` pour `gameId`. Cherche d'abord la nouvelle clé ;
 * si absente, cherche l'ancienne (si le jeu est dans LEGACY_REGISTRY),
 * et si trouvée, MIGRE immédiatement (écrit la nouvelle clé) avant
 * de retourner la valeur. Retourne `undefined` si rien n'existe nulle
 * part (au service appelant de fournir sa propre valeur par défaut).
 */
export function readNamespaced(gameId, namespace) {
  const key = newKey(gameId, namespace);
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    try { return JSON.parse(raw); }
    catch (e) { console.warn('[storage/keys] nouvelle clé corrompue pour', gameId, namespace, e); return undefined; }
  }

  const legacyValue = readLegacy(gameId, namespace);
  if (legacyValue !== undefined) {
    writeNamespaced(gameId, namespace, legacyValue);
    console.info(`[storage/keys] migration ${gameId}.${namespace} : ancienne clé → ${key}`);
    return legacyValue;
  }

  return undefined;
}

export function writeNamespaced(gameId, namespace, value) {
  localStorage.setItem(newKey(gameId, namespace), JSON.stringify(value));
}

export function removeNamespaced(gameId, namespace) {
  localStorage.removeItem(newKey(gameId, namespace));
  // L'ancienne clé n'est jamais supprimée ici — voir garantie ci-dessus.
}

export function hasNamespaced(gameId, namespace) {
  if (localStorage.getItem(newKey(gameId, namespace)) !== null) return true;
  return readLegacy(gameId, namespace) !== undefined;
}
