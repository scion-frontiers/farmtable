# ci-22-setup — predictions recorded BEFORE each CI run

Purpose: a runner is only an instrument if the prediction precedes the reading.
Each block below was written and saved before the run it describes was triggered.

---

## Run 1 — first push of branch `ci/22-github-actions-setup`, base origin/main `7a0f220`

Written 2026-07-29, before pushing. Makefile now has `build: web` (generate
dropped, per coordinator approval), so my ORIGINAL prediction of "fails at
`buf generate`: command not found" is now VOID — that code path no longer runs.
This replaces it.

Step-by-step prediction, most-likely outcome first:

1. `actions/setup-go` with `go-version: 1.26.5` — **PASS expected**, but this is
   the step I am least able to check from here. If Go 1.26.5 is not in the
   setup-go version index the job dies here and nothing else is learned.
   Confidence: medium.
2. `npm ci` in `web/` from the committed lockfile — **PASS expected**. High
   confidence; the lockfile is present and complete.
3. `node scripts/ci-suite-manifest.mjs` — **PASS expected, 1 present / 1
   executed.** High confidence: verified locally against this exact tree, both
   the passing and the failing path.
4. `make build` — **THIS IS MY PREDICTED FAILURE POINT.** It runs
   `tsc --noEmit && vite build` and then `go build ./...`. Nothing in this
   repository has ever been compiled from a clean clone, so the TypeScript
   typecheck is unproven. I predict the failure, if there is one, is a `tsc`
   type error, NOT the Go embed — the embed is what my Makefile change fixes and
   I expect that part to work. Confidence that build succeeds: ~55%.
5. `go test ./... -v` — **PASS expected but genuinely uncertain.** 53 test files
   that have only ever run on hosts with local state (a prebuilt `ft`, a seeded
   SQLite DB at /workspace/.farmtable). README says Postgres integration tests
   need `-tags integration`, which I am not passing, so those should be excluded.
   Risk: a test that silently depends on local state passes here and fails on a
   fresh runner. Confidence: ~70%.
6. `npm test` — **PASS expected.** It compiles one file and runs 9 assertions
   that print nothing on success. High confidence.
7. `make test` self-check — passes iff 5 and 6 pass.

**Falsifiable claim:** if the run goes red, it goes red at step 4 or step 5, not
at step 3. If it goes red at step 3 my membership check is wrong and that is the
most important thing this run could tell me.

**What a green run here would and would not mean:** it would mean origin/main
`7a0f220` builds and passes 1 web test and the Go suite on a fresh machine. It
would say nothing whatsoever about the 39 unpushed commits ahead of it, where
the vitest suites live.

---

## Run 1 — OUTCOME: my prediction was WRONG

Recorded after the fact, immediately, so the miss is not quietly overwritten.

- Predicted red at `make build` (tsc) or the Go suite. **`make build` passed
  first time.** The missing `web` edge was the entire fresh-clone defect; there
  was no second layer underneath it. Confidence stated was ~55%; reality was a
  clean pass.
- **The prediction that actually mattered, and that I never wrote down, was
  "a failing test will show up as a failing run." That is the one that was
  false.** The run reported success while `TestWatchTasks_NoInitial` failed
  inside it, because GitHub's default step shell is `bash -e {0}` with no
  `pipefail` and I piped `go test` into `tee`.

---

## Run 2 — pipefail fix AND deliberate failure injection together (D5)

Written before triggering. Two changes ride together on purpose: the injected
failure is a Go test failure travelling through the exact `| tee` pipeline that
swallowed a real one in run 1, so a red run tests the fix and the gate at once.

Predictions, each falsifiable:

1. Job conclusion is **failure**. If it is success, the pipefail fix does not
   work and I do not have a gate — and that, not a badge, is what I report.
2. The step that goes red is **`Go tests (invoked directly)`**, not `Build` and
   not the membership step.
3. The named failing test in the log is **`TestCIGateProbe_DeliberateFailure`**.
   If the only failing test is `TestWatchTasks_NoInitial` instead, the red is
   the flake rather than my probe, and the run proves nothing about the fix.
4. `Makefile self-check` never runs, because the job stops at the failed step.
5. The `Executed Go test membership` step **does** still run, because it is
   `if: always()`.

## Run 3 — probe removed

Prediction: conclusion **success**, all steps green, membership unchanged at
1 present / 1 executed. Caveat recorded in advance: `TestWatchTasks_NoInitial`
is flaky, so a red run here is possible and would be the flake, not a
regression. I will name which test failed rather than re-running until green.

---

## Run 4 — D5 second arm: the workflow-level default, tested alone

Written before triggering, at the coordinator's direction. Run 2 proved the
explicit `set -o pipefail` inside the Go step. It said nothing about
`defaults.run.shell: bash`, which is the defence every future step inherits and
the only one a contributor adding a step later will have.

Probe: a final step running `false 2>&1 | tee default-arm-probe.log` with NO
`set -o pipefail` of its own.

Predictions:
1. Job conclusion is **failure**, red at `SCRATCH default-only pipefail probe`.
2. Every preceding step is green, including `Makefile self-check`.
3. **If this step passes, `defaults.run.shell` is not in effect**, my belief that
   `shell: bash` supplies `-eo pipefail` is wrong, and the gate is one careless
   pipe away from lying again. That result would be more important than the red.

Also being confirmed in this run: the push trigger now matches `'**'`, so this
push should produce BOTH a `push` run and a `pull_request` run for the same
commit. If only one appears, the trigger widening did not take effect.

## Run 5 — probe removed, final state

Prediction: conclusion **success**. Caveat recorded in advance:
`TestWatchTasks_NoInitial` is flaky cold, so a red is possible and would be the
flake. I will name the failing test rather than re-running until green.

**OUTCOME: correct.** Both runs for `1d2863a` green (30420550986 push,
30420553718 PR), all 16 steps success, flake did not fire.

---

## Run 6 — assert web/dist is BUILT by the run, not inherited

Written before triggering. Prompted by scopedeny-93's measurement (via the
coordinator) that canonical carries an untracked `web/dist` dated Jul 27 16:54,
which is the mechanism that kept the fresh-clone build failure invisible.

Two new steps: assert `web/dist` is ABSENT before `make build`, and PRESENT
after. Together they prove the artefact was produced by this run rather than
inherited from a cache, a commit, or a stale machine.

Predictions:
1. Conclusion **success**. On a clean `actions/checkout` nothing has ever
   written `web/dist`, and `npm ci`/`npm run build` runs after the first
   assertion, so the pre-check should find it absent. Confidence: high.
2. The absent-before assertion is the one that could surprise me. If it goes
   red, something is restoring `web/dist` that I do not know about — most
   plausibly `actions/setup-node`'s npm cache. **That would be a genuine
   discovery and more valuable than the green**, because it would mean the
   runner is not as clean as I have been asserting throughout this report.
3. `TestWatchTasks_NoInitial` remains ~29% per cold run; a red there is the
   flake, not this change. I will name it rather than re-run until green.

**OUTCOME: predictions 1 and 3 correct, prediction 2 not triggered.** Both runs
for `1f57e23` green (30420881695 push, 30420883113 PR), 18 steps each. The
absent-before assertion passed, so nothing is restoring `web/dist` on the
runner and my claims about checkout cleanliness elsewhere in the report hold.
`ls -la` after the build showed the same four entries as canonical's stale copy
(`assets/`, `favicon.svg`, `index.html`, `shoelace/`) dated `Jul 29 03:56` —
built by the run, against canonical's `Jul 27 16:54`.

**A methodology error I caught in my own analysis, not in the runner:** my first
scan of this log reported "1 FAIL line" in a green run. It was my own
`grep -E '^(--- FAIL|FAIL|ok  ) '` *command text*, echoed into the log by the
step that runs it, matching my scanning grep. No test failed. Worth recording
because it is the same class of error as the one this whole task turned on:
**I read a log for a pattern and got back my own instrument.** The flake tally
of 2/7 is unaffected — that grep included the test name, which the echoed
command line does not contain.

---

## Local measurement — `go test ./...` in a pristine tree (13:28, authorised)

Written and saved BEFORE the command was run. Coordinator pre-registered both
readings in their instruction; this is mine.

Root: /workspace/farmtable-ci-22, web/dist ABSENT. Guard: GOWORK=off,
GOFLAGS=-mod=readonly, GOPROXY=off.

Prediction: **exit 1, 0 packages, non-empty stderr, the word `ok` ABSENT.**
Reason: `go test` resolves the package pattern through the same loader as
`go list`, and the embed failure occurs at load time, before any test binary is
planned. Confidence: high (~90%).

The 10% that would surprise me: `go test` is the verb that prints `ok` and
exits 0 over an empty set. If pattern expansion degrades to "no packages" rather
than aborting, this returns 0 and the gate has a blind spot. That outcome is
more important than the expected one and I would rather find it than not.
