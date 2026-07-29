# #194 `close-label-swap` — round-3 review, SHARED CONTEXT

Read this first. Your role-specific instructions are in your dispatch message.

## What you are reviewing

Branch `close-label-swap`, **head `651da26`**. Review in **your own clone**, which
I have pre-synced. `git rev-parse --short HEAD` must print `651da26`. If it prints
anything else, message `farmtable-em-task-state-model-v2` and stop.

> **`/workspace` is NOT a git repository** — it is the parent of ~35 clones.
> Never run the gate there. The branch name is not an identifier here; the SHA is.

Range that matters: **`9f98ad8..651da26`** (4 commits).

```
651da26 Log the #194 round-3 authorization and scheduling fixes
32f4b01 Add a race make target and read the caches through their accessors
4ea2fc8 Reconcile the tree-walk and pass-through comments with F2
d768d0d Keep the F2 stage demotion out of authorization and scheduling
```

The dev's own account is `.design/project-log/close-label-swap-authz-and-scheduling.md`.
It is unusually candid and worth reading — but it is the thing under review, not
evidence.

## Why round 2 failed the gate

**Both** legs returned REQUEST CHANGES and converged on the same defect: round 2's
own F2 fix (`0b87721`) silently downgraded authorization. `IssueToPhaseStage`
demoted a terminal label on an OPEN issue to `accepted`; `FarmTableService.UpdateTask`
computes required scope from that same field; so a token holding `task:write` but
deliberately **not** `task:accept` could reopen a `wont_fix` / `duplicate` /
`cancelled` / `completed` issue. The accept gate is exactly the control meant to
stop that.

**Note carefully: the reviewers converged on the verdict and disagreed on the
facts.** The audit named the ephemeral path as the vector; that path is unwired in
`main.go` and errors out. The test leg had the mechanism right but called the live
web vector "cosmetic." Neither was correct as written; I resolved it by measuring.
Do not assume your co-reviewer's report is right merely because it agrees with you.

There was a second, **opposite-direction** consequence: `from == to` re-stamping
became *stricter*, demanding `task:close` where it used to be an ordinary write.
The coordinator ruled explicitly that both directions must be restored — *"don't
let 'it happened to get stricter this time' pass without the same scrutiny as
'it happened to get looser.'"*

## Gate status — I ran all of this myself at `651da26`

```
go build ./...                     rc=0
go test ./...                      rc=0, 0 failures
make race                          rc=0
revert the authz fix -> go test ./internal/server/...
                                   rc=1, 24 subtest failures, 2 top-level:
                                     TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen
                                     TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite
```

That last one matters: at round 2, reverting F2 failed **zero** tests in
`internal/server`, which is where the consequence lived. That was a *sink-binding*
gap. It now fails 24, in both directions. **Do not spend your round
re-establishing that the suite is green.** Spend it on what green does not prove.

Diff scope: authz seam (`store/store.go`, `store/multistore.go`,
`platform/github/labels.go`, `passthrough.go`), `server/server.go`, tests,
`Makefile`, project log.

## SEVEN THINGS I SPECIFICALLY WANT SCRUTINISED

### 1. The fix touches SHARED INFRASTRUCTURE. Round 2's fix broke authz; assume round 3's did too.
`store.LifecycleStager` is a **new optional-capability interface** in
`internal/store/store.go`, with a free function `store.LifecycleStage` that
type-asserts and falls back to `t.Stage`, plus `MultiStore` forwarding. That is
shared infrastructure on a branch whose last round introduced a privilege
downgrade through exactly this kind of "small" change.

Ask: does the new seam change behaviour for **any other caller or store
implementation**? What happens when the type assertion fails — is the fallback
always correct, or does it silently restore the buggy path for some store? Is
`TerminalLabelStage`'s nil-receiver guard sufficient to keep `ComputeAvailability`
total on a zero-value store, as the log claims? Prove it.

### 2. Reconstruction is not reachability — audit this test's wiring specifically.
`internal/server/authz_terminal_reopen_test.go` is 310 new lines that claim to
wire *the production object graph* (EntStore → MultiStore → PlatformResolver →
FarmTableService). **That claim is the whole value of the test.** This exact
defect class bit `audit-194-r2` last round: it proved a flaw by composing the real
functions in the order production *would* call them, rated it High, and the path
turned out to be unwired.

Verify the graph the test builds is the graph `cmd/farmtable-server/main.go`
actually builds. If it diverges, the 24 failures prove something about a
reassembly, not about production.

### 3. Can the new authz test pass VACUOUSLY?
310 lines of wiring is a lot of surface for a test that succeeds for the wrong
reason. If the object graph silently fails to wire, or the mock issue never gets
its terminal label, or the subtest table is empty — do the subtests still report
pass? **The defect class is "tests that disappear instead of failing."** Check the
table is pinned (4 labels × 5 destinations + controls = a number that is asserted,
not merely produced) and that the positive control holding `task:accept` genuinely
distinguishes allow from deny.

### 4. The scheduling change moved availability server-side. Check the seam.
`taskToProto` now type-asserts `availabilityComputer` and puts the result on the
proto; `web/src/utils/task-ready.ts` defers to that field **when present** and
falls back otherwise. Two questions: does the field actually arrive over the wire
for the web dashboard, `ft ready`, and the MCP `task_ready` tool (the log claims
all three inherit it)? And is the **fallback** path still correct when
`availability` is absent — that is the path that runs against any server that
does not set it.

### 5. The stated trade-off must be pinned by a test, not just by prose.
Round 3 deliberately chose the *scheduling-conservative* reading: a genuinely
reopened issue now needs its stale label cleared before it can be claimed. The log
says "the cost is written into the test that pins it." **Verify that test exists
and actually fails if the behaviour reverts.**

### 6. Hunt the fifteenth self-built oracle in the new code.
Thirteen removed on this workstream, a fourteenth rejected, none found on four
branches. ~600 new lines of test code this round. Hunt again. A test asserting
against a local re-implementation of a real exported symbol is the pattern.

### 7. The `duplicate` stock-label consequence — assess severity.
The dev reports, and did not fix: GitHub's **stock** `duplicate` label carries no
`ft:` prefix, but the mapper strips prefixes before matching, so it maps to
`StageDuplicate`. Escalation is now closed, but the *opposite* direction is live —
**anyone with GitHub triage rights can remove a task from the ready queue by
applying a stock label.** Requiring the `ft:` prefix would close it but is
user-visible. I want an independent severity read on this; I am routing the
product decision separately.

## Known, disclosed, and NOT to be re-litigated

- **#203** — splitting `IssueToPhaseStage` into display vs authoritative stages is
  the real fix for this whole family. Architect-scoped, deliberately out of round
  3. `LifecycleStager` is a seam, not the split. You may comment on whether the
  seam is safe; do not ask for the split here.
- **#202 — the ephemeral pool is unwired.** `main.go` builds `NewMultiStore` +
  `SetResolver` + `NewFarmTableService` with **no** pool. I verified this myself.
  The audit's round-2 High rested on this path; it is not reachable.
- **`go vet ./...` reports 4 `copies lock value`** findings in the ephemeral
  handlers. The dev verified these are **pre-existing at `9f98ad8`** and untouched
  by this diff. Confirm if cheap; do not scope-creep.
- **audit F7** (`UpdateTask` relabels to terminal without closing) — untouched, as
  in round 2. Worth a ticket, not a blocker.
- **The disclosed surviving mutant** (dropping the `RLock` in `labelNameToID`
  while keeping the double-check) is accepted, explained by a dominance invariant.
  You may re-examine the invariant; do not treat its survival as a new finding.
- **Round 2's F2 impact analysis is VOID.** Its "no legitimate workflow is
  affected" rested on inspecting `GitHubPassThroughStore.UpdateTask` (the
  producer) while the consumer F2 actually broke was `FarmTableService.UpdateTask`
  one layer up. Do not carry it forward.

## Standing bars on this workstream

1. **Mutation testing is the bar.** "Verified" without pasted actual failing
   output is not evidence. Apply it to your own findings: if you assert something
   is or is not covered, prove it by breaking it.
2. **Address mutations by CONTENT, never by line number.** A line-addressed `sed`
   on a shifted file manufactures a false SURVIVED that looks exactly like a real
   finding. This has bitten this workstream.
3. **Restore from `cp` backups outside the repo, never `git checkout`** — it
   cannot distinguish your mutation from an uncommitted fix. Assert
   `git status --porcelain` empty after each restore.
4. **Do not read an exit code through a pipe.** `go test ./... | tail -3; echo $?`
   reports **tail's** status, always 0. I made this exact mistake tonight.
   Redirect to a file, capture `$?` on the next line, then read the file.
5. **Assertions must fail closed.** Also mine, from tonight: a comparison where
   both sides are empty silently *passes*. A false negative announces itself; a
   false positive does not. Check your own tooling.
6. **Distinguish what you verified BY EXECUTION from what you REASONED about.**
7. **Do not self-review.** Do not ratify a fix because it cites a finding number.

## Sequencing

The `code-reviewer` template is blocked by a broker cache fault (diagnosed, with
ptone). The code-review leg runs **later, at this same SHA `651da26`**. The gate
still requires **all three** approvals and is **not** being reduced to two.
Review as though the third report will contradict yours.

## Rules

- **Do not push.** Do not modify production code — your independence depends on
  it. If you commit anything, commit only your own project log entry.
- **Write a project log entry in `.design/project-log/`.** Required deliverable.
- Severity + `file:line` + a concrete recommendation on every finding.
- Clear verdict: **APPROVE** or **REQUEST CHANGES**.
- If you find something **Critical or High**, say so immediately and prominently.
