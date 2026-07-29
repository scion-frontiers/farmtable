# dev-xss-r9 — arm definitions and their expected red targets

**Author:** dev-xss-r9, 2026-07-29, written at wind-down.
**Why this file exists:** arms are non-ref artefacts. No ref points at them, so no
fsck sweep, no reflog sweep and no bundle carries them. If it is not written
down it dies with the container.

## 0. THE EXPLICIT STATEMENT ASKED FOR

**My arms produced NO COMMITS.** Every arm was either (a) an uncommitted
working-tree mutation inside a throwaway clone, or (b) a read-only measurement.
So "nothing to bundle" here is a true statement about *arms* and must not be
read as "nothing was run". The bundle is complete with respect to refs; this
file is what the bundle structurally cannot hold.

## 1. ARMS WHOSE FULL DEFINITION IS ALREADY DURABLE

| arm | where the definition lives | durability |
|---|---|---|
| 64-line `safeHref` disarm | `scratchpad/.../reports/safehref-disarm.md` | shared volume |
| fresh-checkout re-measurement, 8 figures | `reports/dev-xss-union.md` §12.3 — **committed at 439b309** | in git |
| R-1 bare-count re-measurement, both arms | `reports/dev-xss-union.md` §4.1 | in git |
| conjunct-A interleaved acceptance evidence | `reports/dev-xss-union.md` §5.3 | in git |
| `suite-manifest` three-arm resolution | `reports/dev-xss-union.md` §6 | in git |
| R-3 `isCollectionWritable` two-sided read | `scratchpad/.../reports/R-3-isCollectionWritable.md` | shared volume |

Anything in `reports/dev-xss-union.md` is reachable from `439b309`, which is
contained in `/workspace/farmtable` and in both bundles. It is safe.

## 2. THE ARM THAT EXISTS ONLY AS PROSE — pre-registration for C-1/R-2

Run today, produced no artefact of its own, and is the one worth keeping because
**the prediction failed and the failure was mine.**

- **Arm definition:** apply the C-1 text edits (4 sites) and the R-2 citation
  correction, then run `npx tsc --noEmit` on the parent `7397b17` and on the
  child, same instrument both sides.
- **Pre-registered expectation:** EXIT=0 both arms. Text-only edits cannot break
  a TypeScript parse.
- **Measured:** parent `7397b17` EXIT=0. Child `6255508` **EXIT=2**,
  `ft-inspector-desc.ts(245,48): error TS1005: ';' expected.`
- **Cause:** I put backticks around `npm test` inside a **template literal**. A
  backtick ends the literal. Fixed with double quotes; amended to `e35e8d6`.
- **The finding underneath, and the reason this is written down:**
  `tsconfig.test.json` compiled the broken file **clean**, because its `include`
  is only `src/**/*.test.ts`. The test-side typecheck cannot see the app-side
  parse break. Filed as backlog **C9** (CI runs no TypeScript typecheck of the
  web app). **Expected red target if anyone re-arms this: `npx tsc --noEmit`
  with the APP tsconfig, not the test one.**

## 3. EXPECTED RED TARGETS — what should go red if each guard is removed

Stated as targets so a future agent can check a guard without re-deriving the
mapping. Only the first row is measured by me end-to-end today; the rest are the
targets as recorded, and are marked accordingly.

| remove this | expected red | status |
|---|---|---|
| `safeHref` body (64 lines) | `util/safe-url.test.ts` only — **1 of 6 files**, 5 of 8 cases | **MEASURED today**, see `safehref-disarm.md` |
| an `href` binding's route through `safeHref` | `util/url-binding-scan.test.ts` | recorded in `dev-xss-union.md` |
| the GITHUB conjunct in `getCapabilities` | `TestConjunctA_*` in `internal/server` | recorded, §5.3 |
| a tracked test file that compiles but never runs | `make suite-manifest` | recorded, §6 |
| markdown sanitisation | `components/inspector/render-sink-xss.test.ts` | r8's pins, not mine |

**The asymmetry that matters more than any single row:** `url-binding-scan` and
`safe-url` fail for *different* reasons and neither substitutes for the other. A
routing test passes against a gutted destination — measured today, the disarm
leaves `url-binding-scan` fully green. Do not treat one as coverage for the
other.

## 4. WHAT I DID NOT ARM

The server half (`internal/server/urlvalidate.go`), CSP, the markdown sink
itself, and the em-task-state phase-2 `safe-url.ts`. I have not read the last of
these and no number of mine is about it.
