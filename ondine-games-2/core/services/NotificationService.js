// ═══════════════════════════════════════════════════════════════
// NotificationService
// ───────────────────────────────────────
// RÔLE : afficher des messages brefs et non bloquants (toasts).
// POSSÈDE : l'élément DOM du toast, son minuteur d'auto-masquage.
// NE DOIT JAMAIS : connaître un jeu, une règle de jeu, ou un texte
//        spécifique à un jeu — le texte affiché vient toujours de
//        l'appelant (le jeu, via le SDK).
// ───────────────────────────────────────
// Extrait tel quel du CoreBundle du Batch 1 (déjà utilisé par
// Solitaire, Puissance 4, Uno, Shut the Box, Démineur, Rhythm Hero).
// Remplace les fonctions toast() précédemment dupliquées à
// l'identique dans Solitaire, Sudoku, YAMS, puis dans les 12 jeux
// des Batch 2/3.
// ═══════════════════════════════════════════════════════════════

let hostEl = null;
let hideTimer = null;
const DEFAULT_DURATION_MS = 2200;

/**
 * Doit être appelé une fois par le Hub ou par la page du jeu,
 * en lui passant l'élément DOM créé par UI.toastHost().
 */
export function mount(el) {
  hostEl = el;
}

export function show(message, variant = 'info', duration = DEFAULT_DURATION_MS) {
  if (!hostEl) {
    // Dégradation silencieuse : pas de host monté = pas de toast,
    // mais ça ne doit jamais casser le jeu.
    console.warn('[NotificationService] show() appelé avant mount() :', message);
    return;
  }
  hostEl.textContent = message;
  hostEl.dataset.variant = variant;
  hostEl.classList.remove('ondine-toast-show');
  void hostEl.offsetWidth; // force le reflow pour relancer la transition
  hostEl.classList.add('ondine-toast-show');

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => hostEl.classList.remove('ondine-toast-show'), duration);
}

export const NotificationService = { mount, show };
