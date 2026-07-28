# #194 round 5 — independent test review

**Target:** `label-write-scope` @ `ea8ac39`. One of three parallel legs (code
review, security audit, test review); this is the test leg.

**Verdict: APPROVE WITH FINDINGS.** The three controls (B1, B5, B6) do what the
round-5 log says they do. No blocking defect. Two Medium coverage findings to
sequence before round 6 closes the prefix theme.

Full report: `reports/test-194-r5.md` (out of tree).

## The developer's mutation claims were confirmed

`MUT-B5` and `MUT-B6` were re-run independently with a content-addressed harness.
Both kill sets matched exactly, including the 6-of-12 figure in each of two tests
and the stock-label cell surviving. Seventeen valid mutations in total; all
killed except two, both traced to a single cause (below).

## Findings

- **T-1 (Medium)** — `LabelConfig.Stages` is still varied by **zero** tests, so
  round-4 F-3 is not closed, and B6 made that configuration load-bearing for
  authorization. Measured: a deployment configuring `shipped: completed` and
  applying `shipped` gets a task that **displays as `completed` but authorizes as
  available and claimable**. Distinct from the ruled-and-accepted stock-label
  cost — this is the operator's own alias being half-honoured. Worse, the log's
  remediation ("must now spell them with the prefix") applied to the config *key*
  yields a fully dead alias, because `buildLabelMapper` (`labels.go:144`) stores
  the key verbatim while `stripForMatch` (`labels.go:542`) strips the prefix
  before the lookup. The working spelling is a bare key with a prefixed label,
  and that cell has no coverage.

- **T-2 (Medium)** — `MultiStore` (`multistore.go:250`, `:263`) carries its own
  copies of the two `store.go` fallbacks and shadows them in the production
  object graph, so `store.go:133` and `:152` never execute in test. The logic is
  covered exactly once, in the copy that runs. Drift risk, not an untested
  control.

- **T-3 (Low)** — `TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose`
  never swaps: every cell only adds, so before={start}, after={start,dest}. A
  genuine single-request swap is unexpressed suite-wide. Naming/coverage only —
  real swaps verified correct by probe. The 6→12 count pin itself is sound and
  its stated regression signature was corroborated.

- **T-4 (Low)** — the `identity_test.go:250` nil-panic dismissal is right about
  causation, wrong about consequence. Natural reproduction failed in 500
  attempts; fault injection reproduced the exact signature and showed the panic
  aborts the test binary — **115 test results vs 215 clean, 100 tests silently
  never executed**. Any kill count measured on a panicking run is unreliable.
  The round-5 figures are unaffected (reproduced on non-panicking runs).

- **T-5 (Low)** — stale control-attribution comment at `reopen_test.go:272-275`
  after the inversion.

## Charges answered in the negative

- **Deletable-green tests: none.** Ablation with over-restriction mutations shows
  every control uniquely load-bearing. The two survivors are T-2.
- **REV9 has a live tripwire** — killed by exactly one test, itself. The round-4
  F-5 shape does not recur.
- **The B3 sweep is discriminating** — 9 of 13 subtests die when phase derivation
  breaks.
- **Both inversions preserved their cells**, verified at cell level rather than by
  name, and each added a control. "No test was deleted, and none has no
  successor" is accurate.

## Hygiene

All 19 mutation runs restored with `git status --porcelain` empty **and** sha256
verified against an out-of-repo pristine copy. No production code modified.
