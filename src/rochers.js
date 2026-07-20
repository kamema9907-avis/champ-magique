/** Les petits rochers du tableau 2 : de simples obstacles a contourner. */

import * as THREE from 'three';
import { COULEURS } from './reglages.js';

// Un seul materiau partage pour tous les rochers : c'est gratuit, autant le faire.
// flatShading donne des facettes nettes, un rendu de caillou plutot que de boule.
const MAT_ROCHER = new THREE.MeshLambertMaterial({ color: COULEURS.rocher, flatShading: true });

/**
 * Un rocher gris et trapu. `rayon` fixe sa taille au sol ; il est aplati en
 * hauteur (un caillou pose, pas un bloc). Rotation au hasard pour que deux
 * rochers ne se ressemblent pas.
 */
export function batiRocher(rayon) {
  const rocher = new THREE.Mesh(new THREE.DodecahedronGeometry(rayon), MAT_ROCHER);
  rocher.scale.y = 0.6;
  rocher.rotation.y = Math.random() * Math.PI * 2;
  rocher.position.y = rayon * 0.25;   // legerement enfonce dans le sol
  rocher.castShadow = true;
  rocher.receiveShadow = true;
  rocher.userData = { rayon };
  return rocher;
}
