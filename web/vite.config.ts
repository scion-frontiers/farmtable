import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/farmtable.v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
