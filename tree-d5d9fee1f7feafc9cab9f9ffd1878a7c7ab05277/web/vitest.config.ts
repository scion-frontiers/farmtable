import { defineConfig } from 'vitest/config';

/**
 * Component-test configuration.
 *
 * This deliberately does NOT extend `vite.config.ts`: the app config pulls in
 * `vite-plugin-static-copy`, which copies ~2000 Shoelace asset files on every
 * run and is pure overhead for component tests. Everything the components need
 * from Vite (TypeScript/decorator transforms via the root `tsconfig.json`,
 * `./x.js` -> `x.ts` resolution, `import.meta.env`, CSS handling) is built into
 * Vite's defaults and still applies here.
 */
export default defineConfig({
  test: {
    // Component tests live in `web/test/`. The pre-existing Node-script tests
    // under `web/src/**/*.test.ts` are run by `scripts/run-node-tests.mjs`
    // instead; see README/package.json.
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
    // Custom elements are registered globally and cannot be un-registered, so
    // each test file gets its own environment.
    isolate: true,
  },
});
