// Vista 3D del editor de mapas: dibuja los objetos (uno a uno, para poder seleccionarlos), el suelo, la selección, el gizmo y la cámara.
// Comparte escena, cámara, controles y gizmo con el editor de personaje (editor/scene.js); solo está activo en modo mapa.
import * as THREE from 'three';
import { scene, camera, orbit, tc, renderer, view, invalidate, sun, floor, grid as charGrid } from '../scene.js';
import { createNode, applyTransform, recolor, disposeNode, makeGround, setEmissive } from '../../maps/visual.js';
import { TYPES } from '../../maps/types.js';
import { ms, mbus, selected, select, updateObject, commit, addObject } from './state.js';
import { $, D } from '../util.js';

const root = new THREE.Group(); root.visible = false; scene.add(root);
const nodes = new Map();   // id -> Group
let ground = null, active = false, saved = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt = new THREE.Vector3();
export const isActive = () => active;

// ---------- Construcción ----------
function addNode(o) { const n = createNode(o); nodes.set(o.id, n); root.add(n); }
function dropNode(id) { const n = nodes.get(id); if (n) { root.remove(n); disposeNode(n); nodes.delete(id); } }
function buildGround() {
  if (ground) { root.remove(ground.group); ground.dispose(); }
  ground = makeGround(ms.map); root.add(ground.group);
}
function applyEnv() {   // cielo, niebla y luz según el mapa
  const m = ms.map, h = m.size, c = sun.shadow.camera;
  scene.background = new THREE.Color(m.sky); scene.fog = m.fog ? new THREE.Fog(m.sky, m.fog[0], m.fog[1]) : null;
  sun.position.set(h * .35, h * .7, h * .3); Object.assign(c, { left: -h * .75, right: h * .75, top: h * .75, bottom: -h * .75, near: 1, far: h * 2 }); c.updateProjectionMatrix();
  camera.far = Math.max(200, h * 6); camera.updateProjectionMatrix();
}
function rebuild() {
  tc.detach(); for (const id of [...nodes.keys()]) dropNode(id);
  buildGround(); for (const o of ms.map.objects) addNode(o);
  applyEnv(); highlight(); attach(); invalidate();
}
function highlight() { for (const [id, n] of nodes) setEmissive(n, id === ms.sel ? 0x2a4d7a : TYPES[n.userData.type].editorOnly ? 0x333333 : 0); }
function attach() { const o = selected(); if (!active || !o || !nodes.get(o.id)) { tc.detach(); return; } tc.attach(nodes.get(o.id)); configureGizmo(); }

mbus.on('map', () => { if (active) rebuild(); });
mbus.on('props', () => { if (active) { buildGround(); applyEnv(); invalidate(); } });
mbus.on('added', o => { if (active) { addNode(o); invalidate(); } });
mbus.on('removed', id => { if (active) { dropNode(id); invalidate(); } });
mbus.on('object', o => { const n = nodes.get(o.id); if (active && n) { applyTransform(n, o); recolor(n, o); invalidate(); } });
mbus.on('select', () => { if (active) { highlight(); attach(); invalidate(); } });

// ---------- Gizmo ----------
// Mover: solo en el suelo (X/Z). Rotar: solo sobre Y. Escalar: ejes locales. Los objetos siempre se apoyan en el suelo.
export function configureGizmo() {
  tc.showX = tc.showY = tc.showZ = true;
  if (tc.mode === 'translate') { tc.setSpace('world'); tc.showY = false; }
  else if (tc.mode === 'rotate') { tc.setSpace('world'); tc.showX = false; tc.showZ = false; }
  else tc.setSpace('local');
  invalidate();
}
tc.addEventListener('mode-changed', () => { if (active) configureGizmo(); });
$('#mode').addEventListener('change', () => { if (active) setTimeout(configureGizmo); });   // salvaguarda: por si el gizmo cambia de herramienta sin avisar
addEventListener('keydown', e => { if (active && 'wer'.includes(e.key.toLowerCase())) setTimeout(configureGizmo); });
tc.addEventListener('objectChange', () => {
  const o = selected(), n = o && nodes.get(o.id); if (!active || !n) return;
  const q = n.quaternion, yaw = 2 * Math.atan2(q.y, q.w) * 180 / Math.PI;   // giro sobre Y (correcto también pasados 90°, donde los ángulos de Euler se invierten)
  let s = [n.scale.x, n.scale.y, n.scale.z];
  if (TYPES[o.type].uniform) { const k = s.find((v, i) => Math.abs(v - o.s[i]) > 1e-4); if (k !== undefined) s = [k, k, k]; }   // caja/pelota/muñeco: escala uniforme
  updateObject(o.id, { x: n.position.x, z: n.position.z, rot: yaw, s }, { record: false });   // el historial se guarda al soltar
});
tc.addEventListener('dragging-changed', e => { if (active && !e.value) commit(); });

// ---------- Selección y colocación con el ratón ----------
const setRay = e => { const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
const snap = v => $('#snap').checked ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100;
function groundPoint(e) { if (e) setRay(e); else { ndc.set(0, 0); ray.setFromCamera(ndc, camera); } return ray.ray.intersectPlane(plane, pt) ? { x: snap(pt.x), z: snap(pt.z) } : { x: 0, z: 0 }; }
// Punto del suelo bajo el centro de la pantalla (para añadir objetos tocando la biblioteca)
export const centerGround = () => groundPoint(null);

let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!active || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || tc.axis) return;   // un arrastre (cámara) o el gizmo no seleccionan
  setRay(e); const h = ray.intersectObjects([...nodes.values()], true)[0]; let id = null;
  if (h) for (let n = h.object; n; n = n.parent) if (n.userData.mapId) { id = n.userData.mapId; break; }
  select(id);
});
view.addEventListener('dragover', e => { if (active) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
view.addEventListener('drop', e => {
  if (!active) return; const t = e.dataTransfer.getData('text/plain'); if (!t.startsWith('map:')) return;
  e.preventDefault(); const p = groundPoint(e); addObject(t.slice(4), p.x, p.z);
});

// ---------- Cámara ----------
export function setMapView(v) {
  const d = Math.max(12, ms.map.size * .9), p = { persp: [d * .6, d * .7, d * .8], front: [0, d * .35, d], side: [d, d * .35, 0], top: [0, d * 1.3, .001] }[v];
  camera.position.set(...p); orbit.target.set(0, 0, 0); orbit.update(); invalidate();
}

// ---------- Imán (snap) ----------
export function applyMapSnap() { const on = $('#snap').checked; tc.setTranslationSnap(on ? .5 : null); tc.setRotationSnap(on ? D.degToRad(15) : null); tc.setScaleSnap(on ? .1 : null); }
const restoreCharSnap = () => { const on = $('#snap').checked; tc.setTranslationSnap(on ? .01 : null); tc.setRotationSnap(on ? D.degToRad(5) : null); tc.setScaleSnap(on ? .05 : null); };
$('#snap').addEventListener('change', () => { if (active) applyMapSnap(); });   // se registra después del de la barra superior, así que prevalece

// ---------- Entrar / salir del modo mapa ----------
export function show(on) {
  const c = sun.shadow.camera;
  if (on) {
    saved = { bg: scene.background, fog: scene.fog, far: camera.far, polar: orbit.maxPolarAngle, pos: sun.position.clone(), cam: { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far } };
    active = true; root.visible = true; floor.visible = false; charGrid.visible = false; orbit.maxPolarAngle = Math.PI / 2 - .02;
    applyMapSnap(); rebuild(); setMapView('persp');
  } else {
    active = false; root.visible = false; tc.detach(); tc.setSpace('local'); tc.showX = tc.showY = tc.showZ = true;
    scene.background = saved.bg; scene.fog = saved.fog; camera.far = saved.far; camera.updateProjectionMatrix(); orbit.maxPolarAngle = saved.polar;
    sun.position.copy(saved.pos); Object.assign(c, saved.cam); c.updateProjectionMatrix(); floor.visible = true; charGrid.visible = true; restoreCharSnap();
  }
  invalidate();
}
