// ═══════════════════════════════════════════════════════════════
// createSDK(gameId)
// ───────────────────────────────────────
// SEULE API que les jeux sont autorisés à utiliser pour parler à la
// plateforme. Un jeu ne doit JAMAIS importer un service de
// core/services/ directement (voir architecture, section 1 et 4) :
// chaque service privé prend un `gameId` en paramètre de CHAQUE
// méthode — s'il était exposé tel quel à un jeu, celui-ci pourrait
// techniquement lire/écrire les données d'un AUTRE jeu en changeant
// le gameId passé. createSDK() est le SEUL endroit où le gameId est
// fixé une fois pour toutes, par fermeture, puis jamais reexposé.
//
// API délibérément MINIMALE (15 fonctions, voir architecture,
// section 3) : seulement ce que les 18 jeux utilisent réellement.
// Pas de sdk.ai (reste un engine optionnel), pas de sdk.cloud/
// profile/theme/settings (aucune preuve d'un besoin partagé par
// plus d'1-2 jeux à ce jour).
// ═══════════════════════════════════════════════════════════════
import { StatsService } from '../services/StatsService.js';
import { AchievementsService } from '../services/AchievementsService.js';
import { AudioService } from '../services/AudioService.js';
import { NotificationService } from '../services/NotificationService.js';
import { SaveService } from '../services/SaveService.js';
import { DialogService } from '../services/DialogService.js';
import { NavigationService } from '../services/NavigationService.js';
import { shuffle } from '../engines/RandomEngine.js';

/** Validation minimale — évite une erreur silencieuse si un jeu
 *  oublie de passer son gameId (bug de développement, pas un cas
 *  d'usage normal à gérer gracieusement). */
function assertValidGameId(gameId) {
  if (typeof gameId !== 'string' || gameId.trim() === '') {
    throw new Error(`[createSDK] gameId invalide : ${JSON.stringify(gameId)}`);
  }
}

export function createSDK(gameId) {
  assertValidGameId(gameId);

  return {
    gameId,

    stats: {
      get: (key, defaultValue = 0) => StatsService.get(gameId, key, defaultValue),
      getAll: () => StatsService.getAll(gameId),
      set: (key, value) => StatsService.set(gameId, key, value),
      increment: (key, n = 1) => StatsService.increment(gameId, key, n),
      setMax: (key, value) => StatsService.setMax(gameId, key, value),
      setMin: (key, value) => StatsService.setMin(gameId, key, value),
      reset: () => StatsService.reset(gameId),
    },

    achievements: {
      /**
       * Débloque `id` et affiche un toast + joue le son "unlock" si
       * c'est une NOUVELLE unlock (idempotent — sans risque à
       * rappeler). Centralise ce que les 12 jeux Batch 2/3 répétaient
       * chacun individuellement (achUnlock + toast + playSound).
       */
      unlock(id, name, icon = '🏅') {
        const isNew = AchievementsService.unlock(gameId, id);
        if (isNew) {
          AudioService.play('unlock');
          NotificationService.show(`${icon} Succès : ${name || id}`, 'success');
        }
        return isNew;
      },
      isUnlocked: (id) => AchievementsService.isUnlocked(gameId, id),
      unlockedList: () => AchievementsService.unlockedList(gameId),
      reset: () => AchievementsService.reset(gameId),
    },

    audio: {
      tone: (freq, dur, type, vol) => AudioService.tone(freq, dur, type, vol),
      play: (presetName) => AudioService.play(presetName),
      isEnabled: () => AudioService.isEnabled(),
      setEnabled: (v) => AudioService.setEnabled(v),
    },

    toast: {
      show: (message, duration) => NotificationService.show(message, 'info', duration),
    },

    dialog: {
      confirm: (title, message, confirmLabel = 'OK', cancelLabel = 'Annuler') =>
        DialogService.confirm({ title, message, confirmLabel, cancelLabel }),
    },

    save: {
      read: () => SaveService.read(gameId),
      write: (data) => SaveService.write(gameId, data),
      hasSave: () => SaveService.hasSave(gameId),
      clear: () => SaveService.clear(gameId),
    },

    random: {
      shuffle: (array) => shuffle(array),
    },

    navigation: {
      go: (screenId) => NavigationService.go(screenId),
    },
  };
}
