/**
 * Verification automatisee.
 *
 * Ce que ces tests peuvent faire : verifier que le jeu tourne, mesurer le score
 * du pilote automatique, simuler de vrais evenements tactiles, et prendre des
 * captures que je peux regarder.
 *
 * Ce qu'ils NE peuvent PAS faire : remplacer un essai sur le vrai Safari du vrai
 * iPad. Chromium n'est pas Safari, et aucun test ne dira si le pouce de Raphael
 * tombe au bon endroit.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES = process.env.DOSSIER_CAPTURES || path.join(DOSSIER, 'captures');

/** Charge le jeu et remonte toute erreur de la page : sinon elles passent inapercues. */
async function ouvrir(page, requete = '?test&auto') {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  await page.goto(`/${requete}`);
  await page.waitForFunction(() => window.__test !== undefined, { timeout: 30_000 });
  return erreurs;
}

test('le jeu se charge et affiche le menu sans erreur', async ({ page }) => {
  const erreurs = await ouvrir(page);
  await expect(page.locator('#titre')).toHaveText('LA RÉCOLTE DU CHAMP MAGIQUE');
  await expect(page.locator('.joueur')).toHaveCount(3);
  await page.screenshot({ path: path.join(CAPTURES, 'test_1_menu.png') });
  expect(erreurs).toEqual([]);
});

test('une partie complete se joue et le score reste dans la fourchette de jeux_1', async ({ page }) => {
  test.setTimeout(180_000);
  const erreurs = await ouvrir(page);

  await page.evaluate(() => window.__test.cristalTot());
  await page.evaluate(() => window.__test.demarrer());
  // Le champignon bonus ajoute +5 s a la capture : on le desactive ici pour
  // garder l'invariant deterministe (exactement 3600 pas). Il est teste a part.
  await page.evaluate(() => window.__test.desactiverChampignon());

  // Le jeu se fige tout seul a l'apparition du cristal, donc la capture ne peut
  // pas arriver trop tard, quelle que soit la lenteur de la machine.
  await page.waitForFunction(() => window.__test.enPause(), { timeout: 30_000 });
  expect(await page.evaluate(() => window.__test.etat().cristal)).toBe(true);
  await page.screenshot({ path: path.join(CAPTURES, 'test_2_cristal.png') });
  await page.evaluate(() => window.__test.reprendre());

  const etapes = [];
  for (const cible of [45, 30, 15]) {
    await page.waitForFunction((c) => window.__test.etat().chrono <= c,
                               cible, { timeout: 60_000 });
    const etat = await page.evaluate(() => window.__test.etat());
    etapes.push(etat);
    await page.screenshot({ path: path.join(CAPTURES, `test_3_jeu_${cible}.png`) });
  }

  await page.waitForFunction(() => window.__test.etat().etat === 'fin', { timeout: 90_000 });
  const final = await page.evaluate(() => window.__test.etat());
  await page.screenshot({ path: path.join(CAPTURES, 'test_4_fin.png') });

  console.log('  etapes :', etapes.map((e) => `${e.chrono}s -> ${e.score} pts`).join(' | '));
  console.log('  SCORE FINAL =', final.score);
  const c = final.compteurs;
  console.log(`  recoltes=${c.recoltes} (dont ${c.cristaux} cristaux)  ` +
              `degats=${c.degats} (-${c.pointsPerdus} pts)  pas=${c.pas} (attendu ~3600)`);

  // Le champ ne doit jamais se vider, et le deuxieme Rodeur doit etre arrive.
  for (const etape of etapes) expect(etape.plantes).toBe(120);
  expect(etapes[etapes.length - 1].ennemis).toBe(2);

  // Invariant deterministe : 60 secondes a pas fixe font exactement 3600 pas,
  // quelle que soit la vitesse de la machine. C'est LA verification qui compte :
  // si elle casse, le jeu ne se deroule plus a la meme vitesse partout.
  expect(final.compteurs.pas).toBeGreaterThan(3590);
  expect(final.compteurs.pas).toBeLessThan(3610);

  // Le score, lui, est tres disperse : il depend du nombre de contacts avec les
  // Rodeurs (mesure : de 2 a 9 par partie, soit jusqu'a 300 points d'ecart).
  // Mesures sur 5 parties : 463 a 588, moyenne 511. La version Python donnait
  // 454 a 494, moyenne 480 : meme comportement, aux aleas pres.
  // Ces bornes larges sont donc un detecteur d'anomalie FRANCHE (un 200 ou un
  // 900 revelerait un vrai probleme), pas un controle au pourcent : un test qui
  // echoue au hasard ne vaut rien.
  expect(final.score).toBeGreaterThan(350);
  expect(final.score).toBeLessThan(700);
  expect(final.compteurs.cristaux).toBeGreaterThanOrEqual(3);

  expect(erreurs).toEqual([]);
});

test('tableau 2 : les rochers apparaissent, les plantes les evitent, et rien ne se coince', async ({ page }) => {
  test.setTimeout(60_000);
  const erreurs = await ouvrir(page);

  // Tableau 2, niveau Difficile : le maximum de rochers (12).
  await page.evaluate(() => window.__test.demarrer(2, 3));

  const etat = await page.evaluate(() => window.__test.etat());
  expect(etat.tableau).toBe(2);
  expect(etat.rochers).toBe(12);
  await page.screenshot({ path: path.join(CAPTURES, 'test_5_tableau2.png') });

  const COLLISION = 1.3;

  // Aucune plante ne doit naitre dans un rocher : sinon elle serait irrecoltable
  // (le joueur ne peut pas entrer dans le rocher pour l'atteindre).
  const rochers = await page.evaluate(() => window.__test.rochers());
  const plantes = await page.evaluate(() => window.__test.plantesPos());
  for (const p of plantes) {
    for (const r of rochers) {
      expect(Math.hypot(p.x - r.x, p.z - r.z)).toBeGreaterThanOrEqual(COLLISION);
    }
  }

  // On laisse le pilote jouer ~8 s en echantillonnant la position du joueur : il
  // ne doit JAMAIS se retrouver dans un rocher, et il doit continuer d'avancer
  // (preuve qu'aucun rocher ne le fige).
  let distanceMini = Infinity;
  const positions = [];
  for (let i = 0; i < 40; i++) {
    const j = await page.evaluate(() => window.__test.etat().joueur);
    positions.push(j);
    for (const r of rochers) {
      distanceMini = Math.min(distanceMini, Math.hypot(j.x - r.x, j.z - r.z));
    }
    await page.waitForTimeout(200);
  }

  // Jamais dans un rocher (petite tolerance pour l'arrondi a 2 decimales).
  expect(distanceMini).toBeGreaterThanOrEqual(COLLISION - 0.06);

  // Le joueur a bel et bien parcouru du chemin : il n'est pas coince.
  const deplacement = positions.slice(1).reduce((s, p, k) =>
    s + Math.hypot(p.x - positions[k].x, p.z - positions[k].z), 0);
  expect(deplacement).toBeGreaterThan(5);

  expect(erreurs).toEqual([]);
});

// Tableaux 3 et 4 : meme mecanique d'obstacles que le tableau 2 (deja testee en
// duree ci-dessus), on verifie ici le nombre d'obstacles, l'evitement des
// plantes, et on prend une capture pour juger le rendu.
for (const { tableau, nom } of [{ tableau: 3, nom: 'foret_gelee' }, { tableau: 4, nom: 'terres_de_feu' }]) {
  test(`tableau ${tableau} : obstacles en place et plantes a l'ecart`, async ({ page }) => {
    const erreurs = await ouvrir(page);
    await page.evaluate((t) => window.__test.demarrer(t, 3), tableau);

    const etat = await page.evaluate(() => window.__test.etat());
    expect(etat.tableau).toBe(tableau);
    expect(etat.rochers).toBe(12);
    await page.screenshot({ path: path.join(CAPTURES, `test_5_tableau${tableau}_${nom}.png`) });

    const rochers = await page.evaluate(() => window.__test.rochers());
    const plantes = await page.evaluate(() => window.__test.plantesPos());
    for (const p of plantes) {
      for (const r of rochers) {
        expect(Math.hypot(p.x - r.x, p.z - r.z)).toBeGreaterThanOrEqual(1.3);
      }
    }
    expect(erreurs).toEqual([]);
  });
}

test('champignon bonus : apparait et donne +5 s a la capture', async ({ page }) => {
  test.setTimeout(30_000);
  // Sans pilote (?test seul) : le joueur reste immobile, donc pas de capture
  // accidentelle avant celle qu'on declenche.
  const erreurs = await ouvrir(page, '?test');
  await page.evaluate(() => window.__test.demarrer());
  // Apres demarrer (qui tire une heure aleatoire), on force l'apparition tot.
  await page.evaluate(() => window.__test.champignonTot());

  await page.waitForFunction(() => window.__test.etat().champignon, { timeout: 15_000 });
  await page.screenshot({ path: path.join(CAPTURES, 'test_7_champignon.png') });

  const avant = await page.evaluate(() => window.__test.etat().chrono);
  await page.evaluate(() => window.__test.capturerChampignon());
  const apres = await page.evaluate(() => window.__test.etat().chrono);

  expect(await page.evaluate(() => window.__test.etat().champignon)).toBe(false);   // consomme
  expect(apres - avant).toBeGreaterThanOrEqual(4);   // +5 s (tolerance de l'arrondi)

  expect(erreurs).toEqual([]);
});
