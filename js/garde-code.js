/**
 * garde-code.js — Garde par code : affiche un pavé numérique et
 * n'exécute l'action protégée que si le code saisi est correct.
 *
 * Utilisée par le bouton du logo (Gestion des prix) et par le bouton
 * Clôture. Le code (MDP_GESTION) est écrit dans un fichier public : il
 * dissuade un regard indiscret, il ne constitue pas une sécurité forte.
 */
import { MDP_GESTION } from './config.js';
import { creerPaveNumerique } from './clavier.js';
import { modal, fermerModal } from './ui-modal.js';

export function demanderCode(titreEcran, siCodeCorrect) {
  let saisie = '';
  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = titreEcran;
  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';
  ecran.style.letterSpacing = '8px';
  const erreur = document.createElement('div');
  erreur.className = 'error-txt';

  const pave = creerPaveNumerique((touche) => {
    saisie = touche === 'C' ? '' : saisie + touche;
    ecran.textContent = '*'.repeat(saisie.length);
    erreur.textContent = '';
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-modal rouge';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', fermerModal);
  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    if (saisie === MDP_GESTION) {
      fermerModal();
      siCodeCorrect();
    } else {
      erreur.textContent = 'Code erroné';
      saisie = '';
      ecran.textContent = '';
    }
  });
  actions.append(btnRetour, btnValider);

  conteneur.append(titre, ecran, erreur, pave, actions);
  modal(conteneur);
}
