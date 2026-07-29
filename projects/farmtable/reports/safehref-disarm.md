# The 64-line `safeHref` disarm — a mutation with its provenance attached

**Author:** dev-xss-r9. **Written:** 2026-07-29. **Requested by:**
farmtable-em-hardening, for the `safe-url.ts` add/add collision between `main`
and em-task-state phase-2.

**Read this first.** This mutation was authored against **one specific
implementation**. You are being handed it to run against a **different** one.
Everything below is measured, and §6 says what it does not cover. A mutation
without its pedigree is a number someone will trust; this section is the
pedigree.

---

## 1. PROVENANCE — what it was authored against

| | |
|---|---|
| commit | `439b309eb5e92cbc2b902b0e656fd63ca4474fbe` (= `origin/main` at time of writing) |
| file | `web/src/util/safe-url.ts` |
| blob | `659ef5823260037833b0cdfa141e3005f2c785cb`, 154 lines |
| test file | `web/src/util/safe-url.test.ts`, blob `c3e1b5cb88a7305eaad9c978b48c8c95a46b4e86`, 631 lines |
| measured in | fresh `git clone --shared` of `439b309` into `/tmp/disarm/base`, `npm ci --offline` from the commit's own lockfile |
| tree state at checkout | `git status --porcelain -uall` empty **before** the mutation was applied; dirty by design after |

The mutation arm is necessarily tree-measured — a mutant is by definition not in
any commit. The *baseline* arm is commit-measured. That asymmetry is a
confession, not a certificate; it is why §4 reports both arms.

## 2. THE EXACT MUTATION

`safeHref` occupies lines 90–154. Its **body is lines 91–154 = 64 lines**. The
disarm deletes that body and substitutes a pass-through. The signature, the
export, the doc comment, `SAFE_SCHEMES`, and **every call site** are untouched.

```ts
export function safeHref(raw: string | null | undefined): string | undefined {
  return raw ?? undefined;
}
```

**DIFF LINE COUNT — read this carefully, the two numbers differ and both are
correct:**

- the replaced **region** is **64 lines** (91–154 inclusive);
- `git diff --numstat` reports **`1  63`** — 1 insertion, 63 deletions — because
  the closing `}` is common to both sides and git matches it rather than
  rewriting it.

So: **64 lines of behaviour removed, 64 lines of diff churn, 63 recorded
deletions.** If you re-derive this and get 63, you have not made a mistake. If
you get **0**, you have not made a mutant — a mutant with 0 diff lines is not a
surviving mutant, it is no mutant, and that is the failure this whole document
exists to prevent.

**What it makes the code do:** `safeHref` becomes the identity function on
strings. Every scheme is accepted — `javascript:`, `data:`, `vbscript:`,
`blob:`. The empty-host backstop is gone. It is the maximal disarm: it removes
the allow-list, the parse, and the host check in one move, while leaving the
*shape* of the codebase — the call sites, the export, the type signature —
exactly as the guard's structural tests expect to find it. That combination is
the whole point.

## 3. HOW TO APPLY IT

```
git clone --shared --no-checkout <local path> /tmp/disarm/base
cd /tmp/disarm/base && git checkout <rev>
cd web && npm ci --offline
# replace the body of safeHref with `return raw ?? undefined;`
npm test
```

Clone from a local path. Do not `npm install` — installing from the network
gives you dependencies the commit does not declare, and then PRESENT stops
meaning "the commit declares it".

## 4. WHAT WENT RED — MEASURED, FILE BY FILE

Both arms run via `npm test`, which is `web/scripts/run-node-tests.mjs`,
discovery-based. **Denominator: 6 test files, both arms.**

| test file | baseline `439b309` | disarmed | verdict |
|---|---|---|---|
| `src/capabilities.test.ts` | ok | ok | **survives** |
| `src/components/inspector/render-sink-xss.test.ts` | ok | ok | **survives** |
| `src/util/assertions.test.ts` | ok | ok | **survives** |
| `src/util/safe-url.test.ts` | ok | **not ok** | **KILLS** |
| `src/util/url-binding-scan.test.ts` | ok | ok | **survives** |
| `src/utils/task-ready.test.ts` | ok | ok | **survives** |
| **totals** | **6 pass / 0 fail** | **5 pass / 1 fail** | 1 of 6 files kills |

**ONE FILE OF SIX CATCHES A TOTAL DISARM OF THE URL GUARD.** That is the
headline and it is not a complaint about the other five — they test other
things. It is a warning about what a green suite means.

Two of those survivals are worth naming, because both look like they should
have fired:

- **`url-binding-scan.test.ts` stays GREEN.** It asserts that every `href`
  binding routes *through* `safeHref`. The disarm leaves every call site intact,
  so the structural property still holds perfectly — while the function it
  routes to has been gutted. **A routing test cannot detect a hollowed-out
  destination.** If your union table contains rows of this shape, they will pass
  against any implementation, including no implementation.
- **`render-sink-xss.test.ts` stays GREEN.** It pins the markdown sink, which is
  a genuinely different property. This is the concrete evidence for C16: the
  URL-scheme property and the markdown-sink property are not layers of one
  thing, and a control for one is not a compensating control for the other.

## 5. WHICH CASES INSIDE `safe-url.test.ts` KILL IT

`safe-url.test.ts` is **one** `node --test` test that calls eight functions
sequentially from `run()`, so it is **fail-fast**: unmutated, the first thrower
aborts the remaining seven and you see exactly one error message. To get the
breakdown below I instrumented `run()` with a per-function try/catch **in the
throwaway clone only**. That is a modified instrument and is labelled as such;
the §4 table is from the unmodified one.

| case | vs. the disarm | first message |
|---|---|---|
| `testRejectsUnsafeSchemes` | **RED** | `safeHref("javascript:alert(1)") should be undefined for "javascript", got "javascript:alert(1)"` |
| `testAcceptsHTTPAndHTTPS` | green | — (it is the anti-vacuity control; it *should* stay green) |
| `testHostGuardIsAFailClosedBackstop` | **RED** | must reject `javascript://evil.com/%0aalert(1)` |
| `testSharedFixturesMatchClientColumn` | **RED** | client column disagrees with `testdata/url-scheme-cases.json` |
| `testBaseDependenceMarkersAreAccurate` | green | markers are about host resolution, not scheme |
| `testPayloadNeverReachesHrefAttribute` | **RED** | `renderPrLink`: a `javascript:` URL must not produce an anchor at all |
| `testGuardHoldsForEveryItemInAList` | **RED** | poisoned-first list: exactly one href should survive |
| `testExternalAnchorsKeepTargetBlank` | green | `rel="noopener"`, orthogonal |

**5 of 8 kill it; 3 survive.** The three survivors are not weak rows — two test
orthogonal properties and one is the deliberate anti-vacuity control. Do not
delete a row because it survived this mutant. **Survival against one mutant is
not evidence of a useless test; it is evidence about that mutant.**

## 6. WHAT THIS DOES **NOT** COVER — read before using it as a kill set

1. **It is one mutant.** It tests whether the scheme decision exists *at all*.
   It says nothing about whether an implementation gets the decision *right* at
   the edges. An implementation that rejects `javascript:` but accepts
   `http:/\/\evil.com`, or that resolves against `window.location.origin` and so
   launders `//evil.com/x` into an accepted same-origin URL, **passes this
   disarm cleanly**. Both are real behaviours discussed in the `439b309` source
   comments; neither is caught here.
2. **The pass oracle is the trap you already identified.** Running two
   implementations against a unioned table and recording which rows each fails
   cannot distinguish "enforces the property" from "was never asked". This
   mutation is a *kill* oracle for exactly one property and only for the
   coarsest failure of it. Union the tables, then **mutate the survivor** —
   otherwise the bigger green is the weaker code.
3. **`--outDir .tmp-test` compiled artefacts** are generated by the run and are
   gitignored at `.gitignore:46`. They are present in the clone after either
   arm. They do not affect the figures above (checked previously by
   differential), but a `git status --porcelain` in that clone will look clean
   while they are on disk. Use `--ignored` if that matters to you.
4. **Not measured:** whether the em-task-state phase-2 implementation is
   behaviourally identical to `439b309`'s. I have not read it. Every number in
   this document is about `659ef58` and nothing else.
5. **Not measured:** the server half. `internal/server/urlvalidate.go` is a
   separate implementation with three rules the client does not replicate; the
   9-of-42 differential is pinned in `testdata/url-scheme-cases.json`. Disarming
   the client does not exercise it.

## 7. THE ONE-LINE VERSION

Delete the 64-line body of `safeHref`, keep the signature, run `npm test`: a
correct implementation loses **1 of 6 files** and **5 of 8 cases within it**. If
your candidate implementation loses **fewer** than that, find out why before you
land it. If it loses **none**, the guard is decorative regardless of how green
the table is.

---

*No repository file was modified to produce this document. All mutation work
was done in `/tmp/disarm/base`, a throwaway clone. Nothing committed, nothing
pushed.*
