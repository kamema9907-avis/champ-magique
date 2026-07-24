/**
 * Le HUD, les ecrans, et les profils de joueur.
 *
 * Les profils repondent a un vrai besoin : plusieurs personnes jouent sur le
 * meme iPad. Un simple bouton "remettre a zero" detruirait le record de Raphael ;
 * des profils separes ne detruisent rien, et affichent les records cote a cote,
 * ce qui donne a un enfant la meilleure motivation qui soit : battre son papi.
 */

import * as R from './reglages.js';
import { typesDuTableau, TYPE_CRISTAL } from './plantes.js';

const $ = (id) => document.getElementById(id);

// Un record par tableau et par joueur : { t1, t2, ... }. Autant de tableaux que
// de palettes definies dans reglages.
const NB_TABLEAUX = R.PALETTE_TABLEAU.length;
const recordVide = () => {
  const rec = {};
  for (let t = 1; t <= NB_TABLEAUX; t++) rec['t' + t] = 0;
  return rec;
};

function chargerRecords() {
  try {
    const brut = JSON.parse(localStorage.getItem(R.CLE_STOCKAGE) || '{}');
    const records = {};
    for (const nom of R.JOUEURS) {
      const rec = recordVide();
      const v = brut[nom];
      // Migration : l'ancien format (v1.0) stockait un simple nombre = record du
      // tableau 1 ; les versions suivantes stockent { t1, t2, ... }. On reprend
      // ce qu'on trouve, les tableaux absents restant a zero.
      if (typeof v === 'number') rec.t1 = v;
      else if (v) for (let t = 1; t <= NB_TABLEAUX; t++) rec['t' + t] = Number(v['t' + t]) || 0;
      records[nom] = rec;
    }
    return records;
  } catch {
    // Stockage inaccessible (navigation privee, donnees effacees) : on joue
    // quand meme, sans record. Jamais de plantage pour ca.
    return Object.fromEntries(R.JOUEURS.map((n) => [n, recordVide()]));
  }
}

function sauverRecords(records) {
  try { localStorage.setItem(R.CLE_STOCKAGE, JSON.stringify(records)); } catch { /* ignore */ }
}

// Noms enfant-friendly des niveaux, dans l'ordre de R.NIVEAUX_APPARITION.
const NOMS_NIVEAUX = ['Facile', 'Moyen', 'Difficile'];

export function creerInterface({ surDemarrage }) {
  let records = chargerRecords();
  let joueur = localStorage.getItem(R.CLE_DERNIER_JOUEUR) || R.JOUEURS[0];
  if (!R.JOUEURS.includes(joueur)) joueur = R.JOUEURS[0];

  let niveau = Number(localStorage.getItem(R.CLE_NIVEAU)) || R.NIVEAU_DEFAUT;
  if (niveau < 1 || niveau > R.NIVEAUX_APPARITION.length) niveau = R.NIVEAU_DEFAUT;

  let tableau = Number(localStorage.getItem(R.CLE_TABLEAU)) || 1;

  const boutons = new Map();
  const boutonsNiveau = new Map();
  const boutonsTableau = new Map();

  // Deverrouillage EN CHAINE : le tableau t (t >= 2) s'ouvre quand le record du
  // tableau PRECEDENT atteint le seuil. Le tableau 1 est toujours ouvert.
  const deverrouille = (nom, t) => t <= 1 || records[nom]['t' + (t - 1)] >= R.SEUIL_DEBLOCAGE[t - 2];

  // Deverrouillage des NIVEAUX dans un tableau : le niveau n s'ouvre quand le
  // record du profil SUR CE TABLEAU atteint le seuil (Facile, seuil 0, toujours ouvert).
  const niveauDeverrouille = (nom, t, n) => records[nom]['t' + t] >= R.SEUIL_NIVEAU[n - 1];

  // Un profil repart au minimum accessible pour le tableau/niveau selectionne.
  if (!deverrouille(joueur, tableau)) tableau = 1;
  if (!niveauDeverrouille(joueur, tableau, niveau)) niveau = 1;

  /** Sous un nom : le record du tableau SELECTIONNE (ou un cadenas s'il est verrouille). */
  function texteRecord(nom) {
    if (!deverrouille(nom, tableau)) return `T${tableau} 🔒`;
    return `T${tableau} ${records[nom]['t' + tableau]}`;
  }

  function dessinerJoueurs() {
    const conteneur = $('joueurs');
    conteneur.innerHTML = '';
    boutons.clear();
    for (const nom of R.JOUEURS) {
      const bouton = document.createElement('button');
      bouton.className = 'joueur' + (nom === joueur ? ' actif' : '');
      bouton.innerHTML = `<span class="nom">${nom}</span><span class="record">${texteRecord(nom)}</span>`;
      brancherAppuiLong(bouton, nom);
      bouton.addEventListener('click', () => { choisir(nom); });
      conteneur.appendChild(bouton);
      boutons.set(nom, bouton);
    }
  }

  function choisir(nom) {
    joueur = nom;
    try { localStorage.setItem(R.CLE_DERNIER_JOUEUR, nom); } catch { /* ignore */ }
    for (const [autre, bouton] of boutons) bouton.classList.toggle('actif', autre === nom);
    // Le nouveau profil peut avoir moins de tableaux/niveaux debloques : on borne.
    if (!deverrouille(joueur, tableau)) tableau = 1;
    if (!niveauDeverrouille(joueur, tableau, niveau)) niveau = 1;
    dessinerTableaux();
    dessinerNiveaux();
    majRecordHud();
  }

  function dessinerNiveaux() {
    const conteneur = $('niveaux');
    conteneur.innerHTML = '';
    boutonsNiveau.clear();
    $('niveau-indice').textContent = '';
    for (let n = 1; n <= R.NIVEAUX_APPARITION.length; n++) {
      const bouton = document.createElement('button');
      const verrouille = !niveauDeverrouille(joueur, tableau, n);
      bouton.className = 'niveau' + (n === niveau ? ' actif' : '') + (verrouille ? ' verrouille' : '');
      const nom = NOMS_NIVEAUX[n - 1] || `Niveau ${n}`;
      bouton.innerHTML = `<span class="numero">${n}${verrouille ? ' 🔒' : ''}</span>` +
                         `<span class="libelle">${nom}</span>`;
      bouton.addEventListener('click', () => choisirNiveau(n, verrouille));
      conteneur.appendChild(bouton);
      boutonsNiveau.set(n, bouton);
    }
  }

  function choisirNiveau(n, verrouille) {
    if (verrouille) {
      // Verrouille : on n'ouvre pas, on explique comment le debloquer.
      $('niveau-indice').textContent =
        `Fais ${R.SEUIL_NIVEAU[n - 1]} points à ce tableau pour débloquer`;
      return;
    }
    $('niveau-indice').textContent = '';
    niveau = n;
    try { localStorage.setItem(R.CLE_NIVEAU, String(n)); } catch { /* ignore */ }
    for (const [autre, bouton] of boutonsNiveau) bouton.classList.toggle('actif', autre === n);
  }

  const NOMS_TABLEAUX = ['Le Champ', 'Les Rochers', 'Forêt Gelée', 'Terres de Feu',
                         'Le Potager Enchanté', 'Les Champs de Miel',
                         'Le Jardin Nocturne', 'La Vallée Arc-en-ciel'];

  function dessinerTableaux() {
    const conteneur = $('tableaux');
    conteneur.innerHTML = '';
    boutonsTableau.clear();
    $('tableau-indice').textContent = '';
    for (let t = 1; t <= NB_TABLEAUX; t++) {
      const bouton = document.createElement('button');
      const verrouille = !deverrouille(joueur, t);
      bouton.className = 'tableau' + (t === tableau ? ' actif' : '') + (verrouille ? ' verrouille' : '');
      bouton.innerHTML = `<span class="numero">${t}${verrouille ? ' 🔒' : ''}</span>` +
                         `<span class="libelle">${NOMS_TABLEAUX[t - 1] || `Tableau ${t}`}</span>`;
      bouton.addEventListener('click', () => choisirTableau(t, verrouille));
      conteneur.appendChild(bouton);
      boutonsTableau.set(t, bouton);
    }
  }

  function choisirTableau(t, verrouille) {
    if (verrouille) {
      // Cliquer sur un tableau verrouille ne le selectionne pas : ca explique
      // seulement comment le debloquer (par un bon score au tableau precedent).
      $('tableau-indice').textContent =
        `Fais ${R.SEUIL_DEBLOCAGE[t - 2]} points au tableau ${t - 1} pour débloquer`;
      return;
    }
    $('tableau-indice').textContent = '';
    tableau = t;
    try { localStorage.setItem(R.CLE_TABLEAU, String(t)); } catch { /* ignore */ }
    for (const [autre, bouton] of boutonsTableau) bouton.classList.toggle('actif', autre === t);
    // Les niveaux debloques dependent du record de CE tableau : on borne et on redessine.
    if (!niveauDeverrouille(joueur, tableau, niveau)) niveau = 1;
    // Les profils affichent le record du tableau SELECTIONNE : on les redessine.
    dessinerJoueurs();
    dessinerNiveaux();
    majLegende();   // fleurs ou legumes selon le tableau
    majRecordHud();
  }

  /** Appui long de 2 s : remet a zero CE joueur seulement. Discret, jamais par accident. */
  function brancherAppuiLong(bouton, nom) {
    let minuteur = null;
    const demarrer = () => {
      bouton.classList.add('efface');
      minuteur = setTimeout(() => {
        // Efface TOUS les records du joueur : ca re-verrouille toute la chaine
        // de tableaux (les records retombent sous les seuils), l'effet attendu.
        records[nom] = recordVide();
        sauverRecords(records);
        bouton.querySelector('.record').textContent = texteRecord(nom);
        bouton.classList.remove('efface');
        bouton.classList.add('efface-fait');
        setTimeout(() => bouton.classList.remove('efface-fait'), 600);
      }, 2000);
    };
    const arreter = () => {
      clearTimeout(minuteur);
      bouton.classList.remove('efface');
    };
    bouton.addEventListener('pointerdown', demarrer);
    bouton.addEventListener('pointerup', arreter);
    bouton.addEventListener('pointerleave', arreter);
    bouton.addEventListener('pointercancel', arreter);
    bouton.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function majRecordHud() {
    $('record').textContent = `${joueur} · record ${records[joueur]['t' + tableau]}`;
  }

  const TEXTE_MENU = `
    <p><strong>Récolte un maximum de plantes en 60 secondes !</strong></p>
    <p class="commandes">
      <span class="tactile-seul">Pose ton pouce et fais-le glisser pour marcher.</span>
      <span class="pc-seul">Flèches, ou clique pour marcher vers le curseur (reclique pour t'arrêter).</span>
      La récolte est automatique au contact.
    </p>
    <div class="plantes" id="legende"></div>
    <p class="avert">Le Cristal-lune ne reste que 8 secondes. Attention aux Rôdeurs rouges :
    un contact coûte 10% de ton score.</p>`;

  // La legende des recoltes depend du tableau : fleurs (1-4) ou legumes (5-8),
  // plus le Cristal-lune, toujours present. Rien sur l'ecran de fin (pas de #legende).
  function majLegende() {
    const el = $('legende');
    if (!el) return;
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    el.innerHTML = [...typesDuTableau(tableau), TYPE_CRISTAL].map((t) =>
      `<span><i class="pastille" style="background:${hex(t.couleur)}"></i>${t.nom} ${t.points}</span>`
    ).join('');
  }

  $('action').addEventListener('click', () => surDemarrage());

  return {
    get joueur() { return joueur; },
    get record() { return records[joueur].t1; },
    get niveau() { return niveau; },
    get tableau() { return tableau; },

    afficherMenu() {
      $('titre').textContent = 'LA RÉCOLTE DU CHAMP MAGIQUE';
      $('titre').className = '';
      $('corps').innerHTML = TEXTE_MENU;
      $('action').textContent = 'Appuie pour commencer';
      $('joueurs-bloc').style.display = '';
      $('panneau').style.display = '';
      $('score').textContent = 'Score : 0';
      $('chrono').textContent = '60';
      dessinerJoueurs();
      dessinerTableaux();
      dessinerNiveaux();
      majLegende();
      majRecordHud();
    },

    afficherFin(score, tableau = 1) {
      const cle = 't' + tableau;
      const rec = records[joueur];
      // Deblocage EN CHAINE : ce score peut ouvrir le tableau SUIVANT. On compare
      // avant/apres pour ne feter le deblocage qu'a la premiere fois.
      const suivant = tableau + 1;
      const suivantExiste = suivant <= NB_TABLEAUX;
      const etaitDeverrouille = suivantExiste && deverrouille(joueur, suivant);
      const nouveau = score > rec[cle];
      if (nouveau) {
        rec[cle] = score;
        sauverRecords(records);
      }
      const vientDeDebloquer = suivantExiste && !etaitDeverrouille && deverrouille(joueur, suivant);

      $('titre').textContent = nouveau ? 'NOUVEAU RECORD !' : 'Temps écoulé !';
      $('titre').className = nouveau ? 'record-battu' : '';
      const messageDeblocage = vientDeDebloquer
        ? `<p class="deblocage">🎉 « ${NOMS_TABLEAUX[suivant - 1]} » débloqué !</p>` : '';
      $('corps').innerHTML = `
        <p class="score-final">${score} points</p>
        ${messageDeblocage}
        <p class="sous-score">Meilleur score de ${joueur} (tableau ${tableau}) : ${rec[cle]}</p>`;
      $('action').textContent = 'Rejouer';
      $('joueurs-bloc').style.display = '';
      $('panneau').style.display = '';
      dessinerJoueurs();
      dessinerTableaux();
      dessinerNiveaux();
      majRecordHud();
      return nouveau;
    },

    cacherPanneau() { $('panneau').style.display = 'none'; },
    majScore(score) {
      const el = $('score');
      el.textContent = `Score : ${score}`;
      el.classList.remove('pop');
      void el.offsetWidth;         // force le reflow pour rejouer l'animation
      el.classList.add('pop');
    },

    majChrono(restant) {
      const chrono = $('chrono');
      chrono.textContent = String(Math.max(0, Math.ceil(restant)));
      chrono.classList.toggle('urgent', restant <= 10);
    },

    /** Le "+5" qui s'envole, positionne en projetant le point 3D a l'ecran. */
    volant(x, y, texte, couleur) {
      const element = document.createElement('div');
      element.className = 'volant';
      element.textContent = texte;
      element.style.color = couleur;
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      $('volants').appendChild(element);
      setTimeout(() => element.remove(), 900);
    },

    majOrientation() {
      const portrait = window.innerHeight > window.innerWidth;
      // Seulement sur ecran tactile : sur PC, une fenetre etroite ne doit pas
      // declencher le message.
      const tactile = matchMedia('(hover: none) and (pointer: coarse)').matches;
      $('tourne').style.display = (portrait && tactile) ? 'flex' : 'none';
      return portrait && tactile;
    },
  };
}
