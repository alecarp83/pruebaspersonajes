// Estado del editor, ciclo de vida del personaje, objetos, selección y (de)serialización.
// Los paneles y herramientas se comunican por un pequeño bus de eventos:
//   'sync'      -> el estado cambió: refrescar todos los paneles
//   'props'     -> cambió la transformación del objeto seleccionado
//   'selection' -> cambió la selección (objeto o parte del cuerpo)
//   'commit'    -> guardar una instantánea en el historial
import { SEGMENT_DEFAULTS, NEUTRAL, buildCharacter, setPose, characterHeight, disposeCharacter } from '../character/character.js';
import { LIBRARY, createObject, objDefaults, disposeObject } from '../objects/library.js';
import { validate, SCHEMA_VERSION } from '../io/io.js';
import { scene, tc, setView, invalidate } from './scene.js';
import { D, r4, clone } from './util.js';

export const bus = {
  _h: {},
  on(e, f) { (this._h[e] ||= []).push(f); },
  emit(e, a) { (this._h[e] || []).forEach(f => f(a)); },
};

export const DEFAULT_COLORS = { piel: '#d9b08c', base: '#4a6fa5' };
export const state = { seg: clone(SEGMENT_DEFAULTS), segR: {}, sym: true, colors: { ...DEFAULT_COLORS }, limits: {}, parts: {}, gear: {}, pose: clone(NEUTRAL), objects: [] };
export const ctx = { ch: null, selected: null, selPart: null, ikActive: null, markers: true };
let idCounter = 1;

export const heightOf = () => +characterHeight(state.seg, state.segR).toFixed(3);

export function setMarkers(on) {
  ctx.markers = on;
  ctx.ch?.root.traverse(n => { if (n.userData.marker) n.visible = on; });
  invalidate();
}

export function hlPart() {
  if (ctx.ch) for (const [n, m] of Object.entries(ctx.ch.mats)) m.emissive.setHex(n === ctx.selPart ? 0x1b3d63 : 0);
  invalidate();
}

export function rebuild() {
  tc.detach();
  state.objects.forEach(o => o.node.removeFromParent());   // se conservan: solo se sueltan del esqueleto viejo
  if (ctx.ch) { scene.remove(ctx.ch.root); disposeCharacter(ctx.ch); }
  ctx.ch = buildCharacter(state.seg, state.colors, state.parts, state.gear, state.segR); scene.add(ctx.ch.root);
  setPose(ctx.ch.joints, state.pose, state.limits);
  state.objects.forEach(o => (ctx.ch.sockets[o.socket] || ctx.ch.sockets.pecho).add(o.node));
  setMarkers(ctx.markers);
  if (ctx.selected) tc.attach(ctx.selected.node);
  hlPart();
}

export function addObject(type, socket, opt = {}) {
  const mat = { ...objDefaults(type), ...(opt.mat || {}) }, node = createObject(type, mat);
  const o = { id: opt.id || 'obj_' + String(idCounter++).padStart(3, '0'), type, socket, node, mat, mirrorOf: opt.mirrorOf || null };
  const n = parseInt((o.id.match(/\d+$/) || [0])[0]); if (n >= idCounter) idCounter = n + 1;
  node.visible = opt.visible !== false;
  ctx.ch.sockets[socket].add(node); state.objects.push(o);
  return o;
}

export function removeObject(o) {
  o.node.removeFromParent(); disposeObject(o.node);
  state.objects = state.objects.filter(x => x !== o);
}

export function serialize() {
  return { schemaVersion: SCHEMA_VERSION,
    character: { name: 'personaje_01', units: 'm', height: heightOf(), segments: clone(state.seg), ...(Object.keys(state.segR).length ? { segmentsR: clone(state.segR) } : {}), symmetric: state.sym, colors: { ...state.colors }, parts: clone(state.parts), gear: clone(state.gear), joints: clone(state.limits) },
    pose: { name: 'custom', rotations: clone(state.pose) },
    objects: state.objects.map(o => {
      const L = ctx.ch.refLen[o.socket], p = o.node.position.toArray(), r = o.node.rotation;
      return { id: o.id, type: o.type, socket: o.socket,
        transform: { position: p.map(r4), rotation: [r.x, r.y, r.z].map(a => r4(D.radToDeg(a))), scale: o.node.scale.toArray().map(r4) },
        normalized: { position: p.map(v => r4(v / L)), referenceLength: r4(L) },
        material: { ...o.mat }, visible: o.node.visible, mirrorOf: o.mirrorOf };
    }) };
}

// opciones: onlyObjects (conserva el personaje), useNorm (posiciones normalizadas), record (apunta al historial),
// keepView (no recoloca la cámara: deshacer/rehacer), warns (avisos ya calculados por validate)
export function load(j, { onlyObjects = false, useNorm = false, record = true, keepView = false, warns = null } = {}) {
  select(null); ctx.selPart = null;
  if (!onlyObjects && j.character) {
    state.seg = { ...clone(SEGMENT_DEFAULTS), ...(j.character.segments || {}) };
    state.colors = { ...DEFAULT_COLORS, ...(j.character.colors || {}) };
    state.segR = j.character.segmentsR ? clone(j.character.segmentsR) : {};
    state.sym = j.character.symmetric !== false && !Object.keys(state.segR).length;
    state.limits = j.character.joints || {};
    state.parts = j.character.parts ? clone(j.character.parts) : {};
    state.gear = j.character.gear ? clone(j.character.gear) : {};
    state.pose = j.pose?.rotations ? clone(j.pose.rotations) : clone(NEUTRAL);
  }
  state.objects.forEach(o => { o.node.removeFromParent(); disposeObject(o.node); }); state.objects = [];
  rebuild();
  const w = warns ?? validate(j, ctx.ch.sockets);
  for (const d of j.objects || []) {
    if (!LIBRARY[d.type] || !ctx.ch.sockets[d.socket]) continue;
    const o = addObject(d.type, d.socket, { id: d.id, mat: d.material, mirrorOf: d.mirrorOf, visible: d.visible });
    const t = d.transform, L = ctx.ch.refLen[d.socket];
    o.node.position.fromArray(useNorm && d.normalized ? d.normalized.position.map(v => v * L) : t.position);
    o.node.rotation.set(...t.rotation.map(D.degToRad));
    o.node.scale.fromArray(t.scale);
  }
  bus.emit('sync'); if (!keepView) setView('persp', heightOf()); invalidate();
  if (record) bus.emit('commit');
  if (w.length) alert('Avisos al cargar:\n' + w.join('\n'));
}

export function resetAll() {
  state.seg = clone(SEGMENT_DEFAULTS); state.segR = {}; state.sym = true; state.colors = { ...DEFAULT_COLORS }; state.limits = {}; state.parts = {}; state.gear = {}; state.pose = clone(NEUTRAL);
  load({ objects: [] }, { onlyObjects: true });
}

// ---------- Selección ----------
export function select(o) {
  ctx.ikActive = null; tc.setSpace('local'); ctx.selected = o; o ? tc.attach(o.node) : tc.detach();
  if (o) { ctx.selPart = null; hlPart(); }
  bus.emit('selection');
}
export function selectPart(n) {
  ctx.selPart = n; if (n) { ctx.selected = null; ctx.ikActive = null; tc.detach(); }
  hlPart(); bus.emit('selection');
}
