# safe-url test tables — independent control enumeration

**Date:** 2026-07-29
**Agent:** test-engineer (control leg)
**Report:** `/scion-volumes/scratchpad/projects/farmtable/reports/safeurl-tables-control.md`

## Purpose

Blind second count of the two `web/src/util/safe-url.test.ts` tables, run as a control
against the union being assembled independently by `dev-safeurl-union`. The union
agent's output was not read, and neither implementation blob (`659ef58`, `d85bb5b`) was
opened. Tests and test data only.

## Artefacts

| Side | Rev | Blob | Lines |
|---|---|---|---|
| MAIN | `439b309` | `c3e1b5c` (`web/src/util/safe-url.test.ts`) | 631 |
| BRANCH | `633f8f2` | `a9e49ff` (`web/src/util/safe-url.test.ts`) | 108 |
| MAIN | `439b309` | `4a54328` (`testdata/url-scheme-cases.json`) | 42 cases |

`testdata/url-scheme-cases.json` is absent from `633f8f2`. MAIN's test loops it, so
those 42 fixture cases are MAIN rows under the one-row-per-asserted-pair rule.

## Counts

- MAIN: **78 rows** (36 inline + 42 shared fixture), 49 distinct inputs.
  A further 8 render-layer rows exist and are listed separately as Tier C.
- BRANCH: **45 rows**, 45 distinct inputs.
- Distinct inputs across both sides: **81**. Shared: 13. One-side-only: 68
  (36 MAIN-only, 32 BRANCH-only).

## Findings

1. **One exact-input verdict conflict: `http://[::1]/x`.** MAIN pins accept (fixture
   #34 `client: "accept"`, asserted at test L280–291); BRANCH pins reject (L76).
   Reported without adjudication.
2. **The two sides test different symbols.** MAIN imports `{ SAFE_SCHEMES, safeHref }`
   and rejects with `undefined`, asserting accept as identity. BRANCH imports
   `{ LOCAL_HTTP_LINKS_ENABLED, safeExternalUrl }`, rejects with `null`, and asserts
   accept as a *normalized* value. Whether a union of the tables is even well-posed
   depends on these being the same policy surface, which this leg did not determine.
3. **Three class-level policy contradictions on non-identical strings** — plaintext
   `http:` to a public host, `https:` with embedded credentials, and loopback handling.
   Exact-string keying will not surface these in a mechanical union.

## Method notes

Cloned from the local path, never the remote. Blob identities verified with braced
`"${rev}:${path}"` before any read; `arg=[...]` echoed on each. No stderr suppressed on
measurements — the absent-fixture discovery came from an exit-128 on stderr. Set
operations computed by script rather than by eye. No files staged; nothing pushed.
