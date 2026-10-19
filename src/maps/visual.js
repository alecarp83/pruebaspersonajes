// Parte visual de los mapas (three.js), compartida por el editor y el juego:
//   createNode(obj)   un objeto individual (editor, cajas/pelotas/muñecos del juego): se puede mover, recolorear y seleccionar
//   buildStatic(map)  todo lo estático agrupado en instancias GPU: una llamada de dibujo por tipo de pieza, no por objeto
//   makeGround(map)   suelo y cuadrícula
// Ambos usan las mismas piezas (PARTS en types.js) y geometrías unitarias, así que el mapa se ve igual en el editor y en el juego.
import * as THREE from 'three';
import { PARTS, STATIC } from './types.js';
import { colorOf, color2Of } from './mapdata.js';

const DEG = Math.PI / 180;
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

function rockGeo() {   // icosaedro irregular (ruido determinista, la misma roca siempre), base en el suelo y alto 1
  const g = new THREE.IcosahedronGeometry(.5, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hash(Math.round(x * 1e3), Math.round(y * 1e3), Math.round(z * 1e3)) - .5) * .32;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeBoundingBox(); const bb = g.boundingBox, h = bb.max.y - bb.min.y;
  g.translate(0, -bb.min.y, 0); g.scale(1, 1 / h, 1); g.computeVertexNormals();
  return g;
}
const GEO = {
  box: () => new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0),            // base apoyada en y = 0
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(.5, 20, 14),
  belt: () => new THREE.TorusGeometry(.5, .035, 6, 28).rotateX(Math.PI / 2),  // franja de la pelota: deja ver cómo rueda
  trunk: () => new THREE.CylinderGeometry(.18, .25, 1.6, 8).translate(0, .8, 0),
  canopy: () => new THREE.ConeGeometry(1.1, 2.6, 9).translate(0, 2.6, 0),
  rock: rockGeo,
  mountain: () => new THREE.ConeGeometry(1, 1, 12, 1).translate(0, .5, 0),
  cap: () => new THREE.ConeGeometry(.36, .36, 12, 1).translate(0, .83, 0),   // nieve: un poco más ancho que la montaña en su tramo
  plane: () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, .03, 0),
  dpost: () => new THREE.CylinderGeometry(.1, .12, 1.5, 8).translate(0, .75, 0),
  dhead: () => new THREE.SphereGeometry(.22).translate(0, 1.7, 0),
  darm: () => new THREE.BoxGeometry(.9, .12, .12).translate(0, 1.3, 0),
  spawnDisc: () => new THREE.CylinderGeometry(.55, .55, .06, 24).translate(0, .03, 0),
  spawnArrow: () => new THREE.ConeGeometry(.22, .6, 12).rotateX(Math.PI / 2).translate(0, .12, .85),   // apunta hacia donde mira el personaje (+Z)
};
const MAT = {
  std: () => new THREE.MeshStandardMaterial({ roughness: .9 }),
  flat: () => new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true }),
  water: () => new THREE.MeshStandardMaterial({ roughness: .15, metalness: .1, transparent: true, opacity: .8, depthWrite: false }),
  ball: () => new THREE.MeshStandardMaterial({ roughness: .35 }),
  marker: () => new THREE.MeshStandardMaterial({ roughness: .5, emissive: 0x333333 }),
};
const geoCache = new Map(), matCache = new Map();
export const getGeo = k => { let g = geoCache.get(k); if (!g) geoCache.set(k, g = GEO[k]()); return g; };
const getMat = k => { let m = matCache.get(k); if (!m) matCache.set(k, m = MAT[k]()); return m; };
const partColor = (part, o) => part.c === 'col' ? colorOf(o) : part.c === 'col2' ? (color2Of(o) || colorOf(o)) : part.c;

// ---------- Objetos individuales ----------
export function applyTransform(node, o) { node.position.set(o.x, 0, o.z); node.rotation.set(0, o.rot * DEG, 0); node.scale.set(o.s[0], o.s[1], o.s[2]); }
export function createNode(o) {
  const g = new THREE.Group(), mats = [];
  for (const part of PARTS[o.type]) {
    const m = getMat(part.m).clone(); m.color.set(partColor(part, o)); mats.push(m);   // material propio: el color y el resaltado son por objeto
    const mesh = new THREE.Mesh(getGeo(part.g), m); if (part.p) mesh.position.set(part.p[0], part.p[1], part.p[2]);
    mesh.castShadow = part.m !== 'water' && part.m !== 'marker'; mesh.receiveShadow = true; g.add(mesh);
  }
  applyTransform(g, o); g.userData.mats = mats; g.userData.mapId = o.id; g.userData.type = o.type; g.name = o.id;
  return g;
}
export const recolor = (node, o) => node.userData.mats.forEach((m, i) => m.color.set(partColor(PARTS[o.type][i], o)));
export const setEmissive = (node, hexv) => node.userData.mats.forEach(m => m.emissive.setHex(hexv));
export function disposeNode(node) { for (const m of node.userData.mats || []) m.dispose(); }   // las geometrías son compartidas: no se liberan

// Caja y pelota del juego: centradas en su origen (la física trabaja con el centro). Mismas piezas y colores que en el editor.
export function crateMesh(r, color) {
  const m = new THREE.MeshStandardMaterial({ roughness: .9, color }), mesh = new THREE.Mesh(getGeo('cube'), m);
  mesh.scale.setScalar(r * 2); mesh.castShadow = mesh.receiveShadow = true; return mesh;
}
export function ballMesh(r, color) {
  const g = new THREE.Group(), a = new THREE.MeshStandardMaterial({ roughness: .35, color }), b = new THREE.MeshStandardMaterial({ roughness: .9, color: 0x1d1d22 });
  const s = new THREE.Mesh(getGeo('sphere'), a), belt = new THREE.Mesh(getGeo('belt'), b);
  s.castShadow = true; g.add(s, belt); g.scale.setScalar(r * 2); g.userData.mats = [a, b]; return g;
}

// ---------- Estáticos agrupados ----------
const _mo = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
export function buildStatic(map) {
  const groups = new Map(), root = new THREE.Group(); let instances = 0;
  for (const o of map.objects) {
    if (!STATIC.includes(o.type)) continue;
    _q.setFromAxisAngle(_up, o.rot * DEG); _mo.compose(_p.set(o.x, 0, o.z), _q, _s.set(o.s[0], o.s[1], o.s[2])); instances++;
    for (const part of PARTS[o.type]) {
      const key = part.g + '|' + part.m; let g = groups.get(key); if (!g) groups.set(key, g = { part, items: [] });
      g.items.push({ m: _mo.clone(), color: partColor(part, o) });
    }
  }
  for (const { part, items } of groups.values()) {
    const mesh = new THREE.InstancedMesh(getGeo(part.g), getMat(part.m), items.length);
    items.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, _c.set(it.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = part.m !== 'water'; mesh.receiveShadow = true; if (part.m === 'water') mesh.renderOrder = 1;
    root.add(mesh);
  }
  return { root, draws: groups.size, instances, dispose() { root.traverse(n => n.isInstancedMesh && n.dispose()); } };
}

// ---------- Suelo ----------
export function makeGround(map) {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.size, map.size), new THREE.MeshStandardMaterial({ color: map.ground, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  const line = new THREE.Color(map.ground).multiplyScalar(.78), div = map.size <= 100 ? map.size : Math.round(map.size / 2);
  const grid = new THREE.GridHelper(map.size, div, line, line); grid.position.y = .01;
  group.add(ground, grid);
  return { group, ground, grid, dispose() { ground.geometry.dispose(); ground.material.dispose(); grid.geometry.dispose(); grid.material.dispose(); } };
}
