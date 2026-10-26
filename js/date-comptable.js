/**
 * date-comptable.js — Journée comptable : une journée commerciale se
 * termine à 6 h du matin. Une vente faite le 23/10 à 01 h appartient à la
 * journée du 22/10 ; une vente du 22/10 à 05 h 59 aussi ; à 06 h 00, la
 * journée du 22/10 est terminée et celle du 23/10 commence.
 *
 * ⚠️ Tout se calcule avec les composantes LOCALES de la date (année, mois,
 * jour du fuseau de l'appareil). Ne jamais passer par toISOString() : elle
 * convertit en UTC et décale la date d'un jour entre minuit et 1 h / 2 h
 * (heure d'hiver / d'été en Belgique). Module sans dépendance.
 */
const HEURE_FIN_JOURNEE = 6;

const pad2 = (n) => String(n).padStart(2, '0');

// "AAAA-MM-JJ" d'une date, dans le fuseau local de l'appareil.
export function dateLocale(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dateComptable(maintenant = new Date()) {
  const d = new Date(maintenant.getTime());
  if (d.getHours() < HEURE_FIN_JOURNEE) d.setDate(d.getDate() - 1);
  return dateLocale(d);
}
