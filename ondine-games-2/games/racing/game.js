import { createSDK } from '../../core/sdk/createSDK.js';
import { UI } from '../../core/ui/components.js';
import { NotificationService } from '../../core/services/NotificationService.js';
import { createUI } from './ui.js';

const sdk = createSDK('racing');
const toastEl = UI.toastHost();
document.body.appendChild(toastEl);
NotificationService.mount(toastEl);

const game = createUI(sdk);
game.init();

window.goHome = game.goHome;
window.goSelect = game.goSelect;
window.goGarage = game.goGarage;
window.selectTrack = game.selectTrack;
window.selectDifficulty = game.selectDifficulty;
window.selectCar = game.selectCar;
window.buyUpgrade = game.buyUpgrade;
window.startRace = game.startRace;
window.onBoostPress = game.onBoostPress;
window.replayRace = game.replayRace;
window.nextRace = game.nextRace;
window.resultToGarage = game.resultToGarage;
window.resultToHome = game.resultToHome;
window.showStats = game.showStats;
