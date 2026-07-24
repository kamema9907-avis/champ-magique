/** Le decor : ciel, sol, cloture d'arbres, lumieres et camera. */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import * as R from './reglages.js';
import { mat } from './materiaux.js';

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
    BufferGeometryUtils.mergeGeometries(troncs), mat(R.COULEURS.brun)));
  groupe.add(new THREE.Mesh(
    BufferGeometryUtils.mergeGeometries(feuillages), mat(R.COULEURS.feuille)));

  for (const maille of groupe.children) {
    maille.castShadow = true;
    maille.receiveShadow = true;
  }
  return groupe;
}

/**
 * Textures procedurales pour le sol du tableau 2, generees une seule fois et
 * sans aucun fichier externe :
 *  - `bump`    : un bruit applique en bumpMap ou le soleil accroche des ombres,
 *                pour un relief caillouteux SANS changer la geometrie (les
 *                personnages se deplacent a plat, y = 0 : de vraies bosses les
 *                feraient flotter au-dessus des creux) ;
 *  - `couleur` : une variation de teinte douce (taches de terre plus claires ou
 *                plus sombres) qui se lit tout de suite comme de la texture,
 *                quel que soit l'angle de la lumiere.
 * Les deux se raccordent sur elles-memes (pavage sans couture).
 */
function genererTexturesSol() {
  const T = 512;
  const hasard = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  // Bruit "valeur" periodique : les indices de grille bouclent, donc les bords
  // de la texture se raccordent et le pavage ne laisse aucune couture visible.
  const octave = (x, y, cellule) => {
    const periode = T / cellule;
    const gx = x / cellule, gy = y / cellule;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const ax = x0 % periode, ay = y0 % periode;
    const bx = (x0 + 1) % periode, by = (y0 + 1) % periode;
    const a = hasard(ax, ay), b = hasard(bx, ay);
    const c = hasard(ax, by), d = hasard(bx, by);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };

  const bump = document.createElement('canvas');
  const couleur = document.createElement('canvas');
  bump.width = bump.height = couleur.width = couleur.height = T;
  const imgBump = bump.getContext('2d').createImageData(T, T);
  const imgCoul = couleur.getContext('2d').createImageData(T, T);

  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      // Grandes ondulations + relief moyen + grain fin.
      const n = octave(x, y, 128) * 0.5 + octave(x, y, 32) * 0.3 + octave(x, y, 16) * 0.2;
      const i = (y * T + x) * 4;
      // Relief : plein contraste, pour que le soleil accroche bien.
      const b = Math.floor(35 + n * 220);
      imgBump.data[i] = imgBump.data[i + 1] = imgBump.data[i + 2] = b;
      imgBump.data[i + 3] = 255;
      // Couleur : gris resserre (~0.72 a 1.0), multiplie la teinte du sol.
      const g = Math.floor(184 + n * 71);
      imgCoul.data[i] = imgCoul.data[i + 1] = imgCoul.data[i + 2] = g;
      imgCoul.data[i + 3] = 255;
    }
  }
  bump.getContext('2d').putImageData(imgBump, 0, 0);
  couleur.getContext('2d').putImageData(imgCoul, 0, 0);

  const finir = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 8);
    return t;
  };
  return { bump: finir(bump), couleur: finir(couleur) };
}

// Ciel en degrade : une grande sphere vue de l'interieur, avec un shader qui
// interpole entre la couleur du zenith (haut) et de l'horizon (bas). Dessine en
// premier, sans ecrire la profondeur : le reste du monde se pose par-dessus.
function creerCielDome() {
  const materiau = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      haut: { value: new THREE.Color(R.COULEURS.ciel) },
      bas: { value: new THREE.Color(R.COULEURS.ciel) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 haut;
      uniform vec3 bas;
      void main() {
        float t = pow(clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0), 0.7);
        gl_FragColor = vec4(mix(bas, haut, t), 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16), materiau);
  dome.renderOrder = -1;   // avant tout le reste
  return { dome, materiau };
}

export function creerMonde() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(R.COULEURS.ciel);

  // Ciel en degrade + brouillard lointain, tous deux re-teintables par tableau.
  const { dome, materiau: matCiel } = creerCielDome();
  scene.add(dome);
  scene.fog = new THREE.Fog(R.COULEURS.ciel, R.FOG_NEAR, R.FOG_FAR);

  /** Re-teinte le ciel et le brouillard selon la couleur de ciel d'un tableau. */
  function majCiel(hex) {
    const zenith = new THREE.Color(hex);
    const horizon = zenith.clone().lerp(new THREE.Color(0xffffff), 0.22);   // plus clair
    matCiel.uniforms.haut.value.copy(zenith);
    matCiel.uniforms.bas.value.copy(horizon);
    scene.fog.color.copy(horizon);         // le sol au loin se fond dans l'horizon
    scene.background.copy(horizon);         // filet de securite si le dome ne couvre pas
  }
  majCiel(R.COULEURS.ciel);

  // Le sol deborde tres largement l'aire de jeu : sinon, quand le joueur longe
  // le bord sud, la camera (placee derriere lui) filme au-dela du plan et on
  // voit le vide. Bug constate en jouant sur la version Python.
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(R.TAILLE_SOL, R.TAILLE_SOL),
    mat(R.COULEURS.sol));
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
  // renvoye pour pouvoir le re-teinter selon le tableau, comme le relief du sol.
  return {
    scene, camera, soleil, sol, majCiel,
    feuillage: arbres.children[1].material,
    reliefSol: genererTexturesSol(),
  };
}
