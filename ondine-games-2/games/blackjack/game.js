import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('blackjack');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.renderHome();

window.setBet = game.setBet;
window.startRound = game.startRound;
window.onHit = game.onHit;
window.onStand = game.onStand;
window.onDouble = game.onDouble;
window.onSplit = game.onSplit;
window.nextRound = game.nextRound;
window.goHome = game.goHome;
window.showStats = game.showStats;
window.resetBankroll = game.resetBankroll;
