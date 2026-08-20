// ═══════════════════════════════════════════════════════════════
// StatsService
// ───────────────────────────────────────
// RÔLE : stocker des compteurs numériques par jeu (parties jouées,
//        victoires, meilleur score...). Ne connaît aucun nom de
//        statistique métier — le jeu choisit ses propres clés.
// POSSÈDE : une entrée localStorage par jeu.
// NE DOIT JAMAIS : interpréter le sens d'une statistique (ex. ne sait
//        pas que "victories" est "positif" ou que "errors" est
//        "négatif" — c'est au jeu d'agir en conséquence).
// ───────────────────────────────────────
// PRIVÉ : chaque méthode prend un `gameId` explicite. Un jeu ne doit
// JAMAIS appeler ce service directement (il pourrait alors lire/
// écrire les stats d'un AUTRE jeu en changeant le gameId passé) —
// seul core/sdk/createSDK.js a le droit de l'importer, avec le
// gameId figé une fois pour toutes par fermeture.
//
// Convention de clé : voir core/storage/keys.js — gère la nouvelle
// convention `ondine.games.<id>.stats` ET la lecture de secours des
// anciennes clés (ondine_stats_<id>, <id>_ondine_v1, og_<id>_v1,
// etc.) pour ne perdre aucune sauvegarde existante.
// ═══════════════════════════════════════════════════════════════
import { readNamespaced, writeNamespaced, removeNamespaced } from '../storage/keys.js';

const STATS_NS = 'stats';

function readAll(gameId) {
  try {
    return readNamespaced(gameId, STATS_NS) || {};
  } catch (e) {
    console.warn('[StatsService] lecture corrompue pour', gameId, e);
    return {};
  }
}

function writeAll(gameId, data) {
  writeNamespaced(gameId, STATS_NS, data);
}

export const StatsService = {
  get(gameId, key, defaultValue = 0) {
    const all = readAll(gameId);
    return key in all ? all[key] : defaultValue;
  },
  set(gameId, key, value) {
    const all = readAll(gameId);
    all[key] = value;
    writeAll(gameId, all);
  },
  increment(gameId, key, n = 1) {
    const all = readAll(gameId);
    all[key] = (all[key] || 0) + n;
    writeAll(gameId, all);
    return all[key];
  },
  /** Ne met à jour que si `value` dépasse la valeur actuelle (utile
   *  pour un meilleur score / meilleur temps). */
  setMax(gameId, key, value) {
    const all = readAll(gameId);
    if (!(key in all) || value > all[key]) { all[key] = value; writeAll(gameId, all); }
    return all[key];
  },
  setMin(gameId, key, value) {
    const all = readAll(gameId);
    if (!(key in all) || value < all[key]) { all[key] = value; writeAll(gameId, all); }
    return all[key];
  },
  getAll(gameId) { return readAll(gameId); },
  reset(gameId) { removeNamespaced(gameId, STATS_NS); },
};
