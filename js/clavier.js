/**
 * clavier.js — Composants réutilisables : pavé numérique et clavier
 * alphabétique AZERTY, utilisés dans les écrans de saisie (mot de passe,
 * prix, renommage d'article...). Chaque fonction construit un élément
 * DOM autonome et appelle surTouche(valeur) à chaque pression.
 */

export function creerPaveNumerique(surTouche) {
  const conteneur = document.createElement('div');
  conteneur.className = 'pave';
  ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'C'].forEach(b => {
    const btn = document.createElement('button');
    if (b === 'C') btn.classList.add('rouge');
    btn.textContent = b;
    btn.addEventListener('click', () => surTouche(b));
    conteneur.appendChild(btn);
  });
  return conteneur;
}

/**
 * Clavier alphanumérique (chiffres, lettres, espace, effacement) avec
 * touche ⇧ :
 *  - un appui  : la PROCHAINE lettre est une majuscule, puis retour aux
 *    minuscules (comme sur un téléphone) ;
 *  - deux appuis rapides : Caps Lock verrouillé (voyant vert) ;
 *  - un appui de plus : retour aux minuscules.
 * `options.majusculeInitiale` (défaut : vrai) : première lettre en
 * majuscule (désactivé pour modifier un nom existant).
 * `options.entree` (défaut : faux) : ajoute une touche ENTRÉE verte, bien
 * visible, qui envoie 'ENTER' (utilisée pour écrire une ligne de saisie).
 * La fonction surTouche reçoit le caractère exact ('a', 'A', '7'), ou
 * 'SPC' / 'BACK'.
 */
// Pavé numérique avec signes de calcul (+ - * /) et virgule/point, pour
// saisir des montants ou de petites opérations (ex. 10*50).
export function creerPaveCalcul(surTouche) {
  const conteneur = document.createElement('div');
  conteneur.className = 'pave pave-calcul';
  ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', ',', '+'].forEach(b => {
    const btn = document.createElement('button');
    if ('/*-+'.includes(b)) btn.classList.add('op');
    btn.textContent = b;
    btn.addEventListener('click', () => surTouche(b));
    conteneur.appendChild(btn);
  });
  return conteneur;
}

export function creerClavierAzerty(surTouche, options = {}) {
  const conteneur = document.createElement('div');
  conteneur.className = 'clavier';
  let etat = options.majusculeInitiale === false ? 'min' : 'maj1'; // 'min' | 'maj1' | 'lock'
  let dernierAppuiMaj = 0;
  const boutonsLettres = [];
  let btnMaj;

  const rafraichir = () => {
    const maj = etat !== 'min';
    boutonsLettres.forEach(b => { b.textContent = maj ? b.dataset.l.toUpperCase() : b.dataset.l.toLowerCase(); });
    btnMaj.classList.toggle('actif', etat === 'maj1');
    btnMaj.classList.toggle('verrou', etat === 'lock');
    btnMaj.textContent = etat === 'lock' ? '⇧ VERR' : '⇧';
  };

  const creerRangee = (touches, estChiffre) => {
    const ligne = document.createElement('div');
    ligne.className = 'clavier-row';
    touches.split('').forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'btn-lettre' + (estChiffre ? ' chiffre' : '');
      btn.textContent = l;
      if (estChiffre) {
        btn.addEventListener('click', () => surTouche(l));
      } else {
        btn.dataset.l = l;
        btn.addEventListener('click', () => {
          const car = etat === 'min' ? l.toLowerCase() : l.toUpperCase();
          if (etat === 'maj1') { etat = 'min'; rafraichir(); }
          surTouche(car);
        });
        boutonsLettres.push(btn);
      }
      ligne.appendChild(btn);
    });
    return ligne;
  };

  conteneur.appendChild(creerRangee('1234567890', true));
  conteneur.appendChild(creerRangee('AZERTYUIOP', false));
  conteneur.appendChild(creerRangee('QSDFGHJKLM', false));

  const ligneBasse = creerRangee('WXCVBN', false);
  btnMaj = document.createElement('button');
  btnMaj.className = 'btn-lettre special';
  btnMaj.addEventListener('click', () => {
    const maintenant = Date.now();
    if (maintenant - dernierAppuiMaj < 350) etat = 'lock';
    else etat = etat === 'min' ? 'maj1' : 'min';
    dernierAppuiMaj = maintenant;
    rafraichir();
  });
  ligneBasse.insertBefore(btnMaj, ligneBasse.firstChild);
  conteneur.appendChild(ligneBasse);

  const derniere = document.createElement('div');
  derniere.className = 'clavier-row';
  const espace = document.createElement('button');
  espace.className = 'btn-lettre special';
  espace.textContent = 'ESPACE';
  espace.addEventListener('click', () => surTouche('SPC'));
  const retour = document.createElement('button');
  retour.className = 'btn-lettre special';
  retour.style.background = 'var(--red)';
  retour.textContent = '⌫';
  retour.addEventListener('click', () => surTouche('BACK'));
  if (options.entree) {
    const entree = document.createElement('button');
    entree.className = 'btn-lettre special entree';
    entree.textContent = '↵ ENTRÉE';
    entree.addEventListener('click', () => surTouche('ENTER'));
    derniere.append(espace, entree, retour);
  } else {
    derniere.append(espace, retour);
  }
  conteneur.appendChild(derniere);

  rafraichir();
  return conteneur;
}
