/**
 * Passe de contour (look BD) : detecte les bords par un filtre de Sobel sur la
 * luminance de l'image, et les assombrit. Globale (aucune modif des maillages),
 * elle s'insere dans l'EffectComposer et se marie avec le bloom. Utilisee
 * seulement en mode toon.
 */

import * as THREE from 'three';

export const ShaderContour = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    force: { value: 0.81 },
    seuil: { value: 0.16 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float force;
    uniform float seuil;
    varying vec2 vUv;
    float lum(vec2 uv) { return dot(texture2D(tDiffuse, uv).rgb, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 e = 1.0 / resolution;
      float tl = lum(vUv + e * vec2(-1.0, -1.0));
      float tc = lum(vUv + e * vec2(0.0, -1.0));
      float tr = lum(vUv + e * vec2(1.0, -1.0));
      float ml = lum(vUv + e * vec2(-1.0, 0.0));
      float mr = lum(vUv + e * vec2(1.0, 0.0));
      float bl = lum(vUv + e * vec2(-1.0, 1.0));
      float bc = lum(vUv + e * vec2(0.0, 1.0));
      float br = lum(vUv + e * vec2(1.0, 1.0));
      float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
      float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
      float g = sqrt(gx * gx + gy * gy);
      float bord = smoothstep(seuil, seuil + 0.35, g) * force;
      vec3 couleur = texture2D(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(couleur * (1.0 - bord), 1.0);
    }`,
};
