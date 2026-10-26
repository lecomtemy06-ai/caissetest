/**
 * ventes.js — Sauvegarde des ventes (tickets) et lecture de l'historique.
 * Écrit toujours en local d'abord (la caisse fonctionne hors-ligne),
 * puis met la vente en file de synchronisation vers GitHub.
 *
 * ventesDuJourFusionnees() est le point d'entrée à utiliser pour toute
 * consultation (Historique, Clôture) : elle combine les ventes connues
 * localement avec celles enregistrées par les AUTRES appareils sur le
 * dépôt privé, pour que chaque machine voie l'activité de toute la
 * caisse, pas seulement la sienne.
 */
import { Stockage } from './stockage.js';
import { creerTicket } from './ticket.js';
import { fileAttendreSynchro, obtenirVentesDistantes, getConfigGithub } from './github-sync.js';
import { obtenirProchainNumero } from './numerotation.js';
import { tvaEffective } from './consommation.js';
import { dateComptable, dateLocale } from './date-comptable.js';

// Journée comptable (voir date-comptable.js) : une vente faite à 1 h du matin
// est comptabilisée sur la journée de la veille.
export { dateComptable };

// `modeConsommation` ("EMPORTER" / "SUR_PLACE") détermine le taux de TVA
// réellement appliqué : les lignes du panier portent le taux du
// catalogue (taux "à emporter"), converti ici une seule fois, au moment
// de figer le ticket. Le taux d'origine reste conservé dans `tvaBase`.
export async function enregistrerVente(panier, modePaiement, modeConsommation) {
  if (!panier.length) return null;
  const date = dateComptable();
  const numero = await obtenirProchainNumero();
  const appareil = Stockage.obtenirOuGenererIdentifiantCaisse();
  const lignes = panier.map(l => ({ ...l, tvaBase: l.tva, tva: tvaEffective(l.tva, modeConsommation) }));
  const ticket = creerTicket(numero, lignes, modePaiement, date, appareil, modeConsommation);

  // Écriture locale à coût constant ; si la mémoire de la tablette est
  // pleine, on fait de la place (tickets anciens déjà envoyés au dépôt
  // privé) puis on réessaie. Le ticket reste de toute façon dans la file
  // de synchronisation tant qu'il n'est pas parti sur le dépôt.
  let ecrit = Stockage.ajouterVente(ticket);
  if (!ecrit) { elaguerVentesAnciennes(7); ecrit = Stockage.ajouterVente(ticket); }
  if (!ecrit) { elaguerVentesAnciennes(1); ecrit = Stockage.ajouterVente(ticket); }
  if (!ecrit) window.dispatchEvent(new CustomEvent('stockage-plein'));

  fileAttendreSynchro({ type: 'vente', date, ticket });

  return ticket;
}

// Ventes connues localement sur CET appareil uniquement (rapide,
// fonctionne hors-ligne, mais peut être incomplet si d'autres
// appareils ont vendu aujourd'hui).
export function ventesDuJour(date = dateComptable()) {
  return Stockage.chargerVentes().filter(v => v.dateComptable === date);
}

export function toutesLesVentes() {
  return Stockage.chargerVentes();
}

export function datesConnuesLocalement() {
  return [...new Set(Stockage.chargerVentes().map(v => v.dateComptable))];
}

// Fusionne les ventes locales avec celles du dépôt privé pour une date
// donnée (dédoublonnage par numéro de ticket), et met en cache le
// résultat localement pour une consultation hors-ligne future. Revient
// silencieusement aux ventes locales seules si GitHub n'est pas
// configuré ou injoignable.
export async function ventesDuJourFusionnees(date = dateComptable()) {
  const locales = ventesDuJour(date);
  const distantes = await obtenirVentesDistantes(date);
  if (distantes === null) return locales; // non configuré / hors-ligne

  const parNumero = new Map();
  [...locales, ...distantes].forEach(t => parNumero.set(t.numero, t));
  const fusion = [...parNumero.values()].sort((a, b) => a.horodatage.localeCompare(b.horodatage));

  const autresJours = Stockage.chargerVentes().filter(v => v.dateComptable !== date);
  Stockage.sauvegarderVentes([...autresJours, ...fusion]);

  return fusion;
}

// Allège la mémoire de la tablette : supprime la copie LOCALE des tickets
// de plus de `jours` journées comptables, à condition qu'ils soient déjà
// partis sur le dépôt privé (jamais ceux encore en file d'attente) et que
// la synchronisation soit configurée. Le dépôt privé n'est pas touché ;
// Historique et exports vont chercher les anciennes journées sur le dépôt.
export function elaguerVentesAnciennes(jours = 31) {
  const config = getConfigGithub();
  if (!(config && config.token && config.owner && config.repo)) return 0;
  const [a, m, j] = dateComptable().split('-').map(Number);
  const limite = dateLocale(new Date(a, m - 1, j - jours));
  const enAttente = new Set(
    Stockage.chargerFileSync().filter(x => x.type === 'vente' && x.ticket).map(x => x.ticket.numero)
  );
  const ventes = Stockage.chargerVentes();
  const gardees = ventes.filter(t => t.dateComptable >= limite || enAttente.has(t.numero));
  if (gardees.length === ventes.length) return 0;
  Stockage.sauvegarderVentes(gardees);
  return ventes.length - gardees.length;
}
