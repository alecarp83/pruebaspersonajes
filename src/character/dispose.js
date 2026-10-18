// Libera geometrías, materiales y texturas de un árbol de objetos three.js (evita fugas de memoria GPU).
export function disposeTree(root) {
  const geos = new Set(), mats = new Set();
  root.traverse(o => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m));
  });
  geos.forEach(g => g.dispose());
  mats.forEach(m => { m.map?.dispose(); m.dispose(); });
}
