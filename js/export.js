/**
 * export.js — Génération de fichiers exportables (CSV, JSON) et écriture
 * optionnelle dans un dossier local choisi par l'utilisateur (File System
 * Access API, disponible uniquement sur Chrome/Edge PC/Android).
 * Fonctionnalité indépendante de la synchronisation GitHub : c'est une
 * sauvegarde "bonus" en plus, pas un remplacement.
 */
import { Stockage } from './stockage.js';
import { toutesLesVentes, ventesDuJour, dateComptable } from './ventes.js';
import { getCatalogue } from './catalogue.js';
import { listerClotures, rassemblerClotures } from './cloture.js';
import { nombreFr } from './format.js';
import { libellesSupplements } from './ticket.js';

export function telechargerFichier(nom, contenu, mime = 'text/plain') {
  const blob = new Blob([contenu], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function csvEchappe(v) {
  const s = String(v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function construireCsvVentes(ventes) {
  const lignes = ['NumTicket;DateComptable;DateHeure;Appareil;Consommation;Article;Supplements;Quantite;PrixUnitaireTTC;TauxTVA;TotalLigneTTC;ModePaiement;TotalTicketTTC'];
  ventes.forEach(v => {
    v.lignes.forEach(l => {
      lignes.push([
        v.numero, v.dateComptable, v.dateAffichee + ' ' + v.heureAffichee, v.appareil || '', v.modeConsommation || '',
        csvEchappe(l.nom), csvEchappe(libellesSupplements(l.supplements).join(' + ')), l.quantite, nombreFr(l.prixUnitaire), l.tva,
        nombreFr(l.prixUnitaire * l.quantite), v.modePaiement, nombreFr(v.totalTTC)
      ].join(';'));
    });
  });
  return '\ufeff' + lignes.join('\r\n');
}

export function exporterVentesCSV(toutes) {
  const date = dateComptable();
  const ventes = toutes ? toutesLesVentes() : ventesDuJour(date);
  if (!ventes.length) return false;
  telechargerFichier(toutes ? `ventes_completes_${date}.csv` : `ventes_${date}.csv`, construireCsvVentes(ventes), 'text/csv');
  return true;
}

// ===== Export comptable des clôtures =====
// Une ligne par journée comptable. Séparateur ";" et virgule décimale
// (convention belge : s'ouvre correctement dans Excel), BOM UTF-8 pour
// les accents.
export function construireCsvClotures(clotures) {
  const taux = ['6', '12', '21'];
  const entete = ['Date', 'NbTickets', 'TicketMoyenTTC', 'TotalLiquideTTC', 'TotalBancontactTTC', 'TotalEmporterTTC', 'TotalSurPlaceTTC', 'TotalLivraisonTTC', 'ModeNonPreciseTTC'];
  taux.forEach(t => entete.push(`BaseHT_${t}%`, `TVA_${t}%`, `TTC_${t}%`));
  entete.push('TotalTVA', 'TotalJourneeTTC');
  const lignes = [entete.join(';')];
  clotures.forEach(c => {
    const l = [c.date, c.nbTickets, nombreFr(c.ticketMoyen), nombreFr(c.totalLiquide), nombreFr(c.totalBancontact),
      nombreFr(c.totalEmporter), nombreFr(c.totalSurPlace), nombreFr(c.totalLivraison), nombreFr(c.totalNonPrecise)];
    taux.forEach(t => {
      const v = (c.ventilationGlobale || {})[t] || { ht: 0, tva: 0, ttc: 0 };
      l.push(nombreFr(v.ht), nombreFr(v.tva), nombreFr(v.ttc));
    });
    l.push(nombreFr(c.totalTVAJour), nombreFr(c.totalJour));
    lignes.push(l.join(';'));
  });
  return '\ufeff' + lignes.join('\r\n');
}

export async function exporterCloturesCSV() {
  const r = await rassemblerClotures();
  if (r.clotures.length) {
    telechargerFichier(`clotures_completes_${dateComptable()}.csv`, construireCsvClotures(r.clotures), 'text/csv');
  }
  return { nombre: r.clotures.length, distantInjoignable: r.distantInjoignable };
}

export function exporterSauvegardeJSON() {
  const data = {
    exportLe: new Date().toISOString(),
    catalogue: getCatalogue(),
    ventes: toutesLesVentes(),
    clotures: listerClotures(),
    caisses: Stockage.chargerCaisses(),
    identifiantCaisse: Stockage.chargerIdentifiantCaisse(),
    compteurSecours: Stockage.chargerCompteurSecours()
  };
  telechargerFichier(`sauvegarde_caisse_${dateComptable()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function restaurerSauvegarde(data) {
  if (data.catalogue) Stockage.sauvegarderCatalogue(data.catalogue);
  if (data.ventes) Stockage.sauvegarderVentes(data.ventes);
  if (data.clotures) Stockage.sauvegarderClotures(data.clotures);
  if (data.caisses) Stockage.sauvegarderCaisses(data.caisses);
  if (data.identifiantCaisse) Stockage.definirIdentifiantCaisse(data.identifiantCaisse);
  if (data.compteurSecours) Stockage.sauvegarderCompteurSecours(data.compteurSecours);
}

// ===== Dossier local (File System Access API — PC/Android Chrome-Edge) =====
let dossierHandle = null;
const FS_DB_NAME = 'caisse_fs_db';
const FS_STORE = 'handles';

function ouvrirFsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FS_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sauvegarderHandleDossier(handle) {
  try {
    const db = await ouvrirFsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readwrite');
      tx.objectStore(FS_STORE).put(handle, 'dossierExport');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('Sauvegarde du dossier impossible', e); }
}

async function chargerHandleDossier() {
  try {
    const db = await ouvrirFsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readonly');
      const req = tx.objectStore(FS_STORE).get('dossierExport');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function supporteDossierLocal() {
  return 'showDirectoryPicker' in window;
}

export function getDossierActif() {
  return dossierHandle;
}

export async function choisirDossierExport() {
  if (!supporteDossierLocal()) return null;
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  dossierHandle = handle;
  await sauvegarderHandleDossier(handle);
  return handle;
}

export async function initDossierExport(surReconnexionRequise) {
  if (!supporteDossierLocal()) return;
  const handle = await chargerHandleDossier();
  if (!handle) return;
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    dossierHandle = handle;
  } else if (surReconnexionRequise) {
    surReconnexionRequise(handle);
  }
}

export async function reactiverDossier(handle) {
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm === 'granted') dossierHandle = handle;
  return perm === 'granted';
}

export async function ecrireFichierDossier(nomFichier, contenu) {
  if (!dossierHandle) return;
  try {
    const fh = await dossierHandle.getFileHandle(nomFichier, { create: true });
    const w = await fh.createWritable();
    await w.write(contenu);
    await w.close();
  } catch (e) {
    console.warn('Écriture locale automatique échouée pour ' + nomFichier, e);
  }
}
