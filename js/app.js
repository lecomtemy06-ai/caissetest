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
import { elaguerVentesAnciennes } from './ventes.js';

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
  // Formateurs créés une seule fois (évite de réallouer chaque seconde)
  const fmtDate = new Intl.DateTimeFormat('fr-BE');
  const fmtHeure = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  function maj() {
    if (!document.hidden) { // écran éteint / onglet masqué : on ne dessine rien
      const now = new Date();
      elDate.textContent = fmtDate.format(now);
      elHeure.textContent = fmtHeure.format(now);
    }
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

  // Allège la mémoire de la tablette : une fois la file d'envoi vidée, on
  // retire la copie locale des tickets de plus de 31 jours (déjà sur le
  // dépôt privé). Au démarrage puis à chaque changement de journée.
  const alleger = () => setTimeout(() => { try { elaguerVentesAnciennes(31); } catch (e) { console.warn(e); } }, 20000);
  alleger();
  window.addEventListener('stockage-plein', () =>
    alert("⚠️ Mémoire de la tablette pleine : la vente est enregistrée mais risque de ne pas être conservée localement. Vérifiez la synchronisation (✓) puis utilisez Gestion > Purger le cache."));
}

demarrer();
