// ═══════════════════════════════════════════════════════════════
// UI — bibliothèque de composants Ondine Games
// ───────────────────────────────────────
// Chaque fonction retourne un élément DOM prêt à être inséré dans
// la page. Aucune fonction ici ne connaît un jeu en particulier.
// Le style visuel (couleurs, rayons, ombres) vient TOUJOURS de
// core/design-tokens.css via les variables --c1, --glass, etc.
// Ne jamais coder une couleur en dur dans un composant.
// ───────────────────────────────────────
// Extrait tel quel du CoreBundle Batch 1. Volontairement minimal —
// seuls les composants réellement utilisés par au moins un jeu sont
// présents. progressBar/tabs/list/grid/bottomSheet/emptyState/
// loading/gameCard/profileCard seront ajoutés le jour où un jeu réel
// en a besoin, pas par anticipation (voir architecture, section 13).
// ═══════════════════════════════════════════════════════════════

export const UI = {
  /**
   * Crée l'élément hôte du toast. À insérer une fois dans la page,
   * puis à passer à NotificationService.mount(el).
   */
  toastHost() {
    const el = document.createElement('div');
    el.className = 'ondine-toast';
    el.id = 'ondineToast';
    return el;
  },

  button(label, { variant = 'primary', onClick, icon, disabled = false } = {}) {
    const el = document.createElement('button');
    el.className = `ondine-btn ondine-btn-${variant}`;
    el.innerHTML = (icon ? `<span class="ondine-btn-icon">${icon}</span>` : '') + label;
    if (disabled) el.disabled = true;
    if (onClick) el.addEventListener('click', onClick);
    return el;
  },

  iconButton(icon, { onClick, title = '' } = {}) {
    const el = document.createElement('button');
    el.className = 'ondine-icon-btn';
    el.textContent = icon;
    if (title) el.title = title;
    if (onClick) el.addEventListener('click', onClick);
    return el;
  },

  badge(text, { variant = 'default' } = {}) {
    const el = document.createElement('span');
    el.className = `ondine-badge ondine-badge-${variant}`;
    el.textContent = text;
    return el;
  },

  statCard({ value, label, icon = '' } = {}) {
    const el = document.createElement('div');
    el.className = 'ondine-stat-card';
    el.innerHTML = `${icon ? `<div class="ondine-stat-icon">${icon}</div>` : ''}
      <div class="ondine-stat-value">${value}</div>
      <div class="ondine-stat-label">${label}</div>`;
    return el;
  },

  achievementCard({ icon, name, desc, unlocked, xp }) {
    const el = document.createElement('div');
    el.className = 'ondine-ach-card' + (unlocked ? ' unlocked' : '');
    el.innerHTML = `<div class="ondine-ach-icon">${icon}</div>
      <div class="ondine-ach-body">
        <div class="ondine-ach-name">${name}</div>
        <div class="ondine-ach-desc">${desc}</div>
      </div>
      <div class="ondine-ach-badge">${unlocked ? '✓' : '🔒'}${xp ? ` +${xp} XP` : ''}</div>`;
    return el;
  },

  /**
   * Modale générique : titre, corps (élément DOM déjà construit),
   * boutons d'action. Retourne { el, close } — `el` est déjà attaché
   * à un overlay plein écran, prêt à être inséré dans document.body.
   * Utilisée en interne par DialogService — un jeu peut aussi
   * l'utiliser directement pour ses propres besoins d'affichage.
   */
  modal({ title, bodyEl, actions = [] } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'ondine-modal-overlay';

    const box = document.createElement('div');
    box.className = 'ondine-modal-box';

    if (title) {
      const h = document.createElement('div');
      h.className = 'ondine-modal-title';
      h.textContent = title;
      box.appendChild(h);
    }
    if (bodyEl) {
      const body = document.createElement('div');
      body.className = 'ondine-modal-body';
      body.appendChild(bodyEl);
      box.appendChild(body);
    }
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'ondine-modal-actions';
      actions.forEach((btnEl) => row.appendChild(btnEl));
      box.appendChild(row);
    }
    overlay.appendChild(box);

    function close() { overlay.remove(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    return { el: overlay, close };
  },
};
