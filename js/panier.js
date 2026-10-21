/**
 * panier.js — État et logique du panier de la vente en cours.
 * Ne touche jamais au DOM : les modules d'interface s'abonnent aux
 * changements via onChangement() pour rafraîchir leur affichage.
 */

let total = 0;
let panier = []; // [{nom, prixUnitaire, tva, quantite, supplements}]
const ecouteurs = [];

export function onChangement(fn) {
  ecouteurs.push(fn);
}

function notifier() {
  ecouteurs.forEach(fn => fn({ total, panier }));
}

export function getTotal() {
  return total;
}

export function getPanier() {
  return panier;
}

const cleSupplements = (l) => (l.supplements || []).join('|');

// Deux lignes ne fusionnent (quantité 2) que si elles sont identiques
// jusque dans leurs suppléments : un plat avec fromagère et le même plat
// sans fromagère restent deux lignes distinctes.
function trouverLigneExistante(nom, prixUnitaire, tva, supplements) {
  const cle = supplements.join('|');
  return panier.findIndex(l => l.nom === nom && Math.abs(l.prixUnitaire - prixUnitaire) < 0.001
    && l.tva === tva && cleSupplements(l) === cle);
}

// `supplements` : noms des suppléments choisis (un par ligne sur le ticket).
// Leur prix est déjà inclus dans `prixUnitaire`.
export function ajouterArticle(nom, prixUnitaire, tva, supplements = []) {
  const idx = trouverLigneExistante(nom, prixUnitaire, tva, supplements);
  if (idx >= 0) panier[idx].quantite++;
  else panier.push({ nom, prixUnitaire, tva, quantite: 1, supplements: [...supplements] });
  total = Math.round((total + prixUnitaire) * 100) / 100;
  notifier();
}

export function supprimerArticle(index) {
  const ligne = panier[index];
  if (!ligne) return;
  ligne.quantite--;
  total = Math.round((total - ligne.prixUnitaire) * 100) / 100;
  if (ligne.quantite <= 0) panier.splice(index, 1);
  notifier();
}

export function vider() {
  total = 0;
  panier = [];
  notifier();
}
