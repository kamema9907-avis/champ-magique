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
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const params = new URLSearchParams(location.search);

const canvas = document.getElementById('scene');
const rendu = new THREE.WebGLRenderer({ canvas, antialias: true });
rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // au-dela, on paie sans rien voir
rendu.shadowMap.enabled = true;
rendu.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft est deprecie depuis three 0.185

const { scene, camera, sol, feuillage, reliefSol, majCiel } = creerMonde();
const commandes = creerCommandes({ canvas, camera, scene });
const sons = creerSons();
const ui = creerInterface({ surDemarrage: () => demarrer() });
const jeu = creerJeu({ scene, camera, commandes, sons, ui, sol, feuillage, reliefSol, majCiel });

// Post-traitement (bloom + antialiasing SMAA + sortie sRGB). Desactive sous ?test
// (halo couteux -> tests plus rapides et rendu deterministe), sauf si ?post force
// l'activation (pour previsualiser/deboguer le post-traitement en mode test).
let composer = null;
if (!params.has('test') || params.has('post')) {
  composer = new EffectComposer(rendu);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    R.BLOOM_INTENSITE, R.BLOOM_RAYON, R.BLOOM_SEUIL));
  composer.addPass(new SMAAPass(window.innerWidth, window.innerHeight));
  composer.addPass(new OutputPass());
}

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
  if (composer) composer.setSize(l, h);
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
  if (composer) composer.render(); else rendu.render(scene, camera);

  majFps(maintenant);
}

// Overlay FPS de developpement, active par ?fps : sert a mesurer l'impact du
// post-traitement sur le vrai iPad avant de garder ou d'alleger.
let boiteFps = null, imagesFps = 0, dernierFps = performance.now();
if (params.has('fps')) {
  boiteFps = document.createElement('div');
  boiteFps.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;'
    + 'background:rgba(0,0,0,.6);color:#7dff9b;font:14px monospace;padding:4px 8px;pointer-events:none';
  document.body.appendChild(boiteFps);
}
function majFps(maintenant) {
  if (!boiteFps) return;
  imagesFps++;
  if (maintenant - dernierFps >= 500) {
    boiteFps.textContent = Math.round((imagesFps * 1000) / (maintenant - dernierFps)) + ' FPS';
    imagesFps = 0;
    dernierFps = maintenant;
  }
}

ui.afficherMenu();
brancherPiloteAuto({ jeu, commandes, ui, sons, camera });
requestAnimationFrame(boucle);
