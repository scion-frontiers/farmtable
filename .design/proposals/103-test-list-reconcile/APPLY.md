# #103 — reconciled `npm test` wiring. **PROPOSAL, NOT A MERGE.**

Branch `test-list-reconcile-103`, based at `0b52dcdd6a06f694378084ea3ebefa7d9c473f15`.

**Nothing in this directory is wired into anything.** These are artefacts to be
applied to a merged tree by whoever performs the merge. This branch deliberately
does not modify `web/package.json` or `web/tsconfig.test.json`: doing so would be
half a merge, on a base where three of the five suites do not exist, and I could
not verify the result without a build.

**No suite was compiled or executed at any point in producing this.** Every
measurement is a `git show` of a blob or a run of a script in this directory.

---

## The two sides, at immutable SHAs

The branch names moved during this work — `url-scheme-validation-r5` was measured
at two different SHAs 112 seconds apart — so everything below is pinned:

| Side | SHA | preserve ref |
|---|---|---|
| `#195` markdown-sanitize-r10 | `0b52dcdd6a06f694378084ea3ebefa7d9c473f15` | `refs/preserve/dev-103-testlist/m195-pin-0256Z` |
| XSS url-scheme-validation-r5 | `d5e35a4869475cd79c3a46e791909a610d1ea8f2` | `refs/preserve/dev-103-testlist/xss-pin-0256Z` |

**A BRANCH NAME IS NOT AN IDENTIFIER.** If the heads have moved again, re-measure
before applying; the reasoning below holds but the numbers may not.

---

## D3 — the reconciled `test` script

```json
"test": "node scripts/check-test-membership.mjs && node scripts/check-receipts.mjs && rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs"
```

with `web/tsconfig.test.json`:

```json
{ "compilerOptions": { "outDir": ".tmp-test" }, "include": ["src/**/*.test.ts"] }
```

Three decisions in that line, each with a reason:

1. **The glob wins over the hand list.** The `#195` side names its suites literally
   in two places (`package.json` and the tsconfig `include`), and a suite is run
   only if it appears in *both*. That is the mechanism of #103: git merges those
   two files independently, so the outcome is a property of a PAIR that no single
   conflict resolution ever puts on screen. Discovery removes the pair.

2. **The guards are invoked in-band, not documented.** `#84` and `#89` in this same
   backlog are guards that exist and run nowhere. Adding a tenth would have been
   the same defect with my name on it. They are `&&`-chained *before* the
   compile so a membership failure costs a second, not a full `tsc`.

3. **Guards run before `rm -rf .tmp-test`.** They read source only, so they are
   valid before anything is built, and running them first means a wiring mistake
   is reported without waiting for a compile.

## File placement

| From this directory | Lands at |
|---|---|
| `run-tests.mjs` | `web/scripts/run-tests.mjs` (replaces the XSS-side file) |
| `test-receipts.mjs` | `web/scripts/test-receipts.mjs` (new) |
| `check-receipts.mjs` | `web/scripts/check-receipts.mjs` (new) |
| `check-test-membership.mjs` | `web/scripts/check-test-membership.mjs` (new) |
| `test-receipts.manifest.json` | `web/test-receipts.manifest.json` (new) |
| `test-suites.pin` | `web/test-suites.pin` (new) |

`run-tests.mjs` is a **modification of XSS blob `8582a92f4db5d5d75fabe15e0ce0ec7d41ba8529`**,
started from that exact file so `git diff` against it shows only the #103 change.

---

## ⚠ THE ONE THING THAT WILL BREAK, AND I AM NOT CHOOSING FOR YOU

`web/src/utils/task-ready.test.ts` is **the single path present on both sides, and
the blobs differ**: `9b4cd5b` (XSS) vs `ef6d702` (#195). MEASURED:

- **XSS blob** imports `assertEqual` from `../util/assertions.js` (line 12), so it
  emits an `#assertions N` receipt automatically on exit. Fine under the runner.
- **#195 blob** has a local `assert` helper that only throws (line 15) and prints
  **nothing at all** on success. `grep` for `#assertions`, `console.`, `writeSync`,
  `process.stdout` across all 162 lines returns **one** hit, the throw.

The reconciled runner **fails closed on a suite that reports neither format**. So
if the `#195` blob wins that conflict, `npm test` goes RED on `utils/task-ready`
— correctly, by the rule, but on a suite that is not broken.

Two ways to clear it. **I have not picked one, because which is right depends on
which blob wins the content conflict, and that decision is not mine:**

- **(a) Take the XSS blob** of `task-ready.test.ts`. The receipt comes for free.
  Requires checking that the `#195` side added no test cases to its copy that the
  XSS copy lacks — a content merge I was not asked to perform.
- **(b) Keep the `#195` blob and route its local `assert` through
  `src/util/assertions.ts`.** Mechanical; changes no assertion, only the helper.

**Do not clear it by declaring the suite exempt in the manifest.** There is no
`silent` protocol and that is deliberate: an exemption is how a suite stops
reporting and nobody notices.

---

## What must still be verified with the build token

Everything below is **UNVERIFIED — requires execution**, which is fenced. Stated
as exact commands and the exact observation that settles each, per the escalation
protocol:

| # | Command | What it settles |
|---|---|---|
| 1 | `cd web && npm test` on the merged tree | That the wiring runs at all, and which of (a)/(b) above was applied. |
| 2 | read the runner's final block | It prints `"aggregateAssertionPin": <N>` to paste. **`N` is the only way to set that pin.** |
| 3 | `node scripts/check-receipts.mjs` | 21/21. Already green here against the module directly. |

**`aggregateAssertionPin` is `null`** in the manifest, with the reasoning written
beside it. It is not set by arithmetic: `380 + 131` is a plausible-looking number
nobody has observed, and a pin asserted at a wrong value reddens a correct tree,
which teaches everyone that the pin is the thing that gives. The runner prints,
loudly, on every run, that the aggregate is unchecked and what that leaves
unprotected — an unset gate must not be silent, or it is indistinguishable from a
gate that is on and agreeing.

`EXPECTED_ASSERTIONS = 380` from the XSS runner is **deliberately not carried
over**. It was an exact equality over four suites; the union has five, one of
which counts privately.

---

## Still true after all of this: **nothing runs any of it automatically**

There is no CI in this repository (#22, and that task is marked `completed`).
The guards above run when someone types `npm test`. That closes the merge-time
hole this task was about and does **not** close #22, which is the coordinator's.
A membership pin with no CI is a seatbelt that someone has to remember to fasten.
