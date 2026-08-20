import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('puzzle-mosaique');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.init();

window.goHome = game.goHome;
window.selectDifficulty = game.selectDifficulty;
window.selectCharacter = game.selectCharacter;
window.startNewPuzzle = game.startNewPuzzle;
window.resumePuzzle = game.resumePuzzle;
window.nextPuzzle = game.nextPuzzle;
window.resultToHome = game.resultToHome;
window.replaySame = game.replaySame;
window.useHint = game.useHint;
window.confirmQuit = game.confirmQuit;
window.showStats = game.showStats;
