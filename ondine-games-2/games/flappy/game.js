import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('flappy');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.renderHome();

const gameScreen = document.getElementById('sg');
gameScreen.addEventListener('click', () => game.onFlap());
gameScreen.addEventListener('touchstart', (e) => { e.preventDefault(); game.onFlap(); }, { passive: false });
document.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); game.onFlap(); } });

window.startGame = game.startGame;
window.goHome = game.goHome;
window.showStats = game.showStats;
