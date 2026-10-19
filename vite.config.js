import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const at = p => fileURLToPath(new URL(p, import.meta.url));
// base './' hace que las rutas funcionen en GitHub Pages y Vercel. Entradas: editor, juego y motor.
// El motor ('engine') se emite con nombre fijo (engine/engine.js) porque los mapas exportados lo importan con una ruta relativa.
export default defineConfig({
  base: './',
  build: { rollupOptions: {
    input: { main: at('./index.html'), game: at('./game.html'), engine: at('./engine/engine.js') },
    output: { entryFileNames: chunk => chunk.name === 'engine' ? 'engine/engine.js' : 'assets/[name]-[hash].js' },
  } },
});
