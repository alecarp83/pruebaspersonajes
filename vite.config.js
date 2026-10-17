import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// base './' hace que las rutas funcionen en GitHub Pages y Vercel. Dos páginas: editor y juego.
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    game: fileURLToPath(new URL('./game.html', import.meta.url)) } } },
});
