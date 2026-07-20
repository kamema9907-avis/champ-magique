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
const HAUT = new THREE.Vector3(0, 1, 0);

export function creerCommandes({ canvas, camera, scene }) {
  const touches = new Set();
  let mode = 'pc';

  // --- Repere de l'ecran, projete au sol ----------------------------------
  // Les fleches et le joystick expriment une direction A L'ECRAN ("vers la
  // droite", "vers le fond"). Il faut la traduire en direction du monde.
  //
  // On la DEDUIT de la camera au lieu d'ecrire les signes a la main. Raison :
  // Three.js est en repere droitier, alors qu'Ursina (la version Python) est en
  // repere gaucher. Une camera placee derriere le joueur y regarde donc vers
  // +Z... mais son axe droite devient -X. Suppose "+X = a droite" et tout part
  // en miroir : c'est exactement le bug qui est remonte de l'iPad.
  // Calcule ainsi, le code reste juste meme si on deplace la camera.
  const fondEcran = new THREE.Vector3();    // vers le haut de l'ecran, au sol
  const droiteEcran = new THREE.Vector3();  // vers la droite de l'ecran, au sol

  function majRepereEcran() {
    camera.getWorldDirection(fondEcran);
    fondEcran.y = 0;
    fondEcran.normalize();
    droiteEcran.crossVectors(fondEcran, HAUT).normalize();
  }
  majRepereEcran();

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

  // --- Manette de TV (pave directionnel) ----------------------------------
  // Une telecommande de TV (ex. Firestick dans Silk) n'est ni un gamepad ni des
  // fleches : son pave deplace un CURSEUR, par a-coups purement horizontaux ou
  // verticaux. On le reconnait a cette signature (mouvements "cardinaux"), et on
  // passe alors a un controle base sur le MOUVEMENT du curseur, pas sa position :
  // pousser le pad = avancer dans ce sens, relacher = s'arreter. La position du
  // curseur devient sans importance (fini le personnage colle aux arbres).
  // Un vrai geste de souris (diagonal) desactive le mode : le PC n'est pas gene.
  let manette = false;
  let confianceManette = 0;
  let curseurPrec = null;                          // derniere position, pour le delta
  const mvtCurseur = { dx: 0, dy: 0, t: -1e9 };    // direction ecran du dernier mouvement

  // Verrouillage du pointeur (Pointer Lock) : detache le curseur des bords de
  // l'ecran, si bien que le pad continue d'envoyer des mouvements meme "au-dela"
  // du bord (fini le curseur coince au bord qui fige le personnage), et le cache.
  // On l'engage au demarrage de la partie et on le relache a la fin. S'il n'est
  // pas supporte (incertain dans Silk), on garde le mode base sur clientX/Y.
  let verrouille = false;

  function activerManette() {
    manette = true;
    document.body.style.cursor = 'none';
  }
  function desactiverManette() {
    manette = false;
    confianceManette = 0;
    document.body.style.cursor = '';
  }

  function demanderVerrouillage() {
    // Seulement pour une manette detectee : sur PC on ne capture pas la souris.
    if (manette && !verrouille && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch { /* non supporte : on garde le repli */ }
    }
  }
  function libererVerrouillage() {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }
  document.addEventListener('pointerlockchange', () => {
    verrouille = document.pointerLockElement === canvas;
    if (verrouille) activerManette();
  });
  document.addEventListener('pointerlockerror', () => { verrouille = false; });

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
    // On borne la cible a l'aire de jeu. Sinon, sur un ecran ou le curseur peut
    // pointer le ciel ou les arbres (typiquement une TV pilotee au pave
    // directionnel, qui deplace un curseur), la cible tombe tres loin hors du
    // champ : le personnage fonce vers le bord, bute sur le mur invisible et s'y
    // colle jusqu'a ce qu'on ramene le curseur dans le champ. Bornee, la cible
    // reste au pire sur le bord interieur : le personnage l'atteint et s'arrete.
    if (pointSolValide) {
      const limite = R.DEMI_CHAMP - R.MARGE_JOUEUR;
      pointSol.x = Math.min(limite, Math.max(-limite, pointSol.x));
      pointSol.z = Math.min(limite, Math.max(-limite, pointSol.z));
    }
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
    if (e.button === 0) {
      sourisActive = !sourisActive;   // bascule (mode souris PC)
      // Si une manette a ete reconnue, la pression OK est un geste utilisateur
      // valable pour engager le verrouillage du pointeur (repli si le demarrage
      // ne l'a pas fait).
      demanderVerrouillage();
    }
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

    // Delta du curseur : sert a reconnaitre la manette et a en tirer la direction.
    // Verrouille, clientX/Y sont figes : on lit movementX/Y, non bornes par l'ecran.
    {
      const ddx = verrouille ? e.movementX : (curseurPrec ? e.clientX - curseurPrec.x : 0);
      const ddy = verrouille ? e.movementY : (curseurPrec ? e.clientY - curseurPrec.y : 0);
      const d = Math.hypot(ddx, ddy);
      if (d > 2) {   // on ignore le bruit sub-pixel
        // "Cardinal" = quasi purement horizontal ou vertical : la marque d'un
        // pave directionnel. Un geste de souris est presque toujours diagonal.
        const cardinal = Math.min(Math.abs(ddx), Math.abs(ddy)) <= 0.4 * Math.max(Math.abs(ddx), Math.abs(ddy));
        if (cardinal) {
          confianceManette = Math.min(3, confianceManette + 1);
          if (confianceManette >= 3 && !manette) activerManette();
        } else if (manette) {
          desactiverManette();   // un vrai geste de souris : on rend la main au PC
        } else {
          confianceManette = 0;
        }
        mvtCurseur.dx = ddx / d;
        mvtCurseur.dy = ddy / d;
        mvtCurseur.t = performance.now();
      }
    }
    curseurPrec = { x: e.clientX, y: e.clientY };
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

  /**
   * Traduit une direction exprimee A L'ECRAN en direction du monde.
   * @param ex vers la droite de l'ecran ; ey vers le haut de l'ecran.
   */
  function versLeMonde(ex, ey, facteur) {
    resultat.x = droiteEcran.x * ex + fondEcran.x * ey;
    resultat.z = droiteEcran.z * ex + fondEcran.z * ey;
    resultat.facteur = facteur;
    return resultat;
  }

  function direction(positionJoueur) {
    resultat.x = 0; resultat.z = 0; resultat.facteur = 0;

    // 1. Les fleches sont prioritaires : un reflexe deja acquis ne doit jamais
    //    etre contredit par la position du curseur ou d'un doigt.
    const fx = (touches.has('ArrowRight') ? 1 : 0) - (touches.has('ArrowLeft') ? 1 : 0);
    const fy = (touches.has('ArrowUp') ? 1 : 0) - (touches.has('ArrowDown') ? 1 : 0);
    if (fx !== 0 || fy !== 0) {
      const norme = Math.hypot(fx, fy);
      return versLeMonde(fx / norme, fy / norme, 1);
    }

    // 2. Le joystick tactile. L'ecart du pouce par rapport a son point de depart
    //    donne la direction ET la vitesse. L'axe Y de l'ecran descend, alors que
    //    "vers le haut de l'ecran" monte : d'ou le signe sur dy.
    if (doigt) {
      const dx = doigt.x - doigt.origineX;
      const dy = doigt.y - doigt.origineY;
      const ecart = Math.hypot(dx, dy);
      if (ecart > R.ZONE_MORTE_JOYSTICK) {
        const facteur = Math.min(1, (ecart - R.ZONE_MORTE_JOYSTICK) /
                                    (R.RAYON_JOYSTICK - R.ZONE_MORTE_JOYSTICK));
        return versLeMonde(dx / ecart, -dy / ecart, facteur);
      }
      return resultat;
    }

    // 3a. Manette de TV : le MOUVEMENT du curseur donne la direction. Tant que le
    //     curseur bouge, on avance dans ce sens ; des qu'il s'immobilise (au-dela
    //     de la fenetre), on s'arrete. C'est le "pousse = va, relache = stop".
    if (manette) {
      if (performance.now() - mvtCurseur.t < R.CURSEUR_MANETTE_FENETRE) {
        // dy de l'ecran descend, "vers le haut" monte : d'ou le signe.
        return versLeMonde(mvtCurseur.dx, -mvtCurseur.dy, 1);
      }
      return resultat;
    }

    // 3b. La souris, si la bascule est enclenchee.
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

    // Anneau au sol : seulement en mode PC souris (pas en manette, ou seul le
    // mouvement compte), et seulement pendant la partie.
    const montrerCurseur = enJeu && mode === 'pc' && pointSolValide && !manette;
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
    demanderVerrouillage,
    libererVerrouillage,
    get mode() { return mode; },
    get sourisActive() { return sourisActive; },
    reinitialiser() { sourisActive = false; doigt = null; touches.clear(); },
    // Points d'entree utilises par le pilote automatique et les tests.
    _test: {
      forcerFleches(liste) { touches.clear(); liste.forEach((t) => touches.add(t)); },
      etatSouris() { return { sourisActive, pointSolValide, pointSol: pointSol.clone() }; },
      doigtPose() { return doigt !== null; },
      repereEcran() {
        return {
          droite: { x: +droiteEcran.x.toFixed(3), z: +droiteEcran.z.toFixed(3) },
          fond: { x: +fondEcran.x.toFixed(3), z: +fondEcran.z.toFixed(3) },
        };
      },
    },
  };
}
