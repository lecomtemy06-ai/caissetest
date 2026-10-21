/**
 * ui-historique.js — Écrans "Historique des ventes" et "Clôture
 * journalière" (déclenchement, affichage, liste des journées passées).
 *
 * Toute consultation (ventes d'un jour, clôtures) va interroger le
 * dépôt privé en plus des données locales, pour qu'une machine puisse
 * voir l'activité de toutes les autres — y compris après un vidage du
 * cache local, tant que le jeton GitHub de cet appareil est configuré
 * (voir ui-parametres.js).
 */
import { ventesDuJourFusionnees, dateComptable, datesConnuesLocalement } from './ventes.js';
import { formaterTicketTexte } from './ticket.js';
import {
  cloturerEtSauvegarder, listerClotures, getCloture, mettreEnCacheCloture,
  supprimerCloture as supprimerClotureDonnees
} from './cloture.js';
import { getConfigGithub, obtenirClotureDistante, listerFichiersDistants } from './github-sync.js';
import { modal, fermerModal, escapeHtml, enregistrerAction, attrArgs } from './ui-modal.js';
import { telechargerFichier, ecrireFichierDossier } from './export.js';
import { demanderCode } from './garde-code.js';
import { imprimerTexte, dateHeureCourante } from './impression.js';

export function initUiHistorique() {
  document.getElementById('btn-historique').addEventListener('click', () => afficherHistorique());
  document.getElementById('btn-cloture').addEventListener('click',
    () => demanderCode('Code pour clôturer', demanderConfirmationCloture));
  enregistrerAction('lancerCloture', declencherCloture);
  enregistrerAction('voirTicket', voirTicket);
  enregistrerAction('imprimerTicket', imprimerCopieTicket);
  enregistrerAction('exporterCopieTicket', exporterCopieTicket);
  enregistrerAction('exporterCloture', exporterClotureTxt);
  enregistrerAction('voirCloture', voirCloture);
  enregistrerAction('supprimerCloture', demanderSuppressionCloture);
  enregistrerAction('confirmerSuppCloture', confirmerSuppressionCloture);
  enregistrerAction('ouvrirListeClotures', ouvrirListeClotures);
  enregistrerAction('afficherHistorique', (date) => afficherHistorique(date));
  enregistrerAction('ouvrirListeJoursVentes', ouvrirListeJoursVentes);
}

function afficherChargement(titre) {
  modal(`<h2>${escapeHtml(titre)}</h2><p class="confirm-txt">Récupération des données...</p>`);
}

function messageNonConfigure() {
  return `<p class="confirm-txt" style="font-size:12px;color:#FFB74D">
    ⚠️ Jeton GitHub non configuré sur cet appareil : seules les ventes
    faites ICI sont affichées (voir Gestion des prix → ⚙️ Paramètres).
  </p>`;
}

// Ventes du jour actuellement affichées (évite de relire le dépôt à
// chaque ouverture d'un ticket).
let jourAffiche = { date: null, ventes: [] };

export async function afficherHistorique(date = dateComptable()) {
  afficherChargement('Historique — ' + date);
  const configure = !!getConfigGithub();
  const ventes = await ventesDuJourFusionnees(date);
  jourAffiche = { date, ventes };
  const total = Math.round(ventes.reduce((s, v) => s + v.totalTTC, 0) * 100) / 100;

  let liste;
  if (!ventes.length) {
    liste = '<p class="confirm-txt">Aucune vente enregistrée pour cette journée.</p>';
  } else {
    // du plus récent au plus ancien : une copie demandée par un client
    // concerne presque toujours un des derniers tickets
    liste = [...ventes].reverse().map(v => {
      const mode = v.modeConsommation === 'SUR_PLACE' ? 'SUR PLACE' : (v.modeConsommation === 'EMPORTER' ? 'EMPORTER' : '');
      return `<button class="ticket-ligne" data-action="voirTicket" data-args="${attrArgs([v.numero, date])}">`
        + `N° ${escapeHtml(v.numero)} · ${escapeHtml(v.heureAffichee)} · ${v.totalTTC.toFixed(2)} € · ${escapeHtml(v.modePaiement)}${mode ? ' · ' + mode : ''}`
        + `</button>`;
    }).join('');
  }

  modal(`<h2>Historique du ${date}</h2>
    ${configure ? '' : messageNonConfigure()}
    <div class="resume-jour">${ventes.length} ticket${ventes.length > 1 ? 's' : ''} — total ${total.toFixed(2)} €</div>
    <div class="gestion-scroll">${liste}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="ouvrirListeJoursVentes">📅 Autres journées</button>
      <button class="btn-modal vert" data-action="fermerModal">✅ Fermer</button>
    </div>`);
}

async function chercherTicket(numero, date) {
  if (jourAffiche.date !== date) {
    jourAffiche = { date, ventes: await ventesDuJourFusionnees(date) };
  }
  return jourAffiche.ventes.find(v => String(v.numero) === String(numero)) || null;
}

async function voirTicket(numero, date) {
  const t = await chercherTicket(numero, date);
  if (!t) return;
  modal(`<h2>Ticket N° ${escapeHtml(t.numero)}</h2>
    <div class="cloture-texte">${escapeHtml(formaterTicketTexte(t))}</div>
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn-modal vert" data-action="imprimerTicket" data-args="${attrArgs([t.numero, date])}">🖨 Imprimer une copie</button>
      <button class="btn-modal gris" data-action="exporterCopieTicket" data-args="${attrArgs([t.numero, date])}">💾 Exporter (.txt)</button>
      <button class="btn-modal rouge" data-action="afficherHistorique" data-args="${attrArgs([date])}">⬅ Retour</button>
    </div>`);
}

async function imprimerCopieTicket(numero, date) {
  const t = await chercherTicket(numero, date);
  if (!t) return;
  imprimerTexte(formaterTicketTexte(t, { copie: dateHeureCourante() }));
}

async function exporterCopieTicket(numero, date) {
  const t = await chercherTicket(numero, date);
  if (!t) return;
  telechargerFichier(`ticket_${t.numero}_${t.dateComptable}_copie.txt`,
    formaterTicketTexte(t, { copie: dateHeureCourante() }), 'text/plain');
}

export async function ouvrirListeJoursVentes() {
  afficherChargement('Journées avec des ventes');
  const locales = datesConnuesLocalement();
  const distantes = await listerFichiersDistants('ventes');
  const ensemble = new Set(locales);
  (distantes || []).forEach(d => ensemble.add(d));
  const dates = [...ensemble].sort().reverse();

  let h = `<h2>Journées avec des ventes</h2><div class="gestion-scroll">`;
  if (!dates.length) {
    h += '<p class="confirm-txt">Aucune vente enregistrée.</p>';
  } else {
    dates.forEach(d => {
      h += `<div class="fichier-ligne">
        <button class="fichier-btn" data-action="afficherHistorique" data-args="${attrArgs([d])}">${d}</button>
      </div>`;
    });
  }
  h += `</div><button class="btn-modal rouge full" style="margin-top:10px" data-action="fermerModal">Fermer</button>`;
  modal(h);
}

// Après le code : confirmation, en rappelant qu'il n'existe qu'une
// clôture par journée comptable (une nouvelle clôture la remplace).
function demanderConfirmationCloture() {
  const date = dateComptable();
  const existe = !!getCloture(date);
  modal(`<h2>Clôturer la journée du ${date} ?</h2>
    <p class="confirm-txt">${existe
      ? "Une clôture existe déjà pour cette journée : elle sera mise à jour (une seule clôture par journée comptable)."
      : "La clôture récapitule toutes les ventes de la journée comptable (de toutes les caisses)."}
      <br>Elle sera de toute façon recalculée automatiquement une fois la journée terminée (6 h).</p>
    <div class="modal-actions">
      <button class="btn-modal rouge" data-action="fermerModal">NON</button>
      <button class="btn-modal vert" data-action="lancerCloture">OUI, CLÔTURER</button>
    </div>`);
}

async function declencherCloture() {
  afficherChargement('Clôture en cours');
  const c = await cloturerEtSauvegarder();
  if (!c) {
    modal(`<h2>Clôture</h2>
      <p class="confirm-txt">Aucune vente pour cette journée.</p>
      <button class="btn-modal rouge full" data-action="fermerModal">FERMER</button>`);
    return;
  }
  ecrireFichierDossier(`cloture_${c.date}.txt`, c.texte);
  modal(`<h2>CLÔTURE JOURNÉE</h2>
    <div style="color:#aaa;text-align:center;margin-bottom:8px">${c.date}</div>
    <div class="cloture-texte">${escapeHtml(c.texte)}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="exporterCloture" data-args="${attrArgs([c.date])}">💾 Exporter (.txt)</button>
      <button class="btn-modal vert" data-action="fermerModal">✅ Fermer</button>
    </div>`);
}

function exporterClotureTxt(date) {
  const c = getCloture(date);
  if (!c) return;
  telechargerFichier(`cloture_${date}.txt`, c.texte, 'text/plain');
}

export async function ouvrirListeClotures() {
  afficherChargement('Liste des clôtures');
  const local = listerClotures();
  const datesDistantes = await listerFichiersDistants('clotures');
  const ensemble = new Set(Object.keys(local));
  (datesDistantes || []).forEach(d => ensemble.add(d));
  const dates = [...ensemble].sort().reverse();

  let h = `<h2>Liste des clôtures</h2><div class="gestion-scroll">`;
  if (!dates.length) {
    h += '<p class="confirm-txt">Aucune clôture enregistrée.</p>';
  } else {
    dates.forEach(d => {
      const total = local[d] ? `${local[d].totalJour.toFixed(2)} €` : '(à consulter)';
      h += `<div class="fichier-ligne">
        <button class="fichier-btn" data-action="voirCloture" data-args="${attrArgs([d])}">cloture_${d} — ${total}</button>
        ${local[d] ? `<button class="btn-del" data-action="supprimerCloture" data-args="${attrArgs([d])}">🗑</button>` : ''}
      </div>`;
    });
  }
  h += `</div><button class="btn-modal rouge full" style="margin-top:10px" data-action="fermerModal">Fermer</button>`;
  modal(h);
}

async function voirCloture(date) {
  let c = getCloture(date);
  if (!c) {
    afficherChargement('Clôture ' + date);
    c = await obtenirClotureDistante(date);
    if (c) mettreEnCacheCloture(date, c);
  }
  const texte = c ? c.texte : "Introuvable, ni localement ni sur le dépôt privé.";
  modal(`<h2>Clôture ${date}</h2>
    <div class="cloture-texte">${escapeHtml(texte)}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="exporterCloture" data-args="${attrArgs([date])}">💾 Exporter</button>
      <button class="btn-modal vert" data-action="ouvrirListeClotures">⬅ Retour</button>
    </div>`);
}

function demanderSuppressionCloture(date) {
  modal(`<h2>Confirmation</h2>
    <p class="confirm-txt">Supprimer la clôture du ${date} de CET appareil uniquement ?<br>
      Le fichier du dépôt privé GitHub n'est PAS touché : la clôture restera consultable et exportable.</p>
    <div class="modal-actions">
      <button class="btn-modal rouge" data-action="ouvrirListeClotures">NON</button>
      <button class="btn-modal vert" data-action="confirmerSuppCloture" data-args="${attrArgs([date])}">OUI</button>
    </div>`);
}

function confirmerSuppressionCloture(date) {
  supprimerClotureDonnees(date);
  ouvrirListeClotures();
}
