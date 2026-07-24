/**
 * Fabrique de materiaux partagee.
 *
 * Rendu cel-shading (MeshToonMaterial + rampe de tons) PAR DEFAUT : c'est le
 * look storybook du jeu, avec les contours BD (voir contour.js). Porte de sortie
 * ?flat pour revenir au rendu doux d'origine (MeshLambertMaterial) en cas de
 * souci sur un appareil.
 */

import * as THREE from 'three';

const TOON = !new URLSearchParams(location.search).has('flat');

let rampe = null;
function rampeToon() {
  if (rampe) return rampe;
  // Quelques paliers nets de luminosite (du plus sombre au plus clair) : c'est
  // ce qui donne les aplats du cel-shading au lieu d'un degrade continu.
  const paliers = new Uint8Array([70, 130, 190, 255]);
  rampe = new THREE.DataTexture(paliers, paliers.length, 1, THREE.RedFormat);
  rampe.minFilter = rampe.magFilter = THREE.NearestFilter;
  rampe.needsUpdate = true;
  return rampe;
}

/** Materiau standard du jeu. `extra` : side, emissive, flatShading, transparent, opacity... */
export function mat(couleur, extra = {}) {
  if (TOON) return new THREE.MeshToonMaterial({ color: couleur, gradientMap: rampeToon(), ...extra });
  return new THREE.MeshLambertMaterial({ color: couleur, ...extra });
}

export const estToon = () => TOON;
