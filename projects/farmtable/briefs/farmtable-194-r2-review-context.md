# #194 close-label-swap — round-2 review, SHARED CONTEXT

Read this first. Your role-specific instructions are in your dispatch message.

## What you are reviewing

Branch `close-label-swap`, **head `9f98ad8`**, rebased onto the full #191 branch.

> **Verify by SHA, not by branch name.** `git rev-parse --short HEAD` must print
> `9f98ad8`. Tonight another branch name on this project resolved to **four
> different commits** across four clones. The name is not a reliable identifier;
> the SHA is.

Two ranges matter:

```
d7314cf..9f98ad8    # the whole branch (9 commits, includes the 2 already reviewed)
c1ec1ba..9f98ad8    # the round-2 fix round — 7 commits, what is NEW
```

Weight your effort on `c1ec1ba..9f98ad8`, but the whole branch is in scope.

```
9f98ad8 Log the #194 audit fix round
af93cb0 Guard the pass-through store's lazy caches with a mutex   <- #198
1d889ba Leave a trace when CloseTask's best-effort writes fail
4ac117e Give the claim gate the same ClosedAt arm availability has
c973a51 Pin the three close-path premises that nothing enforced
0b87721 Stop a terminal stage label outranking an open GitHub issue  <- F2, see below
a70d3d1 Read the remote issue state field exactly one way
```

The dev's report is at `reports/dev-194-fixes.md`. **You may read it. Ratify
nothing on its say-so.**

## Gate status — I ran this myself at `9f98ad8`, independent of any dev claim

```
go build ./...                                   exit 0
go vet ./...                                     4 findings
go test ./internal/platform/github/ -race        exit 0
```

All 4 vet findings are the pre-existing copylocks in `internal/server/server.go`,
already filed as **#199**, reproducing at base. **Do not attribute them here and
do not fix them.** `gofmt -l internal/platform/github/` is empty.

**Do not spend your round re-establishing that the suite is green.** Spend it on
what green does not prove.

## THREE THINGS I SPECIFICALLY WANT ATTACKED

These are not "confirm the dev was right." They are claims I am asking you to try
to break. If they survive you, they ship.

### 1. F2 (`0b87721`) — a behavioural change riding on a "no legitimate workflow" claim

`IssueToPhaseStage` (`labels.go:415`) no longer lets a terminal stage label
outrank GitHub reporting an issue as OPEN; such an issue now falls through to
`accepted`.

This is **user-visible behaviour change**. It was gated on the question *does any
legitimate workflow depend on an open issue holding a terminal stage?* The dev
answered **no**, via five read-only checks: producers vs consumers,
`transitions.go`, `graph_routing.go`, the import path
(`ImportCollection` → `ErrNotImplemented` on the pass-through store), and the
`ft close` / `ft release` verbs. It has been ruled acceptable on the strength of
that analysis.

**Your job is to try to find the sixth path the five checks missed.** A consumer
that reads `Stage` and behaves differently. An MCP tool, a gRPC handler, a CLI
formatter, a web surface, a fixture, an export. If you find one, this is a
**blocking** finding and it changes the ruling. Two guards exist against
over-breadth (`OpenIssueKeepsNonTerminalStage`, `ClosedIssueKeepsTerminalStage`) —
check they are actually load-bearing, by mutation.

An external disclosure has been written that **depends on this review surviving**.
If it does not survive, say so plainly and the disclosure gets voided.

### 2. `stage` is now read two ways — is it really fail-safe?

The round's headline commit is *"Read the remote issue state field exactly one
way."* It left **stage** read two ways, one field over:

| path | reads stage via | applies the F2 demotion? |
|---|---|---|
| pass-through read (`passthrough.go:205`) | `IssueToPhaseStage` | yes |
| tree walk (`treewalk.go:36,53`) | `MapLabelsToStage` direct | **no** |

The dev pinned this rather than fixing it
(`TestComputeReady_OpenTerminalLabelledIssueIsNotReady`) and argues the
divergence is **fail-safe**: the affected issue is available and claimable but
absent from `GetReadyTasks`, so the queue *under*-reports.

**Test that claim.** "Fail-safe" is a directional argument and those are exactly
the arguments that turn out to have an asymmetric case hiding in them. Is there
any consumer — critical path, bottlenecks, blocked-tasks, the graph, a count, a
web badge — where *absence* from the ready set is the dangerous direction rather
than the safe one? Same question for `computeBlocked`.

### 3. The surviving mutant in the #198 mutex work

The dev reports honestly (report §6) that dropping the `RLock` in
`labelNameToID` while keeping the double-check **survives** `-race`. They explain
it: all nine call sites are preceded by `ensureLabelIndex` on the same goroutine,
which takes `cacheMu` and establishes happens-before. They isolate it with two
further mutations (A: no double-check + unlocked → races; B: no double-check +
read-locked → safe) and keep both guards.

**Check the happens-before argument yourself.** It spans two functions and rests
on "every call site does X." Verify that claim across all nine sites rather than
accepting the count. If a single site reaches `labelNameToID` without
`ensureLabelIndex` first, the argument collapses and the surviving mutant is a
real gap, not an explained one.

## Standing bars on this workstream

1. **Mutation testing is the bar.** "Verified" without pasted actual failing
   output is not evidence. Apply it to your own findings too: if you assert
   something is or is not covered, prove it by breaking it.
2. **The self-built oracle defect class** — a test asserting against a local
   re-implementation instead of the real exported symbol. Thirteen removed on
   this workstream, a fourteenth rejected. The dev claims none here and lists the
   real symbols each test binds to. **Verify that list rather than trusting it.**
3. **Tests that disappear instead of failing** — a class named tonight, found
   independently on two branches within an hour. A case list built by filtering
   through the predicate under test protects against *widening* and is blind to
   *narrowing*; a suite that counts its own checks without asserting the total
   goes green when a check is deleted. This round added a lot of table-driven and
   parameterised tests. **Hunt for an instance.**
4. **Sink-binding** — tests exercise a function thoroughly while nothing proves
   production still calls it.
5. **Do not self-review.** You reviewed round 1; this is the review of the fixes
   to your own findings. Do not ratify a fix because it cites your finding number.

## A process error to check, not to take on trust

On a sibling branch tonight a developer ran `git checkout` on a test file while
their own fix was still **uncommitted**, silently reverting their own work. They
caught it and reapplied. This round applied **twelve** mutations with `cp`
restore between each, and claims `git diff --stat` clean and no test file
modified throughout.

**Confirm the final committed state is actually correct**, rather than trusting
the restore ritual. A botched restore leaves tests that still pass. The dev also
self-caught and corrected one bad audit reproduction (§1) — good sign, but it
means restores were being done by hand under exactly the conditions that produce
this error.

## Explicitly OUT of scope — do not file against these

- **#199** — the 4 `go vet` copylocks in `internal/server/server.go`.
  Pre-existing, reproduces at base, this branch does not touch that file.
- **#193** — labels outrank `stateReason` on the closed branch. Availability is
  correct regardless. Deliberately deferred; it already invalidated one audit
  reproduction as written (report §1).
- **audit F7** — `UpdateTask` relabels to a terminal stage without closing the
  issue. Real, surfaced by the F2 analysis, ticketed, not this round.
- **audit F3, F6, F8**, and the stage-label-swap extraction (the three copies now
  differ deliberately in error handling, so that extraction has a design question
  in front of it).
- **Test gap 4** — transport-level failures (connection reset, 5xx, context
  cancellation). Needs harness work.
- **Phase 2 and #195** — separate branches under separate review.
- `gofmt` findings in the 7 pre-existing files this branch does not touch.

If you find something **Critical or High**, say so immediately and prominently
rather than burying it in a list.

## Rules

- **Do not push.** Do not modify production code — your independence depends on
  it. If you commit anything, commit only your own project log entry.
- Confirm `git rev-parse --short HEAD` = `9f98ad8` before anything else.
- Every finding needs a severity (Critical / High / Medium / Low / Info), a
  `file:line`, and a concrete recommendation. State a clear verdict:
  **APPROVE** or **REQUEST CHANGES**.
- **Distinguish what you verified by execution from what you reasoned about.**
  Say which is which. That distinction has repeatedly been the difference between
  a real finding and a wrong one on this workstream.

## Note on this round's sequencing

The `code-reviewer` template is currently blocked by an infrastructure fault, so
the code-review leg of this gate will run **later, at this same SHA `9f98ad8`**.
The gate still requires all three approvals and is not being reduced to two.
Review as though the third report will contradict yours — because it may.
