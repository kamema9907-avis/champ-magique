/**
 * Les trois facons de se deplacer, actives en meme temps.
 *
 *  - Tactile : joystick virtuel flottant, ne la ou le pouce se pose.
 *  - Souris  : un clic fait marcher vers le curseur, un autre arrete (bascule).
 *  - Fleches : 8 directions.
 *
 * Le mode est detecte a l'execution : le premier evenement tactile bascule en
 * mode tactile et cache l'anneau de la souris, une souris ou une fleche revient
 * en mode PC. Aucun reglage, aucun menu.
 */

import * as THREE from 'three';
import * as R from './reglages.js';

const PLAN_SOL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function creerCommandes({ canvas, camera, scene }) {
  const touches = new Set();
  let mode = 'pc';

  // --- Tactile ------------------------------------------------------------
  // Un seul doigt commande : le PREMIER pose, et lui seul, jusqu'a ce qu'il se
  // leve. Sinon un pouce oublie sur le bord de l'iPad figerait le personnage.
  let doigt = null;   // { id, origineX, origineY, x, y }

  const elementJoystick = document.createElement('div');
  elementJoystick.id = 'joystick';
  elementJoystick.innerHTML = '<div id="joystick-anneau"></div><div id="joystick-bouton"></div>';
  document.getElementById('interface').appendChild(elementJoystick);
  const anneau = elementJoystick.querySelector('#joystick-anneau');
  const bouton = elementJoystick.querySelector('#joystick-bouton');

  // --- Souris -------------------------------------------------------------
  let sourisActive = false;
  const souris = new THREE.Vector2(0, 0);
  let sourisDansLaPage = false;
  const rayon = new THREE.Raycaster();
  const pointSol = new THREE.Vector3();
  let pointSolValide = false;

  // Anneau pose au sol sous le curseur. Une commande a bascule n'est utilisable
  // que si son etat se voit : vert = il marche, gris = il est arrete.
  const curseur = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  curseur.rotation.x = -Math.PI / 2;
  curseur.position.y = 0.06;
  curseur.visible = false;
  scene.add(curseur);

  function majPointSol() {
    if (!sourisDansLaPage) { pointSolValide = false; return; }
    rayon.setFromCamera(souris, camera);
    pointSolValide = rayon.ray.intersectPlane(PLAN_SOL, pointSol) !== null;
  }

  // --- Ecouteurs ----------------------------------------------------------

  function surPointerDown(e) {
    if (e.pointerType === 'touch') {
      mode = 'tactile';
      if (doigt === null) {
        doigt = { id: e.pointerId, origineX: e.clientX, origineY: e.clientY, x: e.clientX, y: e.clientY };
      }
      return;
    }
    mode = 'pc';
    if (e.button === 0) sourisActive = !sourisActive;   // bascule
  }

  function surPointerMove(e) {
    if (e.pointerType === 'touch') {
      if (doigt && e.pointerId === doigt.id) { doigt.x = e.clientX; doigt.y = e.clientY; }
      return;
    }
    mode = 'pc';
    sourisDansLaPage = true;
    souris.x = (e.clientX / window.innerWidth) * 2 - 1;
    souris.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function surPointerUp(e) {
    if (doigt && e.pointerId === doigt.id) doigt = null;
  }

  canvas.addEventListener('pointerdown', surPointerDown);
  window.addEventListener('pointermove', surPointerMove);
  window.addEventListener('pointerup', surPointerUp);
  window.addEventListener('pointercancel', surPointerUp);
  window.addEventListener('blur', () => { doigt = null; touches.clear(); });

  window.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow')) { touches.add(e.key); mode = 'pc'; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => touches.delete(e.key));

  // --- Calcul de la direction --------------------------------------------

  const resultat = { x: 0, z: 0, facteur: 0 };

  function direction(positionJoueur) {
    resultat.x = 0; resultat.z = 0; resultat.facteur = 0;

    // 1. Les fleches sont prioritaires : un reflexe deja acquis ne doit jamais
    //    etre contredit par la position du curseur ou d'un doigt.
    const fx = (touches.has('ArrowRight') ? 1 : 0) - (touches.has('ArrowLeft') ? 1 : 0);
    const fz = (touches.has('ArrowUp') ? 1 : 0) - (touches.has('ArrowDown') ? 1 : 0);
    if (fx !== 0 || fz !== 0) {
      const norme = Math.hypot(fx, fz);
      resultat.x = fx / norme; resultat.z = fz / norme; resultat.facteur = 1;
      return resultat;
    }

    // 2. Le joystick tactile. L'ecart du pouce par rapport a son point de depart
    //    donne la direction ET la vitesse. L'ecran etant en Y vers le bas et le
    //    monde en Z vers le fond, l'axe vertical s'inverse.
    if (doigt) {
      const dx = doigt.x - doigt.origineX;
      const dy = doigt.y - doigt.origineY;
      const ecart = Math.hypot(dx, dy);
      if (ecart > R.ZONE_MORTE_JOYSTICK) {
        const facteur = Math.min(1, (ecart - R.ZONE_MORTE_JOYSTICK) /
                                    (R.RAYON_JOYSTICK - R.ZONE_MORTE_JOYSTICK));
        resultat.x = dx / ecart; resultat.z = -dy / ecart; resultat.facteur = facteur;
      }
      return resultat;
    }

    // 3. La souris, si la bascule est enclenchee.
    if (sourisActive && pointSolValide) {
      const dx = pointSol.x - positionJoueur.x;
      const dz = pointSol.z - positionJoueur.z;
      const distance = Math.hypot(dx, dz);
      if (distance > R.ZONE_MORTE_SOURIS) {
        // Vitesse progressive pres du personnage : sans cela il tremble des que
        // le curseur le frole.
        const facteur = Math.min(1, (distance - R.ZONE_MORTE_SOURIS) /
                                    (R.RAMPE_SOURIS - R.ZONE_MORTE_SOURIS));
        resultat.x = dx / distance; resultat.z = dz / distance; resultat.facteur = facteur;
      }
    }
    return resultat;
  }

  function majVisuels(enJeu) {
    majPointSol();

    // Anneau au sol : seulement en mode PC, et seulement pendant la partie.
    const montrerCurseur = enJeu && mode === 'pc' && pointSolValide;
    curseur.visible = montrerCurseur;
    if (montrerCurseur) {
      curseur.position.set(pointSol.x, 0.06, pointSol.z);
      curseur.material.color.setHex(sourisActive ? 0x5cff82 : 0xe6e6e6);
      curseur.material.opacity = sourisActive ? 0.95 : 0.6;
      const taille = sourisActive ? 1.0 : 0.7;
      curseur.scale.setScalar(taille);
    }

    // Joystick : seulement en mode tactile, et seulement si un doigt est pose.
    if (enJeu && mode === 'tactile' && doigt) {
      elementJoystick.style.display = 'block';
      anneau.style.left = `${doigt.origineX}px`;
      anneau.style.top = `${doigt.origineY}px`;
      const dx = doigt.x - doigt.origineX;
      const dy = doigt.y - doigt.origineY;
      const ecart = Math.hypot(dx, dy);
      // Le bouton est bride au bord de l'anneau : c'est ce qui APPREND a l'enfant
      // jusqu'ou pousser pour aller a fond, sans un mot d'explication.
      const limite = Math.min(1, R.RAYON_JOYSTICK / (ecart || 1));
      bouton.style.left = `${doigt.origineX + dx * limite}px`;
      bouton.style.top = `${doigt.origineY + dy * limite}px`;
    } else {
      elementJoystick.style.display = 'none';
    }
  }

  return {
    direction,
    majVisuels,
    get mode() { return mode; },
    get sourisActive() { return sourisActive; },
    reinitialiser() { sourisActive = false; doigt = null; touches.clear(); },
    // Points d'entree utilises par le pilote automatique et les tests.
    _test: {
      forcerFleches(liste) { touches.clear(); liste.forEach((t) => touches.add(t)); },
      etatSouris() { return { sourisActive, pointSolValide, pointSol: pointSol.clone() }; },
      doigtPose() { return doigt !== null; },
    },
  };
}
