import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { SEGMENT_DEFAULTS, POSE_JOINTS, NEUTRAL, POSE_T, limitFor, buildCharacter, setPose, characterHeight, resolvePart, updatePart } from './character/character.js';
import { TEXTURE_NAMES, makeMaterial } from './character/textures.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LIBRARY, createObject, objDefaults, setMainMaterial } from './objects/library.js';
import { download, validate, SCHEMA_VERSION } from './io/io.js';

const $ = s => document.querySelector(s), D = THREE.MathUtils, r4 = v => Math.round(v * 1e4) / 1e4;
const clone = o => JSON.parse(JSON.stringify(o));
const DEFAULT_COLORS = { piel: '#d9b08c', base: '#4a6fa5' };

// ---------- Escena ----------
const view = $('#view'), tag = $('#tag');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setPixelRatio(devicePixelRatio); view.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x20242b);
// Iluminación de estudio: reflejos de ambiente + luz principal con sombras + contraluz
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .7;
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 4, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .5, far: 12 }); key.shadow.bias = -.0004; scene.add(key);
const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2); rim.position.set(-3, 3, -3); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: .35 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.001; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(6, 60, 0x666c78, 0x3a3f48); scene.add(grid);
const camera = new THREE.PerspectiveCamera(45, 1, .05, 100);
const orbit = new OrbitControls(camera, renderer.domElement);
const tc = new TransformControls(camera, renderer.domElement); tc.setSpace('local'); scene.add(tc.getHelper());
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v3 = new THREE.Vector3();

function resize() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(view);
renderer.setAnimationLoop(() => { orbit.update(); renderer.render(scene, camera); });

function setView(v) {
  const h = characterHeight(state.seg), d = Math.max(3, h * 2.2);
  const p = { persp: [d * .6, h * .7, d * .8], front: [0, h / 2, d], side: [d, h / 2, 0], top: [0, d, .001] }[v];
  camera.position.set(...p); orbit.target.set(0, h / 2, 0); orbit.update();
}

// ---------- Estado ----------
const state = { seg: clone(SEGMENT_DEFAULTS), colors: { ...DEFAULT_COLORS }, limits: {}, parts: {}, pose: clone(NEUTRAL), objects: [] };
let ch = null, selected = null, selPart = null, idCounter = 1;

function rebuild() {
  tc.detach();
  state.objects.forEach(o => o.node.removeFromParent());
  if (ch) scene.remove(ch.root);
  ch = buildCharacter(state.seg, state.colors, state.parts); scene.add(ch.root);
  setPose(ch.joints, state.pose, state.limits);
  state.objects.forEach(o => (ch.sockets[o.socket] || ch.sockets.pecho).add(o.node));
  ch.root.traverse(n => { if (n.userData.marker) n.visible = $('#markers').checked; });
  if (selected) tc.attach(selected.node);
  hlPart();
}

function addObject(type, socket, opt = {}) {
  const mat = { ...objDefaults(type), ...(opt.mat || {}) }, node = createObject(type, mat);
  const o = { id: opt.id || 'obj_' + String(idCounter++).padStart(3, '0'), type, socket, node,
    mat, mirrorOf: opt.mirrorOf || null };
  const n = parseInt((o.id.match(/\d+$/) || [0])[0]); if (n >= idCounter) idCounter = n + 1;
  node.visible = opt.visible !== false;
  ch.sockets[socket].add(node); state.objects.push(o);
  return o;
}

const heightOf = () => +characterHeight(state.seg).toFixed(3);
function serialize() {
  return { schemaVersion: SCHEMA_VERSION,
    character: { name: 'personaje_01', units: 'm', height: heightOf(), segments: clone(state.seg), symmetric: true, colors: { ...state.colors }, parts: clone(state.parts), joints: clone(state.limits) },
    pose: { name: 'custom', rotations: clone(state.pose) },
    objects: state.objects.map(o => {
      const L = ch.refLen[o.socket], p = o.node.position.toArray(), r = o.node.rotation;
      return { id: o.id, type: o.type, socket: o.socket,
        transform: { position: p.map(r4), rotation: [r.x, r.y, r.z].map(a => r4(D.radToDeg(a))), scale: o.node.scale.toArray().map(r4) },
        normalized: { position: p.map(v => r4(v / L)), referenceLength: r4(L) },
        material: { ...o.mat }, visible: o.node.visible, mirrorOf: o.mirrorOf };
    }) };
}

function load(j, { onlyObjects = false, useNorm = false, record = true } = {}) {
  select(null); selPart = null;
  if (!onlyObjects && j.character) {
    state.seg = { ...clone(SEGMENT_DEFAULTS), ...(j.character.segments || {}) };
    state.colors = { ...DEFAULT_COLORS, ...(j.character.colors || {}) };
    state.limits = j.character.joints || {};
    state.parts = j.character.parts ? clone(j.character.parts) : {};
    state.pose = j.pose?.rotations ? clone(j.pose.rotations) : clone(NEUTRAL);
  }
  state.objects.forEach(o => o.node.removeFromParent()); state.objects = [];
  rebuild();
  const warns = validate(j, ch.sockets);
  for (const d of j.objects || []) {
    if (!LIBRARY[d.type] || !ch.sockets[d.socket]) continue;
    const o = addObject(d.type, d.socket, { id: d.id, mat: d.material, mirrorOf: d.mirrorOf, visible: d.visible });
    const t = d.transform, L = ch.refLen[d.socket];
    o.node.position.fromArray(useNorm && d.normalized ? d.normalized.position.map(v => v * L) : t.position);
    o.node.rotation.set(...t.rotation.map(D.degToRad));
    o.node.scale.fromArray(t.scale);
  }
  syncUI(); setView('persp');
  if (record) commit();
  if (warns.length) alert('Avisos al cargar:\n' + warns.join('\n'));
}

// ---------- Historial (undo/redo por instantáneas) ----------
let hist = [], hi = -1;
function commit() {
  const s = JSON.stringify(serialize()); if (hist[hi] === s) return;
  hist.length = hi + 1; hist.push(s); hi++;
  if (hist.length > 100) { hist.shift(); hi--; }
  localStorage.setItem('editor3d:last', s);
}
const undo = () => { if (hi > 0) { hi--; load(JSON.parse(hist[hi]), { record: false }); } };
const redo = () => { if (hi < hist.length - 1) { hi++; load(JSON.parse(hist[hi]), { record: false }); } };

// ---------- Selección y arrastre ----------
function setRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
}
function select(o) { selected = o; o ? tc.attach(o.node) : tc.detach(); if (o) { selPart = null; hlPart(); refreshPart(); } refreshProps(); }

let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || tc.axis) return;
  setRay(e);
  const hit = ray.intersectObjects(state.objects.map(o => o.node), true)[0];
  let o = null;
  if (hit) { let n = hit.object; while (n && !(o = state.objects.find(x => x.node === n))) n = n.parent; }
  if (o) select(o);
  else { select(null); const bh = ray.intersectObject(ch.root, true).find(i => i.object.userData.body); selectPart(bh ? bh.object.userData.part : null); }
});
tc.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; if (!e.value) { refreshProps(); commit(); } });
tc.addEventListener('objectChange', refreshProps);

function nearestSocket(e) {
  setRay(e);
  const h = ray.intersectObject(ch.root, true).find(i => i.object.userData.body); if (!h) return null;
  let best = null, bd = 1e9;
  for (const [n, s] of Object.entries(ch.sockets)) { const d = s.getWorldPosition(v3).distanceTo(h.point); if (d < bd) { bd = d; best = n; } }
  return best;
}
function highlight(name) {
  for (const [n, s] of Object.entries(ch.sockets)) s.children[0].scale.setScalar(n === name ? 2.5 : 1);
  tag.style.display = name ? 'block' : 'none'; tag.textContent = name ? 'Socket: ' + name : '';
}
view.addEventListener('dragover', e => { e.preventDefault(); highlight(nearestSocket(e)); });
view.addEventListener('dragleave', () => highlight(null));
view.addEventListener('drop', e => {
  e.preventDefault(); const type = e.dataTransfer.getData('text/plain'); if (!LIBRARY[type]) return;
  const sock = nearestSocket(e) || LIBRARY[type].socket; highlight(null);
  select(addObject(type, sock)); commit();
});

// ---------- Panel: biblioteca ----------
for (const [type, d] of Object.entries(LIBRARY)) {
  const el = document.createElement('div'); el.className = 'item'; el.draggable = true; el.textContent = d.label;
  el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', type));
  el.addEventListener('click', () => { select(addObject(type, d.socket)); commit(); });
  $('#libList').appendChild(el);
}

// ---------- Panel: cuerpo y pose ----------
const fill = (sel, items) => { sel.innerHTML = items.map(i => `<option>${i}</option>`).join(''); };
fill($('#segSel'), Object.keys(SEGMENT_DEFAULTS)); fill($('#jointSel'), POSE_JOINTS);
$('#poseRows').innerHTML = ['X', 'Y', 'Z'].map((a, i) =>
  `<div class="row"><label>${a}</label><input type="range" data-p="${i}" step="1"><output></output></div>`).join('');

function syncUI() {
  const s = state.seg[$('#segSel').value];
  $('#segLen').value = s.length; $('#segWid').value = s.width;
  $('#segLenV').textContent = s.length.toFixed(3); $('#segWidV').textContent = s.width.toFixed(3);
  $('#cPiel').value = state.colors.piel; $('#cBase').value = state.colors.base;
  const j = $('#jointSel').value, [mn, mx] = limitFor(j, state.limits), v = state.pose[j] || [0, 0, 0];
  document.querySelectorAll('#poseRows input').forEach((el, i) => {
    el.min = mn[i]; el.max = mx[i]; el.disabled = mn[i] === mx[i]; el.value = v[i]; el.nextElementSibling.textContent = Math.round(v[i]) + '°';
  });
  const sel = $('#oSock'); if (sel) fill(sel, Object.keys(ch.sockets));
  refreshProps(); refreshPart();
}
$('#segSel').onchange = $('#jointSel').onchange = syncUI;
for (const [id, k] of [['#segLen', 'length'], ['#segWid', 'width']]) {
  $(id).oninput = e => { state.seg[$('#segSel').value][k] = +e.target.value; rebuild(); syncUI(); };
  $(id).onchange = commit;
}
for (const [id, k] of [['#cPiel', 'piel'], ['#cBase', 'base']]) {
  $(id).oninput = e => { state.colors[k] = e.target.value; rebuild(); };
  $(id).onchange = commit;
}
document.querySelectorAll('#poseRows input').forEach(el => {
  el.oninput = () => {
    const j = $('#jointSel').value, v = state.pose[j] ? [...state.pose[j]] : [0, 0, 0];
    v[+el.dataset.p] = +el.value; state.pose[j] = v; setPose(ch.joints, state.pose, state.limits); syncUI();
  };
  el.onchange = commit;
});
$('#poseA').onclick = () => { state.pose = clone(NEUTRAL); setPose(ch.joints, state.pose, state.limits); syncUI(); commit(); };
$('#poseT').onclick = () => { state.pose = clone(POSE_T); setPose(ch.joints, state.pose, state.limits); syncUI(); commit(); };
$('#jointReset').onclick = () => { delete state.pose[$('#jointSel').value]; setPose(ch.joints, state.pose, state.limits); syncUI(); commit(); };

// ---------- Texturas: panel común para partes del cuerpo y objetos ----------
const TEX_HTML = p => `<div class="row"><label>Textura</label><select id="${p}Tex">${TEXTURE_NAMES.map(t => `<option>${t}</option>`).join('')}</select></div>
  <div class="row"><label>Color</label><input type="color" id="${p}C1"><label>2º</label><input type="color" id="${p}C2"></div>
  <div class="row"><label>Escala</label><input type="range" id="${p}Sc" min="1" max="16" step="0.5"></div>
  <div class="row"><label>Rugos.</label><input type="range" id="${p}Ro" min="0" max="1" step="0.05"></div>
  <div class="row"><label>Metal</label><input type="range" id="${p}Me" min="0" max="1" step="0.05"></div>`;
const TEX_MAP = { Tex: ['tex', v => v], C1: ['color', v => v], C2: ['color2', v => v], Sc: ['scale', Number], Ro: ['roughness', Number], Me: ['metalness', Number] };
function bindTex(p, apply) {
  for (const [s, [k, f]] of Object.entries(TEX_MAP)) { const el = $('#' + p + s); el.oninput = () => apply({ [k]: f(el.value) }, false); el.onchange = () => apply({ [k]: f(el.value) }, true); }
}
function fillTex(p, d) {
  $('#' + p + 'Tex').value = d.tex || 'liso'; $('#' + p + 'C1').value = d.color; $('#' + p + 'C2').value = d.color2 || '#555555';
  $('#' + p + 'Sc').value = d.scale ?? 4; $('#' + p + 'Ro').value = d.roughness ?? .8; $('#' + p + 'Me').value = d.metalness ?? 0;
}
function hlPart() { if (ch) for (const [n, m] of Object.entries(ch.mats)) m.emissive.setHex(n === selPart ? 0x1b3d63 : 0); }
function selectPart(n) { selPart = n; if (n) { selected = null; tc.detach(); refreshProps(); } hlPart(); refreshPart(); }
function refreshPart() {
  $('#partHint').hidden = !!selPart; $('#partBox').hidden = !selPart; if (!selPart) return;
  $('#partName').textContent = `Parte: ${selPart} (lados L y R juntos)`; fillTex('p', resolvePart(selPart, state.colors, state.parts));
}
function applyPart(patch, rec) {
  if (!selPart) return; state.parts[selPart] = { ...(state.parts[selPart] || {}), ...patch };
  updatePart(ch, selPart, state.colors, state.parts); hlPart(); if (rec) commit();
}
function applyObj(patch, rec) {
  if (!selected) return; Object.assign(selected.mat, patch); setMainMaterial(selected.node, makeMaterial(selected.mat)); if (rec) commit();
}
$('#partBox').innerHTML = '<div class="hint" id="partName"></div>' + TEX_HTML('p') +
  '<div class="row"><button id="pAll">Aplicar a todo el cuerpo</button><button id="pReset">Restablecer</button></div>';
bindTex('p', applyPart);
$('#pAll').onclick = () => { if (!selPart) return; const d = resolvePart(selPart, state.colors, state.parts);
  for (const n of Object.keys(ch.mats)) { state.parts[n] = { ...d }; updatePart(ch, n, state.colors, state.parts); } hlPart(); commit(); };
$('#pReset').onclick = () => { if (!selPart) return; delete state.parts[selPart]; updatePart(ch, selPart, state.colors, state.parts); hlPart(); refreshPart(); commit(); };

// ---------- Panel: propiedades del objeto ----------
const props = $('#props');
function buildProps() {
  const rows = [['Pos', 'pos', .01], ['Rot', 'rot', 1], ['Esc', 'scl', .05]].map(([l, k, st]) =>
    `<div class="row"><label>${l}</label>${[0, 1, 2].map(i => `<input type="number" data-k="${k}" data-i="${i}" step="${st}">`).join('')}</div>`).join('');
  props.innerHTML = `<div class="row"><label>Socket</label><select id="oSock"></select></div>${rows}
    ${TEX_HTML('o')}<div class="row"><label><input type="checkbox" id="oVis"> visible</label></div>
    <div class="row"><button id="oDup">Duplicar</button><button id="oMir">Espejo</button><button id="oDel">Eliminar</button></div>`;
  props.querySelectorAll('input[type=number]').forEach(el => el.onchange = () => {
    if (!selected) return; const n = selected.node, i = +el.dataset.i, v = +el.value;
    if (el.dataset.k === 'pos') n.position.setComponent(i, v);
    else if (el.dataset.k === 'rot') { const r = [n.rotation.x, n.rotation.y, n.rotation.z]; r[i] = D.degToRad(v); n.rotation.set(...r); }
    else n.scale.setComponent(i, v);
    commit();
  });
  $('#oSock').onchange = e => { if (!selected) return; ch.sockets[e.target.value].add(selected.node); selected.socket = e.target.value; commit(); };
  bindTex('o', applyObj);
  $('#oVis').onchange = e => { if (selected) { selected.node.visible = e.target.checked; commit(); } };
  $('#oDel').onclick = () => { if (!selected) return; const o = selected; select(null); o.node.removeFromParent(); state.objects = state.objects.filter(x => x !== o); commit(); };
  $('#oDup').onclick = () => { if (selected) { select(copyObject(selected, selected.socket, [0, 0, 0], false)); commit(); } };
  $('#oMir').onclick = () => {
    if (!selected) return;
    const sk = /_[LR]$/.test(selected.socket) ? selected.socket.replace(/_([LR])$/, (_, s) => '_' + (s === 'L' ? 'R' : 'L')) : selected.socket;
    select(copyObject(selected, sk, null, true)); commit();
  };
}
function copyObject(src, socket, offset, mirror) {
  const o = addObject(src.type, socket, { mat: src.mat, mirrorOf: mirror ? src.id : null });
  const p = src.node.position, r = src.node.rotation;
  o.node.position.set(mirror ? -p.x : p.x + .03, p.y, p.z);
  o.node.rotation.set(r.x, mirror ? -r.y : r.y, mirror ? -r.z : r.z); o.node.scale.copy(src.node.scale);
  return o;
}
function refreshProps() {
  if (!selected) { if ($('#oSock')) props.innerHTML = '<p class="hint">Haz clic en un objeto del personaje.</p>'; return; }
  if (!$('#oSock')) { buildProps(); fill($('#oSock'), Object.keys(ch.sockets)); }
  const n = selected.node, vals = { pos: n.position.toArray(), rot: [n.rotation.x, n.rotation.y, n.rotation.z].map(D.radToDeg), scl: n.scale.toArray() };
  props.querySelectorAll('input[type=number]').forEach(el => { el.value = r4(vals[el.dataset.k][+el.dataset.i]); });
  $('#oSock').value = selected.socket; fillTex('o', selected.mat); $('#oVis').checked = selected.node.visible;
}

// ---------- Barra superior ----------
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#mode').onchange = e => tc.setMode(e.target.value);
function applySnap() { const on = $('#snap').checked; tc.setTranslationSnap(on ? .01 : null); tc.setRotationSnap(on ? D.degToRad(5) : null); tc.setScaleSnap(on ? .05 : null); }
$('#snap').onchange = applySnap; applySnap();
$('#markers').onchange = e => ch.root.traverse(n => { if (n.userData.marker) n.visible = e.target.checked; });
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#export').onclick = () => download('personaje.json', serialize());
$('#shot').onclick = () => {  // PNG con fondo transparente (se conserva la sombra)
  const bg = scene.background, helper = tc.getHelper(); grid.visible = helper.visible = false; scene.background = null;
  ch.root.traverse(n => { if (n.userData.marker) n.visible = false; });
  renderer.render(scene, camera);
  renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'personaje.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, 'image/png');
  scene.background = bg; grid.visible = helper.visible = true; ch.root.traverse(n => { if (n.userData.marker) n.visible = $('#markers').checked; });
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const j = JSON.parse(await f.text()); validate(j, ch.sockets); load(j, { onlyObjects: $('#onlyObj').checked, useNorm: $('#useNorm').checked }); }
  catch (err) { alert('No se pudo importar: ' + err.message); }
};
$('#reset').onclick = () => { if (confirm('¿Reiniciar personaje y objetos?')) { state.seg = clone(SEGMENT_DEFAULTS); state.colors = { ...DEFAULT_COLORS }; state.limits = {}; state.parts = {}; state.pose = clone(NEUTRAL); load({ objects: [] }, { onlyObjects: true }); } };
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.key !== 'Escape') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
  else if (k === 'delete' || k === 'backspace') $('#oDel')?.click();
  else if (k === 'escape') { select(null); selectPart(null); }
  else if ({ w: 'translate', e: 'rotate', r: 'scale' }[k]) { tc.setMode({ w: 'translate', e: 'rotate', r: 'scale' }[k]); $('#mode').value = tc.mode; }
});

// ---------- Inicio ----------
rebuild(); buildProps(); select(null); syncUI(); setView('persp'); commit();
