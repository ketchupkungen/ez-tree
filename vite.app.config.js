// Config file for running the demo locally.
//
// Dev (`vite` / `npm run dev`)   → alias points to lib source for instant HMR.
// Prod (`vite build`)            → alias points to the prebuilt lib artifact.
import path from 'path';

/**
 * @type {import('vite').UserConfigFn}
 */
export default ({ command }) => ({
  build: {
    emptyOutDir: true,
    outDir: '../../dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        lab: path.resolve(__dirname, 'src/app/index.html'),
        original: path.resolve(__dirname, 'src/app/original.html'),
      },
    },
  },
  root: './src/app',
  resolve: {
    alias: {
      '@dgreenheck/ez-tree':
        command === 'serve'
          ? path.resolve(__dirname, 'src/lib/index.js')
          : path.resolve(__dirname, 'build/ez-tree.es.js'),
    },
  },
  server: {
    hmr: true,
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
  },
  preview: { host: '127.0.0.1', port: 5178, strictPort: true },
  assetsInclude: ['**/*.frag', '**/*.vert'],
});
