# ImportCollectionParams — store-side walk (194-r11)

## 1. Commit measured at

**`633f8f269bcf9225b62d3c7c119f8166eda9ae64`** (branch `task-state-web-ui-v2`, `/workspace/farmtable`).

Every citation below is `path:line` at that SHA. The working tree was read directly rather
than via `git show`, which is sound here because `git diff HEAD --stat` over the complete
set of cited files is **empty** — `internal/store/store.go`, `internal/store/entstore.go`,
`internal/store/multistore.go`, `internal/server/export_import.go`,
`internal/platform/github/passthrough.go`, `internal/store/schema/collection.go`,
`internal/cli/collection.go` are byte-identical to `633f8f2`. `git status --porcelain`
reports only untracked (`??`) entries; no tracked file is modified.

Two scoping notes a reader checking my citations will need:

- The prior report used as a format model measured at **`e6bda71`**, which is **not an
  ancestor of `633f8f2`** (the two are divergent). Its line numbers do not transfer. I did
  not read it for conclusions.
- `/workspace/farmtable/.claude/worktrees/` contains **four stale checkouts**
  (`agent-a2c3f443e6e14aef4`, `agent-a9a8ff1994a656cac`, `anthropic-vertex`,
  `prompt-variants`) that each contain their own copy of all five relevant files at
  *different line numbers* (e.g. `store.go:184` and `entstore.go:1602`/`1619` rather than
  `store.go:215` / `entstore.go:2091`). Every grep in this report excludes them. If a
  citation of mine does not resolve, check you are not in a worktree copy.

Nothing was modified. **No build, no test, no `go` invocation of any kind was run.**

---

## 2. Q1 — direct answer

**CREATE-ONLY.**

No field of `ImportCollectionParams` can name or select a pre-existing collection, and no
store implementation looks one up. The one-line answer is not backend-qualified: of the
three implementations, two are create-only-or-delegating and the third refuses to import at
all. None can target an existing collection.

### 2a. Every field of `ImportCollectionParams`

`internal/store/store.go:215-222`:

```go
type ImportCollectionParams struct {
	Users         []ImportUser
	Collection    ImportCollection
	Tasks         []ImportTask
	Comments      []ImportComment
	Relationships []ImportRelationship
	Changes       []ImportChange
}
```

Six fields. The only one that describes the collection itself is `Collection`, of type
`ImportCollection` (`internal/store/store.go:224-231`):

```go
type ImportCollection struct {
	Name        string
	Description string
	Platform    collection.Platform
	RemoteData  map[string]any
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
```

| Field | Type | Can it select a pre-existing collection? |
|---|---|---|
| `Collection.Name` | `string` | **No.** Never used in a query — see 2b. Written straight into a `Create()`. |
| `Collection.Description` | `string` | No |
| `Collection.Platform` | `collection.Platform` | No |
| `Collection.RemoteData` | `map[string]any` | No |
| `Collection.CreatedAt` / `UpdatedAt` | `time.Time` | No |
| `Users` | `[]ImportUser` | No (collection-wise). See the caveat below. |
| `Tasks`/`Comments`/`Relationships`/`Changes` | slices | No |

**There is no `ID` field, no `CollectionID`, no `Upsert`/`Overwrite`/`Merge` flag, and no
`MergeMode` enum on `ImportCollectionParams` or on `ImportCollection`.** This is an absence
of the *greppable* kind — the struct definition is eight and six lines respectively and is
quoted above in full, so the absence is a property of the declared type, not an inference
about behaviour. A caller physically cannot express "import into collection X" through this
type.

Caveat worth stating precisely because it is the one place existing rows *are* reused:
`ImportUser.ID` (`internal/store/store.go:234`) is a caller-supplied `uuid.UUID`, and the
server resolves it against **existing users** by email before the store is called
(`internal/server/export_import.go:558-566` — `GetUserByEmail`, and on a unique match
`mapping[exported.ID] = matches[0].ID`, `matched++`). So an import can *reference*
pre-existing **users**. It cannot reference a pre-existing **collection**. Anyone reading a
"import can attach to existing data" claim should check which entity is meant.

### 2b. What each store implementation does with those fields

Three implementations satisfy `Store.ImportCollection`
(`internal/store/store.go:318`). Answering per-implementation, as required:

#### (i) `EntStore` — `internal/store/entstore.go:2091-2246` — **INSERT-ONLY**

The collection is created unconditionally (`internal/store/entstore.go:2112-2128`):

```go
collCreate := tx.Collection.Create().
	SetName(p.Collection.Name).
	SetDescription(p.Collection.Description).
	SetPlatform(p.Collection.Platform)
...
coll, err := collCreate.Save(ctx)
```

Two decisive details:

1. **`SetID` is never called on the collection.** Contrast the child entities, which *do*
   pin caller-supplied IDs: `SetID(imported.ID)` at `:2100` (user), `:2132` (task), `:2199`
   (comment), `:2216` (relationship), `:2228` (change). The collection alone has no
   `SetID`, so it takes the schema default `field.UUID("id", uuid.UUID{}).Default(uuid.New)`
   (`internal/store/schema/collection.go:17`) — **a freshly generated UUID on every call**.
2. **`p.Collection.Name` is never read back.** There is no `Query()`, no `Where`, no
   `OnConflict`, no `Upsert`, no `.Update(`, and no `.Delete(` anywhere in the function
   body (lines 2091-2246, verified by grep over exactly that range). The only Ent builders
   invoked are, one occurrence each:
   `tx.User.Create()`, `tx.Collection.Create()`, `tx.Task.Create()`, `tx.Comment.Create()`,
   `tx.Relationship.Create()`, `tx.Change.Create()`. All six are `Create`. (`SetUpdatedAt`
   at `:2123`/`:2169`/`:2207` matches a naive `\.Update` grep and is a field setter, not a
   mutation builder — noted so the negative result is checkable rather than asserted.)

Every task is bound to the just-created collection: `SetCollectionID(coll.ID)`
(`internal/store/entstore.go:2135`) — `coll.ID`, not any caller-supplied value. The whole
body runs in one transaction (`:2092-2096`, `defer tx.Rollback()`) committed at `:2242`,
and returns `s.GetCollection(ctx, coll.ID)` (`:2245`).

Because `Create()` is used with an explicit `SetID` on tasks/comments/relationships/changes,
a *second* import carrying the same child IDs would fail on primary-key conflict rather than
merge. It does not in practice, for the reason in Q2.

#### (ii) `MultiStore` — `internal/store/multistore.go:374-378` — **DELEGATES, create-only**

```go
func (m *MultiStore) ImportCollection(ctx context.Context, p ImportCollectionParams) (*ent.Collection, error) {
	// Import always goes to primary; the resulting collection can be
	// registered with RegisterPlatform afterward.
	return m.primary.ImportCollection(ctx, p)
}
```

No routing decision, no collection-ID lookup — unlike its siblings in the same file, which
*do* route on `p.CollectionID` (e.g. `GetReadyTasks` at `:359-362`, `GetBlockedTasks` at
`:366-369`). `ImportCollection` has no collection ID to route on, which is itself
corroboration of 2a. `primary` is typed as the `Store` interface
(`internal/store/multistore.go:36-40`), so this is create-only *conditional on what primary
is*; in production it is an `EntStore` — `cmd/farmtable-server/main.go:60`,
`s := store.NewMultiStore(entStore)`. The remaining `NewMultiStore` call sites are all
tests (`cmd/farmtable-server/main_test.go:42`, `internal/server/passthrough_e2e_test.go:135,324,381`,
`internal/store/multistore_test.go:53,841,902,1015,1065,1115,1168,1222`).

#### (iii) `GitHubPassThroughStore` — `internal/platform/github/passthrough.go:766-768` — **NOT IMPLEMENTED**

```go
func (s *GitHubPassThroughStore) ImportCollection(ctx context.Context, p store.ImportCollectionParams) (*ent.Collection, error) {
	return nil, fmt.Errorf("import collection: %w", store.ErrNotImplemented)
}
```

It ignores `p` entirely and always errors. This is the divergence the brief told me to
expect — but it diverges toward *refusing to import*, not toward targeting an existing
collection. It satisfies `store.Store` (`internal/platform/github/passthrough.go:32`,
`var _ store.Store = (*GitHubPassThroughStore)(nil)`), so it is reachable as a `Store`, but
`MultiStore` never routes import to a platform store (see (ii)), so on the production path
this branch is not taken.

#### (iv) A fourth type inherits the method — test-only

`pagedTaskStore` (`internal/platform/github/github_test.go:286-290`) embeds `store.Store`
as a nil interface and overrides only `ListTasks` (`:292`). It therefore *satisfies*
`Store.ImportCollection` by promotion, and a call would nil-panic. It is in a `_test.go`
file and never receives an import call. I checked for this class of implementation
explicitly because embedding is the one way to satisfy the interface without the identifier
appearing anywhere — see the completeness argument in §5.

---

## 3. Q2 — what happens to tasks already in a targeted collection

**Not reachable as posed: no existing collection can be targeted**, so no pre-existing task
is ever in scope. Stating what the code does instead of answering a counterfactual:

- Every imported task is attached to the collection created microseconds earlier in the same
  transaction — `SetCollectionID(coll.ID)` (`internal/store/entstore.go:2135`), where
  `coll` comes from `collCreate.Save(ctx)` at `:2125`. There is no code path by which a task
  row belonging to another collection is read, updated, re-parented, or deleted; the
  function issues no `Query()`, `.Update(` or `.Delete(` at all (§2b(i)).
- Tasks in *other* collections are therefore **preserved, untouched, and not duplicated** —
  they are never referenced.
- The decision is made by two lines together: `collCreate.Save(ctx)`
  (`internal/store/entstore.go:2125`) producing a new `coll.ID`, and
  `SetCollectionID(coll.ID)` (`:2135`) consuming it.

The nearest thing to "duplication" that the path does produce: importing the same export
document twice yields **two distinct collections with identical names and disjoint task
sets**. Nothing prevents the duplicate name — `field.String("name").NotEmpty()`
(`internal/store/schema/collection.go:18`) carries **no `.Unique()`**, and `Collection`
declares no unique index. So a same-name import does not error and does not merge; it makes
a second collection. Child-ID collision does not occur either, because the server assigns
fresh task UUIDs before the store is reached — `taskMapping[exportedTask.ID] = uuid.New()`
(`internal/server/export_import.go:318`), threaded into every `store.ImportTask` via
`importedTask(exportedTask, taskMapping, ...)` (`:365`). The store *accepts* caller-chosen
IDs; the only production caller *never reuses* one.

That last distinction is the "does not say X" vs "does not depend on X" split the brief
asked for: the **store** does not depend on IDs being fresh (it would happily attempt a
conflicting insert and fail the transaction); the **server** does not send stale ones. A new
caller of the store API could reintroduce collision. Nothing in the store type or the store
implementation enforces freshness.

---

## 4. Q3 — reachability from caller-supplied input

**REACHABLE from the wire, with live production wiring. Not test-only.**

The chain, each hop cited:

1. RPC declared: `rpc ImportCollection(ImportCollectionRequest) returns (ImportCollectionResponse);`
   — `proto/farmtable.proto:1091`; registered in the gRPC service table as
   `MethodName: "ImportCollection"` / `_FarmTableService_ImportCollection_Handler`
   (`api/farmtable/v1/farmtable_grpc.pb.go:1307-1308`, handler at `:936-950`).
2. Handler: `func (s *FarmTableService) ImportCollection(ctx context.Context, req *pb.ImportCollectionRequest)`
   — `internal/server/export_import.go:264`. Gated by `RequireIdentity` (`:265`) and
   `RequireScope(ctx, ScopeCollectionAdmin)` (`:268`) — i.e. authenticated, and requires the
   `collection:admin` scope. Not open to anonymous callers.
3. Wire bytes drive it: `req.GetData()` is parsed at `:271`/`:278`/`:295-299`, and
   `req.GetName()` overrides the document's collection name at `:337-339`
   (`if req.Name != nil { importParams.Collection.Name = req.GetName() }`).
4. Params built from that input: `store.ImportCollectionParams{...}` at
   `internal/server/export_import.go:327-336`.
5. Store invoked: `coll, err := s.store.ImportCollection(ctx, importParams)` —
   `internal/server/export_import.go:412`, where `s.store` is field
   `store store.Store` (`internal/server/server.go:30`).
6. Response returns the **newly created** ID: `CollectionId: coll.ID.String()` (`:416`).

A real client exists and is shipped: `ft collection import <file|-|@path>`
(`internal/cli/collection.go:225`) reads user-supplied bytes (`:231`) and calls
`client.ImportCollection(ctx, req)` (`internal/cli/collection.go:250`), setting
`req.Name` from the `--name` flag at `:247-249`. The web UI also exposes it
(`web/src/components/ft-import-collection-dialog.ts:40`,
`web/src/gen/grpc-client.ts:125`).

One live short-circuit: on `req.GetDryRun()` the handler returns at
`internal/server/export_import.go:408-410` **before** reaching the store, so the dry-run
flag never touches `EntStore.ImportCollection`.

### Direction check (import vs export are different answers)

`internal/server/export_import.go` serves **both** routes; they are not the same answer and
are reported separately here as the brief requires.

- **Import** (`:264`) — takes no collection ID; **creates** one. Scope `collection:admin`.
- **Export** (`ExportCollection`, `internal/server/export_import.go:105`) — takes
  `req.GetId()`, parses it to a UUID (`:109`), enforces `RequireCollectionAccess(ctx, collectionID)`
  (`:113`) and calls `s.store.GetCollection(ctx, collectionID)` (`:116`). Export **does**
  target an existing collection.

So `ImportCollectionParams` has no ID because the import direction has no ID; the ID lives
on the export side. A finding that cites "this file takes a collection ID" is citing the
export route.

---

## 5. Complete caller enumeration, with the greps that establish completeness

### Step 1 — is `git grep` at this SHA sufficient?

Yes for Go, and this is checkable rather than assumed:

```
git status --porcelain --untracked-files=all | grep '^??' | grep '\.go$'
→ (no output)
```

There are **zero untracked `.go` files**, and zero modified tracked files, so the indexed
tree at `633f8f2` is the whole Go source. A filesystem `grep -r` would add nothing but the
stale worktree copies.

### Step 2 — tree-wide grep for the bare identifier

Bare identifier, not a call pattern, across **all file types** (Go, proto, TS, JSON, docs),
so that method values, reflection by name, and codegen descriptors are all caught:

```
git grep -n "ImportCollection" -- . | grep -v "^\.claude/worktrees/"
```

That returns 133 hits across 24 files. Partitioning them by kind:

| Kind | Files | Relevant? |
|---|---|---|
| Store **definitions** | `internal/store/store.go:215,217,224,318`; `internal/store/entstore.go:2091`; `internal/store/multistore.go:374`; `internal/platform/github/passthrough.go:766` | definitions, analysed in §2b |
| Store **call sites** | `internal/server/export_import.go:412`; `internal/store/multistore.go:377` | **the complete caller set — see below** |
| gRPC **client** calls (`pb.ImportCollectionRequest`) | `internal/cli/collection.go:250`; `internal/server/export_import_test.go` (×19: 135,254,283,345,454,495,524,552,591,625,634,638,651,657,718,819,840); `internal/server/rbac_test.go:443`; `internal/server/identity_enforcement_test.go:159` | RPC-side, not store-side |
| Generated protobuf/gRPC scaffolding | `api/farmtable/v1/farmtable.pb.go` (30), `api/farmtable/v1/farmtable_grpc.pb.go` (15), `proto/farmtable.proto` (3), `web/src/gen/*` (6) | transport only |
| Web UI | `web/src/components/ft-import-collection-dialog.ts` (2), `ft-toolbar.ts` (2) | client only |
| Design docs | `.design/project-log/*.md` (12) | prose |

### Step 3 — the store-side caller set

Narrowing to invocations on a receiver:

```
git grep -n "\.ImportCollection(ctx" -- "*.go" | grep -v "^\.claude/worktrees/"
```

23 hits, of which exactly **two** are calls on a `Store`; the other 21 are on the generated
gRPC client (`client.ImportCollection`, all in `_test.go` plus `internal/cli/collection.go:250`)
or on the server interface inside generated dispatch (`api/farmtable/v1/farmtable_grpc.pb.go:942,949`).

**The complete set of callers of `Store.ImportCollection`:**

| # | Call site | Caller | Value passed for "existing collection" |
|---|---|---|---|
| 1 | `internal/server/export_import.go:412` | `FarmTableService.ImportCollection` (RPC handler) | **none — the struct has no such field**; builds `ImportCollectionParams` at `:327-336` with `Collection{Name, Description, Platform, RemoteData, CreatedAt, UpdatedAt}` only |
| 2 | `internal/store/multistore.go:377` | `MultiStore.ImportCollection` — pure pass-through to `m.primary` | forwards `p` unchanged |

That is the whole list. **No caller anywhere passes a value that selects an existing
collection, and no caller could: the parameter type provides no field capable of expressing
it.** There is exactly one non-delegating caller in the repository, and it is the RPC
handler. No test calls the store method directly — every test goes in through the gRPC
client.

### Step 4 — closing the embedding hole

An identifier grep misses a type that satisfies `Store` by **embedding** it, inheriting
`ImportCollection` without the name ever appearing. Checked explicitly:

```
git grep -nE "^\s+(store\.)?Store$" -- "*.go" | grep -v "^\.claude/worktrees/"
→ internal/platform/github/github_test.go:287

git grep -nE "_ (store\.)?Store = " -- "*.go" | grep -v "^\.claude/worktrees/"
→ cmd/farmtable-server/main_test.go:46, internal/platform/github/passthrough.go:32,
  internal/store/multistore_test.go:66
```

The single embedder is the test-only `pagedTaskStore` (§2b(iv)). The three compile-time
assertions name only `MultiStore` and `GitHubPassThroughStore`, both already covered.
`EntStore` carries no such assertion but is the concrete primary at
`cmd/farmtable-server/main.go:60`. So the implementation set is
{`EntStore`, `MultiStore`, `GitHubPassThroughStore`} plus one inert test embedder — closed.

---

## 6. NOT REACHED

Bounds I did not personally measure, and what would falsify each.

1. **No execution of any kind.** Per the brief's hard constraint, I ran no build, test, vet,
   or binary. Everything above is static reading.
   *What a build/test would have told me:* whether `EntStore.ImportCollection` actually
   inserts a second same-named collection at runtime rather than tripping a constraint the
   source does not show. The nearest existing evidence is
   `TestRPC_ExportImportCollection_RoundTrip` (`internal/server/export_import_test.go:78`),
   which imports an export of a live collection under a new name `"restored"` (`:135`) —
   its passing would corroborate create-only, but **I did not run it and do not claim its
   result**.
   *Falsifier:* that test, or any import test, failing with a uniqueness or conflict error.

2. **Generated Ent builder internals.** I did not read the generated
   `CollectionCreate`/`TaskCreate` code under `internal/store/ent/`. I am relying on the
   standard Ent contract that `Create().Save()` is a plain `INSERT` and that upsert requires
   an explicit `OnConflict`, which does not appear in the function.
   *Falsifier:* a generated or hand-edited `CollectionCreate.Save` that performs an upsert,
   or a repo-local Ent template injecting `OnConflict`.

3. **Database schema outside the Ent schema definition.** I read
   `internal/store/schema/collection.go` and found no `.Unique()` on `name` and no unique
   index. I did not audit migration files or any hand-applied DDL.
   *Falsifier:* a migration adding `UNIQUE(collections.name)` — which would turn the
   duplicate-name import in §3 from "creates a second collection" into "returns an error".
   Note it would *still* not make the import target an existing collection.

4. **Runtime identity of `MultiStore.primary`.** `primary` is the `Store` interface
   (`internal/store/multistore.go:36`); I established it is an `EntStore` on the production
   path by reading `cmd/farmtable-server/main.go:60` only.
   *Falsifier:* another production entrypoint constructing `NewMultiStore` with a non-Ent
   primary. I enumerated all 13 `NewMultiStore(` call sites and all but `main.go:60` are
   `_test.go`, so this is tightly bounded but rests on that one line.

5. **Embedded/CLI server mode.** I traced the gRPC server entrypoint. I did not verify
   whether `ft` in embedded mode constructs a `FarmTableService` over a bare `EntStore`
   rather than a `MultiStore`.
   *Falsifier:* an embedded wiring passing a different `Store`. Impact is bounded: both
   candidate implementations are create-only, so this cannot change the Q1 answer, only the
   §2b(ii)-vs-(i) attribution.

6. **Beads conversion path internals.** I read the handler's Beads branch
   (`internal/server/export_import.go:277-293`) but not the body of
   `convertBeadsToExportDocument`.
   *Falsifier:* nothing could change the answer here — the function returns an
   `exportDocument`, and the collection-identifying fields of `ImportCollectionParams` have
   no ID slot to populate. Recording it as unread rather than as verified.

7. **Non-Go callers reaching the store directly.** I bounded the caller set to Go. A cgo,
   plugin, or reflection-by-string caller would evade it; I grepped all file types for the
   identifier and found only transport/UI/doc hits.
   *Falsifier:* a `reflect.Method`/`MethodByName` dispatch built from a runtime string,
   which no grep can enumerate.

---

## 7. Bias declaration

The brief withheld the finding and the grade deliberately and asked me to report if I could
infer which answer was wanted. **I could not**, and I want to be concrete about that rather
than merely reassuring: CREATE-ONLY cuts both ways depending on the unseen finding. It
*eliminates* a whole class of severity (no clobbering or merging of an existing
collection's tasks; no cross-collection write via import), and it simultaneously *supports*
a different class (unauthenticated-by-name duplicate-collection proliferation; the
`collection:admin` scope being the only thing between a wire caller and unbounded collection
creation). I did not know which of those the finding rests on while measuring, and I still
do not.

One observation surfaced in passing, flagged here rather than escalated, per my
instructions not to invoke other specialists: `EntStore.ImportCollection` accepts
caller-supplied primary keys via `SetID` on tasks, comments, relationships and changes
(`internal/store/entstore.go:2132,2199,2216,2228`), and the safety of that rests entirely on
the *server* remapping to fresh UUIDs at `internal/server/export_import.go:318`. That is a
server-side invariant protecting a store-side API, not a store-side guarantee — a second
caller of the store API would not inherit it. Whether that is in scope for the current
finding is the manager's call.
