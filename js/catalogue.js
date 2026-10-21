/**
 * catalogue.js — Chargement et gestion du catalogue (articles, prix, TVA).
 *
 * Trois sources, par ordre de priorité :
 *  1. le catalogue.json du DÉPÔT PRIVÉ (version partagée par tous les
 *     appareils), si la synchronisation GitHub est configurée et joignable ;
 *  2. la copie locale de l'appareil (localStorage) ;
 *  3. le catalogue de RÉFÉRENCE embarqué dans l'application publique
 *     (data/catalogue.json).
 *
 * Garde-fou contre les "reliquats" d'une ancienne version : le catalogue
 * de référence porte un numéro de génération (voir catalogue-patch.js).
 * Toute copie d'une génération antérieure — cache local oublié sur une
 * tablette, ou catalogue.json du dépôt privé pas encore remplacé — est
 * écartée au profit de la référence. Dans le cas du dépôt privé, l'ancien
 * fichier est d'abord archivé (archives/), puis remplacé. Les
 * modifications en attente d'envoi créées sur l'ancienne génération sont
 * abandonnées : les rejouer ferait réapparaître d'anciens articles.
 *
 * Chaque modification (prix, TVA, ajout, suppression, renommage) est
 * appliquée localement ET mise en file sous forme de PATCH ponctuel
 * (voir catalogue-patch.js) plutôt que comme un remplacement complet :
 * cela évite qu'un appareil écrase, par une synchronisation retardée,
 * les modifications faites entre-temps sur un autre appareil.
 */
import { CHEMIN_CATALOGUE_JSON } from './config.js';
import { Stockage } from './stockage.js';
import { fileAttendreSynchro, lireOuMigrerCatalogueDistant } from './github-sync.js';
import {
  appliquerPatchCatalogue, PREFIXE_PRIX_FIXES, VERSION_CATALOGUE, estCatalogueObsolete
} from './catalogue-patch.js';

let catalogue = null;

export async function initCatalogue() {
  const reference = await chargerCatalogueDeReference(); // null si injoignable
  const local = Stockage.chargerCatalogue();
  const localObsolete = !!local && estCatalogueObsolete(local);
  let ancienneGeneration = localObsolete;

  let base;
  const distant = await lireOuMigrerCatalogueDistant(reference);
  if (distant) {
    base = distant.catalogue;
    if (distant.migre) ancienneGeneration = true;
  } else if (local && (!localObsolete || !reference)) {
    base = local; // copie locale valide (ou obsolète faute de référence disponible)
  } else if (reference) {
    base = reference;
  } else {
    base = catalogueVide();
  }

  // Les modifications en attente ont été faites sur l'ancienne génération :
  // on les abandonne plutôt que de ressusciter d'anciens articles.
  let enAttente = Stockage.chargerFileSync();
  if (ancienneGeneration) {
    enAttente = enAttente.filter(item => item.type !== 'catalogue');
    Stockage.sauvegarderFileSync(enAttente);
  }

  catalogue = base;

  // Ré-applique les modifications faites sur CET appareil mais pas
  // encore confirmées sur GitHub (ex. faites hors-ligne), pour ne
  // jamais les faire disparaître visuellement en attendant leur tour
  // de synchronisation.
  enAttente
    .filter(item => item.type === 'catalogue')
    .forEach(item => appliquerPatchCatalogue(catalogue, item.patch));

  if (typeof catalogue.version !== 'number' && !estCatalogueObsolete(catalogue)) {
    catalogue.version = VERSION_CATALOGUE;
  }
  Stockage.sauvegarderCatalogue(catalogue);
  return catalogue;
}

function catalogueVide() {
  return { categories: { "Plats": { types: {}, viandes: {} } }, supplements: {} };
}

// Catalogue de référence embarqué dans l'application publique.
async function chargerCatalogueDeReference() {
  try {
    const reponse = await fetch(CHEMIN_CATALOGUE_JSON, { cache: 'no-store' });
    if (!reponse.ok) throw new Error('catalogue.json introuvable');
    return await reponse.json();
  } catch (e) {
    console.warn("Impossible de charger data/catalogue.json (catalogue de référence).", e);
    return null;
  }
}

export function getCatalogue() {
  return catalogue;
}

export function getArticleRef(cat, nom) {
  if (cat === 'Plats-types') return catalogue.categories.Plats.types[nom];
  if (cat === 'Plats-viandes') return catalogue.categories.Plats.viandes[nom];
  if (cat === 'SUPPLEMENTS') return catalogue.supplements[nom];
  if (cat.startsWith(PREFIXE_PRIX_FIXES)) {
    const format = catalogue.categories.Plats.types[cat.slice(PREFIXE_PRIX_FIXES.length)];
    return format && format.prixFixes ? format.prixFixes[nom] : undefined;
  }
  return catalogue.categories[cat] ? catalogue.categories[cat][nom] : undefined;
}

function persisterEtSynchroniser(patch) {
  appliquerPatchCatalogue(catalogue, patch);
  Stockage.sauvegarderCatalogue(catalogue);
  // Un instantané complet du catalogue local est joint au cas où le
  // fichier n'existerait pas encore du tout sur GitHub (tout premier
  // envoi) : voir github-sync.js pour son usage exact (amorçage
  // uniquement, jamais utilisé comme écrasement).
  fileAttendreSynchro({ type: 'catalogue', patch, amorce: catalogue });
}

export function modifierPrix(cat, nom, prix) {
  if (!getArticleRef(cat, nom)) return;
  persisterEtSynchroniser({ op: 'prix', cat, nom, valeur: prix });
}

export function cyclerTva(cat, nom) {
  const obj = getArticleRef(cat, nom);
  if (!obj) return;
  const cycle = [6, 12, 21];
  const i = cycle.indexOf(obj.tva);
  const valeur = cycle[(i + 1) % cycle.length];
  persisterEtSynchroniser({ op: 'tva', cat, nom, valeur });
}

export function basculerPromo(cat, nom) {
  const obj = getArticleRef(cat, nom);
  if (!obj) return;
  persisterEtSynchroniser({ op: 'promo', cat, nom, valeur: !obj.promo });
}

export function basculerFavori(cat, nom) {
  const obj = getArticleRef(cat, nom);
  if (!obj) return;
  persisterEtSynchroniser({ op: 'favori', cat, nom, valeur: !obj.favori });
}

export function renommerArticle(cat, nomActuel, nouveauNom) {
  if (!getArticleRef(cat, nomActuel) || nouveauNom === nomActuel) return;
  persisterEtSynchroniser({ op: 'renommer', cat, nomActuel, nouveauNom });
}

export function supprimerArticle(cat, nom) {
  persisterEtSynchroniser({ op: 'supprimer', cat, nom });
}

export function ajouterArticleCatalogue(cat, nom, prix, tva, promo = false, favori = false) {
  persisterEtSynchroniser({ op: 'ajouter', cat, nom, prix, tva, promo, favori });
}
