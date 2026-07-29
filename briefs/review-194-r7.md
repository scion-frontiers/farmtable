# Brief — review-194-r7: independent CODE REVIEW of #194 round 7 (combined)

## Your working tree

**Your working tree is `/workspace`.** Confirm with `git rev-parse --show-toplevel`, then
verify BOTH branch and SHA before anything else:

- branch `label-write-scope-r7`, **HEAD `1d4442f1982b6e03233f1517106d0c369af1afe6`**
- base `6ced24e` — the round-6 tip

**Do NOT create any directory named in this brief.** If a path here does not exist, the
brief is wrong; tell me. (A leg two rounds ago created a missing directory, worked on the
wrong tree, and reported false success. That was my error; this is the corrected form.)

**[MEASURED by me, in a fourth repository neither you nor the dev legs can write to]**
`6ced24e`, `cc953e4` (leg A tip), `4df2d1e` (leg B tip) and `15b7247` (the verified merge
point) are ALL ancestors of `1d4442f`. Negative control: `633f8f2` is not. You may use
`git diff 6ced24e 1d4442f` as a range safely — but assert the ancestry yourself first.
On this workstream a `git diff` between two *divergent* tips once fabricated a 68-line
phantom deletion that took an hour to disbelieve.

**[MEASURED by me]** Review surface excluding `.design/`: **16 files, +1185 / −117.**
The three `.design/project-log/*.md` files are out of scope.

## What this round is

Round 7 of #194. Two dev legs, then a third agent combined them:

- **leg A** (`cc953e4`, 5 commits) — production authorization. Three items: **A-4** (a
  free, retryable label-destruction primitive: a caller holding `task:write` could destroy
  a lifecycle label the authorization gate never priced), **M-1** (the server binary was
  discarding the operator's GitHub label config), **M-2** (`InsertTasksAfter` ungated).
- **leg B** (`4df2d1e`, 2 commits) — test quality. Four assertions that could not fail.
- **combine** (`1d4442f`) — merge + project log only. `git diff --name-only 15b7247
  1d4442f -- ':!.design'` is empty: **no code changed after the merge was verified.**

## Your job

Independent code review: correctness, readability, architecture, performance. **A
security auditor and a test engineer are reviewing the same SHA in parallel. You will not
see their work and they will not see yours — that is deliberate.** Do not try to cover
their ground; cover yours properly. Three times in the last four rounds a third leg has
dissolved a question the other two were about to split on, and that only works if the
legs are actually independent.

Things I specifically want your judgement on — **as questions, not as conclusions**:

1. **The A-4 seam.** Leg A introduced a new store-layer interface,
   `SnapshotLabelWriteRestrictor` (`internal/store/store.go`), routed through `MultiStore`
   the same way the two existing `LifecycleStageSetStager` methods are routed, implemented
   by `GitHubPassThroughStore`, called from `UpdateTask`. Is a store interface the right
   home for this? Leg A's stated reason for the interface rather than a shared helper: the
   GitHub side must match labels case-insensitively (`labelMatchKey`, lowercase+trim, to
   agree with `applyLabelDelta`) while the Ent store's `mergeLabels` is exact-string, so a
   single shared implementation would be *wrong for one of the two stores*. Evaluate that
   reasoning. If you disagree, say what you would have done instead and what it costs.

2. **Ten un-discarded errors.** Leg A found 10 sites that were dropping label-write errors
   into `_` and routed all of them through one returning helper, `writeLabelSwap`. Errors
   that were previously invisible are now propagated. **Does any caller now fail where it
   previously succeeded, in a way a user would experience as a regression?** This is the
   change in this diff most likely to have an unintended behavioural consequence, and it
   is the reason it is item 2 rather than item 6.

3. **`NewPlatformResolver`'s signature changed** and `cmd/farmtable-server/main.go` gained
   22 lines wiring the operator config through (M-1). Check the wiring end to end. M-1 is
   the item with live production consequences, so a plausible-looking-but-wrong wiring here
   is the highest-cost defect in the diff.

4. **`internal/platform/github/config.go` (+11) and `internal/cli/connect.go` (+1/−1)** are
   the two smallest changes and nobody has said anything about either. Small diffs in this
   codebase have twice been the ones that mattered.

## Two things I have already ruled on — overturn me if I am wrong

- **The `27 top-level tests` comments are NOT stale.** `labels.go:367` and
  `stage_label_swap_scope_test.go:158` each state "breaking `authorizationStage` … turned
  27 top-level tests in this package RED". The same mutation on THIS tree reddens **29**.
  I checked, and both sentences are explicitly scoped to *the deleted previous version of
  the test* ("WHAT THE PREVIOUS VERSION DID"), so 27 is correct history, not a stale
  current claim. I nearly filed this as a finding off the grep hit alone and only avoided
  it by reading the paragraph. **My residual concern, which is Low and which you may
  disagree with: a bare `27` with no "measured at 6ced24e" anchor will read as current to
  someone in three months.** If you think that is not worth a line of text, say so.
- **`go vet ./...` exits 1.** **[MEASURED]** 4 pre-existing `copylocks` findings in
  `internal/server/server.go` (`GetReadyTasks` / `GetBlockedTasks` / `GetCriticalPath` /
  `GetBottlenecks`, all "assignment copies lock value to ephReq"). Not introduced here.
  Verify the count is **still exactly 4 and still those four RPCs** — that is the usable
  signal, not the exit code. Their line numbers moved by a uniform +73; ignore line numbers.

## Gates — run them, exit codes from the child process

| gate | expected |
|---|---|
| `make web` | 0 — **required first.** `go build` DOES fail on a fresh clone: `assets.go` embeds `all:web/dist`, which is gitignored. ~4109 files. This is not a defect and is not a finding. |
| `go build ./...` | 0 |
| `go test ./...` | 0. **[MEASURED]** known `WatchTasks` flake at ~3/5000 = 0.06%. If you hit it, re-run and say so; do not report it as a regression and do not chase it. |
| `make race` | 0 (covers `internal/platform/github` only, by Makefile design) |

## Known-open — do NOT re-litigate these, they are already tracked

Round 8 items, already scoped and assigned: the `SameStageSet` stage-collapse seam; the
12-cell custom-prefix label-WRITE matrix; a seam tripwire that will stop firing when r8
lands; an expired `Charge6_CustomPrefixEndToEnd` blocker. Also tracked: GitHub-backed
tasks have no audit trail; keying `duplicate` off the native close `state_reason` rather
than labels; enumerating schedulers rather than only authorization gates. **If you find a
NEW instance of any of these, report it — I want the instance, not the category.**

## Standing bars

- **Positive control before any negative claim.** A detector that has never reported a
  problem cannot support "no problems."
- **Any harness ABORTS on a failed prerequisite.** Never continue and print a green.
  Fourteen void harnesses have been produced on this workstream, by agents and by me. Every
  one printed a clean, confident, wrong number.
- **Quote every glob**: `--include='*.go'`. Unquoted, zsh expands it and `grep` returns
  empty with exit 0. That cost me an hour last night.
- **Compare SHAs, never counts.**
- **Do not push.** Do not modify production code — your independence depends on it.

## Deliverables

1. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r7.md` with: a clear
   **APPROVE** or **REQUEST CHANGES** verdict; findings separated into Required /
   Important / Nice-to-have with `file:line` references and recommended fixes; all gate
   results; **what you could not verify**; **your void runs, disclosed**; and a
   **WHERE THIS BRIEF IS WRONG** section. Every leg for the last five rounds has found a
   real error in my brief. Assume there is one and look for it — that section has twice
   been the most valuable part of the report.
2. A project-log entry committed in `.design/project-log/`.

**You MUST write the report file, commit the project-log entry, and then mark the task
complete.** Do not stop after the analysis.
