# Security Audit — Issue #191, terminal-stage availability predicate

**Auditor:** security-auditor (independent)
**Date:** 2026-07-27
**Subject:** `terminal-predicate` @ `d5db8c4`, diff vs `origin/main` (`7a0f220`)
**Scope:** Go backend only. 4 source files changed (+7/-7 lines), 3 new test files (+324), 1 design log.

> **Workspace note:** the stated path `/workspace/farmtable-audit-191` does not exist. The branch
> and commit were audited in `/workspace` itself (`git worktree list` → single worktree,
> `d5db8c4 [terminal-predicate]`). Commit hash and base diff match the brief exactly, so this is
> the intended change; only the path was wrong. **The audit ran against the live dev workspace,
> not an isolated copy.** No files were modified (verified `git status --porcelain` clean before
> and after; one temporary PoC test was created, run, and deleted).

---

## Verdict

**The diff is APPROVED for merge. It does not weaken any availability gate.**

All four consolidated call sites are provably semantics-preserving, including the strictest one
(`multistore.go:250`). The new tests are well-targeted and add real protection where none existed.

**However, the audit of the surrounding surface — which the brief explicitly asked for — found
two HIGH-severity pre-existing defects in the GitHub pass-through path that defeat the terminal
predicate entirely, one of them with an attacker-supplied input and one on the ordinary happy
path with no attacker at all.** Neither is introduced by this diff, and neither should block it.
Both should be filed as follow-up issues before the Phase 2 web client ships with its
"trust server availability absolutely" rule, because that ruling removes the last line of
defence in front of exactly these bugs.

---

## Summary

| Severity | Count | In this diff? |
|---|---|---|
| Critical | 0 | — |
| High | 2 | No — pre-existing, same surface |
| Medium | 4 | No — 1 is a gap *left by* this consolidation |
| Low | 3 | 2 are in the new test files |
| Info | 4 | — |

---

## Part 1 — Answers to the four questions asked

### Q1. Does the consolidation weaken any path's gate? **No. Verified semantics-preserving on all four.**

| Path | Before | After | Equivalent? |
|---|---|---|---|
| `store/entstore.go:1085` | `func isTerminalStage` | `func IsTerminalStage` | Yes — body byte-identical, pure rename + export |
| `server/convert.go:126` | `switch t.Stage { case Completed, WontFix, Duplicate, Cancelled: }` | `if store.IsTerminalStage(t.Stage)` | Yes — same 4 stages |
| `platform/github/passthrough.go:617` | same switch | `if store.IsTerminalStage(t.Stage)` | Yes — same 4 stages |
| `store/multistore.go:250` | `Phase==Closed \|\| Stage==Completed \|\| WontFix \|\| Duplicate \|\| Cancelled` | `IsTerminalStage(Stage) \|\| Phase==Closed` | Yes — identical set; `\|\|` is commutative and all operands are side-effect-free field comparisons |

No path admits a task it previously refused. There is no claim-authorization bypass introduced here.

### Q2. `multistore.go:250` specifically — was the strictest gate relaxed? **No.**

Both distinguishing features are intact and now pinned by tests:

- The extra `PhaseClosed` arm is **retained** (`multistore.go:250`), carries an explicit
  "do not reduce this to a bare `IsTerminalStage` call" comment, and is pinned by
  `TestMultiStoreComputeAvailability_ClosedPhaseIsTerminal`.
- The `Available: len(reasons)==0 && Phase==PhaseOpen && Stage==StageAccepted` conjunction
  (`multistore.go:259`) is **untouched by the diff** and is now pinned by
  `TestMultiStoreComputeAvailability_RequiresOpenAccepted`, which correctly asserts the
  `reasons`-empty-but-unavailable cases that make this gate stricter than the other three.

This is the strongest part of the change. Previously nothing pinned either property.

### Q3. GitHub pass-through deriving availability from external data — **this is where the real problems are.** See HIGH-1 and HIGH-2 below.

### Q4. Anything in the new tests that masks a future weakening? **Yes, one thing.** See LOW-1.

---

## Part 2 — Findings

### [HIGH-1] A GitHub label overrides closed/terminal state, forging `available=true`

- **Location:** `internal/platform/github/labels.go:374-384` (`IssueToPhaseStage`), reached via
  `internal/platform/github/passthrough.go:131` (`issueToTask`) → `passthrough.go:612`
  (`ComputeAvailability`)
- **Not introduced by this diff.** Pre-existing.

**Description.** For a **closed** issue, labels are consulted **before** the real GitHub
`state`/`state_reason`:

```go
if isClosed {
    // Check labels first for a more specific stage.
    if stage, ok := m.MapLabelsToStage(labels); ok {
        return phaseForStage(stage), stage   // <-- label wins over reality
    }
    if strings.EqualFold(stateReason, "not_planned") {
        return task.PhaseClosed, task.StageWontFix
    }
    return task.PhaseClosed, task.StageCompleted
}
```

Every stage auto-registers a label of the same name (`labels.go:94-98`), and `stripForMatch`
(`labels.go:402-420`) lowercases and strips the `ft:` / `stage/` prefixes — so `accepted`,
`Accepted`, and `ft:stage/accepted` all match `StageAccepted`. Because `Phase` is *also*
label-derived, `MultiStore`'s extra `Phase == PhaseClosed` guard cannot catch it either
(and is bypassed regardless, since the GitHub store implements `ComputeAvailability` itself,
`multistore.go:238-242`).

Worse, `stagePrecedence` (`labels.go:12-23`) ranks `working` at index 0 and `wont_fix` at index 7,
so conflict resolution actively **favours the non-terminal stage**: adding `accepted` to an issue
that already carries a correct `wont_fix` label makes `accepted` win.

**Proof of concept.** I verified this independently (temporary test in
`internal/platform/github/`, run and deleted). Real `DefaultConfig()` mapper and real
`GitHubPassThroughStore.ComputeAvailability`; issue state `closed`, `state_reason=not_planned`:

```
labels=[]                     -> phase=closed       stage=wont_fix   AVAILABLE=false reasons=[terminal]   <- correct
labels=[accepted]             -> phase=open         stage=accepted   AVAILABLE=true  reasons=[]           <- BYPASS
labels=[ft:stage/accepted]    -> phase=open         stage=accepted   AVAILABLE=true  reasons=[]           <- BYPASS
labels=[Accepted]             -> phase=open         stage=accepted   AVAILABLE=true  reasons=[]           <- BYPASS
labels=[working]              -> phase=in_progress  stage=working    AVAILABLE=true  reasons=[]           <- BYPASS
labels=[accepted wont_fix]    -> phase=open         stage=accepted   AVAILABLE=true  reasons=[]           <- BYPASS (non-terminal wins)
```

**Impact.** Anyone with GitHub triage/write access on the mirrored repo — and, in repos where
issue authors may self-label, the reporter — can make a closed-as-not-planned issue report
`available=true` with an **empty reason list**. The terminal arm this whole change exists to
protect is simply not reached.

**Residual risk / mitigating factor (verified, and important to state honestly).**
`GitHubPassThroughStore.ClaimTask` lists only **open** issues
(`passthrough.go:518`, `[]githubv4.IssueState{githubv4.IssueStateOpen}`), so an actual claim
against a closed mislabeled issue fails with `store.ErrNotFound`. **The claim is blocked today —
but by an incidental query filter, not by the terminal predicate.** The forged availability is
still served over the API and to the ready queue, and any future change that widens that
`listIssues` state filter turns this into a full claim bypass with no test failing.

**Recommendation.** Make real GitHub state authoritative for the terminal arm; let labels only
*refine within* the closed phase:

```go
if isClosed {
    if strings.EqualFold(stateReason, "not_planned") {
        return task.PhaseClosed, task.StageWontFix
    }
    // Labels may only select among CLOSED-phase stages.
    if stage, ok := m.MapLabelsToStage(labels); ok && phaseForStage(stage) == task.PhaseClosed {
        return task.PhaseClosed, stage
    }
    return task.PhaseClosed, task.StageCompleted
}
```

Belt-and-braces: add a `t.ClosedAt != nil` arm to the pass-through `ComputeAvailability`.
`ClosedAt` is set from real GitHub state (`passthrough.go:161-172`) and is not label-derived.

---

### [HIGH-2] `CloseTask` leaves a stale non-terminal stage label, so closed tasks report available — no attacker required

- **Location:** `internal/platform/github/passthrough.go:579-606`
- **Not introduced by this diff.** Pre-existing.

**Description.** `ClaimTask` adds `ft:stage/working` via `StageLabelSwap` (`passthrough.go:548`),
and `UpdateTask` swaps stage labels correctly (`passthrough.go:343-358`). **`CloseTask` does
neither** — it closes the GitHub issue with a `state_reason` and returns, never touching labels:

```go
reason := githubv4.IssueClosedStateReasonCompleted
if stage == task.StageWontFix || stage == task.StageCancelled {
    reason = githubv4.IssueClosedStateReasonNotPlanned
}
closed, err := s.gql.closeIssue(ctx, target.ID, reason)
// ...no StageLabelSwap
```

**Impact.** Any pass-through task that was **claimed and then closed** — the ordinary lifecycle —
retains `ft:stage/working`. On the next read it derives `Phase=in_progress, Stage=working`, which
per the HIGH-1 precedence beats the closed state, yielding `available=true, reasons=[]`. This is
HIGH-1 triggered by Farm Table's own happy path, with no attacker and no unusual configuration.
It is likely to affect a large fraction of closed pass-through tasks.

**Recommendation.** Perform the stage-label swap in `CloseTask` as the other two mutators do,
and fix HIGH-1 so a stale label cannot resurrect a closed task even if the swap fails.

---

### [MEDIUM-1] The consolidation missed a fifth copy of the terminal predicate — in the ready-queue path

- **Location:** `internal/platform/github/treewalk.go:104-106`
- **Directly responsive to Q1/Q4.**

```go
isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
    node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
```

This enumerates exactly the four stages now owned by `store.IsTerminalStage`, with identical
"permanently unavailable" semantics, inside `computeReady` — which backs `GetReadyTasks`
(`passthrough.go:771-798`), i.e. the ready/available queue. `git show d5db8c4 --stat` confirms
`treewalk.go` was not touched, and the design log's list of deliberate exclusions (CloseTask's
close-target validation, both `phaseForStage` copies, the export/import enumerations) does **not**
mention it. This is a genuine leftover, not an intentional exception.

The change's stated goal is "single source of truth." Leaving a hand-rolled copy in the ready-queue
path preserves precisely the divergence risk #191 set out to eliminate.

**Recommendation.** `isTerminal := store.IsTerminalStage(node.Stage)`, or document it in the design
log as a deliberate exclusion with a reason.

---

### [MEDIUM-2] Pass-through `ClaimTask` is non-atomic, fails open, and silently ignores `assigneeID` and `version`

- **Location:** `internal/platform/github/passthrough.go:517-563`

Four distinct problems in one function:

1. **Fail-open on partial failure.** Both label mutations discard their errors
   (`_ = s.gql.removeLabels(...)`, `_ = s.gql.addLabels(...)`, lines 552 and 556). If the remove
   succeeds and the add fails, the issue is left with **no** stage label, which derives back to
   `StageAccepted` ⇒ `available=true` (`labels.go:397`). The method still returns success.
2. **`assigneeID` is accepted and never used.** No GitHub assignee is set, so the
   `current.AssigneeID != nil` exclusivity check at line 535 can never observe a prior Farm Table
   claim. Two agents can both "claim" the same issue and both succeed.
3. **`version` is accepted and never referenced.** A caller passing `--version` for a
   compare-and-swap claim gets silent no-op optimistic concurrency.
4. **TOCTOU.** The check at 534-540 is against a list snapshot; the mutation at 550-557 is an
   unconditional network write with no revalidation.

This contradicts `CLAUDE.md`'s "`task_claim` … atomically assigns the task and moves it to
`working`." Note the contrast with `EntStore.ClaimTask`, which is exemplary (see Positive
Observations).

**Recommendation.** Propagate the mutation errors; set the GitHub assignee; either honour
`version` or return `ErrNotImplemented` rather than silently ignoring it.

---

### [MEDIUM-3] Hold-label check hardcodes the `ft:` prefix while the mapper uses a configurable one

- **Location:** `internal/platform/github/treewalk.go:154-165` (`hasExternalUnavailableLabel`)

```go
label = strings.TrimPrefix(label, "ft:")     // hardcoded
```

versus `LabelMapper.stripForMatch` (`labels.go:406-412`), which uses the configurable
`m.config.PushPrefix`. In a deployment configured with e.g. `push_prefix: "farmtable/"`, the label
`farmtable/stage/blocked` is recognised as a stage label by the mapper but **not** by the hold
check — so the `AvailabilityReasonHeld` guard silently stops working and held tasks report
available. It also ignores custom `cfg.Stages` aliases entirely.

Also worth noting: `t.HoldReason` is **never populated** by the GitHub store (no writer exists;
only the two read sites at `passthrough.go:576` and `:620`), so on this path the hold arm is driven
*entirely* by labels — making this helper the whole guard.

**Recommendation.** Make it a `*LabelMapper` method that reuses `stripForMatch`.

---

### [MEDIUM-4] Advertised availability ≠ enforced availability (relevant to the Phase 2 "trust absolutely" ruling)

- **Location:** `internal/store/entstore.go:1098-1121` vs `entstore.go:1208-1214`

`EntStore.ComputeAvailability` flags only triage, terminal, held, future-start, and blocked — so a
task in `working` / `in_review` / `in_qa` / `deploying` returns **`Available: true`**.
But `ClaimTask`'s conditional UPDATE requires `task.StageEQ(task.StageAccepted)`, so that same claim
is rejected with `ErrUnavailable`.

This is **fail-closed** and therefore not a security hole. But the brief states the Phase 2 web
client now trusts server availability absolutely with no defensive check. Under that ruling, the
native store will advertise in-progress tasks as claimable and the UI will offer a claim that
always fails. Note `MultiStore`'s fallback does *not* have this problem — its extra
`Phase==PhaseOpen && Stage==StageAccepted` conjunction makes advertised match enforced. The
canonical implementation is the loose one.

**Recommendation.** Consider aligning `computeAvailability` with the CAS predicate, or have the
Phase 2 client distinguish "available to claim" from "not blocked."

---

### [LOW-1] `TestIsTerminalStage_ClassifiesEveryStage` does not actually cover every stage — a new terminal stage would be silently non-terminal

- **Location:** `internal/store/terminal_availability_test.go:25-47`

The test name promises exhaustiveness, but the table is a hand-maintained list of 10 literals with
no link to the enum. `task.Stage` has exactly 10 values today (`ent/task/task.go:231-240`), so the
test is *currently* complete — but nothing keeps it that way.

**This is the masking risk the brief asked about.** If an 11th stage is added (say `StageObsolete`)
and intended as terminal, `IsTerminalStage`'s `default: return false` classifies it as
**non-terminal ⇒ available**, and **every test in this change still passes** — including the one
whose name asserts full coverage. The same applies to the hardcoded `terminalStages` slice
(`terminal_availability_test.go:17-22`) and its three copies in the server and github test files.

**Recommendation.** Pin the enum's cardinality so adding a stage forces a decision:

```go
// allStages must list every task.Stage value. Adding a stage to the enum
// without adding it here fails this test.
var allStages = []task.Stage{ /* ...10 values... */ }

func TestIsTerminalStage_CoversEveryEnumValue(t *testing.T) {
    var declared int
    for s := range map[task.Stage]bool{ /* ... */ } { _ = s; declared++ }
    // Simplest robust form: assert against the ent validator.
    for _, s := range allStages {
        if err := task.StageValidator(s); err != nil {
            t.Fatalf("allStages contains invalid stage %s", s)
        }
    }
    if got, want := len(allStages), 10; got != want {
        t.Fatalf("task.Stage has %d values, test table has %d — "+
            "a stage was added; classify it in IsTerminalStage", want, got)
    }
}
```

A cheaper variant that catches the same regression: a single
`if len(allStages) != 10 { t.Fatal("stage enum changed; reclassify") }` guard.

---

### [LOW-2] `noComputeStore` test double is fragile against a `Store` interface change

- **Location:** `internal/store/terminal_availability_test.go:96-99`

The helper relies on `ComputeAvailability` **not** being a member of `store.Store` — verified
correct today (`multistore.go:238-242` uses an ad-hoc structural type assertion, and
`ComputeAvailability` appears nowhere in the `Store` interface). The technique is sound and the
comment explains it well.

If `ComputeAvailability` is ever promoted into `store.Store`, `noComputeStore` would satisfy the
assertion via the embedded nil interface and panic. That fails **loudly**, not silently, so this is
informational rather than a masking risk — but a one-line compile-time guard would document the
dependency:

```go
var _ = func() any { // ComputeAvailability must stay off the Store interface
    var s store.Store
    type hasCompute interface{ ComputeAvailability(context.Context, *ent.Task) (store.TaskAvailability, error) }
    if _, ok := s.(hasCompute); ok { panic("noComputeStore is no longer a non-computer") }
    return nil
}
```

---

### [LOW-3] Terminal tasks can be reopened and then claimed — by design, but worth recording

- **Location:** `internal/server/transitions.go:74-113`, rule 3: `from: stagesTerminal → to: nil`
  = `ScopeTaskAccept`

A terminal task can be transitioned back out via `UpdateTask` with `task:accept`, then claimed.
Per `DefaultScopesForUserType` (`internal/server/scopes.go:118-146`), the `agent` user type does
**not** hold `task:accept`; `reviewer`, `orchestrator`, `admin`, `human`, and `service_account` do.
Direct terminal→`working` is separately refused (`server.go:531-534`), forcing a deliberate
two-step. This looks intentional and correctly scoped.

One hygiene note: `EntStore.UpdateTask` (`entstore.go:848-853`) sets phase and stage on reopen but
never clears `ClosedAt` (only `CloseTask` writes it, `entstore.go:1323`), so a reopened task is
claimable while still carrying a close timestamp. Cosmetic, but it would undermine any future
`ClosedAt`-based guard — including the one I recommend for HIGH-1.

---

## Info

- **`isTerminalStage` → `IsTerminalStage` widens the package API.** Negligible: the package is under
  `internal/`, so it is unimportable outside the module. The doc comment's explicit "this is NOT the
  same concept as a CloseTask close target, nor `phaseForStage`" warning is genuinely valuable —
  those are the two most likely mistaken reuses, and both enumerate the same four stages today
  (`entstore.go:1289`, `server/convert.go:67`, `github/labels.go:425`).
- **`ClaimTaskRequest.Stage` and `.Reason` are silently ignored.** Both CLI
  (`internal/cli/task.go:735-748`) and MCP (`internal/mcp/server.go:488-497`) populate them; the
  handler (`server.go:701-753`) reads only `Id`, `AssigneeId`, `Version`.
  `ft task claim --stage in_review --reason "..."` returns success having done neither.
- **Scope checks fail open when a token carries zero scopes** (`scopes.go:76-84`, "nil/empty scopes
  = wildcard"), and `DefaultScopesForUserType` returns wildcard for unrecognised user types
  (`scopes.go:139-145`). Intentional backward compatibility; flagged only because the `task:accept`
  gate in LOW-3 is exactly as strong as scope provisioning.
- **Pre-existing flaky test, unrelated to this diff.** `TestWatchTasks_CreatedEvent`
  (`internal/server/watch_test.go:153`, "timed out waiting for event") failed on 1 of 4 runs.
  The diff touches no watch code. Worth a separate issue; it will erode trust in CI signal for
  exactly the kind of gate this change is trying to protect.

---

## Positive observations

- **The refactor is correct and the tests are the good part.** Four hand-copied predicates folded
  onto one exported function with zero semantic drift, and — more valuable — the two properties
  unique to the strictest implementation (`PhaseClosed` arm, `open+accepted` conjunction) went from
  *completely unpinned* to explicitly tested. That is a real reduction in the chance of a future
  silent weakening.
- **`assertTerminalUnavailable` is well designed**: requiring `terminal` to be the *sole* reason
  means a broken terminal arm cannot be masked by an unrelated reason firing. The paired
  "non-terminal stages are not terminal" tests correctly guard the other direction, so a mutation
  marking everything terminal is caught too. This is better than most tests of this kind.
- **`EntStore.ClaimTask` is an exemplary authorization gate** (`entstore.go:1169-1268`): availability
  computed *inside* the transaction against `tx.Task.Get`, every arm re-asserted as a conditional
  UPDATE, a version compare-and-swap, a bounded single retry only when no version was supplied, and
  an accurate error taxonomy on the lost race. No TOCTOU window. The terminal arm is enforced twice
  — once by the predicate and once structurally by `task.StageEQ(task.StageAccepted)`.
- **`ClaimTask` refuses a caller-supplied `assignee_id`** (`server.go:722-725`), forcing
  self-assignment from the authenticated identity. Claim-on-behalf-of is not possible over the RPC.
- **The transition table's ordering is deliberate and correct** — the triage rule sits above the
  claim rule specifically so no destination stage can launder a task out of triage without
  `task:accept` (`transitions.go:82-84`).
- **GitHub GraphQL is fully parameterized** (`graphql_queries.go:99-123`, `labels: $labels` bound as
  a variable), labels resolve to opaque GitHub IDs before mutation, and OAuth2 uses
  `oauth2.NewClient` with default TLS verification (`graphql.go:21-22`). I found **no injection
  vector** in the label path: all consumption is exact-match map lookup after
  `ToLower`/`TrimSpace`/`TrimPrefix`, with no regex, `exec.Command`, or SQL string building.
- **`MultiStore`'s `PhaseClosed` quirk is annotated against accidental "simplification"**
  (`multistore.go:247-250`) — precisely the comment that prevents the next person from introducing
  the bug this audit was asked to look for.

---

## What I checked (coverage statement)

Verified directly, by reading source and running code:

- Full `git diff origin/main...HEAD` — every changed line in all 4 source files and all 3 test files.
- Line-by-line semantic equivalence of all four consolidated call sites (Q1), including boolean
  equivalence of the rewritten `multistore.go:250` disjunction (Q2).
- Repo-wide grep for every other enumeration of the four terminal stages
  (`StageWontFix|wont_fix` across `.go`/`.ts`/`.tsx`/`.sql`), classifying each hit as consolidated,
  deliberately excluded, or missed → produced MEDIUM-1.
- `task.Stage` enum cardinality (`ent/task/task.go:231-240`, `StageValidator:248`) against the new
  tests' hardcoded tables → produced LOW-1.
- That `ComputeAvailability` is not on the `store.Store` interface, confirming the `noComputeStore`
  double really does exercise the MultiStore fallback branch → LOW-2.
- `IssueToPhaseStage` label-vs-state precedence, `stripForMatch`, `stagePrecedence`,
  `hasExternalUnavailableLabel`, `phaseForStage` (Q3).
- **PoC executed and independently reproduced** for HIGH-1 (temporary test, run, deleted;
  `git status` clean afterward).
- `GitHubPassThroughStore.ClaimTask` / `CloseTask` / `ComputeAvailability` in full.
- `EntStore.ClaimTask` transaction, CAS predicate, and retry logic.
- `internal/server/transitions.go` rules out of terminal stages, and `scopes.go` scope assignment.
- `go build ./...` clean; `./internal/store/...` and `./internal/platform/github/...` pass;
  `./internal/server/` has one pre-existing flake (see Info).

**Not covered:** no live GitHub instance, so HIGH-1/HIGH-2 were confirmed against the mapping and
availability logic rather than end-to-end through the GitHub API; GitHub's default ordering for the
`labels(first: 20)` connection (`graphql_queries.go:29`) was not verified, so I did not pursue
whether label-count overflow could evict a `blocked`/`wont_fix` label from the fetched window — that
is worth a look independently. No Postgres, so integration tests were not run. Zero web files in the
diff, and the Phase 2 client was not in this tree, so the "trust availability absolutely" ruling was
assessed only from the server side.

---

## Recommendations, in priority order

1. **File HIGH-1 and HIGH-2 as blockers for the Phase 2 web client**, not for this diff. Once the
   client has no defensive check, these two are the only things between a caller and a terminal
   task, and HIGH-2 fires on the normal happy path.
2. **Fold `treewalk.go:104` into `store.IsTerminalStage`** (MEDIUM-1) — it is a two-line change and
   finishes the job #191 started. If it is deliberately excluded, say so in the design log alongside
   the other documented exclusions.
3. **Add the enum-cardinality guard to the new tests** (LOW-1). Cheapest durable improvement in this
   report: it converts "a future terminal stage is silently claimable" from invisible into a build
   failure.
4. Fix the pass-through `ClaimTask` fail-open and ignored `assigneeID`/`version` (MEDIUM-2).
5. Decide whether advertised availability should match enforced availability (MEDIUM-4) before the
   client starts trusting it absolutely.
