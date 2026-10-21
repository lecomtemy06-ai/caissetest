/**
 * caisse.js — "Clôture de caisse" : comptage de l'argent en fin de
 * journée. L'opérateur écrit des lignes libres, par exemple
 *   530 liquide
 *   -30 frites
 * (un montant, éventuellement un petit calcul comme 10*50, puis un
 * libellé). Le total est comparé au liquide attendu d'après les ventes
 * de la journée comptable : c'est l'écart de caisse.
 *
 * Document INTERNE (sans valeur de ticket de caisse fiscal), enregistré
 * dans le dépôt privé : caisses/caisse_AAAA-MM-JJ_HHMMSS.json, un fichier
 * par comptage (jamais écrasé). Logique pure + stockage, aucun DOM.
 */
import { SOCIETE, LARGEUR_TICKET } from './config.js';
import { Stockage } from './stockage.js';
import { dateComptable, ventesDuJourFusionnees } from './ventes.js';
import { calculerCloture } from './cloture.js';
import { fileAttendreSynchro } from './github-sync.js';
import { nombreFr } from './format.js';

const arrondi = (x) => Math.round(x * 100) / 100;
const pad2 = (n) => String(n).padStart(2, '0');

function centrer(txt, largeur) {
  txt = String(txt);
  if (txt.length >= largeur) return txt.slice(0, largeur);
  return ' '.repeat(Math.floor((largeur - txt.length) / 2)) + txt;
}

// Analyse une ligne saisie : "<montant ou calcul> <libellé>".
// Renvoie { ok: true, ligne: { montant, libelle } } ou { ok: false, erreur }.
// Une ligne sans montant (texte seul) est acceptée comme simple note.
export function analyserLigne(saisie) {
  const brut = String(saisie || '').trim();
  if (!brut) return { ok: false, erreur: 'Ligne vide' };
  const m = brut.match(/^([0-9+\-*/.,\s]*)(.*)$/);
  const expression = m[1].replace(/\s+/g, '').replace(/,/g, '.');
  const libelle = m[2].trim();
  if (!expression) return { ok: true, ligne: { montant: null, libelle } };
  if (!/^[0-9+\-*/.]+$/.test(expression)) return { ok: false, erreur: 'Montant invalide' };
  let valeur;
  try {
    valeur = Function('"use strict"; return (' + expression + ')')();
  } catch {
    return { ok: false, erreur: 'Montant invalide' };
  }
  if (typeof valeur !== 'number' || !isFinite(valeur)) return { ok: false, erreur: 'Montant invalide' };
  return { ok: true, ligne: { montant: arrondi(valeur), libelle } };
}

export function totalLignes(lignes) {
  return arrondi(lignes.reduce((s, l) => s + (l.montant || 0), 0));
}

// Liquide attendu d'après les ventes (tous appareils) de la journée comptable.
// null si le calcul est impossible.
export async function liquideAttendu(jour = dateComptable()) {
  try {
    const ventes = await ventesDuJourFusionnees(jour);
    const c = calculerCloture(ventes, jour);
    return c ? c.totalLiquide : 0;
  } catch {
    return null;
  }
}

export function identifiantCaisse(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    + `_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

// Construit l'objet "comptage de caisse" (sans l'enregistrer).
export function creerCaisse({ lignes, attendu, jour, date = new Date() }) {
  const total = totalLignes(lignes);
  const c = {
    id: identifiantCaisse(date),
    type: 'cloture_caisse',
    horodatage: date.toISOString(),
    dateAffichee: date.toLocaleDateString('fr-BE'),
    heureAffichee: date.toLocaleTimeString('fr-BE'),
    dateComptable: jour || dateComptable(),
    appareil: Stockage.obtenirOuGenererIdentifiantCaisse(),
    lignes: lignes.map(l => ({ montant: l.montant, libelle: l.libelle })),
    total,
    liquideAttendu: attendu === undefined ? null : attendu,
    ecart: typeof attendu === 'number' ? arrondi(total - attendu) : null
  };
  c.texte = formaterCaisseTexte(c);
  return c;
}

export function formaterLigneCaisse(l) {
  const montant = l.montant === null ? '' : nombreFr(l.montant);
  return montant.padStart(10) + '  ' + String(l.libelle || '').slice(0, LARGEUR_TICKET - 12);
}

export function formaterCaisseTexte(c) {
  const sep = '='.repeat(LARGEUR_TICKET);
  const sep2 = '-'.repeat(LARGEUR_TICKET);
  const L = [sep];
  L.push(centrer('CLÔTURE DE CAISSE', LARGEUR_TICKET));
  L.push(centrer(SOCIETE.nom, LARGEUR_TICKET));
  L.push(centrer('Document interne - sans valeur fiscale', LARGEUR_TICKET));
  L.push(sep);
  L.push(`Journée du ${c.dateComptable}`);
  L.push(`Établi le ${c.dateAffichee} à ${c.heureAffichee}`);
  L.push(`Appareil : ${c.appareil}`);
  L.push(sep2);
  if (c.lignes.length) c.lignes.forEach(l => L.push(formaterLigneCaisse(l)));
  else L.push('(aucune ligne)');
  L.push(sep2);
  L.push('TOTAL COMPTÉ'.padEnd(22) + nombreFr(c.total).padStart(9) + ' €');
  if (typeof c.liquideAttendu === 'number') {
    L.push('LIQUIDE ATTENDU (ventes)'.padEnd(22) + nombreFr(c.liquideAttendu).padStart(9) + ' €');
    L.push('ÉCART'.padEnd(22) + ((c.ecart > 0 ? '+' : '') + nombreFr(c.ecart)).padStart(9) + ' €');
  }
  L.push(sep);
  return L.join('\n');
}

// ===== Enregistrement et consultation =====
export function enregistrerCaisse(c) {
  const caisses = Stockage.chargerCaisses();
  caisses[c.id] = c;
  Stockage.sauvegarderCaisses(caisses);
  fileAttendreSynchro({ type: 'caisse', id: c.id, caisse: c });
  return c;
}

export function listerCaisses() {
  return Stockage.chargerCaisses();
}

export function getCaisse(id) {
  return Stockage.chargerCaisses()[id] || null;
}

export function mettreEnCacheCaisse(id, caisse) {
  const caisses = Stockage.chargerCaisses();
  caisses[id] = caisse;
  Stockage.sauvegarderCaisses(caisses);
}

// Supprime UNIQUEMENT la copie locale de cet appareil (jamais le dépôt privé).
export function supprimerCaisse(id) {
  const caisses = Stockage.chargerCaisses();
  delete caisses[id];
  Stockage.sauvegarderCaisses(caisses);
}
