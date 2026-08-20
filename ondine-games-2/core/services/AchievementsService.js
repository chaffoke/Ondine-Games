// ═══════════════════════════════════════════════════════════════
// AchievementsService
// ───────────────────────────────────────
// RÔLE : savoir quels succès sont débloqués, par jeu. Ne connaît
//        jamais la LISTE des succès d'un jeu ni leur condition de
//        déblocage — ça reste entièrement défini côté jeu (via
//        sdk.achievements.unlock(id, ...), appelé quand le jeu a
//        lui-même vérifié sa propre condition).
// POSSÈDE : une entrée localStorage par jeu.
// PRIVÉ : voir StatsService.js pour la règle d'isolation par gameId.
// ═══════════════════════════════════════════════════════════════
import { readNamespaced, writeNamespaced, removeNamespaced } from '../storage/keys.js';

const ACH_NS = 'achievements';

function readUnlocked(gameId) {
  try { return readNamespaced(gameId, ACH_NS) || []; }
  catch (e) { console.warn('[AchievementsService] lecture corrompue pour', gameId, e); return []; }
}

export const AchievementsService = {
  isUnlocked(gameId, achId) {
    return readUnlocked(gameId).includes(achId);
  },
  /** Débloque `achId` s'il ne l'était pas déjà. Retourne true si
   *  c'est une NOUVELLE unlock (utile pour déclencher un toast une
   *  seule fois), false si déjà débloqué (idempotent). */
  unlock(gameId, achId) {
    const list = readUnlocked(gameId);
    if (list.includes(achId)) return false;
    list.push(achId);
    writeNamespaced(gameId, ACH_NS, list);
    return true;
  },
  unlockedList(gameId) { return readUnlocked(gameId); },
  reset(gameId) { removeNamespaced(gameId, ACH_NS); },
};
