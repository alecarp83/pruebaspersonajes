import * as THREE from 'three';

// Objetos rígidos procedurales. Origen = punto de agarre/anclaje, +Y = eje largo.
// Para añadir uno nuevo: agrega una entrada a LIBRARY (build recibe material principal y de acento).
const P = (g, geo, mat, y = 0, z = 0, x = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r, h, rb = r) => new THREE.CylinderGeometry(r, rb, h, 14);

export const LIBRARY = {
  espada: { label: 'Espada', socket: 'mano_R', color: '#b0b0b8', metalness: .8, roughness: .35,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.05, .8, .012), m, .45); P(g, B(.2, .03, .04), a, .04); P(g, C(.018, .16), a, -.05); return g; } },
  hacha: { label: 'Hacha', socket: 'mano_R', color: '#9a9aa2', metalness: .7, roughness: .4,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.02, .85), a, .3); P(g, B(.2, .22, .03), m, .62, 0, .1); return g; } },
  baston: { label: 'Bastón', socket: 'mano_L', color: '#7a5230', metalness: 0, roughness: .8,
    build: (m) => { const g = new THREE.Group(); P(g, C(.022, 1.5), m, .5); P(g, new THREE.SphereGeometry(.05), m, 1.27); return g; } },
  escudo: { label: 'Escudo', socket: 'mano_L', color: '#8a3b3b', metalness: .3, roughness: .6,
    build: (m, a) => { const g = new THREE.Group(); const s = P(g, C(.26, .04), m, .1); s.rotation.x = Math.PI / 2; s.position.z = .08; P(g, C(.05, .03), a, .1, .11).rotation.x = Math.PI / 2; return g; } },
  pistola: { label: 'Pistola', socket: 'mano_R', color: '#33363c', metalness: .8, roughness: .35,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.035, .2, .045), m, .1); P(g, B(.03, .1, .04), a, -.03, -.01).rotation.x = .2; return g; } },
  martillo: { label: 'Martillo', socket: 'mano_R', color: '#6b6f78', metalness: .8, roughness: .45,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.02, .7), a, .25); P(g, B(.16, .1, .1), m, .62); return g; } },
  linterna: { label: 'Linterna', socket: 'mano_L', color: '#d6b13a', metalness: .5, roughness: .4,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.025, .2), m, .08); P(g, C(.045, .06, .025), a, .21); return g; } },
  mochila: { label: 'Mochila', socket: 'espalda', color: '#4d6b3a', metalness: 0, roughness: .9,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.3, .4, .15), m, 0, .09); P(g, B(.2, .12, .05), a, -.1, .19); return g; } },
  casco: { label: 'Casco', socket: 'cabeza', color: '#aab0b8', metalness: .7, roughness: .4,
    build: (m) => { const g = new THREE.Group(); P(g, new THREE.SphereGeometry(.12, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, -.1); return g; } },
};

export function createObject(type, mat = {}) {
  const def = LIBRARY[type];
  const main = new THREE.MeshStandardMaterial({
    color: mat.color ?? def.color, metalness: mat.metalness ?? def.metalness, roughness: mat.roughness ?? def.roughness });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3b3b42, metalness: .5, roughness: .5 });
  const g = def.build(main, accent);
  g.userData.mainMat = main;
  return g;
}
