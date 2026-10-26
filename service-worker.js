/**
 * service-worker.js — Fonctionnement hors-ligne de l'application (PWA).
 *
 * Stratégie "RÉSEAU D'ABORD, CACHE EN SECOURS" :
 *  - appareil en ligne : chaque fichier est redemandé au réseau (avec
 *    revalidation, donc peu de données) → une mise à jour publiée sur
 *    GitHub est visible dès le chargement suivant, sans cache périmé ;
 *  - réseau absent, ou trop lent (DELAI_RESEAU_MS) : on sert la copie en
 *    cache, pour que la caisse reste utilisable.
 * Les appels vers d'autres domaines (API GitHub...) ne sont jamais
 * interceptés. Les données métier (ventes, catalogue) ne passent pas
 * par ici : elles sont gérées par l'application (localStorage + GitHub).
 */
const CACHE_NOM = 'caisse-friterie-v10'; // à incrémenter si la LISTE des fichiers ci-dessous change
const DELAI_RESEAU_MS = 4000;

const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './data/catalogue.json',
  './js/app.js',
  './js/config.js',
  './js/stockage.js',
  './js/catalogue.js',
  './js/catalogue-patch.js',
  './js/panier.js',
  './js/calculatrice.js',
  './js/ticket.js',
  './js/ventes.js',
  './js/numerotation.js',
  './js/consommation.js',
  './js/plein-ecran.js',
  './js/cloture.js',
  './js/export.js',
  './js/github-sync.js',
  './js/clavier.js',
  './js/garde-code.js',
  './js/cloture-auto.js',
  './js/impression.js',
  './js/tri.js',
  './js/date-comptable.js',
  './js/format.js',
  './js/caisse.js',
  './js/ui-caisse.js',
  './js/ui-modal.js',
  './js/ui-menu.js',
  './js/ui-mode.js',
  './js/ui-ristourne.js',
  './js/ui-paiement.js',
  './js/ui-historique.js',
  './js/ui-export.js',
  './js/ui-prix-libre.js',
  './js/purge.js',
  './js/ui-gestion.js',
  './js/ui-parametres.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  // cache: 'reload' = on ignore le cache HTTP du navigateur, pour ne jamais
  // pré-charger une version périmée des fichiers.
  event.waitUntil(
    caches.open(CACHE_NOM).then(cache =>
      cache.addAll(FICHIERS_A_METTRE_EN_CACHE.map(url => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(noms => Promise.all(
      noms.filter(n => n !== CACHE_NOM).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

async function reseauPuisCache(requete) {
  const cache = await caches.open(CACHE_NOM);
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_RESEAU_MS);
  try {
    // no-cache : revalidation auprès du serveur (réponse 304 légère si inchangé)
    const reponse = await fetch(requete.url, { cache: 'no-cache', signal: controleur.signal });
    if (reponse.ok) {
      cache.put(requete, reponse.clone());
      return reponse;
    }
    return (await cache.match(requete)) || reponse;
  } catch (erreur) {
    const enCache = await cache.match(requete);
    if (enCache) return enCache;
    if (requete.mode === 'navigate') {
      const accueil = await cache.match('./index.html');
      if (accueil) return accueil;
    }
    throw erreur;
  } finally {
    clearTimeout(minuterie);
  }
}

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return; // API GitHub, etc.
  event.respondWith(reseauPuisCache(requete));
});
