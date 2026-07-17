/**
 * Ce qui est propre a l'iPad : forme d'ecran et joystick tactile.
 *
 * Rappel honnete : Chromium n'est pas Safari. Ces tests attrapent les erreurs de
 * logique, pas les differences de moteur. L'essai sur le vrai iPad reste
 * indispensable.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES = path.join(DOSSIER, 'captures');

/** ?test SANS &auto : le robot ne joue pas, sinon il ferait bouger le
 *  personnage aux fleches et fausserait toute mesure des commandes. */
async function ouvrir(page) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  await page.goto('/?test');
  await page.waitForFunction(() => window.__test !== undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__test.piloteActif())).toBe(false);
  return erreurs;
}

test('la largeur de champ visible est la meme en 16:9 et en 4:3', async ({ browser }) => {
  const mesures = {};
  for (const [nom, taille] of Object.entries({
    pc: { width: 1280, height: 720 },      // 16:9
    ipad: { width: 1180, height: 820 },    // ~4:3 paysage
  })) {
    const page = await browser.newPage({ viewport: taille });
    await ouvrir(page);
    await page.evaluate(() => window.__test.demarrer());
    mesures[nom] = await page.evaluate(() => ({
      largeur: window.__test.largeurVisible(),
      ouverture: window.__test.ouverture(),
      rapport: window.__test.rapport(),
    }));
    await page.screenshot({ path: path.join(CAPTURES, `test_forme_${nom}.png`) });
    await page.close();
  }

  console.log('  PC   :', JSON.stringify(mesures.pc));
  console.log('  iPad :', JSON.stringify(mesures.ipad));

  // Le coeur de la decision : l'iPad doit voir AUTANT sur les cotes, sinon les
  // Rodeurs y arriveraient plus tard et le jeu serait plus dur sans raison.
  expect(Math.abs(mesures.pc.largeur - mesures.ipad.largeur)).toBeLessThan(0.5);
  // ... en compensant par une ouverture verticale plus grande sur l'ecran carre.
  expect(mesures.ipad.ouverture).toBeGreaterThan(mesures.pc.ouverture + 5);
});

test('les fleches vont dans le bon sens A L\'ECRAN', async ({ page }) => {
  await ouvrir(page);
  await page.evaluate(() => window.__test.demarrer());
  await page.waitForTimeout(200);
  console.log('  repere ecran :', JSON.stringify(await page.evaluate(() => window.__test.repereEcran())));

  // Chaque fleche est testee separement, en pixels d'ecran. Les fleches
  // souffraient du meme bug d'inversion que le tactile : personne ne l'avait vu
  // parce que la souris, elle, passe par un lancer de rayon et reste juste.
  const attendus = [
    ['ArrowRight', 'droite', (ex, ey) => ex > 20 && Math.abs(ey) < 20],
    ['ArrowLeft', 'gauche', (ex, ey) => ex < -20 && Math.abs(ey) < 20],
    ['ArrowUp', 'haut', (ex, ey) => ey < -20 && Math.abs(ex) < 20],
    ['ArrowDown', 'bas', (ex, ey) => ey > 20 && Math.abs(ex) < 20],
  ];

  for (const [touche, sens, verifie] of attendus) {
    const avant = await page.evaluate(() => window.__test.etat().joueur);
    await page.evaluate((t) => window.__test.forcerFleches([t]), touche);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__test.forcerFleches([]));
    const apres = await page.evaluate(() => window.__test.etat().joueur);

    const ecran = await page.evaluate(([a, b]) => ({
      avant: window.__test.projeter(a.x, a.z),
      apres: window.__test.projeter(b.x, b.z),
    }), [avant, apres]);
    const ex = ecran.apres.x - ecran.avant.x;
    const ey = ecran.apres.y - ecran.avant.y;

    console.log(`  ${touche.padEnd(11)} -> (${ex.toFixed(0)} px, ${ey.toFixed(0)} px)  attendu : ${sens}`);
    expect(verifie(ex, ey), `${touche} doit deplacer le personnage vers le ${sens} de l'ecran`).toBe(true);
  }
});

test.describe('joystick tactile', () => {
  // On ne prend pas le prereglage devices['iPad...'] : il impose WebKit, ce qui
  // forcerait un autre worker. On decrit donc l'iPad a la main.
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  test('le doigt fait marcher le personnage dans la bonne direction, et le lever l\'arrete',
    async ({ page }) => {
      const erreurs = await ouvrir(page);
      await page.evaluate(() => window.__test.demarrer());
      await page.waitForTimeout(300);

      const milieu = page.viewportSize();
      const depart = await page.evaluate(() => window.__test.etat().joueur);

      // Un vrai doigt : on pose en bas a gauche (comme un pouce) et on tire vers
      // le haut a droite. Le personnage doit donc partir en +x et +z.
      await page.touchscreen.tap(1, 1);   // reveille le mode tactile
      const origineX = milieu.width * 0.25;
      const origineY = milieu.height * 0.75;

      await page.evaluate(([x, y]) => {
        const cible = document.getElementById('scene');
        cible.dispatchEvent(new PointerEvent('pointerdown', {
          pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true,
        }));
      }, [origineX, origineY]);

      // On tire le pouce de 60 px vers la droite et 60 px vers le haut.
      await page.evaluate(([x, y]) => {
        window.dispatchEvent(new PointerEvent('pointermove', {
          pointerId: 1, pointerType: 'touch', clientX: x + 60, clientY: y - 60, bubbles: true,
        }));
      }, [origineX, origineY]);

      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(CAPTURES, 'test_joystick.png') });

      const pendant = await page.evaluate(() => window.__test.etat());

      // On mesure le deplacement A L'ECRAN, pas dans le monde. Verifier que le
      // joueur va vers "+X du monde" ne verifierait que mon hypothese sur
      // l'orientation de la camera : c'est precisement ce trou qui a laisse
      // passer une inversion gauche/droite jusque sur l'iPad de Raphael.
      const ecran = await page.evaluate(([a, b]) => ({
        avant: window.__test.projeter(a.x, a.z),
        apres: window.__test.projeter(b.x, b.z),
      }), [depart, pendant.joueur]);

      const ex = ecran.apres.x - ecran.avant.x;
      const ey = ecran.apres.y - ecran.avant.y;
      console.log(`  mode=${pendant.mode}  deplacement a l'ecran = ` +
                  `(${ex.toFixed(0)} px, ${ey.toFixed(0)} px)  ` +
                  `(attendu : vers la droite et vers le haut)`);

      expect(pendant.mode).toBe('tactile');
      // Pouce tire en HAUT a DROITE : le personnage doit aller a droite...
      expect(ex).toBeGreaterThan(20);
      // ... et vers le haut de l'ecran (y diminue vers le haut).
      expect(ey).toBeLessThan(-20);

      // On leve le doigt : il doit s'arreter net. Pas de bascule au tactile.
      await page.evaluate(() => {
        window.dispatchEvent(new PointerEvent('pointerup', {
          pointerId: 1, pointerType: 'touch', bubbles: true,
        }));
      });
      await page.waitForTimeout(200);
      const avantArret = await page.evaluate(() => window.__test.etat().joueur);
      await page.waitForTimeout(600);
      const apresArret = await page.evaluate(() => window.__test.etat().joueur);

      const bouge = Math.hypot(apresArret.x - avantArret.x, apresArret.z - avantArret.z);
      console.log(`  apres avoir leve le doigt, a bouge de ${bouge.toFixed(2)} m (attendu ~0)`);
      expect(bouge).toBeLessThan(0.05);

      expect(erreurs).toEqual([]);
    });

  test('un deuxieme doigt ne prend jamais la main sur le premier', async ({ page }) => {
    await ouvrir(page);
    await page.evaluate(() => window.__test.demarrer());
    await page.waitForTimeout(300);

    // Le premier doigt commande et ne bouge pas : le personnage doit rester immobile.
    await page.evaluate(() => {
      document.getElementById('scene').dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 600, bubbles: true,
      }));
      // Un deuxieme doigt se pose ailleurs et tire fort : il doit etre IGNORE,
      // sinon un pouce oublie sur le bord de l'iPad volerait le controle.
      document.getElementById('scene').dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 2, pointerType: 'touch', clientX: 800, clientY: 200, bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 2, pointerType: 'touch', clientX: 900, clientY: 100, bubbles: true,
      }));
    });

    const avant = await page.evaluate(() => window.__test.etat().joueur);
    await page.waitForTimeout(700);
    const apres = await page.evaluate(() => window.__test.etat().joueur);
    const bouge = Math.hypot(apres.x - avant.x, apres.z - avant.z);
    console.log(`  avec un 2e doigt qui tire, a bouge de ${bouge.toFixed(2)} m (attendu ~0)`);
    expect(bouge).toBeLessThan(0.05);
  });
});
