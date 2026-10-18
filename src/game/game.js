import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SEGMENT_DEFAULTS, NEUTRAL, buildCharacter, setPose, disposeCharacter, sideSeg } from '../character/character.js';
import { LIBRARY, createObject } from '../objects/library.js';

const $ = s => document.querySelector(s), D = THREE.MathUtils, clone = o => JSON.parse(JSON.stringify(o));
const msg = t => { const m = $('#msg'); m.textContent = t; m.style.display = t ? 'block' : 'none'; };

// ---------- Escena y mapa ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); $('#view').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9ec5e8); scene.fog = new THREE.Fog(0x9ec5e8, 18, 40);
scene.add(new THREE.HemisphereLight(0xffffff, 0x557744, .8));
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .5;
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(6, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 40 }); sun.shadow.bias = -.0005; scene.add(sun);
const cam = new THREE.PerspectiveCamera(50, 1, .1, 80);
const resize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

const BOUND = 11.5, mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), mat(0x6aa84f)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new THREE.GridHelper(24, 24, 0x4f8a3a, 0x4f8a3a); grid.position.y = .01; scene.add(grid);
const boxes = [{ x: 4, z: -3, w: 3, d: 3, h: .5 }, { x: -5, z: 2, w: 2.5, d: 2.5, h: .9 }, { x: -4.5, z: -4, w: 2, d: 2, h: .4 }];
for (const b of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat(0x9a8f80)); m.position.set(b.x, b.h / 2, b.z); scene.add(m); }
const solids = [];
for (const [x, z] of [[7, 4], [-8, -7], [8, -8], [-7, 7], [2, 8], [-1, -9]]) {
  const t = new THREE.Group(); t.position.set(x, 0, z);
  const k = new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, 1.6, 8), mat(0x6b4a2b)); k.position.y = .8;
  const c = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 9), mat(0x2f7a3a)); c.position.y = 2.6; t.add(k, c); scene.add(t);
  solids.push({ x, z, r: .5 });
}
// Muñeco de práctica
const dummy = new THREE.Group(); dummy.position.set(0, 0, -5);
const dm = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: .8 });
const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, 1.5, 8), dm); post.position.y = .75;
const dhead = new THREE.Mesh(new THREE.SphereGeometry(.22), dm); dhead.position.y = 1.7;
const darm = new THREE.Mesh(new THREE.BoxGeometry(.9, .12, .12), dm); darm.position.y = 1.3;
dummy.add(post, dhead, darm); scene.add(dummy); solids.push({ x: 0, z: -5, r: .4 });
let hitT = 0;
const shadow = new THREE.Mesh(new THREE.CircleGeometry(.5, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3 }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
const groundAt = (x, z) => boxes.reduce((h, b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2 ? Math.max(h, b.h) : h, 0);

const crates = [[2.5, 2], [-2, 4], [5, -6], [-6, -1], [1, -2]].map(([x, z]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: .85 }));
  mesh.position.set(x, groundAt(x, z) + .25, z); scene.add(mesh);
  return { mesh, state: 'ground', vx: 0, vy: 0, vz: 0, from: new THREE.Vector3(), to: new THREE.Vector3() };
});
let held = null, act = null;
// Altura de la superficie en (x,z): suelo, plataformas y cajas apoyadas (las cajas son sólidas y se apilan).
//   ex = caja a ignorar · maxTop = solo cajas cuya cara superior no pase de esta altura · m = margen horizontal
function surfaceAt(x, z, { ex = null, maxTop = Infinity, m = .15 } = {}) {
  let h = groundAt(x, z);
  for (const c of crates) {
    if (c === ex || c.state !== 'ground') continue;
    const p = c.mesh.position, top = p.y + .25;
    if (top > h && top <= maxTop && Math.abs(x - p.x) < .25 + m && Math.abs(z - p.z) < .25 + m) h = top;
  }
  return h;
}
// La caja toca una superficie de altura sy: se apoya y, si cae sobre otra caja, se alinea con ella para apilar limpio.
function landCrate(c, sy) {
  const m = c.mesh.position; m.y = sy + .25; c.state = 'ground'; c.vx = c.vy = c.vz = 0;
  const sup = crates.find(o => o !== c && o.state === 'ground' && Math.abs(o.mesh.position.y + .25 - sy) < .01 && Math.abs(m.x - o.mesh.position.x) < .3 && Math.abs(m.z - o.mesh.position.z) < .3);
  if (sup) { m.x = sup.mesh.position.x; m.z = sup.mesh.position.z; c.mesh.rotation.set(0, sup.mesh.rotation.y, 0); }
  else c.mesh.rotation.set(0, rotY, 0);
}
// Suelta la caja desde las manos: cae hacia 1 m por delante (sobre el suelo o sobre otra caja), sin agacharse.
function releaseCrate() {
  const c = held, T = .3, m = c.mesh.position, tx = D.clamp(pos.x + Math.sin(rotY), -BOUND, BOUND), tz = D.clamp(pos.z + Math.cos(rotY), -BOUND, BOUND);
  const ty = surfaceAt(tx, tz, { ex: c, m: .24 }) + .25;
  held = null; c.state = 'fly'; c.vx = (tx - m.x) / T; c.vz = (tz - m.z) / T; c.vy = (ty - m.y + .5 * G * T * T) / T;
}
const setShown = (sel, v) => { const e = $(sel); if (e.hidden === v) e.hidden = !v; };

scene.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
ground.castShadow = false; shadow.visible = false;  // sombras reales: se oculta la sombra falsa

// ---------- Personaje (mismo esqueleto que el editor) ----------
let ch = null, base = {}, limits = {}, baseY = 0;
function loadChar(j) {
  if (ch) { scene.remove(ch.root); disposeCharacter(ch); }
  const seg = { ...clone(SEGMENT_DEFAULTS), ...(j.character?.segments || {}) };
  const colors = { piel: '#d9b08c', base: '#4a6fa5', ...(j.character?.colors || {}) };
  limits = j.character?.joints || {}; base = { ...clone(NEUTRAL), ...clone(j.pose?.rotations || {}) };
  const segR = j.character?.segmentsR || {};  // asimetría: ajustes del lado derecho
  ch = buildCharacter(seg, colors, j.character?.parts || {}, j.character?.gear || {}, segR);
  ch.root.traverse(n => { if (n.userData.marker) n.visible = false; });
  for (const d of j.objects || []) {
    if (!LIBRARY[d.type] || !ch.sockets[d.socket]) continue;
    const n = createObject(d.type, d.material), t = d.transform;
    n.position.fromArray(t.position); n.rotation.set(...t.rotation.map(D.degToRad)); n.scale.fromArray(t.scale);
    n.visible = d.visible !== false; ch.sockets[d.socket].add(n);
  }
  baseY = ch.joints.cintura.position.y; scene.add(ch.root);
  const leg = sd => [sideSeg(seg, segR, sd, 'muslo').length, sideSeg(seg, segR, sd, 'pantorrilla').length];
  legs = leg('L')[0] + leg('L')[1] >= leg('R')[0] + leg('R')[1] ? leg('L') : leg('R');  // la pierna más larga toca el suelo
  const reach = seg.brazo.length + (seg.antebrazo.length + seg.mano.length / 2) * Math.cos(D.degToRad(70));
  buildAnims(D.radToDeg(Math.asin(D.clamp((.28 - ch.joints.hombro_L.position.x) / reach, -.4, .4))));
  setWeapon(pickWeapon(j.objects));
}

// ---------- Entrada: joystick, botones y teclado ----------
const joy = $('#joy'), knob = $('#knob'), jv = { x: 0, y: 0 }, keys = {};
function jmove(e) {
  const r = joy.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
  dx *= k; dy *= k; knob.style.transform = `translate(${dx}px,${dy}px)`; jv.x = dx / R; jv.y = dy / R;
}
joy.onpointerdown = e => { joy.setPointerCapture(e.pointerId); jmove(e); };
joy.onpointermove = e => { if (joy.hasPointerCapture(e.pointerId)) jmove(e); };
joy.onpointerup = joy.onpointercancel = () => { jv.x = jv.y = 0; knob.style.transform = ''; };
let wantJump = false, wantAtk = false, crouchHeld = false, wantGrab = false, wantDrop = false, wantThrow = false;
function hold(el, on, off) {
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.classList.add('on'); on(); });
  ['pointerup', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => { el.classList.remove('on'); off && off(); }));
}
hold($('#bJump'), () => wantJump = true); hold($('#bAtk'), () => wantAtk = true);
hold($('#bCrouch'), () => crouchHeld = true, () => crouchHeld = false);
hold($('#bGrab'), () => wantGrab = true); hold($('#bDrop'), () => wantDrop = true); hold($('#bThrow'), () => wantThrow = true);
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === ' ') { wantJump = true; e.preventDefault(); } if (k === 'j') wantAtk = true;
  if (k === 'e') { held ? wantDrop = true : wantGrab = true; } if (k === 'q') wantThrow = true;
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('contextmenu', e => e.preventDefault());

// ---------- Animación procedural (valores en la convención del editor) ----------
// ---------- Ataques: el tipo depende del arma que lleve el personaje en la mano ----------
// Cada fotograma clave describe el lado derecho (valores en la convención del editor); para armas en la mano izquierda se espeja.
// Tipos (campo `atk` de la biblioteca de objetos): slash, thrust, smash, bash, shoot, cast. Sin arma: punch.
const K = (h, c, ci, w = [0, 0, 0]) => ({ hombro_R: h, codo_R: c, muneca_R: w, cintura: ci });
const SL = [K([140, 0, -10], [60, 0, 0], [0, -35, 0]), K([20, 0, -15], [10, 0, 0], [0, 30, 0])];
const TH = [K([-20, 0, -10], [70, 0, 0], [0, -25, 0], [-70, 0, 0]), K([60, 0, -5], [8, 0, 0], [0, 18, 0], [-60, 0, 0])];
const SM = [K([165, 0, -8], [35, 0, 0], [-12, 0, 0]), K([25, 0, -10], [5, 0, 0], [35, 0, 0])];
const PU = [K([10, 0, -10], [100, 0, 0], [0, -25, 0]), K([85, 0, -5], [8, 0, 0], [0, 25, 0])];
const SH = [K([40, 0, -8], [40, 0, 0], [0, -10, 0], [-30, 0, 0]), K([85, 0, -4], [4, 0, 0], [0, 0, 0], [-40, 0, 0])];
const CA = [K([130, 0, -12], [30, 0, 0], [-8, 0, 0]), K([85, 0, -6], [6, 0, 0], [12, 0, 0], [-40, 0, 0])];
// len = duración, hit = instante del impacto/disparo, reach = alcance cuerpo a cuerpo (m), power = fuerza del golpe, lunge = [desde, hasta, velocidad] del impulso
const ATTACKS = {
  slash: { len: .5, hit: .26, reach: 1.9, power: .5, lunge: [.16, .3, 3], kf: [[0, SL[0]], [.16, SL[0]], [.28, SL[1]], [.5, SL[1]]] },
  thrust: { len: .46, hit: .24, reach: 2.3, power: .4, lunge: [.14, .26, 3.5], kf: [[0, TH[0]], [.16, TH[0]], [.26, TH[1]], [.46, TH[1]]] },
  smash: { len: .62, hit: .38, reach: 1.7, power: .9, lunge: [.24, .4, 1.5], kf: [[0, SM[0]], [.26, SM[0]], [.4, SM[1]], [.62, SM[1]]] },
  punch: { len: .4, hit: .2, reach: 1.5, power: .35, lunge: [.1, .22, 2], kf: [[0, PU[0]], [.1, PU[0]], [.22, PU[1]], [.4, PU[1]]] },
  bash: { len: .4, hit: .2, reach: 1.5, power: .55, lunge: [.1, .22, 2.5], kf: [[0, PU[0]], [.1, PU[0]], [.22, PU[1]], [.4, PU[1]]] },
  shoot: { len: .45, hit: .14, proj: 'bala', kf: [[0, SH[0]], [.14, SH[1]], [.45, SH[1]]] },
  cast: { len: .55, hit: .3, proj: 'magia', kf: [[0, CA[0]], [.22, CA[0]], [.34, CA[1]], [.55, CA[1]]] },
};
const flip = j => j.endsWith('_R') ? j.slice(0, -1) + 'L' : j.endsWith('_L') ? j.slice(0, -1) + 'R' : j;
const mirrorPose = p => Object.fromEntries(Object.entries(p).map(([j, v]) => [flip(j), [v[0], -v[1], -v[2]]]));
let atkDef = makeAttack(null);
function makeAttack(w) {
  const d = ATTACKS[w?.atk] || ATTACKS.punch, side = w ? w.side : 'R';
  return { ...d, side, lunge: d.lunge || [0, 0, 0], proj: d.proj ? (w?.proj || d.proj) : null,
    kf: side === 'L' ? d.kf.map(([t, p]) => [t, mirrorPose(p)]) : d.kf };
}
// Arma = primer objeto visible en una mano con tipo de ataque (se prefiere la mano derecha).
function pickWeapon(objs) {
  const c = (objs || []).filter(o => o.visible !== false && LIBRARY[o.type]?.atk && /^mano_[LR]$/.test(o.socket));
  const w = c.find(o => o.socket === 'mano_R') || c[0];
  return w ? { name: LIBRARY[w.type].label, atk: LIBRARY[w.type].atk, proj: LIBRARY[w.type].proj, side: w.socket.slice(-1) } : null;
}
function setWeapon(w) { atkDef = makeAttack(w); $('#weapon').textContent = w ? 'Arma: ' + w.name : 'Sin arma (puños)'; }

// Proyectiles (flechas, balas, magia): vuelan en línea recta y golpean al muñeco.
const PROJ = {
  flecha: { speed: 18, power: .4, life: 1.2, geo: new THREE.CylinderGeometry(.012, .012, .55, 6), mat: new THREE.MeshStandardMaterial({ color: 0xd9c9a0 }) },
  bala: { speed: 32, power: .3, life: .9, geo: new THREE.SphereGeometry(.04, 8, 6), mat: new THREE.MeshBasicMaterial({ color: 0xffd25a }) },
  magia: { speed: 10, power: .7, life: 1.4, geo: new THREE.SphereGeometry(.11, 14, 10), mat: new THREE.MeshBasicMaterial({ color: 0x66ccff }) },
};
const shots = [];
function fire(kind) {
  const P = PROJ[kind] || PROJ.bala, dir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  ch.root.updateMatrixWorld(true);
  const mesh = new THREE.Mesh(P.geo, P.mat); mesh.castShadow = true;
  mesh.position.copy(ch.sockets['mano_' + atkDef.side].getWorldPosition(new THREE.Vector3())).addScaledVector(dir, .4);
  if (kind === 'flecha') mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(mesh); shots.push({ mesh, dir, P, life: P.life });
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i], m = s.mesh.position; m.addScaledVector(s.dir, s.P.speed * dt); s.life -= dt;
    let dead = s.life <= 0 || Math.abs(m.x) > BOUND + 2 || Math.abs(m.z) > BOUND + 2;
    if (Math.hypot(m.x - dummy.position.x, m.z - dummy.position.z) < .55 && m.y > 0 && m.y < 1.95) { hitT = Math.max(hitT, s.P.power); dead = true; }
    else if (solids.some(t => Math.hypot(m.x - t.x, m.z - t.z) < .3)) dead = true;
    if (dead) { scene.remove(s.mesh); shots.splice(i, 1); }
  }
}
const P2 = (z, h, c, ci, ca, ro) => ({ hombro_L: [h, 0, z], hombro_R: [h, 0, -z], codo_L: [c, 0, 0], codo_R: [c, 0, 0], cintura: [ci, 0, 0],
  cadera_L: [ca, 0, 0], cadera_R: [ca, 0, 0], rodilla_L: [ro, 0, 0], rodilla_R: [ro, 0, 0] });
let ANIMS = {}, CARRY = {}, legs = [.43, .42];
function buildAnims(z) {  // z = apertura del hombro para que las manos queden a los lados de la caja
  const REACH = P2(z, -10, 20, 50, 100, 140), WIND = P2(z, 40, 110, -10, 20, 35), REL = P2(z, 95, 8, 25, 0, 0), OPEN = P2(z + 14, 6, 22, 0, 0, 0);  // OPEN: abre los brazos sin flexionar piernas
  CARRY = P2(z, 20, 70, 0, 0, 0);
  ANIMS = { grab: { len: .55, kf: [[0, REACH], [.22, REACH], [.55, CARRY]] }, drop: { len: .4, kf: [[0, CARRY], [.14, OPEN], [.4, OPEN]] },
    throw: { len: .5, kf: [[0, WIND], [.18, WIND], [.3, REL], [.5, REL]] } };
}
// descenso de la cadera según flexión de cadera y rodilla (para que los pies sigan en el suelo)
const legDrop = (h, k) => legs[0] + legs[1] - (legs[0] * Math.cos(D.degToRad(h)) + legs[1] * Math.cos(D.degToRad(h - k)));
function nearCrate() {
  let b = null, bd = 1.3;
  for (const c of crates) { if (c.state !== 'ground') continue; const p = c.mesh.position, d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d < .55 && pos.y >= p.y + .2) continue;  // no se puede agarrar la caja sobre la que estás parado
    if (d < bd && Math.abs(p.y - .25 - pos.y) < .8) { b = c; bd = d; } }
  return b;
}
function kfAt(KF, t) {
  let i = 1; while (i < KF.length - 1 && t > KF[i][0]) i++;
  const [t0, a] = KF[i - 1], [t1, b] = KF[i], f = D.clamp((t - t0) / (t1 - t0), 0, 1), o = {};
  for (const j in a) o[j] = a[j].map((v, n) => v + (b[j][n] - v) * f);
  return o;
}

// ---------- Estado y bucle ----------
const pos = new THREE.Vector3(0, 0, 4), G = 18;
let crAmt = 0, rotY = Math.PI, vy = 0, air = false, landT = 0, atkT = -1, phase = 0, moveAmt = 0, hitDone = false, last = performance.now();

function step(dt, t) {
  // dirección de entrada (la cámara mira hacia -Z)
  let ix = jv.x + (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  let iy = jv.y + (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  const len = Math.hypot(ix, iy), mag = Math.min(1, len); if (len > 0) { ix /= len; iy /= len; }
  const attacking = atkT >= 0, busy = attacking || !!act, crouch = (crouchHeld || keys.c || keys.shift) && !air;
  const speed = 2.4 * mag * (busy ? .25 : 1) * (landT > 0 ? .6 : 1) * (1 - .5 * crAmt) * (held ? .8 : 1);
  crAmt += ((crouch ? 1 : 0) - crAmt) * Math.min(1, dt * 12);
  let dx = ix * speed, dz = iy * speed;
  if (mag > .05 && !busy) rotY += D.clamp(Math.atan2(Math.sin(Math.atan2(ix, iy) - rotY), Math.cos(Math.atan2(ix, iy) - rotY)), -dt * 12, dt * 12);
  if (wantJump && !air && !busy) { vy = 7; air = true; } wantJump = false;
  if (wantAtk && !busy && !held) { atkT = 0; hitDone = false; } wantAtk = false;
  if (!busy && !air) {
    if (!held && wantGrab) { const c = nearCrate();
      if (c) { held = c; c.state = 'held'; c.from.copy(c.mesh.position); rotY = Math.atan2(c.mesh.position.x - pos.x, c.mesh.position.z - pos.z); const ox = c.mesh.position.x - pos.x, oz = c.mesh.position.z - pos.z, d = Math.hypot(ox, oz) || 1;
        act = { name: 'grab', t: 0, gx: c.mesh.position.x - ox / d * .95, gz: c.mesh.position.z - oz / d * .95 }; } }
    else if (held && wantDrop) act = { name: 'drop', t: 0 };
    else if (held && wantThrow) act = { name: 'throw', t: 0 };
  }
  wantGrab = wantDrop = wantThrow = false;
  if (act) {
    act.t += dt;
    if (act.name === 'grab' && act.t < .25) { pos.x += (act.gx - pos.x) * Math.min(1, dt * 10); pos.z += (act.gz - pos.z) * Math.min(1, dt * 10); }
    if (act.name === 'throw' && held && act.t > .26) {  // soltar en el punto de la animación: aterriza 3 cuadros delante
      const c = held, T = .6, tx = pos.x + Math.sin(rotY) * 3, tz = pos.z + Math.cos(rotY) * 3; held = null; c.state = 'fly';
      c.vx = (tx - c.mesh.position.x) / T; c.vz = (tz - c.mesh.position.z) / T; c.vy = (surfaceAt(tx, tz, { ex: c, m: .24 }) + .25 - c.mesh.position.y + .5 * G * T * T) / T;
    }
    if (act.name === 'drop' && held && act.t > .14) releaseCrate();   // las manos se abren y la caja cae
    if (act.t > ANIMS[act.name].len) { if (act.name === 'drop' && held) releaseCrate(); act = null; }
  }
  if (atkT >= 0) {
    const A = atkDef; atkT += dt;
    if (atkT > A.lunge[0] && atkT < A.lunge[1]) { dx += Math.sin(rotY) * A.lunge[2]; dz += Math.cos(rotY) * A.lunge[2]; }
    if (!hitDone && atkT > A.hit) { hitDone = true;
      if (A.proj) fire(A.proj);
      else { const ox = dummy.position.x - pos.x, oz = dummy.position.z - pos.z;
        if (Math.hypot(ox, oz) < A.reach && ox * Math.sin(rotY) + oz * Math.cos(rotY) > .3) hitT = A.power; } }
    if (atkT > A.len) atkT = -1;
  }
  // movimiento horizontal con colisiones simples
  const nx = pos.x + dx * dt, nz = pos.z + dz * dt;
  const walkable = (x, z) => surfaceAt(x, z) <= pos.y + .35;   // cajas y plataformas altas bloquean el paso (hay que saltar)
  if (walkable(nx, nz)) { pos.x = nx; pos.z = nz; }
  else if (walkable(nx, pos.z)) pos.x = nx;
  else if (walkable(pos.x, nz)) pos.z = nz;
  pos.x = D.clamp(pos.x, -BOUND, BOUND); pos.z = D.clamp(pos.z, -BOUND, BOUND);
  for (const s of solids) { const ox = pos.x - s.x, oz = pos.z - s.z, d = Math.hypot(ox, oz), m = s.r + .3; if (d < m && d > 0) { pos.x = s.x + ox / d * m; pos.z = s.z + oz / d * m; } }
  // vertical
  const g = surfaceAt(pos.x, pos.z), was = air;
  if (pos.y < g - 1e-4 && vy <= 0) pos.y = g;   // p. ej. una caja cayó bajo los pies
  if (pos.y > g + 1e-4 || vy > 0) { vy -= G * dt; pos.y += vy * dt; if (pos.y <= g && vy <= 0) { pos.y = g; vy = 0; } }
  air = pos.y > g + 1e-3; if (was && !air) landT = .18; landT = Math.max(0, landT - dt);
  moveAmt += (Math.min(1, Math.hypot(dx, dz) / 2.4) * (air ? 0 : 1) - moveAmt) * Math.min(1, dt * 12);
  phase += dt * Math.hypot(dx, dz) * 4.2;

  // pose = pose base del JSON + animación
  const p = clone(base), A = (j, x, y = 0, z = 0) => { const v = p[j] ? [...p[j]] : [0, 0, 0]; p[j] = [v[0] + x, v[1] + y, v[2] + z]; };
  const m = moveAmt, s = Math.sin(phase), c = Math.cos(phase); let yOff = 0, drop = 0;
  A('hombro_L', 0, 0, 1.5 * Math.sin(t * 2)); A('hombro_R', 0, 0, -1.5 * Math.sin(t * 2)); A('cabeza', 2 * Math.sin(t * 1.3));
  if (m > .02) {
    A('cadera_L', 35 * m * s); A('cadera_R', -35 * m * s);
    A('rodilla_L', m * (8 + 45 * Math.max(0, c))); A('rodilla_R', m * (8 + 45 * Math.max(0, -c)));
    if (!held) { A('hombro_L', -28 * m * s); A('hombro_R', 28 * m * s); A('codo_L', 12 * m); A('codo_R', 12 * m); } A('cintura', 0, 7 * m * s);
    yOff -= .035 * m * Math.abs(s);
  }
  if (air) { const up = vy > 0; A('cadera_L', up ? 45 : 20); A('cadera_R', up ? 15 : 10); A('rodilla_L', up ? 75 : 30); A('rodilla_R', up ? 35 : 20);
    A('hombro_L', up ? 70 : 15, 0, up ? 0 : 25); A('hombro_R', up ? 70 : 15, 0, up ? 0 : -25); }
  if (landT > 0) { const k = landT / .18; A('cadera_L', 40 * k); A('cadera_R', 40 * k); A('rodilla_L', 75 * k); A('rodilla_R', 75 * k); A('hombro_L', 20 * k); A('hombro_R', 20 * k); drop = Math.max(drop, legDrop(40 * k, 75 * k)); }
  if (crAmt > .01) { A('cadera_L', 55 * crAmt); A('cadera_R', 55 * crAmt); A('rodilla_L', 105 * crAmt); A('rodilla_R', 105 * crAmt); A('cintura', 20 * crAmt); drop = Math.max(drop, legDrop(55 * crAmt, 105 * crAmt)); }
  if (held) for (const j of ['hombro_L', 'hombro_R', 'codo_L', 'codo_R']) p[j] = [...CARRY[j]];
  if (act) { const a = ANIMS[act.name], k = kfAt(a.kf, Math.min(act.t, a.len)), env = D.smoothstep(Math.min(act.t / .1, (a.len - act.t) / .12), 0, 1);
    for (const j in k) { const v = p[j] || [0, 0, 0]; p[j] = v.map((x, n) => x + (k[j][n] - x) * env); }
    drop = (1 - env) * drop + env * legDrop(k.cadera_L[0], k.rodilla_L[0]); }
  if (atkT >= 0) { const A = atkDef, k = kfAt(A.kf, atkT), env = D.smoothstep(Math.min(atkT / .1, (A.len - atkT) / .15), 0, 1);
    for (const j in k) { const v = p[j] || [0, 0, 0]; p[j] = v.map((a, n) => a + (k[j][n] - a) * env); } }
  yOff -= drop;
  setPose(ch.joints, p, limits);
  ch.joints.cintura.position.y = baseY + yOff;
  ch.root.position.copy(pos); ch.root.rotation.y = rotY;
  if (held) {
    ch.root.updateMatrixWorld(true);
    const V = ch.sockets.mano_L.getWorldPosition(new THREE.Vector3()).add(ch.sockets.mano_R.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5), n = act?.name;
    if (n === 'grab') held.mesh.position.lerpVectors(held.from, V, D.smoothstep(act.t, .18, .5));
    else held.mesh.position.copy(V);
    held.mesh.rotation.set(0, rotY, 0);
  }
  for (const c of crates) if (c.state === 'ground') {   // si se retira la caja de abajo, la de arriba cae
    const p = c.mesh.position, base = p.y - .25;
    if (base > surfaceAt(p.x, p.z, { ex: c, maxTop: base + .05, m: .24 }) + .02) { c.state = 'fly'; c.vx = c.vy = c.vz = 0; }
  }
  for (const c of crates) if (c.state === 'fly') {
    const m = c.mesh.position, baseBefore = m.y - .25; c.vy -= G * dt;
    const nx = m.x + c.vx * dt, nz = m.z + c.vz * dt;
    if (surfaceAt(nx, nz, { ex: c, m: .24 }) > baseBefore + .15) { c.vx = c.vz = 0; } else { m.x = nx; m.z = nz; }   // choque lateral con otra caja: cae recta
    m.y += c.vy * dt;
    m.x = D.clamp(m.x, -BOUND, BOUND); m.z = D.clamp(m.z, -BOUND, BOUND); c.mesh.rotation.x += dt * 6;
    if (Math.hypot(m.x - dummy.position.x, m.z - dummy.position.z) < .55 && m.y < 1.9) { hitT = .5; c.vx = c.vz = 0; }
    const sy = surfaceAt(m.x, m.z, { ex: c, maxTop: baseBefore + .05, m: .24 });
    if (m.y - .25 <= sy && c.vy < 0) landCrate(c, sy);
  }
  updateShots(dt);
  const near = !held && !act && !air && atkT < 0 ? nearCrate() : null;
  crates.forEach(c => c.mesh.material.emissive.setHex(c === near ? 0x664400 : 0));
  setShown('#bGrab', !!near); setShown('#bDrop', !!held && !act); setShown('#bThrow', !!held && !act);
  shadow.position.set(pos.x, g + .02, pos.z); shadow.scale.setScalar(1 / (1 + (pos.y - g) * .8));
  // muñeco
  hitT = Math.max(0, hitT - dt); dummy.rotation.z = Math.sin(hitT * 30) * hitT * .8; dummy.rotation.x = Math.cos(hitT * 24) * hitT * .4;
  dm.emissive.setHex(hitT > .3 ? 0xff5533 : 0);
  // cámara
  const target = new THREE.Vector3(pos.x, pos.y + 4.2, pos.z + 7);
  cam.position.lerp(target, 1 - Math.exp(-5 * dt)); cam.lookAt(pos.x, pos.y + 1, pos.z);
}

renderer.setAnimationLoop(() => {
  if (!ch) return;
  const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now; step(dt, now / 1000);
  renderer.render(scene, cam);
});

// ---------- Carga del personaje ----------
$('#load').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { loadChar(JSON.parse(await f.text())); msg(''); } catch (err) { msg('No se pudo cargar: ' + err.message); }
};
fetch('./personaje.json').then(r => r.json()).then(loadChar)
  .catch(() => { loadChar({}); msg('No se encontró personaje.json: se usa el personaje por defecto.'); });
cam.position.set(0, 4.2, 11);
