/**
 * Ecran de diagnostic des commandes, active par l'adresse ?debug.
 *
 * Il sert a DECOUVRIR ce qu'un peripherique envoie reellement au navigateur, la
 * ou on ne peut pas le deviner : une telecommande de TV dans Silk envoie-t-elle
 * des mouvements de souris ? des touches flechees ? est-elle vue comme un
 * gamepad ? A quelle cadence ? On lit ces faits a l'ecran, puis on concoit le
 * controle a la manette dessus. Outil de developpement : jamais pour un joueur.
 */

export function brancherDebug() {
  const boite = document.createElement('div');
  boite.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'z-index:9999',
    'max-width:70vw', 'padding:10px 12px',
    'background:rgba(0,0,0,.72)', 'color:#7dff9b',
    'font:14px/1.35 monospace', 'white-space:pre-wrap', 'pointer-events:none',
  ].join(';');
  document.body.appendChild(boite);

  const lignes = [];
  const ajouter = (texte) => {
    const t = new Date().toLocaleTimeString();
    lignes.unshift(`${t}  ${texte}`);
    if (lignes.length > 14) lignes.pop();
  };

  // Souris / curseur : type, position et VITESSE (ce qui compterait pour un
  // controle directionnel base sur le mouvement du curseur). Cadence limitee
  // pour rester lisible.
  let dernier = null;
  let prochainAffichage = 0;
  window.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now < prochainAffichage) return;
    prochainAffichage = now + 100;
    let v = '';
    if (dernier) {
      const dt = (now - dernier.t) / 1000;
      if (dt > 0) v = `  v=(${((e.clientX - dernier.x) / dt) | 0},${((e.clientY - dernier.y) / dt) | 0})px/s`;
    }
    dernier = { x: e.clientX, y: e.clientY, t: now };
    ajouter(`move ${e.pointerType} (${e.clientX | 0},${e.clientY | 0})${v}`);
  });
  window.addEventListener('pointerdown', (e) =>
    ajouter(`DOWN ${e.pointerType} bouton=${e.button} (${e.clientX | 0},${e.clientY | 0})`));
  window.addEventListener('pointerup', (e) => ajouter(`UP   ${e.pointerType} bouton=${e.button}`));
  window.addEventListener('keydown', (e) => ajouter(`KEYDOWN key=${e.key} code=${e.code} kc=${e.keyCode}`));
  window.addEventListener('keyup', (e) => ajouter(`keyup   key=${e.key}`));
  window.addEventListener('gamepadconnected', (e) => ajouter(`GAMEPAD connecte: ${e.gamepad.id}`));
  window.addEventListener('gamepaddisconnected', () => ajouter('gamepad deconnecte'));

  function boucle() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const actif = Array.from(pads).find((p) => p);
    let etatGamepad;
    if (actif) {
      const axes = actif.axes.map((a) => a.toFixed(2)).join(',');
      const boutons = actif.buttons
        .map((b, i) => (b.pressed ? i : null)).filter((i) => i !== null).join(',');
      etatGamepad = `gamepad: ${actif.id.slice(0, 28)}  axes=[${axes}]  btn=[${boutons}]`;
    } else {
      etatGamepad = 'gamepad: aucun detecte';
    }
    boite.textContent = `DIAGNOSTIC ?debug  (touche/souris/gamepad)\n${etatGamepad}\n\n${lignes.join('\n')}`;
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);
}
