# dev-194-fixes — pre-merge fix round on `close-label-swap` (#194)

## Status

Three independent reviews are in and they do not agree on a verdict, which is
itself informative:

- `review-194`: **APPROVE** — "merge is safe", one High *latent* finding.
- `test-194`: **REQUEST CHANGES** — three missing tests, no production change.
- `audit-194`: **REQUEST CHANGES** — two blocking Mediums (F1, F2), one
  pre-existing High (F4) explicitly *not* blocking this PR.

The core change is sound and all three reviewers say so. The audit could not
defeat the `ClosedAt` arm using any *canonical* GitHub response and calls the
close-then-swap ordering judgement correct. What follows is a fix round, not a
rewrite.

Workspace: `/workspace/farmtable-close-label-swap`, branch `close-label-swap`,
now at **`c1ec1ba`**, clean.

### Read this before you start: I rebased your branch after the reviews were written

The three reports were written against `d5db8c4..03bd155`. **I have since rebased
the branch onto the full #191 branch (`d7314cf`), so your range is now
`d7314cf..c1ec1ba`.** Your two commits replayed identically — I diffed
`passthrough.go` against the pre-rebase content and it is byte-for-byte the
same, so every finding in all three reports still applies exactly as written,
at the same lines. The pre-rebase state is preserved at
`backup-pre-rebase-03bd155` if you ever need to compare.

**Why I did it, because it changes your work:** the branch was stacked on
`d5db8c4`, which is only the *first* of #191's four commits. #191's later
commits (`4361390`, `3bef89c`, `d7314cf`) modify
`internal/platform/github/treewalk.go` and `internal/store/entstore.go`.
There is no overlap in the diffs as they stand today — but **the F1 fix below
requires you to edit `treewalk.go`** (the audit names lines 79, 85, 122, 136).
You would have been editing a version of that file that was about to change
underneath you at merge time. #191 is already approved by all three reviewers
and merges before #194 regardless, so this is now your real base.

I verified after rebasing: `go build ./...` clean, and
`go test ./internal/platform/github/... ./internal/store/... -race` passes.

Treat #191's consolidated treewalk terminal check as **existing code you must
work with**, not as something to rework. If your F1 change appears to conflict
with what #191 did there, stop and report — that is a genuine design
interaction and I want to see it, not have it quietly resolved.

## Read these first — all three, in full

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-194.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-194.md`

Both the audit and the test review supply **executable reproductions that they
actually ran**, with pasted output. Use them. Verify them yourself; do not paste
on trust.

## One framing correction you need to internalise first

`audit-194` §"Framing correction" establishes that in the pass-through store,
availability is **not** the enforcement gate on claiming. `ClaimTask` and
`CloseTask` resolve targets from an `IssueStateOpen`-filtered list, and
`GetReadyTasks` never calls `ComputeAvailability` at all. So #194 is a
**reporting-correctness** bug, not an access-control hole.

That is not a downgrade of the work — it *raises* the stakes on one direction of
it. Because availability is advisory, **a wrong `false` is exactly as damaging
as a wrong `true`**: it silently tells agents and humans that open work is
finished. Item 2 below is that failure mode, and this PR introduces it.

---

## Scope

### 1. **BLOCKING — audit F1**: one case-insensitive reading of the remote `state` field

`passthrough.go:161` does `if stateStr == "CLOSED"`. The *same field*, from the
*same response*, is parsed with `strings.EqualFold` in the same function's callee
(`IssueToPhaseStage`, `labels.go:370`) and in the same file (`hasOpenSubIssue`,
`:568`). Three readings of one untrusted field, one of which is now load-bearing.

Non-canonical casing restores the exact #194 bug with the fix fully present —
and reproduces the original bug's fingerprint, `available=true, reasons=[]`. The
audit ran it; the output is in the report. The `UpdatedAt` fallback the second
commit went to the trouble of pinning is unreachable in that state too, because
it lives *inside* the same branch.

Take the audit's recommendation: a shared `issueStateClosed`/`issueStateOpen`
helper used by `issueToTask`, `IssueToPhaseStage`, `hasOpenSubIssue`, and
`treewalk.go`. **Heed its warning**: do *not* invert the guard to
`if !issueStateOpen(stateStr)`, because an empty or unrecognised state would then
set `ClosedAt` and produce item 2's denial-of-work. Failing open on an
unrecognised state is what `IssueToPhaseStage` does, and agreement between the
two is the property that matters. Add the casing table test.

### 2. **BLOCKING — audit F2**: the reopen inverse

Before this PR, `ft close` left `ft:stage/working` on the issue. After it, a
terminal stage label is written to GitHub — and **reopening an issue is an
ordinary GitHub operation**, which in a pass-through collection happens outside
Farm Table entirely. On reopen GitHub sets `state=OPEN` and clears `closedAt`;
the label is untouched. The issue then carries a terminal stage label with no
contradicting non-label signal, and reports `available=false, reasons=[terminal]`
for live, open work.

Note this is the same shape as the failure the code's own comment at `:613-615`
cites to justify the ordering. That argument only considered a *failed close*.
The successful close plus a later reopen reaches the identical state by a normal
workflow. Note also that `test-194`'s surviving mutant **(e)** — "`issueToTask`
sets `ClosedAt` for OPEN issues" — is the same hole found independently from the
other direction. Two reviewers converging separately is a strong signal.

**Decide between two routes and state which and why:**

- **Preferred: the symmetric fix**, audit F2 recommendation option 2 —
  "re-stamp on reopen": an open issue's stage may not be terminal. This is local
  to the pass-through read path, needs no `RemoteData` plumbing, leaves
  `ComputeAvailability` and the hand-constructed cases in
  `terminal_availability_test.go` untouched, and it makes the whole PR tell one
  coherent story: **GitHub state outranks labels in both directions.** It also
  incidentally closes audit F7.
- **Fallback**: an explicit test pinning the current reopen behaviour with a
  comment marking it a known accepted consequence, plus a tracked follow-up.

**The thing you must check before choosing** — and the reason I am not simply
mandating the preferred route — is the interaction with `UpdateTask:342-357`.
Today `ft update --stage completed` on an *open* issue swaps the label and the
stage reads back as `completed`. Under the symmetric fix it would read back as
`accepted`. Work out whether any legitimate workflow depends on an open issue
holding a terminal stage. **If it does, stop and report to me before proceeding**
— that is a product decision, mine to route, not yours to make. If it does not,
take the preferred route.

What is **not** acceptable either way is shipping the inverse failure
undocumented and unpinned.

### 3. **BLOCKING — test-194 gaps 1–3**: three tests, no production change

`test-194` says these three alone flip it to APPROVE, and gap 1's test is already
written and verified in the report. Gap 3 is the important one: every inverse
test today constructs `ent.Task` by hand and therefore bypasses `issueToTask`
entirely. No test reads an OPEN issue through `GetTask` and asserts it is
available. Before Part 2, `ClosedAt` had no effect on availability; after it,
`ClosedAt` alone determines terminality — and only one direction of that premise
is pinned. Note the blast-radius asymmetry the reviewer draws out: the unpinned
direction breaking empties the ready queue and stops *all* work; the pinned
direction breaking mis-reports one closed task.

### 4. **Include — review-194 H1**: `t.ClosedAt != nil` arm in `issueUnavailableForClaim:575`

Not a defect today. `issueUnavailableForClaim` is still purely label-derived, and
`review-194` demonstrated that the obvious next change to this file would let it
start seeing closed issues, whereupon a stale `ft:stage/accepted` label reports
CLAIMABLE — reintroducing #194's bug class in the **enforcement** path, where it
would have real teeth rather than advisory ones. Add the guard now, while it is a
behaviour-preserving no-op, with a comment saying exactly that. Add a test that
would fail if it were removed *and* the enforcement path changed.

### 5. **Include — audit F5 / review-194 M1**: make label-write failures observable

Four stacked silent error swallows at `:617, 623, 627, 636`. Add `log.Printf`.
**Keep the control flow exactly as it is** — the swallowing is deliberate and
both reviewers agree it is correct; it is the *silence* that is the defect.

---

### 6. **Include — audit F4 / review-194 M2 (GitHub #198)**: mutex the `labelIndex`/`repoID` state

**Scope reversal, and you should know why, because my first instruction said the
opposite.** I originally excluded this as an unrelated pre-existing defect, on
the principle that a concurrency fix does not belong in a deploy-gating PR. Then
I measured it:

```
ensureLabelIndex calls in CloseTask BEFORE #194 (d5db8c4): 0
ensureLabelIndex calls in CloseTask AFTER  #194 (c1ec1ba): 1
```

**This PR is what adds `CloseTask` to the set of RPCs that touch the racy
state** — at the `if err := s.ensureLabelIndex(ctx); err == nil {` line that is
the whole point of the label swap. The defect predates the branch; the widened
trigger surface does not. A PR that widens an exposure should carry the
mitigation rather than shipping the widening and fixing it a deploy later.

The defect: `ensureLabelIndex` does an unguarded `s.labelIndex != nil` check
followed by an unguarded map assignment; `labelNameToID` reads it; `ensureRepoID`
is the same shape. The store is cached per collection in `MultiStore.platforms`
and shared across concurrent gRPC requests. Concurrent map read/write in Go is a
**fatal, unrecoverable runtime error** — the process dies for every tenant.

Take the auditor's `sync.RWMutex` shape (in `audit-194.md`, F4). Note their
double-check detail: re-test `s.labelIndex == nil` under the write lock before
assigning.

#### Guard the reads too — three touch points, not one

Correcting my own measurement above, which was narrower than I realised. I
grepped for `ensureLabelIndex` because that is the symbol the audit named, and
got a true answer to a smaller question than I thought I was asking. Reading the
whole `CloseTask` body, it touches the unguarded map **three** times on
`c1ec1ba`:

| line | call | access |
|------|------|--------|
| 617 | `ensureLabelIndex` | populates `s.labelIndex` — **write** |
| 621 | `labelNamesToIDs(remove)` | **read** |
| 625 | `labelNamesToIDs(add)` | **read** |

`labelNamesToIDs` → `labelNameToID` (`:106-109`) reads the map with no lock at
all. So **a fix that locks only `ensureLabelIndex` will look correct and leave
`CloseTask` racing on 621 and 625.** Guard the read paths under `RLock` as well.
This is the specific way I expect this fix to go wrong, so please check it
explicitly and say in your report that you did.

Full evidence, including the raw diff extracts and the reproduction commands, is
at `reports/evidence-198-closetask-branch-state.md`.

This does **not** change the severity. Closes are infrequent, the probability
stays low, and #198 stays a normal-priority fix riding along with this PR. Do
not treat it as urgent.

**Requirements:**
- **A separate commit** from the rest of this round, so it stays independently
  reviewable and revertable.
- Add the auditor's `-race` reproduction as a **permanent regression test**. The
  branch's existing `-race` run is clean only because every test in the package
  drives the store from a single goroutine — so the suite currently cannot see
  this defect at all.
- `MultiStore.platforms` is already correctly mutex-guarded; there is no second
  race there. Do not add one.

Do **not** expand this into a general concurrency review of the package. If you
find another race, report it — do not fix it here.

---

## Explicitly OUT of scope — do not fix these here

File them, do not touch them:

- **audit F3** — hoisting one `store.IsTerminal(t)` predicate across the three
  implementations.
- **audit F6, F8**, and the extraction of the thrice-duplicated stage-label swap.

If you believe any of these has become blocking as a consequence of your changes,
stop and report rather than expanding scope.

---

## Acceptance criteria

- **The #198 race test must FAIL before your mutex commit and PASS after.** Paste
  both runs. A race test that never demonstrated the race proves nothing — and
  since the rest of the package drives the store from one goroutine, a
  silently-ineffective test here would be invisible.
- **The race test must exercise a concurrent `CloseTask`, not just
  `ensureLabelIndex` in isolation.** `CloseTask` is the RPC this PR newly exposes
  and it reads the map at `:621` and `:625` as well as writing it at `:617`; a
  test aimed only at the populate path would pass against a half-fix. If driving
  the full RPC concurrently is impractical under the fake GraphQL client, say so
  and show what you did instead — do not silently narrow it.
- Both blocking audit reproductions (`TestAudit_LowercaseClosedStateDefeatsFix`,
  `TestAudit_ReopenAfterCloseIsUnavailable`) now **pass**, committed as permanent
  regression tests. Paste the before/after output.
- `test-194`'s mutant **(e)** — `issueToTask` sets `ClosedAt` for OPEN issues —
  now **dies**. Paste the failing output.
- The original nine mutations the branch established still behave as recorded.
- **Real mutation testing with pasted actual output** for every behaviour change.
  This is the standing bar on this workstream; "verified" without pasted output
  gets sent back.
- No self-built oracles: tests bind to the real exported symbols, never to a
  local re-implementation. Thirteen have been removed from this workstream and a
  fourteenth rejected.
- Full gate, run and pasted: `go build ./...`, `go vet ./...`,
  `go test ./... -race`, and `gofmt -l .` clean.

  **`go vet ./...` is NOT clean on this repo and that is not your fault.**
  I verified there are exactly **4 pre-existing `copylocks` findings** in
  `internal/server/server.go` (lines ~1500, ~1610, ~1818, ~1995 — `ephReq :=
  *req` on proto messages containing a mutex). They are present on
  `task-state-web-ui-v2` too, so they predate every branch in this workstream
  and are untouched by #191 and #194.

  Your bar is therefore: **no NEW vet findings.** Report the count before and
  after your change and confirm it is still exactly those 4. Do **not** fix
  `server.go` — it is out of scope and unrelated to this PR, and I have logged
  the finding separately.

## Deliverables — all required

1. Commits on branch `close-label-swap`. **Do not push.** Commit locally; the
   manager pushes. Hard rule on this project.
2. A project log entry in `.design/project-log/` with a "Not done, and why"
   section that names the out-of-scope items above.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-fixes.md`
   covering: each item with its verification, your F2 route decision **and the
   `UpdateTask` analysis that justified it**, all mutation output, and anything
   found but not fixed.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
