# IMPORT / `writable` — BOUNDED SECURITY TRACE

Leg: `audit-xss-r5` (security audit leg), answering a routed question, not a review round.
Working tree: `/workspace/farmtable-xss-r5-audit`
`git rev-parse HEAD` (worktree): `8f92a0927c211755fd791e11471776ce77f06a41` on `audit-leg-xss-r5`
Subject ref under trace: `d305391ee6dc473f5e7bf202167221e15cf52e10`
Method: **read-only. No build, no test run, no tree modification, no token requested or used.**
Pre-registration: `PREREG-2.md`, written before any file in this trace was opened.

---

## PRE-REGISTERED BRANCHES, AND WHICH ONE FIRED

Written before looking, reproduced verbatim in substance from `PREREG-2.md`:

| Branch | Condition | Pre-committed conclusion |
|---|---|---|
| **A** | Q1 yes, Q2 no | `writable` not a privilege boundary; severity from the (c) measurement. **Sub-case pre-committed:** if other principals read the collection, this is stored capability-confusion and rises to MEDIUM regardless of server gating |
| **B** | Q1 no | Escalation story dies at step one, including that I killed the story I was handed. Residue is fail-closed dead code. INFO. **§10.20 condition: positive-control the zero-writer sweep or mark UNCHECKED** |
| **C** | Q1 yes, Q2 yes, server gates everything | Cosmetic UI lie, LOW, latent-coupling trap |
| **D** (unprompted, added by me because the three given branches omit it) | Q1 yes, Q2 yes, some capability NOT gated | **HIGH** — real boundary, attacker-settable |

### **BRANCH B FIRED.**

And it fired with a bonus I did not pre-register as likely: **branch C's condition is _also_ independently
satisfied.** The escalation dies twice, by two unrelated mechanisms, either of which alone is sufficient.
I flag that as a strengthening result and not as a reason to relax — see F2.

---

## Q1 — Can an import document put author-chosen `remote_data` on a **GitHub-platform** collection?

### **NO.** [MEASURED]

Not "unlikely", not "gated by one check". There are **four independent barriers**, and I only needed one.
An import document CAN choose `remote_data` content — including literally `{"writable": true}` — but the
collection it lands on is **necessarily** `farmtable`-platform, where the key is never consulted.

**Barrier 1 — the document's platform is validated.** `export_import.go`, farmtable branch:

```go
if doc.Collection.Platform != string(collection.PlatformFarmtable) {
    return nil, status.Error(codes.FailedPrecondition, "import only supports farmtable platform collections")
}
```

**Barrier 2 — and then the validated value is thrown away anyway.** The params literal does not
propagate `doc.Collection.Platform`; it hardcodes the constant:

```go
importParams := store.ImportCollectionParams{
    Collection: store.ImportCollection{
        Name:        doc.Collection.Name,
        Description: doc.Collection.Description,
        Platform:    collection.PlatformFarmtable,   // <-- SERVER-SIDE CONSTANT, not from doc
        RemoteData:  sanitizeRemoteData(doc.Collection.RemoteData),
        ...
```

This is the load-bearing one. **Deleting barrier 1 changes nothing**, which is the property I most
wanted to find, because a single validation check is one careless edit from gone. Note also that the
Beads branch never reaches barrier 1 at all — and is still safe, purely because of barrier 2.

**Barrier 3 — import cannot target an existing collection.** `entstore.go` `ImportCollection` is
`tx.Collection.Create()`. `ImportCollectionParams` has **no collection-ID field** (`store.go`:
`Users, Collection, Tasks, Comments, Relationships, Changes`). There is no update path, no upsert, no
targeting. Import is create-only, so it cannot reach a pre-existing GitHub collection.

**Barrier 4 — platform is immutable after creation.** `SetPlatform` has exactly three non-generated,
non-test callers: collection create, import create, linked-account create. `UpdateCollectionParams` is
`{Name *string; Description *string; RemoteData map[string]any}` — **no Platform field**. So the
farmtable collection an importer creates can never later become a GitHub collection.

### The client-side short-circuit that makes this decisive

`capabilities.ts`:

```ts
export function getCapabilities(collection: Collection): CollectionCapabilities {
  if (collection.platform === Platform.FARMTABLE) {
    return ALL_ENABLED;                    // <-- returns BEFORE remoteData is ever read
  }
  if (collection.platform === Platform.GITHUB) {
    const rd = collection.remoteData;
    if (rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true) {
      return GITHUB_CAPABILITIES;
    }
  }
  return ALL_DISABLED;
}
```

An importer can set `writable: true`. On a farmtable collection the function **returns one branch
earlier than the line that reads it.** The flag is inert on precisely the only collections an import
can produce. The attacker gains a database row containing a key nothing will ever look at.

### The other two collection RPCs — which the premise did not name, and which I checked

The premise identified `ImportCollection` as the one path able to persist externally-authored
collection `remote_data`. **That is correct, and I verified it rather than assuming it**, because if
`CreateCollection` or `UpdateCollection` accepted `remote_data` the whole answer would invert — those
two CAN address GitHub-platform collections.

- **`CreateCollection`** *can* create a GitHub collection (platform comes from the request, with a
  `remote_id` requirement). But its params literal is `{Name, Description, Platform, RemoteID}` —
  **`RemoteData` is never populated from the request.** The store layer supports the field; the RPC
  does not expose it. A GitHub collection created this way has `remote_data` nil, `'writable' in rd`
  is false, and `getCapabilities` returns `ALL_DISABLED`. **Fail-closed.**
- **`UpdateCollection`** builds `store.UpdateCollectionParams{}` and populates only `Name` and
  `Description`. `RemoteData` is never set from the request, despite the struct having the field and
  the store implementing merge semantics for it.

**This is the sharpest thing in the trace and it deserves naming:** at the store layer,
`UpdateCollection` implements a full old-into-new **merge** of `remote_data`, and `CreateCollection`
accepts `remote_data` wholesale. Both capabilities are built, tested by their own presence, and
**simply not wired to any request field.** The safety here is one unwritten line in a params literal,
in a handler that already parses the collection ID and already passes `RequireCollectionAccess`. See F2.

### One near-miss I chased and cleared

`server.go` around the `remote_id`/`remote_url` handling assigns `p.RemoteData = map[string]any{}` from
request fields — I flagged it as a candidate client-driven `remote_data` writer. **It is `UpdateTask`,
not a collection RPC**, it writes TASK `remote_data`, and it writes exactly two fixed keys
(`remote_id`, `remote_url`), the latter through `validateURLField`. Not a path to `writable`.
Recorded because it is the one thing in this trace that looked like a hit and was not.

---

## Q2 — Is `ImportCollection` reachable by a principal without write authority over the collection it touches?

### **NO, in the only sense the question can have here.** [MEASURED]

```go
if _, err := RequireIdentity(ctx); err != nil { return nil, err }
if err := RequireScope(ctx, ScopeCollectionAdmin); err != nil { return nil, err }
```

There is no `RequireCollectionAccess` call, and **there correctly cannot be one**: the collection it
touches is a collection it creates in the same transaction. There is no pre-existing object whose ACL
could be consulted. The authority model for "may this principal bring a new collection into
existence" is `ScopeCollectionAdmin`, which is the strictest of the scopes I saw in this trace
(`CreateCollection` and `UpdateCollection` require only `ScopeCollectionWrite`).

**Import is the more privileged operation of the three, and it is the one that gets the stronger
scope.** That ordering is correct and I want it on the record as a deliberate-looking choice.

**Robustness note on the open HIGH (item (a)).** I did not investigate the wildcard-scope escalation
and I am not treating it as confirming anything, per instruction. I will note only this, because it
is decision-relevant and free: **my Q1 answer does not depend on Q2.** Even a principal who obtains
`ScopeCollectionAdmin` by that escalation still cannot reach a GitHub collection through import,
because barriers 2, 3 and 4 are not authorization checks at all — they are data-flow facts. The two
findings are independent, exactly as you said, and this one does not become worse if that one is real.

---

## Q3 — Is `writable` a security boundary?

### **NO. It is a UI affordance, and today it is an inert one.** [MEASURED, with one UNCHECKED edge]

Decided on two independent measurements:

**1. It is unreachable.** Zero non-test Go writes the key; my independent sweep reproduces the review
leg's result. Nothing in the tree can set it on a collection whose platform makes it readable.

**2. Even if it were reachable, it grants nothing.** This is the (c) measurement, and it is the one
that decides severity, so I enumerated the capability set rather than gesturing at it.
`GITHUB_CAPABILITIES` enables exactly nine operations — title, description, stage, priority, assignee,
parent, comment, close, create — which reach the server as `CreateTask`, `UpdateTask`, and
`AddComment`. All three, measured:

```go
RequireIdentity(ctx)                          // all three
RequireScope(ctx, ScopeTaskWrite)             // all three
RequireCollectionAccess(ctx, <collection id>) // CreateTask: parsed collection_id
                                              // UpdateTask: existing.CollectionID, loaded from store
```

`UpdateTask` deriving the collection from the **stored** task rather than from the request is the
right shape — the client cannot redirect the access check. `DeleteTask` is `Unimplemented`, matching
`canDeleteTask: false`.

**No server handler consults any client-supplied capability, and no Go code reads `writable` at all.**
The flag cannot unlock a server operation because no server operation asks it anything.

So branch D — the outcome I added because the given three omitted it, and the only one that would have
been HIGH — **is refuted by measurement, not by assumption.**

### The §10.25 statement I owe on that conclusion

The surroundings I chose: I checked the three RPCs the nine enabled capabilities map to, in the
handler preamble, on the `FarmTableService` implementation. I did **not** check the MCP surface, the
CLI, the passthrough store's own internal authorization, or any gRPC interceptor that might sit in
front of these handlers. My positive control for the write-sweep is genuine — the same
`SetRemoteData` search returns six non-generated hits, so it is capable of returning non-empty, and
the zero for `writable` is not an unproven zero. My control for the *capability* claim is weaker: it
is an enumeration, not a plant, and I ran nothing.

---

## FINDINGS

### [INFO] F1 — The `writable` branch is dead today, and dead fail-closed

- **Location:** `web/src/capabilities.ts` `getCapabilities`; `web/src/components/ft-app.ts`
  `isCollectionWritable`; no writer anywhere.
- **Evidence:** zero non-test Go matches for `writable` (positive-controlled sweep); no RPC populates
  collection `RemoteData` except `ImportCollection`, which is pinned to farmtable platform.
- **Why this is INFO and not a vulnerability:** the unwritten key makes `'writable' in rd` false, which
  selects `ALL_DISABLED`. **A gate reading a key nobody writes always takes the safe path.** Dead code
  that fails closed is a maintenance concern, not a security one.
- **Recommendation:** either delete the branch, or — better, since the intent is clearly a future
  read-only/read-write distinction — leave it and add the comment in F2.

### [LOW] F2 — Latent coupling: two built-but-unwired `remote_data` writers sit next to an authz-shaped flag

- **Location:** `internal/server/server.go` `CreateCollection` / `UpdateCollection` params literals;
  `internal/store/entstore.go` `CreateCollection` / `UpdateCollection`.
- **Description:** the store layer fully implements collection `remote_data` write and merge. The RPCs
  simply never populate the field. Wiring either one to a request field — a natural, small, plausible
  change, in handlers that already parse the ID and already authorize — **would make `writable`
  client-settable on GitHub collections in a single commit**, converting F1 from dead to live.
- **Why this is not higher:** it requires a future code change. It is a trap, not a hole. And per Q3,
  even sprung it yields only a UI lie, because the server does not consult the flag.
- **Why it is not INFO:** this codebase **already reads collection `remote_data` server-side to make a
  decision** — `graph_support.go` branches on `c.RemoteData["graph_queries"]`. The argument "the server
  would never trust that data" is empirically unavailable here. That is a feature gate rather than an
  authz gate, which is why this is LOW and not MEDIUM, but the pattern exists.
- **Recommendation, concrete:**
  ```go
  // remote_data is NOT settable through this RPC by design. The web client reads
  // remote_data["writable"] as a capability hint (capabilities.ts getCapabilities);
  // making that key client-writable would let a caller author its own UI capability
  // set. Server authorization must never consult remote_data. See reports/xss-r5-import-writable.md.
  ```
  placed at both params literals — and, if the read-only/read-write distinction is wanted for real,
  promote it to a typed first-class column with a server-side check, not a free-form JSON key.

### [INFO] F3 — I am downgrading one of my own r5 findings on the strength of this trace

My r5 report carried **F5 (LOW):** "`default: return v, true` has no backstop on the export path;
saved by an unpinned input-type precondition." This trace pins that precondition on the import side.
`doc.Collection.RemoteData` is populated by `encoding/json` into `map[string]any`, and
`encoding/json` can only produce `map[string]interface{}`, `[]interface{}`, `string`, `float64`,
`bool`, `nil`. The sanitizer walks `map[string]any` and `[]any` and handles the scalars. **Every type
JSON can produce is walked**, so the unwalked-type `default` arm is unreachable on this path and the
missing structpb backstop costs nothing here.

**r5 F5 should be recorded as INFO on the import path, not LOW.** The precondition I flagged as
unpinned is now measured. It remains LOW anywhere the map is built from Go-native types rather than
decoded from JSON.

### [UNCHECKED] F4 — A possible convergence with your item (b), named and not chased

My trace passed through `entstore.ImportCollection` creating **users** with document-chosen UUIDs
(`tx.User.Create().SetID(imported.ID)` with document-supplied `DisplayName`, `Type`, `Status`,
including a hardcoded `system:migration` service-account row). You mentioned an open item about "a
free row on an authorization path" and a third about this same import surface. **This may be the same
surface reached from a third route.** I am naming it because you asked me to rather than avoiding it
for fear of double-counting, and I am marking it **UNCHECKED**: I did not trace user-ID collision
behaviour, whether `resolveImportUsers` de-duplicates against existing principals, or whether a
created user row carries any authority. **Not a finding. A pointer.**

Also UNCHECKED and noted in passing: import accepts document-supplied `CreatedAt`/`UpdatedAt` for the
collection, so imported timestamps are attacker-chosen. Relevant to audit-trail integrity, not to
`writable`, and outside what I was asked.

---

## WHERE THE PREMISE WAS INCOMPLETE

The premise was **accurate** — both read sites, the capability-not-render-sink characterisation, and
the zero-writer result all reproduced. Two gaps, neither of which changes its conclusion:

1. **It named `entstore.go:2117` as the persistence path, but there are two `ImportCollection` store
   implementations.** `GitHubPassThroughStore.ImportCollection` returns `ErrNotImplemented`. This
   *strengthens* the premise: on a passthrough-primary deployment import does not merely fail to reach
   GitHub collections, it fails outright.
2. **It did not mention `CreateCollection`/`UpdateCollection`.** They turn out not to write
   `remote_data`, so the premise's conclusion holds — but they are the paths that *can* address GitHub
   collections, so "import is the only writer" needed checking rather than accepting. That check is F2.

## WHAT I DID NOT CHECK

- **Anything requiring execution.** No build, no test, no `govulncheck`. Every claim is from source.
- **Whether a gRPC interceptor sits in front of these handlers** and could alter the authorization
  picture. I read handler preambles only.
- **The MCP and CLI surfaces.** If either constructs collection updates by a different route, my
  "no RPC writes collection remote_data" claim is scoped to `FarmTableService` and does not cover them.
- **Out-of-tree writers.** Direct DB access, migrations, a different producer build. A GitHub
  collection with `writable: true` written straight into SQLite would activate the branch; per Q3 it
  would still grant nothing server-side, but I cannot rule the write itself out read-only.
- **`resolveImportUsers`** (F4), deliberately.
- **The open HIGH on `ImportCollection`**, deliberately, per instruction.
- **Any positive control involving a plant, mutant, or payload.** I ran nothing, so §10.25 points 1–3
  had nothing to attach to. My absence claims rest on positive-controlled *searches*, which is weaker.

## VERDICT ON THE QUESTION ASKED

**The story I was handed is dead, and I was given it to kill.** An attacker cannot import a collection
with `writable: true` and light up the GitHub buttons, because the imported collection is farmtable-
platform by server-side constant and `getCapabilities` returns before reading the key. Had they got
past that, the nine capabilities reach three RPCs that each independently require identity, scope, and
collection access, and no Go code reads `writable` at all.

**`writable` is not a security boundary. It is an inert UI affordance with a latent-coupling trap
next to it (F2).** Highest severity **LOW**. Nothing here is blocking — though BLOCKING is your call,
not mine.
