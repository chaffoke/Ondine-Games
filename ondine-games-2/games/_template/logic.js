// ═══════════════════════════════════════════════════════════════
// games/_template/logic.js
// ───────────────────────────────────────
// Logique PURE ici : aucun `document`, aucun `sdk`, aucun DOM.
// Objectif : pouvoir tester tes règles avec un simple script Node,
// AVANT d'écrire une seule ligne d'interface (voir games/morpion/
// logic.js pour un exemple réel, et le rapport de la Phase 2 pour
// pourquoi ça a évité de vraies régressions).
//
// Exemple minimal ci-dessous : remplace-le entièrement par tes
// propres règles. Rien de ce qui est ici n'est imposé par le SDK —
// c'est juste une structure de départ.
// ═══════════════════════════════════════════════════════════════

export function createInitialState() {
  return { score: 0, over: false };
}

export function playTurn(state, points) {
  return { ...state, score: state.score + points };
}

export function isGameOver(state) {
  return state.over;
}
