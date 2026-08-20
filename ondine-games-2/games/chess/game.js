import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('chess');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.renderHome();

window.setMode = game.setMode;
window.setDifficulty = game.setDifficulty;
window.startGame = game.startGame;
window.confirmNewGame = game.confirmNewGame;
window.goHome = game.goHome;
window.showStats = game.showStats;
