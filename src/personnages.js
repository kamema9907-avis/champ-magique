/** Le petit fermier, les Rodeurs, et le champignon bonus. */

import * as THREE from 'three';
import { COULEURS } from './reglages.js';

const mat = (couleur) => new THREE.MeshLambertMaterial({ color: couleur });

const MAT_PEAU = mat(COULEURS.peau);
const MAT_SALOPETTE = mat(COULEURS.salopette);
const MAT_PAILLE = mat(COULEURS.paille);
const MAT_ENNEMI = mat(COULEURS.ennemi);
const MAT_PIQUE = mat(COULEURS.pique);
const MAT_OEIL = mat(0xffffff);
const MAT_PUPILLE = mat(0x111111);
const MAT_CHAMP_CHAPEAU = mat(COULEURS.champignonChapeau);
const MAT_CHAMP_PIED = mat(COULEURS.champignonPied);
const MAT_CHAMP_POIS = mat(COULEURS.champignonPois);

function maille(geometrie, materiau, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometrie, materiau);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function batiJoueur() {
  const racine = new THREE.Group();

  // 'corps' regroupe tout ce qui se balance a la marche et clignote aux degats.
  const corps = new THREE.Group();
  racine.add(corps);

  const buste = maille(new THREE.CapsuleGeometry(0.25, 0.5, 4, 10), MAT_SALOPETTE, 0, 0.85, 0);
  corps.add(buste);
  corps.add(maille(new THREE.SphereGeometry(0.21, 12, 10), MAT_PEAU, 0, 1.45, 0));

  // Chapeau de paille : le bord large rend le personnage lisible vu de haut.
  corps.add(maille(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), MAT_PAILLE, 0, 1.6, 0));
  corps.add(maille(new THREE.ConeGeometry(0.24, 0.2, 12), MAT_PAILLE, 0, 1.72, 0));
  // Un petit nez sert de reperage de direction, tres utile en vue de dessus.
  corps.add(maille(new THREE.SphereGeometry(0.065, 8, 6), MAT_PEAU, 0, 1.42, 0.2));

  const geoJambe = new THREE.BoxGeometry(0.16, 0.6, 0.16);
  const geoBras = new THREE.BoxGeometry(0.13, 0.5, 0.13);

  // Les membres pivotent autour de leur HAUT : on suspend donc chaque membre a
  // un pivot place a l'epaule ou a la hanche, sinon il tournerait sur son centre
  // et le personnage aurait l'air disloque.
  const membres = [];
  const suspendre = (parent, geo, materiau, x, yPivot, longueur) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, yPivot, 0);
    parent.add(pivot);
    pivot.add(maille(geo, materiau, 0, -longueur / 2, 0));
    membres.push(pivot);
    return pivot;
  };

  suspendre(racine, geoJambe, MAT_SALOPETTE, -0.15, 0.6, 0.6);
  suspendre(racine, geoJambe, MAT_SALOPETTE, 0.15, 0.6, 0.6);
  suspendre(corps, geoBras, MAT_PEAU, 0.32, 1.2, 0.5);
  suspendre(corps, geoBras, MAT_PEAU, -0.32, 1.2, 0.5);

  racine.userData = { corps, membres, materiaux: [buste.material] };
  return racine;
}

export function batiEnnemi() {
  const racine = new THREE.Group();
  const corps = new THREE.Group();
  racine.add(corps);

  corps.add(maille(new THREE.ConeGeometry(0.55, 1.5, 8), MAT_ENNEMI, 0, 0.75, 0));

  const geoPique = new THREE.OctahedronGeometry(0.5);
  for (let angle = 0; angle < 360; angle += 60) {
    const rad = THREE.MathUtils.degToRad(angle);
    const pique = maille(geoPique, MAT_PIQUE,
      Math.sin(rad) * 0.5, 0.45, Math.cos(rad) * 0.5);
    pique.scale.set(0.1, 0.35, 0.1);
    pique.rotation.set(THREE.MathUtils.degToRad(35), rad, 0);
    corps.add(pique);
  }

  for (const cote of [-1, 1]) {
    const oeil = maille(new THREE.SphereGeometry(0.08, 8, 6), MAT_OEIL, 0.16 * cote, 1.0, 0.28);
    corps.add(oeil);
    oeil.add(maille(new THREE.SphereGeometry(0.04, 6, 6), MAT_PUPILLE, 0, 0, 0.06));
  }

  racine.userData = { corps };
  return racine;
}

export function batiChampignon() {
  const racine = new THREE.Group();
  const corps = new THREE.Group();   // ce qui sautille en se deplacant
  racine.add(corps);

  corps.add(maille(new THREE.CylinderGeometry(0.18, 0.24, 0.55, 10), MAT_CHAMP_PIED, 0, 0.28, 0));

  // Chapeau : une demi-sphere posee sur le pied.
  corps.add(maille(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                   MAT_CHAMP_CHAPEAU, 0, 0.55, 0));

  // Pois blancs sur le chapeau : la marque du champignon.
  const geoPois = new THREE.SphereGeometry(0.07, 8, 6);
  for (let angle = 0; angle < 360; angle += 72) {
    const rad = THREE.MathUtils.degToRad(angle);
    corps.add(maille(geoPois, MAT_CHAMP_POIS, Math.sin(rad) * 0.33, 0.66, Math.cos(rad) * 0.33));
  }
  corps.add(maille(geoPois, MAT_CHAMP_POIS, 0, 0.74, 0));

  // Deux petits yeux sur le pied, cote face : ca lui donne vie.
  for (const cote of [-1, 1]) {
    const oeil = maille(new THREE.SphereGeometry(0.06, 8, 6), MAT_OEIL, 0.1 * cote, 0.34, 0.19);
    corps.add(oeil);
    oeil.add(maille(new THREE.SphereGeometry(0.03, 6, 6), MAT_PUPILLE, 0, 0, 0.045));
  }

  racine.userData = { corps };
  return racine;
}
