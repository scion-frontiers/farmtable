# #194 round 6, leg B — `internal/server` and `internal/store`

Branch `label-write-scope-r6b`, based on `ea8ac39`. Six commits: `ca39dff`,
`a2cced0`, `1a73f3b`, `644eed9`, `b2d4e75`, `b523e6b`. Not pushed.

Leg A owned `internal/platform/github/` in a separate clone. This leg never
edited that directory.

---

## The seam, written as a mechanism

**This is the most transferable thing in this round, and it will not survive in
the commit messages.** It is a live defect, adjudicated to r7, pinned by
`TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday`.

### What happens

1. `terminal_label_stages.go:120` resolves a label list into a stage set:
   `present := make(map[task.Stage]bool)`. The map is **keyed by stage**. Two
   distinct labels that resolve to the same stage collapse to one element, and
   the mapper has now discarded which label produced it.
2. `server.go` gates label writes with
   `if !store.SameStageSet(before, after) { ...charge every (from, to) pair... }`.
3. Remove one of two labels naming the same stage. The set before is `{X}`. The
   set after is `{X}`. `SameStageSet` is true.
4. The gate short-circuits. Nothing is charged. The label is destroyed on a bare
   `task:write` token.
5. The task is still terminal and still unavailable, so no reader can tell it
   happened. An audit trail loses a label and nothing observable moves.

### It is reachable on stock defaults

I went looking for a custom `cfg.Stages` alias to construct two-labels-one-stage
and did not need one. `stripForMatch` (`labels.go:542`) strips the push prefix
and *then* strips a leading `stage/`, so `ft:stage/completed` and `ft:completed`
both key to `"completed"`. Both clear the prefix gate in `authorizationStage`.
Anyone who can write labels can build this input.

### Fixing it needs both halves at once

Deleting the `SameStageSet` short-circuit is **not sufficient**: the stager is
structurally incapable of reporting the change, because it has already thrown
away the label identity. A correct fix needs a delta over **labels**, not over
resolved stages — a contract change spanning `internal/server` and
`internal/platform/github`.

### Why neither leg could have found it alone

This is the part worth recording.

- **Leg B had the gate and not the mapper.** I could see the short-circuit and
  reason that "equal sets means free write," but not that distinct labels could
  produce equal sets.
- **Leg A had the mapper and not the gate.** They could see the collapse but had
  no reason to care: a mapper is *supposed* to map many labels onto few stages.
- **Leg A's four-case walk was correct reasoning that could not reach it.** They
  answered "complementary, no seam" from a walk whose implicit premise was
  one-label-per-stage. That premise held in all four cases they tried. It is not
  a property of the mechanism — **their fixture could not build
  two-labels-one-stage**, so the counterexample was not among the cases
  available to be walked.

This is the **eighth instance** of the fixture-cannot-express-the-input class on
this branch, and the first that lived in the **boundary between two domains**
rather than inside either one.

### The structural lesson

A defect that requires both halves at once is invisible to any review structure
that **partitions by domain and only checks the union after merge**. Each leg
certifies its own half correctly. The union of two correct certifications is not
a certification of the whole. Splitting work by directory is efficient and it
systematically cannot see this defect class; something has to look across the
boundary on purpose, on the combined tree, with a fixture able to build inputs
neither domain owns.

---

## What was fixed

| Item | Result |
|---|---|
| **B3** — `identity_test.go:250` panic | Fixed. Five tests discarded `store.CreateUser` errors then dereferenced the returned `*ent.User`. |
| **B2** — unreachable duplicate fallbacks | Collapsed. `store.go:133/:152` were duplicates of `multistore.go:250/:263`; one copy of the rule remains, with tripwire tests rather than a comment. |
| **B4** — `LabelDeltaLifecycleStages` fail-open | Fail-closed. An empty stage set from either side is now `ErrEmptyLifecycleStageSet`, not a silent `(current, current)`. **Interface method signatures deliberately unchanged** so leg A's implementation compiles untouched. |
| **B5** — compile-time assertion | Half done here (`MultiStore`). The `GitHubPassThroughStore` assertion belongs in leg A's file and was routed to them. |
| **B1** — `CreateTask` unguarded write path | Fixed. Creation-time labels now route through the same lifecycle-delta authorization the update path uses. |
| **B6** — the swap that never swapped | Fixed and measured. See below. |
| **B7** — selective salvage | 4 of 11 kept. See below. |
| *(unbriefed)* seam characterization | Added. See above. |

### B3 evidence

Positive control before the claim:

| | fault absent | fault present |
|---|---|---|
| pre-fix | 215 results | **111 results + 1 panic** (104 tests never ran) |
| post-fix | 215 results | 215 results, 0 panics |

Confirms test review T-4's consequence claim (auditor measured 215 vs 115; I
measured 215 vs 111).

### B1 evidence

Positive control obtained by removing the gate. All four terminal cells fail
with, e.g.:

```
CreateTask(labels=[ft:stage/completed]) was ALLOWED on a bare task:write token
while CreateTask(stage=completed) required "task:close"
```

The allow-side controls stay green under the same mutation, so the denial is a
scope gate and not a blanket refusal. The terminal test is a **differential**
over all four terminal stages comparing the stage door against the label door,
not against literals.

### B6 evidence, including the part that did not go the way I wanted

`TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose` never swapped —
every cell called `addLabels` alone, so the issue ended up carrying *both*
terminal labels. Renamed to `AddingASecondTerminalLabelRequiresClose` and kept;
the swap it was named for is now a separate test using a new `swapLabels`
fixture helper that issues one `UpdateTask` carrying both `add_labels` and
`remove_labels`.

**Finding: the real swap behaves identically to the add-only approximation.**
All 12 ordered pairs denied on `task:write`, all 12 permitted by `task:close`,
denial scope matching cell for cell. That is the intended behaviour, but it was
a prediction until the input existed.

**Disclosed: the 12-cell matrix is a weak control.** My first draft doc comment
claimed a gate leaning on the free `from == to` pair "would pass the add-only
test and fail here." I had not demonstrated that. Three mutations of the
`UpdateTask` gate, whole package run against each:

| mutation | add-only | swap matrix | reopen |
|---|---|---|---|
| M1 gate removed entirely | RED | RED | RED |
| M2 gate ignores `remove_labels` | green | **GREEN** | RED |
| M4 gate always charges `task:close` | green | **GREEN** | RED |

The matrix detects only M1, which the add-only test already detected. **As a
detector it adds nothing.** What it does add: the named input is executable, the
behaviour is measured, and it can assert the remove side actually removed —
add-only leaves both labels on by construction and structurally cannot see a
remove that no-ops. The doc comment now says this in those words instead of the
claim I could not support.

`SingleRequestReopenSwapCostsAccept` (terminal → accepted in one request must
cost `task:accept`, not `task:close`) is the sensitive one, catching M2 and M4.
It is **not** the sole detector of either — 3–4 pre-existing remove-side tests
catch them too — so the honest claim is that it covers the single-request shape
of a hole already covered in its two-request shape.

**A void run, disclosed:** M4's first attempt exited 1 from `declared and not
used: from` — a build failure, not a red test. Re-run with a compiling mutation.

### B7 evidence

Read `audit_r5_probe_test.go` (710 lines, 11 tests) in full. Kept 4, dropped 7,
reasons recorded in-file so a later round can overturn the judgement without
re-reading commit `0075526`.

Kept: the positive control (extended with a `remove_labels` allow-arm the kept
removal matrix needs); `Charge1_RemovalDirection` (remove X from `[X,Y]` — every
other removal test in the package uses a single-terminal issue where removal
always empties the set); `Charge4_FromEqualsToReachability` (measures what gets
*written* when nobody is refused, rather than who is refused);
`Charge4_REV9PremiseAdversarially` (proves the mock close counter can reach 1
before relying on its being 0 — the only place in the package that validates a
mock counter before trusting it).

Dropped: two exact duplicates of existing 12-cell matrices; one that asserts the
`CreateTask` hole is *open*, which B1 closed and which no longer compiles against
B4's signature (the auditor predicted its own obsolescence in its failure
message); two that assert nothing at all, one named `_FIXTURE_CANNOT_EXPRESS_THIS`
by its own author; two prefix-behaviour tests that leg A is actively changing.

Verified not vacuous: with the gate removed, `Charge1_RemovalDirection` goes red
reporting the ungated removal.

---

## What was deliberately NOT done

- **The `SameStageSet` seam.** Adjudicated to r7. Needs both domains at once.
  Pinned, not fixed.
- **The `TestWatchTasks` subscription race.** Routed to #197. See below.
- **`Charge6_CustomPrefixEndToEnd`.** A genuinely good 12-cell control proving
  the gate holds at a non-default `push_prefix`. Dropped **not on merit** but
  because it asserts current prefix behaviour from `internal/server` while leg A
  is unifying prefix resolution. **Recommended for the combined tree.**
- **The `GitHubPassThroughStore` half of B5.** Leg A's file.
- **The four `go vet` copylocks findings.** Pre-existing, out of brief.
- **`internal/server/scopes.go` is unformatted** per `gofmt -l`. Verified
  pre-existing via `git stash`; left alone.

### TOCTOU — explicitly NOT closed

The window between the authorization decision in `LabelDeltaLifecycleStages` and
the actual label write is **not closed by anything in this round**, and the B1
doc comment says so at the call site. The round-5 auditor listed it as "not
established" and it remains not established. Nothing here should be read as
implying it is closed.

---

## The `TestWatchTasks` subscription race

Classified, not fixed, per instruction. Routed to #197 with the API observation
attached.

**Mechanism, derived from the code rather than the symptom:** `WatchTasks` does
`RequireIdentity` → `RequireScope` → validate → `RequireCollectionAccess` →
`GetCollection` before reaching `eventBus.Subscribe` at `watch.go:59`. The
client's call returns as soon as the stream opens (`watch_test.go:383`) and
publishes at `:390`. Any event published in that window is **silently dropped**.
This falls straight out as the 0.00s-vs-5.01s split.

**Matched differential** (identical invocation, identical generator; my first
attempt was unmatched — all `TestWatchTasks` at count=5 against one test — and
was re-run): no delay → 5 of 6 batches FAIL, 6 timeouts; 300ms delay → 6 of 6
PASS, 0 timeouts.

Not a data race. `-race` is clean, and it is ordering, not unsynchronised
memory. Note `make race` is scoped to `./internal/platform/github/` only, so
`internal/server` has never been race-tested in this repo.

**Reproduced during this round's gate**, on the final tree, in a plain
`go test ./... -v` run: `TestWatchTasks_CreatedEvent` failed at 5.01s. A
subsequent identical run passed. Plain `go test ./...` has passed every time;
only the heavier `-v` run has ever reddened. So it is intermittent and
load-sensitive, consistent with the mechanism above. **It did not reproduce in
the EM's 15 runs — read that as narrowing, not exoneration.**

### Why this flake should not have been silenced

Recording the EM's framing because it is the transferable part: the flake was
the **only** thing in this repo noticing that `WatchTasks` has an undocumented
correctness precondition — a client gets no signal that its subscription is
live. Every instinct, including the framing in the original brief, pointed at
silencing it: bump the deadline, mark it flaky, route it to cleanup. Doing so
would have removed the sole detector for a real API characteristic and called it
housekeeping.

That is *"a correctly-reasoned disclosed survivor whose justification has no
tripwire"* **running in reverse**: the tripwire existed, nobody knew what it was
attached to, and it was mistaken for noise.

The open product question — whether `WatchTasks` should expose readiness, or
whether `include_initial` being the required mitigation should merely be
documented — is a gRPC contract decision and was escalated above the EM.

---

## Onboarding defect: a fresh clone of this repo does not build

**This corrects the round-6 brief and `CLAUDE.md`, and it is a real defect, not
a note.**

```
$ go build ./...
assets.go:5:12: pattern all:web/dist: no matching files found
```

`web/dist` is gitignored and generated. **`go build ./...` cannot succeed on a
fresh clone until `make web` has been run**, and nothing in `CLAUDE.md`, the
Quick Start, or the build-and-test section says so. `CLAUDE.md` presents
`go build ./...` as the build command.

Consequence, established independently by leg A: **all three round-5 review legs
reported `GO_BUILD_EXIT=0` against a *stubbed* `web/dist`.** A stub satisfies the
embed pattern, so the exit code is real and measures nothing about the real
build.

Every gate figure in this document was measured after a **real** `make web`
(4109 files in `web/dist`, matching the EM's independently measured real build),
not a stub.

**Recommended:** `CLAUDE.md` should state the `make web` prerequisite, and the
build target should depend on it rather than failing with an embed error that
does not name its cause.

---

## Gate

Real `make web` build. Exit codes taken from the child, never through a pipe.

| Command | Exit | Note |
|---|---|---|
| `go build ./...` | **0** | |
| `go vet ./...` | **1** | exactly 4 findings |
| `go test ./...` | **0** | |
| `make race` | **0** | scoped to `./internal/platform/github/` only |

**Vet verified by request type, not line number**, because B1 moved lines in
`server.go`. All 4 are `assignment copies lock value` in
`internal/server/server.go`, naming `GetReadyTasksRequest`,
`GetBlockedTasksRequest`, `GetCriticalPathRequest`, `GetBottlenecksRequest`.
Same set as the pre-round baseline. **No fifth finding.**

### Test counts

| | baseline `ea8ac39` | final | delta |
|---|---|---|---|
| `go test ./... -v` top-level | 579 | **593** | +14 |
| `go test ./... -v` result lines | 1544 | **1625** | +81 |
| `internal/server` top-level | 215 | 219 (at B6) | |
| panics | — | **0** | |

The +14 reconciles exactly: B1 3, B6 2, store seam tests 5, collapse
characterization 1, salvage 4, minus the 1 round-5 residual pin that B1 closed
and removed.

---

## Method notes

- **Mutations were content-addressed, never line-addressed**, with a uniqueness
  assert before each edit.
- **Restoration verified by sha256 against an out-of-repo pristine copy**, not
  by `git status`. "Clean" is not "unchanged."
- **Three void-harness catches this round**, one of them mine (M4's build
  failure reading as a red test). An exit code is only evidence once you know
  which stage produced it.

### On not fabricating B7

The salvage commit `0075526` was unreachable: `origin` pointed at
`/workspace/farmtable-labelwrite-scope`, a **host** path that cannot exist inside
the container, so every clone handed out this round had a dead remote. I swept
`git log --all`, `--name-only`, the reflog, `.git/objects`, and the whole
filesystem for both the object and the filenames before reporting.

The brief specified the two files by exact line count (457 and 710). That was a
detail I could have quietly matched by writing fresh tests from the audit report
and calling them a salvage. **A selective salvage of code nobody has read is not
a salvage** — the entire task is judging which parts of specific existing code to
keep. It would have been the same shape as a plausible artifact standing in for
one that was never produced. Reporting the hole was worth more than filling it,
and the files were then supplied.
