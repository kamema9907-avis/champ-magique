/**
 * Les obstacles a contourner, un modele par tableau : rochers (tableau 2), blocs
 * de glace (tableau 3), rochers de lave (tableau 4). Tous partagent le meme
 * systeme de collision (un cercle de rayon donne) ; seul l'aspect change.
 */

import * as THREE from 'three';
import { COULEURS } from './reglages.js';

// Materiaux partages (un seul par type, c'est gratuit). flatShading donne des
// facettes nettes, un rendu mineral plutot que lisse.
const MAT_ROCHER = new THREE.MeshLambertMaterial({ color: COULEURS.rocher, flatShading: true });
const MAT_GLACE = new THREE.MeshLambertMaterial({
  color: COULEURS.glace, flatShading: true, transparent: true, opacity: 0.85 });
const MAT_LAVE = new THREE.MeshLambertMaterial({
  color: COULEURS.lave, emissive: COULEURS.laveLueur, flatShading: true });

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

/** L'obstacle correspondant au tableau (rocher par defaut). */
export function batiObstacle(tableau, rayon) {
  if (tableau === 3) return batiGlace(rayon);
  if (tableau === 4) return batiLave(rayon);
  return batiRocher(rayon);
}
