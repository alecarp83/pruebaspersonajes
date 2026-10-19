// Interacción con el lienzo: selección por clic, arrastrar objetos desde la biblioteca, gizmo e IK.
import { LIBRARY } from '../objects/library.js';
import * as THREE from 'three';
import { renderer, camera, orbit, tc, view, tag } from './scene.js';
import { state, ctx, bus, select, selectPart, addObject } from './core.js';
import { commit } from './history.js';
import { handles, ikOn, selectHandle, ikArm } from './ik.js';
import { setPose } from '../character/character.js';
import { symPoseOn, mirrorJoint } from './symmetry.js';

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v3 = new THREE.Vector3();
function setRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
}

// El raycaster de three.js no respeta `visible`: se descartan a mano los objetos ocultos (o con un padre oculto).
const shown = n => { for (; n; n = n.parent) if (!n.visible) return false; return true; };

let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (ctx.mode === 'map') return;
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || tc.axis) return;
  setRay(e);
  if (ikOn()) { const hh = ray.intersectObjects(Object.values(handles))[0]; if (hh) { selectHandle(hh.object); return; } }
  const hit = ray.intersectObjects(state.objects.filter(o => o.node.visible).map(o => o.node), true).find(i => shown(i.object));
  let o = null;
  if (hit) { let n = hit.object; while (n && !(o = state.objects.find(x => x.node === n))) n = n.parent; }
  if (o) select(o);
  else { select(null); const bh = ray.intersectObject(ctx.ch.root, true).find(i => i.object.userData.body && shown(i.object)); selectPart(bh ? bh.object.userData.part : null); }
});
tc.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; if (ctx.mode === 'map') return; if (!e.value) { bus.emit('props'); commit(); } });
tc.addEventListener('objectChange', () => {
  if (ctx.mode === 'map') return;
  if (ctx.ikActive) {
    const side = ctx.ikActive.userData.side; ikArm(side, ctx.ikActive.position);
    if (symPoseOn()) { mirrorJoint('hombro_' + side); mirrorJoint('codo_' + side); setPose(ctx.ch.joints, state.pose, state.limits); }   // el brazo opuesto copia el movimiento
    bus.emit('sync');
  } else bus.emit('props');
});

// ---------- Arrastrar desde la biblioteca: resalta el socket más cercano ----------
function nearestSocket(e) {
  setRay(e);
  const h = ray.intersectObject(ctx.ch.root, true).find(i => i.object.userData.body && shown(i.object)); if (!h) return null;
  let best = null, bd = 1e9;
  for (const [n, s] of Object.entries(ctx.ch.sockets)) { const d = s.getWorldPosition(v3).distanceTo(h.point); if (d < bd) { bd = d; best = n; } }
  return best;
}
function highlight(name) {
  for (const [n, s] of Object.entries(ctx.ch.sockets)) s.children[0].scale.setScalar(n === name ? 2.5 : 1);
  tag.style.display = name ? 'block' : 'none'; tag.textContent = name ? 'Socket: ' + name : '';
}
view.addEventListener('dragover', e => { if (ctx.mode === 'map') return; e.preventDefault(); highlight(nearestSocket(e)); });
view.addEventListener('dragleave', () => { if (ctx.mode !== 'map') highlight(null); });
view.addEventListener('drop', e => {
  if (ctx.mode === 'map') return;
  e.preventDefault(); const type = e.dataTransfer.getData('text/plain'); if (!LIBRARY[type]) return;
  const sock = nearestSocket(e) || LIBRARY[type].socket; highlight(null);
  select(addObject(type, sock)); commit();
});
