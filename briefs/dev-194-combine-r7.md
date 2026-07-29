# Brief — dev-194-combine-r7: combine the two round-7 legs and measure the seam between them

## Your working tree

**Your working tree is `/workspace`.** Confirm with `git rev-parse --show-toplevel` and
`git worktree list`, and verify BOTH branch and SHA before anything else. **Do NOT create
any directory named in this brief.** If a path here does not exist, the brief is wrong —
tell me. (A leg last round that created a missing directory would have worked on the wrong
tree and reported false success. That was my error and this is the corrected form.)

You need three refs. All are fetchable; if any is missing from your tree, stop and tell me
rather than reconstructing anything:

| ref | SHA | what |
|---|---|---|
| base | `6ced24e` | round-6 tip, common ancestor of both legs |
| leg A | `cc953e4` (`label-write-scope-r7a`) | A-4 / M-1 / M-2, production authz |
| leg B | `4df2d1e` (`label-write-scope-r7b`) | T-F2/T-F3/T-F4/T-F5, test quality |

**[MEASURED by me]** `6ced24e` is an ancestor of both. Assert it yourself with
`git merge-base --is-ancestor` (exit 0) before using it as a diff base. Do **not** trust a
`git diff A B` between two tips without an ancestry assertion first — that mistake
fabricated a 68-line phantom deletion on this workstream.

## Why this is one agent and not a merge I did myself

**[MEASURED by me]** The two legs touch **zero files in common** — leg A 12 files, leg B 6
files, `comm -12` on the sorted name lists is empty. So the textual merge is trivial and
that is exactly the trap. **Zero file overlap is not semantic independence.** Leg A changed
production authorization; leg B rewrote the tests that pin it. Either can invalidate the
other's measurements without touching its files. The merge being clean tells you nothing
about whether it is correct — *"no conflicts" and "nothing was lost" are different claims,
and only the second matters.*

## Job 1 — combine, and prove the combine lost nothing

Merge both legs onto `6ced24e`. Then verify by **content**, not by process:

- Every changed file's blob in the combined tree is byte-identical to its blob in the leg
  that owns it. Both directions: the union of the two legs' changed-file sets equals the
  combined tree's changed-file set.
- Commit arithmetic: leg A contributes 5 commits, leg B its own; the combined history
  accounts for all of them.
- **Include a positive control**: compare one merged blob against its **base** blob and
  confirm your checker reports a MISMATCH. A blob-comparison harness that has only ever
  reported "identical" has not been shown to be able to report anything else.
- **Abort if your harness examines 0 files.** A clean zero from a checker that ran over
  nothing is the most common failure on this workstream — thirteen instances so far, every
  one printing a confident wrong number.

There is a script for this at `em-tooling/merge-verify.sh` in the shared scratchpad; use it,
adapt it, or write your own, but say which and report its positive-control result.

## Job 2 — RE-MEASURE M8's blast radius. This is the real work.

**[MEASURED-BY-dev-194-r7b, on leg B ALONE — not on the combined tree]** Leg B's mutation
M8 forces `authorizationStage` to return `("", false)`. On leg B alone: the target test went
**GREEN exit 0 → RED exit 1**, and the blast radius was **27 → 28 tests**.

Leg B disclosed the limit itself, and it is the reason you exist:

> *"The r7a interaction is unmeasured. If r7a alters `authorizationStage`'s callers or the
> transition table, M8's 28-test blast radius will change and should be re-measured after
> the merge."*

**Leg A did alter that neighbourhood.** It added a new store seam
(`SnapshotLabelWriteRestrictor`), routed it through `MultiStore`, changed
`NewPlatformResolver`'s signature, added a rejection path in `InsertTasksAfter`, and routed
all 10 previously-discarded label-write error sites through one returning helper.

Required:
1. **Predict the new blast radius BEFORE measuring it**, and write the prediction to a file
   in your report directory before you run anything. Derive it from a static read of the
   call graph, not from a trial run. Name your reasoning. A number read off the run and then
   presented as a prediction is a post-hoc tally, which is one of the catalogued defect
   forms here.
2. Then measure. Report predicted vs actual and **explain any difference** — the explanation
   is the finding, not the number.
3. If the radius went **down**, that is the alarming direction: it means leg A made some
   test stop depending on `authorizationStage`, and you must say which and why.
4. Re-run leg B's other mutations that touch code leg A changed. Leg B ran 10 mutations with
   10 confirmed predictions; you do not need all 10, but you must justify which you re-ran
   and which you did not.

## Job 3 — gates on the combined tree, from the child process

| gate | expected | notes |
|---|---|---|
| `go build ./...` | 0 | **[MEASURED]** fails on a fresh clone — `assets.go` embeds `all:web/dist`, which is gitignored. Run `make web` first (~4109 files). This is not a defect. |
| `go test ./...` | 0 | **[MEASURED]** there is a known `WatchTasks` flake at ~3/5000 = 0.06%. If you see it, re-run and say so; do not report it as a regression and do not chase it. |
| `make race` | 0 | leg A reported OK |
| `go vet ./...` | **exits 1** | **[MEASURED]** 4 pre-existing `copylocks` findings in `internal/server/server.go` (GetReadyTasks/GetBlockedTasks/GetCriticalPath/GetBottlenecks ephemeral request paths). Confirmed byte-identical pre-existing. **Verify the count is still exactly 4 and still those 4** — that is the usable signal, not the exit code. |

Leg A ran `go test ./...` four times at its own tip, exit 0 each time. If the combined tree
fails a gate that both legs passed separately, **that is a finding and the most valuable
thing you could produce.** Report it and stop rather than fixing it — I will route the fix.

## Job 4 — one thing to check that neither leg could

Leg A un-discarded 10 label-write errors and that immediately surfaced a hidden fixture
defect: both `internal/server` GraphQL mocks answered label mutations with
`{"clientMutationId":null}`, which the real mutations never select, so `githubv4` could not
unmarshal it. **Every label mutation in those two files had been failing at the client for
as long as they had existed** — invisible because the error went into `_`, and the tests
passed because the mutation still went over the wire and the mock applied it anyway. Leg A
confirmed this is a mock artifact, not a production bug, and fixed both mocks.

Check whether **leg B's** tests contain the same shape: an assertion that observes an
outcome by a path that bypasses the component under test, so total failure of that component
is indistinguishable from success. Leg B did not know about this defect when it wrote them.
Do not assume it is there; measure. If it is not, say so — that is a real result.

## Standing bars

- **Positive control before any negative claim.**
- **Any harness ABORTS on a failed prerequisite.** Never continue and print a green.
- **Exit codes from the child process, never through a pipe.**
- **Mutations content-addressed, never line-addressed; abort if the anchor is not unique.**
  Revert every mutation and verify the revert by re-reading, not by trusting the write.
- **Compare SHAs, never counts.** One preservation on this workstream produced the correct
  count (29) with the wrong commit; the tally passed and only SHA equality failed.
- **Do not push.** Commit locally. Pushing is mine alone.
- **Do not fix anything outside the merge itself.** If you find a defect, report it. Leg A
  routed four items to me instead of fixing them and that was the right call.

## Required deliverables — all four

1. The combined branch, committed locally. Name it `label-write-scope-r7`.
2. Your prediction file, written **before** the blast-radius measurement.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-combine-r7.md`:
   merge-verification results including the positive control, predicted vs actual blast
   radius with the explanation of any difference, all four gate results, the Job 4 answer,
   what you could not verify, your void runs, and a **WHERE THIS BRIEF IS WRONG** section.
   Every leg for the last four rounds has found a real error in my brief; assume there is
   one and look for it.
4. A project-log entry committed in `.design/project-log/`.

**You MUST write the report file, commit the project-log entry, and then mark the task
complete.** Do not stop after the analysis. Do not start the fresh three-way review — that
is mine to launch once your combine is verified.
