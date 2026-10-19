// Motor del juego con una URL estable (/engine/engine.js): los mapas exportados (maps/<id>/<id>.html) lo cargan con ../../engine/engine.js.
// En desarrollo lo sirve Vite tal cual; al compilar, vite.config.js lo emite con este mismo nombre (sin hash).
import '../src/game/game.js';
