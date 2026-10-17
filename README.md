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

## Publicar en GitHub Pages
No se puede publicar el código fuente tal cual: `import 'three'` necesita compilarse con Vite.
1. Sube el proyecto (incluida la carpeta `.github/`) a la rama `main`.
2. En el repo: Settings → Pages → Source: **GitHub Actions**.
3. Cada push a `main` compila (`npm run build`) y publica `dist/`.

## Modo juego (`game.html`)
Mapa pequeño con plataformas, árboles y un muñeco de práctica. Carga `public/personaje.json` (puedes reemplazarlo por tu export o usar el botón "Cargar personaje").
- Joystick: mueve al personaje (animación de caminar proporcional a la inclinación).
- Saltar, Atacar y Agacharse (mantener): botones. Cerca de una caja aparece **Agarrar**; con la caja en brazos aparecen **Soltar** (1 m delante) y **Lanzar** (3 m hacia donde mira).
- Teclado: WASD/flechas, Espacio (saltar), J (atacar), C o Shift (agacharse), E (agarrar/soltar), Q (lanzar).
- Las animaciones son procedurales sobre las mismas articulaciones y límites del editor; la pose del JSON es la pose base.
- Atacar anima el brazo derecho (donde suele ir el arma); en `src/game/game.js` el arreglo `KF` define los fotogramas clave.

## Texturas, partes y calidad visual
- Haz clic en una parte del cuerpo para editar su textura (liso, piel, tela, rayas, cuadros, cuero, metal, madera, camuflaje), colores, escala, rugosidad y metal. Los lados L y R comparten estilo; "Aplicar a todo el cuerpo" copia el estilo.
- Los objetos tienen el mismo panel de textura. Todo se guarda en el JSON (`character.parts` y `material` de cada objeto), sin imágenes.
- Hay esferas en hombros, codos, muñecas, caderas, rodillas y tobillos para tapar los huecos al doblar.
- Iluminación de estudio con sombras reales y reflejos; "Captura PNG" exporta con fondo transparente. El modo juego usa las mismas texturas y sombras.

## Equipo, IK y presets
- **Equipo** (botas, guantes, hombreras, cinturón, rodilleras, mochila): casillas en el panel derecho. Son piezas rígidas dimensionadas según los segmentos del personaje, fijas a sus articulaciones (siguen la pose) y con el mismo panel de textura (clic sobre la pieza). Se guardan en `character.gear`.
- **IK manos**: activa "IK manos" en la barra superior. Aparecen una esfera verde (mano izquierda) y una roja (derecha); arrástralas y el hombro y el codo se ajustan respetando los límites. Los objetos en la mano acompañan el movimiento.
- **Presets**: humano, robot, chibi, corpulento, orco, zombie, fantasma y mutante. Cambian medidas, texturas, equipo y pose, y conservan los objetos ya colocados. Datos en `src/character/presets.js`.
