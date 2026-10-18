// Pose simétrica: lo que se hace en un lado (L) se refleja en el otro (R), y copia de la pose de un lado al otro.
import { limitFor } from '../character/character.js';
import { state } from './core.js';
import { $ } from './util.js';

// Al reflejar, X (flexión) se mantiene; Y (giro) y Z (apertura) cambian de signo, igual que en las poses A y T.
const MIRROR = [1, -1, -1];
export const SIDED = ['hombro', 'codo', 'muneca', 'cadera', 'rodilla', 'tobillo'];
export const symPoseOn = () => $('#symPose').checked;
export const otherSide = j => /_[LR]$/.test(j) ? j.replace(/_([LR])$/, (_, s) => s === 'L' ? '_R' : '_L') : null;   // cintura, cuello y cabeza no tienen par

const clamp = (name, v) => { const [mn, mx] = limitFor(name, state.limits); return v.map((a, i) => Math.min(mx[i], Math.max(mn[i], a)) + 0); };   // `+ 0` normaliza el -0 de los límites invertidos

// Refleja en la articulación opuesta los ejes `axes` de `j` (por defecto los tres), respetando los límites del lado destino.
export function mirrorJoint(j, axes = [0, 1, 2]) {
  const o = otherSide(j); if (!o) return;
  if (!state.pose[j]) { if (axes.length === 3) delete state.pose[o]; return; }   // origen en reposo: el destino también
  const dst = state.pose[o] ? [...state.pose[o]] : [0, 0, 0];
  for (const i of axes) dst[i] = MIRROR[i] * state.pose[j][i] || 0;   // `|| 0` evita el -0
  state.pose[o] = clamp(o, dst);
}

// Copia toda la pose del lado `from` ('L' o 'R') sobre el opuesto.
export function copySide(from) { for (const b of SIDED) mirrorJoint(`${b}_${from}`); }
