/**
 * ui-caisse.js — Écrans de la "Clôture de caisse" : saisie du comptage
 * (clavier AZERTY + pavé de calcul), et historique des comptages (menu
 * derrière le logo). La logique est dans caisse.js.
 */
import { modal, fermerModal, escapeHtml, enregistrerAction, attrArgs } from './ui-modal.js';
import { creerClavierAzerty, creerPaveCalcul } from './clavier.js';
import {
  analyserLigne, totalLignes, liquideAttendu, creerCaisse, formaterLigneCaisse, enregistrerCaisse,
  listerCaisses, getCaisse, mettreEnCacheCaisse, supprimerCaisse
} from './caisse.js';
import { dateComptable } from './ventes.js';
import { nombreFr } from './format.js';
import { telechargerFichier, ecrireFichierDossier } from './export.js';
import { listerFichiersDistants, obtenirCaisseDistante } from './github-sync.js';

export function initUiCaisse() {
  enregistrerAction('ouvrirCaisse', ouvrirCaisse);
  enregistrerAction('ouvrirListeCaisses', ouvrirListeCaisses);
  enregistrerAction('voirCaisse', voirCaisse);
  enregistrerAction('exporterCaisse', exporterCaisse);
  enregistrerAction('supprimerCaisse', demanderSuppressionCaisse);
  enregistrerAction('confirmerSuppCaisse', confirmerSuppressionCaisse);
}

// ===== Saisie =====
export function ouvrirCaisse() {
  const jour = dateComptable();
  const lignes = [];
  let saisie = '';
  let attendu; // undefined = en cours de calcul, null = indisponible, nombre = ok
  let retourArme = false;

  const conteneur = document.createElement('div');
  conteneur.innerHTML = `<h2>Clôture de caisse</h2>
    <div class="modal-ecran caisse-saisie" id="caisse-saisie"></div>
    <div class="error-txt" id="caisse-erreur"></div>
    <div class="cloture-texte caisse-lignes" id="caisse-lignes"></div>
    <div class="caisse-totaux" id="caisse-totaux"></div>
    <div class="caisse-clavier" id="caisse-clavier"></div>
    <div class="caisse-actions">
      <button class="btn-modal rouge" id="caisse-retour">⬅ Retour</button>
      <button class="btn-modal gris" id="caisse-exporter">💾 Exporter</button>
      <button class="btn-modal vert" id="caisse-valider">✅ Valider</button>
    </div>`;

  const q = (id) => conteneur.querySelector('#' + id);
  const elSaisie = q('caisse-saisie');
  const elErreur = q('caisse-erreur');
  const elLignes = q('caisse-lignes');
  const elTotaux = q('caisse-totaux');
  const btnRetour = q('caisse-retour');

  function rafraichir() {
    elSaisie.textContent = saisie;
    elLignes.textContent = lignes.length
      ? lignes.map(formaterLigneCaisse).join('\n')
      : 'Écris une ligne (ex. 530 liquide) puis ENTRÉE.';
    elLignes.scrollTop = elLignes.scrollHeight;
    const total = totalLignes(lignes);
    let h = `<div><span>Total compté</span><strong>${nombreFr(total)} €</strong></div>`;
    if (attendu === undefined) {
      h += `<div><span>Liquide attendu</span><strong>…</strong></div>`;
    } else if (attendu === null) {
      h += `<div><span>Liquide attendu</span><strong>indisponible</strong></div>`;
    } else {
      const ecart = Math.round((total - attendu) * 100) / 100;
      h += `<div><span>Liquide attendu (ventes du ${escapeHtml(jour)})</span><strong>${nombreFr(attendu)} €</strong></div>`
        + `<div class="${ecart === 0 ? 'ecart-ok' : 'ecart-ko'}"><span>Écart</span><strong>${ecart > 0 ? '+' : ''}${nombreFr(ecart)} €</strong></div>`;
    }
    elTotaux.innerHTML = h;
    btnRetour.textContent = retourArme ? 'Abandonner ?' : '⬅ Retour';
  }

  function ajouterLigne() {
    const r = analyserLigne(saisie);
    if (!r.ok) { elErreur.textContent = r.erreur; return; }
    lignes.push(r.ligne);
    saisie = '';
    elErreur.textContent = '';
    retourArme = false;
    rafraichir();
  }

  function surTouche(t) {
    elErreur.textContent = '';
    retourArme = false;
    if (t === 'ENTER') return ajouterLigne();
    if (t === 'BACK') saisie = saisie.slice(0, -1);
    else if (t === 'SPC') saisie += ' ';
    else saisie += t;
    rafraichir();
  }

  const zone = q('caisse-clavier');
  const colClavier = document.createElement('div');
  colClavier.className = 'caisse-col-clavier';
  colClavier.appendChild(creerClavierAzerty(surTouche, { entree: true }));
  const colPave = document.createElement('div');
  colPave.className = 'caisse-col-pave';
  colPave.appendChild(creerPaveCalcul(surTouche));
  const btnC = document.createElement('button');
  btnC.className = 'btn-modal rouge';
  btnC.textContent = 'C  Effacer la saisie';
  btnC.addEventListener('click', () => { saisie = ''; elErreur.textContent = ''; rafraichir(); });
  const btnSuppr = document.createElement('button');
  btnSuppr.className = 'btn-modal orange';
  btnSuppr.textContent = '↩ Supprimer la dernière ligne';
  btnSuppr.addEventListener('click', () => { lignes.pop(); elErreur.textContent = ''; rafraichir(); });
  colPave.append(btnC, btnSuppr);
  zone.append(colClavier, colPave);

  btnRetour.addEventListener('click', () => {
    if (lignes.length && !retourArme) { retourArme = true; rafraichir(); return; }
    fermerModal();
  });

  q('caisse-exporter').addEventListener('click', () => {
    if (!lignes.length) { elErreur.textContent = 'Aucune ligne à exporter'; return; }
    const c = creerCaisse({ lignes, attendu, jour });
    telechargerFichier(`caisse_${c.id}.txt`, c.texte, 'text/plain');
  });

  q('caisse-valider').addEventListener('click', () => {
    if (!lignes.length) { elErreur.textContent = 'Ajoute au moins une ligne (ENTRÉE)'; return; }
    const c = enregistrerCaisse(creerCaisse({ lignes, attendu, jour }));
    ecrireFichierDossier(`caisse_${c.id}.txt`, c.texte);
    modal(`<h2>Comptage enregistré</h2>
      <div class="cloture-texte">${escapeHtml(c.texte)}</div>
      <div class="modal-actions">
        <button class="btn-modal gris" data-action="exporterCaisse" data-args="${attrArgs([c.id])}">💾 Exporter (.txt)</button>
        <button class="btn-modal vert" data-action="fermerModal">✅ Fermer</button>
      </div>`);
  });

  rafraichir();
  modal(conteneur);
  document.querySelector('#modal-overlay .modal').classList.add('large');

  liquideAttendu(jour).then(v => { attendu = v; rafraichir(); });
}

// ===== Historique (menu derrière le logo) =====
function exporterCaisse(id) {
  const c = getCaisse(id);
  if (c) telechargerFichier(`caisse_${id}.txt`, c.texte, 'text/plain');
}

export async function ouvrirListeCaisses() {
  modal('<h2>Clôtures de caisse</h2><p class="confirm-txt">Récupération des données...</p>');
  const local = listerCaisses();
  const distantes = await listerFichiersDistants('caisses');
  const ensemble = new Set(Object.keys(local));
  (distantes || []).forEach(d => ensemble.add(d));
  const ids = [...ensemble].sort().reverse();

  let h = `<h2>Clôtures de caisse</h2><div class="gestion-scroll">`;
  if (!ids.length) {
    h += '<p class="confirm-txt">Aucun comptage enregistré.</p>';
  } else {
    ids.forEach(id => {
      const total = local[id] ? `${nombreFr(local[id].total)} €` : '(à consulter)';
      h += `<div class="fichier-ligne">
        <button class="fichier-btn" data-action="voirCaisse" data-args="${attrArgs([id])}">caisse_${id} — ${total}</button>
        ${local[id] ? `<button class="btn-del" data-action="supprimerCaisse" data-args="${attrArgs([id])}">🗑</button>` : ''}
      </div>`;
    });
  }
  h += `</div><button class="btn-modal rouge full" style="margin-top:10px" data-action="ouvrirGestionPrix">⬅ Retour</button>`;
  modal(h);
}

async function voirCaisse(id) {
  let c = getCaisse(id);
  if (!c) {
    modal('<h2>Clôture de caisse</h2><p class="confirm-txt">Récupération des données...</p>');
    c = await obtenirCaisseDistante(id);
    if (c) mettreEnCacheCaisse(id, c);
  }
  modal(`<h2>Clôture de caisse</h2>
    <div class="cloture-texte">${escapeHtml(c ? c.texte : "Introuvable, ni localement ni sur le dépôt privé.")}</div>
    <div class="modal-actions">
      <button class="btn-modal gris" data-action="exporterCaisse" data-args="${attrArgs([id])}">💾 Exporter</button>
      <button class="btn-modal vert" data-action="ouvrirListeCaisses">⬅ Retour</button>
    </div>`);
}

function demanderSuppressionCaisse(id) {
  modal(`<h2>Confirmation</h2>
    <p class="confirm-txt">Supprimer ce comptage de CET appareil uniquement ?<br>
      Le fichier du dépôt privé GitHub n'est PAS touché : il restera consultable.</p>
    <div class="modal-actions">
      <button class="btn-modal rouge" data-action="ouvrirListeCaisses">NON</button>
      <button class="btn-modal vert" data-action="confirmerSuppCaisse" data-args="${attrArgs([id])}">OUI</button>
    </div>`);
}

function confirmerSuppressionCaisse(id) {
  supprimerCaisse(id);
  ouvrirListeCaisses();
}
