// Presets de personaje (conservan los objetos colocados) y equipo rígido.
import { SEGMENT_DEFAULTS, NEUTRAL, GEAR_NAMES } from '../../character/character.js';
import { PRESETS } from '../../character/presets.js';
import { $, fill, clone } from '../util.js';
import { state, bus, DEFAULT_COLORS, rebuild, select, selectPart, heightOf } from '../core.js';
import { setView } from '../scene.js';
import { commit } from '../history.js';

fill($('#presetSel'), Object.keys(PRESETS));
$('#presetBtn').onclick = () => {
  const p = PRESETS[$('#presetSel').value]; select(null); selectPart(null);
  state.seg = Object.fromEntries(Object.keys(SEGMENT_DEFAULTS).map(k => [k, { ...SEGMENT_DEFAULTS[k], ...(p.seg?.[k] || {}) }]));
  state.segR = Object.fromEntries(Object.entries(p.segR || {}).map(([k, v]) => [k, { ...state.seg[k], ...v }])); state.sym = !Object.keys(state.segR).length;
  state.colors = { ...DEFAULT_COLORS, ...(p.colors || {}) }; state.parts = clone(p.parts || {}); state.gear = clone(p.gear || {}); state.limits = {};
  state.pose = { ...clone(NEUTRAL), ...clone(p.pose || {}) };
  rebuild(); bus.emit('sync'); setView('persp', heightOf()); commit();
};

const GEAR_LABEL = { botas: 'Botas', guantes: 'Guantes', hombreras: 'Hombreras', cinturon: 'Cinturón', rodilleras: 'Rodilleras', mochila: 'Mochila (fija)' };
$('#gearBox').innerHTML = GEAR_NAMES.map(n => `<label class="chk"><input type="checkbox" data-g="${n}"> ${GEAR_LABEL[n]}</label>`).join('');
$('#gearBox').onchange = e => { const n = e.target.dataset.g; if (!n) return; if (e.target.checked) state.gear[n] = true; else delete state.gear[n]; rebuild(); commit(); };
bus.on('sync', () => document.querySelectorAll('#gearBox input').forEach(el => el.checked = !!state.gear[el.dataset.g]));
