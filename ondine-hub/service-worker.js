// Service Worker Ondine Games — VRAIE stratégie hors ligne.
//
// Contexte : le jeu doit rester jouable même en démarrage à froid sans
// aucune connexion (ex. mode avion, wifi absent). Un précédent SW
// minimal ne mettait rien en cache (juste le critère d'installabilité) ;
// confirmé par test réel que ça échouait au démarrage à froid hors
// ligne. Ce SW corrige ça avec un vrai pré-remplissage du cache.
//
// STRATÉGIE : à l'installation, TOUT (Hub + les 34 jeux + icônes) est
// mis en cache d'un coup — pas seulement les pages déjà visitées, pour
// que le tout premier lancement hors ligne fonctionne aussi bien qu'un
// lancement ultérieur. Ensuite, chaque requête sert IMMÉDIATEMENT
// depuis le cache (rapide, fonctionne sans réseau), tout en relançant
// en parallèle une requête réseau pour rafraîchir le cache en arrière-
// plan dès qu'une connexion est là (stale-while-revalidate) — la
// prochaine ouverture aura la dernière version, sans jamais bloquer
// l'expérience hors ligne en attendant.
//
// IMPORTANT POUR LES MISES À JOUR FUTURES : incrémenter CACHE_VERSION
// à chaque déploiement de contenu modifié. Sans ça, une fois le cache
// rempli, les joueurs resteraient bloqués sur cette version indéfiniment
// même avec du wifi disponible (stale-while-revalidate rafraîchit le
// cache existant, mais un nom de cache identique ne déclenche pas de
// nettoyage de l'ancien contenu).
const CACHE_VERSION = 'ondine-games-v5';

const PRECACHE_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'games/2048.html',
  'games/421.html',
  'games/bataille-navale.html',
  'games/belote.html',
  'games/blackjack.html',
  'games/checkers.html',
  'games/chess.html',
  'games/dames.html',
  'games/demineur.html',
  'games/flappy.html',
  'games/game-of-goose.html',
  'games/mahjong.html',
  'games/mastermind.html',
  'games/maze-rush.html',
  'games/memory.html',
  'games/mille-bornes.html',
  'games/morpion.html',
  'games/othello.html',
  'games/puissance4.html',
  'games/puzzle-mosaique.html',
  'games/puzzle15.html',
  'games/quarto.html',
  'games/racing.html',
  'games/rami.html',
  'games/rhythmhero.html',
  'games/shutthebox.html',
  'games/simon.html',
  'games/snake.html',
  'games/solitaire.html',
  'games/spider.html',
  'games/sudoku.html',
  'games/tetris.html',
  'games/uno.html',
  'games/yams.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // ne gère que les requêtes GET de même origine (jamais les appels
  // externes type Google Fonts — laissés au comportement réseau normal,
  // ils sont déjà cosmétiques et non bloquants sans connexion)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => null); // pas de réseau : silencieux, on a déjà servi le cache

      // sert le cache immédiatement s'il existe ; sinon attend le réseau
      // (premier chargement jamais rencontré — cas normal en ligne)
      return cached || (await networkFetch) || new Response('Hors ligne et non mis en cache.', { status: 503 });
    })
  );
});
