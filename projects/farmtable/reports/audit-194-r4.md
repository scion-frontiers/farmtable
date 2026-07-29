# Security Audit — Farm Table #194, Round 4

**Target:** branch `close-label-swap`, SHA `03ab6b63287b29b079afac30f7a0fb345052a521`
("Fix #194 multi-label terminal bypass at the root")
**Leg:** security audit (independent; code-review and test legs not read)
**Date:** 2026-07-28

## VERDICT: REQUEST CHANGES

The Critical **is** closed. I confirmed that independently and went past the
round-3 PoC in both directions it was blind in (multi-call, and destination-
varying): **156 server-level authorization cells, 0 bypass lines**, on a harness
proven able to express both success and failure.

I am nonetheless requesting changes, on three grounds that are not R-A and not
R-B:

1. **The same defect the fix removes from authorization is still present, in the
   same package, in `computeReady`** (F1). It is latent today only because the
   code path has no production construction site — and the disclosed remediation
   for #202 is exactly what wires it up. The fix hardened three sinks; there is a
   fourth reading the display projection.
2. **The new tiebreak is not safe** (F2). Charge 3 asked what an attacker gains
   by choosing the terminal source. The answer is six real terminal→terminal
   conversions with `task:write` alone, and — the part that is beyond R-B —
   **the order of `terminalStagePrecedence` is what selects which six**, and in
   realistic label states the attacker needs no label write at all.
3. **On GitHub-backed tasks there is no audit trail of any kind** (F3), so the
   self-erasing property the charge asked about is not incidental to one bypass.
   It is total, and it is a property of every label-mediated transition.

### Severity summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 2 |
| Medium   | 3 |
| Low      | 2 |
| Info     | 1 |

---

## Charge 1 — Is the Critical actually closed?

### Yes. BY EXECUTION.

**Gate reproduction** (exit codes captured from the child process, never through
a pipe; clone clean at `03ab6b6`, `git status --porcelain` empty):

```
BUILD_RC=0
TEST_RC=0
RACE_RC=0
VET_RC=1   — exactly 4 findings, all pre-existing copies-lock:
  internal/server/server.go:1516:14  assignment copies lock value to ephReq
  internal/server/server.go:1626:14
  internal/server/server.go:1834:13
  internal/server/server.go:2011:13
```

Full agreement with the shared brief. One environment divergence, see F8.

**Unit half — `TerminalLabelStage` over the full terminal power-set** (R4A):

```
R4A cells=112 blind=0  (sawTrue=true sawFalse=true — sweep is discriminating)
```

2^4 terminal subsets × 7 mask choices, each also evaluated with the label list
reversed. Zero blind cells, zero order-dependence. The `sawTrue`/`sawFalse` pin
is there because a sweep that only ever returns one answer would report
`blind=0` while proving nothing.

**Server half — round-3 PoC reproduction** (Z4A), masked terminal, destination
fixed at `accepted`, agent scopes `{task:read, task:write, task:claim,
collection:read}`:

```
positive control: accepted -> in_review ALLOWED, labels=[ft:stage/in_review] (the probe CAN observe success)
  ok  start=[ft:stage/completed ft:stage/triage]           dest=accepted -> DENIED
  ok  start=[ft:stage/completed ft:stage/accepted]         dest=accepted -> DENIED
  ...
  ok  start=[ft:stage/cancelled ft:stage/in_review]        dest=accepted -> DENIED
Z4A cells=16 BYPASS LINES=0
```

The positive control earned its place: my first version used `dest=working` and
**the control failed closed**, surfacing that `working` is unreachable via
`UpdateTask` at all (`stage=working starts execution; use ClaimTask`). Had I
written the probe without a control, all 16 DENIEDs would have been a property
of the request shape rather than of the fix.

### Going past it — the multi-call, destination-varying version

Charge 1 said the round-3 PoC was single-call and destination-fixed and that
both limitations hid real cells. Z4B is 4 terminal starts × 10 destinations ×
3 variants = **120 executions over 40 cells**:

- `clean` — `start=[T]`, no label write (baseline authorization surface)
- `masked` — `start=[T, ft:stage/accepted]`, no label write (the #194 shape)
- `chain` — `start=[T]`, the agent **adds the mask itself**, then transitions

A cell is a bypass iff `masked` or `chain` is ALLOWED where `clean` is DENIED —
i.e. an attacker-controlled label changed the authorization answer.

```
Z4B cells=40 clean_allow=4 clean_deny=36 BYPASS LINES=0
CLEAN-COLUMN ALLOW: completed -> completed
CLEAN-COLUMN ALLOW: wont_fix  -> wont_fix
CLEAN-COLUMN ALLOW: duplicate -> duplicate
CLEAN-COLUMN ALLOW: cancelled -> cancelled
```

The clean column is non-uniform (4 allow / 36 deny), so the matrix discriminates
and `BYPASS=0` is meaningful. **The only allowed cells are the four `from == to`
diagonals**, which is residual R-B and already sequenced.

**Conclusion (BY EXECUTION):** across 156 server-level cells and 112 unit cells,
adding, masking or chaining labels never changes the authorization answer. I
reproduce the dev's claim and extend it to the two axes it did not cover.

---

## F1 — [HIGH] `computeReady` still derives readiness from the display projection

- **Location:** `internal/platform/github/treewalk.go:36` and `:92`
- **Status:** the next spelling of the fixed defect (charge 2). Not R-A, not R-B,
  not previously disclosed.

`buildIssueTree` sets each node's stage from the **precedence-collapsed display
projection**, the exact value the fix's own comment forbids authorization from
using:

```go
// treewalk.go:36
stage, _ := mapper.MapLabelsToStage(labels)   // stagePrecedence: every non-terminal outranks every terminal
```

```go
// treewalk.go:92
if node.Stage == task.StageAccepted && !hasOpenChildren {   // emits a READY result
```

Meanwhile `labels.go:30-41` now carries the warning:

> `THIS ORDERING IS A DISPLAY RULE. AUTHORIZATION MUST NOT DEPEND ON IT.`

`computeReady` depends on it. The fix corrected three sinks through
`store.LifecycleStage` (`server.go:552`, `passthrough.go:821`,
`passthrough.go:612/671`) and left this one reading the old projection.

**Proof of concept (BY EXECUTION, R4F).** Baseline first, so the probe is known
to exercise the gate:

```
baseline [ft:stage/wont_fix]                       -> ready=false   (gate is live)
ATTACK   [ft:stage/wont_fix, ft:stage/accepted]    -> ready=TRUE  node.Stage="accepted"
         while TerminalLabelStage = ("wont_fix", true)
ATTACK   [ft:stage/duplicate, ft:stage/accepted]   -> ready=TRUE
ATTACK   [ft:stage/cancelled, ft:stage/accepted]   -> ready=TRUE
ATTACK   [ft:stage/completed, ft:stage/accepted]   -> ready=TRUE
ATTACK   [duplicate, ft:stage/accepted]            -> ready=TRUE   (bare stock label)
5 of 5 attack cells bypass
```

The authoritative lifecycle answer and the readiness answer disagree on every
cell: `TerminalLabelStage` says terminal, `computeReady` says ready.

**Impact.** `GetReadyTasks` is the primary work-discovery surface for agents.
A terminal task re-enters the ready queue and is handed to an agent as available
work — the same outcome #194 was filed for, reached through a different door.

**Reachability — REASONED, from reading, and this is why it is High not
Critical.** `GitHubPassThroughStore.GetReadyTasks` (`passthrough.go:975`) is
reached only via `graphRouteEphemeral` → `loadEphemeralStore`
(`server.go:1505-1519`), which returns `Internal: ephemeral store pool not
configured` when `s.ephemeralPool == nil` (`graph_routing.go:59`). `WithEphemeralPool`
has **no production construction site** — the only caller is
`internal/testutil/testserver.go:69`. So the bypass is latent today.

It stops being latent the moment #202 wires the pool. **The disclosed
remediation plan activates a live authorization bypass.** That sequencing is the
finding as much as the code is.

**Recommendation.** Make readiness read the lifecycle answer, not the display
answer, and carry both on the node so the display value stays available:

```go
// treewalk.go, buildIssueTree
stage, _ := mapper.MapLabelsToStage(labels)          // display only
node.Stage = stage
if term, ok := mapper.TerminalLabelStage(labels); ok {
    node.LifecycleStage = term                        // authoritative
} else {
    node.LifecycleStage = stage
}

// treewalk.go, computeReady
if node.LifecycleStage == task.StageAccepted && !hasOpenChildren {
```

and change the guard at `:105` to `!store.IsTerminalStage(node.LifecycleStage)`.

**Invariant to pin, per bar 5:** *no readiness, availability or authorization
decision may read a value produced by `MapLabelsToStage`.* That is testable as a
static assertion over callers and would have caught this.

---

## F2 — [HIGH] The terminal tiebreak is attacker-selectable, and its order decides which conversions are reachable

- **Location:** `internal/platform/github/labels.go:57-62` (`terminalStagePrecedence`),
  consumed at `labels.go:505-526`, gated at `internal/server/server.go:552-557`
- **Status:** this is charge 3's "anything BEYOND R-B". It builds on R-B; it is
  not a re-file of it. The new claims are (a) the conversions are *real state
  changes*, (b) *the ordering selects them*, (c) *no attacker label write is
  required* in realistic states.

`TerminalLabelStage` returns exactly one winner — the lowest-ranked present
stage in a fixed total order. Whoever controls the label set controls which
terminal stage the gate sees as the transition **source**.

The gain is bounded but non-empty, and it is directional: **adding a label can
only lower the winning rank, never raise it.** So the reachable set is exactly
`{(from,to) : rank(to) < rank(from)}`.

**Proof of concept (BY EXECUTION, Z4C).** I encoded that prediction in the test
before running it. Control first: every clean `T -> D` pair is denied.

```
  denied  completed  -> wont_fix   (rank 0 -> 1, cannot outrank)
  denied  completed  -> duplicate  (rank 0 -> 2, cannot outrank)
  denied  completed  -> cancelled  (rank 0 -> 3, cannot outrank)
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: wont_fix  -> completed ALLOWED; final labels=[ft:stage/completed] (old terminal present=false, new terminal present=true)
  denied  wont_fix   -> duplicate  (rank 1 -> 2, cannot outrank)
  denied  wont_fix   -> cancelled  (rank 1 -> 3, cannot outrank)
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: duplicate -> completed ALLOWED; final labels=[ft:stage/completed]
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: duplicate -> wont_fix  ALLOWED; final labels=[ft:stage/wont_fix]
  denied  duplicate  -> cancelled  (rank 2 -> 3, cannot outrank)
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: cancelled -> completed ALLOWED; final labels=[ft:stage/completed]
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: cancelled -> wont_fix  ALLOWED; final labels=[ft:stage/wont_fix]
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: cancelled -> duplicate  ALLOWED; final labels=[ft:stage/duplicate]

Z4C ordered pairs=12 CONVERTED=6 denied=6 prediction_misses=0
```

`old terminal present=false, new terminal present=true` on every converted cell:
these are **real state changes**, not no-op writes. The mechanism is that adding
the destination label makes it the winner, which collapses the gate to
`from == to`, which returns `ScopeTaskWrite`.

**Impact.** An agent token holding only `task:write` can relabel abandoned work
as finished. Note the direction of every reachable conversion: they all flow
*toward* `completed` and `wont_fix`, the two lowest ranks. `cancelled ->
completed` is precisely the lie an agent that failed its task would want to
tell, and it is one of the six. The transition requires `task:close` by design
and `DefaultScopesForUserType("agent")` grants neither `task:close` nor
`task:accept`.

**This does not require the attacker to write a label** (BY EXECUTION, Z4E).
Control held — a single terminal label cannot reach a different terminal:

```
control: single ft:stage/cancelled -> duplicate DENIED (as it must be)
NO-WRITE CONVERSION: start=[ft:stage/cancelled duplicate]          ask=duplicate  -> ALLOWED with task:write only
NO-WRITE CONVERSION: start=[ft:stage/cancelled ft:stage/completed] ask=completed  -> ALLOWED with task:write only
NO-WRITE CONVERSION: start=[ft:stage/duplicate ft:stage/wont_fix]  ask=wont_fix   -> ALLOWED with task:write only
```

Two terminal labels coexist without any attacker action: a human adds GitHub's
stock `duplicate` label to an issue Farm Table already marked terminal (see F6),
or a label swap partially fails under the disclosed remove-then-add ordering at
`passthrough.go:424-431`. So this stands independently of R-A.

**Answering the charge directly: the tiebreak is not safe, and no reordering
fixes it.** Any deterministic single-answer tiebreak hands an add-capable
attacker control of the reported source; changing the order only changes *which*
six pairs are reachable, never that six are. The order is currently written as
though it were a neutral display detail; it is an access-control parameter.

**Recommendation.** Do not pick one source. Evaluate the transition against
every present terminal stage and demand the strongest scope:

```go
// server.go, replacing the single-source TransitionScope call at :552
stages, _ := store.AllTerminalLabelStages(ctx, s.store, existing) // returns all present
if len(stages) == 0 {
    stages = []task.Stage{existing.Stage}
}
for _, from := range stages {
    if err := RequireScope(ctx, TransitionScope(from, target)); err != nil {
        return nil, err
    }
}
```

With two distinct terminal labels present, `from == to` can hold for at most one
of them, so the other falls to rule 1 (`any -> terminal = task:close`) and the
whole class closes — including the no-write variant. This also makes R-B far
less load-bearing, which is worth weighing against its round-5 sequencing.

**On the sequencing question you invited disagreement about:** R-B alone is
genuinely low-impact — Z4B shows the four diagonal cells write nothing new. It
is the *combination* with the selectable tiebreak that produces state change,
and that combination shipped in round 4. I would pull the R-B fix into the same
change as this one rather than leave a round-4 feature depending on a round-5
fix for its safety.

---

## F3 — [MEDIUM] GitHub-backed tasks have no audit trail at all, so every label-mediated transition erases its own precondition

- **Location:** `internal/platform/github/passthrough.go:950-962`;
  `internal/server/server.go:552`, `:690-713`
- **Status:** charge 6, treated as its own question. This is a detection finding,
  not an access-control one.

The charge asked whether anywhere else a successful bypass destroys the record
of its own precondition. The answer is broader than the question: on the
pass-through store **nothing is ever recorded**, so *every* transition has that
property, bypass or not.

Four independent places the precondition could have been retained, and is not:

1. **The gate's own input is discarded.** `authStage := store.LifecycleStage(...)`
   (`server.go:552`) is consumed only by `TransitionScope` on the next line. It is
   never logged, persisted, or emitted. The one value that knows the task was
   terminal has the lifetime of a comparison.
2. **The event bus publishes only the post-change state.** `server.go:690-713`
   emits `TaskEvent{Task: proto}` and never populates the `changes` field the
   proto defines (`proto/farmtable.proto:1047`). A subscriber sees the new stage
   and cannot recover the old one.
3. **The durable `Change` entity is never written.** `internal/store/schema/change.go`
   holds `field_name`/`old_value`/`new_value`, written only by
   `EntStore.recordChanges` (`entstore.go:1724`). The pass-through store implements
   the entire audit interface as a stub:

```go
// passthrough.go:950-962
func (s *GitHubPassThroughStore) ListChanges(...)                { return nil, 0, fmt.Errorf("list changes: %w", store.ErrNotImplemented) }
func (s *GitHubPassThroughStore) ListAllChangesForTask(...)      { return nil, fmt.Errorf("list all changes for task: %w", store.ErrNotImplemented) }
func (s *GitHubPassThroughStore) ListAllChangesForCollection(...) { return nil, fmt.Errorf("list all changes for collection: %w", store.ErrNotImplemented) }
```

4. **The only surviving record is the label, and the transition deletes it.**
   `StageLabelSwap` removes the terminal label as its normal operation.

**Proof (BY EXECUTION, Z4D)** — the F2 `cancelled -> completed` conversion,
followed by every available forensic query, with a native-task positive control:

```
precondition on GitHub: labels=[ft:stage/cancelled]
after conversion:      labels=[ft:stage/completed]
GetTask.stage=TASK_STAGE_ACCEPTED labels=[ft:stage/completed]
GetTaskResponse.changes -> n=0  (the API surface PROMISES a change list here)
ListAllChangesForTask -> n=0 err=list all changes for task: not implemented

NATIVE control ListAllChangesForTask -> n=1 err=<nil>
    native change: field=stage old="accepted" new="in_review"
CONTROL HELD: native tasks DO produce durable change rows. The absence on the
GitHub-backed task is a real asymmetry, not a harness artefact.
```

The control is what makes this a finding rather than a harness artefact: the
same call on an Ent-backed task returns a populated change row.

Note the third line. After the conversion `GetTask` reports
**`TASK_STAGE_ACCEPTED`** — not `cancelled` (the precondition), and not
`completed` (the result). The issue is still OPEN, so `IssueToPhaseStage`
demotes it for display. An investigator reading the API sees ordinary open work.
There is no view in the product from which the conversion is visible.

**The other self-erasing sites**, same mechanism, listed so the class is closed
rather than the instance: `ClaimTask` swapping to `ft:stage/working`
(`passthrough.go:622`) and `CloseTask` (`passthrough.go:727`).

**Impact.** No detection, no incident reconstruction, and no post-hoc discovery
of exploitation for any label-mediated authorization event on GitHub-backed
tasks. If F2 or a future spelling of F1 is exploited in production, there will be
no evidence that it happened.

**Recommendation.** Two changes, the first cheap and worth doing regardless of
the access-control fixes:

```go
// server.go, at the gate — record what the gate actually read, before it is lost
authStage := store.LifecycleStage(ctx, s.store, existing)
if authStage != existing.Stage {
    slog.WarnContext(ctx, "terminal label authorization",
        "task", id, "display_stage", existing.Stage,
        "lifecycle_stage", authStage, "target", target,
        "actor", actorID, "scope", TransitionScope(authStage, target))
}
```

A stage transition whose lifecycle source differs from its displayed stage is
rare in normal operation and is the signature of every finding in this class,
so it is a high-signal alert as well as a record.

Second, have the pass-through store write `Change` rows to the Ent side for
transitions it performs, even though it cannot enumerate GitHub's own history.
The asymmetry between native and GitHub tasks is currently silent — `ListChanges`
returning `ErrNotImplemented` is indistinguishable to a caller from "this task
was never changed".

---

## F4 — [MEDIUM] `hasExternalUnavailableLabel` bypasses both the enabled flag and the configured prefix

- **Location:** `internal/platform/github/treewalk.go:153-164`, consumed at
  `passthrough.go:675` (`issueUnavailableForClaim`, enforcement) and
  `passthrough.go:824` (`ComputeAvailability`)
- **Status:** charge 4's sweep result.

The `!m.enabled` guard itself is sound. **BY EXECUTION (R4D)**, and the premise
is load-bearing rather than vacuous:

```
premise BY EXECUTION: disabled mapper still has 10 labelToStage entries — the scan
would have honoured them; the guard is load-bearing
disabled mapper declined every terminal label set; enabled control returned true —
the negative is real, not vacuous
```

All three `labelToStage` readers consult `enabled` (`labels.go:197`, `:294`,
`:512`). But the sweep for *other* label-derived paths found one that does not.
`hasExternalUnavailableLabel` is a package-level function taking only
`[]string`. It has no mapper, so it can consult neither `m.enabled` nor the
configured `push_prefix`, and it hardcodes `"ft:"` and `"stage/"`.

**Both failure directions confirmed BY EXECUTION:**

```
hasExternalUnavailableLabel(["ft:stage/blocked"])   = true
    — with label mapping DISABLED. The operator turned labels off; this path honours them anyway.
hasExternalUnavailableLabel(["acme:stage/blocked"]) = false
    — for a mapper configured PushPrefix:"acme:", whose TerminalLabelStage DOES honour that prefix.
```

The second is the security-relevant one: an installation using a custom
`push_prefix` has its `blocked` / `waiting_for_input` / `deferred` / `scheduled`
holds silently ignored by `issueUnavailableForClaim`, so agents can claim held
work. The first is an availability inconsistency — labels are "off" but still
suppress work.

**Recommendation.** Make it a method so it sees configuration, matching the
other readers:

```go
func (m *LabelMapper) hasExternalUnavailableLabel(labels []string) bool {
    if m == nil || !m.enabled {
        return false
    }
    for _, raw := range labels {
        switch m.stripForMatch(raw) {   // honours the configured PushPrefix
        case "blocked", "waiting_for_input", "deferred", "scheduled":
            return true
        }
    }
    return false
}
```

Both call sites already hold `s.mapper`.

---

## F5 — [MEDIUM] Round 4 widens unprefixed stock labels into authoritative terminal signals

- **Location:** `internal/platform/github/labels.go:133-137` (bare stage names
  registered as keys) interacting with the set scan at `:505-526`
- **Status:** charge 5, **re-derived under the new code, not inherited**. The
  round-3 conclusion is reconfirmed on its own terms and then superseded.

Round-3's claim holds: of GitHub's stock labels, exactly `duplicate` is terminal
when it appears **alone** (BY EXECUTION, R4E).

But the round-3 measurement asked the wrong question for round-4 code. Because
the scan now reads the whole label set instead of one precedence winner,
**12 cells changed answer**, in the denial direction:

```
[duplicate,  ft:stage/accepted]  round4="duplicate"  TERMINAL   |  round3="accepted"  non-terminal
[wont_fix,   ft:stage/accepted]  round4="wont_fix"   TERMINAL   |  round3="accepted"  non-terminal
[completed,  ft:stage/accepted]  round4="completed"  TERMINAL   |  round3="accepted"  non-terminal
[cancelled,  ft:stage/accepted]  round4="cancelled"  TERMINAL   |  round3="accepted"  non-terminal
   ... 12 cells total across the non-terminal masks
```

Round 3's precedence collapse *hid* these; the fix reveals them. Any repository
where a human has applied GitHub's stock `duplicate` label, or an independently
created `wont_fix`/`completed`/`cancelled` label, alongside a Farm Table stage
label now has that task treated as terminal: unavailable, unclaimable, filtered
from ready.

This is a **regression introduced by the round-4 fix** and it lands on exactly
the population most likely to exist — repositories that used GitHub labels
before adopting Farm Table. It is also the state F2's no-write variant needs.

**Recommendation.** Require the configured prefix for authorization inputs.
Prefix stripping is right for *display* tolerance and wrong for a security
decision:

```go
// TerminalLabelStage — only honour labels that are unambiguously ours
for _, raw := range labels {
    l := strings.ToLower(strings.TrimSpace(raw))
    if m.pushPrefix != "" && !strings.HasPrefix(l, m.pushPrefix) {
        continue   // a bare "duplicate" is a human's triage note, not a Farm Table assertion
    }
    if stage, ok := m.labelToStage[m.stripForMatch(raw)]; ok && store.IsTerminalStage(stage) {
        present[stage] = true
    }
}
```

This is the same root cause as disclosed audit F4; I am filing it because the
**exposure changed** under the new code and the charge asked for a re-derivation.

---

## F6 — [LOW] Enum drift path 2 is unguarded and the shipped guard would pass vacuously

- **Location:** `internal/platform/github/labels.go:65-76` (`allStages`),
  `terminal_label_stage_test.go:285-300` (the guard)
- **Status:** charge 3's second half — "what happens if a terminal stage is
  added to the enum and not to this list?"

There are two drift paths and the guard covers one.

**Path 1** — a stage in `allStages` but missing from `terminalStagePrecedence`.
Covered by `TestTerminalStagePrecedence_CoversEveryTerminalStage`. Not live.

**Path 2** — a stage in the enum and terminal, but missing from `allStages`.
**Not covered.** The guard derives its universe of "every terminal stage" from
`allStages`, so a stage absent from `allStages` is absent from the guard's own
expectations and **the guard passes vacuously**. `NewLabelMapper` also iterates
`allStages`, so the label is never registered in `labelToStage` and the scan
cannot see it.

Mechanism confirmed BY EXECUTION (R4C):

```
path 2 mechanism BY EXECUTION: TerminalLabelStage([ft:stage/archived]) -> ("",false).
Any terminal stage absent from allStages is never registered in labelToStage, so the
scan cannot see it AND terminalStages() cannot see it either — the guard test passes
vacuously. allStages len=10, StageValidator accepts 10.
path 2: not live today (allStages covers all 10 enum values) but NOTHING PINS IT.
```

The failure mode is silent and fails **open**: a newly added terminal stage
would be invisible to `TerminalLabelStage`, so tasks in it would not be
recognised as terminal by the gate — reintroducing #194 for that stage, with a
green test suite.

**Recommendation.** Pin `allStages` against the enum rather than against itself:

```go
func TestAllStagesCoversEnum(t *testing.T) {
    for _, s := range []task.Stage{
        task.StageTriage, task.StageAccepted, task.StageWorking, task.StageInReview,
        task.StageInQa, task.StageDeploying, task.StageCompleted, task.StageWontFix,
        task.StageDuplicate, task.StageCancelled,
    } {
        if !slices.Contains(allStages, s) {
            t.Errorf("enum stage %q missing from allStages — it will never be registered "+
                "as a label and the terminal guard will pass vacuously", s)
        }
    }
}
```

Better still, generate `allStages` from the Ent enum so drift is impossible.

---

## F7 — [LOW] A normal stage change deletes human-applied stock GitHub labels

- **Location:** `internal/platform/github/labels.go:133-137` + `StageLabelSwap`

Because `NewLabelMapper` registers every **bare** stage name as a lookup key,
`StageLabelSwap` treats a human's stock GitHub label as a Farm Table label and
removes it. BY EXECUTION (R4G):

```
StageLabelSwap([duplicate bug], working)             -> add=[ft:stage/working] REMOVE=[duplicate]
StageLabelSwap([wont_fix priority:high bug], working) -> add=[ft:stage/working] REMOVE=[wont_fix]
control: StageLabelSwap([ft:stage/blocked ft:stage/wont_fix], working) REMOVE=[ft:stage/wont_fix]
    — the hold label SURVIVES (not a stage), the terminal label does not
```

Farm Table deletes a label it never created and that carries a human's triage
judgement. It compounds F3: the deletion is itself unrecorded. The F5
recommendation fixes this too.

*Harness note:* Z4E's mock has label IDs only for `ft:stage/*`, so the removal of
a bare stock label is not expressible at the server level there. The claim above
is unit-level and I am not extending it to an end-to-end assertion.

---

## F8 — [INFO] A clean checkout cannot `go build ./...`

- **Location:** `assets.go:5`, `.gitignore:17`

My first gate run returned `BUILD_RC=1`:

```
assets.go:5:12: pattern all:web/dist: no matching files found
```

`web/dist` is an npm artifact from `make web`, gitignored and never committed.
After `npm ci` and `npm run build` (both rc=0) the gate reproduced the brief
exactly. Not a code defect, but it means a fresh clone or CI job that runs
`go build ./...` before `make web` fails in a way that looks like a compile
error. Worth a note in the build docs or a `go:generate`-time check.

---

## Positive observations

- **The fix is correct and it is correct at the root.** Declaring
  `terminalStagePrecedence` separately rather than filtering `stagePrecedence`
  is the right call: it makes the display order and the authorization order
  independently editable, so a future display tweak cannot silently move an
  authorization boundary.
- **The comment at `labels.go:30-41` is real engineering.** Naming the display
  rule as a display rule and forbidding authorization from depending on it is
  what let me find F1 quickly — I could search for violations of a stated
  invariant instead of guessing at intent.
- **`TerminalLabelStage` is order-independent and total over the power set.**
  112 unit cells, 0 blind, both label orders. The set-scan design is right;
  reading all labels rather than one winner is exactly the correction the defect
  class called for.
- **The `!m.enabled` guard is load-bearing and correct**, and I confirmed the
  reason it is needed (a disabled mapper still carries 10 `labelToStage`
  entries) rather than taking it on faith.
- **`TestTerminalStagePrecedence_CoversEveryTerminalStage` was shipped with the
  fix.** The dev anticipated drift. F6 is that the guard's universe is drawn
  from the wrong source, not that guarding was overlooked.
- **Three sinks were fixed together.** `UpdateTask`, `ComputeAvailability` and
  `ClaimTask` were corrected in one change rather than one per round.

---

## Recommendations beyond the findings

1. **Make the stated invariant executable.** F1 exists because
   "authorization must not depend on `stagePrecedence`" is a comment. A test that
   walks callers of `MapLabelsToStage` and fails on any in an authorization,
   availability or readiness path would have caught F1 and would catch the next
   spelling. This is the highest-leverage item in this report.
2. **Sequence F1 ahead of #202, or land them together.** #202 wires the ephemeral
   pool, which is the single condition that makes F1 exploitable. Landing #202
   first opens a live bypass.
3. **Audit the pass-through store's `ErrNotImplemented` stubs as a group.** F3
   found three on the audit-trail interface. A stub that silently returns "no
   data" where a caller expects "no changes" is a general hazard in this store.
4. **Treat "which label wins" as an access-control decision wherever it appears.**
   F2's root is that a tiebreak needed for display was reused for authorization.
   The fix already learned this for `stagePrecedence`; `terminalStagePrecedence`
   repeats it one level down.

---

## Methodology, disclosures and limitations

**Harness provenance.** The `statefulGH` mock, `z4Rig` and the REV0 self-check
were **reused, not rebuilt**, from
`salvage/audit-194-r3-stateful-harness.go` (snapshot sha256
`3698d861c4ba514dffcdea11662d6dd49b4084ea21b767d14e3688d7b02ad866`), symbols
renamed `z4*`. The self-check was kept first and unmodified and was run and seen
to pass before any negative result was relied on:

```
    add    : [ft:stage/wont_fix] -> [ft:stage/accepted ft:stage/wont_fix]  OK
    remove : [ft:stage/accepted ft:stage/wont_fix] -> [ft:stage/accepted]  OK
    HARNESS PROVEN STATEFUL IN BOTH DIRECTIONS
```

**Every negative claim is paired with a control that fails closed** (bar 3).
Two controls actually fired during this audit and changed the work: Z4A's
positive control rejected my first destination choice and exposed that `working`
is unreachable via `UpdateTask`; Z4D's native-task control was required before
"no change rows" could mean anything. R4A and Z4B additionally carry vacuity
pins (`sawTrue`/`sawFalse`; `clean_allow`/`clean_deny`) so that a
zero-bypass count cannot be reported from a non-discriminating sweep. This is
the round-3 R1.4 failure mode and it is the reason for every control above.

**Priming disclosure — charge 3.** The salvaged harness file was **overwritten by
the concurrently-running leg at 02:01:16 while I was reading it**. Its new header
carried that leg's in-flight round-4 conclusions, including a direct answer to
charge 3 ("6 of 12 cells, exactly when rank(dest) < rank(start)"). I had already
read it before I understood what it was. Mitigations: I snapshotted a private
copy and worked from that; I deliberately did **not** open
`audit-194-r4-alldirections.txt`, `audit-194-r4-matrix.txt` or
`audit-194-r4-rev0.txt`; and I re-derived the mechanism myself and **encoded the
prediction in the test before running it** (`prediction_misses=0`), so the result
is independently reproduced rather than restated. Readers should still discount
charge 3's independence accordingly — it is the one place my leg was not clean.
Operationally: the instruction to reuse the shared salvage directory conflicts
with the instruction not to read a concurrent leg's output, because that leg
writes into the same directory. Legs should write to per-leg subdirectories.

**Clone path.** The stated clone `/workspace/farmtable-audit-194b` does not
exist; the repository is mounted at `/workspace` itself, verified at
`03ab6b63287b29b079afac30f7a0fb345052a521`, branch `close-label-swap`, with
`git status --porcelain` empty before and after. I did not touch
`/workspace/farmtable-audit-194`.

**Scope limits — what I did not establish.**
- F1's production-unreachability is REASONED from reading construction sites,
  not proven by execution. I did not build a probe that attempts
  `GetReadyTasks` through a wired ephemeral pool.
- F7 is unit-level only; the mock cannot express stock-label removal.
- I did not audit dependencies for known CVEs this round, and I did not review
  the web dashboard.
- Everything here concerns the GitHub pass-through path. Linear/Jira/Asana
  adapters were not examined for the same defect class, and the F1 invariant
  test would be the efficient way to cover them.

**Not re-filed, per the brief:** R-A, R-B, #203, #202, audit F4/F5/F7, the bare
stock `duplicate` handling as such, `passthrough.go:424-431` ordering, and
`UpdateTask` building its response before the label swap. Where a finding above
touches these (F2 on R-B, F5 on audit F4) it is because the charge asked for
the surrounding question and the exposure changed under the new code; the novel
claim is stated explicitly in each.

**Artifacts** (all in `/scion-volumes/scratchpad/projects/farmtable/salvage/`):

| File | Contents |
|------|----------|
| `audit-194-r4-unit-probes.go.txt` | R4A/C/D/E/F/G — unit probes |
| `audit-194-r4-server-probes.go.txt` | Z4_0/A/B/C/D/E — server probes + inherited harness |
| `audit-194-r4-unit-output.txt` | raw `go test -v` output, unit |
| `audit-194-r4-server-output.txt` | raw `go test -v` output, server |

Scratch test files were deleted from the clone; `git status --porcelain` is
empty. No production code was modified. Nothing was pushed.
