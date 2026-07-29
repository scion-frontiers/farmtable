# Phase 2 web UI — landed onto CI-bearing main

Agent: `farmtable-dev-p2-land`. Brief: `briefs/farmtable-dev-p2-land.md`.
Upstream context: `reports/review-p2-r6.md` (APPROVE, 0 Critical, 0 Required).

## What was rebased

`phase2-web-ui-r5` tip `61ca67e` onto main `43bd206`. 39 commits replayed.

Pre-flight measurements reproduced the EM's exactly, which is why the rebase was
trusted to proceed:

| Measurement | Expected | Got |
|---|---|---|
| `git merge-base phase2-web-ui-r5 main` | `cc92735` | `cc92735` |
| `git rev-list --count cc92735..main` | 19 | 19 |
| conflicted files | 2 | 2 |
| `web/src` file count at main / at branch | 53 / 59 | 53 / 59 |
| population of `.test.tsx`, `.spec.ts`, `.spec.tsx` under `web/src` | 0, 0, 0 | 0, 0, 0 |

## The two conflicts

Both landed in the first replayed commit (`6a0b425`), not at the tip. The tip
state the brief describes is reached by a later commit (`e311ce2`) that edits
both files again. Resolving to main's content at the conflict point would have
made `e311ce2` conflict as well — a third conflict, manufactured by the
resolution rather than present in the trees. So both files took phase 2's side
at the conflict point, and the intended final content was applied at the tip as
its own commit (`e1aadf0`). Final content is what the brief specifies; the
conflict count stayed at the predicted 2.

**`web/package.json` — phase 2's side.** Main's `rm -rf .tmp-test` is not lost:
the runner does `rmSync(outDir, ...)` itself. Main's `node --test` is
deliberately not carried; `task-ready.test.ts` throws from a hand-rolled
`assertEqual`, so bare `node` still exits non-zero on failure.

**`web/tsconfig.test.json` — main's four patterns**, not a union with phase 2's
single `src/**/*.test.ts`, and not phase 2's side.

## The runner: three coupled patterns, not two

`web/scripts/run-node-tests.mjs` is coupled to that include list. The coupling
has three members, and the brief's first version named only two:

- the `sources` walk — decides what is **counted**
- the `compiled` walk — decides what is **run** (the execution loop iterates
  `compiled`, not `sources`)
- the tsconfig `include` — decides what is **compiled**

Widening only `include` + `sources` leaves a `.spec.ts` compiled, uncounted and
**unrunnable**: the fail-closed count check trips and the suite goes red, but
the spec file never executes. Red under both hypotheses, so the red is not
evidence. This was measured, not reasoned about — see the counterfactual below.

All three now describe the same population, as `SOURCE_RE` / `OUTPUT_RE` with
the coupling documented in the file header, since em-ci intends to adopt the
runner as shared infrastructure for all three tracks.

`outDir` is untouched (`web/.tmp-test`, gitignored at `.gitignore:46`).

## Positive control on the glob widening

Run in a throwaway scratch clone, discarded afterwards, so the landing tree
never held the instrument.

| Arm | Result |
|---|---|
| Red — throwaway failing `.spec.ts` under `web/src` | exit **1**, carrying **the spec's own assertion text**; `Compiling 5`, and `▶ .tmp-test/util/glob-positive-control.spec.js` shows it was counted, compiled and executed |
| Restored green — spec deleted | exit **0**, 4 scripts, clean tree |
| Counterfactual — `OUTPUT_RE` narrowed back to `.test.js` only | exit **1** from the runner's *count-mismatch* message; spec assertion text **absent**, i.e. never executed |

The counterfactual is the point: it is what the two-way widening would have
produced, and it is red for the wrong reason.

## Cleanups

- **6a (N-1)** — `ATTENTION` docblock said "four places"; the inspector callout
  is the fifth. Now says five and names it.
- **6b (FYI-3)** — chose **option (ii)**: kept the `globalThis.__xss`
  assertion, added cleanup, labelled it NOT COVERAGE. Kept because it is the
  only place naming the attack being defended against and the reviewer read it
  as good intent-documentation; the real defect was the uncleaned key, now
  deleted in `afterEach` so a future real firing stays local. Mutation check ran
  anyway: `createTextNode` → `insertAdjacentHTML` **kills 1**, and the failing
  assertion is `querySelector('img')` ("the message was parsed as HTML") while
  `__xss` stays undefined — empirically confirming the annotation.
- **6c (N-2)** — chose to **soften the comment**. The stronger option was not
  cheap: the truncation is in the production loop, so no `RecordingClient`
  helper can observe the planned write count; only a non-failing control run
  could, which is a rewrite rather than a cleanup.

## Floor

**Not set, and `scripts/ci-suite-manifest.mjs` is byte-identical to `43bd206`.**
`MIN_TEST_FILES` reads **1** at line 35, as it did at the base. Ownership of the
number sits with `farmtable-em-ci` / `ci-22-setup`.

## Open item handed to em-ci — the membership gate fails on this branch

`node scripts/ci-suite-manifest.mjs` exits **1**:

```
COULD NOT ANALYSE (1):
  node scripts/run-node-tests.mjs -> cannot map 'scripts/run-node-tests.mjs' to a tracked test file
FAIL: ... enumerated=26 executed=26 missing=0 unanalysable=1
```

Not a regression from this rebase — **it reproduces at `61ca67e`**, before the
rebase, and the manifest here is identical to main's. The checker understands
`tsc -p … && node --test <explicit file>` (main's shape) but not a glob runner,
and its own failure text says "teach this script the new runner". It cannot be
fixed from this branch without editing the manifest, which this brief forbids.
It is the same handoff em-ci already owns via runner upstreaming.
