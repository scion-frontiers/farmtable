# Label Write Scope R9 Test Review

Date: 2026-07-28
Reviewer role: Test Engineer
Branch: `label-write-scope-r9`
Workspace: `/workspace`
Reviewed HEAD: `06f01d7d6555a311fcd0728eac40335e654c1de6`
Review axis: *can this evidence fail?*

## Summary

Independent test-engineering leg (1 of 3; code-review and security-audit ran in parallel on the same
commit without visibility into each other's findings). Round 9 is +1663/-97 across 12 files and roughly
90% test code, so the round is essentially a claim about evidence quality. This review mutated the
evidence to find out whether the claim holds.

Verdict: REQUEST CHANGES — on two Medium findings, both cheap to fix and neither touching production
behaviour. The round is otherwise the strongest evidence work in the #194 sequence: 18 of 19 mutants
killed, the MUST 2 remedy verified as a clean permutation matrix, MUST 1's pin confirmed as a real pin,
and MUST 4's property confirmed genuine against 200,000 out-of-fixture triples.

## Verification

Gate reconstructed rather than accepted from the brief, per the standing "handed vs built" warning.

- `go build ./...`: exit 0
- `go vet ./...`: exit 1, 4 pre-existing copylocks matched **by message** (`assignment copies lock value
  to ephReq` at `internal/server/server.go:{1782,1892,2100,2277}`), out of scope
- `go test ./internal/platform/github/`: exit 0, 619 subtests
- `go test ./internal/server/ -skip 'TestWatchTasks'`: exit 0, 894 subtests
- `go test ./cmd/farmtable-server/`: exit 0
- `git status --porcelain` empty and `git diff HEAD` empty at end of session; HEAD unchanged

Flake containment: server cells constrained with `-skip 'TestWatchTasks'`, verified against a `-v`
baseline that excluded tests match zero lines in the selected set. A tripwire grepped every RED for
`TestWatchTasks`. **The tripwire never fired in any cell.** All reverts were snapshot restores from
`/tmp/r9/snap/`, never `git checkout`; exit codes taken from the child process, never through a pipe.

## Findings

- **F1 (Medium)** — MUST 4's in-source proof names a mutant that does not produce its documented result.
  The comment says a drift dropping "labels whose name is not already trimmed" makes P4 fail on 128 of
  16384. Measured: that literal reading leaves P4 **silent** and the belt-present/belt-deleted states
  **indistinguishable**, because the sweep's `snapVocab` contains no padded entry. The documented 128/16384
  reproduces exactly under a **case-only** drift (`l != strings.ToLower(l)`); a case+pad drift gives 256.
  The claim is true in structure — the belt is load-bearing and P4 is the discriminating property — but an
  engineer following the written instruction would see silence and delete the belt, which is the outcome
  MUST 4 was written to prevent.
- **F2 (Medium)** — both new MUST 1 server tables (`absent`, `spellings` in
  `internal/server/authz_label_write_scope_test.go`) are vacuous when emptied: exit 0, GREEN. The round's
  headline test asset cannot report its own disappearance.
- **F3 (Low)** — 12 of 17 added/modified loops are unguarded against vacuity (census below).
- **F4 (Low)** — two of three empty-key rows do not pin the empty-key guard; with `enabled` forced true via
  `asIfEnabled`, only a `stages`-table empty key reaches `owned`.

## Verified claims (attempted and failed to break)

- MUST 2 remedy: perfect 5x5 permutation matrix under two independent mutation styles (delete the case
  clause; empty its body). Exactly one named restrictor RED per arm, no overlap, no collateral movement.
  `p2Violations` confirmed to have one definition and two call sites.
- MUST 1: `C1_unwire_perlist_filters` turns the **new** cross-list-cancel test RED with the server package
  run on its own — a real pin, not coverage locality.
- MUST 4 property: 200,000 random triples over unicode/emoji/300-char/mixed-padding alphabets far outside
  the fixture vocabulary produced 47,177 duplicate-key snapshots, 27,316 real drops and **0 violations**;
  P1..P4 all silent. Not a fixture restatement; taxonomy form (7) does not apply.
- MUST 5: deleting the `!m.enabled` guard turns exactly one test RED, matching the in-source claim verbatim.
- Green control: the new which-stage assertion is discriminating (RED naming `ft:stage/wont_fix`), the
  retained 200-run half correctly did **not** fire, and it is honestly labelled in-source as a control.
- Over-strictness: 290 tests fail across two packages under maximal-narrowing mutants, including explicit
  positive controls. A wrongly-denied legitimate `task:close` holder would be caught loudly.

## Vacuity census

5 guarded / 17 total. Per file: `restrict_label_write_property_test.go` 2/5;
`all_stages_test.go` 2/4; `lifecycle_key_collision_test.go` 1/5; `terminal_label_stages_test.go` 0/1;
`authz_label_write_scope_test.go` 0/2; `cmd/farmtable-server/main_test.go` 0/0 (no loops).
Noted once repo-wide, not per table: Go reports a zero-subtest table as PASS by design, so these are
instances of one convention issue rather than seventeen authoring mistakes.

## Method notes against myself

- Three cells showed a dirty tree after restore. Root cause was **my** harness omitting
  `terminal_label_stages_test.go` from its restore list, not repo behaviour. Detected via
  `git status --porcelain`, repaired from the tar snapshot. Measured results for those cells are unaffected;
  only the cleanliness bookkeeping was.
- One census cell (`AS1`) initially read RED but was a **build failure** (unused `pb` import after
  emptying the range). Redone preserving `_ = pb.TaskStage_name`; genuine RED confirmed. Counting a build
  failure as a kill is a false positive that flatters the code under review — future mutation harnesses in
  this repo should treat `buildfail` as an outcome distinct from RED.
- One banner mutant initially failed to compile for the same class of reason (unused `src`) and was redone.

## Deliverables

- Report written to `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r9.md`, containing the
  verdict, numbered severity-classified findings, the full arm x restrictor matrix, the vacuity census with
  per-file denominators, the mutation table with predictions stated before measurement (18/19 killed,
  17/18 predictions correct, 1 miss), and the list of brief errors.
- The single prediction miss (MUST 4) was chased and became F1, the sharpest finding of the round.

## Residual Risks

- Postgres-tagged integration tests were not run in this review.
- `TestWatchTasks*` remains flaky; the baseline's flat "exit 0" claim for `go test ./...` is probabilistic.
  My first full-suite run failed on it and the second passed. Any single-run gate result in this repo
  should be treated as provisional unless containment is applied.
- F1's remedy needs verification by someone other than its author — the failure mode was a description
  only its author could follow.
- Vacuity guards added for F2/F3 should themselves be checked for non-vacuity.
- The `enabled=false` write-authorization finding is already ruled into r10; per brief scope I designed no
  fix for it and my mutation work did not sharpen it beyond what is already recorded.
