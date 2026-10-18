// Cinemática inversa de manos (mínimos cuadrados amortiguados sobre hombro y codo).
import * as THREE from 'three';
import { limitFor, setPose } from '../character/character.js';
import { scene, tc, invalidate } from './scene.js';
import { state, ctx, bus, select, selectPart } from './core.js';
import { $, D } from './util.js';

export const handles = {};
for (const s of ['L', 'R']) {
  const h = new THREE.Mesh(new THREE.SphereGeometry(.045), new THREE.MeshBasicMaterial({ color: s === 'L' ? 0x35d07f : 0xff6b6b, depthTest: false }));
  h.renderOrder = 20; h.visible = false; h.userData.side = s; scene.add(h); handles[s] = h;
}
export const ikOn = () => $('#ik').checked;

export function syncIK() {
  ctx.ch.root.updateMatrixWorld(true);
  for (const s of ['L', 'R']) { const h = handles[s]; h.visible = ikOn(); if (h !== ctx.ikActive || !tc.dragging) ctx.ch.sockets['mano_' + s].getWorldPosition(h.position); }
  invalidate();
}
bus.on('sync', syncIK);

export function selectHandle(h) {
  select(null); selectPart(null); ctx.ikActive = h; tc.attach(h); tc.setSpace('world'); tc.setMode('translate'); $('#mode').value = 'translate';
}
$('#ik').onchange = () => { if (!ikOn() && ctx.ikActive) select(null); syncIK(); };

export function ikArm(side, target) {
  const ch = ctx.ch, hn = 'hombro_' + side, cn = 'codo_' + side, hand = ch.sockets['mano_' + side];
  const [hl, hh] = limitFor(hn, state.limits), [cl, cu] = limitFor(cn, state.limits), lo = [...hl, cl[0]], hi = [...hh, cu[0]];
  const c0 = state.pose[cn] || [0, 0, 0]; let q = [...(state.pose[hn] || [0, 0, 0]), c0[0]];
  const ev = qq => { state.pose[hn] = [qq[0], qq[1], qq[2]]; state.pose[cn] = [qq[3], c0[1], c0[2]];
    setPose(ch.joints, state.pose, state.limits); ch.root.updateMatrixWorld(true); return hand.getWorldPosition(new THREE.Vector3()); };
  const A = new THREE.Matrix3();
  for (let it = 0; it < 10; it++) {
    const p0 = ev(q), e = target.clone().sub(p0); if (e.length() < .003) break;
    const J = q.map((_, i) => { const qq = [...q]; qq[i] += 2; return ev(qq).sub(p0).multiplyScalar(.5); });  // columnas en m/grado
    const m = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m.push(J.reduce((s, col) => s + col.getComponent(r) * col.getComponent(c), 0) + (r === c ? 3e-4 : 0));
    A.set(...m).invert(); const y = e.applyMatrix3(A);
    q = q.map((v, i) => D.clamp(v + D.clamp(J[i].dot(y), -12, 12), lo[i], hi[i]));
  }
  ev(q.map(v => Math.round(v * 10) / 10));
}
