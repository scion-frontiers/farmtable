# Brief — test-194-r7: independent TEST REVIEW of #194 round 7 (combined)

## Your working tree

**Your working tree is `/workspace`.** Confirm with `git rev-parse --show-toplevel`, then
verify BOTH branch and SHA:

- branch `label-write-scope-r7`, **HEAD `1d4442f1982b6e03233f1517106d0c369af1afe6`**
- base `6ced24e`

**Do NOT create any directory named in this brief.** If a path here does not exist, the
brief is wrong; tell me.

**[MEASURED by me, in a fourth repository]** `6ced24e`, `cc953e4` (leg A), `4df2d1e`
(leg B) and `15b7247` are all ancestors of `1d4442f`; negative control `633f8f2` is not.

**[MEASURED by me]** Surface excluding `.design/`: 16 files, **+1185 / −117**. The test
files carry most of it:

| file | +/− |
|---|---|
| `internal/server/authz_label_write_scope_test.go` | +342 / −2 |
| `internal/platform/github/resolver_test.go` | +187 / −0 |
| `internal/platform/github/stage_label_swap_scope_test.go` | +182 / −31 |
| `internal/platform/github/empty_stage_set_contract_test.go` | +77 / −19 |
| `internal/platform/github/lifecycle_stage_consumers_test.go` | +37 / −8 |
| `internal/store/lifecycle_stage_set_test.go` | +37 / −6 |
| `internal/server/authz_terminal_reopen_test.go` | +2 / −2 |

## Your job

Independent test review of the same SHA a code reviewer and a security auditor are working
in parallel. **You will not see their reports and they will not see yours.** Do not try to
cover their ground.

**The question is not "is coverage adequate." It is: which of these assertions can
actually fail, and what is the specific mutation that makes each one fail?** Mutation
testing is the method. Prior rounds on this workstream scored 105 and 10 mutations
respectively and both were worth it.

### A warning about the hypothesis in this brief

Last round I told a test leg "the danger is 1060 lines of tests that cannot fail." It
measured 103 of 105 mutations landing exactly as predicted — **my hypothesis was wrong**,
and its most useful sentence was: *"a leg that had spent its budget looking for inert tests
would have found F-1 and missed F-2 entirely."* The finding that mattered was not a dead
test; it was **the one guard nobody guards.**

So: do not assume these tests are inert. Look for **the assertion that everything else
depends on and nothing checks** — the single helper, the shared table, the one predicate
that gates a whole family of cases. Neuter *it* and see whether the suite notices. Last
round exactly that move found a function guarding eleven fixture tables with no positive
control of its own.

### 1. The shape already found here — sweep for more, do not re-find this one

The combine leg found one instance and I am giving it to you so you do not spend budget
rediscovering it. `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` is **vacuous**:
its fixture puts the issue in `ft:stage/wont_fix` and then asks `UpdateTask` to set the
stage to `wont_fix`. The label is already correct, so the swap computes an empty add and an
empty remove, and **zero GraphQL calls are made** (measured: `addCalls=0 removeCalls=0`).
The assertion "the stock `duplicate` label survived" cannot distinguish "correctly declined
to delete a third-party label" from "attempted no label write whatsoever." Its in-test
CONTROL does not rescue it: the control calls `fake.removeLabelByID(...)` **directly,
in-process**, proving the *fake* can drop a label rather than that the *production path*
can reach it. It is pre-existing round-6 work; **leg B did not write it and did not make
it worse.** A one-line `if fake.removeCalls == 0 { t.Fatal(...) }` closes it.

The combine leg explicitly did NOT do the sweep: *"I did not sweep all 150 package tests
for the bypass shape; there may be others."* **That sweep is yours.** The shape, stated
generally: *an assertion that observes an outcome by a path that bypasses the component
under test, so total failure of that component is indistinguishable from success.*

### 2. A scoped coverage-locality result to extend, with its positive control

**[MEASURED-BY-dev-194-combine-r7, not by me]**, on `writeLabelSwap` — the new shared
helper all ten previously-discarded label-write error sites now route through:

| mutation | failures in `internal/platform/github` |
|---|---|
| `add = nil` (add half dead) | **3** — this is the positive control: the harness *can* redden this function |
| `add, remove = nil, nil` | **3** — the same 3 |
| `remove = nil` (remove half dead) | **0** |

Widened to `go test ./...` with the removal path dead: **10 failures, all in
`internal/server`**, including leg A's own A-4 regression test. So the repo *does* pin the
removal path — the coverage simply lives two packages away from the code. **This is a
locality observation, not a live hole, and I do not want it reported as a hole.** What I
want: is that acceptable, or should `internal/platform/github` pin its own helper? If you
recommend a test, write it.

### 3. Can leg A's and leg B's new tests fail?

Score mutations against the seven test files above. Two specific things worth your time:

- `authz_label_write_scope_test.go` is +342 and pins the A-4 fix. **If A-4's control were
  reverted, how many of those 342 lines notice?** Predict before measuring.
- `resolver_test.go` is +187 and entirely new. The combine leg measured that exactly **one**
  of its three new top-level tests is sensitive to breaking `authorizationStage`. Is that
  the right number, and are the other two pinning anything?

### 4. An anchor hazard that will bite your harness — read before writing mutations

**[MEASURED-BY-dev-194-combine-r7]** Leg A's new package-level
`RestrictLabelWriteToSnapshot` in `internal/store/store.go` has the same
`x, ok := ...; if !ok { return ... }` shape as `LabelDeltaLifecycleStages`. **A content
anchor that was unique on the pre-merge tree is not unique here.** Anchor on the full body
including `current := []task.Stage{LifecycleStage(ctx, s, t)}`, and **abort if your anchor
is not unique** rather than mutating the first match.

`authorizationStage` is a **method**, `func (m *LabelMapper) authorizationStage`, defined at
`internal/platform/github/terminal_label_stages.go:46` — **not** in `labels.go`, which only
calls it and discusses it at length in comments. `grep 'func authorizationStage'` returns
nothing; that is a wrong pattern, not an absent function. I made exactly that mistake an
hour ago. Anyone anchoring on the comment text mutates a comment, measures nothing, and
scores a false GREEN that looks like a finding.

## Gates

`make web` first (0; `go build` genuinely fails without it — gitignored `web/dist`, ~4109
files, not a finding), then `go build ./...` (0), `go test ./...` (0; known `WatchTasks`
flake ~0.06% — re-run and say so, do not chase it), `make race` (0).
`go vet ./...` **exits 1** on **exactly 4** pre-existing `copylocks` findings in
`internal/server/server.go`. Not yours to fix.

## Known-open — already tracked, do not re-litigate the category

r8: the `SameStageSet` stage-collapse seam; the 12-cell custom-prefix label-WRITE matrix;
a seam tripwire that stops firing once r8 lands; an expired `Charge6_CustomPrefixEndToEnd`
blocker. Also: GitHub-backed tasks have no audit trail. **New instances are still findings.**

## Standing bars

- **Positive control before any negative claim.** A mutation harness that has only ever
  reported GREEN has not been shown capable of reporting RED.
- **Predict counts BEFORE measuring**, written to a file first, derived from a static read.
  A number read off the run and then presented as a prediction is a post-hoc tally, which
  is one of the catalogued defect forms here.
- **Mutations content-addressed, never line-addressed.** Revert every mutation and verify
  the revert by re-reading, not by trusting the write. Finish with `git status --porcelain`
  empty.
- **Any harness ABORTS on a failed prerequisite** — 0 tests parsed, 0 files scanned, a
  non-unique anchor, a RED baseline. Fourteen void harnesses on this workstream so far;
  every one printed a clean, confident, wrong number, and **the only thing that has ever
  caught one is a number contradicting something visible.**
- **Exit codes from the child process, never through a pipe.**
- **Quote every glob**: `--include='*.go'`. Unquoted under zsh, `grep` returns empty, exit 0.
- **Do not push. Do not modify production code** — your independence depends on it. Test
  files you may propose changes to; commit them on the branch only if they are additive
  and you say so plainly.

## Deliverables

1. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r7.md`: verdict, your
   mutation table with predicted-vs-actual for every scored mutation, the §1 sweep result,
   your answer to §2, **what you could not verify**, **your void runs disclosed in full**,
   and a **WHERE THIS BRIEF IS WRONG** section. Every leg for five rounds has found a real
   error in my brief, and last round the brief's central hypothesis was the error. Assume
   there is one.
2. Your prediction file, written **before** the corresponding measurement.
3. A project-log entry committed in `.design/project-log/`.

**You MUST write the report file, commit the project-log entry, and then mark the task
complete.**
