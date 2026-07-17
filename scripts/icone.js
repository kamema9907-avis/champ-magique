/**
 * Genere les icones de l'ecran d'accueil.
 *
 * On les DESSINE plutot que d'aller chercher une image : rien a telecharger,
 * rien a crediter, et on peut les regenerer a volonte.
 *
 *   node scripts/icone.js
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DOSSIER, '..', 'public');

// Un Cristal-lune cyan sur le vert du champ : c'est l'objet le plus reconnaissable
// du jeu, et le contraste cyan sur vert reste lisible a 60 pixels sur un iPad.
const PAGE = `<!DOCTYPE html><html><body style="margin:0">
<canvas id="c"></canvas>
<script>
function dessiner(taille) {
  const c = document.getElementById('c');
  c.width = c.height = taille;
  const g = c.getContext('2d');
  const u = taille / 512;   // tout est defini pour 512, puis mis a l'echelle

  const fond = g.createLinearGradient(0, 0, 0, taille);
  fond.addColorStop(0, '#6fbb36');
  fond.addColorStop(1, '#48891f');
  g.fillStyle = fond;
  g.fillRect(0, 0, taille, taille);

  // Quelques touffes de Mousse-bleue, pour que ce soit un champ et pas un aplat.
  g.fillStyle = 'rgba(61,123,255,.95)';
  for (const [x, y, r] of [[86, 404, 30], [126, 420, 20], [408, 396, 26], [376, 416, 17]]) {
    g.beginPath(); g.arc(x * u, y * u, r * u, 0, Math.PI * 2); g.fill();
  }

  // Le halo du cristal
  const halo = g.createRadialGradient(256 * u, 236 * u, 10 * u, 256 * u, 236 * u, 150 * u);
  halo.addColorStop(0, 'rgba(61,242,255,.55)');
  halo.addColorStop(1, 'rgba(61,242,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, taille, taille);

  // Le cristal lui-meme : un losange, comme dans le jeu.
  const cx = 256 * u, cy = 236 * u, l = 92 * u, h = 148 * u;
  g.beginPath();
  g.moveTo(cx, cy - h); g.lineTo(cx + l, cy); g.lineTo(cx, cy + h); g.lineTo(cx - l, cy);
  g.closePath();
  const corps = g.createLinearGradient(cx - l, cy - h, cx + l, cy + h);
  corps.addColorStop(0, '#ceffff');
  corps.addColorStop(.5, '#3df2ff');
  corps.addColorStop(1, '#12a8c8');
  g.fillStyle = corps;
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = 5 * u;
  g.stroke();
  // Une facette claire, pour que ca lise comme un cristal et non comme un carre.
  g.beginPath();
  g.moveTo(cx, cy - h); g.lineTo(cx + l, cy); g.lineTo(cx, cy);
  g.closePath();
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.fill();

  return c;
}
</script></body></html>`;

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent(PAGE);

for (const taille of [180, 512]) {
  await page.evaluate((t) => dessiner(t), taille);
  const donnees = await page.evaluate(() =>
    document.getElementById('c').toDataURL('image/png').split(',')[1]);
  const fichier = path.join(PUBLIC, `icone-${taille}.png`);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(fichier, Buffer.from(donnees, 'base64'));
  console.log('icone ecrite :', fichier);
}

await navigateur.close();
