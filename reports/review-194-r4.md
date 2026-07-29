# #194 `close-label-swap` @ `03ab6b6` — round-4 CODE REVIEW

Reviewer: code-reviewer (code-review leg, round 4)
Clone: `/workspace` @ `03ab6b6`, clean at start and at finish.
Diff under review: `651da26..03ab6b6`, production files `internal/platform/github/labels.go`
and `internal/platform/github/passthrough.go`; tests in
`internal/platform/github/terminal_label_stage_test.go` and
`internal/server/authz_terminal_reopen_test.go`.

Every claim below is labelled **BY EXECUTION** or **REASONED**.

---

## Executive Summary

The 60-line production change is **correct for the function it changes**: the direct
scan, the tie resolution, and the `!m.enabled` guard all hold under measurement, and the
new test file is the best-constructed thing in this workstream so far. Risk level:
**HIGH** — not because of what the diff does, but because of two things it asserts and
one thing it leaves fail-open.

I found, by execution: (a) a **live scheduling bypass of exactly the round-4 class** in
`internal/platform/github/treewalk.go`, reached by `ft ready` on a pass-through
collection, which the diff's own new comment implies is covered; (b) a **fail-open** in
the new tiebreak loop — a terminal stage present in the label set but absent from
`terminalStagePrecedence` is silently dropped and reported non-terminal; and (c) that
**all four new pins pass vacuously** when a stage is added to the `task.Stage` enum,
because they are rooted in the hand-maintained `allStages` slice rather than the proto
enum the repo already derives from in two other test files.

Verdict: **REQUEST CHANGES**.

---

## Gate results — BY EXECUTION

All four run as separate child processes; exit codes captured from the child, never
through a pipe (`{ cmd > log 2>&1; echo $? > rc; }`).

```
go build ./...    rc=0
go test ./...     rc=0    0 failures
make race         rc=0    0 data races   (target exits 2, not 1, on failure)
go vet ./...      rc=1    exactly 4 findings, ALL internal/server/server.go
                          :1516 :1626 :1834 :2011, all "copies lock value to ephReq",
                          all pre-existing, none in a touched file
git status --porcelain    empty (start and finish)
```

**I agree with the shared brief's gate results exactly.** No disagreement to report.

Two observations on the gate itself, neither blocking:

- `make race` is scoped to `./internal/platform/github/` only (`Makefile:19-20`, with a
  comment explaining the scoping). Round 4 added ~840 lines of new tests to
  `internal/server`, which the detector therefore never sees. Those tests are
  sequential, so I do not think this hides anything today — but the round-4 fixture
  (`terminalLabelIssueMock`) does carry a `sync.Mutex` and serves an `httptest.Server`,
  which is the shape the race target exists for. **REASONED.**
- Under a mutation (MUT-2, below) `TestWatchTasks_NoInitial` failed with a 5.01s
  timeout. It passes 3/3 at baseline (**BY EXECUTION**), so I record it as a
  timing-sensitive test, not a finding against this diff.

---

## Critical

### C1. `ft ready` still schedules terminal-labelled work when any second stage label is present — the round-4 class, unfixed, in a path this diff's new comment describes as filtered

**`internal/platform/github/treewalk.go:36`, `:53`, `:92`, `:105`; asserted-about at
`internal/platform/github/passthrough.go:813-820` (new in this diff).**

**Disclosure of overlap first.** This is adjacent to disclosed item **#202** ("make `ft
ready` and MCP `task_ready` inherit one availability answer"). I am not re-filing #202.
What is new here is narrower and sharper: the substitute filter `ft ready` uses instead
of availability **reads a precedence-collapsed label projection**, which is the exact
anti-invariant round 4 was written to establish, and it is bypassable by adding one
ordinary label. #202 as disclosed reads as a consistency/plumbing item; measured, it is a
live bypass. If that was already understood, treat this as evidence for its severity
rather than as a new finding.

**The path.** `GitHubPassThroughStore.GetReadyTasks` (`passthrough.go:975-1002`) calls
`buildIssueTree` → `MapLabelsToStage` (`treewalk.go:36`) → `computeReady`, which asks
terminal-ness of the collapsed winner at `treewalk.go:105` and asks
`node.Stage == StageAccepted` at `treewalk.go:92`. `TerminalLabelStage`'s new direct scan
is not on this path at all. `ft ready` reaches it via `internal/cli/graph.go:38-57` →
`GetReadyTasks` RPC. **REASONED** for the call chain (read, not driven end-to-end);
**BY EXECUTION** for the behaviour of `buildIssueTree` + `computeReady`.

**Measured.** Probe salvaged to
`/scion-volumes/scratchpad/projects/farmtable/salvage/review194r4_treewalk_cardinality_probe_test.go`.
It carries a harness self-check that fails closed (asserts the node actually carries the
requested number of labels, and asserts `TerminalLabelStage` agrees the set is terminal)
so a negative row cannot be vacuous.

```
labels=[ft:stage/completed]                         TerminalLabelStage=("completed",true)  ready=[]     PASS
labels=[ft:stage/wont_fix]                          TerminalLabelStage=("wont_fix",true)   ready=[]     PASS
labels=[ft:stage/duplicate]                         TerminalLabelStage=("duplicate",true)  ready=[]     PASS
labels=[ft:stage/cancelled]                         TerminalLabelStage=("cancelled",true)  ready=[]     PASS
labels=[ft:stage/completed ft:stage/accepted]       MapLabelsToStage="accepted"            ready=[1]    BYPASS
labels=[ft:stage/wont_fix  ft:stage/accepted]       MapLabelsToStage="accepted"            ready=[1]    BYPASS
labels=[ft:stage/duplicate ft:stage/accepted]       MapLabelsToStage="accepted"            ready=[1]    BYPASS
labels=[ft:stage/cancelled ft:stage/accepted]       MapLabelsToStage="accepted"            ready=[1]    BYPASS
labels=[ft:stage/wont_fix  ft:stage/triage]         MapLabelsToStage="triage"              ready=[1]    BYPASS
labels=[ft:stage/wont_fix  ft:stage/working]        MapLabelsToStage="working"             ready=[1]    BYPASS
labels=[ft:stage/accepted  ft:stage/wont_fix]       MapLabelsToStage="accepted"            ready=[1]    BYPASS
labels=[ft:stage/wont_fix  ft:stage/duplicate]      MapLabelsToStage="wont_fix"            ready=[]     PASS
```

7 of 12. Every cardinality-1 row passes; that is precisely why the shipped tree-walk
fixture cannot see it. **BY EXECUTION.**

**Why the existing tests miss it.** `openParentWithClosedChildIssues` at
`internal/platform/github/reopen_test.go:252` takes a **single label `string`**, not a
set. This is the identical fixture defect the shared brief names in standing bar 3 and
that the round-4 authz tests were rewritten to eliminate — it is still present, unfixed,
on the tree-walk half. `TestComputeReady_OpenTerminalLabelledIssueIsNotReady`
(`reopen_test.go:288`) iterates four labels one at a time and therefore cannot express
cardinality ≥ 2. **BY EXECUTION** (the fixture signature; and my probe passes on exactly
the rows that fixture can build).

**Comments that assert the opposite.** Two, one of which is in this diff:

1. `passthrough.go:815-817` (new in this diff): "`ft ready` does not — it goes through
   GetReadyTasks, which filters server-side before this value would ever reach a
   client". Literally true about the plumbing. But it names `GetReadyTasks` as the reason
   the arm's insufficiency is acceptable, and `GetReadyTasks` applies the bypassable
   filter. A reader takes away "covered elsewhere."
2. `internal/platform/github/treewalk_test.go` (added in `4ea2fc8`, outside this diff):
   "Different mechanisms, same outcome: an OPEN issue carrying a terminal label is never
   scheduled." **That sentence is false.** It is the workstream's repeated defect — a
   property that holds for one consumer stated as if it held for all — one instance of
   which this very diff corrects in `ComputeAvailability`.

**Suggested fix.** Make the tree walk ask the same question the rest of the system now
asks. In `buildIssueTree`, resolve the node's stage as:

```go
stage, _ := mapper.MapLabelsToStage(labels)
if term, ok := mapper.TerminalLabelStage(labels); ok {
    stage = term
}
```

That is the minimal change and it inverts the collapse only where terminal-ness is
present, which is the invariant. Then extend `openParentWithClosedChildIssues` to take
`labels ...string` and add cardinality-2 rows — the salvaged probe is drop-in.

If the team prefers to defer to #202 and route `GetReadyTasks` through
`ComputeAvailability` instead, say so explicitly in the round-4 log and **fix the two
false comments in this round**, because they are what makes the gap invisible to the next
reader. Leaving the code and leaving the comments is not an option I can approve.

---

## Required

### R1. The new tiebreak loop **fails open**: a terminal stage present in the set but absent from `terminalStagePrecedence` is dropped and reported non-terminal

**`internal/platform/github/labels.go:517-525`.**

```go
for _, s := range terminalStagePrecedence {
    if present[s] {
        return s, true
    }
}
return "", false
```

`present` is populated by `store.IsTerminalStage`. `terminalStagePrecedence` is a
separate hand-maintained list. When the two disagree — `present` says terminal,
the list does not rank it — the function returns `("", false)`: the exact value the seam
exists to avoid, for a label set that demonstrably names a terminal stage.

Contrast `MapLabelsToStage`, which for the identical situation has a fallback
(`labels.go:213-216`, "Shouldn't happen, but return the first candidate found"). The
security-critical function is the one *without* the fallback.

**MUT-1, BY EXECUTION.** Content-addressed mutation removing `task.StageCancelled` from
`terminalStagePrecedence` (anchor asserted unique; backup outside the repo; restored,
`git status --porcelain` empty, and the line positively re-asserted present afterwards):

```
TerminalLabelStage([ft:stage/cancelled])                      = ("", false)
TerminalLabelStage([ft:stage/cancelled ft:stage/accepted])    = ("", false)
```

A `wont_fix`-class label, unmasked, invisible to the gate. To the pin's credit,
`TestTerminalStagePrecedence_CoversEveryTerminalStage` **did** fail under MUT-1 with a
precise message — see R2 for the case where it does not.

**Suggested fix.** Make the tiebreak total by construction so that completeness of the
list stops being a safety precondition:

```go
for _, s := range terminalStagePrecedence {
    if present[s] {
        return s, true
    }
}
// Any terminal stage not named in terminalStagePrecedence is a data-model
// change that did not reach this file. Fail CLOSED: report terminal, and pick
// deterministically so one unchanged issue cannot get two answers.
if len(present) > 0 {
    unranked := make([]string, 0, len(present))
    for s := range present {
        unranked = append(unranked, s.String())
    }
    sort.Strings(unranked)
    return task.Stage(unranked[0]), true
}
return "", false
```

This is four lines and it removes the entire class. It also **moots the design argument
in charge item 2** — see the outside view below.

### R2. All four new pins pass vacuously when a stage is added to the `task.Stage` enum, because they are rooted in `allStages` rather than the proto enum

**`internal/platform/github/terminal_label_stage_test.go:37-57` (`nonTerminalStages`,
`terminalStages`), `:76-83` (the `!= 4` / `!= 6` count pins), `:285-300` (the coverage
pin), `:270-279` (the `stagePrecedence` completeness loop).**

Every one of them iterates `allStages` — a hand-maintained `[]task.Stage` in *production*
code at `labels.go:65`. Nothing anywhere pins `allStages` against the ent/proto enum.
**BY EXECUTION** (`grep`: `allStages` has no completeness test).

The repo already has the right pattern, twice: `internal/server/transitions_internal_test.go:13`
and `internal/store/terminal_availability_test.go:20` both build their stage list from
`pb.TaskStage_name` with the comment "derived from the proto enum so a stage added to the
data model shows up here without touching this test." The new file did not follow it.

**MUT-2 — the exact trace charge item 2 asked for. BY EXECUTION.** Add a tenth stage to
the data model: `StageObsolete Stage = "obsolete"` in `internal/store/ent/task/task.go`
(const block + `StageValidator`), and add it to `store.IsTerminalStage` in
`internal/store/entstore.go`. Author forgets `allStages`, `stagePrecedence`, and
`terminalStagePrecedence` — three hand lists in a file they were not editing. Three
content-addressed mutations, anchors asserted unique, backups outside the repo, restored,
`git status --porcelain` empty and `grep -c StageObsolete` = 0 in both files afterwards.

```
go test ./internal/platform/github/     rc=0   ok   ← WHOLE PACKAGE GREEN
go test ./internal/store/               rc=0   ok

--- PASS: TestTerminalLabelStage_MaskedByEveryNonTerminalLabel
--- PASS: TestTerminalLabelStage_Cardinality
--- PASS: TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast
--- PASS: TestTerminalStagePrecedence_CoversEveryTerminalStage    ← the pin, vacuous

IsTerminalStage(obsolete) = true
labels=[shelved]                       TerminalLabelStage=("",false)  MapLabelsToStage="obsolete"
labels=[shelved ft:stage/accepted]     TerminalLabelStage=("",false)  MapLabelsToStage="accepted"
```

(`shelved` reaches `labelToStage` through the documented custom-mapping path
`cfg.Stages` at `labels.go:141-148`, which validates against `StageValidator` — the enum —
**not** against `allStages`. So this is not a contrived input; it is the supported way an
operator names a stage label.)

Read the last two lines together: the **display** path sees `obsolete`, and the
**privilege** path sees nothing. That is the #194 inversion, reintroduced, with every new
pin green. `terminalStages(t)` derives from `allStages`, `allStages` lacks the stage, so
the coverage pin iterates four elements and finds four — a cardinality assertion over a
foreclosed schema, which is the failure mode the brief's standing bar 4 names.

**So, to answer the charge directly:**

| case | caught? |
|---|---|
| terminal stage added to `allStages` + `IsTerminalStage`, forgotten in `terminalStagePrecedence` | **Yes** — MUT-1: the coverage pin fails, and the `len(terminals) != 4` count pin fails first with a clear message |
| terminal stage added to the enum + `IsTerminalStage`, forgotten in `allStages` | **No** — MUT-2: whole package green, and the consequence is R1's fail-open |

The pin is sufficient for the failure the author was imagining and insufficient for the
one that is more likely, because `allStages` lives in a different package from the enum.

**Suggested fix.** Two lines of change, either is enough:

- Preferred: build `terminalStages`/`nonTerminalStages` from `pb.TaskStage_name` +
  `convert.StageFromProto`, exactly as `transitions_internal_test.go:13` does, and drop
  the dependency on `allStages`; **or**
- Add one test asserting `allStages` covers every value the enum admits. That fixes
  `stagePrecedence`'s completeness loop at the same time, which has the identical
  blind spot.

Do R1 as well as R2. R2 alone converts a silent fail-open into a red test at the moment
someone touches the enum; R1 makes the runtime behaviour safe even if nobody runs the
tests.

### R3. `fixtureStages()`'s doc comment claims a derivation it does not perform

**`internal/server/authz_terminal_reopen_test.go:56-65`.** The comment says "Built from
the production mapper rather than hard-coded strings so that a push_prefix change cannot
desynchronise fixture from production." The *label strings* are (via `stageLabel`); the
*stage list* is ten hard-coded constants. Same for `terminalLabels()` (`:297`),
`maskLabels()` (`:308`), `reopenDestinations()` (`:280`) — four hand-maintained stage
lists in one file, in a file whose header is an extended argument about fixtures that
cannot express the input domain. **BY EXECUTION** (read).

Required rather than Nit because this is the same claim-vs-code mismatch as R2 and C1, in
a file that will be the reference for the next author. Either derive them from
`pb.TaskStage_name` (which also makes the `4*5*7` pin fire on a new stage), or change the
comment to say the list is hand-maintained and must be updated.

---

## The design decision — outside view on `terminalStagePrecedence` vs filtering `stagePrecedence`

You asked for this to be checked rather than accepted. My finding: **the dev's argument is
right and the auditor's is right, and they were arguing about the wrong axis.**

The decoupling argument holds. `stagePrecedence` answers "which badge?"; reordering its
tail is a display change that a reviewer would wave through, and under a filtered
derivation that reorder silently changes which stage `TransitionScope` sees as `from` —
which matters, because of the `from == to` short-circuit (known residual R-B). The guard
test `TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast` deliberately constrains
only terminal-vs-non-terminal and says nothing about order *among* terminals, so under
filtering the privilege answer would be unpinned. The dev is correct that two questions
want two declarations, and the code comment at `labels.go:43-56` states it well.

**But the cost the dev accepted is not the cost he described.** He describes the cost as
"a second list that must be kept complete, and there is a test pinning coverage." MUT-2
shows the pin does not cover the likely case (R2), and MUT-1 shows the consequence of
incompleteness is a **fail-open** (R1). And filtering would *not* have avoided this:
`stagePrecedence` is also hand-maintained and also pinned only against `allStages`, so a
filtered derivation has the identical hole. **The safety difference between the two
designs is zero.** The whole debate was about coupling, and coupling is a maintainability
property, not a safety one.

**The move that actually resolves it** is R1: make the tiebreak total by construction. Once
an unranked terminal stage cannot be dropped, list completeness stops being a safety
precondition and becomes a mere determinism preference — at which point the dev's
decoupling argument wins cleanly on its own merits and the second list is unambiguously
the right call. Keep `terminalStagePrecedence`. Add the fail-closed fallback. Fix the
pin's root. Then the design is defensible for the reason the dev gave, instead of despite
it.

---

## Comments as claims — item-by-item

| # | Claim | Where | Verdict |
|---|---|---|---|
| 1 | "THIS ORDERING IS A DISPLAY RULE. AUTHORIZATION MUST NOT DEPEND ON IT." | `labels.go:13` | **True and now enforced for authorization** — `TerminalLabelStage` does not read `stagePrecedence`. **BY EXECUTION** (grep: only `MapLabelsToStage:207` reads it). But scheduling still does, via `treewalk.go:105` — see C1. The sentence is defensible only because it says "authorization"; the workstream treats scheduling as an in-scope sink. Recommend widening it to "authorization or scheduling" *and* making that true. |
| 2 | "Terminal-ness is a property of the SET, not of the precedence winner." | `labels.go:492-494` | **True of this function. False of the codebase.** `treewalk.go:105` asks terminal-ness of the precedence winner for a scheduling decision. The claim sits in a doc comment about this function, so read narrowly it is fine; read as the invariant the diff's own commit message says it establishes ("at the root"), it overstates. **BY EXECUTION** (C1 probe). |
| 3 | `!m.enabled`: "with label mapping off, IssueToPhaseStage also declines to map labels, so no demotion happens and the task's own Stage is already authoritative." | `labels.go:496-501` | **True, and correctly reasoned.** Verified: with `Enabled=false`, `MapLabelsToStage` returns `("",false)` at `labels.go:189`, the open branch at `:453` falls through to `StageAccepted`, and the closed branch at `:419-428` falls to the `stateReason` default. Producer and consumer are gated by one flag; declining is symmetric. `TestTerminalLabelStage_DisabledMapperDeclines` asserts the premise, not just the conclusion, plus an enabled control — this is the best-constructed test in the diff. **BY EXECUTION.** |
| 4 | "Note this cannot be delegated to MapLabelsToStage's own `!m.enabled` check any more — the scan below reads `m.labelToStage`, which is populated regardless." | `labels.go:499-501` | **True.** `NewLabelMapper:133-148` populates `labelToStage` unconditionally. The guard is genuinely load-bearing and the comment is right to say so. **BY EXECUTION.** |
| 5 | Claim 3's "the task's own Stage is already authoritative" | `labels.go:497-498` | **True today only because `TerminalLabelStage` has exactly one production caller** (`passthrough.go:784`), and nothing pins that. It is a statement about a *store*'s invariant, written in a doc comment on a *mapper* method that knows nothing about tasks. Not wrong; just load-bearing on something outside the file. FYI-level — see F2. |
| 6 | "`ft ready` … goes through GetReadyTasks, which filters server-side" | `passthrough.go:815-816` | **Literally true, materially misleading.** See C1. |
| 7 | "the MCP `task_ready` tool calls that same RPC and drops the field" | `passthrough.go:816-817` | **True.** `internal/mcp/server.go:638-661` builds a `GetReadyTasksRequest` and calls the same RPC; no availability handling in that file. **BY EXECUTION** (grep). |
| 8 | "`TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast` pins the ordering" / "`TestTerminalStagePrecedence_CoversEveryTerminalStage` pins that" | `labels.go:29`, `:61-62` | **Both tests exist and both do what is claimed — within the schema they can express.** The second is vacuous under MUT-2 (R2). The comment should say what the pin can and cannot see, which is the standard this diff's own test file sets at `terminal_label_stage_test.go:64-70`. |

Net: the diff's prose is unusually careful and mostly earns its length. The two places it
overstates are both about **other consumers**, which is the workstream's known defect
class, and one of them (#6) is load-bearing for C1 staying invisible.

---

## The tests as code

**The 140-cell matrix is comprehensible and it is not 140 hand-written cells.** It is
three named generators — `terminalLabels()`, `reopenDestinations()`, `maskLabels()` —
crossed in a triple loop at `authz_terminal_reopen_test.go:360-404`. A reader holds three
concepts, not 140. Runtime is **0.44s for all 140 cells** including 140 fresh EntStores
and httptest servers (**BY EXECUTION**: `go test -run TestUpdateTask_Terminal… -v` →
`ok … 0.442s`, 140 leaves). No performance concern.

**Self-documenting about what it can and cannot express: yes, and this is the best thing
in the diff.** `:324-342` states the schema in the affirmative and the negative
("CAN express… CANNOT express: two masks at once, non-stage labels, unprefixed labels,
closed issues with a state_reason, or which terminal stage wins when several are
present"), names where each excluded axis *is* covered, and — the part I'd single out —
`:337-342` discloses that four rows pass *for the wrong reason* (the `triage` mask makes
`triage → anything` independently require `task:accept`) and keeps them anyway with the
reason stated. That is a reviewer telling on their own coverage. Likewise `:721-729`
records that only 4 of 28 claim-gate cells actually bypassed under round 3 and *why*
(`issueUnavailableForClaim`'s first arm is a positive whitelist), and that the other 24
are there to catch a future rewrite. That is the opposite of a count pin wearing a number.

**Can the next person add a stage without rewriting it? Partly — and the gap is R2/R3.**
Adding a stage to `maskLabels()` or `terminalLabels()` trips `got != wantCells` at `:351`
with a message naming the three dimensions, so the `4*5*7` constant is a working forcing
function. Adding a stage to the *enum* and forgetting the helper trips nothing. The fix is
the same as R2: derive the lists.

**Other observations, non-blocking:**

- `-run` targeting of a single cell works despite `/` in subtest names (**BY EXECUTION**:
  `-run 'Test…/ft:stage/wont_fix_to_triage_unmasked'` selects exactly one leaf). No issue.
- `nonTerminalStages(t *testing.T)` / `terminalStages(t *testing.T)`
  (`terminal_label_stage_test.go:37`, `:48`) take `*testing.T` and use it only for
  `t.Helper()` — they assert nothing. The repo's `allStages(t)` pattern takes `t` because
  it *validates*. Cosmetic; noted because if you take the R2 fix you'll add a validation
  and the parameter earns itself.
- `TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue` (`:433`) as a
  differential on one fixture — deny without the scope, allow with it, then assert the
  *labels* changed rather than the returned proto (because the response is built pre-swap)
  — is the right construction and closes the round-3 F3 hole properly.
- `TestClaimTask_…`'s `sameLabels(before, after)` (`:773`) rather than "no working label",
  with the reason given (one of the masks *is* the working label), is the kind of care
  that was missing in earlier rounds.

---

## Nit / Optional

- **Optional.** `MapLabelsToStage` has a map-iteration fallback for the unranked case
  (`labels.go:213-216`); `TerminalLabelStage` has none. Once R1 lands, consider a short
  cross-reference comment on both so the asymmetry (one returns *something*
  non-deterministically, one must return *something* deterministically) is deliberate on
  the page.
- **Nit.** `labels.go:466-504` is now a 38-line doc comment on a 20-line function, roughly
  a third of it re-narrating round-3 history that also lives in
  `.design/project-log/close-label-swap-r4-multilabel-bypass.md` and in the test file
  header. The two paragraphs that must stay are "MUST NOT be reimplemented on top of
  MapLabelsToStage" and the `!m.enabled` symmetry. The incident numbers could be one line
  pointing at the log.

---

## FYI

- **F1.** `store.IsTerminalStage` is duplicated as an inline switch at
  `internal/store/entstore.go:1297` and as `phaseForStage` at
  `internal/platform/github/labels.go:551-559`. With `terminalStagePrecedence` there are
  now **five** places that must agree about which stages are terminal. Outside the diff;
  raising because R2's fix would be cheapest if it also pinned these against one source.
- **F2.** The `!m.enabled` correctness argument (claim 3 above) is sound but depends on
  `TerminalLabelStage` having exactly one production caller, a pass-through store. If a
  second caller appears whose `t.Stage` is not label-derived, the "the task's own Stage is
  already authoritative" premise stops holding and nothing will notice. Consider one line
  in the doc comment naming `GitHubPassThroughStore.LifecycleStage` as the assumed caller.
- **F3.** I did **not** drive C1 through the gRPC `GetReadyTasks` RPC end to end. I proved
  `buildIssueTree` + `computeReady` by execution and read the rest of the chain
  (`passthrough.go:984-995` appends `readyNodes` straight through with no further terminal
  filter; `internal/cli/graph.go:38-57` is the CLI entry). If you want the end-to-end
  version before acting, that is a reasonable ask and the salvaged probe is the starting
  point — but the collapsed projection at `treewalk.go:36` is not in dispute.
- **F4.** On round 5: the disclosed control — "when `AddLabels`/`RemoveLabels` are present,
  compute the lifecycle stage of the post-mutation label set and require the corresponding
  transition scope" — is the right shape and I have no objection to its sequencing. One
  note: it will not help C1, because the tree-walk read is downstream of *any* label state,
  trustworthy or not. C1 needs the `treewalk.go` fix regardless of R-A and R-B.

---

## Positive Feedback

Specific, not manufactured:

- `TestTerminalLabelStage_DisabledMapperDeclines`
  (`terminal_label_stage_test.go:196-224`) asserts the *premise* of the safety argument
  (`MapLabelsToStage` also declines; `IssueToPhaseStage` demotes nothing) rather than just
  the conclusion, and carries an enabled control so it cannot pass because the labels were
  malformed. That is how a guard test should be built.
- The schema-disclosure blocks at `terminal_label_stage_test.go:64-70` and
  `authz_terminal_reopen_test.go:324-342` are the right answer to standing bar 4, and the
  `triage`-mask disclosure at `:337-342` is a reviewer volunteering that four of their own
  cells pass for the wrong reason. Keep that habit.
- `terminalLabelIssueMock` being genuinely stateful (`:82-182`) is what makes
  `TestUpdateTask_SelfServiceLabelAdditionCannotUnlockAReopen` a real two-call chain rather
  than the inexpressible-not-disproven case the brief warns about; the fixture even
  self-checks statefulness at `:598-605` before relying on it.
- Correcting the false `ComputeAvailability` comment (`passthrough.go:813-820`) rather than
  quietly leaving it was the right instinct. The finding in C1 is that the *replacement*
  reproduces the same defect one consumer over — not that the correction was wrong to make.

---

## Test Coverage

New production paths are covered at the predicate level
(`terminal_label_stage_test.go`, cardinality 0/1/2/conflicting/duplicate, both label
orders) and at three sinks end-to-end (authorization 140 cells, availability 28, claim
28). Gaps, all named above: the tree-walk sink is uncovered at cardinality ≥ 2 (**C1**);
the tiebreak's unranked-stage branch is uncovered and fails open (**R1**); every pin is
blind to an enum addition (**R2**).

## Backward Compatibility

No wire-format change, no proto change, no removed field, no signature change.
`TerminalLabelStage` keeps its `(task.Stage, bool)` signature. The only behavioural
changes are (a) it now returns `true` for label sets it previously returned `false` for —
strictly more restrictive at every gate, which is the intent — and (b) a disabled mapper
now declines where previously it also declined via delegation (no change). R1's suggested
fix would widen (a) slightly further, in the same safe direction.

---

## Final Verdict

**REQUEST CHANGES**

Blocking: **C1**, **R1**, **R2**, **R3**.

R1 + R2 are ~10 lines between them and are the ones I would land first — they close the
class rather than an instance. C1 is the one that is live today. R3 is a comment or a
three-line derivation, your choice.

Non-blocking recommendations (Optional/Nit/FYI) can go to a cleanup pass.

I have not modified production code. `git status --porcelain` is empty at `03ab6b6`; both
mutation experiments were content-addressed with uniqueness asserted, backed up outside
the repo to `salvage/r4-backup/`, restored, and verified both by an empty `git status`
**and** by positively re-asserting the restored property.
