import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('maze-rush');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.init();

window.goHome = game.goHome;
window.goLevelSelect = game.goLevelSelect;
window.selectCharacter = game.selectCharacter;
window.selectDifficulty = game.selectDifficulty;
window.startLevel = game.startLevel;
window.setDesiredDir = game.setDesiredDir;
window.nextLevel = game.nextLevel;
window.retryLevel = game.retryLevel;
window.gameOverToLevels = game.gameOverToLevels;
window.gameOverToHome = game.gameOverToHome;
window.finalToHome = game.finalToHome;
window.finalReplay = game.finalReplay;
window.showStats = game.showStats;
