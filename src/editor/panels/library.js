// Panel izquierdo: biblioteca de objetos (arrastrar al personaje o tocar para añadir al socket sugerido).
import { LIBRARY } from '../../objects/library.js';
import { $ } from '../util.js';
import { select, addObject } from '../core.js';
import { commit } from '../history.js';

const CATS = [['Manos', s => s.startsWith('mano_')], ['Espalda', s => s === 'espalda'], ['Cadera', s => s.startsWith('cadera_')], ['Cabeza', s => s === 'cabeza']];
const list = $('#libList');
for (const [cat, test] of CATS) {
  const items = Object.entries(LIBRARY).filter(([, d]) => test(d.socket)); if (!items.length) continue;
  const h = document.createElement('div'); h.className = 'cat'; h.textContent = cat; list.appendChild(h);
  for (const [type, d] of items) {
    const el = document.createElement('div'); el.className = 'item'; el.draggable = true; el.textContent = d.label;
    el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', type));
    el.addEventListener('click', () => { select(addObject(type, d.socket)); commit(); });
    list.appendChild(el);
  }
}
