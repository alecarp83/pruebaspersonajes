import * as THREE from 'three';
import { makeMaterial } from './textures.js';

// Convención: Y arriba, Z hacia delante, unidades en metros.
// Lado izquierdo (L) = +X, derecho (R) = -X (anatomía real vista de frente a +Z).
export const SEGMENT_DEFAULTS = {
  cabeza: { length: 0.23, width: 0.17 }, cuello: { length: 0.08, width: 0.09 },
  torso: { length: 0.55, width: 0.34 }, pelvis: { length: 0.18, width: 0.30 },
  brazo: { length: 0.30, width: 0.08 }, antebrazo: { length: 0.27, width: 0.07 },
  mano: { length: 0.18, width: 0.09 }, muslo: { length: 0.43, width: 0.12 },
  pantorrilla: { length: 0.42, width: 0.09 }, pie: { length: 0.26, width: 0.10 },
};

// Límites en grados [min, max] por eje (lado L). El lado R invierte Y y Z (espejo).
export const LIMITS = {
  cintura: [[-30, -45, -25], [60, 45, 25]], cuello: [[-40, -70, -30], [50, 70, 30]],
  cabeza: [[-20, -30, -15], [25, 30, 15]], hombro: [[-60, -90, -20], [180, 90, 180]],
  codo: [[0, -80, 0], [150, 80, 0]], muneca: [[-70, 0, -20], [70, 0, 30]],
  cadera: [[-30, -45, -45], [120, 45, 30]], rodilla: [[0, 0, 0], [150, 0, 0]],
  tobillo: [[-45, 0, -20], [20, 0, 20]],
};
// El valor X guardado es "flexión hacia delante" (rodilla: hacia atrás); este signo lo convierte a rotación de three.js.
const SIGN_X = { hombro: -1, codo: -1, muneca: -1, cadera: -1 };

export const POSE_JOINTS = ['cintura', 'cuello', 'cabeza',
  ...['L', 'R'].flatMap(s => ['hombro', 'codo', 'muneca', 'cadera', 'rodilla', 'tobillo'].map(j => `${j}_${s}`))];
export const NEUTRAL = { hombro_L: [0, 0, 30], hombro_R: [0, 0, -30] };
export const POSE_T = { hombro_L: [0, 0, 90], hombro_R: [0, 0, -90] };

export function limitFor(name, over = {}) {
  if (over[name]) return [[...over[name].min], [...over[name].max]];
  const base = name.replace(/_[LR]$/, '');
  const [mn, mx] = (LIMITS[base] || [[0, 0, 0], [0, 0, 0]]).map(a => [...a]);
  if (name.endsWith('_R')) for (const i of [1, 2]) { const a = -mx[i], b = -mn[i]; mn[i] = a; mx[i] = b; }
  return [mn, mx];
}

export function setPose(joints, pose, over = {}) {
  for (const n of POSE_JOINTS) {
    const v = pose[n] || [0, 0, 0], [mn, mx] = limitFor(n, over);
    const d = v.map((a, i) => Math.min(mx[i], Math.max(mn[i], a)));
    const sx = SIGN_X[n.replace(/_[LR]$/, '')] || 1, r = THREE.MathUtils.degToRad;
    joints[n].rotation.set(r(d[0] * sx), r(d[1]), r(d[2]));
  }
}

export function characterHeight(s) {
  return s.pantorrilla.length + s.muslo.length + 0.07 + s.pelvis.length + s.torso.length + s.cuello.length + s.cabeza.length;
}

// Cada articulación es un pivote; la malla del segmento cuelga desplazada del pivote proximal.
export function buildCharacter(seg, colors, parts = {}, gear = {}) {
  const root = new THREE.Group(), joints = {}, sockets = {}, refLen = {};
  const mats = {}; for (const n of [...PART_NAMES, ...GEAR_NAMES]) mats[n] = makeMaterial(resolvePart(n, colors, parts));
  const pivot = (n, p, x = 0, y = 0, z = 0) => { const o = new THREE.Object3D(); o.name = n; o.position.set(x, y, z); p.add(o); joints[n] = o; return o; };
  const mesh = (p, g, part, y = 0, z = 0) => { const o = new THREE.Mesh(g, mats[part]); o.position.set(0, y, z); o.userData.body = true; o.userData.part = part; o.castShadow = o.receiveShadow = true; p.add(o); return o; };
  const jsph = (p, r, part) => mesh(p, new THREE.SphereGeometry(r, 16, 12), part); // esfera de articulación
  const cap = (l, w) => new THREE.CapsuleGeometry(w / 2, Math.max(l - w, .001), 4, 12);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sock = (n, p, len, x = 0, y = 0, z = 0, rx = 0, ry = 0) => {
    const o = new THREE.Object3D(); o.name = n; o.position.set(x, y, z); o.rotation.set(rx, ry, 0); p.add(o);
    sockets[n] = o; refLen[n] = len;
    const d = new THREE.Mesh(new THREE.SphereGeometry(.016), new THREE.MeshBasicMaterial({ color: 0xffb020, depthTest: false }));
    d.renderOrder = 10; d.userData.marker = true; o.add(d);
  };
  const { cabeza, cuello, torso, pelvis, brazo, antebrazo, mano, muslo, pantorrilla, pie } = seg;

  const cin = pivot('cintura', root, 0, pantorrilla.length + muslo.length + .07 + pelvis.length / 2);
  mesh(cin, box(pelvis.width, pelvis.length, pelvis.width * .6), 'pelvis');
  if (gear.cinturon) { const z = pelvis.width * .6 * .56; mesh(cin, box(pelvis.width * 1.08, .06, pelvis.width * .6 * 1.12), 'cinturon', pelvis.length / 2 - .03); mesh(cin, box(.07, .07, .03), 'cinturon', pelvis.length / 2 - .03, z + .01); }
  const tor = pivot('torso', cin, 0, pelvis.length / 2);
  mesh(tor, cap(torso.length, torso.width), 'torso', torso.length / 2).scale.z = .6;
  if (gear.mochila) { const w = torso.width; mesh(tor, box(w * .9, torso.length * .7, w * .4), 'mochila', torso.length * .5, -(w * .5 - .02));
    for (const sx of [-1, 1]) mesh(tor, box(.045, torso.length * .6, .02), 'mochila', torso.length * .62, w * .3 + .008).position.x = sx * w * .26; }
  const cue = pivot('cuello', tor, 0, torso.length);
  mesh(cue, cap(cuello.length + .02, cuello.width), 'cuello', cuello.length / 2);
  const cab = pivot('cabeza', cue, 0, cuello.length);
  mesh(cab, cap(cabeza.length, cabeza.width), 'cabeza', cabeza.length / 2);
  sock('cabeza', cab, cabeza.length, 0, cabeza.length * .9, 0);
  sock('pecho', tor, torso.length, 0, torso.length * .7, torso.width * .3);
  sock('espalda', tor, torso.length, 0, torso.length * .6, -torso.width * .3, 0, Math.PI); // +Z local = hacia atrás

  for (const [s, k] of [['L', 1], ['R', -1]]) {
    const h = pivot('hombro_' + s, tor, k * (torso.width / 2 + brazo.width * .25), torso.length - brazo.width / 2);
    mesh(h, cap(brazo.length, brazo.width), 'brazo', -brazo.length / 2);
    jsph(h, brazo.width * .56, 'brazo');
    if (gear.hombreras) { const d = mesh(h, new THREE.SphereGeometry(brazo.width * .78, 18, 12, 0, Math.PI * 2, 0, Math.PI * .62), 'hombreras', brazo.width * .12); d.scale.set(1.25, .85, 1.2); d.position.x = k * brazo.width * .1; }
    const c = pivot('codo_' + s, h, 0, -brazo.length);
    mesh(c, cap(antebrazo.length, antebrazo.width), 'antebrazo', -antebrazo.length / 2);
    jsph(c, Math.max(brazo.width, antebrazo.width) / 2 * .98, 'antebrazo');
    if (gear.guantes) { const rr = antebrazo.width / 2 * 1.14; mesh(c, new THREE.CylinderGeometry(rr, rr, .09, 14), 'guantes', -antebrazo.length + .045); }
    const m = pivot('muneca_' + s, c, 0, -antebrazo.length);
    mesh(m, box(mano.width, mano.length, mano.width * .4), 'mano', -mano.length / 2);
    jsph(m, antebrazo.width / 2 * .95, 'mano');
    if (gear.guantes) mesh(m, box(mano.width * 1.16, mano.length * .96, mano.width * .4 * 1.4), 'guantes', -mano.length / 2);
    sock('mano_' + s, m, mano.length, 0, -mano.length / 2, 0, Math.PI / 2); // +Y local = hacia delante

    const ca = pivot('cadera_' + s, cin, k * pelvis.width * .3, -pelvis.length / 2);
    mesh(ca, cap(muslo.length, muslo.width), 'muslo', -muslo.length / 2);
    jsph(ca, muslo.width / 2 * 1.08, 'muslo');
    const r = pivot('rodilla_' + s, ca, 0, -muslo.length);
    mesh(r, cap(pantorrilla.length, pantorrilla.width), 'pantorrilla', -pantorrilla.length / 2);
    jsph(r, Math.max(muslo.width, pantorrilla.width) / 2 * .98, 'pantorrilla');
    if (gear.rodilleras) { const rr = Math.max(muslo.width, pantorrilla.width) / 2 * 1.15; mesh(r, new THREE.SphereGeometry(rr, 14, 10), 'rodilleras', 0, rr * .35).scale.set(1, .9, .75); }
    if (gear.botas) { const hh = pantorrilla.length * .38, rb = pantorrilla.width / 2 * 1.2; mesh(r, new THREE.CylinderGeometry(rb, rb, hh, 14), 'botas', -pantorrilla.length + hh / 2); }
    const t = pivot('tobillo_' + s, r, 0, -pantorrilla.length);
    mesh(t, box(pie.width, .07, pie.length), 'pie', -.035, pie.length / 2 - .05);
    jsph(t, pantorrilla.width / 2 * .95, 'pie');
    if (gear.botas) mesh(t, box(pie.width * 1.2, .095, pie.length * 1.1), 'botas', -.0225, pie.length / 2 - .05 + pie.length * .02);
    sock('cadera_' + s, cin, pelvis.length, k * pelvis.width / 2, 0, 0);
    sock('muslo_' + s, ca, muslo.length, k * muslo.width / 2, -muslo.length / 2, 0);
    sock('pie_' + s, t, pie.length, 0, -.035, pie.length / 2 - .05);
  }
  return { root, joints, sockets, refLen, mats };
}

// ---- Partes del cuerpo y su material (los lados L y R comparten estilo) ----
export const GEAR_NAMES = ['botas', 'guantes', 'hombreras', 'cinturon', 'rodilleras', 'mochila'];
const GEAR_DEF = {
  botas: { tex: 'cuero', color: '#4a3524', color2: '#2a1b10', roughness: .7 }, guantes: { tex: 'cuero', color: '#3a3a3a', color2: '#1a1a1a', roughness: .7 },
  hombreras: { tex: 'metal', color: '#8a8f99', color2: '#4a4f58', metalness: .85, roughness: .4 }, cinturon: { tex: 'cuero', color: '#5a3b22', color2: '#2f1d0f', roughness: .7 },
  rodilleras: { tex: 'metal', color: '#8a8f99', color2: '#4a4f58', metalness: .85, roughness: .4 }, mochila: { tex: 'tela', color: '#4d6b3a', color2: '#2f4423', roughness: .9 } };
export const PART_NAMES = ['cabeza', 'cuello', 'torso', 'pelvis', 'brazo', 'antebrazo', 'mano', 'muslo', 'pantorrilla', 'pie'];
const SKIN = { cabeza: 'piel', cuello: 'piel', brazo: 'piel', antebrazo: 'piel', mano: 'piel', torso: 'base', pelvis: 'base', muslo: 'base', pantorrilla: 'base', pie: 'base' };
const shade = (c, a) => '#' + new THREE.Color(c).offsetHSL(0, 0, a).getHexString();
export function resolvePart(n, colors, parts = {}) {
  if (GEAR_DEF[n]) return { scale: 4, metalness: 0, roughness: .8, ...GEAR_DEF[n], ...(parts[n] || {}) };
  const c = colors[SKIN[n]];
  return { tex: 'liso', color: c, color2: shade(c, -.25), scale: 4, roughness: .8, metalness: 0, ...(parts[n] || {}) };
}
export function updatePart(ch, name, colors, parts) {
  const nm = makeMaterial(resolvePart(name, colors, parts)), old = ch.mats[name];
  ch.root.traverse(o => { if (o.isMesh && o.userData.part === name) o.material = nm; });
  ch.mats[name] = nm; old.map?.dispose(); old.dispose();
}
