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

function chargerRecords() {
  try {
    const brut = JSON.parse(localStorage.getItem(R.CLE_STOCKAGE) || '{}');
    const records = {};
    for (const nom of R.JOUEURS) records[nom] = Number(brut[nom]) || 0;
    return records;
  } catch {
    // Stockage inaccessible (navigation privee, donnees effacees) : on joue
    // quand meme, sans record. Jamais de plantage pour ca.
    return Object.fromEntries(R.JOUEURS.map((n) => [n, 0]));
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

  function dessinerJoueurs() {
    const conteneur = $('joueurs');
    conteneur.innerHTML = '';
    boutons.clear();
    for (const nom of R.JOUEURS) {
      const bouton = document.createElement('button');
      bouton.className = 'joueur' + (nom === joueur ? ' actif' : '');
      bouton.innerHTML = `<span class="nom">${nom}</span><span class="record">${records[nom]}</span>`;
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
        records[nom] = 0;
        sauverRecords(records);
        bouton.querySelector('.record').textContent = '0';
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
    $('record').textContent = `${joueur} · record ${records[joueur]}`;
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
    get record() { return records[joueur]; },
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

    afficherFin(score) {
      const nouveau = score > records[joueur];
      if (nouveau) {
        records[joueur] = score;
        sauverRecords(records);
      }
      $('titre').textContent = nouveau ? 'NOUVEAU RECORD !' : 'Temps écoulé !';
      $('titre').className = nouveau ? 'record-battu' : '';
      $('corps').innerHTML = `
        <p class="score-final">${score} points</p>
        <p class="sous-score">Meilleur score de ${joueur} : ${records[joueur]}</p>`;
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
