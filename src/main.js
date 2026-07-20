/**
 * Point d'entree : assemble le jeu et fait tourner la boucle.
 *
 * Lancer avec :  npm run dev
 * Tester avec :  npm test
 */

import * as THREE from 'three';
import * as R from './reglages.js';
import { creerMonde, ouvertureVerticale } from './monde.js';
import { creerCommandes } from './commandes.js';
import { creerSons } from './sons.js';
import { creerInterface } from './interface.js';
import { creerJeu } from './jeu.js';
import { brancherPiloteAuto } from './pilote-auto.js';

const canvas = document.getElementById('scene');
const rendu = new THREE.WebGLRenderer({ canvas, antialias: true });
rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // au-dela, on paie sans rien voir
rendu.shadowMap.enabled = true;
rendu.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft est deprecie depuis three 0.185

const { scene, camera, sol, feuillage } = creerMonde();
const commandes = creerCommandes({ canvas, camera, scene });
const sons = creerSons();
const ui = creerInterface({ surDemarrage: () => demarrer() });
const jeu = creerJeu({ scene, camera, commandes, sons, ui, sol, feuillage });

function demarrer() {
  // Le son doit etre debloque DANS le geste de l'utilisateur : c'est la seule
  // fenetre ou iOS l'autorise. Notre bouton "Commencer" en est un.
  sons.deverrouiller();
  jeu.demarrerPartie(ui.niveau, ui.tableau);
}

function redimensionner() {
  const l = window.innerWidth;
  const h = window.innerHeight;
  rendu.setSize(l, h);
  camera.aspect = l / h;
  // L'ouverture s'adapte a la forme de l'ecran pour garder une largeur de champ
  // constante : c'est par les cotes qu'arrivent les Rodeurs.
  camera.fov = ouvertureVerticale(camera.aspect);
  camera.updateProjectionMatrix();
  ui.majOrientation();
}
window.addEventListener('resize', redimensionner);
window.addEventListener('orientationchange', () => setTimeout(redimensionner, 120));
redimensionner();

// --- Boucle ---------------------------------------------------------------
// Pas de simulation FIXE, decouple de l'affichage : sur une machine lente, le
// joueur avancerait sinon de presque un metre d'un coup et traverserait les
// plantes sans les toucher. Garantit le meme jeu a 60 i/s sur iPad et a 10 i/s
// dans les tests automatises.

let precedent = performance.now();
let accumulateur = 0;

function boucle(maintenant) {
  requestAnimationFrame(boucle);

  let ecoule = (maintenant - precedent) / 1000;
  precedent = maintenant;
  // Un onglet remis au premier plan peut renvoyer plusieurs secondes d'un coup :
  // on borne, sinon la partie se deroulerait d'un bloc.
  ecoule = Math.min(ecoule, R.PAS_SIMULATION * R.PAS_MAX_PAR_IMAGE);

  accumulateur += ecoule;
  let pas = 0;
  while (accumulateur >= R.PAS_SIMULATION && pas < R.PAS_MAX_PAR_IMAGE) {
    jeu.pas(R.PAS_SIMULATION);
    accumulateur -= R.PAS_SIMULATION;
    pas++;
  }

  jeu.rendu(ecoule);
  rendu.render(scene, camera);
}

ui.afficherMenu();
brancherPiloteAuto({ jeu, commandes, ui, sons, camera });
requestAnimationFrame(boucle);
