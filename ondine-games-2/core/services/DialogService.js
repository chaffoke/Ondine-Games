// ═══════════════════════════════════════════════════════════════
// DialogService
// ───────────────────────────────────────
// RÔLE : afficher une boîte de dialogue de confirmation bloquante
//        (au sens UX, pas au sens JS — l'appel est asynchrone) et
//        retourner la réponse de l'utilisateur. Remplace les
//        `confirm()` natifs du navigateur, incohérents visuellement
//        avec le reste de la plateforme, et les `confirmDialog()`
//        dupliqués à l'identique dans les 12 jeux Batch 2/3.
// NE DOIT JAMAIS : connaître le texte ou le contexte d'un jeu — tout
//        le contenu est fourni par l'appelant.
// ───────────────────────────────────────
// S'appuie sur UI.modal() — c'est le seul service qui a le droit
// d'importer un composant UI directement (car il EST la logique
// derrière ce composant, pas un jeu qui le consommerait).
// ═══════════════════════════════════════════════════════════════
import { UI } from '../ui/components.js';

export const DialogService = {
  /** Retourne une Promise<boolean> : true si confirmé, false si annulé. */
  confirm({ title = '', message = '', confirmLabel = 'OK', cancelLabel = 'Annuler' } = {}) {
    return new Promise((resolve) => {
      const bodyEl = document.createElement('div');
      bodyEl.textContent = message;

      const confirmBtn = UI.button(confirmLabel, {
        variant: 'primary',
        onClick: () => { modal.close(); resolve(true); },
      });
      const cancelBtn = UI.button(cancelLabel, {
        variant: 'secondary',
        onClick: () => { modal.close(); resolve(false); },
      });

      const modal = UI.modal({ title, bodyEl, actions: [confirmBtn, cancelBtn] });
      document.body.appendChild(modal.el);
    });
  },
};
