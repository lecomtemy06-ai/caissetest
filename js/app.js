/**
 * app.js — Point d'entrée de l'application. Démarre les modules dans un
 * ordre cohérent et relie les éléments d'interface qui ne dépendent
 * d'aucun écran modal (calculatrice, horloge, plein écran, PWA).
 */
import { initCatalogue } from './catalogue.js';
import { initUiMenu } from './ui-menu.js';
import { initUiPaiement } from './ui-paiement.js';
import { initUiHistorique } from './ui-historique.js';
import { initUiCaisse } from './ui-caisse.js';
import { initUiExport } from './ui-export.js';
import { initUiGestion } from './ui-gestion.js';
import { initUiParametres } from './ui-parametres.js';
import { creerCalculatrice } from './calculatrice.js';
import { traiterFile } from './github-sync.js';
import { initUiMode } from './ui-mode.js';
import { initPleinEcran } from './plein-ecran.js';
import { initClotureAuto } from './cloture-auto.js';

function initCalculatrice() {
  const calc = creerCalculatrice();
  const ecran = document.getElementById('ecran-calc');
  const grille = document.getElementById('grille-calc');

  const signalerErreur = () => {
    ecran.classList.add('erreur');
    setTimeout(() => ecran.classList.remove('erreur'), 400);
  };
  const afficher = (r) => {
    if (r && r.erreur) signalerErreur();
    ecran.textContent = calc.getExpression();
  };

  // [texte, classe CSS supplémentaire, action]
  const boutons = [
    ...['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.'].map(b =>
      [b, ['/', '*', '-'].includes(b) ? 'op' : '', () => { ecran.textContent = calc.saisir(b); }]),
    ['=', 'op', () => afficher(calc.calculer())],
    ['+', 'op', () => { ecran.textContent = calc.saisir('+'); }],
    ['C', 'eff', () => { ecran.textContent = calc.effacer(); }],
    ['⌫', 'corr', () => { ecran.textContent = calc.corriger(); }],
    ['✔ OK', 'ok', () => afficher(calc.ajouter())]
  ];
  boutons.forEach(([texte, classe, action]) => {
    const btn = document.createElement('button');
    btn.className = 'btn-calc' + (classe ? ' ' + classe : '');
    btn.textContent = texte;
    btn.addEventListener('click', action);
    grille.appendChild(btn);
  });
}

function initHorloge() {
  const elDate = document.getElementById('h-date');
  const elHeure = document.getElementById('h-heure');
  function maj() {
    const now = new Date();
    elDate.textContent = now.toLocaleDateString('fr-BE');
    elHeure.textContent = now.toLocaleTimeString('fr-BE');
    setTimeout(maj, 1000);
  }
  maj();
}

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(e => console.warn('Service worker non enregistré', e));
  }
}

async function demarrer() {
  await initCatalogue();
  initUiMenu();
  initUiPaiement();
  initUiHistorique();
  initUiCaisse();
  initUiExport();
  initUiGestion();
  initUiParametres();
  initCalculatrice();
  initHorloge();
  initUiMode();
  initPleinEcran();
  initServiceWorker();
  initClotureAuto();
  traiterFile(); // tente une synchronisation immédiate si déjà configuré
}

demarrer();
