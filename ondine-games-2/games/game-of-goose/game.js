import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('game-of-goose');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.renderHome();

window.setPlayerCount = game.setPlayerCount;
window.setVsAI = game.setVsAI;
window.startGame = game.startGame;
window.rollForCurrentPlayer = game.rollForCurrentPlayer;
window.goHome = game.goHome;
window.showStats = game.showStats;
