import { defineConfig } from 'vite';
import ssl from '@vitejs/plugin-basic-ssl';

// Safari (iOS) et Chrome forcent desormais HTTPS, meme vers une adresse IP
// locale : une adresse en http:// est refusee avant meme d'essayer. Le serveur
// de developpement parle donc HTTPS avec un certificat auto-signe.
//
// Consequence a connaitre : le certificat n'etant signe par personne, le
// navigateur affiche un avertissement au premier acces. Sur l'iPad :
// "Afficher les details" -> "Visiter ce site web". Une fois par appareil.
//
// Rien de tout cela ne concerne la version publiee : GitHub Pages fournit un
// vrai certificat, et le jeu s'ouvre sans le moindre avertissement.
export default defineConfig({
  // Chemins relatifs : indispensable pour GitHub Pages, qui sert le site depuis
  // un sous-dossier (/nom-du-depot/) et non depuis la racine du domaine.
  base: './',
  plugins: [ssl()],
  server: {
    // host: true expose le serveur sur le Wi-Fi local, pour tester sur l'iPad.
    host: true,
    port: 5173,
  },
  // Les tests Playwright n'ont pas besoin de HTTPS et n'auraient qu'a ignorer un
  // certificat auto-signe : l'apercu reste donc en HTTP simple.
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,   // les WAV restent des fichiers, pas du base64
  },
});
