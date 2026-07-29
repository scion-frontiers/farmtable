import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [{
        src: 'node_modules/@shoelace-style/shoelace/dist/assets/**/*',
        dest: 'shoelace/assets',
      }],
    }),
  ],
  server: {
    proxy: {
      '/farmtable.v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
