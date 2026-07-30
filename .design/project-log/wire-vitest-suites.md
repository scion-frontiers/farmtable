# Wire 22 Vitest Component Test Suites into npm test

**Date:** 2026-07-30
**Branch:** fix/wire-vitest-suites
**Author:** farmtable-dev-2

## What Was Done

The Phase 2 web branch merge (031f23c8) added 22 component test files under
`web/test/` that use vitest as their runner, but vitest was not in
devDependencies and `npm test` did not invoke it. CI correctly detected the gap
via `scripts/ci-suite-manifest.mjs` (enumerated=31, executed=9, missing=22) and
failed the build.

### Changes

1. **web/package.json**: Added `vitest ^3.2.0` to devDependencies. Added
   `test:node` and `test:components` scripts. Changed `test` to chain both:
   `npm run test:node && npm run test:components`.

2. **web/package-lock.json**: Updated by `npm install` with vitest and its 37
   transitive dependencies.

3. **scripts/ci-suite-manifest.mjs**: Updated `MIN_TEST_FILES` from 7 to 31.
   Updated the path-set comment to list all 31 test files (9 node runner +
   22 vitest runner).

4. **web/src/components/ft-dashboard-view.ts**: Fixed Nit-1 from code review.
   Replaced `: null` with `: nothing` in two conditional template branches
   (lines ~380 and ~413). Added `nothing` to the `lit` import. This is
   Lit-canonical: `nothing` avoids creating an empty text node in the DOM.

## MIN_TEST_FILES Floor Derivation

The floor is set to the population, not below it. Derived set-wise:

```
git ls-tree -r HEAD -- web/src/ web/test/ | grep '\.test\.ts$' | wc -l
# Result: 31
```

Node runner (9):
- web/src/capabilities.test.ts
- web/src/components/inspector/render-sink-xss.test.ts
- web/src/util/assertions.test.ts
- web/src/util/markdown-href.test.ts
- web/src/util/rank.test.ts
- web/src/util/safe-url.test.ts
- web/src/util/task-state-utils.test.ts
- web/src/util/url-binding-scan.test.ts
- web/src/utils/task-ready.test.ts

Vitest runner (22):
- web/test/attention-view.test.ts
- web/test/ft-app.write-error-seam.test.ts
- web/test/ft-app.write-error.test.ts
- web/test/ft-dashboard-view.test.ts
- web/test/ft-filter-chips.test.ts
- web/test/ft-inspector-changes.vocabulary.test.ts
- web/test/ft-inspector-code.safe-url.test.ts
- web/test/ft-inspector-header.availability.test.ts
- web/test/ft-inspector-meta.safe-url.test.ts
- web/test/ft-inspector-meta.state.test.ts
- web/test/ft-inspector-relationships.test.ts
- web/test/ft-kanban-view.contract.test.ts
- web/test/ft-kanban.drop-refusal-affordances.test.ts
- web/test/ft-ready-queue-view.availability.test.ts
- web/test/ft-ready-queue-view.concurrent-reorder.test.ts
- web/test/ft-ready-queue-view.rank-adversarial.test.ts
- web/test/ft-ready-queue-view.rank.test.ts
- web/test/ft-task-card.attention.test.ts
- web/test/ft-toolbar.contract.test.ts
- web/test/queue-ordering.test.ts
- web/test/safe-url.contract.test.ts
- web/test/vocabulary.contract.test.ts

## ci-suite-manifest.mjs Results

```
OK: every tracked JS/TS test file is ATTRIBUTABLE to a runner named in
web/package.json "test". enumerated=31 executed=31 missing=0 (floor 31)
```

Both runners agreed with the tree scan: run-node-tests.mjs --list returned 9,
vitest list --filesOnly returned 22, no residue in either direction.

## npm test Results

**test:node**: 9/9 passed (all node-runner suites green).

**test:components (vitest)**: 3 files failed, 19 files passed (22 total).
27 individual tests failed, 380 passed (407 total).

### Failed Test Files

1. **test/safe-url.contract.test.ts** (22 failures): All `safeExternalUrl` tests
   fail with `TypeError: (0 , safeExternalUrl) is not a function`. The test
   imports `safeExternalUrl` from `../src/util/safe-url.js` but the function does
   not appear to be exported under that name.

2. **test/ft-inspector-code.safe-url.test.ts** (2 failures): The component
   renders hostile URLs (javascript:, http://evil) differently than expected --
   the component correctly blocks the URL from becoming an `<a href>` but the
   test asserts the scheme string should not appear anywhere in innerHTML (it
   appears in a `title` attribute on the safe fallback rendering).

3. **test/ft-inspector-meta.safe-url.test.ts** (3 failures): Similar pattern --
   the component renders hostile URLs as non-clickable spans but the test expects
   no rendering at all, or expects http: non-localhost URLs to be rejected.

These failures are expected: the 22 suites had never been executed in CI. The
failures are not a reason to unwire the suites. They should be triaged and fixed
separately.
