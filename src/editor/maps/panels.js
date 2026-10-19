// Paneles del modo "Crear mapa": biblioteca de objetos (izquierda) y propiedades del mapa / objeto seleccionado (derecha), más exportación.
import { TYPES, PLACEABLE } from '../../maps/types.js';
import { colorOf, color2Of, flowOf, readMapSource } from '../../maps/mapdata.js';
import { packageZip } from '../../maps/export.js';
import { downloadBlob } from '../../io/io.js';
import gameHtml from '../../../game.html?raw';        // plantillas del modo Jugar: la página exportada se genera a partir de ellas
import gameCss from '../../game/game.css?raw';
import { tag } from '../scene.js';
import { ms, mbus, listMaps, openMap, createMap, duplicateMap, deleteMap, importMap, setMapProps, defaultFog, commit, select, selected, addObject, removeObject, duplicateObject, updateObject, mapStats } from './state.js';
import { centerGround } from './view.js';
import { $ } from '../util.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r3 = v => Math.round(v * 1000) / 1000;
let toastT = 0;
export function toast(text, ms_ = 5000) { tag.textContent = text; tag.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { tag.style.display = 'none'; }, ms_); }
mbus.on('error', t => toast(t, 8000));

// ---------- Biblioteca ----------
{
  const box = $('#mapLib');
  box.innerHTML = '<h3>Objetos del mapa</h3><p class="hint">Arrastra al mapa, o toca para añadir en el centro de la vista.</p><div id="mapLibList"></div><div class="cat">Inicio</div><div class="item" id="mapGoSpawn">Punto de inicio</div>';
  const list = $('#mapLibList'); let cat = null;
  for (const t of PLACEABLE) {
    const d = TYPES[t]; if (d.cat !== cat) { cat = d.cat; const h = document.createElement('div'); h.className = 'cat'; h.textContent = cat; list.appendChild(h); }
    const el = document.createElement('div'); el.className = 'item'; el.draggable = true; el.textContent = d.label; el.title = d.hint;
    el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'map:' + t));
    el.addEventListener('click', () => { const p = centerGround(); addObject(t, p.x, p.z); });
    list.appendChild(el);
  }
  $('#mapGoSpawn').onclick = () => select('spawn');
}

// ---------- Panel derecho ----------
$('#mapSide').innerHTML = `
  <h3>Mapa</h3>
  <div class="row"><select id="mapPick"></select></div>
  <div class="row"><button id="mapNew">Nuevo</button><button id="mapDup">Duplicar</button><button id="mapDel">Eliminar</button><button id="mapImport">Importar</button></div>
  <div class="row"><label>Nombre</label><input type="text" id="mapName" maxlength="40"></div>
  <div class="row"><label>Tamaño</label><input type="number" id="mapSize" min="10" max="200" step="5"><output>m (lado)</output></div>
  <div class="row"><label>Suelo</label><input type="color" id="mapGround"><label>Cielo</label><input type="color" id="mapSky"></div>
  <div class="row"><label class="chk"><input type="checkbox" id="mapFog"> Niebla</label><input type="number" id="mapFogNear" min="0" step="1" title="Empieza a"><input type="number" id="mapFogFar" min="1" step="1" title="Opaca a"></div>
  <p class="hint" id="mapInfo"></p>
  <h3>Objeto seleccionado</h3>
  <div id="mapProps"></div>
  <input type="file" id="mapFile" accept=".js,.json" hidden>`;

const pick = $('#mapPick');
function refreshList() {
  if (!ms.key) return; pick.innerHTML = listMaps().map(m => `<option value="${esc(m.key)}">${esc(m.name)}</option>`).join(''); pick.value = ms.key;
  $('#mapPlay').href = 'game.html?editorMap=' + encodeURIComponent(ms.key);   // "Probar en Jugar" abre el mapa guardado
}
pick.onchange = () => openMap(pick.value);
$('#mapNew').onclick = () => { createMap(); $('#mapName').focus(); $('#mapName').select(); };
$('#mapDup').onclick = duplicateMap;
$('#mapDel').onclick = () => { if (confirm(`¿Eliminar el mapa "${ms.map.name}"? No se puede deshacer.`)) deleteMap(); };
$('#mapImport').onclick = () => $('#mapFile').click();
$('#mapFile').onchange = async e => {   // lee mapN.js (exportado) o un .json; no ejecuta código del archivo
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const w = importMap(readMapSource(await f.text())); toast(w.length ? 'Mapa importado con avisos: ' + w[0] : 'Mapa importado.'); } catch (err) { alert('No se pudo importar el mapa: ' + err.message); }
};

const F = { name: $('#mapName'), size: $('#mapSize'), ground: $('#mapGround'), sky: $('#mapSky'), fog: $('#mapFog'), near: $('#mapFogNear'), far: $('#mapFogFar') };
function syncMap() {
  const m = ms.map; if (!m) return;
  F.name.value = m.name; F.size.value = m.size; F.ground.value = m.ground; F.sky.value = m.sky;
  F.fog.checked = !!m.fog; F.near.value = m.fog ? m.fog[0] : ''; F.far.value = m.fog ? m.fog[1] : ''; F.near.disabled = F.far.disabled = !m.fog;
}
function syncInfo() {
  if (!ms.map) return; const s = mapStats();
  $('#mapInfo').textContent = `${s.objects} objeto(s) · ${s.draws} llamada(s) de dibujo en el juego (los estáticos van agrupados) · exporta ~${(s.bytes / 1024).toFixed(1)} KB`;
}
F.name.onchange = () => setMapProps({ name: F.name.value });
F.size.onchange = () => setMapProps({ size: F.size.value });
F.ground.oninput = () => setMapProps({ ground: F.ground.value }, { record: false }); F.ground.onchange = commit;
F.sky.oninput = () => setMapProps({ sky: F.sky.value }, { record: false }); F.sky.onchange = commit;
F.fog.onchange = () => setMapProps({ fog: F.fog.checked ? defaultFog() : null });
F.near.onchange = F.far.onchange = () => setMapProps({ fog: [Number(F.near.value), Number(F.far.value)] });

// ---------- Objeto seleccionado ----------
const props = $('#mapProps'); let shownId = null;
const row = (label, inner) => `<div class="row"><label>${label}</label>${inner}</div>`;
const num = (f, step = .1) => `<input type="number" data-f="${f}" step="${step}">`;
function renderProps() {
  const o = selected(); shownId = o ? o.id : null;
  if (!o) { props.innerHTML = '<p class="hint">Haz clic en un objeto del mapa para editarlo, o arrastra uno desde la lista.</p>'; return; }
  const d = TYPES[o.type]; let h = `<p class="hint"><b>${d.label}</b> · ${esc(d.hint)}</p>` + row('X', num('x')) + row('Z', num('z')) + row('Giro', num('rot', 5) + '<output>°</output>');
  if (d.uniform) { if (d.dims.length) h += row(d.dims[0], num('s', .05)); }
  else d.dims.forEach((lbl, i) => { if (lbl) h += row(lbl, num('s' + i, .1)); });
  if (o.type !== 'spawn') h += row('Color', `<input type="color" data-f="col">`);
  if (d.col2) h += row(d.col2Label || 'Color 2', `<input type="color" data-f="col2">`);
  if (d.flow) h += row('Corriente', `<input type="range" data-f="f" min="0" max="4" step="0.1"><output data-o="f"></output>`);
  if (o.type !== 'spawn') h += '<div class="row"><button data-act="dup">Duplicar</button><button data-act="del">Eliminar</button></div>';
  props.innerHTML = h;
  props.querySelectorAll('[data-f]').forEach(el => {
    const live = el.type === 'color' || el.type === 'range';
    if (live) el.oninput = () => apply(el, false);
    el.onchange = () => apply(el, true);
  });
  props.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const s = selected(); if (!s) return; b.dataset.act === 'dup' ? duplicateObject(s.id) : removeObject(s.id); });
  syncProps();
}
function syncProps() {
  const o = selected(); if (!o) return;
  props.querySelectorAll('[data-f]').forEach(el => {
    const f = el.dataset.f;
    el.value = f === 'x' || f === 'z' || f === 'rot' ? r3(o[f]) : f === 's' ? r3(o.s[0]) : /^s\d$/.test(f) ? r3(o.s[+f[1]]) : f === 'col' ? colorOf(o) : f === 'col2' ? color2Of(o) : r3(flowOf(o));
  });
  const out = props.querySelector('[data-o="f"]'); if (out) out.textContent = r3(flowOf(o)) + ' m/s';
}
function apply(el, record) {
  const o = selected(); if (!o) return; const f = el.dataset.f, patch = {};
  if (f === 'col' || f === 'col2') patch[f] = el.value;
  else { const v = Number(el.value); if (!Number.isFinite(v)) { syncProps(); return; }
    if (f === 's') patch.s = [v, v, v]; else if (/^s\d$/.test(f)) { const s = [...o.s]; s[+f[1]] = v; patch.s = s; } else patch[f] = v; }
  updateObject(o.id, patch, { record }); if (record) syncProps();
}

mbus.on('list', refreshList);
mbus.on('map', () => { refreshList(); syncMap(); syncInfo(); renderProps(); });
mbus.on('props', () => { syncMap(); });
mbus.on('hist', syncInfo);
mbus.on('select', () => { const o = selected(); if ((o ? o.id : null) !== shownId) renderProps(); else syncProps(); });
mbus.on('object', o => { if (o.id === shownId) syncProps(); });
mbus.on('added', syncInfo); mbus.on('removed', syncInfo);

// ---------- Exportar ----------
$('#mapExport').onclick = () => {
  try {
    const { id, zip } = packageZip(ms.map, { gameHtml, gameCss });
    downloadBlob(`${id}.zip`, new Blob([zip], { type: 'application/zip' }));
    toast(`Exportado ${id}.zip\nDescomprímelo dentro de public/ del proyecto: queda public/maps/${id}/ con ${id}.html, ${id}.css y ${id}.js.\nPara verlo en Jugar, añade "maps/${id}/${id}.js" a public/maps/index.json.`, 12000);
  } catch (err) { alert('No se pudo exportar el mapa: ' + err.message); }
};
