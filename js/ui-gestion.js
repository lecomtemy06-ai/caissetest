/**
 * ui-gestion.js — Écran protégé par mot de passe : gestion des prix, des
 * taux de TVA, ajout/suppression/renommage d'articles, et accès à la
 * liste des clôtures et aux paramètres de synchronisation GitHub.
 */
import { demanderCode } from './garde-code.js';
import {
  getCatalogue, modifierPrix, cyclerTva, basculerPromo, basculerFavori, renommerArticle,
  supprimerArticle, ajouterArticleCatalogue
} from './catalogue.js';
import { modal, fermerModal, escapeHtml, enregistrerAction, attrArgs } from './ui-modal.js';
import { creerPaveNumerique, creerClavierAzerty } from './clavier.js';
import { PREFIXE_PRIX_FIXES } from './catalogue-patch.js';
import { trierEntrees } from './tri.js';
import { ouvrirParametres } from './ui-parametres.js';

export function initUiGestion() {
  document.getElementById('logo-btn').addEventListener('click', () => demanderCode('Accès Gestion des Prix', ouvrirGestionPrix));
  enregistrerAction('ouvrirGestionPrix', ouvrirGestionPrix);
  enregistrerAction('ouvrirGestionArticles', ouvrirGestionArticles);
  enregistrerAction('choisirSectionGestion', choisirSection);
  enregistrerAction('popupAjoutArticle', popupAjoutArticle);
  enregistrerAction('ouvrirModifPrix', ouvrirModifPrix);
  enregistrerAction('cyclerTvaUi', cyclerTvaUi);
  enregistrerAction('basculerPromoUi', basculerPromoUi);
  enregistrerAction('basculerFavoriUi', basculerFavoriUi);
  enregistrerAction('ouvrirRenommer', ouvrirRenommer);
  enregistrerAction('demanderSuppressionArticle', demanderSuppressionArticle);
  enregistrerAction('confirmerSuppressionArticle', confirmerSuppressionArticle);
  enregistrerAction('ouvrirParametres', () => ouvrirParametres(ouvrirGestionPrix));
}

// Écran 1 : menu de la gestion (derrière le code du logo).
export function ouvrirGestionPrix() {
  modal(`<h2>Gestion</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <button class="btn-modal bleu" data-action="ouvrirGestionArticles">🗂 Gestion Article</button>
      <button class="btn-modal vert" data-action="popupAjoutArticle">➕ Ajouter article</button>
      <button class="btn-modal gris" data-action="ouvrirListeClotures">📜 Clôtures</button>
      <button class="btn-modal gris" data-action="ouvrirListeCaisses">🧮 Clôtures de caisse</button>
      <button class="btn-modal gris" data-action="ouvrirExport">💾 Export &amp; sauvegarde</button>
      <button class="btn-modal gris" data-action="ouvrirParametres">⚙️ Paramètres</button>
      <button class="btn-modal orange" style="grid-column:1/-1" data-action="ouvrirPurge">🧹 Purger le cache</button>
    </div>
    <button class="btn-modal rouge full" data-action="fermerModal">✕ Fermer</button>`);
}

// Écran 2 : "Gestion Article". Une seule rubrique est affichée à la fois
// (choisie en haut), pour que la liste reste lisible.
let sectionCourante = null;

function sectionsGestion(catalogue) {
  const sections = [];
  for (const cat of Object.keys(catalogue.categories)) {
    if (cat === 'Plats') {
      sections.push({ cle: 'Plats-types', libelle: 'Plats' });
      sections.push({ cle: 'Plats-viandes', libelle: 'Viandes' });
    } else {
      sections.push({ cle: cat, libelle: cat });
    }
  }
  sections.push({ cle: 'SUPPLEMENTS', libelle: 'Suppléments' });
  return sections;
}

export function ouvrirGestionArticles() {
  modal(construireEcranArticles());
}

function choisirSection(cle) {
  sectionCourante = cle;
  ouvrirGestionArticles();
}

function construireEcranArticles() {
  const catalogue = getCatalogue();
  const sections = sectionsGestion(catalogue);
  if (!sections.some(x => x.cle === sectionCourante)) sectionCourante = sections[0].cle;

  let h = `<h2>Gestion Article</h2>
    <div class="gestion-onglets">
      ${sections.map(x => `<button class="onglet${x.cle === sectionCourante ? ' actif' : ''}" data-action="choisirSectionGestion" data-args="${attrArgs([x.cle])}">${escapeHtml(x.libelle)}</button>`).join('')}
    </div>
    <p class="confirm-txt" style="font-size:11.5px;margin:4px 0 8px">Touchez le prix pour le modifier, ou le taux de TVA pour le faire changer (6% → 12% → 21%).</p>
    <div class="gestion-scroll">`;

  const cle = sectionCourante;
  if (cle === 'Plats-types') {
    for (const [nom, obj] of trierEntrees(Object.entries(catalogue.categories.Plats.types), 'Plats')) {
      h += ligneArticle('Plats-types', nom, obj);
      if (obj.prixFixes) {
        for (const [nomC, objC] of trierEntrees(Object.entries(obj.prixFixes), 'Plats')) {
          h += ligneArticle(PREFIXE_PRIX_FIXES + nom, nomC, objC, true);
        }
      }
    }
  } else if (cle === 'Plats-viandes') {
    for (const [nom, obj] of trierEntrees(Object.entries(catalogue.categories.Plats.viandes), 'Plats')) h += ligneArticle('Plats-viandes', nom, obj);
  } else if (cle === 'SUPPLEMENTS') {
    for (const [nom, obj] of trierEntrees(Object.entries(catalogue.supplements), 'SUPPLEMENTS')) h += ligneArticle('SUPPLEMENTS', nom, obj);
  } else if (catalogue.categories[cle]) {
    for (const [nom, obj] of trierEntrees(Object.entries(catalogue.categories[cle]), cle)) h += ligneArticle(cle, nom, obj);
  }

  h += `</div><div class="modal-actions" style="margin-top:10px">
      <button class="btn-modal rouge" data-action="ouvrirGestionPrix">⬅ Retour</button>
      <button class="btn-modal vert" data-action="popupAjoutArticle">➕ Ajouter article</button>
    </div>`;
  return h;
}

function ligneArticle(cat, nom, obj, sousLigne = false) {
  if (obj.prixFixes) {
    // Format à prix fixes : son prix et son taux sont portés par chaque
    // choix (lignes en dessous), pas par le format lui-même.
    return `<div class="article-ligne">
      <span class="article-nom">${obj.favori ? '⭐ ' : ''}${obj.promo ? '🏷️ ' : ''}${escapeHtml(nom)}</span>
      <span style="color:#888;font-size:11px;flex:1">Prix fixes par choix (ci-dessous)</span>
      <button class="btn-tva" style="${obj.promo ? 'background:#F57F17;color:white;border-color:#F57F17' : ''}" data-action="basculerPromoUi" data-args="${attrArgs([cat, nom])}" title="Marquer/démarquer comme promotion">🏷️</button>
      <button class="btn-tva" style="${obj.favori ? 'background:#F9A825;color:#000;border-color:#F9A825' : ''}" data-action="basculerFavoriUi" data-args="${attrArgs([cat, nom])}" title="Marquer/démarquer comme favori">⭐</button>
      <button class="btn-edit" data-action="ouvrirRenommer" data-args="${attrArgs([cat, nom])}">✏️</button>
      <button class="btn-del" data-action="demanderSuppressionArticle" data-args="${attrArgs([cat, nom])}">🗑</button>
    </div>`;
  }
  if (obj.special) {
    // Articles spéciaux : le montant est saisi à chaque vente (Ristourne,
    // Salade Divers...). Le taux de TVA par défaut reste modifiable.
    const tvaBtn = obj.special === 'prix-libre'
      ? `<button class="btn-tva" data-action="cyclerTvaUi" data-args="${attrArgs([cat, nom])}" title="Toucher pour changer le taux">${obj.tva}%</button>` : '';
    return `<div class="article-ligne">
      <span class="article-nom">${obj.favori ? '⭐ ' : ''}${obj.promo ? '🏷️ ' : ''}${escapeHtml(nom)}</span>
      <span style="color:#888;font-size:11px;flex:1">Article spécial — montant saisi à chaque vente</span>
      ${tvaBtn}
      <button class="btn-edit" data-action="ouvrirRenommer" data-args="${attrArgs([cat, nom])}">✏️</button>
      <button class="btn-del" data-action="demanderSuppressionArticle" data-args="${attrArgs([cat, nom])}">🗑</button>
    </div>`;
  }
  return `<div class="article-ligne" ${sousLigne ? 'style="padding-left:22px"' : ''}>
    <span class="article-nom">${sousLigne ? '↳ ' : ''}${obj.favori ? '⭐ ' : ''}${obj.promo ? '🏷️ ' : ''}${escapeHtml(nom)}</span>
    <button class="btn-prix" data-action="ouvrirModifPrix" data-args="${attrArgs([cat, nom])}">${obj.prix.toFixed(2)} €</button>
    <button class="btn-tva" data-action="cyclerTvaUi" data-args="${attrArgs([cat, nom])}" title="Toucher pour changer le taux">${obj.tva}%</button>
    <button class="btn-tva" style="${obj.promo ? 'background:#F57F17;color:white;border-color:#F57F17' : ''}" data-action="basculerPromoUi" data-args="${attrArgs([cat, nom])}" title="Marquer/démarquer comme promotion">🏷️</button>
      <button class="btn-tva" style="${obj.favori ? 'background:#F9A825;color:#000;border-color:#F9A825' : ''}" data-action="basculerFavoriUi" data-args="${attrArgs([cat, nom])}" title="Marquer/démarquer comme favori">⭐</button>
    <button class="btn-edit" data-action="ouvrirRenommer" data-args="${attrArgs([cat, nom])}">✏️</button>
    <button class="btn-del" data-action="demanderSuppressionArticle" data-args="${attrArgs([cat, nom])}">🗑</button>
  </div>`;
}

function cyclerTvaUi(cat, nom) {
  cyclerTva(cat, nom);
  ouvrirGestionArticles();
}

function basculerPromoUi(cat, nom) {
  basculerPromo(cat, nom);
  ouvrirGestionArticles();
}

function basculerFavoriUi(cat, nom) {
  basculerFavori(cat, nom);
  ouvrirGestionArticles();
}

function ouvrirModifPrix(cat, nom) {
  let saisie = '';
  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = 'Modifier prix';
  const sousTitre = document.createElement('div');
  sousTitre.style.cssText = 'color:#ccc;text-align:center;margin-bottom:5px';
  sousTitre.textContent = nom;
  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';

  const pave = creerPaveNumerique((touche) => {
    saisie = touche === 'C' ? '' : saisie + touche;
    ecran.textContent = saisie;
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-modal rouge';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', ouvrirGestionArticles);
  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    const p = parseFloat(saisie);
    if (isNaN(p)) return;
    modifierPrix(cat, nom, p);
    ouvrirGestionArticles();
  });
  actions.append(btnRetour, btnValider);

  conteneur.append(titre, sousTitre, ecran, pave, actions);
  modal(conteneur);
}

function ouvrirRenommer(cat, nomActuel) {
  let saisie = nomActuel;
  const conteneur = document.createElement('div');
  const titre = document.createElement('h2');
  titre.textContent = 'Renommer';
  const sousTitre = document.createElement('div');
  sousTitre.style.cssText = 'color:#ccc;text-align:center;margin-bottom:8px';
  sousTitre.textContent = 'Actuel : ' + nomActuel;
  const ecran = document.createElement('div');
  ecran.className = 'modal-ecran';
  ecran.style.cssText = 'font-size:18px;text-align:left';
  ecran.textContent = saisie;

  const clavier = creerClavierAzerty((touche) => {
    if (touche === 'BACK') saisie = saisie.slice(0, -1);
    else if (touche === 'SPC') saisie += ' ';
    else saisie += touche;
    ecran.textContent = saisie;
  }, { majusculeInitiale: false });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btnRetour = document.createElement('button');
  btnRetour.className = 'btn-modal rouge';
  btnRetour.textContent = '⬅ Retour';
  btnRetour.addEventListener('click', ouvrirGestionArticles);
  const btnValider = document.createElement('button');
  btnValider.className = 'btn-modal vert';
  btnValider.textContent = '✅ Valider';
  btnValider.addEventListener('click', () => {
    const nouveau = saisie.trim();
    if (nouveau) renommerArticle(cat, nomActuel, nouveau);
    ouvrirGestionArticles();
  });
  actions.append(btnRetour, btnValider);

  conteneur.append(titre, sousTitre, ecran, clavier, actions);
  modal(conteneur);
}

function demanderSuppressionArticle(cat, nom) {
  modal(`<h2>Confirmation</h2>
    <p class="confirm-txt">Supprimer "${escapeHtml(nom)}" ?</p>
    <div class="modal-actions">
      <button class="btn-modal rouge" data-action="ouvrirGestionArticles">NON</button>
      <button class="btn-modal vert" data-action="confirmerSuppressionArticle" data-args="${attrArgs([cat, nom])}">OUI</button>
    </div>`);
}

function confirmerSuppressionArticle(cat, nom) {
  supprimerArticle(cat, nom);
  ouvrirGestionArticles();
}

function popupAjoutArticle() {
  const catalogue = getCatalogue();
  // Catégories "à plat" (Frites, Desserts, Boissons, Divers...) + les
  // trois rubriques internes de "Plats", exposées séparément car elles
  // ne se gèrent pas de la même façon au moment de la vente : "Plats"
  // correspond aux formats (Spécial, Durum...), "Viandes" aux garnitures
  // principales, "Suppléments" aux ajouts optionnels. Un "plat" complet
  // tel que vu en caisse est toujours la combinaison, au moment de la
  // vente, d'un format + d'une viande (+ suppléments) — il n'y a donc
  // rien d'autre à ajouter "en plus" pour rendre un plat disponible :
  // ajouter un format ou une viande suffit à le proposer partout.
  const formatsAPrixFixes = Object.entries(catalogue.categories.Plats.types)
    .filter(([, t]) => t.prixFixes).map(([nom]) => nom);
  const optionsCategories = [
    ...Object.keys(catalogue.categories).filter(c => c !== 'Plats').map(c => ({ valeur: c, libelle: c })),
    { valeur: 'Plats-types', libelle: 'Plats — format (prix = format + viande)' },
    { valeur: 'Plats-types-fixes', libelle: 'Plats — nouveau format À PRIX FIXES' },
    ...formatsAPrixFixes.map(nom => ({ valeur: PREFIXE_PRIX_FIXES + nom, libelle: `Plats — ${nom} : ajouter un choix à prix fixe` })),
    { valeur: 'Plats-viandes', libelle: 'Viandes' },
    { valeur: 'SUPPLEMENTS', libelle: 'Suppléments' }
  ];
  let nomSaisi = '';
  let prixSaisi = '';

  const conteneur = document.createElement('div');
  conteneur.innerHTML = `<h2>Ajouter un article</h2>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Catégorie</label>
      <select id="sel-cat" style="width:100%;padding:8px;background:#333;color:white;border:none;border-radius:6px;font-size:16px;margin-top:4px">
        ${optionsCategories.map(o => `<option value="${escapeHtml(o.valeur)}">${escapeHtml(o.libelle)}</option>`).join('')}
      </select>
    </div>
    <div style="margin-bottom:6px">
      <label style="color:#aaa;font-size:13px">Nom de l'article</label>
      <div class="modal-ecran" id="ecran-ajout-nom" style="font-size:16px;text-align:left;margin-top:4px"></div>
    </div>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Prix</label>
      <div class="modal-ecran" id="ecran-ajout-prix" style="margin-top:4px"></div>
    </div>
    <div style="margin-bottom:8px">
      <label style="color:#aaa;font-size:13px">Taux de TVA</label>
      <select id="sel-tva" style="width:100%;padding:8px;background:#333;color:white;border:none;border-radius:6px;font-size:16px;margin-top:4px">
        <option value="6">6%</option><option value="12">12%</option><option value="21">21%</option>
      </select>
    </div>
    <label style="display:flex;align-items:center;gap:8px;color:white;font-size:14px;margin-bottom:10px;cursor:pointer">
      <input type="checkbox" id="chk-ajout-promo" style="width:20px;height:20px">
      🏷️ Cet article est en promotion
    </label>
    <label style="display:flex;align-items:center;gap:8px;color:white;font-size:14px;margin-bottom:10px;cursor:pointer">
      <input type="checkbox" id="chk-ajout-favori" style="width:20px;height:20px">
      ⭐ Cet article est un favori
    </label>
    <div id="zone-saisie" style="display:flex;gap:8px"></div>
    <div class="modal-actions" style="margin-top:10px">
      <button class="btn-modal rouge" id="btn-retour-ajout">⬅ Retour</button>
      <button class="btn-modal vert" id="btn-valider-ajout">✅ Valider</button>
    </div>`;

  const ecranNom = conteneur.querySelector('#ecran-ajout-nom');
  const ecranPrix = conteneur.querySelector('#ecran-ajout-prix');
  const zoneSaisie = conteneur.querySelector('#zone-saisie');

  const zonePave = document.createElement('div');
  zonePave.style.flex = '1';
  zonePave.appendChild(creerPaveNumerique((touche) => {
    prixSaisi = touche === 'C' ? '' : prixSaisi + touche;
    ecranPrix.textContent = prixSaisi;
  }));

  const zoneClavier = document.createElement('div');
  zoneClavier.style.flex = '2';
  zoneClavier.appendChild(creerClavierAzerty((touche) => {
    if (touche === 'BACK') nomSaisi = nomSaisi.slice(0, -1);
    else if (touche === 'SPC') nomSaisi += ' ';
    else nomSaisi += touche;
    ecranNom.textContent = nomSaisi;
  }));

  zoneSaisie.append(zonePave, zoneClavier);

  conteneur.querySelector('#btn-retour-ajout').addEventListener('click', ouvrirGestionArticles);
  conteneur.querySelector('#btn-valider-ajout').addEventListener('click', () => {
    const cat = conteneur.querySelector('#sel-cat').value;
    const tva = parseInt(conteneur.querySelector('#sel-tva').value, 10);
    const nom = nomSaisi.trim();
    const prix = parseFloat(prixSaisi);
    const promo = conteneur.querySelector('#chk-ajout-promo').checked;
    const favori = conteneur.querySelector('#chk-ajout-favori').checked;
    const sansPrix = cat === 'Plats-types-fixes'; // le prix est porté par chaque choix
    if (!cat || !nom || (!sansPrix && isNaN(prix))) return;
    ajouterArticleCatalogue(cat, nom, sansPrix ? 0 : prix, tva, promo, favori);
    ouvrirGestionArticles();
  });

  modal(conteneur);
  document.querySelector('#modal-overlay .modal').classList.add('large'); // place pour le clavier complet
}
