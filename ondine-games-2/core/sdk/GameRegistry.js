// ═══════════════════════════════════════════════════════════════
// GameRegistry
// ───────────────────────────────────────
// RÔLE : lister les jeux disponibles à partir de leurs manifestes.
//        Le Hub ne doit jamais contenir `if (id === 'morpion')` —
//        il appelle GameRegistry.all() et affiche ce qui vient.
// ───────────────────────────────────────
// Dans cette phase (Phase 2), le Hub actuel N'EST PAS modifié (voir
// consigne section 24 du brief) — ce registre est prêt mais pas
// encore branché au Hub existant. Il sera consommé au moment où le
// Hub passera à la découverte automatique (architecture, section 16
// et 25/Phase 10), pas avant.
// ═══════════════════════════════════════════════════════════════

const registry = new Map();

export const GameRegistry = {
  register(manifest) {
    if (!manifest || typeof manifest.id !== 'string' || !manifest.id) {
      throw new Error('[GameRegistry] manifest invalide (id manquant)');
    }
    registry.set(manifest.id, manifest);
  },
  get(id) {
    return registry.get(id) || null;
  },
  all() {
    return Array.from(registry.values());
  },
};
