# dev-194-close-label-swap — issue #194: closed pass-through tasks report available

## Context and standing constraints

Go backend work. **Phase 1 is merged, deployed and LIVE in production, and this
is a live bug in that shipped code.** This is deliberately a **separate, small
PR** — do NOT bundle it into the Phase 2 web branch or its deploy. Same
Phase 1 / Phase 2 boundary discipline we have held throughout.

**This PR gates the Phase 2 deploy.** Phase 2 ships an Available Queue, which is
exactly the surface that will make this existing bug newly and prominently
visible to users of GitHub-sourced collections. So this must land before or
alongside Phase 2. Please treat it as time-sensitive, but not at the cost of
rigor — it gets the full three-way review like everything else.

Your workspace is `/workspace/farmtable-close-label-swap`, branch
`close-label-swap`, based on branch `terminal-predicate` @ `d5db8c4` (PR #191).
That base is deliberate: #191 exported `store.IsTerminalStage` and consolidated
the pass-through availability path, and you want that context. `origin` points
at a local path, so `git fetch` and `git diff` work with no GitHub credentials.

`web/dist` has already been copied into your tree so `go build ./...` works
(it is gitignored but required by a `go:embed`; a fresh clone fails with
`assets.go:5:12: pattern all:web/dist: no matching files found`). **Do not
commit it.**

Do not read build success from a pipeline's exit code — `go build ./... | tail
-3; echo $?` reports `tail`'s status. Redirect to a file, then check `$?`.

---

## The bug

`internal/platform/github/passthrough.go:579-606`. `CloseTask` closes the GitHub
issue with a `state_reason` and returns, **never touching labels**:

```go
reason := githubv4.IssueClosedStateReasonCompleted
if stage == task.StageWontFix || stage == task.StageCancelled {
    reason = githubv4.IssueClosedStateReasonNotPlanned
}
closed, err := s.gql.closeIssue(ctx, target.ID, reason)
// ...no StageLabelSwap
```

The other two mutators do it correctly — `UpdateTask` at `:348` and `ClaimTask`
at `:548` both call `s.mapper.StageLabelSwap(...)`. I verified this myself:
`grep -n StageLabelSwap internal/platform/github/*.go` shows exactly two
production call sites, and `CloseTask` is not one of them.

**Why it matters.** `ClaimTask` adds `ft:stage/working`. So any task that was
**claimed and then closed** — the ordinary lifecycle — keeps that label. On the
next read, `IssueToPhaseStage` (`labels.go:374-384`) consults labels *before*
real GitHub state for a closed issue, derives `Phase=in_progress, Stage=working`,
and `ComputeAvailability` returns `available=true` with an **empty reason list**.

`stagePrecedence` (`labels.go:12-23`) makes it worse: it ranks `working` at index
0 and `wont_fix` at 7, so when labels conflict the **non-terminal stage wins**.

This is a real defect on the happy path with no attacker and no unusual
configuration, and it likely affects a large fraction of closed pass-through
tasks today.

---

## Part 1 — swap stage labels in `CloseTask`

Make `CloseTask` perform the stage-label swap the way `UpdateTask` and
`ClaimTask` already do, so the closed task carries a label matching its true
terminal stage. Follow the existing pattern at `:348` and `:548` rather than
inventing a new one — read both before you write anything.

Handle the label-swap failure sensibly relative to the close itself. Think about
ordering and report your reasoning: if the issue closes but the label swap
fails, what state is the system in, and is that better or worse than the
reverse? I want your judgement in the report, not just code.

## Part 2 — make real GitHub state authoritative (the actual invariant)

Part 1 alone is **hygiene, not a guarantee** — it depends on a write succeeding.
If the swap fails (network, label permissions, rate limit), the task still
reports available. Add the belt-and-braces arm the security audit recommended:

In the pass-through `ComputeAvailability` (`passthrough.go:612`), treat
`t.ClosedAt != nil` as terminal.

**I verified this is sound before asking for it.** `ClosedAt` is set at
`passthrough.go:161-172` from real GitHub state for **any** issue whose state is
`CLOSED`, with a defensive `UpdatedAt` fallback if the API returns a null
`ClosedAt` — so it is never nil for a closed issue, and critically it is **not
label-derived**. That makes it a reliable proxy for "really closed on GitHub",
which is exactly what the label path fails to be.

Keep using `store.IsTerminalStage` for the stage arm — do not hand-roll the
stage set. This is an additional arm, not a replacement.

Note in your report that this also partially mitigates **#193** (labels
overriding closed state). Do **not** try to fix #193 itself — it is a separate,
non-blocking follow-up and fixing it here would widen this PR.

---

## Acceptance criteria

- **A test proving the actual reported scenario**: a task that is claimed (gains
  `ft:stage/working`) and then closed reports `available=false`. This is the
  whole point — if this test does not exist, the PR does not close the issue.
- **A test for the Part 2 invariant specifically**: a closed issue carrying a
  stale non-terminal label still reports `available=false`. This must fail if
  Part 2 is removed, even with Part 1 present.
- **Real mutation tests.** Break each fix in turn, paste the ACTUAL failing
  output, restore, confirm green. A claim of "verified" without pasted output
  will be sent back. This is the standing bar on this workstream and it is not
  negotiable — the security audit that found this bug also found that the
  pass-through path is weakly covered, so I am relying on mutations, not on
  test count.
- Note: there is no existing GraphQL fake in this package. If you need to build
  a small test double to drive `CloseTask`, that is expected and fine —
  but keep it honest and say in your report what it does and does not simulate.
- Behaviour otherwise preserved. `go build ./...` and `go test ./...` green,
  output pasted. `gofmt` clean.
- No web/frontend files touched. No Phase 2 branch merged in.

## Deliverables — all required

1. Commits on branch `close-label-swap`.
2. A project log entry at `.design/project-log/close-label-swap.md` with a
   "Not done, and why" section (which should mention #193).
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-close-label-swap.md`
   covering both parts, every mutation with real output, your judgement call on
   failure ordering in Part 1, and anything found but not fixed.

**Do not push.** Commit locally; the manager pushes.

If you find that either fix cannot be made behaviour-preserving for non-GitHub
stores, stop and report rather than widening scope.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
