/**
 * Le HUD, les ecrans, et les profils de joueur.
 *
 * Les profils repondent a un vrai besoin : plusieurs personnes jouent sur le
 * meme iPad. Un simple bouton "remettre a zero" detruirait le record de Raphael ;
 * des profils separes ne detruisent rien, et affichent les records cote a cote,
 * ce qui donne a un enfant la meilleure motivation qui soit : battre son papi.
 */

import * as R from './reglages.js';

const $ = (id) => document.getElementById(id);

// Un record par tableau et par joueur : { t1, t2 }.
const recordVide = () => ({ t1: 0, t2: 0 });

function chargerRecords() {
  try {
    const brut = JSON.parse(localStorage.getItem(R.CLE_STOCKAGE) || '{}');
    const records = {};
    for (const nom of R.JOUEURS) {
      const v = brut[nom];
      // Migration : l'ancien format (v1.0) stockait un simple nombre, qui etait
      // le record du tableau 1. On le reprend tel quel pour ne rien perdre.
      if (typeof v === 'number') records[nom] = { t1: v, t2: 0 };
      else records[nom] = { t1: Number(v && v.t1) || 0, t2: Number(v && v.t2) || 0 };
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

  const boutons = new Map();
  const boutonsNiveau = new Map();

  /** Le tableau 2 est debloque des que le record du tableau 1 atteint le seuil. */
  const deverrouille = (nom) => records[nom].t1 >= R.SEUIL_TABLEAU_2;

  /** Ce qu'on affiche sous un nom : cadenas avant deblocage, deux nombres apres. */
  function texteRecord(nom) {
    const rec = records[nom];
    return deverrouille(nom) ? `T1 ${rec.t1} · T2 ${rec.t2}` : `${rec.t1} · 🔒`;
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
    majRecordHud();
  }

  function dessinerNiveaux() {
    const conteneur = $('niveaux');
    conteneur.innerHTML = '';
    boutonsNiveau.clear();
    for (let n = 1; n <= R.NIVEAUX_APPARITION.length; n++) {
      const bouton = document.createElement('button');
      bouton.className = 'niveau' + (n === niveau ? ' actif' : '');
      const nom = NOMS_NIVEAUX[n - 1] || `Niveau ${n}`;
      bouton.innerHTML = `<span class="numero">${n}</span><span class="libelle">${nom}</span>`;
      bouton.addEventListener('click', () => choisirNiveau(n));
      conteneur.appendChild(bouton);
      boutonsNiveau.set(n, bouton);
    }
  }

  function choisirNiveau(n) {
    niveau = n;
    try { localStorage.setItem(R.CLE_NIVEAU, String(n)); } catch { /* ignore */ }
    for (const [autre, bouton] of boutonsNiveau) bouton.classList.toggle('actif', autre === n);
  }

  /** Appui long de 2 s : remet a zero CE joueur seulement. Discret, jamais par accident. */
  function brancherAppuiLong(bouton, nom) {
    let minuteur = null;
    const demarrer = () => {
      bouton.classList.add('efface');
      minuteur = setTimeout(() => {
        // Efface les DEUX records : ca re-verrouille le tableau 2 (le record du
        // tableau 1 retombe sous le seuil), exactement l'effet attendu.
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
    $('record').textContent = `${joueur} · record ${records[joueur].t1}`;
  }

  const TEXTE_MENU = `
    <p><strong>Récolte un maximum de plantes en 60 secondes !</strong></p>
    <p class="commandes">
      <span class="tactile-seul">Pose ton pouce et fais-le glisser pour marcher.</span>
      <span class="pc-seul">Flèches, ou clique pour marcher vers le curseur (reclique pour t'arrêter).</span>
      La récolte est automatique au contact.
    </p>
    <div class="plantes">
      <span><i class="pastille" style="background:#3d7bff"></i>Mousse-bleue 1</span>
      <span><i class="pastille" style="background:#ffd21f"></i>Épi doré 3</span>
      <span><i class="pastille" style="background:#a339d6"></i>Trompette pourpre 5</span>
      <span><i class="pastille" style="background:#ff6a00"></i>Étoile-de-feu 10</span>
      <span><i class="pastille" style="background:#3df2ff"></i>Cristal-lune 25</span>
    </div>
    <p class="avert">Le Cristal-lune ne reste que 8 secondes. Attention aux Rôdeurs rouges :
    un contact coûte 10% de ton score.</p>`;

  $('action').addEventListener('click', () => surDemarrage());

  return {
    get joueur() { return joueur; },
    get record() { return records[joueur].t1; },
    get niveau() { return niveau; },

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
      dessinerNiveaux();
      majRecordHud();
    },

    afficherFin(score, tableau = 1) {
      const cle = 't' + tableau;
      const rec = records[joueur];
      // Le deblocage se calcule sur le tableau 1 : on compare avant/apres pour
      // savoir si CE score vient de franchir le seuil pour la premiere fois.
      const etaitDeverrouille = deverrouille(joueur);
      const nouveau = score > rec[cle];
      if (nouveau) {
        rec[cle] = score;
        sauverRecords(records);
      }
      const vientDeDebloquer = !etaitDeverrouille && deverrouille(joueur);

      $('titre').textContent = nouveau ? 'NOUVEAU RECORD !' : 'Temps écoulé !';
      $('titre').className = nouveau ? 'record-battu' : '';
      const messageDeblocage = vientDeDebloquer
        ? '<p class="deblocage">🎉 Tableau 2 débloqué !</p>' : '';
      $('corps').innerHTML = `
        <p class="score-final">${score} points</p>
        ${messageDeblocage}
        <p class="sous-score">Meilleur score de ${joueur} (tableau ${tableau}) : ${rec[cle]}</p>`;
      $('action').textContent = 'Rejouer';
      $('joueurs-bloc').style.display = '';
      $('panneau').style.display = '';
      dessinerJoueurs();
      dessinerNiveaux();
      majRecordHud();
      return nouveau;
    },

    cacherPanneau() { $('panneau').style.display = 'none'; },
    majScore(score) { $('score').textContent = `Score : ${score}`; },

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
