/**
 * Les sons. Ce sont les WAV synthetises par sons.py dans jeux_1, copies tels
 * quels : ils sonnent deja juste, autant ne pas refaire ce qui marche.
 *
 * Le piege iOS : Safari interdit a une page de faire du bruit tant que
 * l'utilisateur n'a pas touche l'ecran. Il faut donc "debloquer" le contexte
 * audio DANS le gestionnaire d'un vrai geste, ce que fait deverrouiller().
 * Notre ecran de depart en demande un de toute facon.
 */

const NOMS = ['recolte_1', 'recolte_3', 'recolte_5', 'recolte_10', 'recolte_25',
              'cristal_apparait', 'degat', 'debut', 'fin', 'tic'];

const BASE = import.meta.env.BASE_URL ?? '/';

export function creerSons() {
  let contexte = null;
  const tampons = new Map();
  let pret = false;
  let muet = false;

  async function charger() {
    contexte = new (window.AudioContext || window.webkitAudioContext)();
    await Promise.all(NOMS.map(async (nom) => {
      try {
        const reponse = await fetch(`${BASE}sons/${nom}.wav`);
        const donnees = await reponse.arrayBuffer();
        tampons.set(nom, await contexte.decodeAudioData(donnees));
      } catch (e) {
        console.warn('son introuvable :', nom, e);
      }
    }));
    pret = true;
  }

  /** A appeler DANS un gestionnaire de clic ou de toucher, jamais ailleurs. */
  async function deverrouiller() {
    if (!contexte) await charger();
    if (contexte.state === 'suspended') await contexte.resume();
  }

  function jouer(nom, volume = 1) {
    if (!pret || muet || !contexte || contexte.state !== 'running') return;
    const tampon = tampons.get(nom);
    if (!tampon) return;
    const source = contexte.createBufferSource();
    source.buffer = tampon;
    const gain = contexte.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(contexte.destination);
    source.start();
  }

  return {
    deverrouiller,
    jouer,
    recolte: (points) => jouer(`recolte_${points}`),
    set muet(valeur) { muet = valeur; },
    get muet() { return muet; },
    get pret() { return pret; },
  };
}
