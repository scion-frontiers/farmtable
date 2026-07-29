# Report — dev-194-r7a: closing the live label-write authorization bypass

Branch `label-write-scope-r7a`, base `6ced24e`. Four commits, not pushed, not merged.

| Commit | Subject |
|---|---|
| `8098f29` | Reproduce the A-4 free retryable label-destruction bypass (RED) |
| `6e98097` | Bind the label write to the snapshot the gate priced (#194 A-4) |
| `11b30c1` | Make the server binary read the operator's GitHub config (#194 M-1) |
| `9b52260` | Reject lifecycle-stage labels in InsertTasksAfter (#194 M-2) |

Verification at tip: `go build ./...` OK · `go test ./...` **EXIT 0** · `make race` OK ·
`go vet` unchanged from base (4 pre-existing `copylocks` warnings in the ephemeral
graph paths; I confirmed the same count on a stashed base tree, and none are in code
I touched).

---

## 0. Corrections to the brief

**Tree path — wrong, already corrected by you mid-flight.** `/workspace/farmtable-194-r7a`
does not exist in my container. My tree is `/workspace` itself; `git worktree list`
returns `/workspace 6ced24e [label-write-scope-r7a]`, matching the specified base. I
located this before doing any work and did **not** create the missing directory.

**The one [CLAIM] in the brief — CORRECT.** You asked me to verify that
`TestTerminalStageInput_RequiresTheConfiguredPrefix` already covers the non-default
prefix at the service level by injecting config directly. It does: seven cells
(`ft:`/`acme:`/empty prefix × prefixed/bare labels), and it builds its store through
`newPassThroughStoreWithPrefix`, which calls `ghplatform.NewPassThroughStore(...)`
**directly**. That is exactly one layer below `NewPlatformResolver`, which is why those
seven cells stayed green while M-1 shipped. Your instinct to demand a resolver-level
test was right, and for the precise reason you gave.

**One of my own predictions was wrong, recorded before measuring.** I predicted 8
discarded `addLabels`/`removeLabels` error sites in `passthrough.go`. There are **10** —
I had missed the pair in `ClaimTask`. All 10 are now routed through one helper.

---

## 1. A-4 — free retryable label-destruction primitive [HIGH, was live]

### 1.1 The brief's three anchors: all three independently re-confirmed

1. **Gate compares sets from a snapshot.** `internal/server/server.go`, the block at
   `if len(req.GetAddLabels()) > 0 || len(req.GetRemoveLabels()) > 0 {` → confirmed.
2. **Write is unconditional and blind.** `labelNamesToIDs` resolves against
   `s.labelIndex`, a repo-wide lowercased name→node-ID map populated by
   `ensureLabelIndex` from `listRepoLabels` — not from the issue. Confirmed.
3. **`p.Version` never consulted.** `grep -n "p.Version" internal/platform/github/passthrough.go`
   returns nothing, against a positive control that the same grep shape finds
   `Version` in `internal/store/store.go` (2 hits). Confirmed.

### 1.2 Failing-test-first evidence

Two tests were written and committed **before** any fix (`8098f29`), and both were red
on that commit:

```
--- FAIL: TestUpdateTask_FreeRemovalCannotDestroyALabelTheGateNeverSaw
    a task:write-only caller destroyed "ft:stage/wont_fix", which the gate never
    authorized and never charged for; labels now []
--- FAIL: TestUpdateTask_FreeAdditionCannotRestoreALabelTheGateNeverSaw
    a task:write-only caller restored "ft:stage/completed" after another actor
    removed it, forging a terminal stage the gate never charged for;
    labels now [ft:stage/completed]
```

Both failed at the **measurement** assertion — not at the baseline check and not at the
harness self-check, which is what distinguishes a real reproduction from a broken
fixture. They exercise the real gate and the real write path end to end:
`FarmTableService.UpdateTask` → `MultiStore` → `GitHubPassThroughStore` → GraphQL mock.

**Closing the audit's disclosed limit.** They measured the authorization half directly
and only *read* the write half. This drives both halves and the seam between them, so
the composition is now measured rather than inferred.

**How the concurrency is made deterministic.** A one-shot second-actor label edit fires
at the `updateIssue` mutation. That trigger is the one point provably *after* the gate's
decision (which runs entirely on the snapshot read before the store call) and provably
*before* any label mutation (`UpdateTask` issues `updateIssue` first). Triggering on a
read would have made the ordering depend on how many reads each layer happens to make.
The test asserts the interleave actually fired (`interleaves() != 1` → hard fail).

### 1.3 The fix, and why shape (b) over shape (a)

Shape **(b)**, constrain the write to the snapshot the gate evaluated. A new store seam
`SnapshotLabelWriteRestrictor` (`internal/store/store.go`), routed by `MultiStore`
exactly as the two `LifecycleStageSetStager` methods are, implemented by
`GitHubPassThroughStore`, called once from `UpdateTask` in `server.go`. It drops
removals of labels the snapshot did not carry and additions of labels it already did.

**Why (a) — optimistic concurrency on `p.Version` — was rejected.** Three reasons, in
order of weight:

1. **The attacker opts out.** `p.Version` is caller-supplied and this request path needs
   no version today. An attacker simply omits the field and the check does not run. A
   control the adversary disables by sending less is not a control.
2. **Making it mandatory breaks every client** — CLI, MCP, dashboard — for a request
   shape that has never required a version.
3. **It still charges nothing for the attempt.** Even enforced, the caller retries free
   until a version happens to match. It narrows the window; it does not remove the free
   unbounded retry, which is the part that turns a race into an exploit.

Shape (b) needs no client cooperation, derives entirely from state the server already
holds, and drops **only** writes that were no-ops by definition at decision time —
which is precisely why `SameStageSet` reported no transition and the gate charged
nothing for them. No authorized behaviour changes.

I closed the **addition** mirror as well as the removal. It is the same defect
(`before == after` → free → blind write) with the arrow reversed, letting a
`task:write` caller revert another actor's authorized *removal* of a terminal label. It
is the same fix and the same code path; pinning only the removal half would have left a
fix that could be half-reverted with nothing failing.

**Matching semantics.** The restrictor uses `labelMatchKey` (lowercase + trim), the same
function `applyLabelDelta` uses. The gate's prediction and the write's narrowing must
agree on when two names are the same label, or the write drops something the gate priced
or keeps something it did not. Exact-string equality would have reopened the
`FT:Stage/Wont_Fix` case-folding hole that `TestUpdateTask_RemovingATerminalLabelIsDeniedWhateverTheCase`
already pins. Note this is *why* I put the narrowing behind a store interface rather than
inline in `server.go`: case-insensitive matching is correct for GitHub and **wrong** for
the Ent store, whose `mergeLabels` is exact-string — an inline case-folding filter would
have silently changed native-task add semantics.

### 1.4 Errors no longer discarded

All 10 sites now route through one helper, `writeLabelSwap`, which returns. Adds and
removes remain two separate calls on the `UpdateTask` label path so the documented
adds-then-removes ordering that `applyLabelDelta` models is preserved byte-for-byte.

**This immediately surfaced a hidden fixture defect** — exactly the argument for not
swallowing errors. Both `internal/server` GraphQL mocks answered the label mutations
with `{"clientMutationId":null}`. The real mutations select
`labelable{labels(first:1){nodes{name}}}` and do **not** select `clientMutationId`, so
`githubv4` cannot unmarshal that payload. **Every label mutation in those two files has
been failing at the client since they were written, invisibly**, because the error went
into `_`. The mutation still went out over the wire and the mock applied it, so the
tests passed. The `internal/platform/github` mocks already returned the production
shape; the two server ones now do too.

I checked whether this was a production bug and it is **not** — it is a mock artifact.
Real GitHub returns only the selected fields.

### 1.5 Mutation verification

| # | Mutation applied | Result |
|---|---|---|
| 1 | `RestrictLabelWriteToSnapshot` in the passthrough returns its input unchanged (narrowing neutralised, everything else intact) | **Both tests red**, with the original bypass messages verbatim |
| 2 | `server.go` bypasses the helper: `addLabels, removeLabels := req.GetAddLabels(), req.GetRemoveLabels()` | **Both tests red**, same messages |

Mutation 2 matters separately from 1: it proves the *server-side wiring* is load-bearing,
not merely that a store method exists. Both mutants were reverted and the absence of the
`MUTANT` marker verified by grep (`grep -c MUTANT` → 0) before committing.

---

## 2. M-1 — server binary discarded the GitHub config [MEDIUM]

Confirmed as described. `NewPlatformResolver()` took no config and passed hardcoded
`nil`; `github.LoadConfig` is reached from `internal/cli/connect.go:292` and from
nowhere else in non-test code (positive control: the same grep shape returns 6 hits
across `config.go`, `connect.go`, `config_cmd.go` and the test files).

**Changes.** `NewPlatformResolver(cfg *GitHubConfig)` threads config through.
`cmd/farmtable-server/main.go` loads it and **fails fatally** on an invalid config —
matching the encryption-key precedent directly above it in `main()` and the reasoning
already written into `GitHubConfig.Validate`. A *missing* file is not an error;
`LoadConfig` returns the defaults, which is the documented way to ask for them.
`github.DefaultConfigPath` replaces the path literal, now shared by the server and
`connect.go`: where the config lives is itself a security parameter, and two call sites
that disagreed would put the CLI and the server on different configurations.

**Test at the skipped layer.** New file `internal/platform/github/resolver_test.go`
drives `NewPlatformResolver` itself. Five prefix cells plus two pinning the pre-existing
non-GitHub and malformed-RemoteID arms. The cells need no network: the mapper's answer
is a pure function of config and labels, and `LifecycleStages` reads it without touching
GitHub.

**Mutation verification.** Restoring the hardcoded `nil` reddens both custom-prefix cells
and leaves the three default-config cells green. That asymmetry is the expected
signature and is itself informative: a default-config test *cannot* see this defect,
which is the structural reason it survived a suite that already had seven prefix cells.

**Scope discipline honoured.** I did not build the 12-cell custom-prefix write matrix
(your task #31, deferred to r8).

---

## 3. M-2 — `InsertTasksAfter` ungated [MEDIUM]

Confirmed. I chose **rejection**, per your preference, and found an additional reason
beyond cost: `CreateTask` can *price* a label because it has a `req.Stage` the caller is
separately authorized for. Every `InsertTasksAfter` step is created in triage, so a
label naming a terminal stage expresses an intent this endpoint cannot carry out at any
price. No legitimate request is being refused.

Detection reuses `store.LabelDeltaLifecycleStages` rather than matching `"ft:"`, so it
follows the operator's configured `push_prefix` automatically — hardcoding the prefix
here would have rebuilt M-1 in a new place.

The test runs against a **GitHub** collection (where the accident is load-bearing) and
separates the two failure reasons: terminal label → `InvalidArgument` (this control,
before the store); ordinary label → `Unimplemented` (past this control, into the store).
The `Unimplemented` row is both the differential and an **executable record of the
reachability status** — implement pass-through `InsertTasksAfter` and that row changes
answer, forcing the implementer to this code. A third row pins native-collection
inertness. Mutation-verified: disabling the rejection reddens only the terminal row.

### 3.1 Write-path enumeration — every path that can set labels

Produced by a thorough search and spot-checked by me on the load-bearing claims
(see §3.2). **Gate** = `LabelDeltaLifecycleStages` + `SameStageSet` + `RequireScope`.

**Server RPC layer**

| # | Path | Reachable | Gate | Actor |
|---|---|---|---|---|
| 1 | `server.go: CreateTask` — `p.Labels = req.GetLabels()` | yes | **GATED** (round 6 / A-1) | `RequireIdentity`; no ActorID on `CreateTaskParams` |
| 2 | `server.go: InsertTasksAfter` — `Labels: step.GetLabels()` | yes | **NOW REJECTS** lifecycle labels (this round) | `UserIDFromContext` |
| 3 | `server.go: UpdateTask` — add/remove labels | yes | **GATED**, + narrowed by `RestrictLabelWriteToSnapshot` (this round) | `UserIDFromContext` |
| 4 | `server.go: UpdateTask` — `req.Stage` arm → label swap | yes | **GATED** (sibling gate: `LifecycleStages` + `TransitionScope`) | `UserIDFromContext` |
| 5 | `server.go: ClaimTask` → stamps `ft:stage/working` | yes | **UNGATED** by the label gate; `ScopeTaskClaim` + `issueUnavailableForClaim` | **`uuid.Nil` in open-access** |
| 6 | `server.go: CloseTask` → stamps terminal stage labels | yes | **UNGATED** by the label gate; `ScopeTaskClose` | **`uuid.Nil` in open-access** |
| 7 | `export_import.go: ImportCollection` → `importedTask` — `Labels: t.Labels` | yes | **UNGATED**; `ScopeCollectionAdmin` only | none threaded |
| 8 | `beads_import.go: convertBeadsToExportDocument` → feeds #7 | yes | **UNGATED** (inherits #7) | none |
| 9 | `graph_routing.go: taskToCreateParams` — `Labels: t.Labels` | yes | **N/A** — target is an in-memory ephemeral EntStore; read-only projection, no external effect | copies source |

**Store layer** (all native; EntStore implements neither stager, so the gate is inert by
construction — this is correct, not a stub: a native task's stage is a column)

| # | Path | Note |
|---|---|---|
| 10 | `entstore.go: CreateTask` — `create.SetLabels(p.Labels)` | sink for #1 |
| 11 | `entstore.go: InsertTasksAfter` — `create.SetLabels(step.Labels)` | **sink for #2** |
| 12 | `entstore.go: UpdateTask` — `mergeLabels(...)` / `SetLabels` | sink for #3; exact-string matching |
| 13 | `entstore.go: ImportCollection` — `create.SetLabels(imported.Labels)` | sink for #7 |
| 14 | `multistore.go` — Create/Insert/Update/Claim/Close/Import | pure routing; `ImportCollection` **hard-wired to primary** |

**GitHub platform layer** (all authenticate as the LinkedAccount PAT, not the FT user)

| # | Path | Reachable | Gate |
|---|---|---|---|
| 15 | `passthrough.go: CreateTask` — issue labels + stage/priority stamps | yes | sink for gated #1 |
| 16/17 | `passthrough.go: UpdateTask` — explicit add / remove via `writeLabelSwap` | yes | sink for gated #3, now snapshot-narrowed |
| 18 | `passthrough.go: UpdateTask` — `StageLabelSwap` | yes | sink for gated #4 |
| 19 | `passthrough.go: UpdateTask` — `PriorityLabelSwap` | yes | **UNGATED** — `ScopeTaskWrite` only. See §3.3 |
| 20 | `passthrough.go: UpdateTask` — `TypeLabelSwap` | yes | **UNGATED** — `ScopeTaskWrite` only. See §3.3 |
| 21 | `passthrough.go: ClaimTask` — `StageLabelSwap(→working)` | yes | sink for #5 |
| 22 | `passthrough.go: CloseTask` — raw `addLabels`/`removeLabels` | yes | sink for #6. **Bypasses `writeLabelSwap`**; errors logged, not returned. See §3.3 |
| 23 | `passthrough.go: writeLabelSwap` | yes | shared primitive, new this round |
| 24 | `graphql_queries.go: addLabels / removeLabels / createIssue` | yes | raw mutations, bottom of every GitHub path |
| 25 | `passthrough.go: InsertTasksAfter` | **BLOCKED** — `ErrNotImplemented` | the accident M-2 removes reliance on |
| 26 | `passthrough.go: ImportCollection` | **BLOCKED** — `ErrNotImplemented`, and doubly unreachable (MultiStore forces primary) | — |

**Dead code — declared, never constructed**

| # | Path | Status |
|---|---|---|
| 27 | `github.go: GitHubAdapter.SyncCollection` / `IssueToCreateParams` / `IssueToUpdateParams` | **DEAD**; ungated if wired; actor is a literal **`uuid.Nil`** at `github.go:94` |
| 28 | `github.go: GitHubAdapter.PushTask` | **DEAD**; ungated if wired |
| 29 | `beads.go: BeadsAdapter.SyncCollection` | **DEAD**; ungated if wired; literal **`uuid.Nil`** at `beads.go:124` |

**Client surfaces** — no independent authorization; all funnel into #1/#2/#3:
`internal/mcp/server.go` (`handleTaskCreate`, `handleTaskUpdate`), `internal/cli/task.go`
(create → #1, update → #3, **insert → #2**), and the dashboard via the same RPCs.

**Verified read-only, not writes:** `watch.go` (`Labels` are subscription *filters*),
`convert.go:326` (proto marshalling), `export_import.go` (`taskExport`),
`entstore.go:746` (`hasAllLabels` filter), `treewalk.go` (in-memory nodes),
`decomposer/writer.go` (builds `CreateTaskRequest` with no Labels field).

### 3.2 Which enumeration claims I verified myself

I spot-checked the load-bearing ones rather than relaying the whole table on trust:

- **Adapters are dead code.** Positive control: `grep -rn "github\.New\|beads\.New"`
  returns 2 real hits (`connect.go:299`, `main.go:82`). The narrowed
  `github\.New(\|beads\.New(` returns **zero**. Separately, `SyncCollection|PushTask`
  outside `internal/platform/` returns only the two interface declarations in
  `platform.go` — no caller.
- **`uuid.Nil` actor literals.** Confirmed at `github.go:94` and `beads.go:124`, both in
  the dead adapters.
- **`ImportCollection` forced to primary.** Confirmed verbatim at `multistore.go:451-455`.
- **The gate exists at exactly two RPC sites.** Confirmed; now three narrowing/rejection
  sites after this round.

### 3.3 Routed to you, not fixed — per the brief

- **`ImportCollection` (#7/#8/#13)** — gated only by `ScopeCollectionAdmin`, which is
  strictly stronger than `task:accept`/`task:close`, so this is defensible today. The
  sharp edge: import writes `Labels` and `Stage` **independently**, so a subsequent
  `RegisterPlatform` would make an imported label set authoritative without it ever
  having been priced. Worth a look in r8.
- **Inbound `SyncCollection` (#27/#29)** — dead code today, and the largest single
  concentration of ungated label writes in the repo. Both `uuid.Nil` actor literals live
  here. Whoever wires an adapter inherits an ungated write path.
- **Priority and type label swaps (#19/#20)** — real, ungated label writes on GitHub
  under bare `task:write`. Intentional, since they are not lifecycle labels, but it means
  `writeLabelSwap` has two callers whose inputs are never checked against
  `LabelDeltaLifecycleStages`, and `RestrictLabelWriteToSnapshot` does not cover them
  (it is applied to `req.GetAddLabels()`/`GetRemoveLabels()` only). If an operator's
  config ever let a priority or type label collide with the stage namespace, these are
  the bypass. **This is a new finding, not in the audit's list.** I did not fix it:
  it needs the config-collision analysis that is r8's custom-prefix matrix.
- **`CloseTask` (#22)** — diverges from the shared primitive, calling the raw mutations
  and swallowing both errors into `log.Printf`. Deliberate and documented ("never fail an
  already-completed close"), but it means the one label write that cannot fail loudly is
  also the one that stamps terminal stages. I left it alone: changing close semantics is
  outside this brief and the existing comment shows it was a considered decision.
- **Open-access mode** — with `FARMTABLE_OPEN_ACCESS=1`, no `FARMTABLE_TOKEN`, or under
  `ft connect` (which registers no auth interceptor), `RequireScope` short-circuits to
  allow and every gate in this workstream is computed and discarded. Not a regression and
  not in scope, but it bounds what any of #194 buys in those configurations.

---

## 4. LIMITS — what I did NOT verify

1. **I did not verify the fix against production or real GitHub.** Everything is measured
   against the GraphQL mock. The mock now matches the real mutation *selection sets* (I
   checked them against `graphql_queries.go`), but that is a structural match, not a live
   round trip.
2. **The A-4 concurrency test is a deterministic interleaving, not a real race.** The mock
   serialises requests and I inject the second actor's edit at a chosen point. It proves
   the *composition* — gate charges nothing, write destroys anyway — which is the defect.
   It does not prove anything about behaviour under genuine concurrent load, and it does
   not establish how wide the real window is in production.
3. **I did not measure the production window or confirm exploitation occurred.** The brief
   states the bypass is live on a real collection; I took that as given and did not
   inspect production.
4. **`RestrictLabelWriteToSnapshot` is only wired into `UpdateTask`.** `CreateTask` has no
   before-snapshot to narrow against (the task does not exist yet), which I believe is
   correct, but I have not proved there is no analogous create-time TOCTOU. Round 6's own
   comment explicitly disclaims closing the create-time TOCTOU window; that remains open.
5. **Rows #19/#20 (priority/type swaps) are unfixed and untested by me.** I identified the
   exposure by reading; I did **not** construct a config in which a priority or type label
   collides with the stage namespace, so I cannot say whether it is actually reachable.
   Treat it as an unconfirmed lead, not a measured finding.
6. **The M-2 rejection is inert today for every reachable store.** Native collections
   never trip it (correctly) and GitHub `InsertTasksAfter` returns `ErrNotImplemented`
   before any store write. Its value is entirely prospective. The test's `Unimplemented`
   row is what makes that value real rather than assumed.
7. **`main.go` wiring is not covered by a test.** No test constructs the server binary's
   `main()`, so "the server loads the config" rests on reading, plus the fact that the
   signature change makes the old call a compile error. The resolver contract itself *is*
   tested.
8. **I did not run integration tests** (`-tags integration`) — no live Postgres available.
9. **I did not hit the known WatchTasks flake.** `go test ./...` was run four times across
   this work, exit 0 every time.
10. **The enumeration is a search, and searches can miss.** I spot-checked its
    load-bearing claims with positive controls (§3.2), but I did not independently
    re-derive all 29 rows. Rows I did not personally re-verify: the exact `entstore.go`
    line anchors, `graph_routing.go` (#9), and the dashboard bundle claim.
