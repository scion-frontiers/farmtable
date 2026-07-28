# #194 `close-label-swap` — test review, round 3

**SHA:** `651da26` · **Leg:** test review · **Verdict: REQUEST CHANGES**
(1 High, 1 Medium, 4 Low — all in test scaffolding; no production change requested)

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r3.md`

## What I was asked, and what I found

The brief was to spend the round on what green does not prove. Six questions, answered by
mutation rather than by reading:

| Question | Answer |
|---|---|
| Can the 310-line authz test pass vacuously? | **Partly — yes.** Emptying its table passes at rc=0 |
| Is the test's object graph the one `main.go` builds? | **Yes**, confirmed by execution |
| Is the scheduling trade-off pinned by a test? | **Yes**, both halves, killed by mutation |
| Is there a fifteenth self-built oracle? | **None found** |
| Is the tautological pin genuinely fixed? | **Yes** — MUT-T now dies |
| Is `make race` load-bearing? | **Yes**, reproduced independently |

## The fix is sound

I tried to break it and could not. Worth recording positively, because the previous two
rounds each broke something while fixing something:

- **Production reachability confirmed.** The round-2 audit proved a flaw against a faithful
  reassembly of an unwired path. That is not repeated. I probed the actual
  `github.NewPlatformResolver()` that `main.go:61` installs: it yields
  `*GitHubPassThroughStore`, which implements `store.LifecycleStager`, and un-demotes
  `accepted + ft:stage/wont_fix` to `wont_fix`. I specifically chased the one divergence that
  could have made the fix inert in production while the test passed — prod passes `cfg = nil`,
  the test passes `DefaultConfig()` — and `NewPassThroughStore` normalises nil to
  `DefaultConfig()`, so the mapper is identical.
- **The new seam is symmetric under config.** My main worry about `LifecycleStager` as shared
  infrastructure was a deployment with label mapping disabled keeping the demotion but losing
  the un-demotion, silently restoring round 2's privilege downgrade. It cannot: both sides go
  through `MapLabelsToStage`, which is gated by the same `enabled` flag.
- **Sink-bound across the layer boundary round 2 missed.** Breaking the `MultiStore`
  forwarding fails 26 tests; breaking `GitHubPassThroughStore.LifecycleStage` fails 34, in
  both `internal/platform/github` **and** `internal/server`.
- **The trade-off is pinned, not merely narrated.** Reverting the availability read kills 2
  tests; reverting the claim gate kills 6. The log's claim that "the cost is written into the
  test that pins it" is accurate.
- **The tautological pin is really fixed.** MUT-T — teach `buildIssueTree` the demotion — left
  the package green at round 2 and now fails all four subtests of the rewritten test.
- **`make race` earns its place.** Stripping the `repoID` synchronisation: `go test` rc=0
  green, `make race` red with a DATA RACE at `passthrough.go:115/116`.

## What blocks

**F1 (High) — the centrepiece authz test has no floor.** Emptying its 4-label table leaves
`TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen` reporting `--- PASS` at rc=0
in `0.00s` with zero subtests. This is the workstream's own named defect class living in the
test that is the blocking sink-binding for the round's central claim. The only count assertion
in 310 lines is per-fixture. Fix: assert `len(dests) * len(labels) == 20`, and the same on the
three sibling tables.

**F2 (Medium) — a second, undisclosed sink for the stock-label problem.** The shared context
discloses that GitHub's stock `duplicate` label can remove a task from the ready queue. Round 3
added an authz sink for the same root cause that is not disclosed and not tested: bare
`duplicate` now returns `PermissionDenied: missing required scope "task:accept"` for an agent
token, identically to `ft:stage/duplicate` (control label `bug`: allowed). Denial-of-work
requiring triage rights, so Medium not High. The actionable part is a coverage asymmetry — the
claim-gate table *does* include the bare label; the authz table does not. If the `ft:`-prefix
requirement lands from the product call, it must land in `TerminalLabelStage` to reach both
sinks.

Three Lows: the positive control passes with no terminal label present; the mock repo label
index is inert while its comment claims it is load-bearing; `TerminalLabelStage`'s nil guard
is total (confirmed, as the log claims) but fails *open* — unreachable in production.

## Method, including my own mistakes

Mutations addressed by content through an anchor-checked helper that aborts unless the anchor
matches exactly once; restores by `cp` from outside the repo; `git status --porcelain`
asserted empty after each. Tree verified byte-identical to `651da26` at start and finish.

I hit both traps the EM flagged, in my own tooling:

1. **A false KILLED.** My first harness passed the package list as one quoted argument, giving
   `rc=1 / [setup failed]`. Two mutations were briefly scored as killed on the exit code alone.
   Added a guard requiring at least one real `--- FAIL` line; re-ran; both were then genuinely
   killed — but the first result proved nothing.
2. **A false positive from my own probe.** My first stock-`duplicate` probe targeted
   `stage=working` and logged "DOES escalate" on any error. The error was `InvalidArgument:
   use ClaimTask` — a different gate. F2 rests on the corrected probe, which checks for
   `PermissionDenied` naming `task:accept` and carries a `bug` control that must be allowed.

One protocol deviation to record: I mutated `treewalk.go` for MUT-T without a `cp` backup and
restored via `git show 651da26:… > file`. Tree verified identical afterwards, but that is the
restore mode the standing bars forbid, and I should have backed the file up first.

## Not examined — needs an owner

**Shared-context item 4, the `taskToProto` / `availabilityComputer` wire seam, is unexamined by
me.** I did not verify the `availability` field reaches the web dashboard, `ft ready`, and MCP
`task_ready`, nor that the `web/src/utils/task-ready.ts` fallback is correct when the field is
absent. It spans a language boundary and is the largest gap in this round's coverage.

Also not examined: audit F7, the disclosed `labelNameToID` RLock mutant's dominance invariant.

## Environment note

`go test ./...` is rc=1 in a clean clone here — four packages `[setup failed]` on
`pattern all:web/dist: no matching files found`, **zero test failures**. Pre-existing, touches
nothing in this diff. The difference between the gate's quoted rc=0 and my rc=1 is only whether
`make web` has been run. All package-scoped runs green; `make race` rc=0.
