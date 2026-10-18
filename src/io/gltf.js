// Exportación a glTF binario (.glb). El exportador se carga bajo demanda para no engordar el arranque del editor.
// El resultado conserva la jerarquía: cada articulación es un nodo (cintura, hombro_L, codo_L...), los sockets son nodos vacíos
// (socket_mano_R...) y los objetos cuelgan de su socket, así que en otro motor siguen a la mano o a la espalda al animar.
export async function exportGLB(root) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  // userData.mainMat guarda un material: serializarlo incrustaría la textura en base64 dentro del archivo. Se retira durante la exportación.
  const saved = [];
  root.traverse(n => { if (n.userData.mainMat) { saved.push([n, n.userData.mainMat]); delete n.userData.mainMat; } });
  return new Promise((ok, fail) => {
    new GLTFExporter().parse(root, ok, e => fail(e instanceof Error ? e : new Error(String(e))), { binary: true, onlyVisible: true });
  }).finally(() => saved.forEach(([n, m]) => { n.userData.mainMat = m; }));
}
