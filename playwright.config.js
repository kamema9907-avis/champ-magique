import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // Le serveur de developpement est en HTTPS avec un certificat auto-signe (les
  // navigateurs refusent le http:// vers une IP locale), d'ou ignoreHTTPSErrors.
  use: { baseURL: 'https://localhost:5173', ignoreHTTPSErrors: true },
  projects: [
    // Deux formats, parce que c'est le coeur d'une decision de conception :
    // l'ouverture de camera s'adapte pour garder la MEME largeur de champ
    // visible sur un 16:9 et sur un 4:3. Il faut donc pouvoir comparer.
    { name: 'pc', use: { viewport: { width: 1280, height: 720 } } },      // 16:9
    { name: 'ipad', use: { viewport: { width: 1180, height: 820 } } },    // ~4:3 paysage
  ],
  // Vite est lance automatiquement pour les tests, et reutilise s'il tourne deja.
  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
