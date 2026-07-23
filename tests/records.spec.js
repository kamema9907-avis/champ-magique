/**
 * Records par tableau et deverrouillage du tableau 2.
 *
 * On teste la logique de donnees SANS jouer 60 secondes : on ensemence le
 * localStorage avant le chargement, et on appelle le crochet __test.afficherFin
 * pour verifier le record mis a jour, le cadenas et le message de deblocage.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES = process.env.DOSSIER_CAPTURES || path.join(DOSSIER, 'captures');

// Doit correspondre a R.CLE_STOCKAGE dans reglages.js.
const CLE = 'champ-magique.records';

/** Charge le jeu avec un localStorage de records deja rempli. */
async function ouvrirAvecRecords(page, valeur) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  await page.addInitScript((arg) => {
    localStorage.setItem(arg.cle, JSON.stringify(arg.v));
  }, { cle: CLE, v: valeur });
  await page.goto('/?test');
  await page.waitForFunction(() => window.__test !== undefined, { timeout: 30_000 });
  return erreurs;
}

/** Le texte du record affiche sous un profil. */
function recordDe(page, nom) {
  return page.locator('.joueur', { hasText: nom }).locator('.record');
}

test('migration : un ancien record numerique devient le record du tableau 1', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': 45 });
  // Tableau 1 selectionne par defaut : le profil montre le record repris.
  expect(await recordDe(page, 'Raphaël').textContent()).toContain('45');
  // Le tableau 2 reste verrouille (45 < 560).
  await expect(page.locator('#tableaux .tableau').nth(1)).toHaveClass(/verrouille/);
  expect(erreurs).toEqual([]);
});

test('un record t1 >= 560 debloque le tableau 2, dont le record s affiche a la selection', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 120 } });
  // Tableau 1 selectionne : profil montre T1 600.
  expect(await recordDe(page, 'Raphaël').textContent()).toContain('T1 600');
  const boutonT2 = page.locator('#tableaux .tableau').nth(1);
  await expect(boutonT2).not.toHaveClass(/verrouille/);
  // On selectionne le tableau 2 : les profils montrent alors leur record T2.
  await boutonT2.click();
  expect(await recordDe(page, 'Raphaël').textContent()).toContain('T2 120');
  expect(erreurs).toEqual([]);
});

test('franchir le seuil affiche le message; un score au tableau 2 met a jour le record t2', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': 559 });

  // Fin d'une partie tableau 1 avec un score qui franchit le seuil pour la 1re fois.
  await page.evaluate(() => window.__test.afficherFin(560, 1));
  await expect(page.locator('.deblocage')).toContainText('débloqué');

  // On selectionne le tableau 2 (desormais ouvert) et on y termine une partie.
  await page.locator('#tableaux .tableau').nth(1).click();
  await page.evaluate(() => window.__test.afficherFin(200, 2));
  await expect(page.locator('.deblocage')).toHaveCount(0);   // 200 < 560 : n'ouvre pas le T3
  expect(await recordDe(page, 'Raphaël').textContent()).toContain('T2 200');

  expect(erreurs).toEqual([]);
});

test('deverrouillage en chaine : un T2 atteint ouvre le tableau 3, pas encore le 4', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 600 } });
  await expect(page.locator('#tableaux .tableau').nth(2)).not.toHaveClass(/verrouille/);  // T3 ouvert
  await expect(page.locator('#tableaux .tableau').nth(3)).toHaveClass(/verrouille/);       // T4 ferme
  expect(erreurs).toEqual([]);
});

test('un bon score au tableau 2 debloque le tableau 3 (message avec son nom)', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 559 } });
  await page.evaluate(() => window.__test.afficherFin(560, 2));
  await expect(page.locator('.deblocage')).toContainText('Forêt Gelée');
  await expect(page.locator('#tableaux .tableau').nth(2)).not.toHaveClass(/verrouille/);
  expect(erreurs).toEqual([]);
});

test('un petit score au tableau 1 quand on est deja debloque ne remontre pas le message', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 0 } });
  await page.evaluate(() => window.__test.afficherFin(300, 1));
  await expect(page.locator('.deblocage')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('niveaux verrouilles pour un profil neuf : seul Facile est ouvert', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, {});
  const niveaux = page.locator('#niveaux .niveau');
  await expect(niveaux.nth(0)).not.toHaveClass(/verrouille/);   // Facile ouvert
  await expect(niveaux.nth(1)).toHaveClass(/verrouille/);       // Moyen ferme (< 460)
  await expect(niveaux.nth(2)).toHaveClass(/verrouille/);       // Difficile ferme (< 510)
  // Cliquer sur Moyen verrouille montre l'indice et ne le selectionne pas.
  await niveaux.nth(1).click();
  await expect(page.locator('#niveau-indice')).toContainText('460');
  await expect(niveaux.nth(1)).not.toHaveClass(/actif/);
  expect(erreurs).toEqual([]);
});

test('record 460 au tableau 1 ouvre Moyen, pas encore Difficile', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 460 } });
  const niveaux = page.locator('#niveaux .niveau');
  await expect(niveaux.nth(1)).not.toHaveClass(/verrouille/);   // Moyen ouvert (>= 460)
  await expect(niveaux.nth(2)).toHaveClass(/verrouille/);       // Difficile ferme (< 510)
  expect(erreurs).toEqual([]);
});

test('record 510 au tableau 1 ouvre Moyen ET Difficile', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 510 } });
  const niveaux = page.locator('#niveaux .niveau');
  await expect(niveaux.nth(1)).not.toHaveClass(/verrouille/);
  await expect(niveaux.nth(2)).not.toHaveClass(/verrouille/);
  expect(erreurs).toEqual([]);
});

test('les niveaux debloques dependent du tableau : Difficile au T1 mais pas au T2 neuf', async ({ page }) => {
  // Record eleve au tableau 1 (ouvre le T2 et tous ses niveaux au T1), mais rien au T2.
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 0 } });
  const niveaux = page.locator('#niveaux .niveau');
  // Au tableau 1 : Difficile ouvert.
  await expect(niveaux.nth(2)).not.toHaveClass(/verrouille/);
  // On passe au tableau 2 (debloque) : ses niveaux repartent de zero.
  await page.locator('#tableaux .tableau').nth(1).click();
  await expect(niveaux.nth(1)).toHaveClass(/verrouille/);       // Moyen ferme au T2
  await expect(niveaux.nth(2)).toHaveClass(/verrouille/);       // Difficile ferme au T2
  expect(erreurs).toEqual([]);
});

test('la chaine de deverrouillage va jusqu au tableau 8', async ({ page }) => {
  const plein = {};
  for (let t = 1; t <= 7; t++) plein['t' + t] = 560;   // ouvre jusqu'a T8
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': plein });
  await expect(page.locator('#tableaux .tableau')).toHaveCount(8);
  await expect(page.locator('#tableaux .tableau').nth(7)).not.toHaveClass(/verrouille/);   // T8 ouvert
  expect(erreurs).toEqual([]);
});

test('legende du menu : fleurs sur le tableau 1, legumes sur un tableau 5-8', async ({ page }) => {
  const plein = {};
  for (let t = 1; t <= 8; t++) plein['t' + t] = 600;
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': plein });
  await expect(page.locator('#legende')).toContainText('Mousse-bleue');   // T1 : fleurs
  await page.locator('#tableaux .tableau').nth(4).click();                // Tableau 5
  await expect(page.locator('#legende')).toContainText('Carotte');        // legumes
  await expect(page.locator('#legende')).not.toContainText('Mousse-bleue');
  expect(erreurs).toEqual([]);
});

test('tableau 2 verrouille pour un profil neuf : cliquer montre l indice, sans le selectionner', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, {});
  const boutonT2 = page.locator('#tableaux .tableau').nth(1);
  await expect(boutonT2).toHaveClass(/verrouille/);
  await expect(boutonT2).toContainText('🔒');
  await page.screenshot({ path: path.join(CAPTURES, 'test_6_menu_tableaux.png') });

  await boutonT2.click();
  await expect(page.locator('#tableau-indice')).toContainText('560');
  await expect(boutonT2).not.toHaveClass(/actif/);
  expect(erreurs).toEqual([]);
});

test('tableau 2 debloque : on le selectionne et une partie y demarre avec des rochers', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 0 } });
  const boutonT2 = page.locator('#tableaux .tableau').nth(1);
  await expect(boutonT2).not.toHaveClass(/verrouille/);

  await boutonT2.click();
  await expect(boutonT2).toHaveClass(/actif/);

  await page.locator('#action').click();
  const etat = await page.evaluate(() => window.__test.etat());
  expect(etat.tableau).toBe(2);
  expect(etat.rochers).toBeGreaterThan(0);
  expect(erreurs).toEqual([]);
});
