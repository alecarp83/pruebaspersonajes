// Editor de personaje 3D: punto de entrada. Cada módulo registra sus propios eventos al importarse.
//   editor/scene.js        escena, cámara, render bajo demanda
//   editor/core.js         estado, personaje, objetos, selección, (de)serialización y bus de eventos
//   editor/history.js      deshacer/rehacer y último estado en localStorage
//   editor/ik.js           IK de manos
//   editor/interaction.js  clic, arrastre, gizmo
//   editor/topbar.js       barra superior y atajos
//   editor/panels/*.js     paneles laterales
//   editor/maps/*.js       modo "Crear mapa" (state: datos e historial · view: escena 3D · panels: interfaz · mode: activación)
import { resetAll } from './editor/core.js';
import { restoreLast } from './editor/history.js';
import './editor/interaction.js';
import './editor/topbar.js';
import './editor/panels/library.js';
import './editor/panels/body.js';
import './editor/panels/texture.js';
import './editor/panels/presets.js';
import { buildProps } from './editor/panels/props.js';
import './editor/maps/mode.js';   // modo "Crear mapa" (se importa después de topbar.js: sus atajos y el imán del gizmo deben ir detrás)

buildProps();
if (!restoreLast()) resetAll();   // restaura el último estado guardado; si no hay (o está dañado), parte de cero
