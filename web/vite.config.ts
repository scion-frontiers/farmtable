import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    // `dist/` is embedded into the server binary via `//go:embed all:web/dist`
    // and served by `http.FileServer` under no auth middleware, so anything
    // emitted here is retrievable unauthenticated. A sourcemap would hand out
    // the complete unminified client, including the comments explaining which
    // paths are security-relevant.
    //
    // Deliberately `false`, not `'hidden'`: 'hidden' only drops the
    // sourceMappingURL comment and still writes the .map into `dist/`, so it
    // would still be embedded and still be served.
    sourcemap: false,
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
