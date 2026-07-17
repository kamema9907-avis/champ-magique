/**
 * Les cinq plantes du champ.
 *
 * Deux principes de performance, appliques une fois pour toutes ici :
 *  - les geometries et les materiaux sont crees UNE SEULE FOIS et partages par
 *    les 120 plantes (en Python, chaque plante recreait ses maillages) ;
 *  - les morceaux immobiles d'une espece sont fusionnes en une seule geometrie,
 *    donc une plante coute un objet a l'affichage, pas quatre.
 * Les parties qui tournent restent separees, forcement.
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { COULEURS } from './reglages.js';

const mat = (couleur) => new THREE.MeshLambertMaterial({ color: couleur });

const MAT_TIGE = mat(COULEURS.tige);
const MAT_MOUSSE = mat(COULEURS.mousse);
const MAT_EPI = mat(COULEURS.epi);
// Double face obligatoire : le cornet est un cone RETOURNE et ouvert, donc on en
// voit l'interieur. Sans cela il s'affiche en dard sombre au lieu d'un cornet.
const MAT_VIOLET = new THREE.MeshLambertMaterial({ color: COULEURS.violet, side: THREE.DoubleSide });
const MAT_FEUILLE = mat(COULEURS.feuille);
const MAT_ORANGE = mat(COULEURS.orange);
const MAT_CYAN = new THREE.MeshBasicMaterial({ color: COULEURS.cyan });   // lumineux
const MAT_HALO = new THREE.MeshBasicMaterial({
  color: COULEURS.cyan, transparent: true, opacity: 0.16,
  side: THREE.DoubleSide, depthWrite: false,   // sans cela, le halo masque le cristal
});

/** Fusionne des [geometrie, materiau] en un seul maillage a materiaux multiples. */
function fusionner(morceaux) {
  const geometries = morceaux.map((m) => m[0]);
  const materiaux = morceaux.map((m) => m[1]);
  const geometrie = BufferGeometryUtils.mergeGeometries(geometries, true);
  const maille = new THREE.Mesh(geometrie, materiaux);
  maille.castShadow = true;
  return maille;
}

function place(geometrie, x, y, z) {
  geometrie.translate(x, y, z);
  return geometrie;
}

// --- Geometries fusionnees, calculees une fois au chargement ---------------

function geometrieMousse() {
  // Une grappe de boules basses.
  const boules = [[0, 0.26, 0, 0.26], [0.3, 0.18, 0.16, 0.18],
                  [-0.28, 0.16, -0.13, 0.16], [0.1, 0.14, -0.3, 0.14]];
  const geos = boules.map(([x, y, z, r]) =>
    place(new THREE.SphereGeometry(r, 10, 8), x, y, z));
  return [[BufferGeometryUtils.mergeGeometries(geos), MAT_MOUSSE]];
}

function geometrieEpi() {
  // Une haute tige fine surmontee d'un epi.
  const tige = place(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), 0, 0.5, 0);

  const grain = new THREE.SphereGeometry(0.5, 10, 8);
  grain.scale(0.36, 0.7, 0.36);
  grain.translate(0, 1.22, 0);
  const grains = [grain];
  for (const cote of [-1, 1]) {
    const petit = new THREE.SphereGeometry(0.5, 8, 6);
    petit.scale(0.16, 0.32, 0.16);
    petit.rotateZ(THREE.MathUtils.degToRad(25 * cote));
    petit.translate(0.16 * cote, 0.88, 0);
    grains.push(petit);
  }
  return [[tige, MAT_TIGE], [BufferGeometryUtils.mergeGeometries(grains), MAT_EPI]];
}

function geometrieTrompette() {
  // Une tige verte et un cone ouvert vers le ciel.
  const tige = place(new THREE.CylinderGeometry(0.045, 0.045, 0.78, 6), 0, 0.39, 0);
  const feuille = new THREE.SphereGeometry(0.5, 8, 6);
  feuille.scale(0.36, 0.06, 0.16);
  feuille.rotateZ(THREE.MathUtils.degToRad(-20));
  feuille.translate(0.22, 0.3, 0);
  // Cone retourne : la pointe descend, l'ouverture regarde le ciel.
  const trompe = new THREE.ConeGeometry(0.42, 0.7, 14, 1, true);
  trompe.rotateX(Math.PI);
  trompe.translate(0, 0.75, 0);
  return [[BufferGeometryUtils.mergeGeometries([tige, feuille]), MAT_TIGE],
          [trompe, MAT_VIOLET]];
}

const GEO_MOUSSE = geometrieMousse();
const GEO_EPI = geometrieEpi();
const GEO_TROMPETTE = geometrieTrompette();
const GEO_TIGE_ETOILE = place(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 5), 0, 0.275, 0);
const GEO_DIAMANT = new THREE.OctahedronGeometry(0.5);
const GEO_HALO = new THREE.SphereGeometry(1.3, 12, 10);

// --- Constructeurs --------------------------------------------------------

function batiMousse() {
  const groupe = new THREE.Group();
  groupe.add(fusionner(GEO_MOUSSE));
  groupe.scale.setScalar(1.35);
  return groupe;
}

function batiEpi() {
  const groupe = new THREE.Group();
  groupe.add(fusionner(GEO_EPI));
  groupe.scale.setScalar(1.3);
  return groupe;
}

function batiTrompette() {
  const groupe = new THREE.Group();
  groupe.add(fusionner(GEO_TROMPETTE));
  groupe.scale.setScalar(1.3);
  return groupe;
}

function batiEtoile() {
  const groupe = new THREE.Group();
  const tige = new THREE.Mesh(GEO_TIGE_ETOILE, MAT_TIGE);
  tige.castShadow = true;
  groupe.add(tige);

  // Etoile en vraie 3D : trois losanges croises selon les trois axes. Une etoile
  // plate obligerait a l'incliner pile face a la camera et disparaitrait sur la
  // tranche au moindre ecart (bug constate sur la version Python).
  const rotor = new THREE.Group();
  rotor.position.y = 1.0;
  for (const rotation of [[0, 0, 0], [0, 0, Math.PI / 2], [Math.PI / 2, 0, 0]]) {
    const branche = new THREE.Mesh(GEO_DIAMANT, MAT_ORANGE);
    branche.scale.set(0.22, 0.95, 0.22);
    branche.rotation.set(...rotation);
    branche.castShadow = true;
    rotor.add(branche);
  }
  groupe.add(rotor);
  groupe.scale.setScalar(1.3);
  groupe.userData.rotor = rotor;
  groupe.userData.vitesseRotation = THREE.MathUtils.degToRad(110);
  return groupe;
}

function batiCristal() {
  const groupe = new THREE.Group();
  const corps = new THREE.Mesh(GEO_DIAMANT, MAT_CYAN);
  corps.scale.set(0.6, 1.0, 0.6);
  corps.position.y = 1.1;
  groupe.add(corps);

  const halo = new THREE.Mesh(GEO_HALO, MAT_HALO);
  halo.position.y = 1.1;
  groupe.add(halo);

  groupe.scale.setScalar(1.3);
  groupe.userData.rotor = corps;
  groupe.userData.halo = halo;
  groupe.userData.vitesseRotation = THREE.MathUtils.degToRad(70);
  return groupe;
}

/** nom, points, poids de tirage, constructeur. */
export const TYPES_PLANTES = [
  { nom: 'Mousse-bleue', points: 1, poids: 50, bati: batiMousse },
  { nom: 'Épi doré', points: 3, poids: 28, bati: batiEpi },
  { nom: 'Trompette pourpre', points: 5, poids: 15, bati: batiTrompette },
  { nom: 'Étoile-de-feu', points: 10, poids: 7, bati: batiEtoile },
];

export const TYPE_CRISTAL = { nom: 'Cristal-lune', points: 25, poids: 0, bati: batiCristal };

const POIDS_TOTAL = TYPES_PLANTES.reduce((somme, t) => somme + t.poids, 0);

export function typeAuHasard() {
  let tirage = Math.random() * POIDS_TOTAL;
  for (const type of TYPES_PLANTES) {
    tirage -= type.poids;
    if (tirage <= 0) return type;
  }
  return TYPES_PLANTES[0];
}
