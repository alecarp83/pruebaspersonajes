// Panel de textura común a las partes del cuerpo y a los objetos (más el panel "Parte seleccionada").
import { TEXTURE_NAMES, makeMaterial } from '../../character/textures.js';
import { PART_NAMES, resolvePart, updatePart } from '../../character/character.js';
import { setMainMaterial } from '../../objects/library.js';
import { $ } from '../util.js';
import { state, ctx, bus, hlPart } from '../core.js';
import { commit } from '../history.js';

export const TEX_HTML = p => `<div class="row"><label>Textura</label><select id="${p}Tex">${TEXTURE_NAMES.map(t => `<option>${t}</option>`).join('')}</select></div>
  <div class="row"><label>Color</label><input type="color" id="${p}C1"><label>2º</label><input type="color" id="${p}C2"></div>
  <div class="row"><label>Escala</label><input type="range" id="${p}Sc" min="1" max="16" step="0.5"></div>
  <div class="row"><label>Rugos.</label><input type="range" id="${p}Ro" min="0" max="1" step="0.05"></div>
  <div class="row"><label>Metal</label><input type="range" id="${p}Me" min="0" max="1" step="0.05"></div>
  <div class="row"><label>Opac.</label><input type="range" id="${p}Op" min="0.1" max="1" step="0.05"></div>`;
const TEX_MAP = { Tex: ['tex', v => v], C1: ['color', v => v], C2: ['color2', v => v], Sc: ['scale', Number], Ro: ['roughness', Number], Me: ['metalness', Number], Op: ['opacity', Number] };

export function bindTex(p, apply) {
  for (const [s, [k, f]] of Object.entries(TEX_MAP)) { const el = $('#' + p + s); el.oninput = () => apply({ [k]: f(el.value) }, false); el.onchange = () => apply({ [k]: f(el.value) }, true); }
}
export function fillTex(p, d) {
  $('#' + p + 'Tex').value = d.tex || 'liso'; $('#' + p + 'C1').value = d.color; $('#' + p + 'C2').value = d.color2 || '#555555';
  $('#' + p + 'Sc').value = d.scale ?? 4; $('#' + p + 'Ro').value = d.roughness ?? .8; $('#' + p + 'Me').value = d.metalness ?? 0; $('#' + p + 'Op').value = d.opacity ?? 1;
}

// ----- objetos -----
export function applyObj(patch, rec) {
  const s = ctx.selected; if (!s) return;
  Object.assign(s.mat, patch); setMainMaterial(s.node, makeMaterial(s.mat)); if (rec) commit();
}

// ----- partes del cuerpo -----
function refreshPart() {
  $('#partHint').hidden = !!ctx.selPart; $('#partBox').hidden = !ctx.selPart; if (!ctx.selPart) return;
  $('#partName').textContent = `Parte: ${ctx.selPart} (lados L y R juntos)`; fillTex('p', resolvePart(ctx.selPart, state.colors, state.parts));
}
function applyPart(patch, rec) {
  const n = ctx.selPart; if (!n) return; state.parts[n] = { ...(state.parts[n] || {}), ...patch };
  updatePart(ctx.ch, n, state.colors, state.parts); hlPart(); if (rec) commit();
}
$('#partBox').innerHTML = '<div class="hint" id="partName"></div>' + TEX_HTML('p') +
  '<div class="row"><button id="pAll">Aplicar a todo el cuerpo</button><button id="pReset">Restablecer</button></div>';
bindTex('p', applyPart);
$('#pAll').onclick = () => { const n = ctx.selPart; if (!n) return; const d = resolvePart(n, state.colors, state.parts);
  for (const m of PART_NAMES) { state.parts[m] = { ...d }; updatePart(ctx.ch, m, state.colors, state.parts); } hlPart(); commit(); };
$('#pReset').onclick = () => { const n = ctx.selPart; if (!n) return; delete state.parts[n]; updatePart(ctx.ch, n, state.colors, state.parts); hlPart(); refreshPart(); commit(); };
bus.on('selection', refreshPart); bus.on('sync', refreshPart);
