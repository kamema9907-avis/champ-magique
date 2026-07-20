/**
 * Le pilote automatique : le jeu se joue tout seul.
 *
 * C'est l'equivalent du mode --test de jeux_1, et c'est ce qui m'a permis d'y
 * voir le champ trop vide, le bord du monde visible et l'etoile en tranche.
 * Aucune de ces choses n'etait visible dans le code.
 *
 * Il ne s'active que si l'adresse contient ?test, donc jamais pour un joueur.
 * Il ne sauvegarde jamais de record : il marque bien plus qu'un humain et
 * ecraserait le score de l'enfant.
 */

import * as THREE from 'three';
import * as R from './reglages.js';

export function brancherPiloteAuto({ jeu, commandes, ui, sons, camera }) {
  const parametres = new URLSearchParams(location.search);
  if (!parametres.has('test')) return;

  // ?test expose seulement les crochets ; il faut ?test&auto pour que le robot
  // JOUE. Sans cette separation, le pilote force les fleches a chaque pas, et
  // comme les fleches sont prioritaires, il rendrait tout test des commandes
  // tactiles ou souris totalement faux (erreur commise, puis attrapee ici).
  let piloteActif = parametres.has('auto');

  sons.muet = true;   // pas de son : rien ne l'ecoute, et ca ralentit le test

  const distanceSol = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  /** Fonce sur la plante la plus proche, en priorisant le Cristal-lune. */
  function piloter() {
    if (jeu.etat !== 'jeu') return;
    const cibles = jeu.plantes.slice();
    if (jeu.cristal) cibles.push(jeu.cristal);
    if (cibles.length === 0) return;

    let but = jeu.cristal;
    if (!but) {
      let meilleure = Infinity;
      for (const cible of cibles) {
        const d = distanceSol(cible.position, jeu.joueur.position);
        if (d < meilleure) { meilleure = d; but = cible; }
      }
    }

    const ex = but.position.x - jeu.joueur.position.x;
    const ez = but.position.z - jeu.joueur.position.z;

    // Le but est dans le repere du MONDE, les fleches dans celui de l'ECRAN :
    // il faut projeter l'un sur l'autre. Ne pas le faire (et supposer que
    // "ArrowRight = +X") etait un bug... qui annulait exactement celui des
    // commandes : le robot jouait juste pendant que l'ecran etait en miroir,
    // et le score ne revelait donc rien. D'ou le repere, deduit de la camera.
    const repere = commandes._test.repereEcran();
    const sx = ex * repere.droite.x + ez * repere.droite.z;
    const sy = ex * repere.fond.x + ez * repere.fond.z;

    const fleches = [];
    if (sx > 0.25) fleches.push('ArrowRight');
    if (sx < -0.25) fleches.push('ArrowLeft');
    if (sy > 0.25) fleches.push('ArrowUp');
    if (sy < -0.25) fleches.push('ArrowDown');
    commandes._test.forcerFleches(fleches);
  }

  // Le pilote doit agir a chaque pas de simulation, pas a chaque image : sinon
  // son comportement dependrait de la vitesse de la machine.
  let enPause = false;
  let figerAuCristal = false;
  const pasOriginal = jeu.pas;
  jeu.pas = (dt) => {
    if (enPause) return;
    if (piloteActif) piloter();
    pasOriginal(dt);
  };

  // Etat expose a Playwright, qui n'a pas d'autre moyen de voir dans le jeu.
  window.__test = {
    cristalApparu: false,
    etat: () => ({
      etat: jeu.etat,
      score: jeu.score,
      chrono: Math.ceil(jeu.tempsRestant),
      plantes: jeu.plantes.length,
      ennemis: jeu.ennemis.length,
      rochers: jeu.rochers.length,
      tableau: jeu.tableauCourant,
      cristal: jeu.cristal !== null,
      joueur: { x: +jeu.joueur.position.x.toFixed(2), z: +jeu.joueur.position.z.toFixed(2) },
      mode: commandes.mode,
      compteurs: { ...jeu.compteurs },
    }),
    demarrer: (tableau = 1, niveau = R.NIVEAU_DEFAUT) => {
      sons.deverrouiller();
      jeu.demarrerPartie(niveau, tableau);
    },
    // Positions des rochers et des plantes, pour verifier les invariants du tableau 2.
    rochers: () => jeu.rochers.map((r) => ({
      x: +r.position.x.toFixed(2), z: +r.position.z.toFixed(2), rayon: +r.userData.rayon.toFixed(2),
    })),
    plantesPos: () => jeu.plantes.map((p) => ({
      x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2),
    })),
    // Fait apparaitre le cristal tot, et demande a figer le jeu des qu'il sort.
    cristalTot: () => { figerAuCristal = true; jeu._reglerCristalPourTest(2.0, 7.0); },
    forcerFleches: (l) => commandes._test.forcerFleches(l),
    etatSouris: () => commandes._test.etatSouris(),
    reprendre: () => { enPause = false; },
    enPause: () => enPause,
    pilote: (actif) => { piloteActif = actif; if (!actif) commandes._test.forcerFleches([]); },
    piloteActif: () => piloteActif,

    /**
     * Largeur de champ reellement visible, mesuree en lancant un rayon par les
     * bords gauche et droit de l'ecran jusqu'au sol, a hauteur du joueur.
     * On mesure au lieu de refaire confiance a la formule d'ouverture : c'est
     * tout l'interet du test. Doit donner la MEME valeur en 16:9 et en 4:3.
     */
    largeurVisible: () => {
      const plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const rayon = new THREE.Raycaster();
      const points = [];
      for (const x of [-1, 1]) {
        // y = celui du joueur a l'ecran, pour mesurer la largeur la ou il est.
        const cible = jeu.joueur.position.clone().project(camera);
        rayon.setFromCamera(new THREE.Vector2(x, cible.y), camera);
        const point = new THREE.Vector3();
        if (!rayon.ray.intersectPlane(plan, point)) return null;
        points.push(point);
      }
      return +points[0].distanceTo(points[1]).toFixed(2);
    },
    ouverture: () => +camera.fov.toFixed(2),
    rapport: () => +camera.aspect.toFixed(3),

    /**
     * Projette un point du monde en pixels d'ecran.
     *
     * C'est LA mesure qui manquait : verifier que le joueur va vers "+X du
     * monde" ne verifie que ma propre hypothese sur l'orientation de la camera.
     * En projetant deux positions avec la MEME camera, on obtient le
     * deplacement tel qu'il apparait, et c'est l'ecran que l'enfant regarde.
     * (On projette deux points plutot que de suivre le joueur a l'ecran : la
     * camera l'accompagne, il reste donc toujours au centre.)
     */
    projeter: (x, z) => {
      const p = new THREE.Vector3(x, 0, z).project(camera);
      return {
        x: +((p.x * 0.5 + 0.5) * window.innerWidth).toFixed(1),
        y: +((-p.y * 0.5 + 0.5) * window.innerHeight).toFixed(1),
      };
    },
    repereEcran: () => commandes._test.repereEcran(),
  };

  // Le pilote fonce sur le cristal et le ramasse en moins d'une seconde : toute
  // capture prise "peu apres" arrive trop tard (erreur deja commise sur jeux_1).
  // On fige donc le jeu a l'instant EXACT de l'apparition, depuis le pas de
  // simulation lui-meme. Plus aucune course contre la montre.
  jeu.crochetCristal = () => {
    window.__test.cristalApparu = true;
    if (figerAuCristal) {
      figerAuCristal = false;
      jeu.cristal.position.set(jeu.joueur.position.x + 3, 0, jeu.joueur.position.z + 3);
      enPause = true;
    }
  };

  console.log('[test] pilote automatique branche');
}
