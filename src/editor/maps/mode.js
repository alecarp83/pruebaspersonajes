// Modo "Crear mapa": alterna entre el editor de personaje y el editor de mapas (mismo lienzo, distintos paneles y herramientas).
import { ctx, bus, select as selectChar, selectPart } from '../core.js';
import { handles } from '../ik.js';
import { invalidate } from '../scene.js';
import { ensureMap, selected, select, removeObject, duplicateObject, updateObject } from './state.js';
import * as view from './view.js';
import './panels.js';
import { $ } from '../util.js';

const btn = $('#mapMode');
export function setMapMode(on) {
  if (on === (ctx.mode === 'map')) return;
  if (on) {
    selectChar(null); selectPart(null); Object.values(handles).forEach(h => { h.visible = false; });
    ctx.mode = 'map'; ensureMap(); ctx.ch.root.visible = false; view.show(true);
  } else {
    view.show(false); ctx.mode = 'char'; ctx.ch.root.visible = true; bus.emit('sync');   // 'sync' restaura los manejadores de IK y los paneles del personaje
  }
  document.body.classList.toggle('map', on); btn.textContent = on ? 'Volver al personaje' : 'Crear mapa'; invalidate();
}
btn.onclick = () => setMapMode(ctx.mode !== 'map');

// Atajos del modo mapa (W/E/R, deshacer y rehacer están en topbar.js)
addEventListener('keydown', e => {
  if (ctx.mode !== 'map') return;
  const t = e.target; if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|color|button)$/.test(t.type))) { if (e.key !== 'Escape') return; }
  const k = e.key.toLowerCase(), o = selected();
  if (k === 'escape') select(null);
  else if (!o) return;
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); removeObject(o.id); }
  else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicateObject(o.id); }
  else if (k.startsWith('arrow')) {   // mueve el objeto seleccionado (Mayús = 2 m)
    e.preventDefault(); const st = e.shiftKey ? 2 : .5;
    updateObject(o.id, { x: o.x + (k === 'arrowright' ? st : k === 'arrowleft' ? -st : 0), z: o.z + (k === 'arrowdown' ? st : k === 'arrowup' ? -st : 0) });
  }
});
