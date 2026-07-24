/**
 * Petits effets visuels ("juice") : gerbes d'etincelles a la recolte, poussiere
 * sous les pieds. Un pool de petits maillages non eclaires, recycles. Pas de
 * transparence : les particules RETRECISSENT jusqu'a disparaitre (moins cher, et
 * ca evite les tris d'objets transparents).
 */

import * as THREE from 'three';

export function creerEffets(scene) {
  const POOL = 80;
  const geometrie = new THREE.OctahedronGeometry(0.15);
  const particules = [];
  for (let i = 0; i < POOL; i++) {
    const mesh = new THREE.Mesh(geometrie, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mesh.visible = false;
    mesh.castShadow = false;
    scene.add(mesh);
    particules.push({ mesh, vie: 0, vieMax: 1, vx: 0, vy: 0, vz: 0 });
  }
  let curseur = 0;

  function emettre(x, y, z, couleur, nombre, vitesse, haut, duree) {
    for (let i = 0; i < nombre; i++) {
      const p = particules[curseur];
      curseur = (curseur + 1) % POOL;
      const angle = Math.random() * Math.PI * 2;
      const v = vitesse * (0.6 + Math.random() * 0.6);
      p.vx = Math.cos(angle) * v;
      p.vz = Math.sin(angle) * v;
      p.vy = haut * (0.6 + Math.random() * 0.8);
      p.vie = p.vieMax = duree * (0.8 + Math.random() * 0.4);
      p.mesh.material.color.setHex(couleur);
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(1);
      p.mesh.visible = true;
    }
  }

  return {
    /** Gerbe d'etincelles a la couleur de la recolte. */
    eclat(x, y, z, couleur) { emettre(x, y, z, couleur, 10, 2.4, 3.0, 0.55); },
    /** Petit nuage de poussiere sous les pieds. */
    poussiere(x, z, couleur) { emettre(x, 0.06, z, couleur, 3, 0.8, 0.6, 0.4); },

    maj(dt) {
      for (const p of particules) {
        if (p.vie <= 0) continue;
        p.vie -= dt;
        if (p.vie <= 0) { p.mesh.visible = false; continue; }
        p.vy -= 9 * dt;   // gravite
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.scale.setScalar(Math.max(0.02, p.vie / p.vieMax));   // retrecit en fin de vie
      }
    },
  };
}
