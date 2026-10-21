/**
 * tri.js — Ordre d'affichage des articles (menu de vente et Gestion des
 * prix). Le tri se fait À L'AFFICHAGE : l'ordre dans catalogue.json n'a
 * aucune importance, et un article ajouté trouve sa place tout seul.
 *
 * Règles : ordre alphabétique français (sans tenir compte des accents ni
 * des majuscules), chiffres triés comme des nombres ("Soft 1,5l" avant
 * "Soft 33cl"). Exceptions : la catégorie "Frites" garde son ordre
 * logique (Petite puis Grande), et l'article spécial "Ristourne" est
 * toujours en dernier.
 */
const collateur = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export function trierEntrees(entrees, categorie) {
  if (categorie === 'Frites') return entrees;
  const rang = (obj) => (obj && obj.special === 'ristourne' ? 1 : 0);
  return [...entrees].sort(([nomA, a], [nomB, b]) =>
    rang(a) - rang(b) || collateur.compare(nomA, nomB));
}
