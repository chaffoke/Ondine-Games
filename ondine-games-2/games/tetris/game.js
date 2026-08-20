import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('tetris');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.renderHome();

document.addEventListener('keydown', (e) => game.handleKey(e));
document.addEventListener('keyup', (e) => game.handleKeyUp(e));

window.startGame = game.startGame;
window.confirmNewGame = game.confirmNewGame;
window.onMove = game.onMove;
window.onRotate = game.onRotate;
window.onSoftDropStart = game.onSoftDropStart;
window.onSoftDropEnd = game.onSoftDropEnd;
window.onHardDrop = game.onHardDrop;
window.onHold = game.onHold;
window.goHome = game.goHome;
window.showStats = game.showStats;
