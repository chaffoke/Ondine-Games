// ═══════════════════════════════════════════════════════════════
// SnapshotStore
// ───────────────────────────────────────
// RÔLE : pile de clones JSON profonds, taille bornée — pour les jeux
//        qui font un vrai undo multi-coups (Spider Solitaire en est
//        la preuve : historique par snapshots déjà fonctionnel).
// NE DOIT JAMAIS : décider QUAND un jeu doit permettre l'undo, ni
//        avec quelle portée. Rami, par exemple, n'autorise l'annulation
//        que jusqu'à la pioche (règle du jeu réelle, pas un manque
//        d'outil) — ce mécanisme ne doit pas lui être imposé.
// ───────────────────────────────────────
// NOUVEAU — n'existait pas dans le CoreBundle Batch 1. Formalise le
// pattern déjà utilisé par Spider (push/pop de JSON.parse(JSON.
// stringify(state)), pile bornée à 50).
// ═══════════════════════════════════════════════════════════════

export function createSnapshotStore(maxSize = 50) {
  const stack = [];
  return {
    push(state) {
      stack.push(JSON.parse(JSON.stringify(state)));
      if (stack.length > maxSize) stack.shift();
    },
    pop() {
      return stack.pop() ?? null;
    },
    peek() {
      return stack.length ? stack[stack.length - 1] : null;
    },
    clear() {
      stack.length = 0;
    },
    canUndo() {
      return stack.length > 0;
    },
  };
}
