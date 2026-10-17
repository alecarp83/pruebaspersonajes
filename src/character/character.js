import * as THREE from 'three';

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
export function buildCharacter(seg, colors) {
  const root = new THREE.Group(), joints = {}, sockets = {}, refLen = {};
  const mS = new THREE.MeshStandardMaterial({ color: colors.piel, roughness: .8 });
  const mB = new THREE.MeshStandardMaterial({ color: colors.base, roughness: .8 });
  const pivot = (n, p, x = 0, y = 0, z = 0) => { const o = new THREE.Object3D(); o.name = n; o.position.set(x, y, z); p.add(o); joints[n] = o; return o; };
  const mesh = (p, g, m, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(0, y, z); o.userData.body = true; p.add(o); return o; };
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
  mesh(cin, box(pelvis.width, pelvis.length, pelvis.width * .6), mB);
  const tor = pivot('torso', cin, 0, pelvis.length / 2);
  mesh(tor, cap(torso.length, torso.width), mB, torso.length / 2).scale.z = .6;
  const cue = pivot('cuello', tor, 0, torso.length);
  mesh(cue, cap(cuello.length + .02, cuello.width), mS, cuello.length / 2);
  const cab = pivot('cabeza', cue, 0, cuello.length);
  mesh(cab, cap(cabeza.length, cabeza.width), mS, cabeza.length / 2);
  sock('cabeza', cab, cabeza.length, 0, cabeza.length * .9, 0);
  sock('pecho', tor, torso.length, 0, torso.length * .7, torso.width * .3);
  sock('espalda', tor, torso.length, 0, torso.length * .6, -torso.width * .3, 0, Math.PI); // +Z local = hacia atrás

  for (const [s, k] of [['L', 1], ['R', -1]]) {
    const h = pivot('hombro_' + s, tor, k * (torso.width / 2 + brazo.width * .25), torso.length - brazo.width / 2);
    mesh(h, cap(brazo.length, brazo.width), mS, -brazo.length / 2);
    const c = pivot('codo_' + s, h, 0, -brazo.length);
    mesh(c, cap(antebrazo.length, antebrazo.width), mS, -antebrazo.length / 2);
    const m = pivot('muneca_' + s, c, 0, -antebrazo.length);
    mesh(m, box(mano.width, mano.length, mano.width * .4), mS, -mano.length / 2);
    sock('mano_' + s, m, mano.length, 0, -mano.length / 2, 0, Math.PI / 2); // +Y local = hacia delante

    const ca = pivot('cadera_' + s, cin, k * pelvis.width * .3, -pelvis.length / 2);
    mesh(ca, cap(muslo.length, muslo.width), mB, -muslo.length / 2);
    const r = pivot('rodilla_' + s, ca, 0, -muslo.length);
    mesh(r, cap(pantorrilla.length, pantorrilla.width), mB, -pantorrilla.length / 2);
    const t = pivot('tobillo_' + s, r, 0, -pantorrilla.length);
    mesh(t, box(pie.width, .07, pie.length), mB, -.035, pie.length / 2 - .05);
    sock('cadera_' + s, cin, pelvis.length, k * pelvis.width / 2, 0, 0);
    sock('muslo_' + s, ca, muslo.length, k * muslo.width / 2, -muslo.length / 2, 0);
    sock('pie_' + s, t, pie.length, 0, -.035, pie.length / 2 - .05);
  }
  return { root, joints, sockets, refLen };
}
