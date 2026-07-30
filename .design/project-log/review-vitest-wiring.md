# Review: PR #207 — Wire vitest component test suites into npm test

**Date:** 2026-07-30
**Reviewer:** farmtable-code-reviewer (code-reviewer agent)
**PR:** #207 (fix/wire-vitest-suites)
**Verdict:** APPROVE

## What was reviewed

CI repair PR. The Phase 2 web branch merge (031f23c8) added 22 vitest component
test files under `web/test/` without wiring vitest into `npm test`. CI detected
the gap via `scripts/ci-suite-manifest.mjs` and failed. This PR fixes that.

### Changes (4 files)

1. **web/package.json** — Added `vitest ^3.2.0` to devDependencies. Split `test`
   into `test:node` (existing node runner) and `test:components` (`vitest run`),
   chained with `&&`.

2. **web/package-lock.json** — 483 new lines, all vitest and its transitive
   dependencies. No unexpected packages.

3. **scripts/ci-suite-manifest.mjs** — `MIN_TEST_FILES` raised from 7 to 31.
   Comment block updated with full 31-path set (9 node runner, 22 vitest),
   verified to match on-disk files exactly.

4. **web/src/components/ft-dashboard-view.ts** — Nit-1 fix: replaced `: null`
   with `: nothing` in two Lit template conditional branches (lines 380, 413).
   Added `nothing` to the `lit` import. Typechecks clean.

## Gates

- `tsc --noEmit`: PASS
- `node scripts/ci-suite-manifest.mjs`: PASS (enumerated=31, executed=31,
  missing=0, floor=31, surplus=0)
- Scope verification: 4 files, single commit, no out-of-scope changes
- Comment path-set diff against disk: zero residue

## Findings

No Critical, Required, or Nit findings. Two FYI items:

1. Three pre-existing vitest test failures (27 tests) from safe-url rename
   mismatch — disclosed in PR body, correctly scoped as separate fixes.
2. Remaining `: null` in ft-dashboard-view.ts are TypeScript property
   assignments, not template branches — correct as-is.
