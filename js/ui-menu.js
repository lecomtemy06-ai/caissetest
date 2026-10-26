/**
 * ui-menu.js — Navigation du menu de vente (catégories → articles →
 * viandes → options) et affichage du panier. Utilise l'API DOM
 * directement : cette partie ne nécessite pas de moteur de gabarits.
 *
 * Deux logiques de prix coexistent pour les plats :
 *  - format "additif" (ex. Mitraillette, Assiette) : prix = format + viande ;
 *  - format "à prix fixes" (ex. Durum, Kapsalon : champ `prixFixes`) : la
 *    liste des choix et leurs prix sont propres au format, et ne
 *    dépendent pas de la liste générale des viandes.
 * Dans les deux cas, la page des suppléments est toujours proposée
 * ensuite.
 *
 * Les articles marqués "promotion" affichent un petit badge 🏷️ et les
 * "favoris" une étoile ⭐ sur leur bouton — purement visuel (ils restent
 * à leur place dans l'ordre alphabétique, voir tri.js).
 *
 * Les articles `special: 'prix-libre'` (ex. "Salade Divers") ouvrent une
 * pop-up pour encoder leur prix à chaque vente.
 *
 * La catégorie "Divers" peut contenir un article spécial "Ristourne"
 * (repéré par `special: 'ristourne'`) : il ouvre une pop-up dédiée pour
 * saisir un montant et un taux de TVA, et ajoute une ligne négative.
 */
import { getCatalogue } from './catalogue.js';
import { ajouterArticle, supprimerArticle, getPanier, getTotal, onChangement } from './panier.js';
import { getMode, onModeChange, tvaEffective } from './consommation.js';
import { enregistrerAction, escapeHtml } from './ui-modal.js';
import { ouvrirRistournePopup } from './ui-ristourne.js';
import { ouvrirPrixLibrePopup } from './ui-prix-libre.js';
import { libellesSupplements } from './ticket.js';
import { trierEntrees } from './tri.js';

const elMenu = () => document.getElementById('zone-menu');
const elFooter = () => document.getElementById('zone-footer');

const arrondi = (x) => Math.round(x * 100) / 100;

export function initUiMenu() {
  enregistrerAction('supprimerLigne', (index) => supprimerArticle(index));
  onChangement(rafraichirPanier);
  // Le taux affiché dans le panier dépend du mode (sur place / à emporter)
  onModeChange(() => rafraichirPanier({ total: getTotal(), panier: getPanier() }));
  afficherCategories();
  rafraichirPanier({ total: getTotal(), panier: getPanier() });
}

function badge(obj) {
  return (obj.favori ? '⭐ ' : '') + (obj.promo ? '🏷️ ' : '');
}

function prixHtml(prix) {
  return `<span style="color:var(--accent);font-size:0.85em">${prix.toFixed(2)} €</span>`;
}

function reinitialiserEcran() {
  const menu = elMenu();
  const footer = elFooter();
  menu.innerHTML = '';
  footer.innerHTML = '';
  footer.style.display = '';
  footer.style.gridTemplateColumns = '';
  footer.style.gap = '';
  footer.style.padding = '';
  menu.style.gridTemplateColumns = 'repeat(3, 1fr)';
  return { menu, footer };
}

export function afficherCategories() {
  const { menu } = reinitialiserEcran();
  const catalogue = getCatalogue();

  Object.keys(catalogue.categories).forEach(nom => {
    const btn = document.createElement('button');
    btn.className = 'btn-menu';
    btn.textContent = nom;
    btn.addEventListener('click', () => afficherArticles(nom));
    menu.appendChild(btn);
  });
}

function afficherArticles(categorie) {
  const { menu, footer } = reinitialiserEcran();
  const catalogue = getCatalogue();

  if (categorie === 'Plats') {
    trierEntrees(Object.entries(catalogue.categories.Plats.types), 'Plats').forEach(([nom, obj]) => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.textContent = badge(obj) + nom;
      btn.addEventListener('click', () => afficherViandes(nom));
      menu.appendChild(btn);
    });
  } else {
    trierEntrees(Object.entries(catalogue.categories[categorie]), categorie).forEach(([nom, obj]) => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      if (obj.special === 'prix-libre') {
        btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br><span style="color:var(--accent);font-size:0.8em">Prix à saisir</span>`;
        btn.addEventListener('click', () => ouvrirPrixLibrePopup(nom, obj.tva));
      } else if (obj.special === 'ristourne') {
        btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br><span style="color:var(--accent);font-size:0.8em">Montant variable</span>`;
        btn.addEventListener('click', () => ouvrirRistournePopup());
      } else {
        btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br>${prixHtml(obj.prix)}`;
        btn.addEventListener('click', () => ajouterArticle(nom, obj.prix, obj.tva));
      }
      menu.appendChild(btn);
    });
  }

  ajouterBoutonRetour(footer, afficherCategories);
}

// Choix de la viande (ou de la variante) pour un format donné.
function afficherViandes(typePlat) {
  const { menu, footer } = reinitialiserEcran();
  const catalogue = getCatalogue();
  const type = catalogue.categories.Plats.types[typePlat];

  if (type.prixFixes) {
    // Format à prix fixes : choix et prix propres à ce format
    trierEntrees(Object.entries(type.prixFixes), 'Plats').forEach(([nom, obj]) => {
      const tva = obj.tva !== undefined ? obj.tva : type.tva;
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br>${prixHtml(obj.prix)}`;
      btn.addEventListener('click', () => afficherOptions(typePlat, nom, { prix: obj.prix, tva }));
      menu.appendChild(btn);
    });
  } else {
    // Format additif : prix du format + prix de la viande
    trierEntrees(Object.entries(catalogue.categories.Plats.viandes), 'Plats').forEach(([nom, obj]) => {
      const prix = arrondi(type.prix + obj.prix);
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}<br>${prixHtml(prix)}`;
      btn.addEventListener('click', () => afficherOptions(typePlat, nom, { prix, tva: obj.tva }));
      menu.appendChild(btn);
    });
  }

  ajouterBoutonRetour(footer, () => afficherArticles('Plats'));
}

// Page des suppléments, toujours proposée après le choix du plat.
// `base` = { prix, tva } du plat choisi (avant suppléments).
function afficherOptions(typePlat, choix, base) {
  const { menu, footer } = reinitialiserEcran();
  menu.style.gridTemplateColumns = 'repeat(2, 1fr)';
  const catalogue = getCatalogue();
  const selection = {};
  const ordreAffichage = []; // ordre (alphabétique) des suppléments affichés
  let totalVar = base.prix;

  const label = document.createElement('div');
  label.style.cssText = 'grid-column:1/-1;color:var(--accent);font-size:18px;font-weight:bold;text-align:center;padding:6px;';
  label.textContent = 'TOTAL : ' + totalVar.toFixed(2) + ' €';
  menu.appendChild(label);

  function recalc() {
    let extra = 0;
    Object.entries(selection).forEach(([n, nb]) => { if (nb) extra += catalogue.supplements[n].prix * nb; });
    totalVar = arrondi(base.prix + extra);
    label.textContent = 'TOTAL : ' + totalVar.toFixed(2) + ' €';
  }

  // Ordre : voir tri.js (Salade, Tomates, Oignon, puis alphabétique, puis
  // les suppléments cumulables comme "Suppléments Divers" en dernier).
  // Certains suppléments ne s'appliquent qu'à certains formats (champ
  // `formats`). `selection[nom]` = nombre de fois choisi : 0/1 pour un
  // supplément ordinaire, plusieurs clics possibles pour un `multiple`.
  trierEntrees(Object.entries(catalogue.supplements), 'SUPPLEMENTS')
    .filter(([, obj]) => !obj.formats || obj.formats.includes(typePlat))
    .forEach(([nom, obj]) => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      ordreAffichage.push(nom);
      selection[nom] = 0;

      const afficher = () => {
        const n = selection[nom];
        btn.innerHTML = `${badge(obj)}${escapeHtml(nom)}${obj.multiple && n ? ` <b>× ${n}</b>` : ''}<br>${prixHtml(obj.prix)}`;
        btn.style.outline = n ? '3px solid var(--accent)' : '';
      };
      afficher();

      if (obj.multiple) {
        // cumulable : chaque clic en ajoute un (comme une boisson) ; −1 en retire un
        const rangee = document.createElement('div');
        rangee.style.cssText = 'grid-column:1/-1;display:flex;gap:4px';
        btn.style.flex = '1';
        btn.addEventListener('click', () => { selection[nom]++; afficher(); recalc(); });
        const moins = document.createElement('button');
        moins.className = 'btn-menu orange';
        moins.textContent = '−1';
        moins.style.cssText = 'flex:0 0 64px';
        moins.addEventListener('click', () => { if (selection[nom] > 0) selection[nom]--; afficher(); recalc(); });
        rangee.append(btn, moins);
        menu.appendChild(rangee);
      } else {
        btn.addEventListener('click', () => { selection[nom] = selection[nom] ? 0 : 1; afficher(); recalc(); });
        menu.appendChild(btn);
      }
    });

  footer.style.display = 'grid';
  footer.style.gridTemplateColumns = '1fr 1fr';
  footer.style.gap = '4px';
  footer.style.padding = '4px';

  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-menu orange';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', () => afficherViandes(typePlat));
  footer.appendChild(btnRetour);

  const btnValider = document.createElement('button');
  btnValider.className = 'btn-menu vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    // dans l'ordre d'affichage ; un supplément cumulable est répété autant de fois que choisi
    const choisis = ordreAffichage.flatMap(n => Array(selection[n] || 0).fill(n));
    ajouterArticle(`${typePlat} ${choix}`, totalVar, base.tva, choisis);
    afficherCategories();
  });
  footer.appendChild(btnValider);
}

function ajouterBoutonRetour(footer, action) {
  const btn = document.createElement('button');
  btn.className = 'btn-menu orange';
  btn.textContent = '⬅ Retour';
  btn.addEventListener('click', action);
  footer.appendChild(btn);
}

function rafraichirPanier({ total, panier }) {
  const liste = document.getElementById('panier-liste');
  const totalEl = document.getElementById('panier-total');
  const ecranTotal = document.getElementById('ecran-total');
  const mode = getMode();
  liste.innerHTML = '';
  if (!panier.length) {
    liste.innerHTML = '<div id="panier-vide">Panier vide</div>';
  } else {
    panier.forEach((item, i) => {
      const ligne = document.createElement('div');
      ligne.className = 'panier-ligne';
      const libelle = (item.quantite > 1 ? item.quantite + ' x ' : '') + item.nom;
      const details = libellesSupplements(item.supplements)
        .map(s => `<div class="panier-sup">+ ${escapeHtml(s)}</div>`).join('');
      ligne.innerHTML = `
        <span class="panier-nom">${escapeHtml(libelle)}${details}</span>
        <span class="panier-tva">${tvaEffective(item.tva, mode)}%</span>
        <span class="panier-prix">${(item.prixUnitaire * item.quantite).toFixed(2)} €</span>
        <button class="panier-suppr" data-action="supprimerLigne" data-args="[${i}]">✕</button>`;
      liste.appendChild(ligne);
    });
  }
  totalEl.textContent = 'TOTAL : ' + total.toFixed(2) + ' €';
  ecranTotal.textContent = total.toFixed(2) + ' €';
  const sc = document.getElementById('panier-scroll');
  sc.scrollTop = sc.scrollHeight;
}
