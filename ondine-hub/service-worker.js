// Service Worker minimal pour Ondine Games.
//
// OBJECTIF UNIQUE : satisfaire le critère d'installabilité Chrome/Android
// (bannière "Ajouter à l'écran d'accueil" automatique), qui exige un SW
// enregistré avec un handler 'fetch'. PAS une stratégie de cache complète :
// le contenu du projet évolue encore fréquemment (nouveaux jeux, correctifs),
// une mise en cache agressive risquerait de servir une version périmée aux
// joueurs. Chaque requête passe directement au réseau/disque, sans
// interception ni stockage.
//
// Si un vrai fonctionnement hors ligne pour le Hub lui-même devient
// prioritaire plus tard, ce fichier est le bon endroit pour l'étendre —
// mais chaque jeu Ondine Games est déjà autonome (aucune dépendance
// réseau pour jouer une fois la page chargée), donc ce n'est pas
// bloquant aujourd'hui.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Aucune interception réelle — laisse le navigateur gérer la requête
  // normalement. La présence de ce handler suffit au critère
  // d'installabilité.
});
