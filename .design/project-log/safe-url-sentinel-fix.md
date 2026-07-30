# safe-url sentinel fix

**Date:** 2026-07-30
**Agent:** farmtable-dev-3
**Branch:** fix/wire-vitest-suites

## What changed

Two files were edited in a single commit:

### web/test/safe-url.contract.test.ts

1. **Category 1 — http rejection test:** Changed `http://example.com/a` from
   expecting `null` (rejected) to expecting `'http://example.com/a'` (accepted).
   The owner ruled that http is allowed by default; per-environment carve-outs
   happen elsewhere.

2. **Category 2 — sentinel value (11 cases):** `safeHref` returns `undefined`
   on rejection, not `null`. Updated all 11 rejection test cases from
   `expected: null` to `expected: undefined`, and updated the type annotation
   on the `cases` array from `string | null` to `string | undefined`.

3. **Category 3 — stale docblock and filter:**
   - Updated the docblock signature from `string | null` to `string | undefined`.
   - Changed "everything else returns null" to "everything else returns undefined".
   - Fixed the `.filter()` guard from `!== null` to `!== undefined`.
   - Fixed the expected-count filter from `!== null` to `!== undefined`.
   - Fixed the comment about `safeHref` regressing to always returning the
     wrong sentinel.

### web/src/util/safe-url.ts

4. **@returns tag:** Added an explicit `@returns` JSDoc tag to `safeHref`
   documenting that rejection is signalled by `undefined`, not `null`, and that
   loose `!= null` or `!== null` checks will fail open.

## Why

The test file was written against an earlier API that returned `null` for
rejected URLs. The implementation was later changed to return `undefined`, but
the tests were not updated, causing 12 of 17 non-normalization tests to fail.
The http-rejection case was also out of date with the owner's policy decision
to allow http by default.

## Verification

- `tsc --noEmit` passes with zero errors.
- `npx vitest run test/safe-url.contract.test.ts` shows 17 passed, 5 failed.
  The 5 failures are all normalization tests (Category 4), which are parked
  and expected to fail — they test a `url.href` normalization contract that
  `safeHref` currently returns `raw` instead of `url.href`.
