import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : indispensable pour GitHub Pages, qui sert le site depuis
  // un sous-dossier (/nom-du-depot/) et non depuis la racine du domaine.
  base: './',
  server: {
    // --host permet a l'iPad de se connecter au PC en Wi-Fi local pour tester.
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,   // les WAV restent des fichiers, pas du base64
  },
});
