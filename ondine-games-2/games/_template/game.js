// ═══════════════════════════════════════════════════════════════
// games/_template/game.js
// ───────────────────────────────────────
// Point d'entrée. Copie ce fichier tel quel pour un nouveau jeu —
// change seulement l'id passé à createSDK() et les imports/exports
// de window.* en bas.
// ═══════════════════════════════════════════════════════════════
import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('_template'); // ← change cet id pour ton jeu

const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);

window.startGame = game.startGame;
window.scorePoint = game.scorePoint;
window.goHome = game.goHome;
