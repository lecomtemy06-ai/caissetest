/**
 * purge.js — Efface tout ce que l'application a enregistré sur CET
 * appareil : stockage local (ventes, clôtures, comptages, catalogue,
 * jeton, file de synchronisation), caches du service worker, service
 * worker lui-même et base du dossier d'export. Le dépôt privé n'est
 * jamais touché.
 */
export async function purgerCacheLocal() {
  try { localStorage.clear(); } catch (e) { /* accès refusé : on continue */ }
  try { sessionStorage.clear(); } catch (e) { /* idem */ }

  try {
    if ('caches' in window) {
      const noms = await caches.keys();
      await Promise.all(noms.map(n => caches.delete(n)));
    }
  } catch (e) { console.warn('Purge des caches impossible', e); }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) { console.warn('Désinscription du service worker impossible', e); }

  try {
    if (indexedDB.databases) {
      const bases = await indexedDB.databases();
      await Promise.all(bases.filter(b => b.name).map(b => new Promise(res => {
        const req = indexedDB.deleteDatabase(b.name);
        req.onsuccess = req.onerror = req.onblocked = () => res();
      })));
    }
  } catch (e) { console.warn('Purge IndexedDB impossible', e); }
}
