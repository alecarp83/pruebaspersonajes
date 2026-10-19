// Exportación de un mapa como carpeta lista para usar:  maps/<id>/<id>.html · <id>.css · <id>.js
//   <id>.js    el mapa en formato compacto (datos optimizados) + arranque del motor si se abre <id>.html
//   <id>.css   estilos de la página (los del modo Jugar, minificados, más el tema del mapa)
//   <id>.html  página independiente: misma interfaz que el modo Jugar, ya apuntando a este mapa
// Las plantillas se derivan de game.html y game.css (se pasan como texto), así que la página exportada nunca se desincroniza del juego.
import { pack, slug } from './mapdata.js';
import { makeZip } from './zip.js';

export const minifyCss = css => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const minifyHtml = h => h.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function swap(text, from, to) {   // si la plantilla cambia y ya no coincide, mejor fallar que exportar una página rota
  if (!text.includes(from)) throw new Error('La plantilla del juego cambió y no se puede exportar (falta: ' + from.slice(0, 40) + ').');
  return text.replace(from, () => to);
}

export function buildMapHtml(map, id, gameHtml) {
  let h = gameHtml;
  h = h.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(map.name)}</title>`);
  h = swap(h, '<link rel="stylesheet" href="/src/game/game.css">', `<link rel="stylesheet" href="${id}.css">`);
  h = swap(h, '<script type="module" src="/src/game/game.js"></script>', `<script type="module" src="${id}.js"></script>`);
  h = swap(h, '<body>', `<body data-autostart data-map="${id}">`);
  h = swap(h, 'href="index.html"', 'href="../../index.html"');
  h = swap(h, '<div id="view"></div>', `<div id="view"></div>\n<div id="mapTitle">${esc(map.name)}</div>`);
  return minifyHtml(h) + '\n';
}

export function buildMapCss(map, gameCss) {
  return minifyCss(gameCss) + minifyCss(`
    :root{--sky:${map.sky};--ground:${map.ground}}
    html,body{background:var(--sky)}
    #mapTitle{position:fixed;top:8px;right:8px;z-index:2;background:#000a;color:#fff;border-radius:6px;padding:6px 12px;font:600 13px system-ui,sans-serif;pointer-events:none}`) + '\n';
}

export function buildMapJs(map, id) {
  const data = JSON.stringify(pack(map));
  return `/* ${id}: mapa de "${map.name}" generado por el Editor de personaje 3D (formato compacto v1). No lo edites a mano: vuelve a exportarlo desde el editor. */
const MAP = /*map*/${data}/*endmap*/;
export default MAP;
// Si se abre ${id}.html (data-autostart), arranca el motor del juego con este mapa. En el modo Jugar solo se lee MAP.
if (typeof document !== 'undefined' && document.body && 'autostart' in document.body.dataset) {
  globalThis.__GAME_MAP__ = MAP;
  import('../../engine/engine.js').catch(() => {
    const m = document.getElementById('msg');
    if (m) { m.textContent = 'No se encontró el motor del juego (../../engine/engine.js). Copia la carpeta maps/ en la raíz del proyecto publicado (public/maps/).'; m.style.display = 'block'; }
  });
}
`;
}

// Devuelve { id, files: [{ name, data }] } con las rutas dentro de maps/<id>/
export function buildPackage(map, { gameHtml, gameCss }) {
  const id = slug(map.name), dir = `maps/${id}/`;
  return { id, files: [
    { name: `${dir}${id}.html`, data: buildMapHtml(map, id, gameHtml) },
    { name: `${dir}${id}.css`, data: buildMapCss(map, gameCss) },
    { name: `${dir}${id}.js`, data: buildMapJs(map, id) },
  ] };
}
export const packageZip = (map, templates) => { const p = buildPackage(map, templates); return { id: p.id, zip: makeZip(p.files) }; };
