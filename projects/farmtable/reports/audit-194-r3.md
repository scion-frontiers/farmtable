# Security Audit Report — #194 `close-label-swap`, round 3

- **SHA audited:** `651da265783ce8cbfda5d902e2a3f640ef345529` (`651da26`)
- **Clone:** `/workspace/farmtable-audit-194`, verified by SHA before any work; `git status --porcelain` empty at start and at finish
- **Range:** `9f98ad8..651da26` (4 commits)
- **Leg:** security audit
- **Date:** 2026-07-28

---

## VERDICT: **REQUEST CHANGES**

### Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| **High** | **2** |
| Medium | 1 |
| Low | 2 |
| Info | 2 |

**I agree with the EM's reading: HIGH × 2, REQUEST CHANGES.**

Round 3 did introduce its own consequence, in the same way round 2 did — not a
new bug written into the diff, but a **security control that is advertised as
total and is not**. Round 3 installs `LifecycleStage` as the authoritative
answer for authorization and scheduling, and documents it in three separate
production comments as the thing that makes a maintainer's `wont_fix` cost
`task:accept` to undo. That guarantee is defeated by adding one additional,
ordinary label to the issue. The accept gate is restored for the exact shape the
new test suite exercises and for nothing wider.

The two High findings share one root cause and are separated here because their
impact classes differ (privilege escalation vs. work scheduling), and each needs
its own fix verification.

The round-3 fix is directionally correct and its wiring is genuine. It should
not ship as-is, because the residual gap is invisible: nothing fails, nothing
logs, and the code comments assert the opposite.

---

## 🔴 IMMEDIATE — HIGH FINDINGS

### [HIGH] F1 — A second, non-terminal stage label defeats the round-3 accept gate (authorization bypass)

- **Location (root cause):** `internal/platform/github/labels.go:448` — `TerminalLabelStage` delegates to `MapLabelsToStage`
- **Contributing:** `internal/platform/github/labels.go:13-24` — `stagePrecedence`
- **Sink:** `internal/server/server.go:552-553` — `authStage := store.LifecycleStage(...)` → `TransitionScope`
- **Status:** **verified BY EXECUTION** (PoC1, output pasted below)

#### Description

`TerminalLabelStage` is the whole basis of the round-3 fix. It is implemented by
reusing `MapLabelsToStage`:

```go
// internal/platform/github/labels.go:444-453
func (m *LabelMapper) TerminalLabelStage(labels []string) (task.Stage, bool) {
	if m == nil {
		return "", false
	}
	stage, ok := m.MapLabelsToStage(labels)
	if !ok || !store.IsTerminalStage(stage) {
		return "", false
	}
	return stage, true
}
```

`MapLabelsToStage` does not report *which stages* the labels name. It collapses
them to the **single highest-precedence winner** (`labels.go:168-173`), and
`stagePrecedence` ranks **every non-terminal stage above every terminal one**:

```go
// internal/platform/github/labels.go:13-24
var stagePrecedence = []task.Stage{
	task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying,
	task.StageAccepted, task.StageTriage,          // ← all non-terminal
	task.StageCompleted, task.StageWontFix,
	task.StageDuplicate, task.StageCancelled,      // ← all terminal, ranked last
}
```

So when an issue carries `ft:stage/wont_fix` **and** `ft:stage/accepted`,
`MapLabelsToStage` returns `accepted`. `TerminalLabelStage` sees a non-terminal
stage, returns `("", false)`, and `LifecycleStage` falls back to `t.Stage` —
which is the F2-demoted `accepted`. **The seam returns exactly the value it was
built to avoid**, and `TransitionScope(accepted, accepted)` hits the `from == to`
short-circuit (`transitions.go:124`) and yields `task:write`.

This is the round-2 defect reachable again through a different door.

#### Impact

A token holding `task:write` but deliberately **not** `task:accept` — i.e. the
default agent token, `DefaultScopesForUserType("agent")` — can move a
maintainer-declined issue back into the active pipeline. This is precisely the
control the round-3 gate exists to enforce, and precisely the failure the gate
was written in response to.

#### Proof of concept — BY EXECUTION

`go test ./internal/server/ -run TestAUDIT_PoC1 -v` at pristine `651da26`.
**12 of 16 combinations bypass.** The baseline (single terminal label) is denied
in **all 16**, so the harness genuinely exercises the gate — the test fails
closed:

```
    zzz_audit_poc_test.go:161: baseline  [ft:stage/wont_fix]            -> DENIED (rpc error: code = PermissionDenied desc = missing required scope "task:accept")
    zzz_audit_poc_test.go:168: BYPASS: agent token (task:write, NO task:accept) reopened an OPEN issue labelled [ft:stage/wont_fix ft:stage/accepted] to accepted. The terminal label is still on the issue; adding "ft:stage/accepted" defeated the round-3 accept gate.
    zzz_audit_poc_test.go:161: baseline  [ft:stage/duplicate]           -> DENIED (rpc error: code = PermissionDenied desc = missing required scope "task:accept")
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/duplicate ft:stage/accepted] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/cancelled ft:stage/accepted] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/completed ft:stage/accepted] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/wont_fix ft:stage/working] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/duplicate ft:stage/working] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/cancelled ft:stage/working] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/completed ft:stage/working] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/wont_fix ft:stage/in_review] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/duplicate ft:stage/in_review] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/cancelled ft:stage/in_review] to accepted ...
    zzz_audit_poc_test.go:168: BYPASS: ... labelled [ft:stage/completed ft:stage/in_review] to accepted ...
--- FAIL: TestAUDIT_PoC1_SecondLabelDefeatsAcceptGate (0.13s)
FAIL	github.com/farmtable-io/farmtable/internal/server	0.139s
```

Exit code captured on the line after the redirect, not through a pipe:
`EXIT=1`. `grep -c "BYPASS:" = 12`.

The 4 non-bypassing cases are exactly the `ft:stage/triage` mask:

```
    --- PASS: .../ft:stage/wont_fix+ft:stage/triage
    --- PASS: .../ft:stage/duplicate+ft:stage/triage
    --- PASS: .../ft:stage/cancelled+ft:stage/triage
    --- PASS: .../ft:stage/completed+ft:stage/triage
```

That is **coincidence, not defence**: with a `triage` mask the lifecycle stage
becomes `triage`, and `triage → anything` independently requires `task:accept`
(`transitions.go:88-91`). The terminal label is still invisible to the gate. Any
destination reached from `triage` that the table permits would still bypass.

#### Reachability — production wiring, not reconstruction

I verified this myself against `cmd/farmtable-server/main.go`, because this is
the specific error my leg made in round 2.

| Layer | `main.go` (production) | My PoC |
|---|---|---|
| Primary | `store.NewEntStore(...)` (`main.go:39`) | `testutil.NewTestStore` → same `*store.EntStore` |
| Aggregator | `store.NewMultiStore(entStore)` (`main.go:60`) | `store.NewMultiStore(entStore)` — identical |
| Resolver | `s.SetResolver(github.NewPlatformResolver())` (`main.go:61`) | inline closure returning the same concrete type |
| Platform store | `NewPassThroughStore(token, owner, repo, nil, &cid)` → **bare `*GitHubPassThroughStore`** (`resolver.go:26`) | **bare `*GitHubPassThroughStore`** |
| Wrapper/decorator | **none** — `m.platforms[collectionID] = s` stores it raw (`multistore.go:151`) | none |
| Service | `server.NewFarmTableService(s, ...)` with the `*MultiStore` directly (`main.go:98`) | identical |
| Ephemeral pool | **not constructed** | not constructed |

The `LifecycleStager` type assertion at `multistore.go:240` therefore succeeds in
production against the real pass-through store. **The PoC exercises the
production object graph.** The only substitutions are the HTTP transport
(unavoidable) and the resolver *function* — whose *product* is the same concrete
type production builds. **This finding does not rest on the unwired ephemeral
pool (#202) in any way.**

Reaching the two-label state requires no exotic conditions:

1. **Manual labelling on GitHub.** `IssueToPhaseStage`'s own comment states "in a
   pass-through collection GitHub is the UI" (`labels.go:400-402`). Anyone with
   repo triage rights adds `ft:stage/accepted` next to the existing `wont_fix`.
2. **A partially failed label swap.** `GitHubPassThroughStore.UpdateTask`
   discards the remove error and then adds (`passthrough.go:424-431`):
   ```go
   removeIDs := s.labelNamesToIDs(remove)
   if len(removeIDs) > 0 { _ = s.gql.removeLabels(ctx, issueID, removeIDs) }
   addIDs := s.labelNamesToIDs(add)
   if len(addIDs) > 0 { _ = s.gql.addLabels(ctx, issueID, addIDs) }
   ```
   A failed remove followed by a successful add leaves both labels. This is the
   "partially failed close" case `labels.go:406-407` already names as reachable.
3. **Self-service via `UpdateTask(add_labels:)`** with only `task:write` — no
   transition-scope check runs when `req.Stage` is nil (this is audit F7's
   mirror; F7 is disclosed, this direction is the escalation).

#### Recommendation

Make `TerminalLabelStage` scan for **any** terminal label, independently of
`stagePrecedence`. Do not reuse `MapLabelsToStage`, whose single-winner contract
is a *display* contract and is wrong for a privilege decision.

```go
// internal/platform/github/labels.go — replace the MapLabelsToStage delegation
func (m *LabelMapper) TerminalLabelStage(labels []string) (task.Stage, bool) {
	if m == nil || !m.enabled {
		return "", false
	}
	// Scan for ANY terminal label. stagePrecedence ranks every non-terminal
	// stage above every terminal one, so MapLabelsToStage's single winner
	// silently hides a terminal label whenever any other stage label is
	// present. Precedence is a DISPLAY rule; a privilege decision must see
	// the terminal label regardless of what else is on the issue.
	// Iterate stagePrecedence so that among multiple terminal labels the
	// answer stays deterministic.
	for _, s := range stagePrecedence {
		if !store.IsTerminalStage(s) {
			continue
		}
		for _, raw := range labels {
			if m.labelToStage[m.stripForMatch(raw)] == s {
				return s, true
			}
		}
	}
	return "", false
}
```

**I verified this fix BY EXECUTION.** With it applied by content (not by line
number), from a `cp` backup outside the repo:

```
EXIT_WITH_CANDIDATE_FIX=0          # PoC1 + PoC2 both pass
TARGETED_WITH_CANDIDATE_FIX=0      # go test -count=1 ./internal/platform/github/ ./internal/server/ ./internal/store/
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.061s
ok  	github.com/farmtable-io/farmtable/internal/server	0.860s
ok  	github.com/farmtable-io/farmtable/internal/store	0.400s
```

The fix closes both High findings and breaks **no** existing test. Restored:
`diff` against `git show HEAD:` → `RESTORE_BYTE_IDENTICAL=yes`; PoC re-fails at
pristine HEAD (`POC_AT_RESTORED_HEAD=1`); `git status --porcelain` empty.

Add a test case with a terminal label **plus** each non-terminal stage label. The
existing 4×5 matrix should become 4 × 5 × (1 + n_masks).

---

### [HIGH] F2 — The same root cause returns a declined issue to the ready queue (scheduling bypass)

- **Location:** `internal/platform/github/passthrough.go:818` — `if store.IsTerminalStage(s.LifecycleStage(ctx, t)) || t.ClosedAt != nil`
- **Root cause:** identical to F1 (`labels.go:448`)
- **Status:** **verified BY EXECUTION** (PoC2)

#### Description & Impact

`ComputeAvailability`'s terminal arm reads `LifecycleStage`, so it inherits F1's
blindness. An OPEN issue **still carrying `ft:stage/wont_fix`** is reported as
available work once any non-terminal stage label is added. The code comment at
`passthrough.go:809-817` states this arm exists so a declined issue is not
"reported as available work to every consumer of this field."

Impact is separate from F1 and does not require any Farm Table token at all —
GitHub triage rights suffice. An agent polling for ready work is handed work a
maintainer explicitly declined.

#### Proof of concept — BY EXECUTION

```
    zzz_audit_poc_test.go:199: baseline  [ft:stage/wont_fix]                    -> Available=false Reasons=[terminal] stage=accepted
    zzz_audit_poc_test.go:214: attack    [ft:stage/wont_fix ft:stage/accepted]  -> Available=true  Reasons=[]         stage=accepted
    zzz_audit_poc_test.go:217: SCHEDULING BYPASS: an OPEN issue still carrying ft:stage/wont_fix is reported AVAILABLE (ready work) once ft:stage/accepted is also applied. Labels present: [ft:stage/wont_fix ft:stage/accepted]
--- FAIL: TestAUDIT_PoC2_SecondLabelRestoresAvailability (0.01s)
```

The baseline arm (`Available=false Reasons=[terminal]`) proves the fix works for
the single-label case and that the PoC measures the right seam.

#### Recommendation

Fixed by the same change as F1 (verified — PoC2 passes with the candidate fix).
Additionally, pin it with a test asserting `Reasons` contains `terminal` for
multi-label issues, not merely that `Available == false` — the latter can pass
for the wrong reason.

---

## Why the round-3 test suite cannot see either finding

**The EM's reading is correct, and I want to state it more sharply: the defect
and the test share an assumption, and it is written down in one line.**

`internal/server/authz_terminal_reopen_test.go:65`:

```go
"labels": {"nodes": [{"name": %q}]},
```

The fixture takes a single `string`, not a `[]string`. Every one of the 24
subtests constructs an issue with **exactly one label**. The complete set of
label-sets the suite ever builds is four singletons:

```
["ft:stage/wont_fix"]  ["ft:stage/duplicate"]  ["ft:stage/cancelled"]  ["ft:stage/completed"]
```

(The 10-entry list at `test:120-131` is the repository *label index* served for
`labels(first:)` — a name→node-ID directory for resolving mutation targets. It is
never attached to the issue.)

The suite is therefore **structurally incapable** of observing the defect. It is
not that the case was considered and skipped; the data shape forecloses it. The
production code makes an unqualified claim —

> "a maintainer's wont_fix must still cost task:accept to undo" — `labels.go:436-437`

— and the test validates it only on the one input shape where it happens to
hold. The 24 failures on revert are real and they do bind the sink; they bind a
**narrower** property than the comments assert.

This is the same failure mode as round 2, one level up. Round 2 fixed display and
did not notice it had changed authorization. Round 3 fixed authorization for the
single-label case and did not notice the guarantee was conditional. In both
cases the gap is silent and the tests are green.

**Separately, on vacuity (brief item 3):** I checked and the suite is **not**
vacuous. Verified by reading: no `t.Skip`; both tables are non-empty literals;
`newTerminalLabelledService` hard-fails on an empty fixture
(`test:195-197`); the negative assertions require `err != nil` **and**
`codes.PermissionDenied` **and** `strings.Contains(msg, ScopeTaskAccept)`
(`test:237-251`), so no empty-vs-empty comparison; `scopedCtx` calls
`ContextWithAuthEnforced` so neither permissive escape in `RequireScope` is hit;
and the positive control at `test:260-272` genuinely distinguishes allow from
deny. **However — the subtest count is nowhere asserted.** There is no
`if len(cases) != N { t.Fatalf }`. Silently deleting a table row would reduce
coverage with no signal. Compare `internal/store/terminal_availability_test.go:76-85`,
which *does* carry a completeness loop. **Recommend adding one** — this is the
cheap structural guard against exactly the class of erosion that produced F1.

---

## Other findings

### [MEDIUM] F3 — Production comments assert an inheritance property that holds for one of three named consumers

- **Location:** `internal/platform/github/passthrough.go:812-815`
- **Status:** **verified BY EXECUTION** for the routing intercept; **REASONED** for the downstream consequence

The comment states availability is "the one answer every client inherits instead
of re-deriving," naming `ft ready`, MCP `task_ready`, and the web dashboard.

- **Web dashboard — TRUE.** Polls `ListTasks` → `s.taskToProto(ctx, t)`
  (`server.go:467`) → `MultiStore.ComputeAvailability` → pass-through
  implementation. `web/src/utils/task-ready.ts:9-11` defers to it. This one works.
- **`ft ready` — FALSE.** `GetReadyTasks` intercepts *before* `MultiStore` is
  consulted: for any non-farmtable platform `resolveGraphRoute` returns
  `graphRouteEphemeral` (`graph_support.go:10-17` lists `PlatformGithub: true`),
  and `server.go:1505-1518` diverts to `loadEphemeralStore`. I verified this
  intercept by reading `server.go:1500-1520`. Membership in the ready set is
  decided by an Ent query on stage/phase columns (`entstore.go:2518-2521`), not
  by `ComputeAvailability`.
- **MCP `task_ready` — FALSE.** `internal/mcp/server.go:661` delegates to the same
  `GetReadyTasks` RPC and drops the availability field entirely from its output
  map.

**I am explicitly not raising the unwired ephemeral pool as a vulnerability** —
that is #202, disclosed, and my round-2 High wrongly rested on it. The finding
here is narrower and different in kind: **a security-relevant comment in
production code asserts a property that does not hold**, and a future reader
will rely on it. Given round 2 failed because a comment-level impact analysis
(`GitHubPassThroughStore.UpdateTask` vs `FarmTableService.UpdateTask`) was
inspected at the wrong layer, an inaccurate claim at exactly this seam is worth
correcting now rather than inheriting.

**Recommendation:** amend the comment at `passthrough.go:812-815` to name only
the web dashboard, or state that `ft ready`/MCP route through the ephemeral path
and do not inherit this answer. One sentence.

---

### [LOW] F4 — Prefix stripping makes any unprefixed stage-named label authoritative

- **Location:** `internal/platform/github/labels.go:95-99` (bare stage names registered as keys); `labels.go:462-472` (`stripForMatch`)
- **Status:** **verified BY EXECUTION** (PoC3, which passed — i.e. its fail-closed control held)

**Two claims must be separated here, and the EM is right that my sweep mixed them.**

**Claim A — the dev's narrow claim: `duplicate` is the only *stock* GitHub label
that collides. CONFIRMED.** GitHub's stock set for a new repo is `bug`,
`documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`,
`invalid`, `question`, `wontfix`. Swept all nine:

```
"bug"              display=accepted   lifecycle=accepted   available=true   no-match
"documentation"    display=accepted   lifecycle=accepted   available=true   no-match
"duplicate"        display=accepted   lifecycle=duplicate  available=false  TERMINAL-COLLISION
"enhancement"      display=accepted   lifecycle=accepted   available=true   no-match
"good first issue" display=accepted   lifecycle=accepted   available=true   no-match
"help wanted"      display=accepted   lifecycle=accepted   available=true   no-match
"invalid"          display=accepted   lifecycle=accepted   available=true   no-match
"question"         display=accepted   lifecycle=accepted   available=true   no-match
"wontfix"          display=accepted   lifecycle=accepted   available=true   no-match
```

**Exactly one stock collision: `duplicate`. The dev's `wontfix` ≠ `wont_fix`
claim is CORRECT** — `labels.go:96` registers `strings.ToLower(s.String())`,
i.e. `wont_fix` with an underscore; `wontfix` is not a key. Verified, not
reasoned. Near-miss probes `wont fix` and `wont-fix` also do not match, and
`canceled` (US, one L) does not match while `cancelled` does.

**Claim B — the broader exposure, which is mine and is separate.** The colliding
set is not limited to stock labels. `stripForMatch` removes the `ft:` prefix
*before* lookup, and `NewLabelMapper` registers every bare stage name as a key.
So **any** unprefixed label whose name equals a stage string is authoritative:

```
COLLIDING STOCK/BARE LABELS: [duplicate wont_fix completed cancelled]
```

`wont_fix`, `completed` and `cancelled` are **not** GitHub stock — a user must
create them. But they are entirely ordinary names for a team to have created
independently, for its own workflow, before ever connecting Farm Table. On such
a repo, pre-existing labels silently acquire terminal authority over Farm Table
scheduling and (post-fix) over authorization. That is the real shape of the
exposure, and it is wider than "one stock label" while being lower-probability
per-repo.

**Independent severity read (item 7): LOW, and it is a product decision more
than a security one.**

Reasoning: the actor must already hold repo triage rights — a trusted role. The
effect is a scheduling denial (a task leaves the ready queue), fully reversible
by removing the label. There is no privilege gain, no data disclosure, no
persistence. And critically: someone applying `duplicate` to an issue *is
asserting it is a duplicate*; the system honouring that is defensible behaviour,
not an exploit. I do not think this blocks the round. I rate it materially below
F1/F2, which are genuine privilege bypasses.

Note the escalation direction is closed by F1's fix and the opposite direction is
what remains live — as the dev disclosed. That disclosure is accurate.

**Recommendation:** require the configured prefix for *stage* labels
specifically (leave priority/type matching prefix-optional), or ship an opt-out
`labels.require_prefix = true`. User-visible either way; route as product.

---

### [LOW] F5 — On a `ComputeAvailability` error the proto silently degrades to a stage-only answer

- **Location:** `internal/server/convert.go:272` and `internal/server/server.go:2200-2207`
- **Status:** **verified BY EXECUTION** (read both sites); consequence **REASONED**
- **Pre-existing** — `availabilityComputer` predates this branch (introduced in `328e347`, and `git diff 9f98ad8..651da26 -- internal/server/server.go` contains exactly one hunk, `@@ -534,7 +534,23 @@`). **Not a round-3 regression.**

This corrects brief item 4's premise. The bare `taskToProto` **always** populates
the field:

```go
// internal/server/convert.go:272
Availability: availabilityToProto(basicAvailabilityForTask(t)),
```

so the field is never absent, and `web/src/utils/task-ready.ts:9-11`'s fallback
(`phase===OPEN && stage===ACCEPTED`) is effectively **dead for any server-sourced
task**. The method then overwrites it only when `err == nil`
(`server.go:2203`). On error the caller keeps `basicAvailabilityForTask`, which
is stage-only (`convert.go:121-136`): no `ClosedAt` arm, no `LifecycleStage`, no
blocker check.

This is a *worse* failure shape than an absent field, not a better one: the
client receives a confidently-wrong `available: true` that is indistinguishable
from a computed answer, with no signal that the authoritative computation failed.

Severity is Low because **the pass-through path cannot trigger it** —
`GitHubPassThroughStore.ComputeAvailability` has a single exit and returns `nil`
error unconditionally (`passthrough.go:829`). The realistic error source is
`EntStore.ComputeAvailability`'s blocker lookup (`entstore.go:1121-1124`), whose
stage field is authoritative anyway; the loss there is the blocker arm.

**Recommendation:** log the error and/or set an `AvailabilityReasonUnknown`
rather than silently shipping a lower-fidelity answer under the same field.

---

### [INFO] F6 — `TerminalLabelStage`'s nil guard is load-bearing and correct, but the fallback restores the buggy path on a mapper-less store

- **Location:** `internal/platform/github/labels.go:444-446`
- **Status:** **verified BY EXECUTION**

Brief item 1 asked me to prove the totality claim. **The dev's claim is correct
and the guard is genuinely necessary:**

```
zero-value store LifecycleStage(labels=[ft:stage/wont_fix]) = "accepted"
zero-value store ComputeAvailability = {Available:true Reasons:[]} err=<nil>
nil mapper TerminalLabelStage = ("", false)
MapLabelsToStage on nil mapper PANICS: runtime error: invalid memory address or nil pointer dereference
```

`ComputeAvailability` is total on a zero-value store — no panic. And the guard is
not decorative: `MapLabelsToStage` dereferences `m.enabled` and **panics** on a
nil receiver, so removing the guard would crash `ComputeAvailability`. Good catch
by the dev, correctly documented.

The observable consequence — a zero-value store reports a `wont_fix`-labelled
task `Available=true` — is the fallback restoring the pre-fix path. **This is
not production-reachable**: `NewPassThroughStore` always sets
`mapper: NewLabelMapper(...)`, which is non-nil (`passthrough.go:53-68`,
`labels.go:75`). I flag it as Info only. When `m.enabled == false` the fallback
is *correct*, because `IssueToPhaseStage` also declines to map labels, so no
demotion occurs and `t.Stage` is already authoritative. **I am explicitly not
rating this reachable** — stating so because "reconstruction is not reachability"
is the bar I failed last round.

Answering the seam question directly: the `LifecycleStager` assertion **cannot**
fail in production. `main.go:61` → `NewPlatformResolver` → bare
`*GitHubPassThroughStore` stored raw at `multistore.go:151`, no decorator. The
complete set of `store.Store` implementers is five: `*EntStore`, `*MultiStore`,
`*GitHubPassThroughStore` (production) and two embedding test doubles. Only the
latter two production types implement `LifecycleStage`; `*EntStore` correctly
does not, and its `t.Stage` fallback is right. **The seam does not change
behaviour for any other caller.**

---

### [INFO] F7 — `go vet` copies-lock findings confirmed pre-existing

`go vet ./internal/server/` reports exactly the 4 `copies lock value` findings at
`server.go:1516, 1626, 1834, 2011`, all in ephemeral handlers. **Confirmed
untouched by this diff** — the only `server.go` hunk is `@@ -534,7 +534,23 @@`.
Matches the dev's account. No action; not scope-creeped.

---

## Coverage of the brief — including what I did not reach

| Item | Status |
|---|---|
| 1. `LifecycleStager` shared-infrastructure seam | **Done, BY EXECUTION.** Totality proven (F6); seam safe for all other callers; all 5 `Store` implementers enumerated; assertion cannot fail in production |
| 2. Authorization completeness, both directions | **Done.** Transition table is correct — the dev's argument holds; the input was the wrong value. **But the corrected input is itself corruptible (F1).** `server.go:121` audited: source is the **constant** `task.StageTriage` on the *create* path, so no pre-existing task field feeds it and F2's demotion cannot reach it — **sound, no finding.** `store.LifecycleStage` has exactly one call site (`server.go:552`); no other site computes scope from a task's stage field |
| 3. Stock `duplicate` label severity | **Done, BY EXECUTION.** Independent read: **Low**. Stock claim confirmed (exactly 1); broader bare-name exposure separated as Claim B (F4) |
| 4. Scheduling seam & availability fallback | **Done, with two corrections to the premise.** `taskToProto`/`availabilityComputer` is **pre-existing, not round 3**; the fallback is **dead**, not live, because `convert.go:272` always sets the field (F5). Attacker-influenceability: **yes, newly so via F2** |
| 5. Re-examine the surviving `labelNameToID` RLock mutant | **NOT REACHED.** I spent the round on F1/F2 and did not re-examine the dominance invariant. Stated plainly rather than implying an all-clear. Per the brief I would not have raised its survival as a finding regardless |
| 2b. Test wiring = production graph (brief item 2) | **Done.** Table above. Wiring is **genuine, not a reconstruction** — this is the one thing round 3's test suite gets unambiguously right |
| 3b. Vacuous pass (brief item 3) | **Done.** Not vacuous. **But the subtest count is unasserted** — recommend a completeness guard |
| 5b. Trade-off pinned by test (brief item 5) | **Partially.** `TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite` exists and binds the from==to direction; the EM measured 24 failures on revert. **Weakness:** it asserts only `err != nil` and never inspects the resulting stage, so it would pass if `UpdateTask` succeeded while doing nothing. Same for the positive control |
| 6. Fifteenth self-built oracle | **Partially.** No self-built oracle in `authz_terminal_reopen_test.go` — its oracle is the production `PermissionDenied` error, which is correct. I did **not** systematically sweep the other ~300 new test lines in `internal/platform/github` |

**Methodology markers:** F1, F2, F4, F6, F7 and the candidate fix are **BY
EXECUTION** with pasted output. F3's routing intercept is BY EXECUTION (read);
its downstream consequence is REASONED. F5 is BY EXECUTION for the code shape,
REASONED for the consequence. All exit codes captured on the line after a
redirect, never through a pipe. All mutations applied **by content**, restored
from a `cp` backup at `/tmp/audit194-backups/`, verified byte-identical against
`git show HEAD:`, with `git status --porcelain` asserted empty.

---

## Positive observations

1. **The test wiring is real.** `authz_terminal_reopen_test.go` builds
   `EntStore → MultiStore → real *GitHubPassThroughStore → FarmTableService` and
   that **is** the graph `main.go` builds. No fake substituted for a production
   type. Round 2's reconstruction error was not repeated — this is a genuine
   improvement and the EM's item-2 concern is answered in the fix's favour.
2. **The positive control exists and works.** `test:260-272` distinguishes allow
   from deny; a gate that denied everything would not satisfy the suite.
3. **The nil-receiver guard is correct and load-bearing** (F6), and the doc
   comment explaining *why* is accurate — `MapLabelsToStage` really does panic
   without it.
4. **The both-directions fix is real.** `from == to` re-stamping is restored to
   `task:write` and pinned. The coordinator's instruction not to let "it got
   stricter" pass unexamined was followed.
5. **`server.go:121` was correctly left alone.** Feeding the constant
   `StageTriage` on the create path is right; changing it would have been a
   plausible-looking error.
6. **The doc comments are unusually good** — `IsTerminalStage`'s warning not to
   "simplify a site down to a bare call without checking what else that site's
   condition carries" (`entstore.go:1082-1087`) is exactly the right kind of
   institutional memory.
7. **The disclosure is honest.** The dev reported the `duplicate` collision
   rather than hiding it, and the `wontfix` ≠ `wont_fix` claim is correct on
   verification.

## Recommendations beyond the blocking fixes

1. **Assert table lengths in the authz suite.** `if len(cases) != N { t.Fatalf }`.
   Cheap, and it is the structural guard against the erosion class that produced F1.
2. **Strengthen the from==to and positive-control assertions** to inspect the
   resulting stage, not just `err == nil`.
3. **Make `stagePrecedence`'s display-only scope explicit in a comment**, and add
   a guard test that fails if a terminal stage is ever moved above a non-terminal
   one — the ordering is now load-bearing for a security property.
4. **Do not fix the remove-label ordering in `passthrough.go:424-431` by
   swallowing less** without also considering that a failed *add* after a
   successful *remove* strips the terminal label entirely. That is the mirror
   risk and is worth a ticket.
5. **#203 remains the right structural answer.** F1 is further evidence that
   overloading one field for display and authority keeps producing this bug
   class. I am not asking for the split here, per the brief — but the seam is
   demonstrably not sufficient on its own, and that is new information for the
   #203 decision.

---

## Appendix — full PoC source

Reproduce: place at `internal/server/zzz_audit_poc_test.go` in a clone at
`651da26`, then:

```bash
go test ./internal/server/ -run 'TestAUDIT_PoC1' -v > /tmp/poc1.txt 2>&1
echo "EXIT=$?"    # 1 = finding reproduces
```

It depends on three helpers already in the package's test files:
`newPassThroughStoreWithMock` (`passthrough_e2e_test.go:102`), `scopedCtx` and
`agentScopes` (`authz_terminal_reopen_test.go:202,210`).

Also saved at `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r3-poc.go`.

```go
package server_test

// AUDIT SCRATCH FILE — audit-194-r3. Not for commit. Deleted after the run.
//
// Proof of concept: the round-3 LifecycleStage seam is defeated by adding a
// second, NON-TERMINAL stage label alongside the terminal one, because
// TerminalLabelStage is built on MapLabelsToStage, which returns only the
// single highest-precedence stage, and stagePrecedence ranks every
// non-terminal stage ABOVE every terminal one.

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

// multiLabelIssuesResponse serves one OPEN issue carrying an arbitrary label set.
func multiLabelIssuesResponse(labels []string) string {
	nodes := make([]string, 0, len(labels))
	for _, l := range labels {
		nodes = append(nodes, fmt.Sprintf(`{"name":%q}`, l))
	}
	return fmt.Sprintf(`{
  "data": {"repository": {"issues": {
    "nodes": [{
      "id": "I_issue1", "number": 1, "title": "Abandoned work",
      "body": "A maintainer declined this", "state": "OPEN", "stateReason": null,
      "createdAt": "2026-01-15T10:00:00Z", "updatedAt": "2026-01-16T12:00:00Z",
      "url": "https://github.com/acme/widgets/issues/1",
      "labels": {"nodes": [%s]},
      "assignees": {"nodes": []}, "milestone": null,
      "subIssues": {"nodes": [], "totalCount": 0},
      "subIssuesSummary": {"total": 0, "completed": 0, "percentCompleted": 0},
      "parent": null
    }],
    "pageInfo": {"hasNextPage": false, "endCursor": ""}
  }}}
}`, strings.Join(nodes, ","))
}

func mockGHMultiLabel(t *testing.T, labels []string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		bodyStr := string(body)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(bodyStr, "updateIssue"):
			_, _ = w.Write([]byte(`{"data":{"updateIssue":{"issue":{
				"id":"I_issue1","number":1,"title":"Abandoned work","body":"",
				"state":"OPEN","stateReason":null,
				"createdAt":"2026-01-15T10:00:00Z","updatedAt":"2026-01-16T12:00:00Z",
				"url":"https://github.com/acme/widgets/issues/1",
				"labels":{"nodes":[]},"assignees":{"nodes":[]},"milestone":null,
				"subIssues":{"nodes":[],"totalCount":0},
				"subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},
				"parent":null}}}}`))
		case strings.Contains(bodyStr, "addLabelsToLabelable"):
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(bodyStr, "removeLabelsFromLabelable"):
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(bodyStr, "issues("):
			_, _ = w.Write([]byte(multiLabelIssuesResponse(labels)))
		case strings.Contains(bodyStr, "labels(first:"):
			_, _ = w.Write([]byte(`{"data":{"repository":{"labels":{"nodes":[
				{"id":"L_triage","name":"ft:stage/triage"},
				{"id":"L_accepted","name":"ft:stage/accepted"},
				{"id":"L_working","name":"ft:stage/working"},
				{"id":"L_in_review","name":"ft:stage/in_review"},
				{"id":"L_in_qa","name":"ft:stage/in_qa"},
				{"id":"L_deploying","name":"ft:stage/deploying"},
				{"id":"L_completed","name":"ft:stage/completed"},
				{"id":"L_wont_fix","name":"ft:stage/wont_fix"},
				{"id":"L_duplicate","name":"ft:stage/duplicate"},
				{"id":"L_cancelled","name":"ft:stage/cancelled"}
			],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
		case strings.Contains(bodyStr, "repository(owner:"):
			_, _ = w.Write([]byte(`{"data":{"repository":{"id":"R_repo1"}}}`))
		default:
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}))
}

// newMultiLabelService is newTerminalLabelledService with an arbitrary label set.
// Same graph: EntStore -> MultiStore -> real *GitHubPassThroughStore -> service.
func newMultiLabelService(t *testing.T, labels []string) (*server.FarmTableService, *store.MultiStore, string, uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	entStore, storeCleanup := testutil.NewTestStore(t)
	t.Cleanup(storeCleanup)

	ms := store.NewMultiStore(entStore)
	t.Cleanup(func() { _ = ms.Close() })

	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name: "acme/widgets", Platform: string(collection.PlatformGithub), RemoteID: "acme/widgets",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	if _, err := ms.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: coll.ID, Platform: "github", AuthToken: "ghp_mock_test_token",
		AuthMethod: "pat", Scopes: []string{"repo"},
	}); err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	mockGH := mockGHMultiLabel(t, labels)
	t.Cleanup(mockGH.Close)

	ms.SetResolver(func(platform collection.Platform, token string, rid string, cid uuid.UUID) (store.Store, error) {
		if platform != collection.PlatformGithub {
			return nil, nil
		}
		owner, repo, ok := store.ParseOwnerRepo(rid)
		if !ok {
			return nil, nil
		}
		return newPassThroughStoreWithMock(t, mockGH, owner, repo, cid), nil
	})

	svc := server.NewFarmTableService(ms, "test")
	collIDStr := coll.ID.String()
	list, err := svc.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: &collIDStr})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(list.GetItems()) != 1 {
		t.Fatalf("got %d tasks, want 1", len(list.GetItems()))
	}
	return svc, ms, list.GetItems()[0].GetId(), coll.ID
}

// PoC 1 — AUTHORIZATION BYPASS.
// Baseline (single terminal label) must DENY. Attack (terminal + a
// non-terminal stage label) must also deny; if it ALLOWS, the gate is bypassed.
func TestAUDIT_PoC1_SecondLabelDefeatsAcceptGate(t *testing.T) {
	for _, mask := range []string{"ft:stage/accepted", "ft:stage/triage", "ft:stage/working", "ft:stage/in_review"} {
		for _, terminal := range []string{"ft:stage/wont_fix", "ft:stage/duplicate", "ft:stage/cancelled", "ft:stage/completed"} {
			t.Run(terminal+"+"+mask, func(t *testing.T) {
				// Baseline: single terminal label -> must be denied.
				svcB, _, idB, _ := newMultiLabelService(t, []string{terminal})
				dest := pb.TaskStage_TASK_STAGE_ACCEPTED
				_, errB := svcB.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{Id: idB, Stage: &dest})
				if errB == nil {
					t.Fatalf("BASELINE BROKEN: single %s already allowed; harness is not exercising the gate", terminal)
				}
				t.Logf("baseline  [%s]            -> DENIED (%v)", terminal, errB)

				// Attack: same issue, plus one non-terminal stage label.
				svcA, _, idA, _ := newMultiLabelService(t, []string{terminal, mask})
				dest2 := pb.TaskStage_TASK_STAGE_ACCEPTED
				_, errA := svcA.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{Id: idA, Stage: &dest2})
				if errA == nil {
					t.Fatalf("BYPASS: agent token (task:write, NO task:accept) reopened an OPEN issue "+
						"labelled [%s %s] to accepted. The terminal label is still on the issue; adding "+
						"%q defeated the round-3 accept gate.", terminal, mask, mask)
				}
				t.Logf("attack    [%s %s] -> denied (%v)", terminal, mask, errA)
			})
		}
	}
}

// PoC 2 — SCHEDULING BYPASS.
// A wont_fix issue must never be reported available. Adding a second label
// must not change that.
func TestAUDIT_PoC2_SecondLabelRestoresAvailability(t *testing.T) {
	ctx := context.Background()

	_, msB, _, collB := newMultiLabelService(t, []string{"ft:stage/wont_fix"})
	tasksB, _, err := msB.ListTasks(ctx, store.ListTasksParams{CollectionID: &collB})
	if err != nil {
		t.Fatalf("ListTasks baseline: %v", err)
	}
	if len(tasksB) != 1 {
		t.Fatalf("baseline: got %d tasks, want 1", len(tasksB))
	}
	availB, err := msB.ComputeAvailability(ctx, tasksB[0])
	if err != nil {
		t.Fatalf("ComputeAvailability baseline: %v", err)
	}
	if availB.Available {
		t.Fatalf("BASELINE BROKEN: single wont_fix label already available")
	}
	t.Logf("baseline  [ft:stage/wont_fix]                    -> Available=%v Reasons=%v stage=%s",
		availB.Available, availB.Reasons, tasksB[0].Stage)

	_, msA, _, collA := newMultiLabelService(t, []string{"ft:stage/wont_fix", "ft:stage/accepted"})
	tasksA, _, err := msA.ListTasks(ctx, store.ListTasksParams{CollectionID: &collA})
	if err != nil {
		t.Fatalf("ListTasks attack: %v", err)
	}
	if len(tasksA) != 1 {
		t.Fatalf("attack: got %d tasks, want 1", len(tasksA))
	}
	availA, err := msA.ComputeAvailability(ctx, tasksA[0])
	if err != nil {
		t.Fatalf("ComputeAvailability attack: %v", err)
	}
	t.Logf("attack    [ft:stage/wont_fix ft:stage/accepted]  -> Available=%v Reasons=%v stage=%s",
		availA.Available, availA.Reasons, tasksA[0].Stage)
	if availA.Available {
		t.Fatalf("SCHEDULING BYPASS: an OPEN issue still carrying ft:stage/wont_fix is reported "+
			"AVAILABLE (ready work) once ft:stage/accepted is also applied. Labels present: %v",
			tasksA[0].Labels)
	}
}

// PoC 3 — STOCK LABEL SWEEP. Which bare GitHub-stock label names collide with
// a Farm Table stage after prefix stripping? Fails closed: the sweep must
// observe at least one known-true control.
func TestAUDIT_PoC3_StockLabelSweep(t *testing.T) {
	stock := []string{
		"bug", "documentation", "duplicate", "enhancement", "good first issue",
		"help wanted", "invalid", "question", "wontfix",
		// near-miss probes
		"wont fix", "wont-fix", "wont_fix", "completed", "cancelled", "canceled",
		"accepted", "triage", "working", "in review", "in_review",
	}
	sawKnownTrue := false
	collisions := []string{}
	for _, name := range stock {
		_, ms, _, coll := newMultiLabelService(t, []string{name})
		tasks, _, err := ms.ListTasks(context.Background(), store.ListTasksParams{CollectionID: &coll})
		if err != nil || len(tasks) != 1 {
			t.Fatalf("sweep %q: ListTasks err=%v n=%d", name, err, len(tasks))
		}
		avail, err := ms.ComputeAvailability(context.Background(), tasks[0])
		if err != nil {
			t.Fatalf("sweep %q: ComputeAvailability: %v", name, err)
		}
		lifecycle := store.LifecycleStage(context.Background(), ms, tasks[0])
		verdict := "no-match"
		if string(lifecycle) != string(tasks[0].Stage) {
			verdict = "TERMINAL-COLLISION"
			collisions = append(collisions, name)
		} else if !avail.Available {
			verdict = "unavailable"
		}
		if name == "duplicate" && verdict == "TERMINAL-COLLISION" {
			sawKnownTrue = true
		}
		t.Logf("%-18q display=%-10s lifecycle=%-10s available=%-5v  %s",
			name, tasks[0].Stage, lifecycle, avail.Available, verdict)
	}
	t.Logf("COLLIDING STOCK/BARE LABELS: %v", collisions)
	if !sawKnownTrue {
		t.Fatalf("SWEEP DID NOT FAIL CLOSED: the known-true control \"duplicate\" did not register "+
			"as a collision; the sweep is not measuring what it claims. collisions=%v", collisions)
	}
}
```

---
---

# REVISION 1 — 2026-07-28, post-EM review

The body above is **left unrevised on purpose**; this section supersedes it where
they conflict. Three corrections, all raised by `farmtable-em-task-state-model-v2`
after cross-review against the `test-194-r3` leg. **I verified all three myself
before accepting them**; two required a harness I did not have during the
original round, and one of my verification attempts produced a false negative
that I describe below because the mechanism is instructive.

## Revised severity table

| Severity | Original | **Revised** |
|---|---|---|
| **Critical** | 0 | **1** *(F1, escalated)* |
| High | 2 | **1** *(F2)* |
| Medium | 1 | 1 |
| Low | 2 | 2 |
| Info | 2 | 2 |

**Verdict unchanged: REQUEST CHANGES.**

---

## R1.1 — [CRITICAL] F1 is escalated from High: the two-label state is SELF-SERVICE

**Accepted, and verified by execution.**

My original reachability analysis listed three routes to the two-label state —
manual GitHub labelling, a partially failed label swap, and `add_labels` — and I
characterised all of them as needing "either a second actor or a partial
failure." **That characterisation was wrong about the third.** I listed
`UpdateTask(add_labels:)` as route 3 but filed it as "audit F7's mirror" and did
not chain it to the reopen. `test-194-r3` did, and the chain closes.

The mechanism is the one I described but did not follow through: the
transition-scope check at `server.go:552-557` fires **only when `req.Stage != nil`**.
An `add_labels`-only request never reaches it and is guarded by nothing beyond the
blanket `ScopeTaskWrite` at `server.go:487`. So the caller can manufacture its own
bypass precondition.

### Proof of concept — BY EXECUTION (stateful harness)

```
=== RUN   TestAUDIT_REV1_SelfServiceEscalation
    step 1  reopen                        -> DENIED (rpc error: code = PermissionDenied desc = missing required scope "task:accept")
    step 2  add_labels[ft:stage/accepted] -> ALLOWED  labels now [ft:stage/wont_fix ft:stage/accepted]
    step 3  *** CRITICAL — SELF-SERVICE ESCALATION *** one token holding only task:write
            reopened a wont_fix issue in two ordinary API calls. Labels still on issue:
            [ft:stage/accepted]. No second actor, no GitHub access, no partial failure.
--- FAIL: TestAUDIT_REV1_SelfServiceEscalation (0.01s)
```

**One token. Two ordinary API calls. No second actor, no GitHub access, no
partial failure, no race.** The `task:accept` scope separation is not a speed
bump for a `task:write` holder — it is bypassable on demand by any principal that
can call `UpdateTask`, which is every agent token.

**Aggravating detail I did not expect, visible in the trace:** after step 3
succeeds, the issue's labels are `[ft:stage/accepted]` — the successful stage
change ran the normal label swap and **removed `ft:stage/wont_fix`**. The
escalation erases its own precondition. A subsequent audit of the issue's label
state shows an ordinary accepted task with no trace of the declined status, and
the terminal label is gone from GitHub. That materially raises both the impact
and the detection difficulty.

**Severity: CRITICAL.** Self-service privilege escalation, no preconditions
outside the attacker's control, and self-erasing. Under the classification table
in use this clears "exploitable with some conditions" and lands on "exploitable,
leads to a full bypass of a deliberate authorization control."

**Recommendation is unchanged in substance** — fix `TerminalLabelStage`
(verified, closes it) — **but the self-service chain means a second, independent
control is warranted**, because the F1 fix removes only *this* instance of a
general problem: `add_labels`/`remove_labels` can rewrite the value authorization
reads, at `task:write`. Recommend that `UpdateTask` compute the lifecycle stage
of the *post-mutation* label set when `AddLabels`/`RemoveLabels` are present, and
require the corresponding transition scope — i.e. treat a label edit that changes
the lifecycle stage as the transition it actually is. That subsumes disclosed
audit F7 as well, which is the same hole in the opposite direction.

---

## R1.2 — [NEW] Third sink: the claim gate

**Accepted, and verified by execution.** My report covered two sinks
(authorization F1, availability F2) and missed a third.

`issueUnavailableForClaim` (`internal/platform/github/passthrough.go:668-676`)
takes the lifecycle stage as its first arm — `lifecycleStage != task.StageAccepted`
— and therefore inherits the identical blindness.

```
=== RUN   TestAUDIT_REV2_ClaimGateThirdSink
    baseline claim [wont_fix]            -> err=task unavailable
    attack   claim [wont_fix + accepted] -> err=<nil>  labels after=[ft:stage/working]
    *** THIRD SINK CONFIRMED *** ClaimTask succeeded on an issue still carrying
    ft:stage/wont_fix. Labels after claim: [ft:stage/working]
--- FAIL: TestAUDIT_REV2_ClaimGateThirdSink (0.01s)
```

The baseline correctly returns `ErrUnavailable`; the two-label case claims
successfully and stamps `ft:stage/working`. As with F1, the terminal label is
swapped away by the transition — the declined status is erased.

This is `store.ErrUnavailable` enforcement, not advisory availability, so it is a
distinct control from F2 and needs its own regression test. **Fix verification
must now cover three consumers, not two:** `UpdateTask` authorization,
`ComputeAvailability`, and `ClaimTask`.

---

## R1.3 — [FRAMING] The multi-label hole is PRE-EXISTING, not opened by round 2

**Accepted. My "different door" metaphor was wrong and I am withdrawing it.**

The body says F1 is *"the round-2 defect reachable again through a different
door,"* which implies round 2's F2 commit created the opening. **It did not.**

I verified this independently at `a70d3d1`, the commit immediately preceding F2:

- `internal/platform/github/labels.go:386-387` — the open-issue arm is a bare
  precedence winner with no terminal check:
  `// Open issue: labels determine stage.` / `if stage, ok := m.MapLabelsToStage(labels); ok {`
- `internal/server/server.go:537` — `TransitionScope(string(existing.Stage), string(st))`
  reads the task field directly.

So at `a70d3d1`, `[wont_fix, accepted]` already mapped to `accepted` by precedence
and fed `accepted` straight into the transition table. The bypass was live before
F2 existed. The EM's measurements at that commit (`wont_fix` alone → gate HELD;
`[wont_fix, accepted]` → BYPASS; `[duplicate, working]` → BYPASS) are consistent
with the precedence ordering I read at `labels.go:13-24`.

**Round 3 restored exactly the one cell F2 broke, and no more.** That is a
truthful description of the fix and it is not a criticism of it.

My original framing sentence stands and is the one to keep:

> *"not a new bug written into the diff, but a security control that is
> advertised as total and is not."*

**Why this matters beyond wording** — and I think this is the most important
thing in the revision. *"Restore pre-F2 behaviour"* has been the remediation
target for three rounds, and it is **structurally incapable** of finding this
class of hole, because a hole that predates the diff has no diff pointing at it.
Revert-based sink-binding — the technique that correctly produced this round's 24
failures — measures only what the diff changed. It cannot measure what the diff
left alone.

The target has to be stated **positively**, as a property rather than a delta:

> **Authorization must never read a precedence-collapsed label projection.**

That is testable independently of any commit: enumerate the label power-set that
maps to a terminal stage and assert the lifecycle stage sees it. It is also the
property that F1's fix actually establishes, which is why the fix is right even
though the diagnosis-by-delta that motivated it was incomplete.

---

## R1.4 — Methodology note: my first verification attempt was a FALSE NEGATIVE

Recording this because it is the exact trap called out in the standing bars, and
it caught me in the direction that does not announce itself.

My first attempt to reproduce R1.1 and R1.2 reused the PoC harness from the main
report. **Both tests PASSED — i.e. reported no bypass — and the exit code was 0.**

```
step 1 reopen                      -> DENIED
step 2 add_labels[ft:stage/accepted] -> ALLOWED
step 3 reopen retry                -> still denied      <-- WRONG
--- PASS: TestAUDIT_REV1_SelfServiceEscalation
```

That result was an artefact. The original mock serves a **static** issue list
built once from a fixed label slice, so it acknowledged the `addLabels` mutation
and then kept serving the original `[wont_fix]` labels. Step 3 re-read the
pre-mutation state. The harness could not express state change, so a two-call
chain was **inexpressible, not disproven**. REV-2 failed differently and equally
misleadingly: the mock had no `issue(number:)` case, so `ClaimTask` died on a
GraphQL unmarshal error before ever reaching the gate.

Had I stopped there I would have reported "could not reproduce; the EM's claim
does not hold" — a confident false negative contradicting a true finding.

The fix was a stateful mock that honours `addLabelsToLabelable` /
`removeLabelsFromLabelable` against a mutable label set, plus an
`issue(number:)` case, **plus an explicit harness self-check that fails closed**:

```go
func TestAUDIT_REV0_HarnessIsStateful(t *testing.T) { ... 
    if len(after) != len(before)+1 {
        t.Fatalf("HARNESS NOT STATEFUL: labels unchanged (%v -> %v); any bypass "+
            "result would be a false negative", before, after)
    }
}
```
```
=== RUN   TestAUDIT_REV0_HarnessIsStateful
    labels before=[ft:stage/wont_fix] after=[ft:stage/wont_fix ft:stage/accepted]
--- PASS: TestAUDIT_REV0_HarnessIsStateful (0.01s)
```

**Generalisable lesson for this workstream:** the standing bar says "assertions
must fail closed." That bar needs extending to the *harness*. A stateless mock
makes multi-step attack chains silently unreachable, and every single-step PoC
built on it will pass. **Any PoC asserting a negative result across more than one
API call must first prove its harness can express the state change** — otherwise
the negative is untrustworthy. I recommend the co-review legs adopt the
`REV0`-style self-check for any multi-call reproduction.

This also retroactively explains a gap in my main report: every PoC there is
single-call, which is why it found the two-label vector but not the self-service
chain that reaches it.

---

## Revised finding summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| **F1** | **CRITICAL** *(was High)* | Non-terminal label defeats the accept gate; **self-service** via `add_labels`, self-erasing | Verified by execution |
| **F2** | HIGH | Same root cause returns a declined issue to the ready queue | Verified by execution |
| **F2b** | HIGH *(new, same root cause)* | Third sink: `ClaimTask` succeeds and stamps `ft:stage/working` | Verified by execution |
| F3 | Medium | `passthrough.go:812-815` inheritance claim false for 2 of 3 consumers | Verified (read) |
| F4 | Low | Unprefixed stage-named labels authoritative; stock claim confirmed | Verified by execution |
| F5 | Low | Availability silently degrades to stage-only on error; pre-existing | Read + reasoned |
| F6 | Info | Nil-guard correct and load-bearing; not production-reachable | Verified by execution |
| F7 | Info | 4 `go vet` copies-lock findings pre-existing | Verified |

**Root cause for F1 / F2 / F2b is single and unchanged:**
`internal/platform/github/labels.go:448` reusing `MapLabelsToStage`, whose
single-winner contract is a display contract, combined with `stagePrecedence`
(`labels.go:13-24`) ranking every non-terminal stage above every terminal one.

The recommended fix (scan for any terminal label independently of precedence) was
verified by execution to close F1 and F2 with no existing test broken; **it should
now additionally be verified against the F2b claim path**, and paired with the
`add_labels` transition-scope control from R1.1, which the label-scan fix does
**not** address.

## Reproduction

- Main PoC: `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r3-poc.go`
- Revision output: `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r3-rev-output.txt`
- The stateful harness for REV0/1/2 is described above; it differs from the main
  PoC only in the mock (mutable label set + `issue(number:)` case).
- Clone verified clean at `651da26` after all scratch files removed;
  `git status --porcelain` empty.

---
---

# REVISION 2 — 2026-07-28, targeted measurement: does the F1 fix close the chain?

- **Clone:** `/workspace/farmtable-audit-194`, HEAD `0ba257eb99e0284a147266d59944dca44a71b1c6`
  (my log commit, on top of `651da265783ce8cbfda5d902e2a3f640ef345529`)
- **Production code audited at:** `651da26`. The F1 candidate fix was applied by
  content to `internal/platform/github/labels.go`, measured, then restored from a
  `cp` backup outside the repo. **`RESTORE_BYTE_IDENTICAL=yes`** against
  `git show HEAD:`, **`git status --porcelain` empty**, scratch test deleted.
- **Harness salvaged to:**
  `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r3-stateful-harness.go`
  (523 lines, includes REV0 and an adoption guide)

## ONE-LINE VERDICT

> **The F1 fix RENAMES the self-service chain. It does not close it.**
> `add_labels` is closed on all three sinks; `remove_labels` is open on all
> three, before and after, and no terminal scan however written can close it.

**Your prior is correct in full, on all four bullets, measured rather than
reasoned. I tried to falsify it and could not.**

---

## R2.0 — Harness first (BY EXECUTION)

Per my own R1.4 bar: a negative from REV3 is meaningless unless the mock honours
`removeLabelsFromLabelable`. It does not by default — the test leg's sibling
probe in the same salvage directory leaves that handler as a bare
acknowledgement, and REV3 run against *that* mock reports a comfortable
"DENIED." REV0 exists to make that failure loud.

```
=== RUN   TestAUDIT_REV0_HarnessIsStateful
        [github] +ft:stage/accepted -> [ft:stage/accepted ft:stage/wont_fix]
    add    : [ft:stage/wont_fix] -> [ft:stage/accepted ft:stage/wont_fix]  OK
        [github] -ft:stage/wont_fix -> [ft:stage/accepted]
    remove : [ft:stage/accepted ft:stage/wont_fix] -> [ft:stage/accepted]  OK
    HARNESS PROVEN STATEFUL IN BOTH DIRECTIONS
--- PASS: TestAUDIT_REV0_HarnessIsStateful (0.01s)
```

`REV0_EXIT=0`, captured on the line after the redirect, not through a pipe.
**Removal is proven to mutate the served label set.** Everything below is
therefore a real measurement.

Object graph is the production one — `EntStore` → `MultiStore` →
`PlatformResolver` → bare `*GitHubPassThroughStore`, matching `main.go:39,60,61`
and `resolver.go:26`.

---

## R2.1 — Your bullets 1 and 2, confirmed by reading

- `internal/server/server.go:621-625` —
  `if len(req.GetAddLabels()) > 0 { p.AddLabels = ... }` /
  `if len(req.GetRemoveLabels()) > 0 { p.RemoveLabels = ... }`. **No check of any
  kind.** Nothing between the blanket `RequireScope(ctx, ScopeTaskWrite)` at
  `server.go:487` and the store write.
- The transition-scope gate (`server.go:552-557`) sits inside the
  `if req.Stage != nil` arm that opens at `server.go:529`. **A label-only request
  never reaches it.** Confirmed by reading the enclosing block, not by grep.

## R2.2 — Bullet 3 confirmed: the ADD spelling dies (BY EXECUTION, with fix applied)

```
=== RUN   TestAUDIT_REV1_AddLabelChain
  step 1  reopen                        -> DENIED (missing required scope "task:accept")   labels=[ft:stage/wont_fix]
        [github] +ft:stage/accepted -> [ft:stage/accepted ft:stage/wont_fix]
  step 2  add_labels[ft:stage/accepted] -> ALLOWED         labels=[ft:stage/accepted ft:stage/wont_fix]
  step 3  reopen                        -> DENIED (missing required scope "task:accept")   labels=[ft:stage/accepted ft:stage/wont_fix]
  RESULT: F1 FIX CLOSES THE ADD-LABEL CHAIN.
--- PASS: TestAUDIT_REV1_AddLabelChain (0.01s)
```

The fix does what it claims for the spelling it was designed against. Credit
where due — this is a real improvement and `dev-194-fixes-4` should keep it.

## R2.3 — Bullet 4 confirmed: the REMOVE spelling is untouched (BY EXECUTION, with fix applied)

**This is the answer to the question you asked.**

```
=== RUN   TestAUDIT_REV3_RemoveLabelChain
  step 1  reopen                            -> DENIED (missing required scope "task:accept")   labels=[ft:stage/wont_fix]
        [github] -ft:stage/wont_fix -> []
  step 2  remove_labels[ft:stage/wont_fix]  -> ALLOWED         labels=[]
        [github] +ft:stage/accepted -> [ft:stage/accepted]
  step 3  reopen                            -> ALLOWED  labels=[ft:stage/accepted]
      *** CRITICAL -- THE F1 FIX RENAMES THE CHAIN, IT DOES NOT CLOSE IT ***
--- FAIL: TestAUDIT_REV3_RemoveLabelChain (0.01s)
```

Label state after each step: `[ft:stage/wont_fix]` → `[]` → `[ft:stage/accepted]`.

Note step 3's mock line: the successful reopen ran the normal stage swap and
**stamped `ft:stage/accepted` itself**. So the end state is `[ft:stage/accepted]`
— *byte-for-byte the same end state as the pre-fix add-label chain in REVISION 1*.
**The self-erasure you predicted holds identically.** The removal leaves no
trace, the transition writes a clean-looking label, and an auditor reading the
issue afterwards sees an ordinary accepted task. Same outcome, same invisibility,
one different verb.

## R2.4 — Both other sinks behave the same way (BY EXECUTION)

`ClaimTask` (F2b) with the fix applied:

```
  baseline  claim [wont_fix]                       -> err=FailedPrecondition: task unavailable  labels=[ft:stage/wont_fix]
  add       claim [wont_fix + accepted]            -> err=FailedPrecondition: task unavailable  labels=[ft:stage/accepted ft:stage/wont_fix]
  remove    claim [wont_fix stripped -> bare]      -> err=<nil>  labels=[ft:stage/working]
  *** F2b REMOVE-SPELLING OPEN ***
--- FAIL: TestAUDIT_REV4_ClaimGateBothSpellings (0.02s)
```

`ComputeAvailability` (F2) with the fix applied:

```
  baseline  [wont_fix]                  -> Available=false Reasons=[terminal] stage=accepted  labels=[ft:stage/wont_fix]
  add       [wont_fix + accepted]       -> Available=false Reasons=[terminal] stage=accepted  labels=[ft:stage/accepted ft:stage/wont_fix]
  remove    [wont_fix stripped -> bare] -> Available=true  Reasons=[]         stage=accepted  labels=[]
  *** F2 REMOVE-SPELLING OPEN ***
--- FAIL: TestAUDIT_REV5_AvailabilityBothSpellings (0.02s)
```

Same shape on all three consumers. The baselines held in every case, so each
result is a genuine exercise of the control and not a vacuous pass.

## R2.5 — Net effect of the F1 fix, both columns measured

Pristine `651da26` column obtained by restoring `labels.go` from the backup and
re-running the identical harness (`PRISTINE_EXIT=1`).

| Sink | Spelling | pristine `651da26` | + F1 candidate fix |
|---|---|---|---|
| `UpdateTask` authorization | **add** | BYPASS | **DENIED** ✅ |
| `UpdateTask` authorization | **remove** | BYPASS | **BYPASS** ❌ |
| `ClaimTask` (F2b) | **add** | claimed, `[ft:stage/working]` | **unavailable** ✅ |
| `ClaimTask` (F2b) | **remove** | claimed, `[ft:stage/working]` | **claimed** ❌ |
| `ComputeAvailability` (F2) | **add** | `Available=true` | **`Available=false`** ✅ |
| `ComputeAvailability` (F2) | **remove** | `Available=true` | **`Available=true`** ❌ |
| CLOSED-issue floor (R2.6) | remove | DENIED | DENIED ✅ |

The remove spelling is **pre-existing at `651da26`, not introduced by the fix** —
consistent with R1.3's framing. The fix is a strict improvement that halves the
attack surface and closes none of it.

---

## R2.6 — IS THERE A FLOOR? Yes, and its exact shape matters

You asked me to say it in exactly those terms. Here is the precise version,
because the honest answer is *conditional* and the condition is the interesting
part.

**For a CLOSED issue: there IS a floor.** GitHub's `state:CLOSED` is a real
field, not a label, and `ClosedAt` survives label stripping:

```
=== RUN   TestAUDIT_REV6_ClosedIssueFloor
  initial (CLOSED + wont_fix)        phase=closed stage=wont_fix  closedAt=true Available=false Reasons=[terminal] labels=[ft:stage/wont_fix]
  step 1  reopen                     -> DENIED (missing required scope "task:accept")
        [github] -ft:stage/wont_fix -> []
  step 2  remove_labels[wont_fix]    -> ALLOWED  labels=[]
  after strip (CLOSED, no labels)    phase=closed stage=completed closedAt=true Available=false Reasons=[terminal] labels=[]
  step 3  reopen                     -> DENIED (missing required scope "task:accept")
  RESULT: FLOOR EXISTS for a CLOSED issue -- state:CLOSED is not a label.
--- PASS: TestAUDIT_REV6_ClosedIssueFloor (0.01s)
```

Stripping the label moves the stage `wont_fix → completed` — still terminal,
because a closed issue with no stage label defaults to `completed`. The gate
holds. **That floor is load-bearing and nobody should refactor it onto labels.**

**For an OPEN issue carrying a terminal label: there is NO floor, and the
statement you asked for is exactly true.**

> **For an OPEN GitHub-backed task, the declined status exists ONLY in a field
> the attacker can write.** There is no second witness. The label *is* the
> decision, `task:write` grants write on the label, and therefore `task:write`
> grants the power to revoke the decision. The `task:accept` scope is not a
> control over that state; it is a control over one particular API verb that
> happens to touch it.

And that state is not a corner case — it is the *centre* of #194. "OPEN issue
carrying a terminal label" is precisely what the F2 demotion exists to render
sanely, precisely what a partially-failed close-label-swap leaves behind
(`passthrough.go:424-431` swallows the remove error), and precisely what a
maintainer produces by labelling `wont_fix` without closing.

### What this tells you about the right control

This is the part I would weight most heavily in the merge decision:

1. **The label-scan fix cannot be completed.** It is not that the current
   implementation is imperfect; it is that *no* implementation of "read the
   labels more carefully" can defend a value the attacker is authorised to
   delete. Any further round spent hardening `TerminalLabelStage` buys the add
   spelling and nothing else.
2. **Scoping label writes is the smaller, shippable control.** In `UpdateTask`,
   compute the lifecycle stage of the *post-mutation* label set whenever
   `AddLabels`/`RemoveLabels` are present, and require the transition scope that
   the resulting stage change would demand. A label edit that changes the
   lifecycle stage **is** that transition and should cost the same. This closes
   both spellings at one site, subsumes disclosed audit F7, and does not depend
   on the display/authoritative split. Sketch:

   ```go
   // internal/server/server.go, before the label passthrough at :621
   if len(req.GetAddLabels()) > 0 || len(req.GetRemoveLabels()) > 0 {
       cur := labelsOf(existing)
       next := applyLabelDelta(cur, req.GetAddLabels(), req.GetRemoveLabels())
       from := store.LifecycleStageForLabels(ctx, s.store, existing, cur)
       to   := store.LifecycleStageForLabels(ctx, s.store, existing, next)
       if from != to {
           if sc := TransitionScope(string(from), string(to)); sc != ScopeTaskWrite {
               if err := RequireScope(ctx, sc); err != nil {
                   return nil, err
               }
           }
       }
   }
   ```

   Note this must gate on the *transition the edit induces*, not merely on "is a
   stage label being touched" — otherwise routine label hygiene starts demanding
   `task:accept`.
3. **But it is a patch on the real problem, and the real problem is #203.** As
   long as the authoritative stage lives in a GitHub label, every control over it
   is a control over an API verb, and the set of verbs that can reach a label is
   open-ended: `UpdateTask` today, and anything else that ever writes labels
   tomorrow — bulk edit, sync, import, a webhook reconciler. Enumerating verbs is
   a losing game against a single mutable field. **Moving the authoritative stage
   off labels is the only control that scales**, and R2.6 is, I think, the
   strongest argument yet made for prioritising #203 rather than treating it as
   architectural tidying. I am not re-litigating its scope — it is out of round 3
   — but the evidence now says it is a security dependency, not a refactor.

**Recommendation for the merge decision:** the F1 label-scan fix is correct and
should land; it is a strict improvement. It should **not** be described in the
changelog or in code comments as closing the escalation, because it closes one
spelling of it — and an inaccurate comment is exactly the failure mode this whole
finding is about (`passthrough.go:812-815`, F3). Whether the remaining remove
spelling blocks the merge is your call, and it depends on whether the
label-write scope control from point 2 can ride along; my read is that shipping
the F1 fix alone leaves a **Critical**-severity self-service escalation live
under a comment asserting it is fixed, and that combination is worse than either
half.

---

## R2.7 — Provenance and hygiene

- Mutation applied **by content** via a single anchored edit to
  `TerminalLabelStage`; never by line number, never via `git checkout`.
- Backup `cp`'d to `/tmp/audit194-r2/labels.go.orig` **before** the edit and
  verified equal to `git show HEAD:internal/platform/github/labels.go`
  (`BACKUP_MATCHES_HEAD=yes`) before it was trusted.
- Restored and re-verified: `RESTORE_BYTE_IDENTICAL=yes`,
  `git diff --stat -- internal/platform/github/labels.go` empty.
- Scratch test `internal/server/zzz_audit_rev2_test.go` **deleted**; full source
  salvaged to
  `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r3-stateful-harness.go`
  with a provenance header, the two mock traps documented, and an adoption guide
  for inverting the assertions at merge time.
- Raw outputs salvaged alongside it: `rev0.txt`, `rev2run.txt` (with fix),
  `rev6.txt`, `pristine.txt` (without fix).
- Every exit code captured on the line following a redirect. Every assertion
  fails closed — each test carries a `BASELINE BROKEN` `t.Fatalf` that aborts if
  the gate under test is already open, and all four baselines held.
- `go vet ./internal/server/` reports only the 4 known pre-existing copies-lock
  findings (disclosed F7); the harness itself is vet-clean.
- **Final state: `git status --porcelain` empty, HEAD `0ba257e`, nothing pushed,
  no production code modified.**

---
---

# REVISION 2 (RE-ISSUED) — scoping measurement against the LANDED fix `03ab6b6`

> **Numbering note.** The EM asked for this as "REVISION 2". The section above
> already carries that name; it measured the *candidate* fix I proposed, which
> the dev did not adopt. That section stands as written — its method is
> unchanged and its direction-1 result reproduces here — but **its target is
> superseded by this one.** Where the two disagree, this section wins.

- **Target:** `03ab6b63287b29b079afac30f7a0fb345052a521` on `close-label-swap`,
  *"Fix #194 multi-label terminal bypass at the root (round 4)"*
- **Fetched** into my own clone (`git fetch /workspace/farmtable-close-label-swap
  "+refs/heads/*:refs/dev194/*"`, `git checkout -B rev2 03ab6b6`). I did not work
  in the dev's clone.
- **Production code NOT modified.** This revision required no mutation at all —
  the fix is already in the tree. Nothing pushed. `git status --porcelain` empty,
  HEAD `03ab6b6`.
- **Harness:** `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r3-stateful-harness.go`
  (777 lines, REV0 included, updated for both directions, adoption guide inside).
  Raw outputs beside it as `audit-194-r4-{rev0,alldirections,matrix}.txt`.
- Tree is green at `03ab6b6`: `internal/platform/github` and `internal/store`
  both `ok`; the two new guard tests
  (`TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast`,
  `TestTerminalStagePrecedence_CoversEveryTerminalStage`) exist and pass.

---

## THE VERDICT YOU CAN SEQUENCE ROUND 5 ON

1. **Direction 1 SURVIVES the landed fix.** The remove spelling is open on all
   three sinks. **BY EXECUTION.**
2. **Direction 2 REPRODUCES, and your reconstruction was right.** A `task:write`
   holder marks an ordinary accepted task `completed` / `wont_fix` / `duplicate`
   / `cancelled` without ever holding `task:close`. **BY EXECUTION.** It was not
   convenient reasoning; it runs.
3. **But your impact statement is too strong, and I can narrow it usefully.** The
   task is **not closed**. `UpdateTask` never issues a `closeIssue` mutation —
   measured, zero — because `passthrough.go:412-431` swaps labels and never reads
   `p.Phase`. The task is made *terminal to Farm Table*, not closed on GitHub.
4. **The damage lands at step 1, not at the short-circuit.** `AddLabels` **alone**
   already flips `Available=true → false`. Step 3 only tidies the label set.
   The short-circuit is a laundering step, not the payload.
5. **ONE CONTROL IS ENOUGH.** Your proposed post-mutation label-scope check kills
   both directions at step 1. **`from == to` does NOT need separate hardening
   today** — measured, REV9. There is a latent dependency on that, spelled out in
   R3.6, which I would write into the code rather than into a report.

**One control. Sequence round 5 on the label-write scope check alone.** Task #15
is **not** void.

---

## R3.0 — Harness first (BY EXECUTION)

Direction 1 needs `removeLabelsFromLabelable` honoured, not merely answered.

```
=== RUN   TestAUDIT_REV0_HarnessIsStateful
    add    : [ft:stage/wont_fix] -> [ft:stage/accepted ft:stage/wont_fix]  OK
    remove : [ft:stage/accepted ft:stage/wont_fix] -> [ft:stage/accepted]  OK
    HARNESS PROVEN STATEFUL IN BOTH DIRECTIONS
--- PASS: TestAUDIT_REV0_HarnessIsStateful (0.01s)
```
`REV0_EXIT=0`, captured after the redirect, not through a pipe.

I added a third guard this round: the mock now **counts `closeIssue` mutations**.
That counter is what turned point 3 above from an assumption into a measurement,
and it is the reason I can hand you a *narrower* claim than the one you sent me.

---

## R3.1 — Review of the landed fix (READ, plus the guard tests BY EXECUTION)

The dev did not take my candidate, and **it was right not to.** I recommended
iterating `stagePrecedence` filtered to terminals. The dev declared a separate
`terminalStagePrecedence`. Its stated reason — filtering leaves the privilege
answer coupled to the display rule, so reordering the display tail silently
changes an authz answer — is correct, and the asymmetry it points at is real:
`TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast` forbids lifting a
terminal above a non-terminal but says nothing about order *among* terminals,
which is exactly the axis my version would have made load-bearing. **Two
questions, two declarations. Better than what I proposed, and I'd rather record
that plainly than defend my version.**

The implementation is also right on the substance my finding was about: it scans
`m.labelToStage` directly, terminal-ness is a property of the set, and the
`!m.enabled` early return is correctly reasoned in the comment (the scan reads
`labelToStage`, which is populated regardless, so the check can no longer be
delegated). The `passthrough.go:808-820` comment rewrite also fixes my F3
inaccuracy about which consumers inherit availability, and fixes it by
*narrowing the claim* rather than by broadening the code. Good.

**None of that is in question below.** The fix does what it says. What follows is
about what it does not reach.

---

## R3.2 — DIRECTION 1 survives at `03ab6b6` (BY EXECUTION)

Add spelling — **closed by the fix**, as designed:

```
  step 1  reopen                        -> DENIED (missing required scope "task:accept")   labels=[ft:stage/wont_fix]
  step 2  add_labels[ft:stage/accepted] -> ALLOWED   labels=[ft:stage/accepted ft:stage/wont_fix]
  step 3  reopen                        -> DENIED (missing required scope "task:accept")   labels=[ft:stage/accepted ft:stage/wont_fix]
--- PASS: TestAUDIT_REV1_AddLabelChain
```

Remove spelling — **open**:

```
  step 1  reopen                            -> DENIED (missing required scope "task:accept")   labels=[ft:stage/wont_fix]
  step 2  remove_labels[ft:stage/wont_fix]  -> ALLOWED   labels=[]
  step 3  reopen                            -> ALLOWED   labels=[ft:stage/accepted]
--- FAIL: TestAUDIT_REV3_RemoveLabelChain
```

Label state per step: `[ft:stage/wont_fix]` → `[]` → `[ft:stage/accepted]`. The
successful reopen stamps its own label, so the end state is indistinguishable
from a legitimate accept. Self-erasing, as before.

Other two sinks, same shape:

```
  claim   baseline [wont_fix]            -> FailedPrecondition: task unavailable
  claim   add      [wont_fix + accepted] -> FailedPrecondition: task unavailable   <- fix works
  claim   remove   [stripped]            -> err=<nil>   labels=[ft:stage/working]  <- open

  avail   baseline [wont_fix]            -> Available=false Reasons=[terminal]
  avail   add      [wont_fix + accepted] -> Available=false Reasons=[terminal]     <- fix works
  avail   remove   [stripped]            -> Available=true  Reasons=[]             <- open
```

CLOSED-issue floor still holds (REV6 PASS): stripping the label on a closed issue
moves `wont_fix → completed`, still terminal, gate holds.

---

## R3.3 — DIRECTION 2 reproduces from an ordinary task (BY EXECUTION)

**Your reconstruction runs.** All four terminal destinations, from a plain
`accepted` OPEN task with nothing terminal about it:

```
=== RUN   TestAUDIT_REV7_CloseDirectionFromAccepted/completed
      step 0  ordinary open task   phase=open stage=accepted closed=false labels=[ft:stage/accepted]
      step 1  close directly       -> DENIED (missing required scope "task:close")
      step 2  add_labels[ft:stage/completed] -> ALLOWED  labels=[ft:stage/accepted ft:stage/completed]
              after label add      phase=open stage=accepted closed=false labels=[ft:stage/accepted ft:stage/completed]
      step 3  close to completed   -> ALLOWED
              after close          phase=open stage=accepted closed=false labels=[ft:stage/completed]
      *** CLOSE-DIRECTION BYPASS ***
--- FAIL: TestAUDIT_REV7_CloseDirectionFromAccepted/completed
--- FAIL: .../wont_fix
--- FAIL: .../duplicate
--- FAIL: .../cancelled
```

Baseline denied with `task:close` in all four, so each is a genuine exercise of
the gate. **4 of 4 bypass.**

And your causal reading is right, which is the uncomfortable part: **the round-4
fix is what makes step 2 work.** Before it, `TerminalLabelStage` collapsed
`[accepted, completed]` to `accepted` and returned `("", false)`; the attacker's
label was invisible, so it could not occupy the `from` slot. A *correct* terminal
scan is precisely what promotes an attacker-supplied label into the authorization
source. The fix closes the reopen direction and opens the close direction. That
is not an argument against the fix — it is an argument that the label is the
wrong place to read from at all, in either direction.

---

## R3.4 — Terminal starting state: 6 of 12, and the pattern is the finding (BY EXECUTION)

You asked whether it works from a terminal start too. It does, **but only half
the matrix**, and *which* half is the interesting result:

```
  completed   + add[wont_fix ] -> DENIED      wont_fix    + add[completed] -> BYPASS
  completed   + add[duplicate] -> DENIED      wont_fix    + add[duplicate] -> DENIED
  completed   + add[cancelled] -> DENIED      wont_fix    + add[cancelled] -> DENIED
  duplicate   + add[completed] -> BYPASS      cancelled   + add[completed] -> BYPASS
  duplicate   + add[wont_fix ] -> BYPASS      cancelled   + add[wont_fix ] -> BYPASS
  duplicate   + add[cancelled] -> DENIED      cancelled   + add[duplicate] -> BYPASS
--- FAIL: TestAUDIT_REV8b_TerminalStartMatrix  (6 of 12)
```

The rule is exact:

> **A bypass occurs iff `rank(dest) < rank(start)` in `terminalStagePrecedence`
> = [completed, wont_fix, duplicate, cancelled].**

The attacker's added label only wins the `from` slot when it outranks the
incumbent; otherwise the incumbent keeps `from`, `from != to`, and the "closing
always wins" rule catches it. Consequences worth having in front of you:

- **`completed` is reachable from every state** — it is rank 0, so it always
  wins the tiebreak. It is also the most damaging destination, because it is the
  one that reads as a *success*. An attacker with `task:write` can mark anything
  in the system completed.
- **`completed` is a fixed point.** Nothing escapes it via this route.
- This confirms the dev's structural claim and sharpens it: the exposure is a
  property of *ordered tiebreaking as such*, not of the order chosen. Any total
  order has a rank-0 element, and that element is universally reachable.
  Reordering `terminalStagePrecedence` only moves which stage is the free one.
  **No ordering fixes this**, which is why I would not accept a round-5 patch
  that reorders it.

## R3.5 — What Direction 2 actually does — narrower than briefed (BY EXECUTION)

I instrumented the mock to count `closeIssue` mutations, because "the task is
closed as completed" is a strong claim and the phase never moved in REV7.

```
  step 0  ordinary task      phase=open displayStage=accepted closedAt=false Available=true  Reasons=[]         labels=[ft:stage/accepted]
  after add_labels ONLY      phase=open displayStage=accepted closedAt=false Available=false Reasons=[terminal] labels=[ft:stage/accepted ft:stage/completed]
  after short-circuit close  phase=open displayStage=accepted closedAt=false Available=false Reasons=[terminal] labels=[ft:stage/completed]
  closeIssue mutations issued by the product: 0
--- PASS: TestAUDIT_REV10_CloseDirectionActualEffect
```

Two corrections to the brief, both narrowing:

1. **The GitHub issue is never closed.** Zero `closeIssue` mutations.
   `passthrough.go:412-431` handles `p.Stage` by swapping labels and does not
   consult `p.Phase` at all. So the accurate impact is *"a `task:write` holder
   can mark any task terminal to Farm Table"* — removed from `ft ready`,
   unclaimable, `Available=false Reasons=[terminal]`, and now requiring
   `task:accept` to reverse, **which the attacker does not hold**. It is an
   unauthorized decline the attacker cannot itself undo, plus a false completion
   record. That is bad, and it is a smaller claim than "closed."
2. **The payload is step 1.** `AddLabels` alone already flips availability to
   `false`. Step 3 contributes only the removal of `ft:stage/accepted`, leaving a
   tidy `[ft:stage/completed]`. So the `from == to` short-circuit is not what
   grants the capability — it launders the result into something that looks like
   a legitimate transition. Both directions still erase their own evidence, but
   via the swap in step 3, not via the grant.

This matters for sequencing: **a control at the label write intercepts the
payload; a control at the short-circuit would only intercept the cosmetics.**

---

## R3.6 — Is one control enough? YES, with one thing to write down

**`from == to` is not independently exploitable. BY EXECUTION:**

```
=== RUN   TestAUDIT_REV9_FromEqualsToNeedsNoLabelWrite
  step 0  OPEN issue carrying ft:stage/wont_fix
          phase=open stage=accepted closedAt=false labels=[ft:stage/wont_fix]
  step 1  UpdateTask(stage=wont_fix) -> ALLOWED (task:write, from==to short-circuit)
          phase=open stage=accepted closedAt=false labels=[ft:stage/wont_fix]
  RESULT: genuinely a no-op. from == to is sound here.
--- PASS: TestAUDIT_REV9_FromEqualsToNeedsNoLabelWrite
```

This is the case that adds and removes **nothing**, so a post-mutation label
control would never fire on it — which is precisely why it had to be measured
separately rather than assumed covered. It is a true no-op: phase unchanged,
`closedAt` unchanged, labels unchanged.

So **one control suffices**, and your predicted mechanism is the right one:

| | Direction 1 (remove) | Direction 2 (add terminal) |
|---|---|---|
| post-mutation stage | `wont_fix` → `accepted` | `accepted` → `completed` |
| `TransitionScope` | `task:accept` | `task:close` |
| result at step 1 | **DENIED** | **DENIED** |

Direction 2 dies at step 1 exactly as you predicted, and — per R3.5 — step 1 is
where the damage actually is, so this is not merely a technical block.

### The one thing to write down

REV9 passes **because** `passthrough.go:412-431` never writes `p.Phase`. That is
load-bearing and undocumented. If a later change makes `UpdateTask` honour phase
for GitHub-backed tasks — plausible under #203, or under any "make UpdateTask
and CloseTask consistent" cleanup — then re-asserting a stage the labels already
name becomes an **open → closed** transition costing only `task:write`, and the
short-circuit goes live with no label write for any control to inspect.

I would not handle that with a second control now. I would handle it by **landing
REV9 as a passing regression test** so the day that assumption breaks, something
goes red and names the reason. That is cheaper than hardening `from == to`
speculatively, and it does not add a scope check to a genuine no-op. REV9 is in
the salvaged harness with an adoption note saying exactly this. **(REASONED, from
reading `passthrough.go:412-431`; the current no-op behaviour is BY EXECUTION.)**

One related case I did **not** reach, stated plainly rather than implied clear:
whether a *native* (Ent-backed) task can ever hold `stage=<terminal>` with
`phase=open`, which would make `from == to` a real close on the native path too.
`LifecycleStage` falls back to `t.Stage` there, so no label can forge `from`, and
I believe the drift state is not constructible through the API — but I did not
construct it and I am not claiming it. **REASONED, not measured.** Worth ten
minutes from the round-5 dev, not a blocker.

---

## R3.7 — Recommendation for round 5

**One control, at the label write, in `UpdateTask` before `server.go:621`:**

```go
if len(req.GetAddLabels()) > 0 || len(req.GetRemoveLabels()) > 0 {
    cur  := labelsOf(existing)
    next := applyLabelDelta(cur, req.GetAddLabels(), req.GetRemoveLabels())
    from := lifecycleStageForLabels(ctx, s.store, existing, cur)
    to   := lifecycleStageForLabels(ctx, s.store, existing, next)
    if from != to {
        if sc := TransitionScope(string(from), string(to)); sc != ScopeTaskWrite {
            if err := RequireScope(ctx, sc); err != nil {
                return nil, err
            }
        }
    }
}
```

Notes for whoever implements it:

- Gate on the **transition the edit induces**, not on "a stage label was
  touched" — otherwise routine label hygiene starts demanding `task:accept`.
- `from != to` is required, not optional: adding `ft:stage/completed` to an issue
  already labelled `completed` must stay free.
- This subsumes disclosed audit F7 (the `add_labels`/`remove_labels` mirror).
- It does **not** need `terminalStagePrecedence` to change. Leave the fix as
  landed.

**Severity of what remains at `03ab6b6`:** **Critical**, unchanged from
REVISION 1. Two independent self-service chains, one token, `task:write` only,
no second actor, both self-erasing. Direction 2 is broader in reach (any task,
not only declined ones) and Direction 1 is worse in kind (it revokes a
maintainer's decision).

**And the standing conclusion from R2.6 is now stronger, not weaker.** Round 4
fixed the label *read* correctly and the attack simply moved to the label
*write*. Every control here is a control over a verb, and the verb set is
open-ended. Round 5's label-write check is the right next step and I would ship
it — but it is the second patch on the same root, and the root is that the
authoritative stage lives in a field `task:write` can write. **#203 is a security
dependency.** I am not re-litigating its scope; I am saying the measurement now
points at it twice.

---

## R3.8 — Hygiene

- No production code modified this revision — none was needed; the fix is in the
  tree. `git status --porcelain` empty, HEAD `03ab6b6`, nothing pushed.
- Worked in my own clone `/workspace/farmtable-audit-194`, fetched the dev's
  branch into `refs/dev194/*`. Did not touch the dev's clone.
- My round-3 log commit `0ba257e` is preserved locally on branch
  `audit-log-backup` as well as in your `refs/preserve/audit/close-label-swap`.
- Every exit code captured on the line after the redirect. Every probe carries a
  `BASELINE BROKEN` `t.Fatalf`; **all 21 baselines held**, so no result below is
  a vacuous pass.
- Scratch test deleted; full source salvaged with provenance, the three mock
  traps, and an adoption guide.
- Scope: this is the scoping measurement you asked for, not a round-4 review. I
  read the round-4 diff only far enough to target it correctly and to confirm the
  two new guard tests pass. The fresh audit leg still owns the review.
