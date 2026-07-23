/** L'etat de la partie et sa boucle. Portage fidele de jeux_1/jeu.py. */

import * as THREE from 'three';
import * as R from './reglages.js';
import { TYPES_PLANTES, TYPE_CRISTAL, typeAuHasard } from './plantes.js';
import { batiJoueur, batiEnnemi, batiChampignon } from './personnages.js';
import { batiObstacle } from './rochers.js';

const auHasard = (min, max) => min + Math.random() * (max - min);
const borner = (v, min, max) => Math.min(max, Math.max(min, v));

/** Distance en ignorant la hauteur : le jeu se joue a plat. */
function distanceSol(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Fait tourner un angle vers sa cible par le chemin le plus court. */
function versAngle(actuel, cible, pasMax) {
  let ecart = (cible - actuel) % (Math.PI * 2);
  if (ecart > Math.PI) ecart -= Math.PI * 2;
  if (ecart < -Math.PI) ecart += Math.PI * 2;
  return actuel + borner(ecart, -pasMax, pasMax);
}

export function creerJeu({ scene, camera, commandes, sons, ui, sol, feuillage, reliefSol }) {
  const joueur = batiJoueur();
  scene.add(joueur);

  let etat = 'menu';
  let score = 0;
  let tempsRestant = R.DUREE_PARTIE;
  let plantes = [];
  let ennemis = [];
  let rochers = [];
  let tableauCourant = 1;
  let niveauCourant = 1;   // pour la vitesse des Rodeurs, croissante avec le niveau
  let cristal = null;
  let cristalTempsRestant = 0;
  let champignon = null;
  let champignonRestant = 0;
  let champignonHeure = 0;      // instant d'apparition (ecoule), tire au demarrage
  let champignonApparu = false;
  let delaiCristal = R.CRISTAL_PREMIER_DELAI;
  let invincibleRestant = 0;
  let prochainTic = 10;
  let cycleMarche = 0;
  let apparitions = [];         // temps (ecoule) des vagues de Rodeurs a venir
  let horloge = 0;              // temps de jeu accumule, pour les animations
  let crochetCristal = null;    // utilise seulement par le pilote automatique
  let distanceCristal = R.CRISTAL_DISTANCE_MINI;

  // Comptage, pour comparer le comportement avec la version Python de reference.
  let compteurs = { recoltes: 0, degats: 0, pointsPerdus: 0, cristaux: 0, pas: 0 };

  /** Distance au rocher le plus proche (Infini s'il n'y a pas de rocher). */
  function ecartAuRocherLePlusProche(point) {
    let mini = Infinity;
    for (const rocher of rochers) {
      const d = distanceSol(point, rocher.position);
      if (d < mini) mini = d;
    }
    return mini;
  }

  /**
   * Un point libre du champ, a bonne distance d'une reference (le joueur) ET
   * a l'ecart des rochers. Si aucun point parfait n'est trouve en 40 essais, on
   * renvoie le meilleur compromis (le plus loin des rochers) : ainsi une plante
   * ne nait jamais coincee au centre d'un rocher, meme quand le champ est charge.
   */
  function positionAleatoire(distanceMini = 0, reference = null) {
    const limite = R.DEMI_CHAMP - R.MARGE_PLANTE;
    const point = new THREE.Vector3();
    let meilleur = null;
    let meilleurEcart = -Infinity;
    for (let essai = 0; essai < 40; essai++) {
      point.set(auHasard(-limite, limite), 0, auHasard(-limite, limite));
      if (reference && distanceSol(point, reference) < distanceMini) continue;
      const ecart = ecartAuRocherLePlusProche(point);
      if (ecart >= R.ROCHER_EXCLUSION_PLANTE) return point;
      if (ecart > meilleurEcart) { meilleurEcart = ecart; meilleur = point.clone(); }
    }
    return meilleur || point;
  }

  /** Repousse une position hors de tout rocher, en glissant le long de son bord. */
  function ecarterDesRochers(position) {
    for (const rocher of rochers) {
      const dx = position.x - rocher.position.x;
      const dz = position.z - rocher.position.z;
      const d = Math.hypot(dx, dz);
      if (d < R.ROCHER_RAYON_COLLISION) {
        // A l'aplomb exact du centre (d ~ 0), on choisit une direction par defaut.
        const nx = d > 0.0001 ? dx / d : 1;
        const nz = d > 0.0001 ? dz / d : 0;
        position.x = rocher.position.x + nx * R.ROCHER_RAYON_COLLISION;
        position.z = rocher.position.z + nz * R.ROCHER_RAYON_COLLISION;
      }
    }
  }

  /**
   * Seme `nombre` rochers au hasard, loin du depart et espaces entre eux. On les
   * garde assez a l'ecart du bord pour que repousser un personnage hors d'un
   * rocher ne le fasse jamais buter contre le mur invisible (sinon il pourrait
   * se retrouver coince dans le rocher, dans un coin du champ).
   */
  function placerRochers(nombre, tableau) {
    const limite = R.DEMI_CHAMP - R.MARGE_JOUEUR - R.ROCHER_RAYON_COLLISION - 0.5;
    for (let i = 0; i < nombre; i++) {
      for (let essai = 0; essai < 60; essai++) {
        const x = auHasard(-limite, limite);
        const z = auHasard(-limite, limite);
        if (Math.hypot(x, z) < R.ROCHER_DISTANCE_DEPART) continue;
        let tropPres = false;
        for (const autre of rochers) {
          if (Math.hypot(x - autre.position.x, z - autre.position.z) < R.ROCHER_DISTANCE_ENTRE) {
            tropPres = true;
            break;
          }
        }
        if (tropPres) continue;
        const rocher = batiObstacle(tableau, auHasard(...R.ROCHER_RAYON_VISUEL));
        rocher.position.x = x;
        rocher.position.z = z;
        scene.add(rocher);
        rochers.push(rocher);
        break;
      }
    }
  }

  function creerPlante(distanceMini = 0) {
    const type = typeAuHasard(tableauCourant);   // fleurs (1-4) ou legumes (5-8)
    const plante = type.bati();
    plante.position.copy(positionAleatoire(distanceMini, joueur.position));
    // Rotation au hasard pour varier les touffes, sauf pour les plantes animees.
    if (!plante.userData.rotor) plante.rotation.y = auHasard(0, Math.PI * 2);
    plante.userData.type = type;
    scene.add(plante);
    plantes.push(plante);
    return plante;
  }

  function creerEnnemi() {
    const ennemi = batiEnnemi();
    ennemi.position.copy(positionAleatoire(18, joueur.position));
    ennemi.userData.mode = 'flane';
    ennemi.userData.cible = positionAleatoire();
    ennemi.userData.apparition = 0;
    ennemi.scale.setScalar(0.01);
    scene.add(ennemi);
    ennemis.push(ennemi);
    return ennemi;
  }

  function faireApparaitreCristal() {
    cristal = TYPE_CRISTAL.bati();
    cristal.position.copy(positionAleatoire(distanceCristal, joueur.position));
    cristal.userData.type = TYPE_CRISTAL;
    cristalTempsRestant = R.CRISTAL_DUREE_VIE;
    sons.jouer('cristal_apparait');
    scene.add(cristal);
    if (crochetCristal) crochetCristal();
  }

  function retirerCristal() {
    if (cristal) { scene.remove(cristal); cristal = null; }
  }

  /** Projette un point du monde en coordonnees d'ecran, pour les "+5" volants. */
  const projection = new THREE.Vector3();
  function versEcran(position) {
    projection.copy(position);
    projection.y += 1.4;
    projection.project(camera);
    return {
      x: (projection.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projection.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function recolter(plante) {
    const points = plante.userData.type.points;
    compteurs.recoltes++;
    if (points === 25) compteurs.cristaux++;
    score += points;
    ui.majScore(score);
    sons.recolte(points);
    const p = versEcran(plante.position);
    ui.volant(p.x, p.y, `+${points}`, points < 25 ? '#7dff9b' : '#3df2ff');
  }

  function encaisserDegat() {
    const perte = Math.min(score, Math.max(R.MALUS_MINIMUM, Math.ceil(score * R.MALUS_POURCENT)));
    score = Math.max(0, score - perte);
    compteurs.degats++;
    compteurs.pointsPerdus += perte;
    invincibleRestant = R.INVINCIBILITE;
    sons.jouer('degat');
    ui.majScore(score);
    const p = versEcran(joueur.position);
    ui.volant(p.x, p.y, perte > 0 ? `-${perte}` : 'Aïe !', '#ff5555');
  }

  function demarrerPartie(niveau = R.NIVEAU_DEFAUT, tableau = 1) {
    for (const p of plantes) scene.remove(p);
    for (const e of ennemis) scene.remove(e);
    for (const r of rochers) scene.remove(r);
    plantes = [];
    ennemis = [];
    rochers = [];
    retirerCristal();
    retirerChampignon();

    // Re-skin selon le tableau : meme decor, quelques couleurs changees pour que
    // le tableau 2 se sente comme un autre lieu (une recompense).
    tableauCourant = tableau;
    niveauCourant = niveau;
    const palette = R.PALETTE_TABLEAU[tableau - 1] || R.PALETTE_TABLEAU[0];
    if (sol) {
      sol.material.color.setHex(palette.sol);
      // Texture et relief sur TOUS les tableaux : la texture est en niveaux de
      // gris, elle prend la teinte du sol courant (herbe, roche, neige, lave...).
      sol.material.map = reliefSol.couleur;
      sol.material.bumpMap = reliefSol.bump;
      sol.material.bumpScale = R.SOL_RELIEF_BUMP;
      sol.material.needsUpdate = true;   // changer une carte recompile le shader
    }
    if (feuillage) feuillage.color.setHex(palette.feuille);
    scene.background.setHex(palette.ciel);

    score = 0;
    tempsRestant = R.DUREE_PARTIE;
    invincibleRestant = 0;
    delaiCristal = R.CRISTAL_PREMIER_DELAI;
    prochainTic = 10;
    cycleMarche = 0;
    champignonApparu = false;
    champignonHeure = auHasard(...R.CHAMPIGNON_FENETRE);   // apparition a un instant aleatoire
    compteurs = { recoltes: 0, degats: 0, pointsPerdus: 0, cristaux: 0, pas: 0 };

    joueur.position.set(0, 0, 0);
    joueur.rotation.y = 0;
    joueur.userData.materiaux[0].color.setHex(R.COULEURS.salopette);
    camera.position.set(R.DECALAGE_CAMERA.x, R.DECALAGE_CAMERA.y, R.DECALAGE_CAMERA.z);

    // Les obstacles d'abord : plantes, cristaux et Rodeurs les eviteront ensuite.
    if (tableau >= 2) placerRochers(R.NB_ROCHERS[niveau - 1] || 0, tableau);

    for (let i = 0; i < R.NB_PLANTES; i++) creerPlante();

    // Les Rodeurs de DEPART depend du tableau (plus il est avance, plus il y en
    // a). Les vagues suivantes (horaire > 0 s) suivent le niveau de difficulte.
    const calendrier = R.NIVEAUX_APPARITION[niveau - 1] || R.NIVEAUX_APPARITION[0];
    apparitions = calendrier.filter((t) => t > 0);
    const depart = R.RODEURS_DEPART_TABLEAU[tableau - 1] || 1;
    for (let i = 0; i < depart; i++) creerEnnemi();

    commandes.reinitialiser();
    ui.cacherPanneau();
    ui.majScore(0);
    etat = 'jeu';
    sons.jouer('debut');
  }

  function finirPartie() {
    etat = 'fin';
    sons.jouer('fin');
    ui.afficherFin(score, tableauCourant);
  }

  // --- Mises a jour, toutes appelees avec un pas FIXE ----------------------

  function majJoueur(dt) {
    const d = commandes.direction(joueur.position);
    if (d.facteur > 0) {
      joueur.position.x += d.x * R.VITESSE_JOUEUR * d.facteur * dt;
      joueur.position.z += d.z * R.VITESSE_JOUEUR * d.facteur * dt;
      // Le personnage pivote vers la ou il marche : les commandes restent
      // absolues (haut = vers le fond de l'ecran), quelle que soit son orientation.
      joueur.rotation.y = versAngle(joueur.rotation.y, Math.atan2(d.x, d.z),
                                    THREE.MathUtils.degToRad(900) * dt);

      cycleMarche += dt * 11 * d.facteur;
      const balancement = Math.sin(cycleMarche) * THREE.MathUtils.degToRad(22);
      joueur.userData.membres.forEach((membre, i) => {
        membre.rotation.x = balancement * (i % 2 === 0 ? 1 : -1);
      });
      joueur.userData.corps.position.y = Math.abs(Math.sin(cycleMarche)) * 0.07;
    } else {
      cycleMarche = 0;
      for (const membre of joueur.userData.membres) {
        membre.rotation.x += (0 - membre.rotation.x) * Math.min(1, dt * 10);
      }
      const corps = joueur.userData.corps;
      corps.position.y += (0 - corps.position.y) * Math.min(1, dt * 10);
    }

    // Rochers du tableau 2 : on bute dessus et on glisse le long du bord.
    ecarterDesRochers(joueur.position);

    // Mur invisible : on bute et on glisse le long du bord, sans jamais sortir.
    const limite = R.DEMI_CHAMP - R.MARGE_JOUEUR;
    joueur.position.x = borner(joueur.position.x, -limite, limite);
    joueur.position.z = borner(joueur.position.z, -limite, limite);
  }

  function majPlantes(dt) {
    for (let i = plantes.length - 1; i >= 0; i--) {
      const plante = plantes[i];
      if (plante.userData.rotor) {
        plante.userData.rotor.rotation.y += plante.userData.vitesseRotation * dt;
      }
      if (distanceSol(plante.position, joueur.position) < R.RAYON_RECOLTE) {
        recolter(plante);
        scene.remove(plante);
        plantes.splice(i, 1);
        // Respawn immediat, loin du joueur : le champ ne se vide jamais et on ne
        // peut pas camper sur un point de reapparition.
        creerPlante(8);
      }
    }
  }

  function majCristal(dt) {
    if (cristal) {
      const rotor = cristal.userData.rotor;
      rotor.rotation.y += cristal.userData.vitesseRotation * dt;
      rotor.position.y = 1.1 + Math.sin(horloge * 3) * 0.18;
      const pulsation = 1 + Math.sin(horloge * 6) * 0.08;
      rotor.scale.set(0.6 * pulsation, 1.0 * pulsation, 0.6 * pulsation);
      cristal.userData.halo.position.y = rotor.position.y;

      cristalTempsRestant -= dt;
      if (cristalTempsRestant < 2) {
        cristal.visible = Math.sin(horloge * 18) > -0.3;   // il clignote avant de partir
      }
      if (distanceSol(cristal.position, joueur.position) < R.RAYON_RECOLTE + 0.4) {
        recolter(cristal);
        retirerCristal();
        delaiCristal = auHasard(...R.CRISTAL_DELAI);
      } else if (cristalTempsRestant <= 0) {
        retirerCristal();
        delaiCristal = auHasard(...R.CRISTAL_DELAI);
      }
    } else {
      delaiCristal -= dt;
      // On ne le fait pas apparaitre s'il n'a pas le temps d'etre attrape.
      if (delaiCristal <= 0 && tempsRestant > 3) faireApparaitreCristal();
    }
  }

  function faireApparaitreChampignon() {
    champignonApparu = true;
    champignon = batiChampignon();
    champignon.position.copy(positionAleatoire(10, joueur.position));
    champignon.userData.cible = positionAleatoire();
    champignonRestant = R.CHAMPIGNON_DUREE_VIE;
    scene.add(champignon);
    sons.champignonApparait();
  }

  function retirerChampignon() {
    if (champignon) { scene.remove(champignon); champignon = null; }
  }

  function capturerChampignon() {
    tempsRestant += R.CHAMPIGNON_BONUS;
    sons.bonus();
    const p = versEcran(champignon.position);
    ui.volant(p.x, p.y, `+${R.CHAMPIGNON_BONUS} s`, '#ffd21f');
    ui.majChrono(tempsRestant);
    retirerChampignon();
  }

  /** Le champignon bonus : apparait une fois, flane comme un Rodeur, +5 s si attrape. */
  function majChampignon(dt) {
    if (!champignon) {
      const ecoule = R.DUREE_PARTIE - tempsRestant;
      if (!champignonApparu && ecoule >= champignonHeure) faireApparaitreChampignon();
      return;
    }
    const d = champignon.userData;
    if (distanceSol(champignon.position, d.cible) < 1.5) d.cible = positionAleatoire();
    const dx = d.cible.x - champignon.position.x;
    const dz = d.cible.z - champignon.position.z;
    const norme = Math.hypot(dx, dz);
    if (norme > 0.05) {
      champignon.position.x += (dx / norme) * R.CHAMPIGNON_VITESSE * dt;
      champignon.position.z += (dz / norme) * R.CHAMPIGNON_VITESSE * dt;
      champignon.rotation.y = versAngle(champignon.rotation.y, Math.atan2(dx, dz),
                                        THREE.MathUtils.degToRad(300) * dt);
    }
    ecarterDesRochers(champignon.position);
    const limite = R.DEMI_CHAMP - R.MARGE_JOUEUR;
    champignon.position.x = borner(champignon.position.x, -limite, limite);
    champignon.position.z = borner(champignon.position.z, -limite, limite);
    champignon.userData.corps.position.y = Math.abs(Math.sin(horloge * 8)) * 0.12;   // sautille

    champignonRestant -= dt;
    if (champignonRestant < 2) champignon.visible = Math.sin(horloge * 18) > -0.3;    // clignote avant de partir

    if (distanceSol(champignon.position, joueur.position) < R.RAYON_RECOLTE + 0.4) capturerChampignon();
    else if (champignonRestant <= 0) retirerChampignon();
  }

  function majEnnemis(dt) {
    // La vitesse de base des Rodeurs augmente avec le niveau de difficulte.
    const vitesseBase = R.VITESSE_ENNEMI * (R.VITESSE_ENNEMI_NIVEAU[niveauCourant - 1] || 1);
    for (const ennemi of ennemis) {
      if (ennemi.userData.apparition < 1) {
        ennemi.userData.apparition = Math.min(1, ennemi.userData.apparition + dt / 0.4);
        const t = ennemi.userData.apparition;
        ennemi.scale.setScalar(0.01 + (1 - 0.01) * (1 - Math.pow(1 - t, 3)));
      }

      const ecart = distanceSol(ennemi.position, joueur.position);
      const d = ennemi.userData;

      if (d.mode === 'flane') {
        if (ecart < R.RAYON_DETECTION) d.mode = 'chasse';
        else if (distanceSol(ennemi.position, d.cible) < 1.5) d.cible = positionAleatoire();
      } else if (ecart > R.RAYON_ABANDON) {
        d.mode = 'flane';
        d.cible = positionAleatoire();
      }

      const but = d.mode === 'chasse' ? joueur.position : d.cible;
      const dx = but.x - ennemi.position.x;
      const dz = but.z - ennemi.position.z;
      const norme = Math.hypot(dx, dz);
      if (norme > 0.05) {
        const vitesse = d.mode === 'chasse' ? vitesseBase : vitesseBase * 0.45;
        ennemi.position.x += (dx / norme) * vitesse * dt;
        ennemi.position.z += (dz / norme) * vitesse * dt;
        ennemi.rotation.y = versAngle(ennemi.rotation.y, Math.atan2(dx, dz),
                                      THREE.MathUtils.degToRad(400) * dt);
      }

      // Les Rodeurs sont bloques par les rochers, eux aussi, et glissent autour.
      ecarterDesRochers(ennemi.position);

      const limite = R.DEMI_CHAMP - R.MARGE_JOUEUR;
      ennemi.position.x = borner(ennemi.position.x, -limite, limite);
      ennemi.position.z = borner(ennemi.position.z, -limite, limite);

      // Il sautille quand il chasse : le danger se voit d'un coup d'oeil.
      const corps = ennemi.userData.corps;
      if (d.mode === 'chasse') {
        corps.position.y = Math.abs(Math.sin(horloge * 12)) * 0.25;
        corps.rotation.z = Math.sin(horloge * 12) * THREE.MathUtils.degToRad(8);
      } else {
        corps.position.y += (0 - corps.position.y) * Math.min(1, dt * 6);
        corps.rotation.z += (0 - corps.rotation.z) * Math.min(1, dt * 6);
      }

      if (invincibleRestant <= 0 && ecart < R.RAYON_CONTACT_ENNEMI) encaisserDegat();
    }
  }

  function majInvincibilite(dt) {
    if (invincibleRestant > 0) {
      invincibleRestant -= dt;
      const clignote = Math.sin(horloge * 30) > 0;
      joueur.userData.materiaux[0].color.setHex(clignote ? R.COULEURS.degat : R.COULEURS.salopette);
      if (invincibleRestant <= 0) {
        joueur.userData.materiaux[0].color.setHex(R.COULEURS.salopette);
      }
    }
  }

  function majChrono(dt) {
    tempsRestant -= dt;

    // Fait apparaitre chaque vague dont l'heure (en secondes ecoulees) est venue.
    const ecoule = R.DUREE_PARTIE - tempsRestant;
    while (apparitions.length && ecoule >= apparitions[0]) {
      apparitions.shift();
      creerEnnemi();
    }

    if (tempsRestant <= 10 && Math.ceil(tempsRestant) < prochainTic) {
      prochainTic = Math.ceil(tempsRestant);
      sons.jouer('tic');
    }
    ui.majChrono(tempsRestant);
    if (tempsRestant <= 0) finirPartie();
  }

  /** Un pas de simulation, toujours de duree PAS_SIMULATION. */
  function pas(dt) {
    if (etat !== 'jeu') return;
    horloge += dt;
    compteurs.pas++;
    majJoueur(dt);
    majPlantes(dt);
    majCristal(dt);
    majChampignon(dt);
    majEnnemis(dt);
    majInvincibilite(dt);
    majChrono(dt);
  }

  /** Ce qui depend de l'affichage et non de la simulation. */
  function rendu(dt) {
    commandes.majVisuels(etat === 'jeu');
    // La camera suit en douceur, mais sans jamais changer d'orientation.
    const facteur = Math.min(1, dt * R.SUIVI_CAMERA);
    camera.position.x += (joueur.position.x + R.DECALAGE_CAMERA.x - camera.position.x) * facteur;
    camera.position.z += (joueur.position.z + R.DECALAGE_CAMERA.z - camera.position.z) * facteur;
  }

  return {
    pas,
    rendu,
    demarrerPartie,
    joueur,
    get etat() { return etat; },
    get score() { return score; },
    get tempsRestant() { return tempsRestant; },
    get plantes() { return plantes; },
    get ennemis() { return ennemis; },
    get rochers() { return rochers; },
    get tableauCourant() { return tableauCourant; },
    get cristal() { return cristal; },
    get champignon() { return champignon; },
    get compteurs() { return compteurs; },
    set crochetCristal(f) { crochetCristal = f; },
    // Reserve au pilote automatique : fait apparaitre le Cristal-lune tot et
    // pres du joueur, uniquement pour pouvoir le photographier.
    _reglerCristalPourTest(delai, distanceMini) {
      delaiCristal = delai;
      distanceCristal = distanceMini;
    },
    // Reserve aux tests : regle l'instant d'apparition du champignon (0.2 pour le
    // forcer tot, 999 pour le desactiver dans le test deterministe des 3600 pas).
    _reglerChampignonPourTest(heure) {
      champignonHeure = heure;
      champignonApparu = false;
      retirerChampignon();
    },
    _capturerChampignon() { if (champignon) capturerChampignon(); },
  };
}
