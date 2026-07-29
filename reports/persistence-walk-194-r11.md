# Persistence Walk 194-r11 — adapter struct literal → `taskToProto`

All citations are pinned to commit **e6bda71**. Every read in this walk was done via
`git -C /workspace/farmtable show e6bda71:PATH`. The working tree (HEAD 633f8f2 on
`task-state-web-ui-v2`) was never read; divergence was confirmed first
(`git merge-base e6bda71 HEAD` = 7a0f220, neither an ancestor of the other).

Nothing was modified. No build, no test run, no `go` invocation of any kind.

---

## 0. Corrections to the brief's key locations

Two paths in the brief do not exist at e6bda71. I did not silently substitute; both are
recorded here because a reader checking my citations would otherwise hit the same wall.

| Brief said | Actual at e6bda71 |
|---|---|
| `internal/platform/passthrough/passthrough.go` | `internal/platform/github/passthrough.go` |
| `internal/ent/entstore.go` | `internal/store/entstore.go` |

`internal/platform/github/graphql_queries.go`, `internal/platform/beads/beads.go` and
`internal/server/convert.go` exist as stated.

---

## 1. The construction site

`e6bda71:internal/platform/github/passthrough.go:135-150` — the only `ent.Task{` composite
literal anywhere under `internal/platform/` (verified by tree-wide grep):

```go
t := &ent.Task{
    ...
    RemoteData:   issueBuildRemoteData(s.owner, s.repo, issue),   // :147
    Labels:       labels,
    ...
}
```

inside `func (s *GitHubPassThroughStore) issueToTask(issue *issueNode) *ent.Task`
(`e6bda71:internal/platform/github/passthrough.go:123`).

The producer is `e6bda71:internal/platform/github/graphql_queries.go:476-519`. It has
**exactly one non-test caller**, the line above (verified tree-wide). The dynamic types it
installs, which are the whole point of the question:

- `rd["labels"]` = **`[]string`** — `graphql_queries.go:486`, from `issueLabels`
  (`graphql_queries.go:468-474`, which builds `make([]string, …)`).
- `rd["sub_issues"]` = **`[]map[string]any`** — `graphql_queries.go:501-511`.
- `rd["parent"]`, `rd["sub_issues_summary"]` = `map[string]any` —
  `graphql_queries.go:494-499`, `:512-516`.

Note on the GraphQL decode: the HTTP/JSON decode that produces `*issueNode` happens
**before** this function runs. `issueBuildRemoteData` constructs a fresh Go map from the
already-decoded struct fields, so the map itself has never been through an encoder. It is
not a decoded value.

`issueToTask` has 9 call sites, all within `passthrough.go`:
`:214, :247, :308, :460, :534, :563, :605, :787, :816`.

---

## 2. Wirings that can put this store behind `taskToProto`

`taskToProto` is unexported in package `server`, so only an in-process `FarmTableService`
can call it. Three wirings exist at e6bda71:

- **W1 — production server.** `e6bda71:cmd/farmtable-server/main.go:60-61` builds
  `store.NewMultiStore(entStore)` + `SetResolver(github.NewPlatformResolver())`; the service
  is constructed at `:98`. The passthrough store is created lazily per collection by
  `e6bda71:internal/platform/github/resolver.go:26`.
- **W2 — CLI passthrough.** `e6bda71:internal/cli/connect.go:299` constructs the passthrough
  store and `:306` makes it the service's **primary** store directly (no MultiStore).
- **W3 — tests only.** `e6bda71:internal/testutil/testserver.go:69`, the only wiring that
  supplies `WithEphemeralPool`. Confirmed tree-wide: neither `main.go` nor `connect.go`
  nor `dashboard.go` passes it. This gates Path 12 below.

**`MultiStore` performs no persistence on any task route.** Every task method is a pure
delegation to `storeFor*(…)`: `CreateTask` `e6bda71:internal/store/multistore.go:193-195`,
`GetTask` `:201-207`, `ListTasks` `:209-214`, `UpdateTask` `:220-226`, `ClaimTask` `:228-234`,
`CloseTask` `:259-265`, `GetReadyTasks` `:358-363`, `GetBlockedTasks` `:365-370`. The returned
`*ent.Task` pointer is passed through untouched.

**The server wrapper performs no persistence.**
`e6bda71:internal/server/server.go:2193-2201` calls `taskToProto(t)` on the same pointer and
only overwrites `proto.Availability`.

---

## 3. Enumerated paths

Twelve routes reach (or are gated from reaching) `taskToProto` at
`e6bda71:internal/server/convert.go:256`. Paths 1–10 are in-memory; Path 11 is unreachable;
Path 12 is the one that involves a real serialisation round-trip.

### Path 1 — ListTasks — **DIRECT**
`passthrough.go:214` (`issueToTask`) → `ListTasks` returns slice `:229,:232` →
`multistore.go:209-214` (delegation) → `e6bda71:internal/server/server.go:458` →
`:467 s.taskToProto(ctx, t)` → `server.go:2194` → `convert.go:256`.
No encode/decode. Same `*ent.Task`, same `map[string]any`, `labels` still `[]string`.
*Depth reached: `taskToProto` body, fully read. Last function inspected: `taskToProto`.*

### Path 2 — GetTask — **DIRECT**
`passthrough.go:247` → `multistore.go:201-207` → `server.go:319` → `:327` → `convert.go:256`.
Note `MultiStore.GetTask` calls `storeForTask` (`multistore.go:167-189`), which probes
`m.primary.GetTask` first; on miss it scans platform stores. That probe is a *lookup*, not a
transform — the value ultimately returned is the passthrough store's own pointer.
*Depth: `taskToProto`. Last inspected: `storeForTask`, `taskToProto`.*

### Path 3 — CreateTask — **DIRECT**
`passthrough.go:308` (converts the freshly-created issue) → `multistore.go:193-195` →
`server.go:206` → `:210` → `convert.go:256`.
The GitHub mutation is a network write, but the value converted is built by `issueToTask`
from the mutation *response* in memory; it is not read back out of any store.
*Depth: `taskToProto`. Last inspected: `taskToProto`.*

### Path 4 — UpdateTask — **DIRECT**
`passthrough.go:460` → `multistore.go:220-226` → `server.go:678` → `:682` → `convert.go:256`.
Worth stating because it is counter-intuitive: the server may build
`p.RemoteData` from the request at `server.go:660-671`, but
`GitHubPassThroughStore.UpdateTask` never reads it — the returned `RemoteData` is
re-synthesised wholesale by `issueToTask`/`issueBuildRemoteData`. (`convert.go:329-330`
states this same fact.)
*Depth: `taskToProto`. Last inspected: `taskToProto`.*

### Path 5 — UpdateTask relationship-target refresh — **DIRECT**
`server.go:697 s.store.GetTask(ctx, targetID)` → `passthrough.go:247` →
`server.go:700 s.taskToProto(ctx, tt)` → `convert.go:256`.
A distinct route from Path 4: a second, independent `issueToTask` invocation feeding a
separate event publish. Still no round-trip.
*Depth: `taskToProto`. Last inspected: `taskToProto`.*

### Path 6 — ClaimTask — **DIRECT**
`passthrough.go:563` (post-mutation refresh via `s.gql.getIssue`) → `multistore.go:228-234` →
`server.go:745` → `:750` → `convert.go:256`.
Sub-branch, terminating: `passthrough.go:534 current := s.issueToTask(target)` produces a
task that is consumed only by the guards at `:535-540` (`issueUnavailableForClaim`,
`passthrough.go:575-577`) and then discarded. **It never reaches `taskToProto`.** Recorded so
the 9 call sites reconcile.
*Depth: `taskToProto`. Last inspected: `taskToProto`, `issueUnavailableForClaim`.*

### Path 7 — CloseTask — **DIRECT**
`passthrough.go:605` → `multistore.go:259-265` → `server.go:798` → `:802` → `convert.go:256`.
*Depth: `taskToProto`. Last inspected: `taskToProto`.*

### Path 8 — GetReadyTasks, non-ephemeral — **DIRECT**
`passthrough.go:787` → `store.ReadyTaskResult{Task: t}` `:788-791` →
`multistore.go:358-363` → `server.go:1560` → `:1570 s.taskToProto(ctx, r.Task)` →
`convert.go:256`.
`ReadyTaskResult` is a plain struct holding the pointer — no copy, no encoding.
**Condition:** reached only when `req.CollectionId == nil` (the ephemeral fork at
`server.go:1486-1512` is entered only inside `if req.CollectionId != nil`). With `MultiStore`
and a nil `CollectionID`, `multistore.go:362` routes to `m.primary`, i.e. the EntStore —
so under W1 this path reaches the passthrough store only when a collection ID is supplied,
which is precisely when Path 12 preempts it. Under W2 (passthrough *is* primary) it is live.
*Depth: `taskToProto`. Last inspected: `taskToProto`.*

### Path 9 — GetBlockedTasks, non-ephemeral — **DIRECT**
`passthrough.go:816` → `BlockedTaskResult{Task: t}` `:817` → `multistore.go:365-370` →
`server.go:1662` → `:1672` → `convert.go:256`. Same condition as Path 8
(fork at `server.go:1604-1608`).
*Depth: `taskToProto`. Last inspected: `taskToProto`.*

### Path 10 — GetDependencyTree — **DIRECT**
`server.go:1738 s.store.GetTask` → `passthrough.go:247` →
`server.go:1744 s.taskToProto(ctx, t)` → `convert.go:256`, recursing through
`buildDependencyNode` (`server.go:1732`).
*Depth: `taskToProto`. Last inspected: `buildDependencyNode`, `taskToProto`.*

### Path 11 — InsertTasksAfter — **UNREACHABLE from this literal**
`server.go:280` → `multistore.go:197-199` → `GitHubPassThroughStore.InsertTasksAfter`
(`passthrough.go:311-313`) returns `store.ErrNotImplemented`. The handler returns at
`server.go:281-283`, so `:286`/`:289` are never reached with a passthrough-built task.
Same for `ListAllTasksForCollection` (`passthrough.go:235-237`) and `ImportCollection`
(`passthrough.go:766-768`) — both `ErrNotImplemented`, which closes the export/import and
bulk-mirror routes I checked for.

### Path 12 — Ephemeral graph store — **RECONSTRUCTED (and `RemoteData` is DROPPED before the round-trip)**

This is the second route, and it is the one that does not behave like the others.

Chain:
1. `passthrough.go:214` builds the task (`issueToTask` → `issueBuildRemoteData`).
2. `e6bda71:internal/server/graph_routing.go:72 s.store.ListTasks(...)` pulls those tasks.
3. `graph_routing.go:99 ephemeral.CreateTask(ctx, taskToCreateParams(t, ephCollID))`
   writes each one into an **in-memory SQLite store** obtained from
   `s.ephemeralPool.Get(ctx)` (`graph_routing.go:63`;
   `e6bda71:internal/store/ephemeral.go:40` — DSN `file::memory:?_fk=1`;
   `e6bda71:internal/store/entstore.go:337 sql.Open("sqlite3", dsn)`).
4. `graph_routing.go:128 NewFarmTableService(ephemeral, s.version)`; the handler re-dispatches
   against that service (e.g. `server.go:1511 return ephSvc.GetReadyTasks(ctx, &ephReq)`).
5. The ephemeral collection's platform is `farmtable` (`graph_routing.go:85`), so
   `resolveGraphRoute` returns `graphRouteDirect` (`graph_routing.go:38-40`) and the inner
   call falls through to the EntStore query, which **reads the rows back out of SQLite**.
6. Those reconstructed `*ent.Task` values reach `taskToProto` at `server.go:1570`.

**Encode/decode step, named exactly:** the SQLite write at `graph_routing.go:99` (via
`EntStore.CreateTask`) followed by the SQLite query in the inner handler's
`s.store.GetReadyTasks`. Task rows leave Go memory and are reconstructed.

**But the `RemoteData` value does not travel this path at all.** `taskToCreateParams`
(`graph_routing.go:134-153`) copies Title, Description, CollectionID, Phase, Stage,
NativeLabel, Type, Priority, Labels, StartDate, DueDate, Repo, Branch, AcceptanceCriteria —
and **never assigns `RemoteData`**. This is not because the field is unavailable:
`store.CreateTaskParams` has a `RemoteData map[string]any` field
(`e6bda71:internal/store/store.go:63`), and `EntStore.CreateTask` would persist it
(`e6bda71:internal/store/entstore.go:407-408`). The copy simply omits it.

So the correct classification of Path 12 for the value in question is: the task is
RECONSTRUCTED, and its `RemoteData` is **`nil`** on arrival — neither the original value nor
a reconstruction of it. Downstream consequence at `convert.go:258` and `:317`: both
`t.RemoteData != nil` guards are false, so `platform` falls back to
`pb.Platform_PLATFORM_FARMTABLE` and `RemoteId`/`RemoteUrl`/`RemoteData` are all unset.

**Reachability.** Applies to the four ephemeral forks: `GetReadyTasks` `server.go:1498-1499`,
`GetBlockedTasks` `:1608-1609`, `GetCriticalPath` `:1817-1818`, `GetBottlenecks` `:1994-1995`.
The route is selected for GitHub collections — `collectionSupportsGraph`
(`e6bda71:internal/server/graph_support.go:25-38`) with
`platformGraphDefaults[PlatformGithub] = true` (`graph_support.go:12`).
**However**, `loadEphemeralStore` returns `Internal "ephemeral store pool not configured"` at
`graph_routing.go:59-61` when no pool is set, and `WithEphemeralPool` is supplied **only** by
`e6bda71:internal/testutil/testserver.go:69` at this commit. Under W1 and W2 these four RPCs
therefore error out rather than delivering a task to `taskToProto`. Path 12 is live under
test wiring (W3) and is a latent production path the moment a pool is wired.
*Depth: `taskToProto` via the inner service. Last inspected: `taskToCreateParams`,
`collectionSupportsGraph`, `EphemeralStorePool.Get`.*

---

## 4. Answer to the question as posed

**On every path by which the adapter's `RemoteData` map actually arrives at `taskToProto`
(Paths 1–10), the value is THE SAME GO VALUE the adapter constructed.** No JSON
marshal/unmarshal, no database write-then-read, no ent `Create/Save`-then-query, no cache,
no gRPC transit intervenes. `MultiStore` delegates by pointer; the server wrapper passes the
pointer; `taskToProto` receives the identical `map[string]any` with `labels` still `[]string`
and `sub_issues` still `[]map[string]any`.

The gRPC boundary in both W1 and W2 (including the bufconn server at
`connect.go:301-307`) sits **after** `taskToProto`, marshalling the already-converted
`pb.Task`. It cannot affect the value arriving at the converter.

**The one path with a genuine serialisation round-trip (Path 12) does not carry `RemoteData`
at all**, because `taskToCreateParams` drops the field before the write.

### Independent corroboration inside the repo

This conclusion is not resting on my trace alone. The absence of a round-trip is
*observable* at the wire and is already pinned by an existing test:

- `convert.go:358` does `pt.RemoteData, _ = structpb.NewStruct(sanitizeRemoteData(t.RemoteData))`
  — error discarded.
- `sanitizeRemoteData` does not normalise slice types. `"labels"` is not URL-bearing
  (`urlvalidate_differential_test.go:785-786`), so it falls to the generic switch in
  `sanitizeRemoteValue`, whose cases are `map[string]any`, `[]any`, `[]map[string]any`
  (`e6bda71:internal/server/urlvalidate.go:295-333`); `[]string` matches none and exits via
  `default: return v, true` (`urlvalidate.go:334-335`), unchanged.
- `structpb.NewStruct` rejects `[]string`, so `pt.RemoteData` is silently nil for every
  passthrough task. Pinned by `TestGitHubPassthroughRemoteDataNeverSerialises`
  (`e6bda71:internal/server/urlvalidate_differential_test.go:761-776`), whose positive
  control shows `[]any` serialises fine.

That asymmetry is the proof: **had any path round-tripped the map, `labels` would have become
`[]any` and `remote_data` would populate.** It does not. The commentary at
`urlvalidate_differential_test.go:740-753` reaches the same conclusion independently,
explicitly separating "this path" from "the ent-stored and collection-imported paths".

---

## 5. Traps checked

- **Vacuous pass.** Every path above records the depth reached and the last function
  inspected. All ten in-memory paths were walked to the body of `taskToProto` itself, which I
  read in full (`convert.go:256-401`) — not stopped at a call site.
- **Interface boundaries.** The value crosses `store.Store` twice (passthrough → MultiStore →
  service). I read the concrete `MultiStore` bodies rather than assuming delegation, and
  confirmed `GitHubPassThroughStore` is the only non-test `store.Store` implementation besides
  `EntStore`/`MultiStore` (`passthrough.go:32`). No channels or generic containers on any path.
  `ReadyTaskResult`/`BlockedTaskResult` are plain structs holding `*ent.Task`.
- **Do not reason from names.** Two names would have misled here, and both were caught by
  reading bodies: `taskToCreateParams` (`graph_routing.go:134`) sounds total but silently
  omits `RemoteData`; and `GitHubPassThroughStore.UpdateTask` accepts a `RemoteData` param it
  never reads. Neither was inferred from the identifier.
- **Sibling adapter, out of scope but checked.** `internal/platform/github/github.go` has a
  *different* builder, `buildRemoteData` (`github.go:257`), on `gh.Issue` (REST), and it
  **does** persist via `a.store.CreateTask`/`UpdateTask` (`github.go:94,:100`). Tasks from that
  sync path are genuinely reconstructed out of the database. It is a separate construction
  site, not the literal at `passthrough.go:135`, so it is excluded — but it is very likely the
  source of any contrary recollection, and it is what
  `urlvalidate_differential_test.go:752-753` means by "the ent-stored path".
- **`beads.go`** (a brief starting point) builds its own `RemoteData` via `buildRemoteData`
  (`e6bda71:internal/platform/beads/beads.go:383`) and never receives GitHub passthrough tasks. Not on
  any path from this literal.

---

## 6. Exhaustiveness

**This enumeration is exhaustive for the stated question, and I did not run out of budget.**

Basis for the claim, each verified by tree-wide grep at e6bda71 rather than by sampling:

1. `issueBuildRemoteData` has exactly one non-test caller (`passthrough.go:147`), and
   `internal/platform/` contains exactly one `ent.Task{` literal (`passthrough.go:135`). The
   construction site is unique.
2. `issueToTask` has exactly 9 call sites, all in `passthrough.go`; all 9 are accounted for
   above (8 outbound routes + the discarded internal use at `:534`).
3. `taskToProto` has exactly 12 non-test call sites, all in `server.go`; all 12 are accounted
   for (Paths 1–10 cover 10 of them; `:286` and `:289` are Path 11, unreachable).
4. Every `store.Store` task method that can return a passthrough-built task was read in its
   entirety, as was every `MultiStore` counterpart.

One residual uncertainty, stated rather than papered over: the reachability *conditions* I
give for Paths 8, 9 and 12 depend on runtime configuration (whether `collection_id` is
supplied, and whether an ephemeral pool is wired). I determined those from source and from
the three wirings present at this commit; I did not and could not execute anything to confirm
them. The DIRECT/RECONSTRUCTED classifications themselves do not depend on that analysis.
