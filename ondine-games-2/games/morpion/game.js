// ═══════════════════════════════════════════════════════════════
// games/morpion/game.js
// ───────────────────────────────────────
// Point d'entrée du jeu. Crée le SDK (gameId fixé une fois pour
// toutes), monte le toast, câble les boutons de l'écran d'accueil,
// et expose sur `window` uniquement ce que les attributs onclick=""
// du HTML ont besoin d'appeler (pattern déjà utilisé par les 18
// jeux existants, conservé pour rester simple et lisible sans
// framework — voir architecture, section 28 : "pas de framework").
// ═══════════════════════════════════════════════════════════════
import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('morpion');

// Monte le toast une seule fois au chargement (pattern UI.toastHost
// + NotificationService.mount(), identique à celui du Batch 1).
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.updateHomeStats();

// Exposition minimale pour les attributs onclick="" du HTML — pas
// d'autre surface globale.
window.setMode = game.setMode;
window.setDiff = game.setDiff;
window.startGame = game.startGame;
window.nextRound = game.nextRound;
window.goHome = game.goHome;
window.showScreen = game.showScreen;
window.confirmLeaveGame = game.confirmLeaveGame;
window.showRules = game.showRules;
