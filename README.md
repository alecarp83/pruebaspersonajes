# Editor de personaje 3D procedural (three.js + Vite)

## Uso
```
npm install
npm run dev
```
Abre la URL que muestra Vite (normalmente http://localhost:5173).

## Qué incluye
- Personaje 100% procedural con articulaciones: cintura, cuello, cabeza, hombro, codo, muñeca, cadera, rodilla y tobillo (pivotes con límites de rotación).
- Edición de proporciones por segmento (largo y ancho, simétrico) y de pose (sliders por articulación, Pose A / Pose T).
- 11 sockets: mano_L/R, espalda, cadera_L/R, pecho, cabeza, muslo_L/R, pie_L/R (puntos naranjas).
- 9 objetos procedurales. Arrastra al personaje (se resalta el socket más cercano) o toca el objeto para añadirlo al socket sugerido.
- Colocación precisa: gizmo (W/E/R), snap (1 cm, 5°, 0.05), campos numéricos, cambio de socket, color, duplicar, espejo L↔R, eliminar.
- Vistas: perspectiva, frontal, lateral y superior (cámara en perspectiva alineada al eje).
- Deshacer/rehacer (Ctrl+Z / Ctrl+Y), último estado guardado en localStorage.
- Exportar/importar JSON (completo, o "solo objetos" sobre otro personaje; con "posición normalizada" se escala por el largo del segmento).

## Convenciones
Y arriba, Z hacia delante, metros. Lado L = +X, R = -X. Posición/rotación (grados, Euler XYZ) de cada objeto son **locales a su socket**.

## Estructura
- `src/character/` esqueleto, límites, sockets, pose.
- `src/objects/library.js` biblioteca de objetos.
- `src/io/io.js` descarga y validación del JSON.
- `src/main.js` escena, editor, paneles e historial.

## Añadir un objeto
En `src/objects/library.js`, agrega una entrada a `LIBRARY` con `label`, `socket`, `color`, `metalness`, `roughness` y `build(materialPrincipal, materialAcento)` que devuelva un `THREE.Group` con +Y como eje largo.

## Esquema JSON (v1)
`schemaVersion`, `character` (segments, colors, joints opcionales, height), `pose.rotations`, `objects[]` (id, type, socket, transform{position,rotation,scale}, normalized{position,referenceLength}, material, visible, mirrorOf). Ver `example.json`.
