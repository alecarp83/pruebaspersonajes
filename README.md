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
- 22 objetos procedurales (armas, escudo, arco, antorcha, mochila, carcaj, capa, bolsa, cantimplora, casco, corona, sombrero…) agrupados por zona. Arrastra al personaje (se resalta el socket más cercano) o toca el objeto para añadirlo al socket sugerido.
- Colocación precisa: gizmo (W/E/R), snap (1 cm, 5°, 0.05), campos numéricos, cambio de socket, color, duplicar, espejo L↔R, eliminar.
- Vistas: perspectiva, frontal, lateral y superior (cámara en perspectiva alineada al eje).
- Deshacer/rehacer (Ctrl+Z / Ctrl+Y; no mueven la cámara). El último estado se guarda en localStorage y **se restaura al abrir el editor**.
- El render es bajo demanda (solo dibuja cuando algo cambia) y se liberan geometrías, materiales y texturas al reconstruir.
- Exportar/importar JSON (completo, o "solo objetos" sobre otro personaje; con "posición normalizada" se escala por el largo del segmento).

## Exportar a GLB (glTF binario)
El botón **Exportar GLB** descarga `personaje.glb` con la pose actual, en metros, Y arriba y +Z hacia delante (la convención de glTF). Sirve para Blender, Godot, Unity, Three.js, Babylon, etc.
- La jerarquía se conserva: cada articulación es un nodo (`cintura`, `torso`, `hombro_L`, `codo_L`, `rodilla_R`…), las mallas se llaman `mesh_<parte>` y los sockets son nodos vacíos `socket_<nombre>`. Los objetos colgan de su socket (`obj_001_espada`), así que siguen a la mano o a la espalda cuando se anima.
- No es una malla con piel (skin): cada segmento es una malla rígida hija de su articulación. Para animar, se rotan los nodos de las articulaciones.
- No se exportan los sockets visibles, el resaltado de la parte seleccionada ni los objetos con "visible" desmarcado.
- Las texturas son PNG de 256×256 incrustados, con el repetido (`Escala`) como `KHR_texture_transform`. Si el motor de destino ignora esa extensión, la textura se verá una sola vez por malla.

## Pose simétrica y copia L ↔ R
En el panel **Pose**: con **Pose simétrica** activada, mover un eje de una articulación L (o R) mueve el mismo eje de la opuesta reflejado (X igual; Y y Z con signo cambiado), respetando los límites del lado destino y sin tocar sus otros ejes. También funciona al arrastrar las manos con IK y al reiniciar una articulación. **Copiar L → R** y **Copiar R → L** reflejan toda la pose de un lado sobre el otro. Cintura, cuello y cabeza no tienen par.

## Cambios en v1.2
- Los objetos ocultos ya no se pueden seleccionar con el clic.
- La caché de texturas es LRU (máx. 32): arrastrar colores ya no acumula memoria.
- Deshacer/rehacer también actualizan el estado guardado en localStorage.
- Los atajos (Ctrl+Z, Supr, W/E/R) funcionan con el foco en sliders y casillas; solo se bloquean al escribir texto.
- Editor y juego usan la misma pose base (`resolvePose`): si el JSON trae `pose.rotations` se respeta tal cual.

## Convenciones
Y arriba, Z hacia delante, metros. Lado L = +X, R = -X. Posición/rotación (grados, Euler XYZ) de cada objeto son **locales a su socket**.

## Estructura
- `src/character/` esqueleto (`character.js`), texturas, presets y `dispose.js` (liberación de recursos).
- `src/objects/library.js` biblioteca de objetos (con metadatos de ataque para el juego).
- `src/io/io.js` descarga y validación del JSON.
- `src/main.js` punto de entrada del editor; `src/editor/` contiene los módulos:
  - `scene.js` escena, cámara, controles y render bajo demanda (`invalidate()`).
  - `core.js` estado, personaje, objetos, selección, (de)serialización y un pequeño bus de eventos (`sync`, `props`, `selection`, `commit`).
  - `history.js` deshacer/rehacer y restauración desde localStorage.
  - `ik.js` cinemática inversa de manos · `interaction.js` clic, arrastre y gizmo · `topbar.js` barra superior y atajos.
  - `panels/` `library`, `body` (proporciones, asimetría, pose), `texture`, `props` (objeto seleccionado), `presets` (presets y equipo).
- `src/game/` modo juego.

Para añadir un panel nuevo: crea `src/editor/panels/mi_panel.js`, escucha `bus.on('sync', ...)` para refrescarse, llama a `commit()` tras cada cambio del usuario e impórtalo en `src/main.js`.

## Añadir un objeto
En `src/objects/library.js`, agrega una entrada a `LIBRARY` con `label`, `socket`, `color`, `metalness`, `roughness` y `build(materialPrincipal, materialAcento)` que devuelva un `THREE.Group` con +Y como eje largo. Opcionalmente `atk` (tipo de ataque en el juego: `slash`, `thrust`, `smash`, `bash`, `shoot`, `cast`) y `proj` (`flecha`, `bala`, `magia`) para armas a distancia.

## Esquema JSON (v2)
`schemaVersion`, `character` (`segments`, `segmentsR` opcional, `symmetric`, `colors`, `parts`, `gear`, `joints` opcionales, `height`), `pose.rotations`, `objects[]` (id, type, socket, transform{position,rotation,scale}, normalized{position,referenceLength}, material, visible, mirrorOf). Ver `example.json`.
- `segmentsR`: ajustes del **lado derecho** de `brazo`, `antebrazo`, `mano`, `muslo`, `pantorrilla` y `pie` cuando el personaje es asimétrico (`symmetric: false`). Si falta, el lado derecho copia al izquierdo.
- `parts`: estilo de textura por parte del cuerpo; `gear`: equipo activo; `joints`: límites de rotación personalizados `{ articulación: { min:[x,y,z], max:[x,y,z] } }`.
- Los archivos v1 siguen cargando sin cambios.

## Publicar en GitHub Pages
No se puede publicar el código fuente tal cual: `import 'three'` necesita compilarse con Vite.
1. Sube el proyecto (incluida la carpeta `.github/`) a la rama `main`.
2. En el repo: Settings → Pages → Source: **GitHub Actions**.
3. Cada push a `main` compila (`npm run build`) y publica `dist/`.

## Modo juego (`game.html`)
Mapa pequeño con plataformas, árboles y un muñeco de práctica. Carga `public/personaje.json` (puedes reemplazarlo por tu export o usar el botón "Cargar personaje").
- Joystick: mueve al personaje (animación de caminar proporcional a la inclinación).
- Saltar, Atacar y Agacharse (mantener): botones. Cerca de una caja aparece **Agarrar**; con la caja en brazos aparecen **Soltar** (abre las manos y la caja cae 1 m delante, sin agacharse) y **Lanzar** (3 m hacia donde mira).
- Las cajas (y cualquier objeto móvil) son **sólidos**: bloquean el paso del personaje (hay que saltar para subirse), son sólidas **entre sí**, se **apilan** (una caja soltada o lanzada sobre otra se alinea con ella) y chocan con árboles y muñeco.
- **Choques:** si una caja lanzada golpea a otra (o la golpea una que se desliza), ambas se desplazan; el impulso se reparte según la masa (crece con el tamaño al cubo; rebote 0,5) y las cajas golpeadas se deslizan hasta detenerse por rozamiento. El tamaño de cada caja es el campo `r` (medio lado) en `crates` de `src/game/game.js`, así que la física ya admite objetos de otros tamaños.
- Si retiras la caja de abajo (o la empujan fuera del borde), las de arriba caen. No se puede agarrar la caja sobre la que estás parado.
- **Soltar** y **Lanzar** también funcionan en pleno salto (agarrar solo desde el suelo).
- Teclado: WASD/flechas, Espacio (saltar), J (atacar), C o Shift (agacharse), E (agarrar/soltar), Q (lanzar).
- Las animaciones son procedurales sobre las mismas articulaciones y límites del editor; la pose del JSON es la pose base.
- **El ataque depende del arma que lleve el personaje en la mano** (campo `atk` de cada objeto de la biblioteca; se prefiere la mano derecha, y si el arma está en la izquierda la animación se espeja). Sin arma, golpea con el puño. El nombre del arma aparece en la barra superior.
  - Tajo (`slash`): espada, antorcha · Estocada (`thrust`): daga, lanza · Golpe cenital (`smash`): hacha, martillo, maza, bastón · Embestida (`bash`): escudo.
  - A distancia: disparo (`shoot`) con pistola y rifle (balas) o arco (flechas); hechizo (`cast`) con la varita (esfera de magia). Los proyectiles vuelan en línea recta y golpean al muñeco.
  - En `src/game/game.js`, `ATTACKS` define duración, instante de impacto, alcance, fuerza y fotogramas clave de cada tipo.

## Asimetría
En el panel **Cuerpo**, elige un segmento par (brazo, antebrazo, mano, muslo, pantorrilla o pie) y desmarca **Simétrico**: aparece el selector de lado (L/R) y cada lado se edita por separado. Volver a marcar *Simétrico* hace que el lado derecho copie al izquierdo. La pierna más larga fija la altura de la cintura. Los presets `mutante` (brazo derecho enorme) y `pirata` (pierna derecha muy delgada) usan esta función.

## Texturas, partes y calidad visual
- Haz clic en una parte del cuerpo para editar su textura (liso, piel, tela, rayas, cuadros, cuero, metal, madera, camuflaje), colores, escala, rugosidad y metal. Los lados L y R comparten estilo; "Aplicar a todo el cuerpo" copia el estilo.
- Los objetos tienen el mismo panel de textura. Todo se guarda en el JSON (`character.parts` y `material` de cada objeto), sin imágenes.
- Hay esferas en hombros, codos, muñecas, caderas, rodillas y tobillos para tapar los huecos al doblar.
- Iluminación de estudio con sombras reales y reflejos; "Captura PNG" exporta con fondo transparente. El modo juego usa las mismas texturas y sombras.

## Equipo, IK y presets
- **Equipo** (botas, guantes, hombreras, cinturón, rodilleras, mochila): casillas en el panel derecho. Son piezas rígidas dimensionadas según los segmentos del personaje, fijas a sus articulaciones (siguen la pose) y con el mismo panel de textura (clic sobre la pieza). Se guardan en `character.gear`.
- **IK manos**: activa "IK manos" en la barra superior. Aparecen una esfera verde (mano izquierda) y una roja (derecha); arrástralas y el hombro y el codo se ajustan respetando los límites. Los objetos en la mano acompañan el movimiento.
- **Presets**: humano, robot, chibi, corpulento, orco, zombie, fantasma, mutante, caballero, ninja, mago, esqueleto, gigante, duende y pirata. Cambian medidas, texturas, equipo y pose, y conservan los objetos ya colocados. Datos en `src/character/presets.js`.
