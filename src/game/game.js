import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SEGMENT_DEFAULTS, resolvePose, buildCharacter, setPose, disposeCharacter, sideSeg } from '../character/character.js';
import { LIBRARY, createObject } from '../objects/library.js';
import { createWorld } from '../maps/world.js';
import { arenaMap, normalizeMap, readMapSource } from '../maps/mapdata.js';
import { buildStatic, createNode, disposeNode, setEmissive, crateMesh, ballMesh, makeGround } from '../maps/visual.js';

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
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 40 }); sun.shadow.bias = -.0005; scene.add(sun, sun.target);   // el sol sigue al personaje: las sombras no dependen del tamaño del mapa
const cam = new THREE.PerspectiveCamera(50, 1, .1, 80);
const resize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

// El mapa se construye desde datos (src/maps): ver loadMap() más abajo. El de por defecto es arenaMap().
let BOUND = 11.5, world = null, staticMap = null, groundMap = null;
const crates = [], balls = [], dummies = [];
let held = null, act = null;
const shadow = new THREE.Mesh(new THREE.CircleGeometry(.5, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3 }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
const groundAt = (x, z) => world.groundAt(x, z);
const circlesAt = (x, z) => world.circlesAt(x, z);   // árboles, rocas y muñecos cercanos

// ---------- Cajas (y objetos móviles): sólidas, apilables y con choques ----------
// state: 'ground' (apoyada o deslizando), 'fly' (en el aire), 'held' (en manos del personaje).
// guided = vuelo controlado (soltar/lanzar): al aterrizar se detiene y se alinea; tras un choque (guided = false) conserva su velocidad y se desliza.
const CM = .12, RESTITUTION = .5, FRICTION = 3, PLAYER_M = .15;   // margen de apoyo, rebote, rozamiento (1/s), margen del jugador
const REACH_UP = 1.55;   // altura máxima (base de la caja respecto a los pies) a la que se puede agarrar o colocar una caja: pilas de hasta 4
const mass = c => c.r ** 3;
// Altura de la superficie en (x,z): suelo, plataformas y cajas apoyadas.
//   ex = caja a ignorar · maxTop = solo cajas cuya cara superior no pase de esta altura · m = margen horizontal
function surfaceAt(x, z, { ex = null, maxTop = Infinity, m = PLAYER_M } = {}) {
  let h = groundAt(x, z);
  for (const c of crates) {
    if (c === ex || c.state !== 'ground') continue;
    const p = c.mesh.position, top = p.y + c.r;
    if (top > h && top <= maxTop && Math.abs(x - p.x) < c.r + m && Math.abs(z - p.z) < c.r + m) h = top;
  }
  return h;
}
// Mayor altura de plataforma bajo las 4 esquinas de una caja de medio lado r (para chocar con paredes)
const wallAt = (x, z, r) => Math.max(groundAt(x - r, z - r), groundAt(x + r, z - r), groundAt(x - r, z + r), groundAt(x + r, z + r));
// La caja toca una superficie de altura sy: se apoya (y si es un vuelo controlado, se alinea con la caja de debajo para apilar limpio).
function landCrate(c, sy) {
  const m = c.mesh.position, placed = c.guided || c.lob; m.y = sy + c.r; c.state = 'ground'; c.vy = 0; c.spin = 0; c.lob = false; c.mesh.rotation.set(0, 0, 0);
  if (!placed) return;   // tras un choque conserva su velocidad y se desliza
  c.vx = c.vz = 0;
  const sup = crates.find(o => o !== c && o.state === 'ground' && Math.abs(o.mesh.position.y + o.r - sy) < .01 && Math.abs(m.x - o.mesh.position.x) < .3 && Math.abs(m.z - o.mesh.position.z) < .3);
  if (sup) { m.x = sup.mesh.position.x; m.z = sup.mesh.position.z; }
}
// Ayuda de puntería al soltar: apunta al centro de una caja si está pegada delante del personaje (que queda bloqueado a ~0,4 m)
// o si el punto de caída (1 m delante) cae casi sobre ella. Así se apila sin tener que calcular la distancia.
function aimCrate(x, z, ex) {
  const fx = Math.sin(rotY), fz = Math.cos(rotY);
  let best = null, bs = Infinity;
  for (const o of crates) {
    if (o === ex || o.state !== 'ground') continue;
    const ox = o.mesh.position.x, oz = o.mesh.position.z, dx = ox - pos.x, dz = oz - pos.z, d = Math.hypot(dx, dz);
    const adjacent = d > .05 && d < .7 && (dx * fx + dz * fz) / d > .8, atTarget = Math.max(Math.abs(ox - x), Math.abs(oz - z)) < .3;
    if (!adjacent && !atTarget) continue;
    const score = adjacent ? d : 1 + d; if (score < bs) { bs = score; best = o; }
  }
  return best ? [best.mesh.position.x, best.mesh.position.z] : [x, z];
}
// Suelta la caja desde las manos hacia 1 m por delante (o sobre la caja de delante, aunque sea una pila alta), sin agacharse.
// Si el destino es más alto que las manos describe un pequeño arco para dejarla encima. Sirve también en el aire.
function dropTarget(c) {   // dónde caería la caja al soltarla ahora (x, z y altura del centro)
  const [tx, tz] = aimCrate(D.clamp(pos.x + Math.sin(rotY), -BOUND, BOUND), D.clamp(pos.z + Math.cos(rotY), -BOUND, BOUND), c);
  return { tx, tz, ty: surfaceAt(tx, tz, { ex: c, m: CM }) + c.r };
}
const canDrop = c => dropTarget(c).ty - c.r <= pos.y + REACH_UP;   // ¿alcanza el personaje tan alto?
let msgTimer = 0; const hint = t => { msg(t); clearTimeout(msgTimer); msgTimer = setTimeout(() => msg(''), 1800); };
function releaseCrate() {
  const c = held, T = .3, m = c.mesh.position, { tx, tz, ty } = dropTarget(c);
  held = null; c.state = 'fly'; c.guided = true; c.spin = 0; c.lob = true;   // lob: vuelo suave, sin choques laterales hasta aterrizar
  if (ty - c.r > pos.y + REACH_UP) { c.vx = c.vz = c.vy = 0; return; }       // demasiado alto para alcanzarlo: simplemente cae
  if (ty <= m.y - .1) { c.vx = (tx - m.x) / T; c.vz = (tz - m.z) / T; c.vy = (ty - m.y + .5 * G * T * T) / T; return; }   // destino más bajo que las manos
  const apex = ty + .2, tu = Math.sqrt(2 * Math.max(0, apex - m.y) / G), td = Math.sqrt(2 * (apex - ty) / G), TT = tu + td;
  c.vx = (tx - m.x) / TT; c.vz = (tz - m.z) / TT; c.vy = G * tu;
}
// Choque entre dos cajas (AABB en el plano XZ): si se solapan a la misma altura se separan y se reparten el impulso según su masa.
function bump(a, b) {
  if (a.lob || b.lob) return;   // un vuelo suave (soltar) no choca lateralmente: se coloca con cuidado
  const A = a.mesh.position, B = b.mesh.position, dx = B.x - A.x, dz = B.z - A.z, dy = B.y - A.y, sr = a.r + b.r;
  const px = sr - Math.abs(dx), pz = sr - Math.abs(dz), py = sr - Math.abs(dy);
  if (px <= 0 || pz <= 0 || py <= .06) return;   // sin solape, o solo contacto vertical (una sobre otra)
  const ax = px < pz ? 'x' : 'z', n = Math.sign(ax === 'x' ? dx : dz) || 1, pen = ax === 'x' ? px : pz;
  const kv = ax === 'x' ? 'vx' : 'vz', ia = 1 / mass(a), ib = 1 / mass(b), rel = (b[kv] - a[kv]) * n;   // rel < 0: se acercan
  if (rel < 0) { const j = -(1 + RESTITUTION) * rel / (ia + ib); a[kv] -= j * ia * n; b[kv] += j * ib * n; }
  A[ax] -= n * pen * ia / (ia + ib); B[ax] += n * pen * ib / (ia + ib);
  a.guided = b.guided = false;
}
function updateCrates(dt) {
  const list = crates.filter(c => c.state !== 'held');
  for (const c of list) {
    const m = c.mesh.position, r = c.r;
    if (c.state === 'ground') {
      const base = m.y - r;
      if (base > surfaceAt(m.x, m.z, { ex: c, maxTop: base + .05, m: CM }) + .02) { c.state = 'fly'; c.vy = 0; c.spin = 0; c.guided = Math.hypot(c.vx, c.vz) < .3; }   // se retiró el apoyo
      else {
        const rv = world.riverAt(m.x, m.z);   // la corriente de un río arrastra la caja
        if (rv) { c.vx += FRICTION * rv.fx * dt; c.vz += FRICTION * rv.fz * dt; }
        const f = Math.exp(-FRICTION * dt); c.vx *= f; c.vz *= f; if (!rv && Math.hypot(c.vx, c.vz) < .08) c.vx = c.vz = 0;
      }
    }
    if (c.state === 'fly') c.vy -= G * dt;
    const baseBefore = c.bb = m.y - r, nx = m.x + c.vx * dt, nz = m.z + c.vz * dt;
    if (wallAt(nx, m.z, r) > baseBefore + .15) c.vx *= -.3; else m.x = nx;   // paredes de plataformas
    if (wallAt(m.x, nz, r) > baseBefore + .15) c.vz *= -.3; else m.z = nz;
    if (c.state === 'fly') {
      m.y += c.vy * dt; c.mesh.rotation.x += dt * c.spin;
      const ry = c.mesh.rotation.y, tgt = Math.round(ry / (Math.PI / 2)) * Math.PI / 2; c.mesh.rotation.y += (tgt - ry) * Math.min(1, dt * 10);
    }
  }
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) bump(list[i], list[j]);   // primero los choques...
  for (const c of list) if (c.state === 'fly') {                                                            // ...y después el aterrizaje (así un impacto no pierde su impulso)
    const m = c.mesh.position, sy = surfaceAt(m.x, m.z, { ex: c, maxTop: c.bb + .05, m: CM });
    if (m.y - c.r <= sy && c.vy < 0) landCrate(c, sy);
  }
  for (const c of list) {
    const m = c.mesh.position, r = c.r;
    if (Math.hypot(c.vx, c.vz) > 1.5 && m.y < 1.9) for (const d of dummies) if (Math.hypot(m.x - d.x, m.z - d.z) < d.r + r + .1) d.hit = Math.max(d.hit, .5);   // golpea al muñeco
    // el jugador es sólido para las cajas que llegan hacia él (él las bloquea con el mismo margen)
    if (!c.lob && m.y - r < pos.y + 1.7 && m.y + r > pos.y + .1) {
      const dx = m.x - pos.x, dz = m.z - pos.z, px = r + PLAYER_M - Math.abs(dx), pz = r + PLAYER_M - Math.abs(dz);
      if (px > 0 && pz > 0) { if (px < pz) { m.x += Math.sign(dx || 1) * (px + .01); c.vx = 0; } else { m.z += Math.sign(dz || 1) * (pz + .01); c.vz = 0; } c.guided = false; }
    }
    for (const s of circlesAt(m.x, m.z)) {   // árboles, rocas y muñecos: obstáculos fijos que hacen rebotar la caja
      const ox = m.x - s.x, oz = m.z - s.z, d = Math.hypot(ox, oz), mn = s.r + r;
      if (d < mn && d > 0) { m.x = s.x + ox / d * mn; m.z = s.z + oz / d * mn; const vn = (c.vx * ox + c.vz * oz) / d;
        if (vn < 0) { c.vx -= (1 + .3) * vn * ox / d; c.vz -= (1 + .3) * vn * oz / d; } c.guided = false; }
    }
    m.x = D.clamp(m.x, -BOUND, BOUND); m.z = D.clamp(m.z, -BOUND, BOUND);
  }
}
const setShown = (sel, v) => { const e = $(sel); if (e.hidden === v) e.hidden = !v; };

shadow.visible = false;  // sombras reales (cada pieza activa las suyas): se oculta la sombra falsa

// ---------- Personaje (mismo esqueleto que el editor) ----------
let ch = null, base = {}, limits = {}, baseY = 0;
function loadChar(j) {
  if (ch) { scene.remove(ch.root); disposeCharacter(ch); }
  const seg = { ...clone(SEGMENT_DEFAULTS), ...(j.character?.segments || {}) };
  const colors = { piel: '#d9b08c', base: '#4a6fa5', ...(j.character?.colors || {}) };
  limits = j.character?.joints || {}; base = resolvePose(j);
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
    for (const d of dummies) if (Math.hypot(m.x - d.x, m.z - d.z) < d.r + .15 && m.y > 0 && m.y < 1.95) { d.hit = Math.max(d.hit, s.P.power); dead = true; }
    for (const b of balls) { const q = b.mesh.position; if (Math.hypot(m.x - q.x, m.y - q.y, m.z - q.z) < b.r + .08) { b.vx += s.dir.x * s.P.speed * .25; b.vz += s.dir.z * s.P.speed * .25; b.vy += 1.5; dead = true; } }
    if (!dead && circlesAt(m.x, m.z).some(t => Math.hypot(m.x - t.x, m.z - t.z) < .3)) dead = true;
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
// ---------- Pelotas: rebotan, ruedan por las laderas, las arrastra el río y se patean al chocar con el personaje o al atacar ----------
const BALL_E = .55, BALL_ROLL = .6, AXIS = new THREE.Vector3();
let pvx = 0, pvz = 0;   // velocidad horizontal del personaje en este fotograma (para el empujón)
function updateBalls(dt) {
  for (const b of balls) {
    const m = b.mesh.position, r = b.r;
    b.vy -= G * dt;
    const gy = groundAt(m.x, m.z), low = m.y - r <= gy + .03; let flat = true;
    if (low) {
      const rv = world.riverAt(m.x, m.z);
      if (rv) { const k = Math.min(1, dt * 1.5); b.vx += (rv.fx - b.vx) * k; b.vz += (rv.fz - b.vz) * k; }
      const e = .25, hxp = groundAt(m.x + e, m.z), hxm = groundAt(m.x - e, m.z), hzp = groundAt(m.x, m.z + e), hzm = groundAt(m.x, m.z - e);
      if ([hxp, hxm, hzp, hzm].every(h => Math.abs(h - gy) <= .3)) {   // pendiente suave (un escalón o una pared no cuentan como ladera)
        const gx = (hxp - hxm) / (2 * e), gz = (hzp - hzm) / (2 * e); b.vx -= G * gx * dt * .7; b.vz -= G * gz * dt * .7; flat = Math.hypot(gx, gz) < .03;
      }
      const f = Math.exp(-BALL_ROLL * dt); b.vx *= f; b.vz *= f;
      if (flat && Math.hypot(b.vx, b.vz) < .05 && Math.abs(b.vy) < .6) b.vx = b.vz = 0;
    }
    const base = m.y - r, nx = m.x + b.vx * dt, nz = m.z + b.vz * dt, lead = r * .9;
    if (groundAt(nx + Math.sign(b.vx) * lead, m.z) > base + .12) b.vx *= -.6; else m.x = nx;   // paredes y plataformas altas
    if (groundAt(m.x, nz + Math.sign(b.vz) * lead) > base + .12) b.vz *= -.6; else m.z = nz;
    m.y += b.vy * dt;
    const sy = surfaceAt(m.x, m.z, { maxTop: base + .3, m: 0 });   // suelo, montañas, plataformas y cajas apoyadas
    if (m.y - r < sy) { m.y = sy + r; b.vy = b.vy < -1.2 ? -b.vy * BALL_E : 0; }
    for (const c of crates) {   // choque con cajas (esfera contra caja)
      if (c.state === 'held') continue;
      const p = c.mesh.position, h = c.r, qx = D.clamp(m.x, p.x - h, p.x + h), qy = D.clamp(m.y, p.y - h, p.y + h), qz = D.clamp(m.z, p.z - h, p.z + h);
      let ox = m.x - qx, oy = m.y - qy, oz = m.z - qz; const d2 = ox * ox + oy * oy + oz * oz;
      if (d2 >= r * r || d2 < 1e-12) continue;
      const d = Math.sqrt(d2); ox /= d; oy /= d; oz /= d; const pen = r - d; m.x += ox * pen; m.y += oy * pen; m.z += oz * pen;
      const mb = r ** 3 * .6, mc = c.r ** 3, vrel = (b.vx - c.vx) * ox + (b.vy - c.vy) * oy + (b.vz - c.vz) * oz;
      if (vrel < 0) { const j = -(1 + BALL_E) * vrel / (1 / mb + 1 / mc); b.vx += j / mb * ox; b.vy += j / mb * oy; b.vz += j / mb * oz; c.vx -= j / mc * ox; c.vz -= j / mc * oz; c.guided = false; }
    }
    { const dx = m.x - pos.x, dz = m.z - pos.z, d = Math.hypot(dx, dz), R = .3 + r;   // el personaje la empuja al chocar con ella
      if (d < R && m.y - r < pos.y + 1.7 && m.y + r > pos.y + .05) {
        const nx2 = d > 1e-4 ? dx / d : Math.sin(rotY), nz2 = d > 1e-4 ? dz / d : Math.cos(rotY);
        m.x = pos.x + nx2 * R; m.z = pos.z + nz2 * R;
        const vrel = (b.vx - pvx) * nx2 + (b.vz - pvz) * nz2;
        if (vrel < 0) { const j = -(1 + .7) * vrel; b.vx += j * nx2; b.vz += j * nz2; if (b.vy < 1.5 && j > 1) b.vy = Math.min(2.5, j * .4); }
      } }
    if (Math.hypot(b.vx, b.vz) > 3 && m.y < 1.9) for (const d of dummies) if (Math.hypot(m.x - d.x, m.z - d.z) < d.r + r + .1) d.hit = Math.max(d.hit, .3);
    for (const sd of circlesAt(m.x, m.z)) {   // árboles, rocas y muñecos
      const ox = m.x - sd.x, oz = m.z - sd.z, d = Math.hypot(ox, oz), mn = sd.r + r;
      if (d < mn && d > 0) { m.x = sd.x + ox / d * mn; m.z = sd.z + oz / d * mn; const vn = (b.vx * ox + b.vz * oz) / d; if (vn < 0) { b.vx -= (1 + BALL_E) * vn * ox / d; b.vz -= (1 + BALL_E) * vn * oz / d; } }
    }
    if (Math.abs(m.x) > BOUND - r) { m.x = Math.sign(m.x) * (BOUND - r); b.vx *= -.5; }
    if (Math.abs(m.z) > BOUND - r) { m.z = Math.sign(m.z) * (BOUND - r); b.vz *= -.5; }
    const sp = Math.hypot(b.vx, b.vz); if (sp > .02 && low) b.mesh.rotateOnWorldAxis(AXIS.set(b.vz, 0, -b.vx).normalize(), sp * dt / r);   // rueda
  }
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {   // pelota contra pelota
    const a = balls[i], c = balls[j], A = a.mesh.position, B = c.mesh.position, dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, d = Math.hypot(dx, dy, dz), mn = a.r + c.r;
    if (d >= mn || d < 1e-6) continue;
    const nx = dx / d, ny = dy / d, nz = dz / d, pen = mn - d, ia = 1 / a.r ** 3, ib = 1 / c.r ** 3, t = ia + ib;
    A.x -= nx * pen * ia / t; A.y -= ny * pen * ia / t; A.z -= nz * pen * ia / t; B.x += nx * pen * ib / t; B.y += ny * pen * ib / t; B.z += nz * pen * ib / t;
    const vrel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny + (c.vz - a.vz) * nz;
    if (vrel < 0) { const k = -(1 + BALL_E) * vrel / t; a.vx -= k * ia * nx; a.vy -= k * ia * ny; a.vz -= k * ia * nz; c.vx += k * ib * nx; c.vy += k * ib * ny; c.vz += k * ib * nz; }
  }
}

function nearCrate() {
  let b = null, bs = Infinity;
  for (const c of crates) { if (c.state !== 'ground') continue; const p = c.mesh.position, d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d < c.r + .3 && pos.y >= p.y + c.r - .05) continue;  // no se puede agarrar la caja sobre la que estás parado
    const rel = p.y - c.r - pos.y, score = d - .15 * p.y;      // a igual distancia se prefiere la de arriba de la pila
    if (d < 1.3 && rel > -.8 && rel <= REACH_UP && score < bs) { b = c; bs = score; } }
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
  const speed = 2.4 * mag * (busy && !(act && air) ? .25 : 1) * (landT > 0 ? .6 : 1) * (1 - .5 * crAmt) * (held ? .8 : 1);
  crAmt += ((crouch ? 1 : 0) - crAmt) * Math.min(1, dt * 12);
  let dx = ix * speed, dz = iy * speed;
  if (mag > .05 && !busy) rotY += D.clamp(Math.atan2(Math.sin(Math.atan2(ix, iy) - rotY), Math.cos(Math.atan2(ix, iy) - rotY)), -dt * 12, dt * 12);
  if (wantJump && !air && !busy) { vy = 7; air = true; } wantJump = false;
  if (wantAtk && !busy && !held) { atkT = 0; hitDone = false; } wantAtk = false;
  if (!busy) {   // agarrar solo en el suelo; soltar y lanzar también en pleno salto
    if (!held && wantGrab && !air) { const c = nearCrate();
      if (c) { held = c; c.state = 'held'; c.vx = c.vy = c.vz = 0; c.from.copy(c.mesh.position); rotY = Math.atan2(c.mesh.position.x - pos.x, c.mesh.position.z - pos.z); const ox = c.mesh.position.x - pos.x, oz = c.mesh.position.z - pos.z, d = Math.hypot(ox, oz) || 1;
        act = { name: 'grab', t: 0, gx: c.mesh.position.x - ox / d * .95, gz: c.mesh.position.z - oz / d * .95 }; } }
    else if (held && wantDrop) { if (canDrop(held)) act = { name: 'drop', t: 0 }; else hint('Está muy alto: retrocede o salta para dejar la caja'); }
    else if (held && wantThrow) act = { name: 'throw', t: 0 };
  }
  wantGrab = wantDrop = wantThrow = false;
  if (act) {
    act.t += dt;
    if (act.name === 'grab' && act.t < .25) { pos.x += (act.gx - pos.x) * Math.min(1, dt * 10); pos.z += (act.gz - pos.z) * Math.min(1, dt * 10); }
    if (act.name === 'throw' && held && act.t > .26) {  // soltar en el punto de la animación: aterriza 3 cuadros delante
      const c = held, T = .6, tx = pos.x + Math.sin(rotY) * 3, tz = pos.z + Math.cos(rotY) * 3; held = null; c.state = 'fly';
      c.vx = (tx - c.mesh.position.x) / T; c.vz = (tz - c.mesh.position.z) / T; c.vy = (surfaceAt(tx, tz, { ex: c, m: CM }) + c.r - c.mesh.position.y + .5 * G * T * T) / T; c.guided = true; c.spin = 6;
    }
    if (act.name === 'drop' && held && act.t > .06) releaseCrate();   // las manos empiezan a abrirse y la caja cae (antes de que retrocedan hacia el pecho)
    if (act.t > ANIMS[act.name].len) { if (act.name === 'drop' && held) releaseCrate(); act = null; }
  }
  if (atkT >= 0) {
    const A = atkDef; atkT += dt;
    if (atkT > A.lunge[0] && atkT < A.lunge[1]) { dx += Math.sin(rotY) * A.lunge[2]; dz += Math.cos(rotY) * A.lunge[2]; }
    if (!hitDone && atkT > A.hit) { hitDone = true;
      if (A.proj) fire(A.proj);
      else {
        const sn = Math.sin(rotY), cs = Math.cos(rotY);
        for (const d of dummies) { const ox = d.x - pos.x, oz = d.z - pos.z; if (Math.hypot(ox, oz) < A.reach && ox * sn + oz * cs > .3) d.hit = A.power; }
        for (const b of balls) {   // patada: la pelota sale despedida hacia donde mira el personaje
          const ox = b.mesh.position.x - pos.x, oz = b.mesh.position.z - pos.z, dd = Math.hypot(ox, oz);
          if (dd < A.reach && dd > 0 && (ox * sn + oz * cs) / dd > .3 && b.mesh.position.y < pos.y + 1.5) { const k = 4 + A.power * 8; b.vx = sn * k; b.vz = cs * k; b.vy = 2 + A.power * 4; }
        }
      } }
    if (atkT > A.len) atkT = -1;
  }
  const rv = !air ? world.riverAt(pos.x, pos.z) : null;   // en un río el personaje avanza más despacio y la corriente lo arrastra
  if (rv) { dx = dx * .55 + rv.fx * .35; dz = dz * .55 + rv.fz * .35; }
  pvx = dx; pvz = dz;
  // movimiento horizontal con colisiones simples
  const nx = pos.x + dx * dt, nz = pos.z + dz * dt;
  const walkable = (x, z) => surfaceAt(x, z) <= pos.y + .35;   // cajas y plataformas altas bloquean el paso (hay que saltar)
  if (walkable(nx, nz)) { pos.x = nx; pos.z = nz; }
  else if (walkable(nx, pos.z)) pos.x = nx;
  else if (walkable(pos.x, nz)) pos.z = nz;
  pos.x = D.clamp(pos.x, -BOUND, BOUND); pos.z = D.clamp(pos.z, -BOUND, BOUND);
  for (const s of circlesAt(pos.x, pos.z)) { const ox = pos.x - s.x, oz = pos.z - s.z, d = Math.hypot(ox, oz), m = s.r + .3; if (d < m && d > 0) { pos.x = s.x + ox / d * m; pos.z = s.z + oz / d * m; } }
  // vertical
  const g = surfaceAt(pos.x, pos.z), was = air;
  if (pos.y < g - 1e-4 && vy <= 0) pos.y = g;   // p. ej. una caja cayó bajo los pies
  else if (!air && vy <= 0 && pos.y - g <= .3) pos.y = g;   // al bajar una pendiente (montaña) o un escalón pequeño se queda pegado al suelo
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
    drop = (1 - env) * drop + env * (air ? 0 : legDrop(k.cadera_L[0], k.rodilla_L[0])); }
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
  updateCrates(dt); updateBalls(dt);
  updateShots(dt);
  const near = !held && !act && !air && atkT < 0 ? nearCrate() : null;
  crates.forEach(c => c.mesh.material.emissive.setHex(c === near ? 0x664400 : 0));
  setShown('#bGrab', !!near); setShown('#bDrop', !!held && !act); setShown('#bThrow', !!held && !act);
  shadow.position.set(pos.x, g + .02, pos.z); shadow.scale.setScalar(1 / (1 + (pos.y - g) * .8));
  // muñeco
  for (const d of dummies) {
    d.hit = Math.max(0, d.hit - dt); d.g.rotation.z = Math.sin(d.hit * 30) * d.hit * .8; d.g.rotation.x = Math.cos(d.hit * 24) * d.hit * .4;
    setEmissive(d.g, d.hit > .3 ? 0xff5533 : 0);
  }
  sun.position.set(pos.x + 6, 12, pos.z + 5); sun.target.position.set(pos.x, 0, pos.z); sun.target.updateMatrixWorld();
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
// personaje.json junto a la página (game.html) o, si la página es un mapa exportado (maps/<id>/), en la raíz del sitio
(async () => {
  for (const u of ['./personaje.json', '../../personaje.json']) {
    try { const r = await fetch(u); if (r.ok !== false) return loadChar(await r.json()); } catch { /* se prueba la siguiente ruta */ }
  }
  loadChar({}); msg('No se encontró personaje.json: se usa el personaje por defecto.');
})();

// ---------- Mapas ----------
function unloadMap() {
  if (staticMap) { scene.remove(staticMap.root); staticMap.dispose(); staticMap = null; }
  if (groundMap) { scene.remove(groundMap.group); groundMap.dispose(); groundMap = null; }
  for (const c of crates) { scene.remove(c.mesh); c.mesh.material.dispose(); } crates.length = 0;
  for (const b of balls) { scene.remove(b.mesh); b.mesh.userData.mats.forEach(m => m.dispose()); } balls.length = 0;
  for (const d of dummies) { scene.remove(d.g); disposeNode(d.g); } dummies.length = 0;
  for (const sh of shots) scene.remove(sh.mesh); shots.length = 0;
  held = null; act = null; atkT = -1; hitDone = false;
}
// Construye el mundo desde un mapa ya validado (normalizeMap): colisiones, estáticos agrupados, cajas, pelotas, muñecos y punto de inicio.
function loadMap(map) {
  unloadMap();
  world = createWorld(map); BOUND = world.bound;
  groundMap = makeGround(map); scene.add(groundMap.group);
  staticMap = buildStatic(map); scene.add(staticMap.root);
  scene.background.set(map.sky); scene.fog = map.fog ? new THREE.Fog(map.sky, map.fog[0], map.fog[1]) : null;
  cam.far = Math.max(80, map.size * 2.2); cam.updateProjectionMatrix();
  for (const c of world.crates) {
    const mesh = crateMesh(c.r, c.col); mesh.position.set(c.x, groundAt(c.x, c.z) + c.r, c.z); scene.add(mesh);
    crates.push({ mesh, r: c.r, state: 'ground', vx: 0, vy: 0, vz: 0, guided: false, spin: 0, lob: false, from: new THREE.Vector3() });
  }
  for (const b of world.balls) { const mesh = ballMesh(b.r, b.col); mesh.position.set(b.x, groundAt(b.x, b.z) + b.r, b.z); scene.add(mesh); balls.push({ mesh, r: b.r, vx: 0, vy: 0, vz: 0 }); }
  for (const d of world.dummies) { const g = createNode(d.obj); scene.add(g); dummies.push({ g, x: d.x, z: d.z, r: d.r, hit: 0 }); }
  pos.set(world.spawn.x, groundAt(world.spawn.x, world.spawn.z), world.spawn.z); rotY = world.spawn.rot; vy = 0; air = false; landT = 0; pvx = pvz = 0;
  cam.position.set(pos.x, pos.y + 4.2, pos.z + 7);
}

// Selector: mapa por defecto, mapas guardados por el editor (localStorage), archivos de maps/index.json, ?map=ruta y archivos sueltos.
const mapSel = $('#mapSel'), EDITOR_MAPS = 'editor3d:maps', params = new URLSearchParams(location.search), sources = new Map();
const editorMaps = () => { try { return JSON.parse(localStorage.getItem(EDITOR_MAPS) || '{}') || {}; } catch { return {}; } };
async function fetchMap(url) { const r = await fetch(url); if (r.ok === false) throw new Error(`no se pudo leer ${url} (${r.status})`); return readMapSource(await r.text()); }
const addSource = (value, label, get) => { sources.set(value, get); const o = document.createElement('option'); o.value = value; o.textContent = label; mapSel.appendChild(o); };
async function refreshMaps(want) {
  sources.clear(); mapSel.innerHTML = '';
  if (globalThis.__GAME_MAP__) addSource('embedded', 'Mapa de esta página', () => globalThis.__GAME_MAP__);
  addSource('arena', 'Mapa de prueba', () => arenaMap());
  for (const [k, m] of Object.entries(editorMaps())) addSource('editor:' + k, 'Editor: ' + (m?.name || k), () => editorMaps()[k]);
  try {
    const r = await fetch('./maps/index.json');
    if (r.ok !== false) for (const it of await r.json()) { const path = typeof it === 'string' ? it : it?.path; if (path) addSource('url:' + path, 'Archivo: ' + (it.name || path), () => fetchMap(path)); }
  } catch { /* no hay maps/index.json: se omite */ }
  const q = params.get('map'); if (q && !sources.has('url:' + q)) addSource('url:' + q, 'Archivo: ' + q, () => fetchMap(q));
  mapSel.value = sources.has(want) ? want : 'arena';
}
async function useMap(value) {
  try {
    const get = sources.get(value); if (!get) throw new Error('ese mapa ya no existe');
    const raw = await get(); if (!raw) throw new Error('ese mapa ya no existe');
    const { map, warnings } = normalizeMap(raw); loadMap(map); mapSel.value = value; msg(warnings[0] || '');
  } catch (err) { msg('No se pudo cargar el mapa: ' + err.message); }
}
mapSel.onchange = () => useMap(mapSel.value);
$('#resetMap').onclick = () => useMap(mapSel.value);   // recarga el mapa elegido (si lo editaste en el editor, trae la última versión)
$('#loadMap').onclick = () => $('#mapFile').click();
$('#mapFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const raw = readMapSource(await f.text()), key = 'file:' + f.name; normalizeMap(raw); addSource(key, 'Archivo: ' + f.name, () => raw); await useMap(key); }
  catch (err) { msg('No se pudo cargar el mapa: ' + err.message); }
};
{
  // Mapa inicial: el de la página (si es un mapa exportado) > ?editorMap=id > ?map=ruta > el de prueba. Se carga ya el síncrono para no mostrar vacío.
  const first = globalThis.__GAME_MAP__ ? 'embedded' : params.get('editorMap') ? 'editor:' + params.get('editorMap') : params.get('map') ? 'url:' + params.get('map') : 'arena';
  let initial; try { initial = normalizeMap(globalThis.__GAME_MAP__ ?? arenaMap()).map; } catch (err) { initial = normalizeMap(arenaMap()).map; msg('El mapa de esta página no es válido: ' + err.message); }
  loadMap(initial);
  refreshMaps(first).then(() => { if (first !== 'arena' && first !== 'embedded') useMap(first); });
}
