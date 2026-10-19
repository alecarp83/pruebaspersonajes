// Catálogo de objetos de mapa (datos puros, sin three.js). Lo comparten el editor, el juego, el mundo de colisiones y la exportación.
//
// Todos los objetos se colocan sobre el suelo (y = 0) y tienen: posición (x, z), giro (rot, grados sobre Y) y tamaño s = [sx, sy, sz].
//   · plataforma/pared: s = medidas en metros (ancho, alto, fondo)      · caja/pelota/muñeco: tamaño uniforme
//   · árbol/roca: escala sobre un modelo de tamaño natural              · montaña: s = [radio X, alto, radio Z]
//   · río: s = [ancho, —, largo]; la corriente fluye hacia +Z local (se orienta girando el río)
export const GROUND_COLOR = '#6aa84f', SKY_COLOR = '#9ec5e8';
export const FLOW_DEFAULT = 1.2, FLOW_MAX = 4;

export const TYPES = {
  platform: { label: 'Plataforma', cat: 'Estructuras', s: [4, .4, 4], col: '#9a8f80', dims: ['Ancho', 'Alto', 'Fondo'], min: [.2, .05, .2], max: [60, 20, 60], hint: 'Se puede subir si es baja; si es alta bloquea el paso.' },
  wall: { label: 'Pared', cat: 'Estructuras', s: [6, 2.5, .4], col: '#b8aea0', dims: ['Largo', 'Alto', 'Grosor'], min: [.2, .2, .1], max: [60, 20, 10], hint: 'Bloquea el paso.' },
  tree: { label: 'Árbol', cat: 'Naturaleza', s: [1, 1, 1], col: '#2f7a3a', dims: ['Ancho', 'Alto', 'Fondo'], min: [.3, .3, .3], max: [4, 4, 4], hint: 'Sólido: el tronco bloquea el paso.' },
  rock: { label: 'Roca', cat: 'Naturaleza', s: [1.2, .9, 1.1], col: '#8c8f94', dims: ['Ancho', 'Alto', 'Fondo'], min: [.2, .2, .2], max: [8, 8, 8], hint: 'Sólida: bloquea el paso.' },
  mountain: { label: 'Montaña', cat: 'Naturaleza', s: [8, 5, 8], col: '#7b8068', col2: '#f2f5f7', col2Label: 'Nieve', dims: ['Radio X', 'Alto', 'Radio Z'], min: [1, .5, 1], max: [60, 40, 60], hint: 'Se puede escalar si la pendiente no es muy fuerte.' },
  river: { label: 'Río', cat: 'Naturaleza', s: [3, 1, 14], col: '#3b86c6', dims: ['Ancho', '', 'Largo'], min: [.5, 1, .5], max: [40, 1, 200], flow: true, hint: 'Frena al personaje y arrastra cajas y pelotas hacia +Z (la flecha del gizmo).' },
  crate: { label: 'Caja', cat: 'Móviles', s: [.5, .5, .5], col: '#b98a4e', uniform: true, dims: ['Tamaño'], min: [.2, .2, .2], max: [1, 1, 1], hint: 'Se agarra, se apila y se lanza.' },
  ball: { label: 'Pelota', cat: 'Móviles', s: [.5, .5, .5], col: '#e04f4f', uniform: true, dims: ['Tamaño'], min: [.2, .2, .2], max: [1.2, 1.2, 1.2], hint: 'Rebota y rueda; se patea al caminar contra ella o al atacar.' },
  dummy: { label: 'Muñeco', cat: 'Móviles', s: [1, 1, 1], col: '#c9a46a', uniform: true, dims: ['Tamaño'], min: [.5, .5, .5], max: [2, 2, 2], hint: 'Blanco de práctica: reacciona a los golpes.' },
  spawn: { label: 'Punto de inicio', cat: '', s: [1, 1, 1], col: '#ffd54a', uniform: true, single: true, editorOnly: true, dims: [], min: [1, 1, 1], max: [1, 1, 1], hint: 'Dónde aparece el personaje (la flecha indica hacia dónde mira).' },
};
export const TYPE_NAMES = Object.keys(TYPES);
export const PLACEABLE = TYPE_NAMES.filter(t => !TYPES[t].single);
export const STATIC = ['platform', 'wall', 'tree', 'rock', 'mountain', 'river'];   // se dibujan agrupados (instancias GPU)
export const DYNAMIC = ['crate', 'ball', 'dummy'];                                  // se simulan: un objeto cada uno

// Piezas visuales de cada tipo. g = geometría unitaria, m = material, c = color ('col', 'col2' del objeto, o un #hex fijo),
// p = desplazamiento local. Editor y juego usan estas mismas definiciones, así que el mapa se ve igual en ambos.
export const PARTS = {
  platform: [{ g: 'box', m: 'std', c: 'col' }],
  wall: [{ g: 'box', m: 'std', c: 'col' }],
  tree: [{ g: 'trunk', m: 'std', c: '#6b4a2b' }, { g: 'canopy', m: 'std', c: 'col' }],
  rock: [{ g: 'rock', m: 'flat', c: 'col' }],
  mountain: [{ g: 'mountain', m: 'flat', c: 'col' }, { g: 'cap', m: 'flat', c: 'col2' }],
  river: [{ g: 'plane', m: 'water', c: 'col' }],
  crate: [{ g: 'cube', m: 'std', c: 'col', p: [0, .5, 0] }],
  ball: [{ g: 'sphere', m: 'ball', c: 'col', p: [0, .5, 0] }, { g: 'belt', m: 'std', c: '#1d1d22', p: [0, .5, 0] }],
  dummy: [{ g: 'dpost', m: 'std', c: 'col' }, { g: 'dhead', m: 'std', c: 'col' }, { g: 'darm', m: 'std', c: 'col' }],
  spawn: [{ g: 'spawnDisc', m: 'marker', c: 'col' }, { g: 'spawnArrow', m: 'marker', c: '#ffffff' }],
};

// Coste de dibujo estimado: los objetos estáticos del mismo tipo comparten una sola llamada de dibujo (instancias);
// los móviles (cajas, pelotas, muñecos) se dibujan uno a uno.
export function drawStats(objects) {
  const groups = new Set(); let instances = 0, dynamic = 0;
  for (const o of objects) {
    if (STATIC.includes(o.type)) { instances++; for (const p of PARTS[o.type]) groups.add(p.g + '|' + p.m); }
    else if (DYNAMIC.includes(o.type)) dynamic += PARTS[o.type].length;
  }
  return { objects: instances + objects.filter(o => DYNAMIC.includes(o.type)).length, draws: groups.size + dynamic, groups: groups.size, dynamic };
}
