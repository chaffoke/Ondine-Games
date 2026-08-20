import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('snake');
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
window.confirmNewGame = game.confirmNewGame;
window.handleDirection = game.handleDirection;
window.goHome = game.goHome;
window.showStats = game.showStats;
