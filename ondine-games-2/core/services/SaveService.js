// ═══════════════════════════════════════════════════════════════
// SaveService
// ───────────────────────────────────────
// RÔLE : persister/restaurer l'état de partie en cours d'un jeu,
//        sous forme de blob JSON opaque. Ne connaît jamais la forme
//        de cet état — c'est entièrement défini par le jeu.
// POSSÈDE : une entrée localStorage par jeu.
// PRIVÉ : voir StatsService.js pour la règle d'isolation par gameId.
// ═══════════════════════════════════════════════════════════════
import { readNamespaced, writeNamespaced, removeNamespaced, hasNamespaced } from '../storage/keys.js';

const SAVE_NS = 'save';

export const SaveService = {
  write(gameId, state) {
    try { writeNamespaced(gameId, SAVE_NS, state); return true; }
    catch (e) { console.warn('[SaveService] échec de sauvegarde pour', gameId, e); return false; }
  },
  read(gameId) {
    try {
      const value = readNamespaced(gameId, SAVE_NS);
      return value === undefined ? null : value;
    } catch (e) { console.warn('[SaveService] sauvegarde corrompue pour', gameId, e); return null; }
  },
  hasSave(gameId) { return hasNamespaced(gameId, SAVE_NS); },
  clear(gameId) { removeNamespaced(gameId, SAVE_NS); },
};
