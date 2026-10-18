import * as THREE from 'three';
import { makeMaterial } from '../character/textures.js';
import { disposeTree } from '../character/dispose.js';

// Objetos rígidos procedurales. Origen = punto de agarre/anclaje, +Y = eje largo.
// Para añadir uno nuevo: agrega una entrada a LIBRARY (build recibe material principal y de acento).
// Campos opcionales para el modo juego: atk = tipo de ataque cuando va en la mano
//   ('slash' tajo, 'thrust' estocada, 'smash' golpe cenital, 'bash' embestida, 'shoot' disparo, 'cast' hechizo),
//   proj = proyectil ('flecha', 'bala', 'magia') para los ataques a distancia.
const P = (g, geo, mat, y = 0, z = 0, x = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r, h, rb = r) => new THREE.CylinderGeometry(r, rb, h, 14);

export const LIBRARY = {
  espada: { label: 'Espada', socket: 'mano_R', atk: 'slash', color: '#b0b0b8', metalness: .8, roughness: .35,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.05, .8, .012), m, .45); P(g, B(.2, .03, .04), a, .04); P(g, C(.018, .16), a, -.05); return g; } },
  hacha: { label: 'Hacha', socket: 'mano_R', atk: 'smash', color: '#9a9aa2', metalness: .7, roughness: .4,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.02, .85), a, .3); P(g, B(.2, .22, .03), m, .62, 0, .1); return g; } },
  baston: { label: 'Bastón', socket: 'mano_L', atk: 'smash', color: '#7a5230', metalness: 0, roughness: .8,
    build: (m) => { const g = new THREE.Group(); P(g, C(.022, 1.5), m, .5); P(g, new THREE.SphereGeometry(.05), m, 1.27); return g; } },
  escudo: { label: 'Escudo', socket: 'mano_L', atk: 'bash', color: '#8a3b3b', metalness: .3, roughness: .6,
    build: (m, a) => { const g = new THREE.Group(); const s = P(g, C(.26, .04), m, .1); s.rotation.x = Math.PI / 2; s.position.z = .08; P(g, C(.05, .03), a, .1, .11).rotation.x = Math.PI / 2; return g; } },
  pistola: { label: 'Pistola', socket: 'mano_R', atk: 'shoot', proj: 'bala', color: '#33363c', metalness: .8, roughness: .35,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.035, .2, .045), m, .1); P(g, B(.03, .1, .04), a, -.03, -.01).rotation.x = .2; return g; } },
  martillo: { label: 'Martillo', socket: 'mano_R', atk: 'smash', color: '#6b6f78', metalness: .8, roughness: .45,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.02, .7), a, .25); P(g, B(.16, .1, .1), m, .62); return g; } },
  linterna: { label: 'Linterna', socket: 'mano_L', color: '#d6b13a', metalness: .5, roughness: .4,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.025, .2), m, .08); P(g, C(.045, .06, .025), a, .21); return g; } },
  mochila: { label: 'Mochila', socket: 'espalda', color: '#4d6b3a', metalness: 0, roughness: .9,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.3, .4, .15), m, 0, .09); P(g, B(.2, .12, .05), a, -.1, .19); return g; } },
  casco: { label: 'Casco', socket: 'cabeza', color: '#aab0b8', metalness: .7, roughness: .4,
    build: (m) => { const g = new THREE.Group(); P(g, new THREE.SphereGeometry(.12, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, -.1); return g; } },
};

// ---- Objetos adicionales ----
const EMIT = (c, i = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: .4 });
Object.assign(LIBRARY, {
  daga: { label: 'Daga', socket: 'mano_R', atk: 'thrust', color: '#c0c4cc', metalness: .8, roughness: .3,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.035, .28, .01), m, .17); P(g, B(.1, .02, .03), a, .03); P(g, C(.015, .1), a, -.03); return g; } },
  lanza: { label: 'Lanza', socket: 'mano_R', atk: 'thrust', color: '#7a5230', metalness: 0, roughness: .8,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.02, 1.7), m, .5); P(g, new THREE.ConeGeometry(.04, .25, 10), a, 1.47); return g; } },
  arco: { label: 'Arco', socket: 'mano_L', atk: 'shoot', proj: 'flecha', color: '#7a5230', metalness: 0, roughness: .8,
    build: (m, a) => { const g = new THREE.Group(); const t = P(g, new THREE.TorusGeometry(.4, .014, 6, 24, Math.PI), m);
      t.rotation.set(0, -Math.PI / 2, -Math.PI / 2); t.scale.set(1, .35, 1); P(g, C(.004, .8), a); return g; } },
  maza: { label: 'Maza', socket: 'mano_R', atk: 'smash', color: '#6b6f78', metalness: .8, roughness: .45,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.022, .6), a, .2); P(g, new THREE.SphereGeometry(.08, 14, 10), m, .55); P(g, C(.09, .03), a, .55); return g; } },
  antorcha: { label: 'Antorcha', socket: 'mano_L', atk: 'slash', color: '#7a5230', metalness: 0, roughness: .8,
    build: (m) => { const g = new THREE.Group(); P(g, C(.025, .5), m, .15); P(g, new THREE.ConeGeometry(.05, .15, 8), EMIT(0xff8a1a), .47); return g; } },
  varita: { label: 'Varita', socket: 'mano_R', atk: 'cast', proj: 'magia', color: '#4a3a2a', metalness: 0, roughness: .7,
    build: (m) => { const g = new THREE.Group(); P(g, C(.012, .4), m, .15); P(g, new THREE.SphereGeometry(.026, 12, 10), EMIT(0x66ccff), .37); return g; } },
  rifle: { label: 'Rifle', socket: 'mano_R', atk: 'shoot', proj: 'bala', color: '#3a3d44', metalness: .8, roughness: .4,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.04, .5, .06), m, .1); P(g, C(.012, .4), a, .55); P(g, B(.04, .25, .07), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: .8 }), -.2); return g; } },
  carcaj: { label: 'Carcaj', socket: 'espalda', color: '#6a4a2a', metalness: 0, roughness: .85,
    build: (m, a) => { const g = new THREE.Group(); const q = P(g, C(.06, .5), m, 0, .1); q.rotation.z = .3;
      for (const x of [-.02, 0, .02]) { const f = P(g, C(.006, .16), a, .3, .1, x); f.rotation.z = .3; } return g; } },
  capa: { label: 'Capa', socket: 'espalda', color: '#8a1f2f', metalness: 0, roughness: .9,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.5, .75, .02), m, -.3, .06); P(g, B(.3, .05, .05), a, .1, .05); return g; } },
  bolsa: { label: 'Bolsa', socket: 'cadera_L', color: '#7a5a3a', metalness: 0, roughness: .9,
    build: (m, a) => { const g = new THREE.Group(); P(g, B(.14, .16, .08), m, -.06, 0, .06); P(g, B(.14, .05, .09), a, .01, 0, .06); return g; } },
  cantimplora: { label: 'Cantimplora', socket: 'cadera_R', color: '#4a6fa5', metalness: .2, roughness: .6,
    build: (m, a) => { const g = new THREE.Group(); P(g, C(.045, .16), m, -.05, 0, -.06); P(g, C(.02, .03), a, .05, 0, -.06); return g; } },
  corona: { label: 'Corona', socket: 'cabeza', color: '#d6b13a', metalness: .9, roughness: .3,
    build: (m) => { const g = new THREE.Group(); const r = P(g, new THREE.TorusGeometry(.1, .015, 8, 20), m, -.04); r.rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; P(g, new THREE.ConeGeometry(.02, .07, 6), m, 0, Math.cos(a) * .1, Math.sin(a) * .1).position.y = -.005; } return g; } },
  sombrero: { label: 'Sombrero', socket: 'cabeza', color: '#3a2a1f', metalness: 0, roughness: .9,
    build: (m) => { const g = new THREE.Group(); P(g, C(.2, .015), m, -.06); P(g, C(.085, .14, .1), m, .02); return g; } },
});

export const objDefaults = type => { const d = LIBRARY[type]; return { tex: 'liso', color: d.color, color2: '#555555', scale: 4, roughness: d.roughness, metalness: d.metalness }; };

export function createObject(type, mat = {}) {
  const main = makeMaterial({ ...objDefaults(type), ...mat });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3b3b42, metalness: .5, roughness: .5 });
  const g = LIBRARY[type].build(main, accent);
  g.userData.mainMat = main;
  return g;
}

// Cambia el material principal de un objeto ya creado (textura, color, etc.)
export function setMainMaterial(node, mat) {
  const old = node.userData.mainMat;
  node.traverse(o => { if (o.isMesh && o.material === old) o.material = mat; });
  node.userData.mainMat = mat; old.map?.dispose(); old.dispose();
}

// Libera geometrías y materiales de un objeto que ya no se usa (quitarlo antes de su socket).
export const disposeObject = node => disposeTree(node);
