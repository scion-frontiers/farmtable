# Close Label Swap #194 Test Review R2

Date: 2026-07-28
Reviewer role: Test Engineer
Branch: `close-label-swap`
Workspace: `/workspace/farmtable-audit-194`
Reviewed HEAD: `9f98ad8`
Tree: `d6883ce570ac55d774bd0b9ca3beea608a60967e`

## Summary

Round-2 test review of the audit-194 fix round, covering fixes to R1 test gaps 1-8
and surviving mutants (a)-(e), plus the three attack targets in the review brief.

Verdict: REQUEST CHANGES.

The test engineering itself holds up under independent re-execution and is approved.
The branch is returned on a single blocking finding: the F2 stage demotion changes an
input to an authorization decision, no test covers that consumer, and the impact
analysis that cleared F2 is wrong about the code path it names.

## Provenance

`/workspace` is not a git repository, so the literal gate command could not run. Resolved
by comparing clones instead: the audit clone and the dev clone
(`/workspace/farmtable-close-label-swap`) are both at `9f98ad8` with identical tree hashes.
All six scope items confirmed present in the committed blob, not merely the working tree.
No silent revert. All mutation work was confined to a `/tmp/mut` copy; the audit clone was
never mutated and ends clean.

## Verification

- Re-ran all 12 mutations from the report's §7 table with sha256-verified restore between
  each. Eleven rows reproduce exactly, including (c), (d), (e) confirmed SURVIVED -> DEAD.
  Row (e) records 6 tests / 10 subtests; actual is 6 / 8.
- F2 load-bearing: `R-F2` DEAD 4/8, `R-F2-BROAD` DEAD 3/10, `R-F2-CLOSED` DEAD 2/3.
- F1 state helpers pinned: `R-STATE-NEG` DEAD 2/5, `R-STATE-EXACT` DEAD 3/4.
- Claim gate: `R-CLAIM-ARM` DEAD 2/1, `R-CLAIM-FILTER` DEAD 1/0 (premise-pinning is real).
- Logging: `R-LOG` DEAD 1/4.
- Mutex §6 verified honest: `RACE-A` DEAD, `RACE-B` SURVIVED, `RACE-C` SURVIVED,
  `RACE-D` DEAD. Matches the report's own A/B isolation result exactly.
- `removeLabelByID` rewrite proven correct, not merely different: 200,000-case differential
  against the old aliased form, 0 divergences modulo unobservable nil-vs-empty slice.
- Fake fidelity: every `StageToLabel` output is a key in the fake's `labelIDs` (10 for 10
  stages); every terminal stage round-trips through a real `CloseTask`. The `states`-filter
  infidelity is confirmed by execution and is the sole coverage mechanism for the new
  `ClosedAt` claim arm.
- `labelNameToID` happens-before checked at all call sites individually: there are 15, not
  the 9 claimed, but every one is dominated by an `ensureLabelIndex` in the same function,
  so the argument holds.
- "Tests that disappear instead of failing": clean this round. No case list is filtered
  through the predicate under test; no suite counts its own subtests without asserting a
  total.
- `reopen_test.go:213-215` proven dead weight: `T-DEL-213` SURVIVED; with F2 reverted the
  delete variant and the keep control produce byte-identical failure sets (4/8).
- F2 authorization consumer: `TransitionScope("completed", X)` vs `("accepted", X)` differs
  for six of nine destinations; agent tokens are denied `task:accept` and allowed
  `task:write`, so the gate genuinely stops applying. Reverting F2 and running the whole
  tree produces four failures, all in `internal/platform/github` and none in
  `internal/server`.
- Production reachability confirmed: `cmd/farmtable-server/main.go:60-61` wires
  `MultiStore` + `github.NewPlatformResolver` with no feature flag.
- Ephemeral graph consumers confirmed latent: `WithEphemeralPool` is called only from
  `internal/testutil` and `internal/server/graph_routing_test.go`.
- Suite green after every mutation (`post-restore rc=0`); `labels.go` restored byte-identical.
- Pre-existing and out of scope: `internal/cli` and `cmd/ft` fail setup on
  `pattern all:web/dist: no matching files found`, identically in the untouched clone.

## Findings

- F-1 Blocking: F2 changes the scope required to reopen a task via
  `FarmTableService.UpdateTask` (`internal/server/server.go:496,537`); no test binds F2 to
  that consumer, and impact check (1) confuses the pass-through `UpdateTask` (a producer)
  with the server's (a consumer).
- F-2 Medium: the "fail-safe" characterisation of the tree-walk divergence
  (`internal/platform/github/treewalk.go:35`) contradicts the branch's own threat model,
  which names this direction denial-of-work.
- F-3 Medium: `treewalk_test.go:35-55` (#191) asserts the opposite proposition to F2.
- F-4 Low: `reopen_test.go:213-215` can never fire.
- F-5 Low: the self-deleting pinning test should be split from its store-path assertions.
- F-6 Low: §7 row (e) over-counts by two subtests.
- F-7 Low: §6 undercounts `labelNameToID` call sites (9 stated, 15 actual).
- F-8 Low: the `ClosedAt` arm is covered only via deliberate fake infidelity.
- F-9 Low: `concurrency_test.go:79,83,114` bypass the accessors this change added;
  `t.Fatalf` is called from HTTP handler goroutines.
- F-10 Info: test inputs rebuild stage labels by string concatenation rather than
  `StageToLabel`.

## Deliverables

- `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r2.md`
- This log entry.

## Notes

The F2 fix survives review. The F2 impact analysis does not; any external disclosure
resting on "no legitimate workflow is affected" should be amended or voided, while one
resting only on the reality of the original bug and the correctness of the fix stands.
