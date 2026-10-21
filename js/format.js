/**
 * format.js — Formats de nombres partagés (convention belge : virgule
 * décimale), utilisés par les exports CSV et les tickets "caisse".
 */
export const nombreFr = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');
