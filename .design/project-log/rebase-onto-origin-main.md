# Rebase task-state-web-ui-v2 onto origin/main

**Date:** 2026-07-30
**Author:** farmtable-dev-1

## Pre-rebase state

- **HEAD:** 0fd4485ebed045b42fa631e6bd947168daaace8d (task-state-web-ui-v2)
- **origin/main:** 64f4e12eb93575c47834f444ac5759f6c68ce555
- **merge-base:** 7a0f220dbd9332cb8db62138c841777432b4eda4

## Post-rebase state

- **HEAD:** 8c0296330f07d91f46c57f838c9e0828fbe3f2e3
- **origin/main:** 64f4e12eb93575c47834f444ac5759f6c68ce555
- **merge-base:** 64f4e12eb93575c47834f444ac5759f6c68ce555 (equals origin/main)
- **Commits ahead of origin/main:** 34

## Typecheck result

`./node_modules/.bin/tsc --noEmit` from `web/` — **PASS** (zero errors).

Note: `npm install` was required after the rebase because the rebased
package.json added `@types/node` and `@types/jsdom` to devDependencies (from
origin/main), which were not present in the stale node_modules.

## Conflicts encountered and resolutions

Five rebase steps (out of 34) produced merge conflicts. All were caused by the
branch's older `safeExternalUrl` security implementation clashing with
origin/main's more comprehensive `safeHref` implementation, and by the branch's
older test runner infrastructure clashing with origin/main's evolved discovery
runner.

### Commit 1/34: feat: update web UI for task state contract

**Files:** `web/package.json`, `web/tsconfig.test.json`

- **package.json `test` script:** Branch had explicit file listing; HEAD has
  discovery runner (`node scripts/run-node-tests.mjs`). Took HEAD.
- **tsconfig.test.json `include`:** Branch listed specific files; HEAD uses
  broad globs (`src/**/*.test.ts`, etc.). Took HEAD.

### Commit 2/34: fix(web): validate external URL schemes before rendering hrefs

**Files:** `ft-inspector-code.ts`, `ft-inspector-meta.ts`, `safe-url.ts`,
`safe-url.test.ts`

- **safe-url.ts:** Branch had simpler `safeExternalUrl()`; HEAD has
  comprehensive `safeHref()` with credential rejection, shared fixture
  validation, and extensive documentation. Took HEAD.
- **safe-url.test.ts:** Branch had basic tests for `safeExternalUrl`; HEAD has
  comprehensive test suite including JSDOM component rendering tests, shared
  fixture validation, and base-dependence markers. Took HEAD.
- **ft-inspector-code.ts:** Resolved import and template to use HEAD's
  `safeHref`/`renderPrLink` pattern. Removed unused `safeExternalUrl` variable.
- **ft-inspector-meta.ts:** Resolved template to use HEAD's
  `renderExternalSourceLink`. Removed `safeExternalUrl` import. Changed
  condition from `safeExternalUrl(t.remoteUrl)` to `t.remoteUrl` to match
  origin/main's pattern (validation is internal to `renderExternalSourceLink`).

### Commit 9/34: test(web): add Lit component test harness and task-state UI tests

**Files:** `web/package.json`, `web/package-lock.json`, `web/tsconfig.test.json`,
`web/scripts/run-node-tests.mjs`

- **package.json:** Took HEAD's test script and dependency versions. Removed
  vitest from devDependencies (not used by HEAD's test infrastructure).
- **tsconfig.test.json:** Took HEAD's broad glob includes.
- **run-node-tests.mjs:** Took HEAD's evolved discovery runner with
  `--list` support, multi-suffix discovery, and zero-test-is-failure semantics.
- **package-lock.json:** Took HEAD's version.

### Commit 13/34: fix(web): harden safe-url and stop shipping production sourcemaps

**Files:** `safe-url.ts`, `safe-url.test.ts`

- Both files: Took HEAD's versions (already comprehensive).

### Commit 20/34: test(web): close round-2 test findings with mutation evidence

**Files:** `web/src/utils/task-ready.test.ts`

- Import conflict: HEAD added `assertEqual` from assertions utility; branch
  added `phaseForStage` from gen/service. Kept both imports (both are used).
