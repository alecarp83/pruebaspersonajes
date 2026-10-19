// Datos de mapa (puros, sin three.js): formato editable, formato compacto de exportación, validación y mapa por defecto.
//
// Formato editable (el que usa el editor y guarda en localStorage):
//   { v, name, size, ground, sky, fog: [cerca, lejos] | null,
//     objects: [{ id, type, x, z, rot, s: [sx, sy, sz], col?, col2?, f? }] }      (col/col2/f solo si difieren del valor por defecto del tipo)
// Formato compacto (el que se exporta en mapN.js): objetos agrupados por tipo, filas numéricas y paleta de colores
//   { v, name, size, ground, sky, fog, spawn: [x, z, rot], pal: [colores], o: { tipo: [[x, z, rot, ...medidas, ci?, ci2?, f?], ...] } }
import { TYPES, GROUND_COLOR, SKY_COLOR, FLOW_DEFAULT, FLOW_MAX } from './types.js';

export const MAP_VERSION = 1, MAX_OBJECTS = 3000, SIZE_MIN = 10, SIZE_MAX = 200, SIZE_DEFAULT = 40;

const r3 = v => { const r = Math.round(v * 1000) / 1000; return r === 0 ? 0 : r; };   // sin -0
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = c => typeof c === 'string' && HEX.test(c);
const hex = (c, d) => isHex(c) ? c.toLowerCase() : d;
export const normRot = r => { const x = ((r + 180) % 360 + 360) % 360 - 180; return x === -180 ? 180 : x; };

export const cleanName = n => String(n ?? '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 40) || 'mapa';
// Nombre de carpeta/archivo a partir del nombre del mapa: "Mi mapa 1" -> "mi-mapa-1"
export const slug = n => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'mapa';

export const colorOf = o => o.col || TYPES[o.type].col;
export const color2Of = o => o.col2 || TYPES[o.type].col2;
export const flowOf = o => o.f ?? FLOW_DEFAULT;

export function nextId(objects, type) {
  let n = 0; const re = new RegExp('^' + type + '_(\\d+)$');
  for (const o of objects) { const m = re.exec(o.id || ''); if (m) n = Math.max(n, +m[1]); }
  return `${type}_${n + 1}`;
}
export function spawnOf(size) { return { id: 'spawn', type: 'spawn', x: 0, z: r3(size / 2 - 4), rot: 180, s: [1, 1, 1] }; }
const defaultFog = size => [r3(size * .7), r3(size * 1.8)];

// Mapa nuevo: solo el suelo (y el punto de inicio).
export function newMap(name = 'map1', size = SIZE_DEFAULT) {
  return { v: MAP_VERSION, name: cleanName(name), size, ground: GROUND_COLOR, sky: SKY_COLOR, fog: defaultFog(size), objects: [spawnOf(size)] };
}

// Mapa de prueba por defecto del modo Jugar (el escenario que antes estaba fijo en el código).
export function arenaMap() {
  const objs = [];
  const add = (type, x, z, s, rot = 0, extra = {}) => objs.push({ id: nextId(objs, type), type, x, z, rot, s, ...extra });
  add('platform', 4, -3, [3, .5, 3]); add('platform', -5, 2, [2.5, .9, 2.5]); add('platform', -4.5, -4, [2, .4, 2]);
  for (const [x, z] of [[7, 4], [-8, -7], [8, -8], [-7, 7], [2, 8], [-1, -9]]) add('tree', x, z, [1, 1, 1]);
  add('dummy', 0, -5, [1, 1, 1]);
  for (const [x, z] of [[2.5, 2], [-2, 4], [5, -6], [-6, -1], [1, -2]]) add('crate', x, z, [.5, .5, .5]);
  objs.push({ id: 'spawn', type: 'spawn', x: 0, z: 4, rot: 180, s: [1, 1, 1] });
  return { v: MAP_VERSION, name: 'arena', size: 24, ground: GROUND_COLOR, sky: SKY_COLOR, fog: [18, 40], objects: objs };
}

const fogOf = f => (Array.isArray(f) && f.length === 2 && f.every(v => typeof v === 'number' && Number.isFinite(v)) && f[0] >= 0 && f[1] > f[0]) ? [r3(f[0]), r3(f[1])] : null;

// Valida y acota un objeto suelto (tipo conocido): posición dentro del mapa, giro normalizado, medidas dentro de los límites del tipo.
// Devuelve el objeto limpio SIN id (quien lo llama lo asigna); col/col2/f solo se guardan si difieren del valor por defecto.
export function cleanObject(d, size) {
  const def = TYPES[d.type], half = size / 2, sIn = Array.isArray(d.s) ? d.s : def.s;
  const s = def.uniform ? Array(3).fill(r3(clamp(num(sIn[0], def.s[0]), def.min[0], def.max[0]))) : [0, 1, 2].map(i => r3(clamp(num(sIn[i], def.s[i]), def.min[i], def.max[i])));
  const o = { id: d.id, type: d.type, x: r3(clamp(num(d.x, 0), -half, half)), z: r3(clamp(num(d.z, 0), -half, half)), rot: r3(normRot(num(d.rot, 0))), s };
  if (isHex(d.col) && d.col.toLowerCase() !== def.col) o.col = d.col.toLowerCase();
  if (def.col2 && isHex(d.col2) && d.col2.toLowerCase() !== def.col2) o.col2 = d.col2.toLowerCase();
  if (def.flow && typeof d.f === 'number' && Number.isFinite(d.f) && d.f !== FLOW_DEFAULT) o.f = r3(clamp(d.f, 0, FLOW_MAX));
  return o;
}

// Acepta formato editable o compacto y devuelve { map, warnings } con todo validado y acotado. Lanza error si no es un mapa.
export function normalizeMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('El archivo no es un mapa válido.');
  if (raw.v > MAP_VERSION) throw new Error(`Versión de mapa ${raw.v} no soportada (máx. ${MAP_VERSION}).`);
  if ((raw.o !== undefined && (typeof raw.o !== 'object' || raw.o === null || Array.isArray(raw.o))) || (raw.objects !== undefined && !Array.isArray(raw.objects))) throw new Error('El mapa está dañado (lista de objetos inválida).');
  const warnings = [], src = raw.o ? unpack(raw) : raw;
  const size = clamp(num(src.size, SIZE_DEFAULT), SIZE_MIN, SIZE_MAX), half = size / 2;
  const map = { v: MAP_VERSION, name: cleanName(src.name), size, ground: hex(src.ground, GROUND_COLOR), sky: hex(src.sky, SKY_COLOR), fog: src.fog === undefined ? defaultFog(size) : fogOf(src.fog), objects: [] };
  const seen = new Set(); let spawn = null, unknown = 0;
  for (const d of Array.isArray(src.objects) ? src.objects : []) {
    const def = d && TYPES[d.type];
    if (!def) { unknown++; continue; }
    if (map.objects.length >= MAX_OBJECTS) { warnings.push(`Se omitieron objetos: el máximo es ${MAX_OBJECTS}.`); break; }
    if (def.single && spawn) { warnings.push('Había más de un punto de inicio: se usa el primero.'); continue; }
    const o = cleanObject(d, size);
    let id = typeof d.id === 'string' && /^[a-z]+_\d+$|^spawn$/.test(d.id) ? d.id : '';
    if (!id || seen.has(id)) id = nextId(map.objects, d.type);
    seen.add(id); o.id = id;
    if (def.single) spawn = o;
    map.objects.push(o);
  }
  if (unknown) warnings.push(`${unknown} objeto(s) de tipo desconocido omitidos.`);
  if (!spawn) map.objects.push(spawnOf(size));
  return { map, warnings };
}

// ---------- Formato compacto ----------
export function pack(map) {
  const pal = [], pi = c => { let i = pal.indexOf(c); if (i < 0) { pal.push(c); i = pal.length - 1; } return i; };
  const o = {}; let spawn = [0, 0, 0];
  for (const ob of map.objects) {
    const def = TYPES[ob.type];
    if (ob.type === 'spawn') { spawn = [r3(ob.x), r3(ob.z), r3(ob.rot)]; continue; }
    const row = [r3(ob.x), r3(ob.z), r3(ob.rot), ...(def.uniform ? [r3(ob.s[0])] : ob.s.map(r3))];
    const ci = ob.col && ob.col !== def.col ? pi(ob.col) : -1;
    const ci2 = def.col2 && ob.col2 && ob.col2 !== def.col2 ? pi(ob.col2) : -1;
    const f = def.flow && ob.f != null && ob.f !== FLOW_DEFAULT ? r3(ob.f) : -1;
    const tail = [ci, ci2, f]; while (tail.length && tail[tail.length - 1] === -1) tail.pop();
    (o[ob.type] ||= []).push(tail.length ? [...row, ...tail] : row);
  }
  return { v: MAP_VERSION, name: map.name, size: map.size, ground: map.ground, sky: map.sky, fog: map.fog || 0, spawn, pal, o };
}

export function unpack(p) {
  const pal = Array.isArray(p.pal) ? p.pal : [], objects = [];
  for (const [type, rows] of Object.entries(p.o || {})) {
    const def = TYPES[type]; if (!def || !Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const nd = def.uniform ? 1 : 3, [x, z, rot] = row, dims = row.slice(3, 3 + nd), [ci = -1, ci2 = -1, f = -1] = row.slice(3 + nd);
      const ob = { type, x, z, rot, s: def.uniform ? [dims[0], dims[0], dims[0]] : dims };
      if (ci >= 0 && pal[ci]) ob.col = pal[ci];
      if (ci2 >= 0 && pal[ci2]) ob.col2 = pal[ci2];
      if (f >= 0) ob.f = f;
      objects.push(ob);
    }
  }
  if (Array.isArray(p.spawn)) objects.push({ id: 'spawn', type: 'spawn', x: p.spawn[0], z: p.spawn[1], rot: p.spawn[2], s: [1, 1, 1] });
  return { name: p.name, size: p.size, ground: p.ground, sky: p.sky, fog: p.fog || null, objects };
}

// Lee un mapa desde el texto de un archivo: el .js exportado (el literal va entre /*map*/ y /*endmap*/, sin ejecutar nada) o un .json.
export function readMapSource(text) {
  const a = text.indexOf('/*map*/');
  if (a >= 0) {
    const b = text.indexOf('/*endmap*/', a);
    if (b < 0) throw new Error('El archivo del mapa está incompleto.');
    return JSON.parse(text.slice(a + 7, b));
  }
  return JSON.parse(text);
}
