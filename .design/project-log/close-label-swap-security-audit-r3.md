# close-label-swap — Security Audit, Round 3

Date: 2026-07-28
Branch: `close-label-swap`
Reviewed head: `651da265783ce8cbfda5d902e2a3f640ef345529`
Range: `9f98ad8..651da26`
Leg: security audit
Verdict: **REQUEST CHANGES** — 2 High, 1 Medium, 2 Low, 2 Info

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r3.md`
PoC source: `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r3-poc.go`

## Headline

Round 3 restores the accept gate that round 2 silently downgraded, and it does so
through a genuine production object graph — the wiring criticism levelled at
round 2's audit leg does not apply here. But the restored control is **not
total**, and the code comments assert that it is.

`store.LifecycleStage` resolves, for a GitHub pass-through task, to
`LabelMapper.TerminalLabelStage`, which is implemented by reusing
`MapLabelsToStage` (`internal/platform/github/labels.go:448`).
`MapLabelsToStage` does not report which stages the labels name — it collapses
them to the single highest-precedence winner, and `stagePrecedence`
(`labels.go:13-24`) ranks **every non-terminal stage above every terminal one**.

So an issue carrying `ft:stage/wont_fix` *and* `ft:stage/accepted` resolves to
`accepted`. `TerminalLabelStage` returns `("", false)`, `LifecycleStage` falls
back to `t.Stage` — the F2-demoted value — and the seam yields precisely the
number it was built to avoid.

## Findings

- **[HIGH] F1 — authorization.** A token with `task:write` and deliberately no
  `task:accept` reopens a terminal-labelled issue once any non-terminal stage
  label is present. Verified by execution: **12 of 16 combinations bypass**;
  baseline (single label) denied in all 16, so the harness genuinely exercises
  the gate. The 4 non-bypassing cases are the `triage` mask, which is coincidence
  (`triage → anything` independently costs `task:accept`), not defence.
- **[HIGH] F2 — scheduling.** Same root cause via
  `passthrough.go:818`. An OPEN issue still carrying `ft:stage/wont_fix` is
  reported `Available=true Reasons=[]` once `ft:stage/accepted` is added.
  Baseline: `Available=false Reasons=[terminal]`. Requires no Farm Table token —
  GitHub triage rights suffice.
- **[MEDIUM] F3.** The comment at `passthrough.go:812-815` claims `ft ready`,
  MCP `task_ready` and the web dashboard all inherit the availability answer.
  Only the web dashboard does. `GetReadyTasks` diverts GitHub collections to the
  ephemeral route at `server.go:1505-1518` before `MultiStore` is consulted.
  Raised as comment inaccuracy, **not** as a vulnerability — the unwired
  ephemeral pool is #202 and is explicitly not the basis of any finding here.
- **[LOW] F4.** Stock-label collisions. The dev's narrow claim is **confirmed by
  execution**: `duplicate` is the only GitHub stock label that collides, and
  `wontfix` correctly does not match `wont_fix`. The broader exposure is separate
  and mine: prefix stripping makes *any* unprefixed stage-named label
  authoritative (`wont_fix`, `completed`, `cancelled` are not stock but are
  ordinary names a team may already use). Independent severity read: **Low** —
  the actor is already trusted, the effect is reversible, no privilege gain.
  Product decision, not a blocker.
- **[LOW] F5.** `convert.go:272` always sets `Availability`, so the web client's
  fallback is dead, and a `ComputeAvailability` error silently degrades to a
  stage-only answer rather than an absent field. Pre-existing; not round 3.
- **[INFO] F6.** The nil-receiver guard claim is **correct and load-bearing** —
  `MapLabelsToStage` panics on a nil mapper; `ComputeAvailability` is total on a
  zero-value store. Not production-reachable. Good catch by the dev.
- **[INFO] F7.** The 4 `go vet` copies-lock findings confirmed pre-existing and
  untouched (`server.go` has exactly one hunk in this range).

## Why the round-3 test suite cannot see F1/F2

`authz_terminal_reopen_test.go:65` — `"labels": {"nodes": [{"name": %q}]}` — takes
a single `string`, not a slice. All 24 subtests build exactly one label. The four
label-sets the suite ever constructs are singletons. **The defect and the test
share an assumption**, and it is foreclosed by the fixture's data shape rather
than considered and skipped.

The suite is otherwise sound: not vacuous, the positive control genuinely
distinguishes allow from deny, and the wiring is real. Its one structural gap is
that the subtest count is nowhere asserted — recommend a completeness guard.

## Method

All mutations applied **by content**, restored from `cp` backups outside the
repo, verified byte-identical against `git show HEAD:`, `git status --porcelain`
asserted empty after each restore. Exit codes captured on the line following a
redirect, never through a pipe. Every assertion written to fail closed — the
stock sweep carries a known-true control and the bypass PoCs carry a
deny-baseline, both of which held.

Recommended fix (scan for any terminal label independently of `stagePrecedence`)
was verified by execution: closes both High findings, breaks no existing test in
`internal/platform/github`, `internal/server` or `internal/store`.

## Not reached

- Brief item 5 — re-examination of the surviving `labelNameToID` RLock mutant's
  dominance invariant. Stated plainly rather than implied clear.
- Brief item 6 — the self-built-oracle hunt was completed for
  `authz_terminal_reopen_test.go` (clean; its oracle is the production error) but
  not swept across the ~300 other new test lines in `internal/platform/github`.
