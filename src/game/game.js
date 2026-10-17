import * as THREE from 'three';
import { SEGMENT_DEFAULTS, NEUTRAL, buildCharacter, setPose } from '../character/character.js';
import { LIBRARY, createObject } from '../objects/library.js';

const $ = s => document.querySelector(s), D = THREE.MathUtils, clone = o => JSON.parse(JSON.stringify(o));
const msg = t => { const m = $('#msg'); m.textContent = t; m.style.display = t ? 'block' : 'none'; };

// ---------- Escena y mapa ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); $('#view').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9ec5e8); scene.fog = new THREE.Fog(0x9ec5e8, 18, 40);
scene.add(new THREE.HemisphereLight(0xffffff, 0x557744, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(5, 10, 4); scene.add(sun);
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

// ---------- Personaje (mismo esqueleto que el editor) ----------
let ch = null, base = {}, limits = {}, baseY = 0;
function loadChar(j) {
  if (ch) scene.remove(ch.root);
  const seg = { ...clone(SEGMENT_DEFAULTS), ...(j.character?.segments || {}) };
  const colors = { piel: '#d9b08c', base: '#4a6fa5', ...(j.character?.colors || {}) };
  limits = j.character?.joints || {}; base = { ...clone(NEUTRAL), ...clone(j.pose?.rotations || {}) };
  ch = buildCharacter(seg, colors);
  ch.root.traverse(n => { if (n.userData.marker) n.visible = false; });
  for (const d of j.objects || []) {
    if (!LIBRARY[d.type] || !ch.sockets[d.socket]) continue;
    const n = createObject(d.type, d.material), t = d.transform;
    n.position.fromArray(t.position); n.rotation.set(...t.rotation.map(D.degToRad)); n.scale.fromArray(t.scale);
    n.visible = d.visible !== false; ch.sockets[d.socket].add(n);
  }
  baseY = ch.joints.cintura.position.y; scene.add(ch.root);
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
let wantJump = false, wantAtk = false, walkHeld = false;
function hold(el, on, off) {
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.classList.add('on'); on(); });
  ['pointerup', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => { el.classList.remove('on'); off && off(); }));
}
hold($('#bJump'), () => wantJump = true); hold($('#bAtk'), () => wantAtk = true);
hold($('#bWalk'), () => walkHeld = true, () => walkHeld = false);
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === ' ') { wantJump = true; e.preventDefault(); } if (k === 'j') wantAtk = true;
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('contextmenu', e => e.preventDefault());

// ---------- Animación procedural (valores en la convención del editor) ----------
const KF = [[0, { hombro_R: [140, 0, -10], codo_R: [60, 0, 0], cintura: [0, -35, 0] }],
  [.16, { hombro_R: [140, 0, -10], codo_R: [60, 0, 0], cintura: [0, -35, 0] }],
  [.28, { hombro_R: [20, 0, -15], codo_R: [10, 0, 0], cintura: [0, 30, 0] }],
  [.5, { hombro_R: [20, 0, -15], codo_R: [10, 0, 0], cintura: [0, 30, 0] }]];
const ATK_LEN = .5;
function kfAt(t) {
  let i = 1; while (i < KF.length - 1 && t > KF[i][0]) i++;
  const [t0, a] = KF[i - 1], [t1, b] = KF[i], f = D.clamp((t - t0) / (t1 - t0), 0, 1), o = {};
  for (const j in a) o[j] = a[j].map((v, n) => v + (b[j][n] - v) * f);
  return o;
}

// ---------- Estado y bucle ----------
const pos = new THREE.Vector3(0, 0, 4), facing = Math.PI, G = 18;
let rotY = Math.PI, vy = 0, air = false, landT = 0, atkT = -1, phase = 0, moveAmt = 0, hitDone = false, last = performance.now();

function step(dt, t) {
  // dirección de entrada (la cámara mira hacia -Z)
  let ix = jv.x + (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  let iy = jv.y + (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  if (walkHeld && !ix && !iy) { ix = Math.sin(rotY); iy = Math.cos(rotY); }
  const len = Math.hypot(ix, iy), mag = Math.min(1, len); if (len > 0) { ix /= len; iy /= len; }
  const attacking = atkT >= 0, speed = 2.4 * mag * (attacking ? .3 : 1) * (landT > 0 ? .6 : 1);
  let dx = ix * speed, dz = iy * speed;
  if (mag > .05 && !attacking) rotY += D.clamp(Math.atan2(Math.sin(Math.atan2(ix, iy) - rotY), Math.cos(Math.atan2(ix, iy) - rotY)), -dt * 12, dt * 12);
  if (wantJump && !air && !attacking) { vy = 7; air = true; } wantJump = false;
  if (wantAtk && !attacking) { atkT = 0; hitDone = false; } wantAtk = false;
  if (atkT >= 0) {
    atkT += dt; if (atkT > .16 && atkT < .3) { dx += Math.sin(rotY) * 3; dz += Math.cos(rotY) * 3; }
    if (!hitDone && atkT > .26) { hitDone = true; const ox = dummy.position.x - pos.x, oz = dummy.position.z - pos.z;
      if (Math.hypot(ox, oz) < 1.9 && ox * Math.sin(rotY) + oz * Math.cos(rotY) > .3) hitT = .5; }
    if (atkT > ATK_LEN) atkT = -1;
  }
  // movimiento horizontal con colisiones simples
  const nx = pos.x + dx * dt, nz = pos.z + dz * dt;
  if (groundAt(nx, nz) <= pos.y + .35) { pos.x = nx; pos.z = nz; }
  pos.x = D.clamp(pos.x, -BOUND, BOUND); pos.z = D.clamp(pos.z, -BOUND, BOUND);
  for (const s of solids) { const ox = pos.x - s.x, oz = pos.z - s.z, d = Math.hypot(ox, oz), m = s.r + .3; if (d < m && d > 0) { pos.x = s.x + ox / d * m; pos.z = s.z + oz / d * m; } }
  // vertical
  const g = groundAt(pos.x, pos.z), was = air;
  if (pos.y > g + 1e-4 || vy > 0) { vy -= G * dt; pos.y += vy * dt; if (pos.y <= g && vy <= 0) { pos.y = g; vy = 0; } }
  air = pos.y > g + 1e-3; if (was && !air) landT = .18; landT = Math.max(0, landT - dt);
  moveAmt += (Math.min(1, Math.hypot(dx, dz) / 2.4) * (air ? 0 : 1) - moveAmt) * Math.min(1, dt * 12);
  phase += dt * Math.hypot(dx, dz) * 4.2;

  // pose = pose base del JSON + animación
  const p = clone(base), A = (j, x, y = 0, z = 0) => { const v = p[j] ? [...p[j]] : [0, 0, 0]; p[j] = [v[0] + x, v[1] + y, v[2] + z]; };
  const m = moveAmt, s = Math.sin(phase), c = Math.cos(phase); let yOff = 0;
  A('hombro_L', 0, 0, 1.5 * Math.sin(t * 2)); A('hombro_R', 0, 0, -1.5 * Math.sin(t * 2)); A('cabeza', 2 * Math.sin(t * 1.3));
  if (m > .02) {
    A('cadera_L', 35 * m * s); A('cadera_R', -35 * m * s);
    A('rodilla_L', m * (8 + 45 * Math.max(0, c))); A('rodilla_R', m * (8 + 45 * Math.max(0, -c)));
    A('hombro_L', -28 * m * s); A('hombro_R', 28 * m * s); A('codo_L', 12 * m); A('codo_R', 12 * m); A('cintura', 0, 7 * m * s);
    yOff -= .035 * m * Math.abs(s);
  }
  if (air) { const up = vy > 0; A('cadera_L', up ? 45 : 20); A('cadera_R', up ? 15 : 10); A('rodilla_L', up ? 75 : 30); A('rodilla_R', up ? 35 : 20);
    A('hombro_L', up ? 70 : 15, 0, up ? 0 : 25); A('hombro_R', up ? 70 : 15, 0, up ? 0 : -25); }
  if (landT > 0) { const k = landT / .18; A('cadera_L', 40 * k); A('cadera_R', 40 * k); A('rodilla_L', 75 * k); A('rodilla_R', 75 * k); A('hombro_L', 20 * k); A('hombro_R', 20 * k); yOff -= .2 * k; }
  if (atkT >= 0) { const k = kfAt(atkT), env = D.smoothstep(Math.min(atkT / .1, (ATK_LEN - atkT) / .15), 0, 1);
    for (const j in k) { const v = p[j] || [0, 0, 0]; p[j] = v.map((a, n) => a + (k[j][n] - a) * env); } }
  setPose(ch.joints, p, limits);
  ch.joints.cintura.position.y = baseY + yOff;
  ch.root.position.copy(pos); ch.root.rotation.y = rotY;
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
