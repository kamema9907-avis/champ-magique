# La Récolte du Champ Magique — version web (iPad et PC)

## ▶ Jouer : **https://kamema9907-avis.github.io/champ-magique/**

Portage en Three.js du jeu Python de [`../jeux_1`](../jeux_1), pour qu'il tourne
sur l'iPad de Raphaël. Une page web : pas d'App Store, pas d'installation.

60 secondes pour récolter un maximum de plantes en évitant les Rôdeurs.

**Sur l'iPad, pour en faire une vraie app :** ouvrir l'adresse dans Safari, puis
**Partager → Ajouter à l'écran d'accueil**. Le jeu obtient une icône et se lance
en plein écran, sans la barre de Safari.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir l'adresse affichée.

### Jouer sur l'iPad (en Wi-Fi local, pour tester)

`npm run dev` affiche une adresse **Network** en **`https://`** du genre
`https://192.168.2.140:5173`. Tape-la dans Safari sur l'iPad, sur le même Wi-Fi,
PC allumé.

**Le serveur est en HTTPS, et ce n'est pas un caprice.** Safari (iOS) et Chrome
refusent désormais une adresse en `http://`, même vers une IP du réseau local :
ils forcent HTTPS avant même d'essayer. Symptômes si on l'oublie :

- sur PC : « la connexion n'est pas sécurisée » ;
- sur iPad : « une connexion sécurisée au serveur n'a pu être établie ».

Ce message est trompeur : il ne veut **pas** dire que l'iPad ne joint pas le PC.
Au contraire, il prouve qu'il l'a joint, et que seule la poignée de main TLS a
échoué. (Si le réseau était en cause, Safari dirait « impossible de se connecter
au serveur ».)

D'où [`@vitejs/plugin-basic-ssl`](https://github.com/vitejs/vite-plugin-basic-ssl)
dans [`vite.config.js`](vite.config.js), qui fabrique un certificat auto-signé.
Comme personne ne l'a signé, **Safari affiche un avertissement au premier accès** :
**Afficher les détails → Visiter ce site web**. Une seule fois par appareil.

Tout ceci ne concerne **que** le développement. La version publiée sur GitHub
Pages a un vrai certificat et s'ouvre sans aucun avertissement.

## Comment jouer

- **Sur iPad** : pose ton pouce **n'importe où** et fais-le glisser. Le personnage
  marche dans cette direction. Plus tu t'éloignes de ton point de départ, plus il
  va vite, jusqu'au bord de l'anneau. Tu lèves le doigt, il s'arrête.
- **Sur PC** : les **flèches**, ou un **clic** pour marcher vers le curseur (et un
  autre clic pour s'arrêter). Le rond au sol est vert quand il marche, gris sinon.

La récolte est **automatique** au contact.

Le jeu détecte tout seul : un doigt bascule en mode tactile, une souris ou une
flèche revient en mode PC.

### Les plantes

| Plante | Couleur | Points |
|---|---|---|
| Mousse-bleue | bleu | 1 |
| Épi doré | jaune | 3 |
| Trompette pourpre | violet | 5 |
| Étoile-de-feu | orange | 10 |
| Cristal-lune | cyan lumineux | 25, et seulement 8 secondes |

### Les profils

Trois joueurs (**Raphaël, Papi, Invité**), chacun avec **son propre record**,
affichés côte à côte sur l'écran de départ. Personne n'écrase le score de
personne, et battre son papi est une motivation redoutable.

- Le dernier joueur est mémorisé : jouer dix parties d'affilée ne demande aucun clic de plus.
- **Appui long de 2 secondes** sur un nom : remet à zéro **ce joueur seulement**.
- Les records sont dans le `localStorage`, donc **propres à chaque appareil**. Le
  record du PC et celui de l'iPad sont séparés (les partager exigerait un serveur).
  Ils disparaissent si on efface les données de Safari, et ne survivent pas à la
  navigation privée.

Pour changer les noms : la constante `JOUEURS` dans [`src/reglages.js`](src/reglages.js).

### Les niveaux

Trois boutons sur l'écran de départ, **Facile / Moyen / Difficile**, changent le
rythme d'arrivée des Rôdeurs (la partie dure toujours 60 secondes) :

| Niveau | Arrivée des Rôdeurs | Rôdeurs en fin de partie |
|---|---|---|
| Facile | 0 s, puis 30 s | 2 |
| Moyen | 0, 20, 40 s | 3 |
| Difficile | toutes les 10 s | 6 |

Le niveau choisi est mémorisé dans le `localStorage`, comme le dernier joueur.
Les calendriers d'apparition sont la constante `NIVEAUX_APPARITION` dans
[`src/reglages.js`](src/reglages.js) : ajouter un niveau ne demande qu'une ligne.

### Le tableau 2 : Les Rochers

Un **second tableau**, débloqué en récompense, où de petits rochers servent
d'obstacles à contourner (joueur **et** Rôdeurs sont bloqués et glissent le long).
Le sol et le ciel sont re-teintés pour signaler un autre lieu.

- **Déverrouillage** : quand le record du profil au **tableau 1 atteint 560**
  (`SEUIL_TABLEAU_2`). C'est **par profil** : chacun le mérite de son côté. Le
  déblocage n'est pas un drapeau stocké, il se **déduit du record** : remettre le
  record à zéro (appui long) re-verrouille automatiquement le tableau 2.
- **Trois niveaux aussi**, avec le même rythme de Rôdeurs que le tableau 1, mais
  un nombre de rochers croissant : Facile **4**, Moyen **8**, Difficile **12**
  (`NB_ROCHERS`). Les rochers sont placés au hasard à chaque partie, loin du
  départ et espacés ; plantes et cristaux les évitent.
- **Records séparés** : chaque profil a un record tableau 1 (`T1`) et tableau 2
  (`T2`). L'écran de départ affiche un cadenas tant que le tableau 2 est
  verrouillé, puis les deux scores une fois débloqué.

## Régler la difficulté

Tout est dans [`src/reglages.js`](src/reglages.js). **Ces chiffres viennent de
`jeux_1` où ils ont été MESURÉS, pas devinés.** Ne pas les changer sans mesurer
à nouveau (`npm test` donne le score du pilote automatique).

| Réglage | Effet |
|---|---|
| `VITESSE_ENNEMI` | 65% du joueur. **Ne jamais dépasser 100%** : les Rôdeurs deviendraient inévitables. |
| `NB_PLANTES` | 120. En dessous de 80, le champ paraît vide. |
| `RAYON_RECOLTE` | 1.3 m. Augmenter si c'est trop dur. |
| `RAYON_JOYSTICK` | 70 px : écart du pouce donnant la vitesse maximale. Baisser le rend plus nerveux. |
| `ZONE_MORTE_JOYSTICK` | 8 px : en dessous, on ne bouge pas. Monter si le personnage part tout seul. |
| `SEUIL_TABLEAU_2` | 560 : record du tableau 1 pour débloquer les Rochers. Baisser si c'est trop dur à atteindre. |
| `NB_ROCHERS` | `[4, 8, 12]` par niveau. Au-delà, le champ sature et des passages se ferment. |
| `ROCHER_RAYON_COLLISION` | 1.3 m : à quelle distance on bute sur un rocher. |

## Vérifier

```bash
npm test                      # tout
npx playwright test --project=pc      # format 16:9
npx playwright test --project=ipad    # format 4:3
```

Les tests font jouer une **partie complète en pilote automatique**, prennent des
captures dans `tests/captures/`, et vérifient :

- que la boucle tourne 60 secondes sans erreur ;
- que **le nombre de pas est exactement 3600** (voir « pas fixe » plus bas) ;
- que le score reste dans un ordre de grandeur crédible ;
- que le **joystick** fait marcher le personnage dans la bonne direction, qu'il
  s'arrête quand on lève le doigt, et qu'un **deuxième doigt ne vole pas le contrôle** ;
- que la **largeur de champ visible est identique en 16:9 et en 4:3**.

`?test` expose les crochets de test, `?test&auto` fait en plus **jouer** le robot.
Les deux sont séparés parce que le pilote force les flèches à chaque pas : sans
cette séparation, il fausserait tout test des commandes.

**Ce que les tests ne peuvent pas faire :** Chromium n'est pas Safari, et aucun
test ne dira si le pouce de Raphaël tombe au bon endroit. L'essai sur le vrai
iPad reste indispensable.

## Publier sur GitHub Pages

```bash
npm run build     # produit dist/
```

**C'est déjà fait**, et il n'y a plus rien à configurer : un `git push` sur `main`
suffit désormais à mettre le jeu à jour. Le workflow
([`.github/workflows/pages.yml`](.github/workflows/pages.yml)) construit et publie
tout seul, en une trentaine de secondes.

Suivre une publication : `gh run list` puis `gh run view <id> --log-failed`.

Piège rencontré la première fois : le workflow échoue avec
`Get Pages site failed... Not Found` tant que Pages n'est pas activé sur le dépôt.
C'est fait (`build_type: workflow`), mais si tu recrées un jour un dépôt, il faut
activer Pages **avant** le premier push, ou relancer le workflow ensuite.

## Décisions de conception qui méritent une explication

- **Pas de simulation fixe (1/60 s), découplé de l'affichage.** Sans ça, sur une
  machine lente le joueur avancerait de presque un mètre d'un coup et
  **traverserait les plantes sans les toucher**. Le test le vérifie : 3600 pas
  exactement, que la machine tourne à 60 ou à 10 images/seconde.
- **L'ouverture de la caméra s'adapte à la forme de l'écran** pour garder une
  **largeur de champ constante** (35,64 m, mesuré). Un iPad est en 4:3, un PC en
  16:9 : à ouverture fixe, l'iPad aurait vu le champ plus étroit, les Rôdeurs
  seraient arrivés plus tard, et le jeu aurait été plus dur sans que personne
  comprenne pourquoi. L'iPad voit donc plus haut et plus bas, mais autant sur les
  côtés — et c'est par les côtés qu'arrive le danger.
- **Joystick flottant, pas fixe.** Un joystick dessiné à un endroit fixe oblige
  l'enfant à quitter l'action des yeux pour retrouver le bouton.
- **Le premier doigt commande, et lui seul.** Un pouce oublié sur le bord de
  l'iPad ne doit jamais figer le personnage.
- **Pas de bascule au tactile.** Doigt posé = je marche, doigt levé = je m'arrête :
  c'est explicite par nature. La bascule au clic ne sert que la souris, où il
  fallait bien un moyen de s'arrêter sans tenir le bouton.
- **L'interface est en HTML, pas en 3D.** Texte net à toute densité d'écran,
  accents corrects, mise en page adaptative gratuite.
- **Le son se débloque au premier geste.** iOS interdit à une page de faire du
  bruit avant. L'écran de départ en demande un de toute façon.
- **Le sol (120 m) déborde largement l'aire de jeu (50 m).** Sinon, quand le
  joueur longe le bord, la caméra placée derrière lui filme au-delà du plan et
  laisse voir le vide. Bug constaté en jouant à la version Python.
- **Géométries et matériaux partagés, arbres fusionnés.** L'iPad de 2022 n'a pas
  besoin de plus ; on optimisera si une mesure le réclame, pas avant.

## Les fichiers

| Fichier | Rôle |
|---|---|
| [`src/reglages.js`](src/reglages.js) | **Tous les chiffres.** Le seul fichier à toucher pour équilibrer. |
| [`src/monde.js`](src/monde.js) | Sol, arbres, lumières, caméra. |
| [`src/plantes.js`](src/plantes.js) | Les cinq plantes. |
| [`src/personnages.js`](src/personnages.js) | Le fermier et les Rôdeurs. |
| [`src/rochers.js`](src/rochers.js) | Les rochers-obstacles du tableau 2. |
| [`src/commandes.js`](src/commandes.js) | Joystick tactile, souris, flèches. |
| [`src/jeu.js`](src/jeu.js) | L'état et la boucle de partie. |
| [`src/interface.js`](src/interface.js) | HUD, écrans, profils. |
| [`src/sons.js`](src/sons.js) | Chargement et déblocage iOS. |
| [`src/pilote-auto.js`](src/pilote-auto.js) | Le robot qui joue tout seul (tests). |
| [`scripts/icone.js`](scripts/icone.js) | Dessine les icônes (`node scripts/icone.js`). |
| `public/sons/` | Les WAV, **synthétisés par `jeux_1/sons.py`** et copiés tels quels. |
