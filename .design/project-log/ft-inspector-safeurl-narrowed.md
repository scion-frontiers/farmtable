# ft-inspector safe-url assertions narrowed

**Date:** 2026-07-30
**Author:** farmtable-dev-4
**Branch:** fix/wire-vitest-suites
**Commit:** fix(web): narrow ft-inspector safe-url assertions and accept remote http

## What changed

Five failing assertions across `ft-inspector-code.safe-url.test.ts` and
`ft-inspector-meta.safe-url.test.ts` were fixed:

### Narrowed innerHTML predicates (A1, B1, B2)

Three assertions used `innerHTML.not.toContain(hostileString)` which failed
because the components intentionally render the hostile URL in the `title`
attribute of the fallback `<span>` (a tooltip, not a navigation sink). The
"degrade, don't drop" design means the hostile string SHOULD appear in the
title so users can see what was rejected.

Replaced with attribute-walk assertions that:
1. **Positively assert** the hostile string IS present in the fallback span's title
2. **Walk every element and every attribute** in the shadow DOM
3. **Skip only the admitted exception** (title on the fallback span, via a named `continue`)
4. **Reject** the hostile string anywhere else

Affected assertions:
- **A1** — `ft-inspector-code.safe-url.test.ts`: `javascript:` with `.pr-link-unsafe`
- **B1** — `ft-inspector-meta.safe-url.test.ts`: `javascript:` with `.external-source-unsafe`
- **B2** — `ft-inspector-meta.safe-url.test.ts`: `data:text/html` with `.external-source-unsafe`

### Accepted remote http URLs per C2 ruling (A2, B3)

`safeHref` accepts all `http:` URLs (not just localhost). Two tests that
asserted http rejection were updated:

- **A2** — Removed `'http://evil.example.com/pr/7'` from the hostile URL array
  in ft-inspector-code tests. Added a new positive test confirming a remote
  http PR URL produces a link.
- **B3** — Changed ft-inspector-meta test from asserting no link to asserting
  a link is rendered for `'http://evil.example.com/task/1'`.

## Assertion form choice

**Variant 2 (attribute walk)** was chosen over Variant 1 (innerHTML strip) for:

1. **Explicitness** — the admitted exception is a named `continue` statement
   identifying the exact element and attribute, not string surgery on innerHTML
2. **Stability** — doesn't rely on innerHTML string manipulation which could
   break on whitespace/ordering changes from Lit's template rendering
3. **Completeness** — walks ALL elements and ALL attributes, catching any new
   sink added anywhere in the shadow DOM
4. **Developer safety** — a developer adding a `data-*` or `aria-*` attribute
   containing the hostile URL gets a red test immediately

## Disarm test procedure and results

Each narrowed assertion was disarmed to prove it fires on a new sink (not vacuous).

### A1 — ft-inspector-code.ts + javascript:

- **Injection:** Added `data-disarm=${url}` to the fallback `<span>` in
  `renderPrLink` (ft-inspector-code.ts line 32)
- **Result:** TEST WENT RED
- **Failure message:** `AssertionError: expected 'javascript:alert(1)' not to contain 'javascript:'`
  at ft-inspector-code.safe-url.test.ts:45
- **Revert:** Component restored to original

### B1 — ft-inspector-meta.ts + javascript:

- **Injection:** Added `data-disarm=${remoteUrl}` to the fallback `<span>` in
  `renderExternalSourceLink` (ft-inspector-meta.ts line 24)
- **Result:** TEST WENT RED
- **Failure message:** `AssertionError: expected 'javascript:alert(document.domain)' not to contain 'javascript:'`
  at ft-inspector-meta.safe-url.test.ts:48
- **Revert:** Component restored to original

### B2 — ft-inspector-meta.ts + data:text/html

- **Injection:** Same as B1 (same component modification catches both)
- **Result:** TEST WENT RED
- **Failure message:** `AssertionError: expected 'data:text/html;base64,PHNjcmlwdD5hbGV...' not to contain 'data:text/html'`
  at ft-inspector-meta.safe-url.test.ts:65
- **Revert:** Component restored to original

**All three disarms were reverted.** Component source files have zero diff
from their pre-edit state.

## Verification

- TypeScript (`tsc --noEmit`): zero errors
- Target test files: 25/25 GREEN
- Full vitest suite: only 5 normalization failures in safe-url.contract.test.ts
  (category 4, parked) — everything else GREEN (402 passed)
