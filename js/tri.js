/**
 * tri.js — Ordre d'affichage des articles (menu de vente et Gestion des
 * articles). Le tri se fait À L'AFFICHAGE : l'ordre dans catalogue.json
 * n'a aucune importance, et un article ajouté trouve sa place tout seul.
 *
 * Règles, dans cet ordre :
 *  1. les articles portant un champ `ordre` (nombre) passent en premier,
 *     dans cet ordre (ex. suppléments Salade, Tomates, Oignon) ;
 *  2. puis tous les autres, par ordre alphabétique français (sans tenir
 *     compte des accents ni des majuscules ; les chiffres sont triés comme
 *     des nombres : "Soft 1,5l" avant "Soft 33cl") ;
 *  3. enfin les articles `multiple` (cumulables, ex. "Suppléments Divers"),
 *     puis les articles `special` (Ristourne, Salade Divers... à montant
 *     libre), toujours en dernier.
 * Exception : la catégorie "Frites" garde son ordre logique (Petite puis
 * Grande).
 */
const collateur = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

function rang(obj) {
  if (!obj) return 1;
  if (obj.special) return 3;
  if (obj.multiple) return 2;
  if (typeof obj.ordre === 'number') return 0;
  return 1;
}

export function trierEntrees(entrees, categorie) {
  if (categorie === 'Frites') return entrees;
  return [...entrees].sort(([nomA, a], [nomB, b]) => {
    const ra = rang(a), rb = rang(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return a.ordre - b.ordre;
    return collateur.compare(nomA, nomB);
  });
}
