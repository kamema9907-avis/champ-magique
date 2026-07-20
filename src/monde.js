/** Le decor : ciel, sol, cloture d'arbres, lumieres et camera. */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import * as R from './reglages.js';

/**
 * Ouverture VERTICALE a donner a la camera pour que la largeur de champ visible
 * reste constante quelle que soit la forme de l'ecran.
 *
 * Three.js raisonne en ouverture verticale ; nous voulons fixer l'horizontale.
 * Sur un ecran plus carre (iPad 4:3), cela donne une ouverture verticale plus
 * grande : on voit plus haut et plus bas, mais autant sur les cotes.
 */
export function ouvertureVerticale(rapport) {
  const demiHorizontale = THREE.MathUtils.degToRad(R.OUVERTURE_HORIZONTALE) / 2;
  const demiVerticale = Math.atan(Math.tan(demiHorizontale) / rapport);
  return THREE.MathUtils.radToDeg(demiVerticale * 2);
}

function batirArbres() {
  // Les 68 arbres ne bougent jamais : on fusionne tout en une seule geometrie,
  // donc un seul appel de rendu au lieu de 136. C'est gratuit, autant le faire.
  const troncs = [];
  const feuillages = [];
  const nbParCote = Math.floor(R.TAILLE_CHAMP / 3) + 1;
  const pas = R.TAILLE_CHAMP / (nbParCote - 1);

  const positions = [];
  for (let i = 0; i < nbParCote; i++) {
    const d = -R.DEMI_CHAMP + i * pas;
    positions.push([d, -R.DEMI_CHAMP], [d, R.DEMI_CHAMP],
                   [-R.DEMI_CHAMP, d], [R.DEMI_CHAMP, d]);
  }

  for (const [x, z] of positions) {
    const hauteur = 1.6 + Math.random() * 1.0;
    const rayonFeuillage = (1.5 + Math.random() * 0.8) / 2;

    const tronc = new THREE.CylinderGeometry(0.22, 0.22, hauteur, 6);
    tronc.translate(x, hauteur / 2, z);
    troncs.push(tronc);

    const feuillage = new THREE.SphereGeometry(rayonFeuillage, 10, 8);
    feuillage.translate(x, hauteur + 0.5, z);
    feuillages.push(feuillage);
  }

  const groupe = new THREE.Group();
  groupe.add(new THREE.Mesh(
    BufferGeometryUtils.mergeGeometries(troncs),
    new THREE.MeshLambertMaterial({ color: R.COULEURS.brun })));
  groupe.add(new THREE.Mesh(
    BufferGeometryUtils.mergeGeometries(feuillages),
    new THREE.MeshLambertMaterial({ color: R.COULEURS.feuille })));

  for (const maille of groupe.children) {
    maille.castShadow = true;
    maille.receiveShadow = true;
  }
  return groupe;
}

export function creerMonde() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(R.COULEURS.ciel);

  // Le sol deborde tres largement l'aire de jeu : sinon, quand le joueur longe
  // le bord sud, la camera (placee derriere lui) filme au-dela du plan et on
  // voit le vide. Bug constate en jouant sur la version Python.
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(R.TAILLE_SOL, R.TAILLE_SOL),
    new THREE.MeshLambertMaterial({ color: R.COULEURS.sol }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);

  const arbres = batirArbres();
  scene.add(arbres);

  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x5aa02c, 1.1));

  const soleil = new THREE.DirectionalLight(0xfff6e0, 1.5);
  soleil.position.set(30, 48, 18);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  // Le cadrage des ombres doit couvrir l'aire de jeu, pas plus : plus il est
  // large, plus les ombres deviennent grossieres a resolution egale.
  const c = soleil.shadow.camera;
  c.left = -R.DEMI_CHAMP - 4;
  c.right = R.DEMI_CHAMP + 4;
  c.top = R.DEMI_CHAMP + 4;
  c.bottom = -R.DEMI_CHAMP - 4;
  c.near = 1;
  c.far = 120;
  c.updateProjectionMatrix();
  soleil.shadow.bias = -0.0012;
  scene.add(soleil);
  scene.add(soleil.target);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 260);
  camera.position.set(R.DECALAGE_CAMERA.x, R.DECALAGE_CAMERA.y, R.DECALAGE_CAMERA.z);
  // On vise le joueur UNE SEULE FOIS, a l'origine, pour figer l'orientation.
  // Ensuite on ne deplacera plus que la position : le decalage etant constant,
  // l'orientation reste juste, et la camera ne tourne jamais.
  camera.lookAt(0, 0, 0);

  // Le feuillage (2e enfant du groupe : troncs d'abord, feuilles ensuite) est
  // renvoye pour pouvoir le re-teinter selon le tableau.
  return { scene, camera, soleil, sol, feuillage: arbres.children[1].material };
}
