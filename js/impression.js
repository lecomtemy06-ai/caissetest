/**
 * impression.js — Point d'entrée UNIQUE de toute impression papier.
 *
 * Aujourd'hui : impression du navigateur (boîte de dialogue du
 * système), mise en page pour du papier thermique 80 mm. Le texte est
 * placé dans une zone dédiée, seule visible à l'impression (voir le
 * bloc @media print de style.css) ; la page de caisse n'est jamais
 * modifiée.
 *
 * Plus tard : quand l'imprimante thermique sera choisie, seul le corps
 * de imprimerTexte() change (envoi direct ESC/POS via RawBT, coupe
 * automatique, ticket cuisine...). Les appelants ne changent pas.
 */
export function imprimerTexte(texte) {
  let zone = document.getElementById('zone-impression');
  if (!zone) {
    zone = document.createElement('pre');
    zone.id = 'zone-impression';
    document.body.appendChild(zone);
  }
  zone.textContent = texte;
  const nettoyer = () => { zone.textContent = ''; window.removeEventListener('afterprint', nettoyer); };
  window.addEventListener('afterprint', nettoyer);
  window.print();
}

export function dateHeureCourante() {
  const n = new Date();
  return n.toLocaleDateString('fr-BE') + ' ' + n.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}
