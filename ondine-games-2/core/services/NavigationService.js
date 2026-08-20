// ═══════════════════════════════════════════════════════════════
// NavigationService
// ───────────────────────────────────────
// RÔLE : afficher un écran (`<div class="screen" id="...">`) et
//        cacher tous les autres. Formalise le pattern déjà présent,
//        quasi identique, dans 17 des 18 jeux actuels — mais qui
//        n'avait jamais été extrait en service, même dans le
//        CoreBundle du Batch 1 (vérifié par l'audit).
// NE DOIT JAMAIS : contenir un id d'écran ou une logique propre à un
//        jeu précis. Ne connaît que la convention `.screen` / id.
// NE PROPOSE PAS de back()/pile de navigation : non démontré dans le
//        code actuel (aucun des 18 jeux n'a de retour arrière
//        multi-niveaux — chaque écran est câblé explicitement vers
//        un écran précis). Ajouter back() serait de la spéculation.
// ═══════════════════════════════════════════════════════════════

export const NavigationService = {
  /** Cache tous les `.screen`, affiche celui d'id `screenId`. */
  go(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (!target) {
      console.warn('[NavigationService] écran introuvable :', screenId);
      return;
    }
    target.classList.remove('hidden');
  },
};
