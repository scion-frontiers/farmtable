# task-state-web-ui — phase 2 rebase onto main `aa08f1a`

Rebased `p2-land` from base `43bd206` onto main `aa08f1a`. Resulting tip: `3679e24`.
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/dev-p2-rebase.md`.

## What moved

Main had gained two things the branch predated:

- `f94dfa2` — the shared Node test runner `web/scripts/run-node-tests.mjs`
- `373ff49` — `scripts/ci-suite-manifest.mjs` learns to expand glob runners

42 commits replayed (not 40, as the dispatch stated). Linear, no merges, none dropped:
subject multisets identical, and 39/42 patch-ids byte-identical — the 3 that differ are exactly
the 3 that carried conflict resolutions.

## Conflicts and resolutions

| Commit | File | Side |
|---|---|---|
| `c215de7` | `web/package.json` | main's `test` (runner supersedes the branch's explicit file list) |
| `ac15870` | `web/scripts/run-node-tests.mjs` | main's, verbatim (`2163726`) |
| `ac15870` | `web/package.json` | branch's — see below |
| `fe94cd5` | `web/scripts/run-node-tests.mjs` | main's, verbatim (`2163726`) |

`web/tsconfig.test.json` never conflicted; it auto-merged to main's `a35ba162`.
`scripts/ci-suite-manifest.mjs` never conflicted; it is main's `2d2f0996` at the tip.
`MIN_TEST_FILES` is unchanged at 1.

Note for future legs: the runner was an **add/add**, not a modify. It does not exist at `43bd206`
at all — main added it in `f94dfa2` and the branch added its own in `7970014`. There is no common
ancestor for that file, so "take the descendant" is not a sound way to reason about it. The policy
applied was simply: main's, verbatim, verified by blob hash.

## The one real decision: `web/package.json`

Main's `test` is `node scripts/run-node-tests.mjs`, and main's runner walks **`web/src/` only** —
component tests under `web/test/` are vitest's job. Phase 2's 26 test files split 4 in `web/src/`
and 22 in `web/test/`.

Taking main's `test` line verbatim therefore unwires all 22 component tests. Measured, not assumed:
the membership gate goes red with `enumerated=26 executed=4 missing=22`.

Resolved to the branch's fan-out, which preserves main's runner command intact as `test:node`:

```json
"test": "npm run test:node && npm run test:components",
"test:node": "node scripts/run-node-tests.mjs",
"test:components": "vitest run",
```

The resulting blob `ac89df7` is byte-identical to the pre-rebase tip's, i.e. this reproduces the
branch's own intent rather than inventing a third option.

## Verification at `3679e24`

Re-run on a fresh clone of the commit, not the working tree:

- `git status --porcelain` — zero lines
- `npx tsc --noEmit` in `web/` — exit 0 (must be run from `web/`; from the repo root `npx` fetches
  the unrelated `tsc@2.0.4` package and gives a false red)
- `npm test` — exit 0: "Running 4 test file(s)" + "Test Files 22 passed (22)", 426 assertions
- `node scripts/ci-suite-manifest.mjs` — exit 0 at
  `enumerated=26 executed=26 missing=0 (floor 1)`

The gate was shown to be capable of failing, rather than trusted on its exit code: a throwaway
`web/test/*.spec.ts` drove it red naming the file (`missing=1`), and again red via the
compiled-but-not-listed arm after temporarily widening the tsconfig `include`; removing both
returned it to green at the same N=26. No residue.

## Pre-existing issues noticed, not fixed here

- `scripts/ci-suite-manifest.mjs` calls `tsconfigFiles(...)` in its `node --test` arm, but the
  function defined in the file is `tsconfigInfo`. That path would throw `ReferenceError`. Not
  reached by this branch's wiring; the file is main's verbatim by policy.
- `web/tsconfig.json` has `"include": ["src"]`, so the 22 component tests under `web/test/` are not
  covered by `tsc --noEmit` — only by vitest's transform.

Auth was not touched: no file matching `auth|token|permission|login|session|rbac|scope` differs
between `aa08f1a` and the tip.
