// ═══════════════════════════════════════════════════════════════
// games/_template/ui.js
// ───────────────────────────────────────
// Rendu + gestion d'écran. Reçoit le SDK déjà créé (voir game.js) —
// n'importe JAMAIS un service de core/services/ directement, ni
// core/storage/keys.js. Seulement `sdk.*`.
//
// Les 15 fonctions du SDK minimal (voir /core/CLAUDE.md pour le
// détail complet de chacune) :
//
//   sdk.stats.get/getAll/set/increment/setMax/setMin/reset
//   sdk.achievements.unlock/isUnlocked/unlockedList/reset
//   sdk.audio.tone/play/isEnabled/setEnabled
//   sdk.toast.show
//   sdk.dialog.confirm  → Promise<boolean>
//   sdk.save.read/write/hasSave/clear
//   sdk.random.shuffle
//   sdk.navigation.go
// ═══════════════════════════════════════════════════════════════
import { createInitialState, playTurn } from './logic.js';

export function createUI(sdk) {
  let state = createInitialState();

  function startGame() {
    state = createInitialState();
    sdk.navigation.go('sg');
    render();
  }

  function scorePoint() {
    state = playTurn(state, 1);
    sdk.stats.increment('games'); // exemple — adapte à tes propres clés
    sdk.audio.play('click');
    render();
  }

  function goHome() {
    sdk.navigation.go('sh');
  }

  function render() {
    const el = document.getElementById('score');
    if (el) el.textContent = state.score;
  }

  return { startGame, scorePoint, goHome };
}
