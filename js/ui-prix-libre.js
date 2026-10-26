/**
 * ui-prix-libre.js — Pop-up de saisie d'un prix pour un article "à prix
 * libre" (champ `special: 'prix-libre'` du catalogue, ex. "Salade Divers" :
 * une salade sur mesure dont le prix est encodé à chaque vente).
 * Le taux de TVA est celui de l'article dans le catalogue (6 % par défaut,
 * modifiable dans Gestion Article). Le prix saisi est TTC.
 */
import { ajouterArticle } from './panier.js';
import { modal, fermerModal } from './ui-modal.js';
import { creerPaveNumerique } from './clavier.js';

export function ouvrirPrixLibrePopup(nomArticle, tva) {
  let saisie = '';
  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = nomArticle;

  const sousTitre = document.createElement('div');
  sousTitre.style.cssText = 'color:#aaa;font-size:13px;text-align:center;margin-bottom:6px';
  sousTitre.textContent = `Prix TTC — TVA ${tva}%`;

  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';
  ecran.textContent = '0';

  const erreur = document.createElement('div');
  erreur.className = 'error-txt';

  const pave = creerPaveNumerique((touche) => {
    saisie = touche === 'C' ? '' : saisie + touche;
    ecran.textContent = saisie || '0';
    erreur.textContent = '';
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnAnnuler = document.createElement('button');
  btnAnnuler.className = 'btn-modal rouge';
  btnAnnuler.textContent = '❌ Annuler';
  btnAnnuler.addEventListener('click', fermerModal);
  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    const prix = Math.round(parseFloat(saisie.replace(',', '.')) * 100) / 100;
    if (!saisie || isNaN(prix) || prix <= 0) {
      erreur.textContent = 'Entre un prix valide.';
      return;
    }
    ajouterArticle(nomArticle, prix, tva);
    fermerModal();
  });
  actions.append(btnAnnuler, btnValider);

  conteneur.append(titre, sousTitre, ecran, pave, erreur, actions);
  modal(conteneur);
}
