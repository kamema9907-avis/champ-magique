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
// Legumes (tableaux 5-8).
const MAT_CAROTTE = mat(COULEURS.carotte);
const MAT_AUBERGINE = mat(COULEURS.aubergine);
const MAT_MAIS = mat(COULEURS.mais);
const MAT_POIVRON = mat(COULEURS.poivron);
const MAT_CITROUILLE = mat(COULEURS.citrouille);
const MAT_LEGUME_FEUILLE = mat(COULEURS.legumeFeuille);
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

// --- Legumes (tableaux 5-8) ------------------------------------------------
// Memes principes que les fleurs : geometries fusionnees, calculees une fois.

function geometrieCarotte() {
  const corps = new THREE.ConeGeometry(0.2, 0.6, 8);
  corps.rotateX(Math.PI);            // pointe vers le bas, comme une carotte plantee
  corps.translate(0, 0.35, 0);
  const fanes = [];
  for (let a = 0; a < 360; a += 120) {
    const rad = THREE.MathUtils.degToRad(a);
    const fane = new THREE.ConeGeometry(0.05, 0.32, 5);
    fane.rotateZ(0.25 * Math.sin(rad));
    fane.rotateX(0.25 * Math.cos(rad));
    fane.translate(Math.sin(rad) * 0.07, 0.75, Math.cos(rad) * 0.07);
    fanes.push(fane);
  }
  return [[corps, MAT_CAROTTE], [BufferGeometryUtils.mergeGeometries(fanes), MAT_LEGUME_FEUILLE]];
}

function geometrieAubergine() {
  const corps = new THREE.SphereGeometry(0.28, 12, 10);
  corps.scale(1, 1.5, 1);
  corps.translate(0, 0.44, 0);
  const calice = new THREE.ConeGeometry(0.18, 0.12, 8);
  calice.translate(0, 0.8, 0);
  const tige = new THREE.CylinderGeometry(0.04, 0.04, 0.14, 6);
  tige.translate(0, 0.92, 0);
  return [[corps, MAT_AUBERGINE],
          [BufferGeometryUtils.mergeGeometries([calice, tige]), MAT_LEGUME_FEUILLE]];
}

function geometrieMais() {
  const epi = new THREE.CylinderGeometry(0.15, 0.13, 0.7, 10);
  epi.translate(0, 0.5, 0);
  const feuilles = [];
  for (const cote of [-1, 1]) {
    const f = new THREE.SphereGeometry(0.5, 6, 6);
    f.scale(0.1, 0.45, 0.05);
    f.rotateZ(THREE.MathUtils.degToRad(12 * cote));
    f.translate(0.17 * cote, 0.44, 0);
    feuilles.push(f);
  }
  return [[epi, MAT_MAIS], [BufferGeometryUtils.mergeGeometries(feuilles), MAT_LEGUME_FEUILLE]];
}

function geometriePoivron() {
  const corps = new THREE.SphereGeometry(0.3, 12, 10);
  corps.scale(1, 0.95, 1);
  corps.translate(0, 0.34, 0);
  const tige = new THREE.CylinderGeometry(0.05, 0.06, 0.14, 6);
  tige.translate(0, 0.62, 0);
  return [[corps, MAT_POIVRON], [tige, MAT_LEGUME_FEUILLE]];
}

function geometrieCitrouille() {
  const corps = new THREE.SphereGeometry(0.42, 12, 10);
  corps.scale(1, 0.72, 1);
  corps.translate(0, 0.32, 0);
  const tige = new THREE.CylinderGeometry(0.05, 0.07, 0.16, 6);
  tige.translate(0, 0.6, 0);
  return [[corps, MAT_CITROUILLE], [tige, MAT_LEGUME_FEUILLE]];
}

const GEO_CAROTTE = geometrieCarotte();
const GEO_AUBERGINE = geometrieAubergine();
const GEO_MAIS = geometrieMais();
const GEO_POIVRON = geometriePoivron();
const GEO_CITROUILLE = geometrieCitrouille();

const batiLegume = (geo, echelle) => () => {
  const groupe = new THREE.Group();
  groupe.add(fusionner(geo));
  groupe.scale.setScalar(echelle);
  return groupe;
};

/** nom, points, poids de tirage, constructeur, couleur (pastille de legende). */
export const TYPES_PLANTES = [
  { nom: 'Mousse-bleue', points: 1, poids: 50, bati: batiMousse, couleur: COULEURS.mousse },
  { nom: 'Épi doré', points: 3, poids: 28, bati: batiEpi, couleur: COULEURS.epi },
  { nom: 'Trompette pourpre', points: 5, poids: 15, bati: batiTrompette, couleur: COULEURS.violet },
  { nom: 'Étoile-de-feu', points: 10, poids: 7, bati: batiEtoile, couleur: COULEURS.orange },
];

// Les tableaux 5-8 recoltent des legumes au lieu des fleurs.
export const TYPES_LEGUMES = [
  { nom: 'Carotte', points: 1, poids: 45, bati: batiLegume(GEO_CAROTTE, 1.25), couleur: COULEURS.carotte },
  { nom: 'Aubergine', points: 2, poids: 25, bati: batiLegume(GEO_AUBERGINE, 1.2), couleur: COULEURS.aubergine },
  { nom: 'Maïs', points: 3, poids: 15, bati: batiLegume(GEO_MAIS, 1.2), couleur: COULEURS.mais },
  { nom: 'Poivron', points: 5, poids: 10, bati: batiLegume(GEO_POIVRON, 1.3), couleur: COULEURS.poivron },
  { nom: 'Citrouille', points: 10, poids: 5, bati: batiLegume(GEO_CITROUILLE, 1.3), couleur: COULEURS.citrouille },
];

export const TYPE_CRISTAL = {
  nom: 'Cristal-lune', points: 25, poids: 0, bati: batiCristal, couleur: COULEURS.cyan };

/** Le jeu de recoltes du tableau : fleurs (1-4) ou legumes (5-8). */
export function typesDuTableau(tableau) {
  return tableau >= 5 ? TYPES_LEGUMES : TYPES_PLANTES;
}

/** Tire une recolte au hasard selon les poids, dans le jeu du tableau. */
export function typeAuHasard(tableau = 1) {
  const types = typesDuTableau(tableau);
  const total = types.reduce((somme, t) => somme + t.poids, 0);
  let tirage = Math.random() * total;
  for (const type of types) {
    tirage -= type.poids;
    if (tirage <= 0) return type;
  }
  return types[0];
}
