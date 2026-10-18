// Historial deshacer/rehacer por instantáneas JSON, y último estado en localStorage (se restaura al iniciar).
import { serialize, load, bus } from './core.js';

const KEY = 'editor3d:last';
let hist = [], hi = -1;

export function commit() {
  const s = JSON.stringify(serialize()); if (hist[hi] === s) return;
  hist.length = hi + 1; hist.push(s); hi++;
  if (hist.length > 100) { hist.shift(); hi--; }
  persist(s);
}
function persist(s) { try { localStorage.setItem(KEY, s); } catch { /* cuota llena o almacenamiento bloqueado */ } }
bus.on('commit', commit);

const goTo = i => { hi = i; load(JSON.parse(hist[hi]), { record: false, keepView: true }); persist(hist[hi]); };   // el estado mostrado es también el que se restaura al recargar
export const undo = () => { if (hi > 0) goTo(hi - 1); };
export const redo = () => { if (hi < hist.length - 1) goTo(hi + 1); };

// Devuelve true si había un estado guardado válido y se cargó.
export function restoreLast() {
  try { const s = localStorage.getItem(KEY); if (!s) return false; load(JSON.parse(s)); return true; }
  catch { return false; }
}
