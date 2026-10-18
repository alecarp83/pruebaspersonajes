import * as THREE from 'three';
export const $ = s => document.querySelector(s);
export const D = THREE.MathUtils;
export const r4 = v => Math.round(v * 1e4) / 1e4;
export const clone = o => JSON.parse(JSON.stringify(o));
export const fill = (sel, items) => { sel.innerHTML = items.map(i => `<option>${i}</option>`).join(''); };
