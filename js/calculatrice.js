/**
 * calculatrice.js — Logique pure de la calculette du panier ("Montant libre").
 *
 * Trois actions distinctes :
 *  - calculer()  ("=")  : conclut le calcul affiché et garde le résultat à
 *                         l'écran (on peut continuer à calculer dessus) ;
 *  - ajouter()   ("OK") : ajoute le montant au panier ("Montant libre", TVA
 *                         6 % par défaut) et vide l'écran ;
 *  - corriger() ("⌫")   : retire le dernier caractère saisi ;
 *  - effacer()  ("C")   : vide la saisie, sans toucher au panier.
 */
import { ajouterArticle } from './panier.js';

const TVA_MONTANT_LIBRE = 6;
const OPERATEURS = '+-*/';

export function creerCalculatrice() {
  let expression = '';
  let apresEgal = false; // le contenu est un résultat : un chiffre repart de zéro

  function saisir(val) {
    if (apresEgal && !OPERATEURS.includes(val)) { expression = ''; }
    apresEgal = false;
    if (OPERATEURS.includes(val)) {
      if (!expression || OPERATEURS.includes(expression.slice(-1))) return expression;
    }
    if (val === '.') {
      if (!expression || OPERATEURS.includes(expression.slice(-1))) return expression;
      const dernier = expression.split(/[+\-*/]/).pop();
      if (dernier.includes('.')) return expression;
    }
    if (!isNaN(val)) {
      const dernier = expression.split(/[+\-*/]/).pop();
      if (dernier.includes('.') && dernier.split('.')[1].length >= 2) return expression;
    }
    expression += val;
    return expression;
  }

  function corriger() {
    expression = expression.slice(0, -1);
    apresEgal = false;
    return expression;
  }

  function effacer() {
    expression = '';
    apresEgal = false;
    return expression;
  }

  // Évalue l'expression courante. Renvoie le résultat arrondi au centime,
  // ou null si l'expression est incomplète / invalide / négative.
  function evaluer() {
    if (!expression || OPERATEURS.includes(expression.slice(-1))) return null;
    if (!/^[0-9+\-*/.]+$/.test(expression)) return null;
    try {
      const resultat = Function('"use strict"; return (' + expression + ')')();
      if (!isFinite(resultat) || resultat < 0) return null;
      return Math.round(resultat * 100) / 100;
    } catch {
      return null;
    }
  }

  function calculer() {
    const r = evaluer();
    if (r === null) return { erreur: true, expression };
    expression = String(r);
    apresEgal = true;
    return { erreur: false, expression };
  }

  function ajouter() {
    const r = evaluer();
    if (r === null || r <= 0) return { erreur: true, expression };
    ajouterArticle('Montant libre', r, TVA_MONTANT_LIBRE);
    expression = '';
    apresEgal = false;
    return { erreur: false, valeur: r, expression };
  }

  return { saisir, corriger, effacer, calculer, ajouter, getExpression: () => expression };
}
