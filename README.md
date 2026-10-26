# Caisse — Friterie de L'Ancienne Gare

Application de caisse enregistreuse conforme à la législation belge sur
les tickets de caisse (TVA ventilée par taux, numérotation continue,
identité de l'entreprise), avec synchronisation en temps réel vers un
dépôt GitHub privé.

## Architecture en un coup d'œil

Deux dépôts GitHub séparés, avec des rôles bien distincts :

| Dépôt | Contenu | Visibilité | Rôle |
|---|---|---|---|
| **Ce dépôt (public)** | Le code de l'application uniquement | Public (obligatoire pour GitHub Pages gratuit) | Hébergement du site |
| **Dépôt privé** (à créer à part) | `catalogue.json`, `ventes/tickets_AAAA-MM-JJ.json`, `clotures/cloture_AAAA-MM-JJ.json` | Privé, gratuit | Sauvegarde des données en temps réel |

**Aucune donnée de vente ne se trouve jamais dans ce dépôt.** Le code
ne contient que la logique de l'application ; les ventes réelles ne
sont écrites que dans le dépôt privé (via l'API GitHub, en tâche de
fond) et dans le navigateur de chaque appareil (localStorage, pour un
fonctionnement garanti même hors-ligne).

## Déployer ce dépôt sur GitHub Pages

1. Crée un dépôt **public** sur GitHub et mets-y tout le contenu de ce
   dossier (`index.html` doit rester à la racine du dépôt).
2. Dans **Settings → Pages**, source = "Deploy from a branch", branche
   `main`, dossier `/ (root)`.
3. Ton app est en ligne à `https://<ton-nom-utilisateur>.github.io/<nom-du-depot>/`.

## Configurer la synchronisation vers le dépôt privé

Le propriétaire et le nom du dépôt privé sont fixés une fois pour
toutes dans `js/config.js` (`DEPOT_PRIVE`) — à adapter si tu changes de
compte ou de nom de dépôt. **Seul le jeton d'accès reste propre à
chaque appareil** (configuré dans l'app, **Gestion des prix → ⚙️
Paramètres**) : c'est la seule information à ressaisir si tu vides un
jour le cache de ce navigateur — rien n'est perdu, seule la connexion
doit être rétablie. Voir `depot-prive-modele/README.md` pour la
création du dépôt et la génération d'un jeton.

## Structure du code

```
index.html                 Structure HTML uniquement (aucune logique)
manifest.json               Identité de l'app installable (PWA)
service-worker.js           Mise en cache pour le fonctionnement hors-ligne
assets/css/style.css        Tous les styles
assets/icons/               Icônes de l'app
data/catalogue.json         Catalogue par défaut (prix, TVA) — modifiable
                             directement ici ou depuis l'app

js/
  config.js                 Constantes : société, clés de stockage, mot de passe
  stockage.js                Seul point d'accès au localStorage
  catalogue.js                Chargement du catalogue (dépôt privé en priorité)
                               + gestion des prix/TVA
  catalogue-patch.js           Applique un correctif ponctuel à un catalogue
                                (partagé entre l'usage local et la synchro)
  consommation.js              Mode Sur place / À emporter + conversion de TVA (sans DOM)
  panier.js                    État du panier de la vente en cours
  calculatrice.js               Logique de la calculette ("Montant libre")
  ticket.js                      Calcul TVA + mise en forme du ticket légal
                                  (fonctions pures, sans DOM)
  ventes.js                       Sauvegarde d'une vente, lecture de l'historique
  numerotation.js                  Attribution des numéros de ticket (blocs partagés)
  cloture.js                       Calcul, sauvegarde et rassemblement des clôtures
  cloture-auto.js                   Mise à jour automatique des clôtures des journées terminées
  garde-code.js                      Pavé de code (logo = gestion, bouton Clôture)
  impression.js                      Point d'entrée unique de l'impression papier (80 mm)
  export.js                         Export CSV/JSON, restauration, dossier local
  github-sync.js                     Synchronisation temps réel vers le dépôt privé
  clavier.js                          Pavé numérique, pavé de calcul et clavier AZERTY (chiffres, ⇧, ENTRÉE)
  tri.js                               Ordre alphabétique d'affichage des articles
  format.js                            Format des nombres (virgule décimale)
  caisse.js                            Clôture de caisse : comptage, écart, enregistrement
  ui-caisse.js                         Écrans du comptage et de son historique
  ui-modal.js                          Moteur générique de fenêtres modales
  ui-menu.js                            Navigation du menu de vente + panier
  ui-ristourne.js                        Pop-up de saisie d'une ristourne
  ui-mode.js                              Switch Sur place / À emporter + choix obligatoire
  plein-ecran.js                           Bouton plein écran (⛶ / ✕)
  ui-paiement.js                         Écran de paiement et reçu
  ui-historique.js                        Historique du jour et clôtures
  ui-export.js                             Écran Export & Sauvegarde
  ui-gestion.js                             Écran Gestion des prix (protégé)
  ui-parametres.js                          Configuration de la synchro GitHub
  app.js                                    Point d'entrée, démarre tout
```

## Où sont stockées les données ?

1. **En premier lieu, toujours en local** (localStorage du navigateur) —
   la caisse fonctionne intégralement hors-ligne, aucune vente n'est
   jamais bloquée par une coupure internet.
2. **En tâche de fond**, chaque vente/clôture/modification de prix est
   envoyée au dépôt privé GitHub dès qu'une connexion est disponible.
   En cas d'échec, l'élément reste en file d'attente et sera retenté
   automatiquement (retour en ligne, ou toutes les 60 secondes).
3. **En bonus (Chrome/Edge PC et Android uniquement)**, un dossier local
   peut aussi être choisi (bouton **Export**) pour une copie
   supplémentaire automatique sur le disque de l'appareil.

Au démarrage, le catalogue est pris dans cet ordre :
1. le `catalogue.json` du **dépôt privé** (version partagée par tous les
   appareils), si la synchronisation GitHub est configurée et joignable ;
2. sinon la **copie locale** de l'appareil ;
3. sinon le catalogue de **référence** `data/catalogue.json` de ce dépôt
   public (il amorce un appareil neuf, ou un appareil jamais synchronisé).

### Catalogue de référence et « reliquats » d'une ancienne version

`data/catalogue.json` porte un numéro de génération (`version`). Toute
copie d'une génération antérieure est considérée **obsolète** et écartée
au profit de la référence, pour qu'aucun reliquat d'une ancienne version
ne persiste, même sur un appareil non synchronisé :
- **cache local obsolète** (tablette oubliée, ancien navigateur...) :
  remplacé par la référence ;
- **`catalogue.json` du dépôt privé obsolète** : l'ancien fichier est
  d'abord archivé dans `archives/` (dépôt privé), puis remplacé par la
  référence. Rien n'est perdu ;
- **modifications de catalogue en attente d'envoi** créées sur l'ancienne
  génération : abandonnées (les rejouer ferait réapparaître d'anciens
  articles). Les **ventes et clôtures en attente ne sont jamais touchées** ;
- un catalogue **à jour** (même personnalisé : prix modifiés, articles
  ajoutés) n'est **jamais** écrasé.

⚠️ Augmenter `VERSION_CATALOGUE` (dans `js/catalogue-patch.js`) en même
temps que la `version` de `data/catalogue.json` réinitialise le catalogue
de tous les appareils (les prix personnalisés sont remplacés ; l'ancienne
version reste archivée). À ne faire que volontairement.

## Synchronisation multi-appareils : comment les conflits sont évités

- **Catalogue** : chaque modification (prix, TVA, ajout, suppression,
  renommage) est envoyée comme un **correctif ponctuel** ("le prix de X
  passe à 5€"), jamais comme un remplacement intégral du fichier. Ce
  correctif est appliqué à la version la PLUS RÉCENTE du fichier sur
  GitHub au moment de l'envoi — les modifications faites entre-temps par
  un autre appareil ne sont donc jamais écrasées.
- **Numéro de ticket** : à chaque vente, l'appareil réserve auprès du
  dépôt privé LE PROCHAIN NUMÉRO LIBRE (et un seul), de façon atomique —
  une suite unique, partagée et ininterrompue pour toute l'entreprise
  (priorité choisie pour la tenue comptable, quitte à ce que chaque
  vente attende une confirmation réseau de l'ordre de quelques centaines
  de millisecondes). Dans le cas rare où la réservation échouerait
  (hors-ligne, synchronisation pas configurée), l'appareil bascule sur
  une numérotation de secours qui lui est propre
  (`<identifiant>-SECOURS-000001`...), jamais en collision avec la
  séquence partagée puisque textuellement distincte.
- **Ventes/clôtures** : l'Historique (avec un accès "📅 Autres journées"
  pour consulter n'importe quelle date passée, pas seulement
  aujourd'hui) et la Liste des clôtures consultent le dépôt privé en
  plus des données locales, pour qu'une machine voie l'activité de
  toutes les autres — y compris après un vidage de son propre cache.

## Autres fonctionnalités

- **Ajouter un article** (Gestion des prix) permet aussi d'ajouter dans
  "Plats" (les formats), "Viandes" et "Suppléments" — pas seulement
  dans les catégories à plat (Frites, Desserts, Boissons, Divers). Un
  "plat" complet est toujours la combinaison, choisie au moment de la
  vente, d'un format + d'une viande (+ suppléments) : ajouter un format
  ou une viande suffit à le proposer partout.
- **Promotion** : chaque article peut être marqué "en promotion" (case
  à cocher à l'ajout, bouton 🏷️ à bascule sur un article existant dans
  Gestion des prix). Purement visuel : un badge 🏷️ apparaît sur son
  bouton de vente et dans la liste de gestion.
- **Ristourne** (catégorie Divers) : ouvre une pop-up pour saisir un
  montant et choisir le taux de TVA applicable, puis ajoute une ligne
  négative au panier. Bloque la validation si la remise ferait passer
  le panier sous 0 €.

## TVA et mode « Sur place / À emporter »

Deux boutons exclusifs dans la barre du haut. Le choix est **obligatoire
pour chaque ticket** : aucun bouton n'est actif au départ ni après une
vente ou une annulation, et un clic sur PAIEMENT sans choix ouvre une
fenêtre qui le demande.

- Les taux du catalogue sont les taux **« à emporter »**.
- **Sur place**, 6 % devient 12 % ; les taux de 12 % et de 21 % ne changent pas.
- S'applique à **tout le ticket**, au moment du paiement (le panier
  affiche le taux effectif dès qu'un mode est choisi). La Ristourne et
  le Montant libre suivent la même règle.
- Les prix TTC ne changent jamais : seule la ventilation HT / TVA bouge.
- Le mode est imprimé sur le ticket (`Consommation : SUR PLACE`),
  enregistré dans chaque ticket (donc synchronisé), ajouté à l'export
  CSV (colonne `Consommation`) et totalisé dans la clôture.

⚠️ Les taux de TVA applicables à l'à-emporter et au sur-place ont évolué
en Belgique en 2026 : les taux du catalogue (`data/catalogue.json`)
doivent être validés avec ton comptable avant la mise en service.

- **Clôture** : le bouton est protégé par le même code que le logo,
  puis demande une confirmation. Il n'y a qu'UNE clôture par journée
  comptable (une nouvelle clôture du même jour remplace la précédente).
  Une fois la journée terminée (6 h), l'app recalcule automatiquement
  sa clôture avec toutes les ventes (y compris celles faites après un
  clic sur Clôture) et crée celles qui auraient été oubliées (14 derniers
  jours). La poubelle de la liste des clôtures ne supprime que la copie
  de l'appareil, jamais le fichier du dépôt privé.
- **Exports CSV** (ventes et clôtures) : virgule décimale, séparateur « ; », ouverture directe dans Excel. **Toutes les clôtures** : fusionne cet appareil et le
  dépôt privé, une ligne par journée (sans doublon), séparateur « ; »,
  virgule décimale, ouverture directe dans Excel.
- **Historique** : liste des tickets (le plus récent en premier) ;
  un ticket s'ouvre seul et peut être imprimé ou exporté en **copie**
  (mention « COPIE — DUPLICATA » + date de réimpression). L'impression
  passe aujourd'hui par le navigateur (mise en page 80 mm) ; l'imprimante
  thermique, le ticket cuisine et la coupe se brancheront plus tard dans
  `impression.js` uniquement.
- **Calculatrice** : « = » conclut le calcul, « ✔ OK » ajoute le montant
  au panier, « ⌫ » corrige la dernière frappe, « C » vide la saisie.
- **Clavier** de saisie : chiffres, majuscules/minuscules ; ⇧ une fois =
  prochaine lettre en majuscule, deux fois = Caps Lock.

- **Suppléments détaillés** : chaque supplément choisi est écrit sous son plat, un par ligne, en plus petit dans le panier et en retrait sur le ticket et dans l'enregistrement (colonne « Supplements » des CSV). Leur prix reste inclus dans le prix de la ligne.
- **Livraison** : troisième mode (avec « À emporter » et « Sur place »), à
  choisir pour chaque ticket. Mêmes taux de TVA qu'à emporter. Visible sur
  le ticket, dans l'historique, les CSV et la clôture (TOTAL LIVRAISON).
- **Clôture de caisse** (comptage du tiroir) : bouton « caisse » à gauche du
  titre dans la fenêtre de Clôture. On écrit des lignes (`530 liquide`,
  `-30 frites`, `10*50 billets`) avec ENTRÉE ; l'écart avec le liquide attendu
  d'après les ventes est calculé. Valider enregistre `caisses/caisse_AAAA-MM-JJ_HHMMSS.json`
  dans le dépôt privé (un fichier par comptage). Historique : menu du logo →
  « Clôtures de caisse ».
- **Menu du logo (code)** : Ajouter article, Clôtures, Clôtures de caisse,
  Export & sauvegarde, Paramètres. Il n'y a plus de bouton Export dans la barre.
- **Favoris** ⭐ : comme la promotion, discret (étoile à côté du nom), sans
  changer la place de l'article. **Tri** : les articles sont affichés par ordre
  alphabétique (Frites : Petite puis Grande ; Ristourne en dernier).

## Plats : deux logiques de prix

- **Additif** (ex. Mitraillette, Assiette) : prix = format + prix de la
  viande choisie dans la liste générale des viandes.
- **À prix fixes** (ex. Durum, Kapsalon, Poche, Pain rond) : le format
  porte sa propre liste de choix et leurs prix (champ `prixFixes`),
  indépendants de la liste des viandes. Ils se modifient dans **Gestion
  des prix** (lignes « ↳ » sous le format) ; **Ajouter un article** permet
  d'ajouter un choix à un format existant, ou un nouveau format à prix fixes.

Dans les deux cas, la page des suppléments est toujours proposée ensuite.
Un supplément peut être limité à certains formats (champ `formats`) ;
si tu renommes un format, mets ce champ à jour dans le catalogue.

## Journée comptable, Salades et suppléments

- **Journée comptable** : elle va de 06:00 à 05:59 le lendemain. Un ticket émis le 23/10 à 00:30 appartient à la journée du **22/10**. Le calcul (`js/date-comptable.js`) utilise l'heure locale de la tablette, jamais l'heure UTC.
- **Gestion** (logo, puis code) : le menu propose *Gestion Article* (produits rangés par onglets : Plats, Viandes, chaque rubrique, Suppléments), *Ajouter article*, *Clôtures*, *Clôtures de caisse*, *Export & sauvegarde* et *Paramètres*.
- **Salades** : « Salade César » (9,00 € TTC, TVA 6 %) et « Salade Divers » (`special: "prix-libre"`), qui ouvre un pavé pour saisir le prix TTC de la salade sur mesure. La TVA de cet article se règle dans *Gestion Article*.
- **Suppléments** : Salade, Tomates, Oignon (champ `ordre` 1, 2, 3, à 0 €) puis les suivants par ordre alphabétique, « Suppléments Divers » en dernier. Un supplément avec `"multiple": true` se clique plusieurs fois (bouton −1 pour en retirer un) et s'imprime « 2 x Suppléments Divers ».
- Le catalogue privé a priorité tant que `version` est identique : après une mise à jour du catalogue de l'application, remplacer `catalogue.json` dans le dépôt privé.

## Plein écran

Un bouton unique dans la barre du haut : ⛶ passe en plein écran, ✕ en sort.
Le navigateur impose un clic (pas de plein écran automatique), et Safari
sur iPhone ne le permet pas pour une page web : le bouton y est masqué
(l'app installée sur l'écran d'accueil s'ouvre déjà sans barre d'adresse).

## Mettre à jour l'application

Le service worker (fonctionnement hors-ligne) utilise la stratégie
**réseau d'abord, cache en secours** : un appareil en ligne reçoit la
version publiée sur GitHub dès le rechargement suivant (GitHub Pages peut
mettre jusqu'à ~10 minutes à publier). Sans réseau, ou si le réseau met
plus de 4 secondes à répondre, la copie en cache prend le relais : la
caisse reste utilisable.

- Pour un appareil encore sur l'ancienne stratégie : fermer puis rouvrir
  l'app **deux fois** (la première charge le nouveau service worker).
- Incrémenter `CACHE_NOM` dans `service-worker.js` uniquement si la
  **liste des fichiers** à pré-charger change (fichier ajouté/retiré).
- Si la structure du catalogue change, voir le README du dépôt privé.

## Modifier la société ou le mot de passe de gestion

Tout se trouve dans `js/config.js` — un seul endroit à modifier.
