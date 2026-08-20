// ═══════════════════════════════════════════════════════════════
// games/2048/game.js
// ═══════════════════════════════════════════════════════════════
import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('2048');

const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.renderHome();

document.addEventListener('keydown', (e) => game.handleKey(e));
const gridHost = document.getElementById('sg');
gridHost.addEventListener('touchstart', (e) => game.handleTouchStart(e), { passive: true });
gridHost.addEventListener('touchend', (e) => game.handleTouchEnd(e), { passive: true });

window.startGame = game.startGame;
window.resumeGame = game.resumeGame;
window.confirmNewGame = game.confirmNewGame;
window.undo2048 = game.undo;
window.continueAfterWin = game.continueAfterWin;
window.goHome = game.goHome;
window.showStats = game.showStats;
