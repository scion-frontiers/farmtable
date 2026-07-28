# Label Write Scope R8 Test Review

Date: 2026-07-28
Reviewer role: Test Engineer (independent test review)
Branch: `label-write-scope-r8`
Workspace: `/workspace`
Reviewed HEAD: `158c8ae963faa5eef032e0857ecbc40d6a7c681a`
Brief: `/scion-volumes/scratchpad/projects/farmtable/briefs/test-194-r8.md`
Report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r8.md`

## Summary

Verdict: **REQUEST CHANGES**.

Axis reviewed was not "is the code correct?" but "if someone reverts this change
tomorrow, does the suite notice?". The round's mutation matrices were re-derived
rather than inherited, using real artefacts extracted with `git show` (never
retyped), under a harness that aborts on any failed prerequisite and verifies the
tree against a sha256 manifest before and after every run. 30 mutants, all
compiling, all restored cleanly.

Where the report's numbers are reproducible they are accurate: M-C1a reproduces at
3768/3768 and M-C1d at 0/8064, exactly as reported, and the item-8 round-7 vs
round-8 table reproduces in all four cells against the genuine `1d4442f` artefact.
All six `stageWritePolicy` call sites, both `req.Type` layers (plus a third call
site the report's matrix omits), `checkLifecycleKeyCollisions`, and
`LoadConfigWithSource` are RED-capable.

Blocking findings are about redundancy and about a control that cannot fail:

- **F-1 (HIGH)** C-1, this round's Critical, is pinned in exactly one file. Neuter
  the two oracles in `restrictProperties` and restore the round-7 implementation
  and `go test ./...` exits 0 with zero failing tests. Positive control from a
  different axis: the same neutering plus the pre-A-4 identity restrictor is still
  RED at `internal/server/authz_label_write_scope_test.go:2357` and `:2419`. A-4
  has a server-layer backstop; C-1 has none.
- **F-2 (HIGH)** `TestRestrictLabelWriteToSnapshot_PropertiesRejectTheIdentityRestrictor`
  never calls production code and hand-reimplements P2, so the test whose docblock
  says "if this test ever fails, P2 has stopped discriminating" stays green when
  P2 is disabled and when the A-4 class is unpinned. This is the §3 oracle rule
  broken inside the file that states it.

Non-blocking but measured, each with a killing test in the report:

- **F-3 (MEDIUM)** The report's "M6c cannot be killed / equivalent by construction"
  is false. `github.labels.enabled: false` separates the derived oracle from the
  hardcoded one; a nine-line test makes M6c RED. The compensating test
  `TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday` varies only
  `PushPrefix` over `DefaultConfig()`, so it carries the same "fixture cannot
  express the input" defect the report diagnosed one section earlier in M6e.
- **F-4 (MEDIUM)** `Validate` with `enabled: false` and an empty types key emits a
  fabricated error naming stage `cancelled`; with `enabled: true` the same config
  is accepted. Semantics inverted, unpinned.
- **F-5 (MEDIUM)** The snapshot-spelling removal path, which the report says
  "closes F-2 as a side effect", has zero coverage: reverting it leaves the suite
  green. Both property oracles normalise through `labelMatchKey`, so spelling is
  outside their discrimination range by construction.
- **F-6 (LOW)** The `removeKeys` safety belt is unreachable, and the report's claim
  that it is "covered by a named row" is false — no fixture in the round can build
  a snapshot with two entries sharing a match key.
- **F-7 (LOW)** `ConfigSource.Describe` is pinned as a function but never asserted
  to be logged; deleting the call in `cmd/farmtable-server/main.go:89` survives.
- **F-8 (LOW)** `stage_write_policy_test.go:33` references a test name that does
  not exist.

All five §5 expected-clean checks came back clean and are reported as such: no test
deleted, skipped, or weakened (one assertion removed, 105 added, and the removal is
replaced by a strictly stronger pair); no wall-clock or map-iteration-order
dependence introduced; no `t.Parallel` in the affected packages.

## Verification

- `go build ./...`: exit 0 (no `-buildvcs=false` needed; the earlier exit-1 finding
  was an artefact of a broken git object store and is withdrawn)
- `go test ./...`: exit 0, zero `^FAIL` lines, 10 `ok` packages
- `go vet ./...`: exit 1, exactly 4 pre-existing copylocks findings at
  `internal/server/server.go` 1782/1892/2100/2277, messages checked as text;
  post-experiment output `diff`-identical to baseline
- `gofmt -l` on touched dirs: only pre-existing `internal/server/scopes.go`
- `git fsck --connectivity-only`: exit 0 after the object store was repaired
- `git merge-base --is-ancestor 53edc46 HEAD`: exit 0; `53edc46..HEAD` is one
  docs-only commit, 232 lines in `.design/project-log/`
- 30 mutation runs logged at `/tmp/mut_*.log`; harness `/tmp/mut.py`
- Final state: `git status --porcelain` empty, `git diff --quiet` exit 0, no
  production file modified, all probe tests removed from the tree

## Deliverables

- Report at `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r8.md`
  with the APPROVE/REQUEST CHANGES verdict, a 30-row pinned/unpinned table for §4,
  own RED evidence with predictions recorded next to results, and severity ratings
  with `file:line`.
- This project log entry.
- An explicit brief-errors list in §5 of the report: one contradicted `[MEASURED]`
  claim (the `TestWatchTasks*` flake rate — 2 failures in 26 sequential full-suite
  runs here, not 0 in 12), two framing errors (§1 attributes M-C1b/M-C1c to a
  function that contains neither construct; §1's "confirm RED" bar silently passes
  over behaviours that have no pin at all), and one scope gap (§4 omits the three
  places the round is weakest). Four `[MEASURED]` baseline claims confirmed with
  own measurements.

## Residual Risks

- M-C1b and M-C1c are not reproducible from the report text; they are mutants of
  unspecified alternative implementations. The nearest shipped-code analogue gives
  the inverted P1/P2 pattern.
- The `TestWatchTasks*` flake is real in sequential runs at roughly 8% per
  full-suite run on this machine, so any single-run mutation row on this project
  carries about a 1-in-12 chance of a spurious RED. Two of my own rows are flagged
  inline for this.
- `internal/platform/github/config_source_test.go` uses `t.Setenv`, which is
  process-global; adding `t.Parallel` to any test in that package later would be a
  real race. No race today.
- Postgres-tagged integration tests were not run.
