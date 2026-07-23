/**
 * Tous les chiffres du jeu. C'est le seul fichier a toucher pour equilibrer.
 *
 * Ces valeurs viennent de la version Python (jeux_1) ou elles ont ete MESUREES
 * en faisant jouer un pilote automatique, pas devinees. Elles sont notre point
 * de reference : si le jeu se comporte differemment ici, c'est le portage qui
 * est en cause, pas l'equilibrage. Ne pas les modifier sans mesurer a nouveau.
 */

export const DUREE_PARTIE = 60.0;

export const TAILLE_CHAMP = 50.0;   // aire de jeu, delimitee par la cloture d'arbres
export const TAILLE_SOL = 120.0;    // le sol deborde : on ne voit jamais le bord du monde
export const DEMI_CHAMP = TAILLE_CHAMP / 2;
export const MARGE_JOUEUR = 1.5;    // le mur invisible
export const MARGE_PLANTE = 2.5;

export const VITESSE_JOUEUR = 9.0;
export const VITESSE_ENNEMI = VITESSE_JOUEUR * 0.65;  // 65% : on peut TOUJOURS s'echapper
// La difficulte accelere les Rodeurs : +2,5 % de leur vitesse de base par niveau.
// Au niveau 3 (x1,05) ils restent a 68 % du joueur, donc toujours semables.
export const VITESSE_ENNEMI_NIVEAU = [1.0, 1.025, 1.05];  // niveaux 1 / 2 / 3
export const RAYON_DETECTION = 8.0;
export const RAYON_ABANDON = 12.0;
export const RAYON_RECOLTE = 1.3;
export const RAYON_CONTACT_ENNEMI = 1.3;

export const NB_PLANTES = 120;
export const INVINCIBILITE = 1.5;
export const MALUS_POURCENT = 0.10;
export const MALUS_MINIMUM = 5;

export const CRISTAL_DUREE_VIE = 8.0;
export const CRISTAL_PREMIER_DELAI = 8.0;
export const CRISTAL_DELAI = [9.0, 14.0];
export const CRISTAL_DISTANCE_MINI = 15.0;

// Apparition des Rodeurs, en secondes ECOULEES depuis le debut de la partie.
// Un tableau par niveau de difficulte. Le Rodeur a 0 s est toujours la; chaque
// niveau ajoute des vagues. Le niveau 1 reproduit l'original (un 2e Rodeur a
// 30 s, soit 30 s restantes sur une partie de 60 s).
export const NIVEAUX_APPARITION = [
  [0, 30],                    // Niveau 1
  [0, 20, 40],                // Niveau 2
  [0, 10, 20, 30, 40, 50],    // Niveau 3
];
export const NIVEAU_DEFAUT = 1;

// Deverrouillage des niveaux, PAR TABLEAU : score a atteindre sur le tableau
// courant pour ouvrir le niveau. Facile (indice 0) est toujours ouvert. Avec le
// seuil des tableaux (560), on obtient l'echelle : 460 -> Moyen, 510 -> Difficile,
// 560 -> tableau suivant.
export const SEUIL_NIVEAU = [0, 460, 510];   // Facile / Moyen / Difficile

// --- Camera ---------------------------------------------------------------
// La camera suit le joueur mais ne tourne JAMAIS : c'est ce qui rend les
// commandes "absolues" (haut = vers le fond de l'ecran, toujours).
// y / z respectent tan(50 deg), donc elle vise exactement le joueur.
export const DECALAGE_CAMERA = { x: 0, y: 20, z: -16.78 };
export const SUIVI_CAMERA = 7.0;    // vitesse de rattrapage de la camera

// Sur PC (16:9) la version Python utilisait 42 deg d'ouverture VERTICALE, ce qui
// donne cette ouverture HORIZONTALE. On la garde constante quel que soit l'ecran :
// un iPad (4:3) verra donc plus haut et plus bas, mais AUTANT sur les cotes.
// C'est vital : les Rodeurs arrivent par les cotes. A ouverture verticale fixe,
// l'iPad verrait le champ plus etroit et le jeu deviendrait plus dur sans raison.
export const OUVERTURE_HORIZONTALE = 68.64;  // degres

// --- Commandes ------------------------------------------------------------
// Souris : le curseur agit comme un manche de joystick (la camera suivant le
// joueur, le point vise s'eloigne avec lui).
export const ZONE_MORTE_SOURIS = 1.2;   // metres
export const RAMPE_SOURIS = 3.0;        // metres : pleine vitesse au-dela

// Joystick tactile flottant : il nait la ou le pouce se pose.
export const ZONE_MORTE_JOYSTICK = 8;   // pixels : en dessous, on ne bouge pas
export const RAYON_JOYSTICK = 70;       // pixels : pleine vitesse au bord de l'anneau

// --- Simulation -----------------------------------------------------------
// Pas fixe, decouple de l'affichage. Sans cela, sur une machine lente le joueur
// avancerait de presque un metre d'un coup et traverserait les plantes sans les
// toucher. Garantit un comportement identique a 60 i/s sur iPad et a 10 i/s
// dans les tests automatises.
export const PAS_SIMULATION = 1 / 60;
export const PAS_MAX_PAR_IMAGE = 5;     // evite la spirale de la mort si ca rame

// --- Couleurs -------------------------------------------------------------
export const COULEURS = {
  ciel: 0x8fd3ff,
  sol: 0x5aa02c,
  tige: 0x2f7d32,
  brun: 0x6b4423,
  feuille: 0x3d8b37,
  mousse: 0x3d7bff,
  epi: 0xffd21f,
  violet: 0xa339d6,
  orange: 0xff6a00,
  cyan: 0x3df2ff,
  ennemi: 0xd81f1f,
  pique: 0xff9b3d,
  peau: 0xf0b98a,
  salopette: 0x2a4fd6,
  paille: 0xe8c56a,
  degat: 0xff4444,
  rocher: 0x8a8577,
  glace: 0xbfe6f5,   // blocs de glace, tableau 3
  lave: 0x40201c,    // rochers de lave, tableau 4 (la lueur est ajoutee en emissive)
  laveLueur: 0x8a1e00,
};

// --- Tableau 2 : Les Rochers ----------------------------------------------
// Deuxieme tableau, deverrouille par le record. De petits rochers servent
// d'obstacles a contourner. Ces valeurs sont a ajuster en jouant.
// Deverrouillage EN CHAINE : le seuil d'indice i est le record a atteindre sur
// le tableau (i+1) pour debloquer le tableau (i+2). Longueur = nb de tableaux - 1.
export const SEUIL_DEBLOCAGE = [560, 560, 560];  // T1->T2, T2->T3, T3->T4
export const NB_ROCHERS = [4, 8, 12];            // par niveau (Facile / Moyen / Difficile)
export const ROCHER_RAYON_VISUEL = [0.8, 1.2];   // tirage aleatoire, pour varier les rochers
export const ROCHER_RAYON_COLLISION = 1.3;       // joueur et Rodeurs sont bloques a ce rayon
export const ROCHER_DISTANCE_DEPART = 6.0;       // distance mini depuis le depart (0,0)
export const ROCHER_DISTANCE_ENTRE = 8.0;        // distance mini entre deux rochers (pas de mur)
export const ROCHER_EXCLUSION_PLANTE = 2.0;      // plantes/cristaux gardent cette distance du centre
export const SOL_RELIEF_BUMP = 1.2;              // force du relief (bumpMap) du sol au tableau 2

// Palette par tableau. Meme geometrie partout, seules les couleurs changent pour
// signaler un autre lieu. Le sol de tous les tableaux recoit la texture de relief.
export const PALETTE_TABLEAU = [
  { sol: COULEURS.sol, ciel: COULEURS.ciel, feuille: COULEURS.feuille },   // 1 Le Champ
  { sol: 0x9c7a4d, ciel: 0xcbb28f, feuille: 0xcf7a33 },   // 2 Les Rochers : aride, chaud, orangé
  { sol: 0xcdddea, ciel: 0xb9cdd8, feuille: 0xa9d2ea },   // 3 Forêt Gelée : neige, ciel froid, givre
  { sol: 0x4a3a36, ciel: 0x7a3028, feuille: 0x3a2420 },   // 4 Terres de Feu : sol sombre, ciel rouge
];

// --- Profils --------------------------------------------------------------
// Modifiables librement : c'est la seule ligne a changer pour renommer.
export const JOUEURS = ['Raphaël', 'Papi', 'Invité'];
export const CLE_STOCKAGE = 'champ-magique.records';
export const CLE_DERNIER_JOUEUR = 'champ-magique.dernier-joueur';
export const CLE_NIVEAU = 'champ-magique.niveau';
export const CLE_TABLEAU = 'champ-magique.tableau';
