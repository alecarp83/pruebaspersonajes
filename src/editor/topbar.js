// Barra superior: vistas, modo del gizmo, opciones, deshacer/rehacer, exportar/importar, captura y atajos de teclado.
import { download, validate } from '../io/io.js';
import { scene, camera, tc, grid, renderer, setView, invalidate } from './scene.js';
import { ctx, serialize, load, resetAll, select, selectPart, setMarkers, heightOf } from './core.js';
import { undo, redo } from './history.js';
import { $, D } from './util.js';

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view, heightOf()));
$('#mode').onchange = e => tc.setMode(e.target.value);
function applySnap() { const on = $('#snap').checked; tc.setTranslationSnap(on ? .01 : null); tc.setRotationSnap(on ? D.degToRad(5) : null); tc.setScaleSnap(on ? .05 : null); }
$('#snap').onchange = applySnap; applySnap();
$('#markers').onchange = e => setMarkers(e.target.checked);
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#export').onclick = () => download('personaje.json', serialize());

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
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.key !== 'Escape') return;
  const k = e.key.toLowerCase(), modes = { w: 'translate', e: 'rotate', r: 'scale' };
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
  else if (k === 'delete' || k === 'backspace') $('#oDel')?.click();
  else if (k === 'escape') { select(null); selectPart(null); }
  else if (modes[k]) { tc.setMode(modes[k]); $('#mode').value = tc.mode; }
});
