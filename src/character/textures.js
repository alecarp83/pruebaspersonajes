import * as THREE from 'three';

// Texturas procedurales dibujadas en canvas (sin archivos externos). Cada una usa dos colores.
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const fill = (g, a) => { g.fillStyle = a; g.fillRect(0, 0, 256, 256); };
const DRAW = {
  piel(g, a, b, r) { fill(g, a); g.fillStyle = b; for (let i = 0; i < 1400; i++) { g.globalAlpha = .06 + r() * .12; g.beginPath(); g.arc(r() * 256, r() * 256, 1 + r() * 3, 0, 7); g.fill(); } },
  tela(g, a, b) { fill(g, a); g.strokeStyle = b; g.globalAlpha = .35; for (let i = 0; i < 256; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); } },
  rayas(g, a, b) { fill(g, a); g.fillStyle = b; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 32, 256); },
  cuadros(g, a, b) { fill(g, a); g.fillStyle = b; for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) if ((x + y) / 64 % 2 === 0) g.fillRect(x, y, 64, 64); },
  cuero(g, a, b, r) { fill(g, a); g.strokeStyle = b; for (let i = 0; i < 500; i++) { g.globalAlpha = .1 + r() * .25; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 14, y + (r() - .5) * 14); g.stroke(); } },
  metal(g, a, b, r) { fill(g, a); g.strokeStyle = b; for (let y = 0; y < 256; y++) { g.globalAlpha = r() * .25; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } },
  madera(g, a, b, r) { fill(g, a); g.strokeStyle = b; g.lineWidth = 2; for (let y = 0; y < 256; y += 6) { g.globalAlpha = .25 + r() * .3; g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x * .05 + y) * 3); g.stroke(); } },
  camuflaje(g, a, b, r) { fill(g, a); for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? b : '#000'; g.globalAlpha = i % 2 ? .9 : .25; g.beginPath(); g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 20, r() * 3, 0, 7); g.fill(); } },
};
export const TEXTURE_NAMES = ['liso', ...Object.keys(DRAW)];
const cache = new Map();

export function makeMaterial({ tex = 'liso', color = '#888888', color2 = '#555555', scale = 4, roughness = .8, metalness = 0, opacity = 1 } = {}) {
  const textured = tex !== 'liso' && DRAW[tex];
  const m = new THREE.MeshStandardMaterial({ color: textured ? '#ffffff' : color, roughness, metalness });
  if (textured) {
    const key = tex + color + color2;
    if (!cache.has(key)) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d'); g.globalAlpha = 1; DRAW[tex](g, color, color2, rng(12345));
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t);
    }
    m.map = cache.get(key).clone(); m.map.needsUpdate = true; m.map.repeat.set(scale, scale);
  }
  if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
  return m;
}
