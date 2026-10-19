// Barra superior: vistas, modo del gizmo, opciones, deshacer/rehacer, exportar/importar, captura y atajos de teclado.
import { download, downloadBlob, validate } from '../io/io.js';
import { exportGLB } from '../io/gltf.js';
import { scene, camera, tc, grid, renderer, setView, invalidate } from './scene.js';
import { ctx, serialize, load, resetAll, select, selectPart, setMarkers, hlPart, heightOf } from './core.js';
import { undo as charUndo, redo as charRedo } from './history.js';
import { undo as mapUndo, redo as mapRedo } from './maps/state.js';
import { setMapView } from './maps/view.js';
import { $, D } from './util.js';

// Deshacer/rehacer y vistas actúan sobre el personaje o sobre el mapa según el modo activo
const undo = () => ctx.mode === 'map' ? mapUndo() : charUndo(), redo = () => ctx.mode === 'map' ? mapRedo() : charRedo();
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => ctx.mode === 'map' ? setMapView(b.dataset.view) : setView(b.dataset.view, heightOf()));
$('#mode').onchange = e => tc.setMode(e.target.value);
function applySnap() { const on = $('#snap').checked; tc.setTranslationSnap(on ? .01 : null); tc.setRotationSnap(on ? D.degToRad(5) : null); tc.setScaleSnap(on ? .05 : null); }
$('#snap').onchange = applySnap; applySnap();
$('#markers').onchange = e => setMarkers(e.target.checked);
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#export').onclick = () => download('personaje.json', serialize());

$('#glb').onclick = async () => {   // se exporta con la pose actual; sin sockets visibles ni resaltado de la parte seleccionada
  const btn = $('#glb'), part = ctx.selPart, markers = ctx.markers; btn.disabled = true;
  try {
    ctx.selPart = null; hlPart(); setMarkers(false);
    downloadBlob('personaje.glb', new Blob([await exportGLB(ctx.ch.root)], { type: 'model/gltf-binary' }));
  } catch (err) { alert('No se pudo exportar el GLB: ' + (err.message || err)); }
  finally { ctx.selPart = part; hlPart(); setMarkers(markers); btn.disabled = false; }
};

$('#shot').onclick = () => {  // PNG con fondo transparente (se conserva la sombra)
  const bg = scene.background, helper = tc.getHelper(); grid.visible = helper.visible = false; scene.background = null;
  ctx.ch.root.traverse(n => { if (n.userData.marker) n.visible = false; });
  renderer.render(scene, camera);
  renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'personaje.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, 'image/png');
  scene.background = bg; grid.visible = helper.visible = true; setMarkers(ctx.markers); invalidate();
};

$('#import').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), warns = validate(j, ctx.ch.sockets);   // lanza error antes de tocar el estado
    load(j, { onlyObjects: $('#onlyObj').checked, useNorm: $('#useNorm').checked, warns });
  } catch (err) { alert('No se pudo importar: ' + err.message); }
};
$('#reset').onclick = () => { if (confirm('¿Reiniciar personaje y objetos?')) resetAll(); };

addEventListener('keydown', e => {
  const t = e.target, typing = t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|color|button)$/.test(t.type));
  if (typing && e.key !== 'Escape') return;   // sliders, casillas y selectores de color no escriben texto: los atajos siguen activos
  const k = e.key.toLowerCase(), modes = { w: 'translate', e: 'rotate', r: 'scale' };
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
  else if (ctx.mode === 'map' && (k === 'delete' || k === 'backspace' || k === 'escape')) { /* en modo mapa los gestiona editor/maps/mode.js */ }
  else if (k === 'delete' || k === 'backspace') $('#oDel')?.click();
  else if (k === 'escape') { select(null); selectPart(null); }
  else if (modes[k]) { tc.setMode(modes[k]); $('#mode').value = tc.mode; }
});
