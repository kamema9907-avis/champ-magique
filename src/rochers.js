/**
 * Les obstacles a contourner, un modele par tableau : rochers (2), glace (3),
 * lave (4), caisses (5), ruches (6), menhirs (7), gemmes (8). Tous partagent le
 * meme systeme de collision (un cercle de rayon donne) ; seul l'aspect change.
 */

import * as THREE from 'three';
import { COULEURS } from './reglages.js';
import { mat } from './materiaux.js';

// Materiaux partages (un seul par type, c'est gratuit). flatShading donne des
// facettes nettes, un rendu mineral plutot que lisse.
const MAT_ROCHER = mat(COULEURS.rocher, { flatShading: true });
const MAT_GLACE = mat(COULEURS.glace, { flatShading: true, transparent: true, opacity: 0.85 });
const MAT_LAVE = mat(COULEURS.lave, { emissive: COULEURS.laveLueur, flatShading: true });
// Obstacles thematiques des tableaux 5-8.
const MAT_CAISSE = mat(COULEURS.caisse, { flatShading: true });
const MAT_RUCHE = mat(COULEURS.ruche, { emissive: COULEURS.rucheLueur, flatShading: true });
const MAT_MENHIR = mat(COULEURS.menhir, { flatShading: true });
const MAT_GEMME = mat(COULEURS.gemme, { emissive: COULEURS.gemmeLueur, flatShading: true });

/** Pose un obstacle sur le sol : aplatissement, rotation au hasard, ombres. */
function poser(mesh, rayon, aplati) {
  mesh.scale.y = aplati;
  mesh.rotation.y = Math.random() * Math.PI * 2;
  mesh.position.y = rayon * 0.25;   // legerement enfonce dans le sol
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { rayon };
  return mesh;
}

/** Un rocher gris et trapu (tableau 2). */
export function batiRocher(rayon) {
  return poser(new THREE.Mesh(new THREE.DodecahedronGeometry(rayon), MAT_ROCHER), rayon, 0.6);
}

/** Un bloc de glace bleute et anguleux, plus haut qu'un rocher (tableau 3). */
export function batiGlace(rayon) {
  return poser(new THREE.Mesh(new THREE.IcosahedronGeometry(rayon, 0), MAT_GLACE), rayon, 0.9);
}

/** Un rocher de lave sombre a la lueur d'ember (tableau 4). */
export function batiLave(rayon) {
  return poser(new THREE.Mesh(new THREE.DodecahedronGeometry(rayon), MAT_LAVE), rayon, 0.6);
}

/** Une caisse en bois (tableau 5, Le Potager Enchante). */
export function batiCaisse(rayon) {
  const c = rayon * 1.5;
  return poser(new THREE.Mesh(new THREE.BoxGeometry(c, c * 0.85, c), MAT_CAISSE), rayon, 1);
}

/** Une ruche en dome (tableau 6, Les Champs de Miel). */
export function batiRuche(rayon) {
  return poser(new THREE.Mesh(new THREE.ConeGeometry(rayon, rayon * 1.4, 12), MAT_RUCHE), rayon, 1);
}

/** Un menhir, pierre dressee plus haute que large (tableau 7, Le Jardin Nocturne). */
export function batiMenhir(rayon) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(rayon * 0.9, rayon * 2.6, rayon * 0.7), MAT_MENHIR);
  m.rotation.z = (Math.random() - 0.5) * 0.12;   // legerement penche
  return poser(m, rayon, 1);
}

/** Une gemme anguleuse et lumineuse (tableau 8, La Vallee Arc-en-ciel). */
export function batiGemme(rayon) {
  return poser(new THREE.Mesh(new THREE.OctahedronGeometry(rayon * 1.05, 0), MAT_GEMME), rayon, 1.4);
}

/** L'obstacle correspondant au tableau (rocher par defaut). */
export function batiObstacle(tableau, rayon) {
  if (tableau === 3) return batiGlace(rayon);
  if (tableau === 4) return batiLave(rayon);
  if (tableau === 5) return batiCaisse(rayon);
  if (tableau === 6) return batiRuche(rayon);
  if (tableau === 7) return batiMenhir(rayon);
  if (tableau === 8) return batiGemme(rayon);
  return batiRocher(rayon);
}
