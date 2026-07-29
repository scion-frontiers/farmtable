# writable-key-path — audit of what can cause `writable: true` to be present in a stored collection's `remote_data`

- **ROOT (primary):** `/workspace/farmtable-writable-path`
- **REVISION:** `7a0f220dbd9332cb8db62138c841777432b4eda4` (detached HEAD, verified by `git rev-parse HEAD`)
- **Working tree state:** clean and with **no untracked files** — verified by
  `git status --porcelain --untracked-files=all` at ROOT, which produced **empty output**.
  Every filesystem search below therefore covers exactly the committed tree at that SHA.
- **Secondary tree read:** none. I did **not** read `/workspace/farmtable` (`633f8f2`).
  Every measurement in this document came from `7a0f220d` and from nowhere else.
- **Nothing was executed.** No build, no test, no `go run`, no binary, no database. This
  audit is **static reading only**. `_run-queue-log.md` was not appended to because no run
  was performed. The consequences of that bound are stated in §4.
- **Read-only:** no file in either tree was modified.

---

## 1. POPULATION AND COMMANDS

Reported before the verdict, as required. Every command below was actually executed at
ROOT `/workspace/farmtable-writable-path` on revision `7a0f220d`. Shell is zsh 5.9; `grep`
is ugrep 7.5.0 invoked as `grep`.

### 1.1 Tree bound established first

```
git rev-parse HEAD
git status --porcelain --untracked-files=all
git ls-files | wc -l
ls -la
```

- `git rev-parse HEAD` → `7a0f220dbd9332cb8db62138c841777432b4eda4`.
- `git status --porcelain --untracked-files=all` → **empty**. No untracked and no modified
  files. This is the fact that lets me use `git grep` and filesystem `grep`
  interchangeably below.
- `git ls-files | wc -l` → **431** tracked files.
- `ls -la` was used **with `-a`**, per the brief's dotfile trap. It surfaced
  `.agents/`, `.claude/`, `.design/`, `.github/`, `.gitignore`, `.tasks/` — all of which
  are inside the `git ls-files` population anyway.

### 1.2 The whole-word population for the key

```
git grep -rni 'writable' -- .
```

ROOT `/workspace/farmtable-writable-path`, revision `7a0f220d`, **no path filter, no
`--include`, case-insensitive, all 431 tracked files**. Exit 0.

Then, to catch anything the git index could not see (there was nothing, but the check was
run rather than assumed):

```
grep -rni --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist 'writable' .
```

ROOT as above. Filesystem walk, case-insensitive, dotfiles **included** (GNU/ugrep `-r`
descends into dotted directories; `.design/` matches confirm this empirically — the
`.design/project-log/passthrough-write-p*.md` hits are inside a dotted directory).

**Combined result — the complete set of files in the tree containing the string
`writable`, in any case:**

| File | Nature |
|---|---|
| `web/src/capabilities.ts` (lines 91, 99, 103) | **read site** |
| `web/src/components/ft-app.ts` (lines 229–258, 371, 928–999) | **read site** |
| `web/src/components/ft-toolbar.ts` (lines 177, 284) | downstream display of a read site |
| `.design/project-log/passthrough-write-p1.md` | design prose |
| `.design/project-log/passthrough-write-p2.md` | design prose |

**Bounded negative, stated at the scope of the instrument:** the two commands above
returned **zero matches** for `writable` in any `.go`, `.json`, `.yaml`, `.yml`, `.sql`,
`.jsonl` or testdata file in the tree at `7a0f220d`. That is a statement about *this tree
at this SHA*, not about any database, any deployed instance, any customer's export file,
or any tree other than this one. See §4.

### 1.3 The whole-map population

```
git grep -rni 'remote_data' -- .
git grep -rn  'RemoteData'  -- .
git grep -ln  'RemoteData'  -- ':!internal/store/ent' ':!api'
```

Same ROOT and revision, no include filter. The third command excludes Ent-generated code
and generated protobuf to isolate hand-written code; its output was the working set:

`internal/platform/beads/beads.go`, `internal/platform/github/github.go`,
`internal/platform/github/graphql_queries.go`, `internal/platform/github/passthrough.go`,
`internal/server/convert.go`, `internal/server/export_import.go`,
`internal/server/graph_support.go`, `internal/server/server.go`,
`internal/store/entstore.go`, `internal/store/store.go` (plus tests and `.design` prose).

### 1.4 Write sites of the *collection* map, enumerated at the persistence layer

```
grep -n 'RemoteData' internal/store/entstore.go internal/store/store.go internal/server/server.go
grep -rn 'SetPlatform' --include='*.go' . | grep -v '/ent/'
```

There are exactly **three** places in the tree that can cause a row in the `collections`
table to have a non-null `remote_data`:

| # | Site | Value written | Reachable caller |
|---|---|---|---|
| W1 | `internal/store/entstore.go:1365-1367` `EntStore.CreateCollection` → `create.SetRemoteData(p.RemoteData)` | `CreateCollectionParams.RemoteData` | see below |
| W2 | `internal/store/entstore.go:1384-1399` `EntStore.UpdateCollection` → merge of `old.RemoteData` and `p.RemoteData`, then `update.SetRemoteData(...)` | `UpdateCollectionParams.RemoteData` | see below |
| W3 | `internal/store/entstore.go:2116-2117` `EntStore.ImportCollection` → `collCreate.SetRemoteData(p.Collection.RemoteData)` | `ImportCollection.RemoteData` | see below |

Callers enumerated with:

```
grep -rn 'CreateCollection(\|UpdateCollection(\|CreateCollectionParams{\|UpdateCollectionParams{' --include='*.go' internal/ cmd/ | grep -v '/ent/' | grep -v '_test.go'
```

- **W1 callers.** `internal/server/server.go:1048-1053` (`CreateCollection` RPC) builds
  `store.CreateCollectionParams{Name, Description, Platform, RemoteID}` — **`RemoteData`
  is not in the composite literal and is never assigned afterwards**; it stays `nil` and
  the `if p.RemoteData != nil` guard at `entstore.go:1365` is not taken.
  `internal/server/graph_routing.go:83-86` passes only `Name` and `Platform`.
  `internal/server/beads_import.go:393` sets only `Platform`.
  `internal/cli/collection.go:148` and `internal/decomposer/writer.go:167` go through the
  RPC. `internal/platform/github/passthrough.go:629` returns a synthetic in-memory object
  and persists nothing.
- **W2 callers.** `internal/server/server.go:1076-1094` (`UpdateCollection` RPC) builds
  `store.UpdateCollectionParams{}` and assigns **only** `p.Name` and `p.Description`.
  `p.RemoteData` is never assigned. `internal/platform/github/passthrough.go:633` returns
  `store.ErrNotImplemented`. There is no other caller.
- **W3 caller.** `internal/server/export_import.go:327-336`:
  ```go
  importParams := store.ImportCollectionParams{
      Collection: store.ImportCollection{
          Name:        doc.Collection.Name,
          Description: doc.Collection.Description,
          Platform:    collection.PlatformFarmtable,
          RemoteData:  doc.Collection.RemoteData,   // ← line 332
          ...
  ```
  `doc` is decoded from `req.GetData()` — the raw uploaded bytes.

### 1.5 The wire surface, checked against the proto rather than against Go alone

```
grep -n -A 25 'message CreateCollectionRequest\|message UpdateCollectionRequest\|message ImportCollectionRequest' proto/farmtable.proto
```

- `CreateCollectionRequest` (line 727): `name`, `description`, `platform`, `remote_id`.
  **No `remote_data` field exists.**
- `UpdateCollectionRequest` (line 734): `id`, `name`, `description`.
  **No `remote_data` field exists.**
- `ImportCollectionRequest` (line 750): `data` (bytes), `name`, `dry_run`.

### 1.6 Other surfaces swept for a remote_data write

```
grep -rn 'RemoteData\|remote_data\|remote-data' --include='*.go' internal/mcp internal/serverapp internal/cli
```

Exactly **one** match in that population: `internal/cli/output.go:62`, which sets
`m["remote_data"] = nil` for display. The MCP server, the HTTP/OAuth link-flow surface
(`internal/serverapp/linkflows.go`) and the CLI expose **no** collection `remote_data`
write. Bound: this command covered only those three directories; the rest of `internal/`
was covered by §1.3.

### 1.7 Schema defaults, migrations, backfills

```
grep -rn 'remote_data' --include='*.sql' --include='*.go' internal/ scripts/ cmd/ | grep -iv '_test.go' | grep -i 'alter\|update \|insert\|migrat'
grep -n -B3 -A6 'remote_data' internal/store/schema/*.go
```

- `internal/store/schema/collection.go:23` — `field.JSON("remote_data", map[string]any{}).Optional()`.
  **No `.Default(...)`, no `.StructTag` validation, no allowlist, no key-level typing.**
- `internal/store/ent/migrate/schema.go:87` and `:222` — `{Name: "remote_data", Type: field.TypeJSON, Nullable: true}`.
  Column definitions only.
- Bounded negative: those two commands, at that ROOT and revision, produced **no** data
  migration, backfill, `UPDATE`, `INSERT` or seed statement touching `remote_data`. There
  are no `.sql` files in the searched directories at all.

### 1.8 The read sites, read against the object they actually receive

```
cat -n web/src/capabilities.ts
sed -n '215,270p' web/src/components/ft-app.ts
sed -n '236,276p' web/src/gen/types.ts
```

- `capabilities.ts:93-104` `getCapabilities(collection: Collection)`:
  `FARMTABLE` → `ALL_ENABLED`; `GITHUB` **and** `rd.writable === true` →
  `GITHUB_CAPABILITIES`; everything else → `ALL_DISABLED`.
- `ft-app.ts:254-261` `isCollectionWritable(coll: Collection)`: reads
  `coll.remoteData.writable`, **with no platform test of its own**.
- `ft-app.ts:227-241` `isReadOnly` / `isExternalWritable`: `FARMTABLE` short-circuits;
  **every other platform** delegates to `isCollectionWritable`.
- `web/src/gen/types.ts:261-274` — `interface Collection` has
  `remoteData?: Record<string, unknown>` and `platform: Platform`. `interface Task`
  (lines ~236-259, distinguished by `codeContext`/`collectionId`) also has a `remoteData`.
  Both read sites are typed `Collection` and are called with `this.currentCollection`.
- `GITHUB_CAPABILITIES` (`capabilities.ts:42-58`) has exactly **nine** `true` members:
  `canEditTitle`, `canEditDescription`, `canChangeStage`, `canChangePriority`,
  `canChangeAssignee`, `canChangeParent`, `canAddComment`, `canCloseTask`,
  `canCreateTask`. The brief's "nine write operations" is arithmetically correct.

### 1.9 Server-side enforcement, searched for and not found

```
grep -rni 'read_only\|readonly\|read-only' --include='*.go' internal/ cmd/ | grep -v '_test.go'
```

**Exit 1, zero matches.** Per the brief's convention this negative is clean, and it was
not wrapped in `|| true`.

```
grep -rn 'RemoteData\[' --include='*.go' internal/ | grep -v '_test.go'
```

Every server-side key read of any `remote_data` map in the tree, exhaustively:
`graph_support.go:27` reads `"graph_queries"` on a **collection**; `convert.go:259/318/321`
read `"platform"`, `"remote_id"`, `"remote_url"` on a **task**; `server.go:657/660` write
`"remote_id"`/`"remote_url"` on a **task**; `beads.go:499` and `github.go:360` read
`"remote_id"` on a **task**. **No Go code in this tree reads the key `writable`** — this
is the same negative as §1.2 restated at the level of map indexing.

### 1.10 Ownership of the closure

```
grep -rn 'import only supports farmtable platform' --include='*.go' .
grep -rln 'import only supports farmtable' --include='*_test.go' .
```

First command: two matches, both in `internal/server/export_import.go` (lines 121 and 307)
— the source strings themselves. Second command: **exit 1, no match**. No test file in the
tree references that guard.

---

## 2. CELL

### **CELL 7.**

Not because 1–6 were awkward, but because the honest answer is a *conjunction* that no
single pre-registered cell states, and because the seventh component reframes the question
itself. I name it rather than forcing a fit:

> **The key can be planted (cell 2 is satisfied), it cannot currently reach the platform
> branch that reads it (which looks like cell 3 but is not an allowlist), the thing
> stopping it is owned by nobody and tested by nothing, and — outranking all of that —
> the flag is not an authorization control in the first place, because it has no
> server-side effect whatsoever.**

Component by component, with the evidence that rules the other cells out.

**Cell 1 (PREMISE HOLDS) — RULED OUT.** The premise as written ("nothing anywhere in the
product ever sets that marker, so it is always no") is false at the *presence* layer.
`internal/server/export_import.go:332` copies `doc.Collection.RemoteData` — a
`map[string]any` decoded straight from uploaded bytes — into the value persisted at
`internal/store/entstore.go:2117`. No key filtering occurs anywhere between the two.
Critically, `decoder.DisallowUnknownFields()` at `export_import.go:296` is **not** a
defence here: `encoding/json`'s `DisallowUnknownFields` rejects unknown keys only when
decoding into a **struct**. `exportCollection.RemoteData` is declared
`map[string]any` (`export_import.go:39`), and a map accepts every key by construction.
The strictness the code appears to have stops exactly at the boundary of the map.

**Cell 2 (PREMISE FALSE) — HOLDS, for presence.** See §3.

**Cell 3 (FIXED FIELD ALLOWLIST) — RULED OUT as stated, but its *question* is the live
one.** There is no allowlist. What actually keeps `writable` off the RPC surface is
stronger and dumber: `remote_data` **is not a field on `CreateCollectionRequest` or
`UpdateCollectionRequest` in `proto/farmtable.proto` at all** (§1.5), and
`internal/server/server.go:1048` and `:1076` never populate `params.RemoteData` (§1.4).
Nothing is being filtered, because nothing is being offered.

The brief requires that if I land in cell 3 I must say **who owns the allowlist and what
goes red when someone adds a field to it.** I did not land in cell 3, but the question
transfers to the closure that *is* doing the work, and the answer is the finding:

> **Nobody owns it, and nothing goes red.** The reason a stored collection cannot today
> have both `platform = 'github'` and `remote_data.writable = true` is a **conjunction of
> two unrelated facts sitting in two different files, neither annotated as a security
> control**:
> 1. the only path that copies arbitrary keys into the map (`ImportCollection`)
>    **hard-codes** `Platform: collection.PlatformFarmtable` at `export_import.go:331`
>    and again at `entstore.go:2115`; and
> 2. the only path that can create a `github`-platform collection
>    (`CreateCollection` RPC) has **no remote_data input** at all.
>
> `git grep 'import only supports farmtable'` over `*_test.go` returns **no match**
> (§1.10). Adding an optional `remote_data` field to `CreateCollectionRequest` in
> `proto/farmtable.proto` — a change a reasonable engineer would make to support platform
> passthrough, and which touches nothing that mentions authorization — silently converts
> this from "cannot happen" to "any principal with `collection:write` sets it directly."
> Equally, changing `export_import.go:331` to honour `doc.Collection.Platform` — which
> looks like a fidelity improvement to a lossless-export feature — does the same. **The
> whole tree is green either way.** This is precisely the closed-but-unowned shape the
> brief says the project keeps finding, and it looks exactly like closure.

**Cell 4 (TWO OBJECTS, ONE NOUN) — RULED OUT with evidence, and I looked hard because the
brief said one had already been missed tonight.** `web/src/gen/types.ts` does declare
`remoteData` on **two** interfaces: `Task` (line 252) and `Collection` (line 271). But
both read sites are typed `Collection` (`getCapabilities(collection: Collection)` at
`capabilities.ts:93`; `isCollectionWritable(coll: Collection)` at `ft-app.ts:254`) and
both are invoked on `this.currentCollection`. The write site
`export_import.go:332` writes the **collection** map, and `entstore.go:2117` persists it
to the `collections` table, from which `collectionToProto` (`convert.go:495-497`) emits it
as the same field the dashboard reads. Write object and read object are the same object.
**Not cell 4.**

*However* — and this is the near-miss worth recording — the tree contains the *adjacent*
defect: **one object, one key, two disagreeing predicates.** `getCapabilities`
(`capabilities.ts:97-101`) consults `writable` **only** when
`platform === Platform.GITHUB`. `isReadOnly` and `isExternalWritable`
(`ft-app.ts:227-241`) consult it for **every** non-`FARMTABLE` platform, because
`isCollectionWritable` performs no platform test of its own. The Ent enum admits
`linear`, `jira`, `asana`, `beads` (`internal/store/schema/collection.go:20`). So for a
`linear`/`jira`/`asana`/`beads` collection carrying `writable: true`, the dashboard would
simultaneously report `isReadOnly === false` (board chrome unlocked, the `↔ GitHub` badge
rendered via `ft-toolbar.ts:177/284` — on a Linear board — and the poll interval dropped
to 15s at `ft-app.ts:928-931`) **and** `ALL_DISABLED` from `getCapabilities`. That is the
"read-only badge is inconsistent across boards" symptom from cell 5, arising from a cause
cell 5 does not describe. It is latent, not live, for the same conjunction reason as
above: import forces `farmtable`, and no non-github external collection can be given a
`remote_data` at all today.

**Cell 5 (THE CELL WE WOULD LEAST LIKE TO FIND) — RULED OUT for this tree, and the bound
on that statement matters more than the statement.** The two commands in §1.2 — a
case-insensitive `git grep` across all 431 tracked files with no include filter, and a
case-insensitive filesystem `grep -rn` including dotted directories — returned **zero**
occurrences of `writable` in any fixture, seed, testdata, JSON, YAML, JSONL or SQL file at
`7a0f220d`.

**I am bounding that negative to the event I caused and not generalising it to the
question.** What I established is: *those two commands, at that ROOT, at that SHA, matched
nothing outside five files, three of which are TypeScript source and two of which are
design prose.* What I did **not** establish, and what cell 5 actually asks, is whether the
key is present in **stored data** — a live SQLite or Postgres database, a customer's
`farmtable.db`, a support-supplied export file, a backup. **No database was opened. No
row was read.** Cell 5's "already present in stored data" limb is, on my evidence,
**cell 6**: undeterminable without data access. §3 says what would settle it.

**Cell 6 (UNDETERMINABLE) — partially true, and confined to the stored-data limb only.**
See immediately above and §3.

---

## 3. THE ANSWER TO THE ACTUAL QUESTION

**What path can cause the key `writable` to be present and set to true in the
`remote_data` map on a stored collection?**

### The path

**`ImportCollection`.** One path, fully specified:

1. A caller invokes the `ImportCollection` RPC
   (`internal/server/export_import.go:264`). Authorization required:
   `RequireIdentity` **and** `ScopeCollectionAdmin` (lines 265-269).
2. The uploaded bytes are detected as the `farmtable` format and decoded into
   `exportDocument` (line 295-299). `DisallowUnknownFields()` is in force but does not
   reach inside `map[string]any` — see §2, cell 1.
3. Validation applied to the collection object is exactly three checks:
   `format_version ∈ {1,2}` (line 300), `generator ∈ {"", "farmtable"}` (line 303),
   `platform == "farmtable"` (line 306). **`remote_data` is not validated, not filtered,
   not key-checked, and not schema-bounded at any point.**
4. Line 332 copies the map by reference into `store.ImportCollectionParams`.
5. `internal/store/entstore.go:2116-2117` persists it verbatim onto the new
   `collections` row inside the import transaction.
6. On every subsequent read, `collectionToProto`
   (`internal/server/convert.go:495-497`) re-emits the entire map to the dashboard as
   `Collection.remoteData`.

So a document containing:

```json
{
  "format_version": 2,
  "generator": "farmtable",
  "collection": {
    "id": "…", "name": "Q3 Board", "description": "",
    "platform": "farmtable",
    "remote_data": { "writable": true },
    "created_at": "…", "updated_at": "…"
  },
  "users": [], "tasks": [], "comments": [], "relationships": [], "changes": []
}
```

produces a stored collection whose `remote_data` contains `writable` set to `true`, and
whose bytes were authored by whoever wrote the file — not by the operator who imported it.
**The brief's assertion that "nothing anywhere in the product ever sets that marker, so it
is always no" is false. The key can be there. It is not a code constant, and the product
does not need to set it.**

I want to be exact about the strength of that claim: **this is a static reading of an
unambiguous straight-line assignment chain (line 332 → param field → `SetRemoteData`), not
an observed run.** I did not execute an import. See §4.

### What that path does **not** currently buy

Both read sites short-circuit before the key is consulted when
`platform === FARMTABLE` (`capabilities.ts:94`, `ft-app.ts:229` and `:239`), and
`ImportCollection` hard-codes the imported collection to `farmtable`
(`export_import.go:331`, `entstore.go:2115`). There is no path in this tree that mutates
an existing collection's `platform` — `grep -rn 'SetPlatform' --include='*.go' . | grep -v '/ent/'`
returns exactly three sites, all creates (`entstore.go:1359`, `:2115`, and `:2273` for
linked accounts), **none** an update. Linking a GitHub account to a collection
(`CreateLinkedAccount`, `server.go:1103`) attaches a `linked_accounts` row; it does not
touch `collections.platform`.

So today the sequence terminates as: **key present and true on a `farmtable` collection,
where it is inert.** It is a loaded round in a chamber that is not currently aligned with
the barrel, and §2/cell 3 documents that nothing at all is guarding the alignment.

### The finding that outranks the answer

The brief states that if such a path exists, *"a remote party decides whether nine write
operations are enabled in our dashboard, and this stops being a product question and
becomes an authorization finding."*

**The second half of that sentence is wrong, and it is wrong in a direction that makes
things worse rather than better.** It would become an authorization finding only if
`writable` were an authorization control. It is not one:

```
grep -rni 'read_only\|readonly\|read-only' --include='*.go' internal/ cmd/ | grep -v '_test.go'
→ exit 1, zero matches
```

There is **no server-side read of the key** (§1.9), and **no server-side notion of a
read-only collection at all**. `getCapabilities` and `isReadOnly` disable *buttons in a
browser*. The actual authorization boundary for all nine operations is the gRPC scope
check (`RequireScope(ctx, ScopeTaskWrite)` and friends) plus `RequireCollectionAccess`,
and those do not consult `platform` or `remote_data`. Any principal already holding the
relevant scope can call `UpdateTask`, `CreateTask`, `AddComment` etc. against a GitHub
collection **right now, with `writable` absent**, and `GitHubPassThroughStore` will happily
execute the mutation against the real GitHub API.

That reframes the whole question:

- **The `writable` flag is not a control being subverted; it is a label that was never
  load-bearing.** Planting it grants an attacker nothing they did not already have.
- **The real exposure is the inverse of the one the brief anticipated:** the read-only
  badge and the disabled buttons imply an enforcement that does not exist. Anyone reasoning
  about the product's security from the dashboard's behaviour — including the human
  decision-maker the original product question was written for — is being told that
  external collections are protected. They are not; they are merely un-clicked.
- Consequently the correct remediation is **not** "filter the `writable` key on import."
  Filtering the key would close the cosmetic path and leave the substantive gap untouched,
  while making the tree look audited. If the nine operations are meant to be gated, the
  gate belongs in `internal/server/server.go` next to the existing `RequireScope` calls,
  where it can be tested and where a client cannot decline to consult it.

### Severity, stated plainly

- **The literal question (`writable` can be present and true):** confirmed. **Low** as it
  stands — reachable only by an actor already holding `ScopeCollectionAdmin`, and inert on
  the `farmtable` platform it is forced onto. Realistic abuse shape is not privilege
  escalation but **social**: a "share your board" export handed to a victim who imports it
  with their own admin scope, so the bytes are attacker-authored and the scope is the
  victim's.
- **Unvalidated attacker-authored map persisted verbatim into a boundary object
  (`export_import.go:332`):** **Medium**. `writable` is the key we happened to ask about.
  The same line will carry `graph_queries` — which **is** read server-side at
  `graph_support.go:27` and changes query routing — and every key any future feature
  decides to read. The defect is the unbounded copy, not the key.
- **Closed-but-unowned conjunction, zero tests (§2, cell 3):** **Medium**. A one-line,
  security-innocent-looking change in either of two files opens it, and CI stays green.
- **No server-side enforcement behind a UI that advertises enforcement (§1.9):**
  **High**, and it is the finding I would put in front of the decision-maker first. It is
  independent of everything above and true today at `7a0f220d`.

---

## 4. WHAT I DID NOT CHECK

Read this section as load-bearing, because several of my negatives are only as good as it.

1. **No database, anywhere.** I did not open `/workspace/.farmtable/farmtable.db`, any
   Postgres instance, any backup, or any customer data. **The cell-5 limb — "the key is
   already present in stored data" — is therefore genuinely undetermined by me, and I have
   not claimed otherwise.** What would settle it, exactly:
   `SELECT id, name, platform, remote_data FROM collections WHERE remote_data IS NOT NULL AND json_extract(remote_data, '$.writable') IS NOT NULL;`
   (SQLite) or `... WHERE remote_data ? 'writable';` (Postgres), run against each
   environment that matters. Until someone runs that, "it is always no" remains unproven
   in the only place it counts.
2. **Nothing was executed.** No build, no vet, no test, not even the single targeted
   `go test -run` the brief conditionally permits — so `_run-queue-log.md` was correctly
   left untouched. Every behavioural claim in §3 is inferred from reading a straight-line
   assignment chain. It is a strong inference and I stand behind it, but it is an
   inference. An observed run of `ImportCollection` with the §3 payload followed by a
   `GetCollection` would convert it to a measurement, and that is what I would do next if
   given a token.
3. **The dashboard was not run.** The claim that a `linear` collection with
   `writable: true` would render the `↔ GitHub` badge (§2, cell 4) is read off
   `ft-app.ts:371` → `ft-toolbar.ts:177/284` statically. Not observed.
4. **`/workspace/farmtable` at `633f8f2` was not read at all.** My primary answer did not
   depend on it, so per the brief I stayed out. If Phase 2 adds a `remote_data` field to
   `CreateCollectionRequest`, or teaches import to honour `doc.Collection.Platform`, the
   conjunction in §2 breaks and the severity of the §3 path rises sharply. **Somebody
   should run §1.5 and §1.4 against `633f8f2`. I have not, and nothing in this report
   should be read as covering that SHA.**
5. **`go.sum` dependency CVE audit: not performed.** Out of scope for this brief and it
   needs tooling I was not to run.
6. **The Ent-generated layer was read but not audited.** I traced
   `CollectionCreate.SetRemoteData` / `CollectionUpdate.SetRemoteData` and confirmed no
   non-generated caller sets `platform` on update; I did not audit generated code for
   other mutation entry points.
7. **`structpb.NewStruct` error swallowing not chased.** `convert.go:496` is
   `pc.RemoteData, _ = structpb.NewStruct(c.RemoteData)` — the error is discarded, so a
   map containing an unrepresentable value yields a silently `nil` `remote_data` on the
   wire. Irrelevant to a JSON-sourced `bool`, noted as an adjacent robustness issue, not
   investigated.
8. **No git history search.** I did not run `git log -S writable` to see whether the key
   was ever written by code that has since been deleted, or whether fixtures containing it
   existed at an earlier SHA and were removed. That would sharpen the cell-5 question
   considerably and it is cheap. I did not do it.

---

## 5. WHERE MY BRIEF WAS WRONG

Offered in the spirit the brief asks for.

1. **The framing puts the finding in the wrong place, and this is the most useful thing I
   can tell you.** The brief's contingency is *"if such a path exists, then a remote party
   decides whether nine write operations are enabled … and this becomes an authorization
   finding."* The path exists, and it is **not** an authorization finding — because
   `writable` is not enforced anywhere but the browser (§1.9: zero matches for any
   read-only concept in Go). The brief's antecedent is true and its consequent is false.
   The genuine authorization finding is the one the brief did not ask about: **the nine
   operations have no server-side gate at all**, so the read-only badge is a claim the
   backend does not honour. Had I answered only the question as posed, I would have filed
   a Low and the High would still be sitting there.

2. **"`remote_data` is a security boundary because its bytes are attacker-authored" is
   the right instinct pointed one step short of the target.** The boundary is not the map;
   it is **`export_import.go:332`, the single unvalidated copy that admits arbitrary keys
   into a persisted object**. Framing it as "is the key `writable` there?" invites the
   remediation "filter `writable`," which is the wrong fix — it closes one key and leaves
   the copy open for `graph_queries` (already server-side-read at `graph_support.go:27`)
   and for every key a future feature adds. Ask about the copy, not the key.

3. **Cell 3's ownership question was attached to the wrong construct, and it still fired.**
   The brief conditions "who owns the allowlist?" on landing in cell 3. There is no
   allowlist, so by the brief's own routing that question would never have been asked —
   yet it is the question with the highest yield in this audit, because the thing actually
   holding the line is an accidental two-file conjunction with **no test** (§1.10).
   Recommend un-conditioning it: *whatever* is keeping the door shut, name it and say what
   goes red when someone opens it. Closure by absence of a proto field is still closure,
   and it is even less owned than an allowlist would be, because an allowlist at least has
   a name you can grep for.

4. **Cell 5 is not decidable by a repository audit, and the cell list does not say so.**
   Cells 1–4 are code questions; cell 5 is a *data* question. Assigning both to one
   read-only, no-run leg guarantees that cell 5 gets answered at the scope of the
   instrument ("I grepped the repo and found nothing") and quietly written down at the
   scope of the question ("the key is not present in stored data"). That is exactly the
   comma-shaped boundary failure the dispatch warned about, and the brief's own structure
   sets it up. I have kept them separate in §2 and §4.1; I would split them into different
   legs next time, one of which needs database access.

5. **Minor, but it cost me a cycle.** The brief says `grep` is ugrep 7.5.0 — true, but the
   binary is only on `PATH` as `grep`; invoking `ugrep` returns
   `(eval):1: command not found: ugrep`. Worth adding to the SHELL FACTS block.

6. **Credit where due.** Three brief instructions materially changed the result:
   insisting on `ls -a` (which is how I confirmed the dotted-directory population),
   demanding the search bound be reported with the finding (which is what forced §4.1 to
   be honest instead of letting a repo-grep pose as a data answer), and stating that
   exceeding the brief reads as compliance (§1.9 and finding 1 are both outside the
   suggested surface and outside the question).

---

**Prepared read-only against `/workspace/farmtable-writable-path` @
`7a0f220dbd9332cb8db62138c841777432b4eda4`. No code modified, no commit, no push, no
build, no test, no database. All measurements in this document are from that SHA and no
other.**
