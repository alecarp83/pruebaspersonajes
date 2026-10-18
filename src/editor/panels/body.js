// Panel derecho: proporciones por segmento, colores base y pose por articulación.
import { SEGMENT_DEFAULTS, POSE_JOINTS, NEUTRAL, POSE_T, PAIRED, limitFor, setPose, sideSeg } from '../../character/character.js';
import { $, fill, clone } from '../util.js';
import { state, ctx, bus, rebuild } from '../core.js';
import { commit } from '../history.js';

fill($('#segSel'), Object.keys(SEGMENT_DEFAULTS)); fill($('#jointSel'), POSE_JOINTS);
$('#poseRows').innerHTML = ['X', 'Y', 'Z'].map((a, i) =>
  `<div class="row"><label>${a}</label><input type="range" data-p="${i}" step="1"><o></o></div>`).join('');

// Asimetría: con "Simétrico" desactivado, los segmentos pares se editan por lado (L/R).
const side = () => (!state.sym && $('#sideSel').value === 'R') ? 'R' : 'L';
function sync() {
  const n = $('#segSel').value, paired = PAIRED.includes(n);
  $('#symRow').hidden = !paired; $('#sideSel').hidden = !paired || state.sym; $('#sym').checked = state.sym;
  const s = sideSeg(state.seg, state.segR, side(), n);
  $('#segLen').value = s.length; $('#segWid').value = s.width;
  $('#segLenV').textContent = s.length.toFixed(3); $('#segWidV').textContent = s.width.toFixed(3);
  $('#cPiel').value = state.colors.piel; $('#cBase').value = state.colors.base;
  const j = $('#jointSel').value, [mn, mx] = limitFor(j, state.limits), v = state.pose[j] || [0, 0, 0];
  document.querySelectorAll('#poseRows input').forEach((el, i) => {
    el.min = mn[i]; el.max = mx[i]; el.disabled = mn[i] === mx[i]; el.value = v[i]; el.nextElementSibling.textContent = Math.round(v[i]) + '°';
  });
}
function setSeg(k, v) {
  const n = $('#segSel').value;
  if (PAIRED.includes(n) && side() === 'R') state.segR[n] = { ...sideSeg(state.seg, state.segR, 'R', n), [k]: v };
  else state.seg[n][k] = v;
}
bus.on('sync', sync);
$('#segSel').onchange = $('#jointSel').onchange = $('#sideSel').onchange = () => bus.emit('sync');
$('#sym').onchange = e => {
  state.sym = e.target.checked;
  if (state.sym) { state.segR = {}; rebuild(); }   // volver a simétrico: el lado derecho copia al izquierdo
  bus.emit('sync'); commit();
};

for (const [id, k] of [['#segLen', 'length'], ['#segWid', 'width']]) {
  $(id).oninput = e => { setSeg(k, +e.target.value); rebuild(); bus.emit('sync'); };
  $(id).onchange = commit;
}
for (const [id, k] of [['#cPiel', 'piel'], ['#cBase', 'base']]) {
  $(id).oninput = e => { state.colors[k] = e.target.value; rebuild(); };
  $(id).onchange = commit;
}

const applyPose = () => { setPose(ctx.ch.joints, state.pose, state.limits); bus.emit('sync'); };
document.querySelectorAll('#poseRows input').forEach(el => {
  el.oninput = () => {
    const j = $('#jointSel').value, v = state.pose[j] ? [...state.pose[j]] : [0, 0, 0];
    v[+el.dataset.p] = +el.value; state.pose[j] = v; applyPose();
  };
  el.onchange = commit;
});
$('#poseA').onclick = () => { state.pose = clone(NEUTRAL); applyPose(); commit(); };
$('#poseT').onclick = () => { state.pose = clone(POSE_T); applyPose(); commit(); };
$('#jointReset').onclick = () => { delete state.pose[$('#jointSel').value]; applyPose(); commit(); };
