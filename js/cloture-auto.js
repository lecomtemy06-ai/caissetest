/**
 * cloture-auto.js — Mise à jour automatique des clôtures des journées
 * comptables TERMINÉES.
 *
 * Règle métier : il n'y a qu'une clôture par journée comptable. Le
 * bouton Clôture (verrouillé par code) produit la clôture du jour en
 * cours ; une fois la journée terminée (6 h du matin), ce module la
 * recalcule une dernière fois avec toutes les ventes, y compris celles
 * faites après un éventuel clic sur Clôture, et crée les clôtures
 * oubliées. Exécuté au démarrage, au changement de journée comptable
 * et au retour de la connexion.
 *
 * Une clôture n'est réécrite que si son contenu serait différent
 * (nombre de tickets ou total), pour ne générer aucune écriture
 * inutile sur le dépôt privé. Si le dépôt est injoignable alors
 * qu'il est configuré, on ne crée rien de nouveau (on ne peut pas
 * vérifier si la clôture existe déjà) : on réessaiera plus tard.
 */
import { dateComptable, datesConnuesLocalement, ventesDuJourFusionnees } from './ventes.js';
import { calculerCloture, cloturerEtSauvegarder, getCloture } from './cloture.js';
import { getConfigGithub, listerFichiersDistants, obtenirClotureDistante } from './github-sync.js';

const FENETRE_JOURS = 14; // on ne revérifie pas les journées plus anciennes
let enCours = false;
let derniereJournee = null;

function dateLimite() {
  const d = new Date();
  d.setDate(d.getDate() - FENETRE_JOURS);
  return d.toISOString().split('T')[0];
}

function memeContenu(a, b) {
  return a && b && a.nbTickets === b.nbTickets && Math.abs(a.totalJour - b.totalJour) < 0.005;
}

export async function mettreAJourCloturesTerminees() {
  if (enCours) return;
  enCours = true;
  try {
    const aujourdhui = dateComptable();
    const limite = dateLimite();
    const configure = !!getConfigGithub();
    const distantesVentes = await listerFichiersDistants('ventes');
    const distantesClotures = await listerFichiersDistants('clotures');
    const dates = new Set(datesConnuesLocalement());
    (distantesVentes || []).forEach(d => dates.add(d));

    for (const date of [...dates].sort()) {
      if (date >= aujourdhui || date < limite) continue;

      const ventes = await ventesDuJourFusionnees(date);
      const calcul = calculerCloture(ventes, date);
      if (!calcul) continue;

      let existante = getCloture(date);
      if (!existante) {
        if (configure && distantesClotures === null) continue; // injoignable : on ne sait pas
        if (distantesClotures && distantesClotures.includes(date)) {
          existante = await obtenirClotureDistante(date);
          if (!existante && configure) continue; // lecture échouée : on réessaiera
        }
      }
      if (memeContenu(existante, calcul)) continue;
      await cloturerEtSauvegarder(date, 'AUTO');
    }
  } catch (e) {
    console.warn('Mise à jour automatique des clôtures différée', e);
  } finally {
    enCours = false;
  }
}

// Surveille le changement de journée comptable (une tablette peut rester
// allumée toute la nuit) et relance la mise à jour à ce moment-là.
export function initClotureAuto() {
  derniereJournee = dateComptable();
  mettreAJourCloturesTerminees();
  setInterval(() => {
    const maintenant = dateComptable();
    if (maintenant !== derniereJournee) {
      derniereJournee = maintenant;
      mettreAJourCloturesTerminees();
    }
  }, 60000);
  window.addEventListener('online', mettreAJourCloturesTerminees);
}
