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

test('migration : un ancien record numerique devient le record du tableau 1, verrouille', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': 45 });
  const texte = await recordDe(page, 'Raphaël').textContent();
  expect(texte).toContain('45');       // repris tel quel comme record du tableau 1
  expect(texte).toContain('🔒');       // 45 < 560 : tableau 2 verrouille
  expect(erreurs).toEqual([]);
});

test('un record t1 >= 560 debloque : deux nombres au lieu du cadenas', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 120 } });
  const texte = await recordDe(page, 'Raphaël').textContent();
  expect(texte).toContain('T1 600');
  expect(texte).toContain('T2 120');
  expect(texte).not.toContain('🔒');
  expect(erreurs).toEqual([]);
});

test('franchir 560 affiche le message de deblocage; un score au tableau 2 met a jour le record t2', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': 559 });

  // Fin d'une partie tableau 1 avec un score qui franchit le seuil pour la 1re fois.
  await page.evaluate(() => window.__test.afficherFin(560, 1));
  await expect(page.locator('.deblocage')).toHaveText(/Tableau 2 débloqué/);
  expect(await recordDe(page, 'Raphaël').textContent()).toContain('T1 560');

  // Un score au tableau 2 met a jour le record t2, sans re-afficher le deblocage.
  await page.evaluate(() => window.__test.afficherFin(200, 2));
  await expect(page.locator('.deblocage')).toHaveCount(0);
  expect(await recordDe(page, 'Raphaël').textContent()).toContain('T2 200');

  expect(erreurs).toEqual([]);
});

test('un petit score au tableau 1 quand on est deja debloque ne remontre pas le message', async ({ page }) => {
  const erreurs = await ouvrirAvecRecords(page, { 'Raphaël': { t1: 600, t2: 0 } });
  await page.evaluate(() => window.__test.afficherFin(300, 1));
  await expect(page.locator('.deblocage')).toHaveCount(0);
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
