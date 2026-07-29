# D1 PERSISTENCE WALK — PRE-REGISTRATION
**dev-xss-r5 · written 2026-07-29T04:22:25Z · BEFORE opening any source file for this walk.**
Tree: `/workspace/farmtable-dev-xss-r5`, HEAD `d5e35a4`, base `e6bda71`.

The EM's condition, restated so it binds me: I have **eight commits riding on the answer being
"not persisted."** This document exists so that a third party can apply my criterion without me,
and so that the expensive branch is written down before I know which branch I am on.

---

## 0. MY PRIORS, DECLARED BEFORE MEASURING

Pre-registration is worthless if I pretend to no prior. I hold these going in, and each is
`[UNCHECKED]` for the purposes of this walk — none of them may be used as a result:

- I **expect** NOT PERSISTED. That is the answer that saves my eight commits. Recorded as the
  hypothesis under suspicion, not as a baseline.
- I have previously read `internal/server/convert.go` in this round, and I wrote in its doc
  comment that `syntheticCollection()` in `platform/github/passthrough.go` leaves `RemoteData`
  nil and that a store-loaded collection's map arrives through a JSON decode. **That second
  clause is itself an unexamined claim about persistence and is one of the things this walk must
  now actually check rather than reuse.**
- I have NOT read `passthrough.go`'s task path, and I have NOT read any beads adapter.
- D1's answer was produced by a PRIOR ROUND and I have never read it. I am not going to read it
  before walking, because a relayed answer is the thing that got us here. If I find it
  afterwards I will compare and report agreement or disagreement.

## 1. (a) EXACT COMMANDS AND PATHS

Source only. **No build, no `go test`, no `go vet`, no token.** Read-only: `grep`, `sed`, `Read`.
Nothing is edited; the tree stays clean at `d5e35a4`.

**Step 1 — locate the origin.** The brief names it: the `ent.Task` struct literal in
`passthrough.go`.
```
grep -rn 'ent\.Task{' internal/platform/ internal/server/
grep -rn 'func ' internal/platform/github/passthrough.go
```

**Step 2 — enclosing function of each literal**, then its callers, transitively, breadth-first,
until every path terminates in one of: `taskToProto`, a store write, a return to a gRPC handler,
or a dead end.
```
grep -rn '<enclosing func name>' --include='*.go' internal/ cmd/
```
Each hop recorded as `file:line  caller -> callee`. I will write the edge list out in full, so
the graph is auditable and not summarised.

**Step 3 — persistence predicate applied at every node on every path.** A hop persists if it
contains any of:
```
grep -nE '\.Save\(|\.SaveX\(|\.Create\(\)|\.Update\(\)|\.UpdateOne|\.SetRemoteData\(|
          json\.Marshal|json\.Unmarshal|store\.|ent\.Client|\.Tx\(' <file>
```
**Step 4 — re-read predicate.** A hop re-reads if the value that continues toward `taskToProto`
is obtained from a fresh load (`.Query()`, `.Get(`, `.Only(`, `.First(`, a store getter) rather
than being the same in-memory variable that was written.

**Step 5 — the second half of the deliverable, which the EM says nobody has answered:**
```
grep -rln 'beads' internal/ | head
grep -rn 'passthrough\|Passthrough' internal/platform/beads/ 2>/dev/null
```

## 2. (b) THE DECISION CRITERION — APPLICABLE WITHOUT ME

**PERSISTED** — there exists at least one control-flow path from the `ent.Task` struct literal
in `passthrough.go` to `taskToProto` on which **BOTH** hold:
  (i) the task (or its `RemoteData`) is written to the store — an ent mutation reaching
      `Save`/`SaveX`, or any handoff into `internal/store` that writes; **AND**
  (ii) the value that subsequently arrives at `taskToProto` is obtained by **reading back**
       (a query/get/load), not by continuing to carry the same in-memory value.
**Both halves are required. A write with no re-read is NOT persistence for this question**,
because the question is whether a JSON round-trip re-types the map before conversion.

**NOT PERSISTED** — every path from the literal to `taskToProto` carries the same in-memory
`map[string]any` with no intervening write-then-read.

**UNDETERMINED** — I cannot resolve a call edge (interface dispatch I cannot pin to a concrete
type, reflection, a codegen boundary, a handler registered by string). **UNDETERMINED IS A
FIRST-CLASS RESULT AND IT DOES NOT COLLAPSE INTO "NOT PERSISTED."** If any edge on any path is
unresolved, the overall answer is UNDETERMINED-with-the-edge-named, not a clean negative. This
is the fail-closed direction and it is the direction that costs me my eight commits, which is
why it is written here rather than decided later.

## 3. (c) WHAT HAPPENS TO MY EIGHT COMMITS UNDER EACH ANSWER

**If NOT PERSISTED** — C-1 and carrier 2 stand. All eight commits stand unchanged. Nothing to
redo. I report the edge list and the control result and stop. *This is the cheap branch and it
is the one I expect, which is exactly why I am writing the other one first.*

**If PERSISTED** — I STOP AND MESSAGE THE EM, per brief line 222, before touching anything.
Concretely, here is what I believe dies, written now so I cannot soften it later:

- **`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` becomes a test of a non-property.**
  Its whole claim is that a passthrough `map[string]string` never serialises because
  `structpb.NewStruct` rejects it. **A JSON round-trip through the store would decode that map
  back as `map[string]any` with `string` values — which IS representable — so the "accident"
  would not occur on the real path.** The test would pass while pinning something the production
  path does not do. That is the R4 vacuity defect, reintroduced by me, in the very commit that
  renamed the test for being misleading.
- **Commit `821fb07`** (Required 3 fixture + Required 5 reconciliation + D5 provenance repair)
  is the most exposed; the D5 half rests directly on the accident.
- **`internal/server/passthrough_url_test.go`** (2 lines changed) is on the same premise.
- **The project log's C-1 discussion** and any LIMIT text in `remotedata_depth_test.go` asserting
  that the passthrough value reaches `taskToProto` unserialised become false and must be
  superseded, not deleted.
- **My convert.go doc comment** already declines to claim unreachability, so it survives either
  way — but its clause about a store-loaded map "arriving through a JSON decode" would become
  the load-bearing sentence rather than an aside, and would need a citation.
- The registry (D3), the log's existence (D6) and the commit hygiene (D7) are unaffected.

## 4. (d) THE POSITIVE CONTROL — NON-OPTIONAL

**A clean "nothing persists" from a method that could never have seen persistence is the answer
I am least entitled to accept, because it agrees with my hypothesis and saves my commits.**

**Control path:** the ordinary store-backed task lifecycle — a task created or updated through
the service layer, written via the ent client, and later loaded from the store before being
handed to `taskToProto` (the `CreateTask`/`GetTask`/`ListTasks` family, and/or
`ImportCollection`, which I already know writes). I believe this path **DOES** write and re-read.

**Pass condition for the method:** my Step 3 + Step 4 predicates, applied to the control path
with no modification, must return **PERSISTED**.

**If the control returns NOT PERSISTED, the method is blind, the passthrough result is VOID, and
I report the method failure rather than the negative.** I will state the control's outcome in
the results section before stating the passthrough outcome, in that order, so the control cannot
be quietly reinterpreted after the fact.

## 5. WHAT I WILL REPORT

The full edge list; the control outcome first, then the passthrough outcome; the beads answer;
every line marked `[MEASURED]` / `[DERIVED]` / `[UNCHECKED]`; commands and observed values, never
verdicts. Appended to THIS file, below a `## RESULTS` heading, not to a fresh document.

---
*Nothing below this line existed when the walk began.*

---

# RESULTS
**Walked 2026-07-29T04:23–04:28Z. Source only. No build, no test run, no token.**
Tree unchanged: `git status --porcelain` → 0 lines, HEAD still `d5e35a4`.

## R0. THE POSITIVE CONTROL — REPORTED FIRST, AS PRE-REGISTERED

**[MEASURED] CONTROL RESULT: PERSISTED. The method can see persistence.**

| predicate half | observed |
|---|---|
| (i) write | `entstore.go:408` `create.SetRemoteData(p.RemoteData)` → `:426` `create.Save(ctx)` (CreateTask); `:898`/`:945` (UpdateTask); `:2190`/`:2192` (ImportCollection) |
| storage form | `ent/migrate/schema.go:87` `{Name: "remote_data", Type: field.TypeJSON, Nullable: true}` — a **JSON column** |
| (ii) re-read | `entstore.go:627` `getTaskWithEdges` → `s.client.Task.Query().Where(task.IDEQ(id)).…Only(ctx)`; 34 `.Query()` sites in the file |
| Go type | `ent/task.go:60` `RemoteData map[string]interface{}` |

The identical predicates, unmodified, applied to the ent-backed store return PERSISTED. **So a
NOT-PERSISTED verdict on the passthrough path below is a real negative and not a blind method.**

## R1. THE PASSTHROUGH PATH — **NOT PERSISTED**

**[MEASURED] Origin.** Exactly one non-test `ent.Task` composite literal in the whole tree:
`internal/platform/github/passthrough.go:135`, inside `func (s *GitHubPassThroughStore)
issueToTask(issue *issueNode) *ent.Task` (:123). 18 further literals exist in `_test.go` files.

**[MEASURED] Edge list.** `issueToTask` has **9 call sites and every one is inside
`passthrough.go`**: `:214` (ListTasks), `:247` (GetTask), `:308` (CreateTask), `:460`
(UpdateTask), `:534` and `:563` (ClaimTask), `:605` (CloseTask), `:787` (GetReadyTasks), `:816`
(GetBlockedTasks). All return `*ent.Task` up through the `store.Store` interface.

**[MEASURED] The structural bound — stronger than any grep.**
```go
type GitHubPassThroughStore struct {
    gql *graphqlClient; mapper *LabelMapper; owner, repo string
    repoID githubv4.ID; collectionID uuid.UUID; labelIndex map[string]githubv4.ID
}
var _ store.Store = (*GitHubPassThroughStore)(nil)   // passthrough.go:32
```
**No ent client, no store handle, no DB field. It does not have a database to persist to — it
IS the store.** (The doc comment says "No local database is used"; I am citing the *field list*,
because the comment is a claim and the fields are the evidence.)

**[MEASURED] Predicate sweep, whole file:** `.Save(|.SaveX(|.Create()|.Update()|.UpdateOne|
.SetRemoteData(|json.Marshal|json.Unmarshal|ent.Client|.Tx(|.Query()` over `passthrough.go`
→ **zero hits.**

**[MEASURED] No intervening layer persists.** `MultiStore` (`multistore.go`) is a pure router —
`return m.storeForCtx(ctx, p.CollectionID).CreateTask(ctx, p)`. Same predicate over
`multistore.go` → zero hits. Its cache is `platforms map[uuid.UUID]Store` (:40) — it caches
**store instances, not tasks**.

**[MEASURED] Server layer carries the same pointer.** At all five representative sites the value
is the store's return value, one to five lines earlier, unwritten in between:
`server.go:206 t, err := s.store.CreateTask(...)` → `:210 s.taskToProto(ctx, t)`; likewise
`:319→:327` GetTask, `:678→:682` UpdateTask, `:745→:750` ClaimTask, `:798→:802` CloseTask. The
wrapper `server.go:2193` calls `taskToProto(t)` then only attaches availability.

### R1a. THE REFINEMENT THAT A FLAT "NO" WOULD HAVE HIDDEN

**There IS a write-then-re-read on this path, and it does involve a JSON decode.** `CreateTask`
mutates GitHub (`s.gql.createIssue`, :298) and then converts the **response**; `UpdateTask`
(:460), `ClaimTask` (:563) and `CloseTask` (:605) each re-fetch. Those responses are JSON,
decoded into `issueNode`.

**[MEASURED] But `RemoteData` does not participate in that round-trip, and this is the whole
answer.** GitHub does not store `RemoteData` — there is no such field to read back. The map is
**synthesised on every call** by `issueBuildRemoteData(owner, repo, issue)`
(`graphql_queries.go:476`, the sole producer, one call site at `passthrough.go:147`) from the
already-decoded **typed struct fields** of `issueNode`.

So criterion (ii) fails: the value arriving at `taskToProto` is never obtained by reading back a
stored `RemoteData`. **The map's Go value types are fixed by Go source, not by a JSON decoder.**
That is precisely the property C-1 requires, and it is a stronger guarantee than "no DB",
because it would survive someone adding one.

### R1b. C-1 STANDS, AND I FOUND A SECOND CARRIER NOBODY HAS PINNED

**[MEASURED]** `issueBuildRemoteData` writes `"labels": issueLabels(issue)`, and
`graphql_queries.go:468` is `func issueLabels(issue *issueNode) []string`. **`[]string` is
exactly what `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` asserts is
unrepresentable.** The test's carrier is the real one. C-1 is intact.

**[DERIVED] Strengthening:** `labels` is set **unconditionally** in the map literal, and
`issueLabels` returns `make([]string, len(...))` — never nil. So the unrepresentable carrier is
present on **every** passthrough task, not merely on labelled ones.

**[MEASURED] SECOND, INDEPENDENT CARRIER — NOT PINNED BY ANY TEST.**
`graphql_queries.go:501-510` builds `var subs []map[string]any` and sets `rd["sub_issues"] =
subs`. **`[]map[string]any` is also not structpb-representable** (`NewStruct` wants `[]any`).
Present only when `len(issue.SubIssues.Nodes) > 0`. **This is a finding, not a task** — I am
holding at D1-only as instructed and not touching the test. It matters because if anyone ever
"fixes" `labels` to `[]any`, C-1 would still hold via `sub_issues`, and a single-carrier pin
would report the fix as safe. (`parent` and `sub_issues_summary` are plain `map[string]any` and
ARE representable, so they are not carriers.)

## R2. **DOES BEADS HAVE A PASSTHROUGH PATH AT ALL? — NO.**

**[MEASURED]** `internal/platform/beads/` contains exactly two files, `beads.go` and
`beads_integration_test.go`. `beads.go:80` is `var _ platform.Adapter = (*BeadsAdapter)(nil)` —
**there is no `var _ store.Store` and no `ent.Task{}` literal in the package.** `BeadsAdapter`
*holds* a `store.Store` (`beads.go:77`) and **writes into it**: `:130
a.store.CreateTask(ctx, params)`, `:124 a.store.UpdateTask(...)`, with `RemoteData:
buildRemoteData(issue, remoteID)` at `:199` and `:238`.

**[DERIVED] So beads is the mirror image of passthrough-GraphQL, and it is the PERSISTED one.**
Beads is a **sync** adapter: it writes tasks into the ent store, which is the control path proved
PERSISTED in R0. Beads `RemoteData` therefore **does** go through a `field.TypeJSON` column and
**is** JSON round-tripped before any later read reaches `taskToProto`.

**[DERIVED, flagged not acted on]** This bears on the beads-shaped keys logged by
`TestRemoteDataKeysWrittenByAdaptersAreClassified` (`created_at`, `created_by`, `external_ref`,
`metadata`, …): they arrive **post-decode**, so their Go types are the decoder's, not
`buildRemoteData`'s. The `metadata` reason string I shipped says `json.RawMessage` "never reaches
the wire at all" — **on the beads path that reasoning is about a value that has been through a
JSON round-trip, and I have not checked what `json.RawMessage` decodes back as.** Not touching
it; reporting it. It is the one place where R2's answer could reach my shipped artefacts.

## R3. VERDICT AGAINST THE PRE-REGISTERED CRITERION

| | result |
|---|---|
| Positive control (d) | **PERSISTED** — method is not blind |
| Passthrough → `taskToProto` | **NOT PERSISTED** — 0/9 paths satisfy (i)+(ii) for `RemoteData` |
| UNDETERMINED edges | **none.** All 9 call sites are intra-file; no interface dispatch, reflection or codegen boundary sits between the literal and `taskToProto` other than `store.Store`, whose only two task-returning implementations on this path (`GitHubPassThroughStore`, `MultiStore`) were both walked. |
| Beads passthrough path | **DOES NOT EXIST** — beads is a sync adapter and its path IS persisted |

**Consequence, per §3:** the cheap branch. C-1 and carrier 2 stand. **All eight commits stand
unchanged. Nothing is redone.** I did not need the expensive branch — and it was written down
before I knew that.

**[UNCHECKED]** The prior round's D1 answer. I still have not read it. I walked without it
deliberately; if it exists, compare it to R1/R2 — an independent agreement is worth more than
the relay I was originally offered, and a disagreement is worth more still.

---

# APPENDIX — COMPARISON WITH THE PRIOR ROUND'S WALK (done AFTER, on the EM's ruling)

Located in 3 commands: `reports/persistence-walk-194-r11.md`, "adapter struct literal →
`taskToProto`", **pinned to `e6bda71` — my own base.** Read the artefact, not any paraphrase.

**VERDICT: AGREES.** Its §4: "the value is THE SAME GO VALUE the adapter constructed. No JSON
marshal/unmarshal, no database write-then-read, no ent Create/Save-then-query, no cache, no gRPC
transit intervenes." Independently reached, different method, same answer.

**BUT IT IS STRICTLY MORE COMPLETE THAN MINE, AND IT FOUND A PATH I MISSED.**

Its Path 12 — the **ephemeral graph store**. `graph_routing.go:72` pulls passthrough tasks via
`s.store.ListTasks`, then `:99` writes each into an **in-memory SQLite store** via
`ephemeral.CreateTask(taskToCreateParams(t, ephCollID))`, and the inner handler reads them back
out. **That is a genuine write-then-re-read with a real encode/decode step, and my walk never saw
it.** The answer survives only because `taskToCreateParams` (`graph_routing.go:134-153`) copies
fourteen fields and **never assigns `RemoteData`** — so the map arrives `nil`, neither original
nor reconstructed.

**Why I missed it, stated as a method defect and not a near-miss.** My Step 2 enumerated callers
of `issueToTask` and my Step 3/4 predicates were then applied **to two files** — `passthrough.go`
and `multistore.go` — plus five sampled server sites. Path 12 leaves the store interface entirely
and re-enters through a *different* store. My predicate would have caught
`ephemeral.CreateTask(...)` on sight; **I never pointed it at the file.** I bounded the sweep by
FILE when the criterion was written over PATH NODES.

**AND MY POSITIVE CONTROL DID NOT CATCH THIS, WHICH IS THE PART WORTH KEEPING.** The control
proved the *predicate* could see persistence. It said nothing about whether the *enumeration* was
complete, because it was applied to a file I had already chosen to sweep. Those are two different
components and I reported a confidence covering both:

> **A POSITIVE CONTROL ON THE DETECTOR DOES NOT VALIDATE THE SEARCH SPACE. IT PROVES THE
> INSTRUMENT FIRES WHEN POINTED AT THE THING; IT CANNOT PROVE YOU POINTED IT EVERYWHERE.** My
> §R3 line "UNDETERMINED edges: none" was therefore overstated — it was true of the graph I
> built and silent about the graph I failed to build. **Had `taskToCreateParams` copied
> `RemoteData`, my walk would have returned NOT PERSISTED and been wrong**, and the control
> would still have come back green.

A control for the enumeration would have been a *known* second entry point, deliberately withheld
from my file list, that the method had to rediscover. I did not build one. That is the fix for
next time.

**Two further agreements, worth recording because they were reached independently:**
- Its §4 names **both** carriers — "`labels` still `[]string` and `sub_issues` still
  `[]map[string]any`" — so the second carrier was **observed at r11 and never pinned**. The gap
  closed by Ledger #226 was in the test, not in the knowledge. That is the more troubling shape:
  not something nobody knew, but something written down and left unpinned.
- Its §5 Traps records that the sync-REST adapter "**does** persist via `a.store.CreateTask`/
  `UpdateTask`", matching my R2 finding for beads.

**Disagreements: none.** Not reconciling anything, because there is nothing to reconcile — but
the completeness gap above is mine, and it is not a disagreement about the answer.
