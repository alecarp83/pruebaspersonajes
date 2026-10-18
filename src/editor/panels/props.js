// Panel "Objeto seleccionado": transformación numérica, socket, textura, visibilidad, duplicar/espejo/eliminar.
import { $, D, r4, fill } from '../util.js';
import { ctx, bus, select, addObject, removeObject } from '../core.js';
import { commit } from '../history.js';
import { TEX_HTML, bindTex, fillTex, applyObj } from './texture.js';

const props = $('#props');

export function buildProps() {
  const rows = [['Pos', 'pos', .01], ['Rot', 'rot', 1], ['Esc', 'scl', .05]].map(([l, k, st]) =>
    `<div class="row"><label>${l}</label>${[0, 1, 2].map(i => `<input type="number" data-k="${k}" data-i="${i}" step="${st}">`).join('')}</div>`).join('');
  props.innerHTML = `<div class="row"><label>Socket</label><select id="oSock"></select></div>${rows}
    ${TEX_HTML('o')}<div class="row"><label><input type="checkbox" id="oVis"> visible</label></div>
    <div class="row"><button id="oDup">Duplicar</button><button id="oMir">Espejo</button><button id="oDel">Eliminar</button></div>`;
  props.querySelectorAll('input[type=number]').forEach(el => el.onchange = () => {
    const sel = ctx.selected; if (!sel) return; const n = sel.node, i = +el.dataset.i, v = +el.value;
    if (el.dataset.k === 'pos') n.position.setComponent(i, v);
    else if (el.dataset.k === 'rot') { const r = [n.rotation.x, n.rotation.y, n.rotation.z]; r[i] = D.degToRad(v); n.rotation.set(...r); }
    else n.scale.setComponent(i, v);
    commit();
  });
  $('#oSock').onchange = e => { const sel = ctx.selected; if (!sel) return; ctx.ch.sockets[e.target.value].add(sel.node); sel.socket = e.target.value; commit(); };
  bindTex('o', applyObj);
  $('#oVis').onchange = e => { if (ctx.selected) { ctx.selected.node.visible = e.target.checked; commit(); } };
  $('#oDel').onclick = () => { const o = ctx.selected; if (!o) return; select(null); removeObject(o); commit(); };
  $('#oDup').onclick = () => { if (ctx.selected) { select(copyObject(ctx.selected, ctx.selected.socket, false)); commit(); } };
  $('#oMir').onclick = () => {
    const s = ctx.selected; if (!s) return;
    const sk = /_[LR]$/.test(s.socket) ? s.socket.replace(/_([LR])$/, (_, x) => '_' + (x === 'L' ? 'R' : 'L')) : s.socket;
    select(copyObject(s, sk, true)); commit();
  };
}

function copyObject(src, socket, mirror) {
  const o = addObject(src.type, socket, { mat: src.mat, mirrorOf: mirror ? src.id : null });
  const p = src.node.position, r = src.node.rotation;
  o.node.position.set(mirror ? -p.x : p.x + .03, p.y, p.z);
  o.node.rotation.set(r.x, mirror ? -r.y : r.y, mirror ? -r.z : r.z); o.node.scale.copy(src.node.scale);
  return o;
}

function refreshProps() {
  const sel = ctx.selected;
  if (!sel) { if ($('#oSock')) props.innerHTML = '<p class="hint">Haz clic en un objeto del personaje.</p>'; return; }
  if (!$('#oSock')) { buildProps(); fill($('#oSock'), Object.keys(ctx.ch.sockets)); }
  const n = sel.node, vals = { pos: n.position.toArray(), rot: [n.rotation.x, n.rotation.y, n.rotation.z].map(D.radToDeg), scl: n.scale.toArray() };
  props.querySelectorAll('input[type=number]').forEach(el => { el.value = r4(vals[el.dataset.k][+el.dataset.i]); });
  $('#oSock').value = sel.socket; fillTex('o', sel.mat); $('#oVis').checked = sel.node.visible;
}
bus.on('selection', refreshProps); bus.on('props', refreshProps);
bus.on('sync', () => { const s = $('#oSock'); if (s) fill(s, Object.keys(ctx.ch.sockets)); refreshProps(); });
