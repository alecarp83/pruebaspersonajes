import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { SEGMENT_DEFAULTS, POSE_JOINTS, NEUTRAL, POSE_T, limitFor, buildCharacter, setPose, characterHeight } from './character/character.js';
import { LIBRARY, createObject } from './objects/library.js';
import { download, validate, SCHEMA_VERSION } from './io/io.js';

const $ = s => document.querySelector(s), D = THREE.MathUtils, r4 = v => Math.round(v * 1e4) / 1e4;
const clone = o => JSON.parse(JSON.stringify(o));
const DEFAULT_COLORS = { piel: '#d9b08c', base: '#4a6fa5' };

// ---------- Escena ----------
const view = $('#view'), tag = $('#tag');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio); view.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x20242b);
scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
scene.add(new THREE.GridHelper(6, 60, 0x666c78, 0x3a3f48));
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
const state = { seg: clone(SEGMENT_DEFAULTS), colors: { ...DEFAULT_COLORS }, limits: {}, pose: clone(NEUTRAL), objects: [] };
let ch = null, selected = null, idCounter = 1;

function rebuild() {
  tc.detach();
  state.objects.forEach(o => o.node.removeFromParent());
  if (ch) scene.remove(ch.root);
  ch = buildCharacter(state.seg, state.colors); scene.add(ch.root);
  setPose(ch.joints, state.pose, state.limits);
  state.objects.forEach(o => (ch.sockets[o.socket] || ch.sockets.pecho).add(o.node));
  ch.root.traverse(n => { if (n.userData.marker) n.visible = $('#markers').checked; });
  if (selected) tc.attach(selected.node);
}

function addObject(type, socket, opt = {}) {
  const node = createObject(type, opt.mat);
  const m = node.userData.mainMat;
  const o = { id: opt.id || 'obj_' + String(idCounter++).padStart(3, '0'), type, socket, node,
    mat: { color: '#' + m.color.getHexString(), metalness: m.metalness, roughness: m.roughness }, mirrorOf: opt.mirrorOf || null };
  const n = parseInt((o.id.match(/\d+$/) || [0])[0]); if (n >= idCounter) idCounter = n + 1;
  node.visible = opt.visible !== false;
  ch.sockets[socket].add(node); state.objects.push(o);
  return o;
}

const heightOf = () => +characterHeight(state.seg).toFixed(3);
function serialize() {
  return { schemaVersion: SCHEMA_VERSION,
    character: { name: 'personaje_01', units: 'm', height: heightOf(), segments: clone(state.seg), symmetric: true, colors: { ...state.colors }, joints: clone(state.limits) },
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
  select(null);
  if (!onlyObjects && j.character) {
    state.seg = { ...clone(SEGMENT_DEFAULTS), ...(j.character.segments || {}) };
    state.colors = { ...DEFAULT_COLORS, ...(j.character.colors || {}) };
    state.limits = j.character.joints || {};
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
function select(o) { selected = o; o ? tc.attach(o.node) : tc.detach(); refreshProps(); }

let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || tc.axis) return;
  setRay(e);
  const hit = ray.intersectObjects(state.objects.map(o => o.node), true)[0];
  let o = null;
  if (hit) { let n = hit.object; while (n && !(o = state.objects.find(x => x.node === n))) n = n.parent; }
  select(o || null);
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
  refreshProps();
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

// ---------- Panel: propiedades del objeto ----------
const props = $('#props');
function buildProps() {
  const rows = [['Pos', 'pos', .01], ['Rot', 'rot', 1], ['Esc', 'scl', .05]].map(([l, k, st]) =>
    `<div class="row"><label>${l}</label>${[0, 1, 2].map(i => `<input type="number" data-k="${k}" data-i="${i}" step="${st}">`).join('')}</div>`).join('');
  props.innerHTML = `<div class="row"><label>Socket</label><select id="oSock"></select></div>${rows}
    <div class="row"><label>Color</label><input type="color" id="oColor"><label><input type="checkbox" id="oVis"> visible</label></div>
    <div class="row"><button id="oDup">Duplicar</button><button id="oMir">Espejo</button><button id="oDel">Eliminar</button></div>`;
  props.querySelectorAll('input[type=number]').forEach(el => el.onchange = () => {
    if (!selected) return; const n = selected.node, i = +el.dataset.i, v = +el.value;
    if (el.dataset.k === 'pos') n.position.setComponent(i, v);
    else if (el.dataset.k === 'rot') { const r = [n.rotation.x, n.rotation.y, n.rotation.z]; r[i] = D.degToRad(v); n.rotation.set(...r); }
    else n.scale.setComponent(i, v);
    commit();
  });
  $('#oSock').onchange = e => { if (!selected) return; ch.sockets[e.target.value].add(selected.node); selected.socket = e.target.value; commit(); };
  $('#oColor').oninput = e => { if (selected) { selected.node.userData.mainMat.color.set(e.target.value); selected.mat.color = e.target.value; } };
  $('#oColor').onchange = commit;
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
  $('#oSock').value = selected.socket; $('#oColor').value = selected.mat.color; $('#oVis').checked = selected.node.visible;
}

// ---------- Barra superior ----------
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#mode').onchange = e => tc.setMode(e.target.value);
function applySnap() { const on = $('#snap').checked; tc.setTranslationSnap(on ? .01 : null); tc.setRotationSnap(on ? D.degToRad(5) : null); tc.setScaleSnap(on ? .05 : null); }
$('#snap').onchange = applySnap; applySnap();
$('#markers').onchange = e => ch.root.traverse(n => { if (n.userData.marker) n.visible = e.target.checked; });
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#export').onclick = () => download('personaje.json', serialize());
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const j = JSON.parse(await f.text()); validate(j, ch.sockets); load(j, { onlyObjects: $('#onlyObj').checked, useNorm: $('#useNorm').checked }); }
  catch (err) { alert('No se pudo importar: ' + err.message); }
};
$('#reset').onclick = () => { if (confirm('¿Reiniciar personaje y objetos?')) { state.seg = clone(SEGMENT_DEFAULTS); state.colors = { ...DEFAULT_COLORS }; state.limits = {}; state.pose = clone(NEUTRAL); load({ objects: [] }, { onlyObjects: true }); } };
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.key !== 'Escape') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
  else if (k === 'delete' || k === 'backspace') $('#oDel')?.click();
  else if (k === 'escape') select(null);
  else if ({ w: 'translate', e: 'rotate', r: 'scale' }[k]) { tc.setMode({ w: 'translate', e: 'rotate', r: 'scale' }[k]); $('#mode').value = tc.mode; }
});

// ---------- Inicio ----------
rebuild(); buildProps(); select(null); syncUI(); setView('persp'); commit();
