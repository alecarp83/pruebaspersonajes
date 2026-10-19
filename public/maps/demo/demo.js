/* demo: mapa de "demo" generado por el Editor de personaje 3D (formato compacto v1). No lo edites a mano: vuelve a exportarlo desde el editor. */
const MAP = /*map*/{"v":1,"name":"demo","size":50,"ground":"#6aa84f","sky":"#9ec5e8","fog":[28,70],"spawn":[0,18,180],"pal":["#8f8a9a","#a59a8a","#7a5a3a","#6f7a62","#857a6a","#dde4ea","#3b86c6","#f2c230"],"o":{"platform":[[-16,12,0,4,0.3,3],[-16,9.4,0,4,0.6,3],[-16,6.8,0,4,0.9,3],[-16,4.2,0,4,1.2,3,0],[-6,-2,0,2,0.12,4.4,2]],"wall":[[8,12,0,8,2.2,0.4],[4,15,90,6,2.2,0.4],[12,15,90,6,2.2,0.4],[14,2,30,10,2.5,0.5,1]],"river":[[0,-2,90,4,1,40,-1,-1,1.6]],"mountain":[[-17,-16,0,10,7,10],[17,-17,30,7,4,7,3],[2,-20,0,6,3,6,4,5]],"tree":[[-8,14,0,1,1,1],[-5,17,0,1.2,1.3,1.2],[20,9,0,1.4,1,1.4],[21,-3,0,1,1.3,1],[-21,-3,0,1.2,1,1.2],[-22,6,0,1.4,1.3,1.4],[10,-9,0,1,1,1],[-9,-9,0,1.2,1.3,1.2],[5,-13,0,1.4,1,1.4],[-4,22,0,1,1.3,1]],"rock":[[-3,9,0,1,0.8,1],[12,-7,40,1.15,1.2,1],[-12,-5,80,1.3,0.8,1],[7,5,120,1.45,1.2,1],[18,18,160,1.6,0.8,1]],"ball":[[3,14,0,0.5],[-3,13,0,0.5,6],[0,9,0,0.7,7]],"crate":[[-8,18,0,0.5],[-8,19.1,0,0.5],[-6.9,18,0,0.5],[8,17,0,0.5],[9.2,17,0,0.5],[10.4,17,0,0.5]],"dummy":[[14,8,0,1],[-4,5,0,1],[10,-2.5,0,1.4]]}}/*endmap*/;
export default MAP;
// Si se abre demo.html (data-autostart), arranca el motor del juego con este mapa. En el modo Jugar solo se lee MAP.
if (typeof document !== 'undefined' && document.body && 'autostart' in document.body.dataset) {
  globalThis.__GAME_MAP__ = MAP;
  import('../../engine/engine.js').catch(() => {
    const m = document.getElementById('msg');
    if (m) { m.textContent = 'No se encontró el motor del juego (../../engine/engine.js). Copia la carpeta maps/ en la raíz del proyecto publicado (public/maps/).'; m.style.display = 'block'; }
  });
}
