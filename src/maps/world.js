// Mundo de colisiones de un mapa (puro, sin three.js). Convierte los objetos del mapa en consultas rápidas para el juego:
//   groundAt(x, z)   altura del terreno: plataformas/paredes (cajas orientadas) y montañas (conos caminables)
//   circlesAt(x, z)  obstáculos redondos cercanos (árboles, rocas, muñecos), como { x, z, r }
//   riverAt(x, z)    { fx, fz } = velocidad de la corriente si hay un río en ese punto, o null
// Los objetos estáticos se registran en una rejilla uniforme: cada consulta mira solo los de su celda en vez de recorrerlos todos.
import { TYPES } from './types.js';

const CELL = 4, RAD = Math.PI / 180;

export function createWorld(map) {
  const size = map.size, half = size / 2, n = Math.max(1, Math.ceil(size / CELL));
  const cells = new Map();
  const ci = v => Math.min(n - 1, Math.max(0, Math.floor((v + half) / CELL)));
  const cellOf = (x, z) => cells.get(ci(x) * 1024 + ci(z));
  const put = (list, it, x0, x1, z0, z1) => {
    for (let ix = ci(x0); ix <= ci(x1); ix++) for (let iz = ci(z0); iz <= ci(z1); iz++) {
      const k = ix * 1024 + iz; let c = cells.get(k); if (!c) cells.set(k, c = { g: [], c: [], r: [] }); c[list].push(it);
    }
  };
  const world = { size, bound: half - .5, spawn: { x: 0, z: 0, rot: 0 }, crates: [], balls: [], dummies: [], count: { boxes: 0, cones: 0, circles: 0, rivers: 0 } };

  for (const o of map.objects) {
    const t = o.type, [sx, sy, sz] = o.s, a = o.rot * RAD, cos = Math.cos(a), sin = Math.sin(a), def = TYPES[t];
    if (t === 'spawn') world.spawn = { x: o.x, z: o.z, rot: a };
    else if (t === 'platform' || t === 'wall') {
      const it = { k: 0, x: o.x, z: o.z, hx: sx / 2, hz: sz / 2, h: sy, cos, sin }, R = Math.hypot(it.hx, it.hz);
      put('g', it, o.x - R, o.x + R, o.z - R, o.z + R); world.count.boxes++;
    } else if (t === 'mountain') {
      const it = { k: 1, x: o.x, z: o.z, rx: sx, rz: sz, h: sy, cos, sin }, R = Math.max(sx, sz);
      put('g', it, o.x - R, o.x + R, o.z - R, o.z + R); world.count.cones++;
    } else if (t === 'tree' || t === 'rock') {
      const it = { x: o.x, z: o.z, r: .5 * Math.max(sx, sz) }, m = it.r + .8;   // tronco/roca: radio ~ la mitad de su ancho
      put('c', it, o.x - m, o.x + m, o.z - m, o.z + m); world.count.circles++;
    } else if (t === 'dummy') {
      const it = { x: o.x, z: o.z, r: .4 * sx }, m = it.r + .8;
      put('c', it, o.x - m, o.x + m, o.z - m, o.z + m); world.count.circles++;
      world.dummies.push({ x: o.x, z: o.z, r: it.r, s: sx, col: o.col || def.col, obj: o });
    } else if (t === 'river') {
      const f = o.f ?? 1.2, it = { x: o.x, z: o.z, hx: sx / 2, hz: sz / 2, cos, sin, fx: sin * f, fz: cos * f }, R = Math.hypot(it.hx, it.hz);   // la corriente va hacia +Z local
      put('r', it, o.x - R, o.x + R, o.z - R, o.z + R); world.count.rivers++;
    } else if (t === 'crate') world.crates.push({ x: o.x, z: o.z, r: sx / 2, col: o.col || def.col });
    else if (t === 'ball') world.balls.push({ x: o.x, z: o.z, r: sx / 2, col: o.col || def.col });
  }

  // Punto en coordenadas locales de una caja/cono girado `rot` grados sobre Y (la inversa de la rotación de three.js)
  world.groundAt = (x, z) => {
    const c = cellOf(x, z); if (!c || !c.g.length) return 0;
    let h = 0;
    for (const it of c.g) {
      const dx = x - it.x, dz = z - it.z, lx = it.cos * dx - it.sin * dz, lz = it.sin * dx + it.cos * dz;
      if (it.k === 0) { if (Math.abs(lx) < it.hx && Math.abs(lz) < it.hz && it.h > h) h = it.h; }
      else { const d = Math.hypot(lx / it.rx, lz / it.rz); if (d < 1) { const v = it.h * (1 - d); if (v > h) h = v; } }
    }
    return h;
  };
  const EMPTY = [];
  world.circlesAt = (x, z) => { const c = cellOf(x, z); return c && c.c.length ? c.c : EMPTY; };
  world.riverAt = (x, z) => {
    const c = cellOf(x, z); if (!c || !c.r.length) return null;
    for (const it of c.r) { const dx = x - it.x, dz = z - it.z, lx = it.cos * dx - it.sin * dz, lz = it.sin * dx + it.cos * dz; if (Math.abs(lx) < it.hx && Math.abs(lz) < it.hz) return it; }
    return null;
  };
  return world;
}
