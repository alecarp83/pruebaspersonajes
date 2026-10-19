// Estado del editor de mapas: mapa abierto, selección, historial deshacer/rehacer y guardado en localStorage.
// Sin dependencias de three.js ni del DOM (solo `localStorage`), para poder probarlo aislado. Se comunica por eventos (mbus):
//   'map' -> el mapa se reemplazó (abrir, deshacer...): reconstruir todo   'added' / 'removed' / 'object' -> cambió un objeto
//   'props' -> cambiaron propiedades del mapa (nombre, tamaño, colores, niebla)   'select' -> cambió la selección
//   'list' -> cambió la lista de mapas guardados   'hist' -> cambió el historial   'error' -> algo no se pudo guardar
import { newMap, normalizeMap, cleanObject, cleanName, nextId, isHex, pack, MAX_OBJECTS, SIZE_MIN, SIZE_MAX } from '../../maps/mapdata.js';
import { TYPES, drawStats } from '../../maps/types.js';

export const STORE_KEY = 'editor3d:maps', CUR_KEY = 'editor3d:mapCur';   // el modo Jugar lee STORE_KEY para ofrecer estos mapas
export const mbus = { _h: {}, on(e, f) { (this._h[e] ||= []).push(f); }, emit(e, a) { (this._h[e] || []).forEach(f => f(a)); } };
export const ms = { key: null, map: null, sel: null, hist: [], hi: -1 };
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Almacenamiento ----------
const readStore = () => { try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; } catch { return {}; } };
const writeStore = st => { try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); return true; } catch { mbus.emit('error', 'No se pudo guardar el mapa en el navegador (almacenamiento lleno o bloqueado). Exporta el mapa para no perderlo.'); return false; } };
function persist() { const st = readStore(); st[ms.key] = ms.map; if (writeStore(st)) { try { localStorage.setItem(CUR_KEY, ms.key); } catch { /* sin almacenamiento */ } } }
export const listMaps = () => Object.entries(readStore()).map(([key, m]) => ({ key, name: m?.name || key }));
const newKey = st => { let n = 1; while (st['m' + n]) n++; return 'm' + n; };
const freeName = (st, base = 'map') => { const names = new Set(Object.values(st).map(m => m?.name)); let n = 1; while (names.has(base + n)) n++; return base + n; };

function setCurrent(key, map) {
  ms.key = key; ms.map = map; ms.sel = null; ms.hist = [JSON.stringify(map)]; ms.hi = 0;
  mbus.emit('map'); mbus.emit('select', null); mbus.emit('list'); mbus.emit('hist');
}
export function openMap(key) {
  const st = readStore(); if (!st[key]) return false;
  try { setCurrent(key, normalizeMap(st[key]).map); persist(); return true; } catch { return false; }
}
export function createMap(name, size) { const st = readStore(), key = newKey(st); setCurrent(key, newMap(name || freeName(st), size)); persist(); return key; }
export function duplicateMap() { const st = readStore(), copy = clone(ms.map); copy.name = cleanName('Copia de ' + ms.map.name); setCurrent(newKey(st), copy); persist(); }
export function deleteMap() {
  const st = readStore(); delete st[ms.key]; writeStore(st);
  const rest = Object.keys(st); if (!rest.length || !openMap(rest[0])) createMap();
}
// Importa un mapa leído de un archivo (formato editable o compacto). Devuelve los avisos de validación.
export function importMap(raw) {
  const { map, warnings } = normalizeMap(raw), st = readStore(); if (Object.values(st).some(m => m?.name === map.name)) map.name = cleanName(map.name + ' (importado)');
  setCurrent(newKey(st), map); persist(); return warnings;
}
// Abre el último mapa usado, el primero guardado o crea uno vacío (solo el suelo).
export function ensureMap() {
  const st = readStore(); let key; try { key = localStorage.getItem(CUR_KEY); } catch { key = null; }
  if (!key || !st[key]) key = Object.keys(st)[0];
  if (!key || !openMap(key)) createMap();
}

// ---------- Historial ----------
export function commit() {
  const s = JSON.stringify(ms.map); if (ms.hist[ms.hi] === s) return;
  ms.hist.length = ms.hi + 1; ms.hist.push(s); ms.hi++;
  if (ms.hist.length > 100) { ms.hist.shift(); ms.hi--; }
  persist(); mbus.emit('hist');
}
function go(i) {
  ms.hi = i; ms.map = normalizeMap(JSON.parse(ms.hist[i])).map;
  if (ms.sel && !ms.map.objects.some(o => o.id === ms.sel)) ms.sel = null;
  persist(); mbus.emit('map'); mbus.emit('select', ms.sel); mbus.emit('hist');
}
export const canUndo = () => ms.hi > 0, canRedo = () => ms.hi < ms.hist.length - 1;
export const undo = () => { if (canUndo()) go(ms.hi - 1); };
export const redo = () => { if (canRedo()) go(ms.hi + 1); };

// ---------- Objetos ----------
export const find = id => ms.map.objects.find(o => o.id === id);
export const selected = () => ms.sel ? find(ms.sel) || null : null;
export function select(id) { ms.sel = id && find(id) ? id : null; mbus.emit('select', ms.sel); }
const replace = (o, c) => { Object.keys(o).forEach(k => delete o[k]); Object.assign(o, c); };   // conserva la referencia al objeto

export function addObject(type, x, z, extra = {}) {
  const def = TYPES[type]; if (!def || def.single) return null;
  if (ms.map.objects.length >= MAX_OBJECTS) { mbus.emit('error', `Se alcanzó el máximo de ${MAX_OBJECTS} objetos.`); return null; }
  const o = cleanObject({ type, x, z, rot: 0, s: def.s, ...extra }, ms.map.size); o.id = nextId(ms.map.objects, type);
  ms.map.objects.push(o); mbus.emit('added', o); select(o.id); commit(); return o;
}
export function removeObject(id) {
  const o = find(id); if (!o || TYPES[o.type].single) return false;
  ms.map.objects = ms.map.objects.filter(x => x !== o); if (ms.sel === id) ms.sel = null;
  mbus.emit('removed', id); mbus.emit('select', ms.sel); commit(); return true;
}
export function duplicateObject(id) {
  const o = find(id); if (!o || TYPES[o.type].single) return null;
  return addObject(o.type, o.x + 1, o.z + 1, { rot: o.rot, s: [...o.s], col: o.col, col2: o.col2, f: o.f });
}
// patch: { x, z, rot, s, col, col2, f }; se valida y acota. record = false mientras se arrastra (el historial se guarda al soltar).
export function updateObject(id, patch, { record = true } = {}) {
  const o = find(id); if (!o) return null;
  const c = cleanObject({ ...o, ...patch }, ms.map.size); c.id = id; replace(o, c); mbus.emit('object', o);
  if (record) commit(); return o;
}

// ---------- Propiedades del mapa ----------
export function setMapProps(patch, { record = true } = {}) {
  const m = ms.map; let rebuild = false;
  if ('name' in patch) m.name = cleanName(patch.name);
  if ('size' in patch) {
    const size = clamp(Math.round(Number(patch.size) || m.size), SIZE_MIN, SIZE_MAX);
    if (size !== m.size) { m.size = size; for (const o of m.objects) { const c = cleanObject(o, size); c.id = o.id; replace(o, c); } rebuild = true; }   // los objetos que quedaban fuera se acercan al borde
  }
  if (isHex(patch.ground)) m.ground = patch.ground.toLowerCase();
  if (isHex(patch.sky)) m.sky = patch.sky.toLowerCase();
  if ('fog' in patch) { const f = patch.fog; m.fog = Array.isArray(f) && f[0] >= 0 && f[1] > f[0] ? [Math.round(f[0]), Math.round(f[1])] : null; }
  mbus.emit('props'); if (rebuild) mbus.emit('map');
  if (record) commit();
}
export const defaultFog = () => [Math.round(ms.map.size * .7), Math.round(ms.map.size * 1.8)];

// Resumen para el panel: objetos, llamadas de dibujo en el juego y peso de la exportación.
export function mapStats() {
  const st = drawStats(ms.map.objects.filter(o => o.type !== 'spawn'));
  return { ...st, bytes: JSON.stringify(pack(ms.map)).length };
}
