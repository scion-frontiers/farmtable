# scopepath-61 — Is the scope check on every RPC path?

**Tree measured: `633f8f269bcf9225b62d3c7c119f8166eda9ae64` (canonical `/workspace/farmtable`, branch
`task-state-web-ui-v2`, unpushed). Every file:line in this report is at that SHA unless another SHA is
named inline.**

---

## THREE-LINE SUMMARY

1. **All 33 gRPC RPCs on the generated manifest reach a scope check except three** (`WhoAmI`,
   `GetStatus`, `GetVersion`) — MEASURED at `633f8f2`; all three are defensible, and none is an
   unguarded mutation. **On the gRPC surface there is no missing wall.**
2. **Enforcement is NOT centralised in the auth interceptor** — the interceptor only *installs*
   scopes; all 30 checks are per-handler (`auth.go:111`/`:161`, `633f8f2`). There IS a skiplist
   (`isUnauthenticatedEndpoint`, `auth.go:102`) holding exactly `GetVersion` and `GetStatus`.
3. **The gRPC manifest is not the only door.** `/api/link/{github,jira,linear}/*`
   (`internal/serverapp/linkflows.go:96-107`, `633f8f2`) creates linked-account rows with OAuth
   tokens **by calling the store directly, with no scope check, no identity check and no session
   check** — the same operation costs `collection:admin` over gRPC. **This is the one place tonight
   where an operation genuinely walks around the building.** See F-1.

---

## READ THIS BEFORE YOU READ THE TABLE

Three warnings, because this file will outlive the context that produced it.

**(a) THIS REPORT DOES NOT SAY AUTHORIZATION IS SOUND, AND MUST NOT BE CITED AS SAYING SO.**
It measures one thing only: *does control reach a scope check.* It does **not** measure whether the
scope checked is the **right** scope. A handler calling `RequireScope(ctx, ScopeTaskRead)` where it
should demand `ScopeCollectionAdmin` is classified CHECKS here and passes this audit completely.
**Scope presence is not scope correctness. Scope correctness is UNCHECKED by me, on every one of the
33 methods.**

**(b) AT `633f8f2` A "CHECKS" CLASSIFICATION DOES NOT IMPLY ENFORCEMENT.**
At this SHA `scopes.go:83` returns `nil` for an empty scope set. So for any token holding no scopes,
a handler that calls `RequireScope` and one that never calls it **behave identically — both allow.**
The table below therefore describes *reachability*, not *today's enforcement*. This is the property
the `scopedeny-93` leg's work changes; I did not re-derive that leg's proof and this report is **not
a second independent witness to it** (see "Scope discipline" below).

**(c) WHAT THIS TABLE IS ACTUALLY FOR — AND IT HAS A DEADLINE.**
Reachability is **identical on `633f8f2` and on the unmerged fix `160e211`** (VERIFIED, method
below). So this table is valid on both trees. Its value is *pre-merge*: the moment the fix lands and
the door starts denying, **the handlers that never reach the door become the only remaining gap —
while looking, in every report and every green test suite, exactly like the fixed ones.** After the
merge that population is invisible. Before the merge it is measurable. That is what D2 is.

---

## THE THREE TREES

Every unqualified line number in this project is ambiguous across three trees. MEASURED:

| Tree | SHA | State |
|---|---|---|
| `origin/main` | `7a0f220dbd9332cb8db62138c841777432b4eda4` | published; canonical is **39 commits ahead** (`git rev-list --count origin/main..633f8f2` = 39) |
| canonical `task-state-web-ui-v2` | `633f8f269bcf9225b62d3c7c119f8166eda9ae64` | **the tree this report measures**; unpushed |
| `scopedeny-93-deny-unrecognised-type` | `160e211581a686d988df5fbdf2e89af64e75fb2d` | the empty-scope fix; **unmerged**, 7 commits atop `633f8f2` |

MEASURED: `160e211` is **not an object in canonical's repository** (`git rev-parse` from
`/workspace/farmtable` → `fatal: bad object`). It exists only in the clone
`/workspace/farmtable-scopedeny-93`. Canonical cannot currently see the fix branch at all.

**Note on the brief.** The brief's citations (`ContextWithScopes:49`, `ScopesFromContext:57`,
decision at `:106`) match **no file at `633f8f2`** (actual: 47, 53, 83 — MEASURED). They match
`/workspace/farmtable-scopedeny-93/internal/server/scopes.go` exactly. The brief's premise was a
branch-local fact stated as a repository fact; the coordinator has acknowledged this as a relay
error. Recorded here only so a later reader does not re-trip on it.

**Scope discipline.** Per coordinator instruction I did **not** audit whether the door's decision is
correct. The empty-scope semantics at `scopes.go:83` (`633f8f2`) are reported above solely as the
*interpretive bound* on my table. The `scopedeny-93` leg is the single witness to that property.
**One derivation is not two witnesses; do not count this report as corroboration.**

---

## D1. THE MANIFEST — MEASURED

Enumerated from the **generated interface**, not from a receiver grep:

- **`FarmTableServiceServer`**, declared at
  **`api/farmtable/v1/farmtable_grpc.pb.go:471`** (`633f8f2`), methods on lines **472–517**.
- **Total RPC methods: 33** (excluding the sealing method `mustEmbedUnimplementedFarmTableServiceServer()`
  at `:518`, which is not an RPC).
- It is the only service interface in the repo: `grep -n 'ServiceServer interface'` on that file
  returns exactly `:471` and `:633` (`UnsafeFarmTableServiceServer`, a 1-method sealing interface,
  not a service).

**The brief's warning about receiver-greps was correct and I can evidence it:**
`grep -rn '^func (s \*Server)'` over `internal/server/` returns **zero matches** (exit 1) — the
receiver is `*FarmTableService` (`internal/server/server.go:28`). A vocabulary sweep would have
enumerated **nothing** here and, absent a manifest to reconcile against, could have been reported as
a clean result.

MEASURED: every one of the 33 manifest methods has an explicit `*FarmTableService` implementation;
**zero** fall through to the embedded `pb.UnimplementedFarmTableServiceServer` (`server.go:29`).
(Had any fallen through, that is fail-closed — `codes.Unimplemented` — not a hole.)

---

## D3. THE POSITIVE CONTROL — BOTH ARMS, BOTH RESULTS

**Detection method.** For each manifest method, locate its `*FarmTableService` implementation, bound
its body by the next `func (s *FarmTableService)` in the same file, and search that range for
`RequireScope(`. Then hand-verify every negative and trace it transitively (D5).

Both arms hand-read first, then the method run at both:

| Arm | Method | Hand reading | Method output | Discriminates? |
|---|---|---|---|---|
| **Positive** | `GetUser` (`server.go:1409`) | reads `RequireScope(ctx, ScopeUserRead)` at `:1410` | **FLAGGED as checking** | ✅ |
| **Negative** | `WhoAmI` (`server.go:1348`) | body is `:1348–:1358`, 11 lines, hand-read in full — **contains no `RequireScope`** | **NOT flagged** | ✅ |

**Both arms are reachable and the two results differ.** The negative arm is a real negative, not an
absence of evidence: the nearest `RequireScope` in the file is `:1361`, which is inside `ListUsers`
(`:1360`) — i.e. the classifier correctly refused to let an adjacent handler's check leak across the
function boundary into `WhoAmI`. A range-bounding bug would have produced exactly that false pass,
and this arm is the control that excludes it.

**Independent cross-check:** the scripted classification reproduced my hand mapping for all 33
methods with **zero disagreements**, and its own arithmetic check printed `30 + 3 = 33 … MATCH=True`.

---

## D4. THE INTERCEPTOR ANSWER (T2)

**Is enforcement centralised in the auth interceptor path? — NO.** MEASURED at `633f8f2`.

The unary interceptor `TokenAuthInterceptor` (`auth.go:111`) and stream interceptor
`TokenAuthStreamInterceptor` (`auth.go:161`) perform **authentication only**:

- resolve the bearer/`x-farmtable-token` credential (`auth.go:83`), hash it, look it up
  (`auth.go:143` / `:192`), reject on unknown token or expiry (`auth.go:145-150` / `:194-199`);
- then **install** identity and scopes into the context — `ContextWithScopes` at **`auth.go:155`**
  (unary) and **`auth.go:204`** (stream).

**Neither interceptor calls `RequireScope`, and neither consults a per-method scope requirement
table.** MEASURED: `grep -rn 'RequireScope('` over non-test `internal/` and `cmd/` returns 33 hits,
of which **none** is in `auth.go`. Authorization is therefore **per-handler and by convention**, not
structural. There is no compiler- or framework-level guarantee that a future RPC will check anything;
the guarantee rests on each handler author remembering. **A new RPC added tomorrow with no
`RequireScope` line would be authenticated but entirely unauthorized, and nothing in the build would
object.** That is the standing structural risk, independent of any finding below.

### The skiplist — FOUND

**`isUnauthenticatedEndpoint`, `internal/server/auth.go:102-109` (`633f8f2`).** Consulted at
`auth.go:122` (unary) and `auth.go:171` (stream). It contains exactly two entries:

```go
case "/farmtable.v1.FarmTableService/GetVersion",
     "/farmtable.v1.FarmTableService/GetStatus":
```

Assessment: **the membership is right, the blast radius of one member is larger than its name
suggests.** Both are legitimately pre-auth (a client must be able to negotiate version and liveness
before presenting a credential). It is a closed, short, explicit, reviewed list matched on
`info.FullMethod` — no wildcards, no prefixes, no config-file indirection. That is the good version
of this artefact. But see **F-2**: `GetStatus` is not a bare health probe.

One subtlety worth recording, MEASURED: the skiplist is consulted at `auth.go:122`, **after**
`authEnforcedKey` is set at `auth.go:120`. So skiplisted RPCs run with auth marked enforced but with
**no scopes installed** — an empty scope set. At `633f8f2` that is moot (`scopes.go:83` allows
empty). Under `160e211` an empty set denies, so if either skiplisted handler ever grows a
`RequireScope` call it would deny **every** caller, including legitimate pre-auth clients. Neither
handler calls `RequireScope` today, so **this is a latent trap, not a live defect** — flagged for
whoever merges the fix. FALSIFIER: a `RequireScope` call appearing in `GetVersion` or `GetStatus`
after the merge without a corresponding skiplist change.

---

## D2. THE CLASSIFICATION TABLE — ALL 33 METHODS

Per coordinator addition, the NO-CHECK / PUBLIC rows also record **whether the handler performs any
*other* authorization** (ownership test, identity comparison, admin flag).

### Batch 1 of 3 — methods 1–15

| # | RPC | Category | Citation (`633f8f2`) | Scope demanded |
|---|---|---|---|---|
| 1 | `ListTasks` | CHECKS | `server.go:359` | `task:read` |
| 2 | `GetTask` | CHECKS | `server.go:311` | `task:read` |
| 3 | `CreateTask` | CHECKS | `server.go:91` | `task:write` |
| 4 | `InsertTasksAfter` | CHECKS | `server.go:225` | `task:write` |
| 5 | `UpdateTask` | CHECKS | `server.go:487` (+ per-transition check at `:538`) | `task:write` |
| 6 | `ClaimTask` | CHECKS | `server.go:705` | `task:claim` |
| 7 | `CloseTask` | CHECKS | `server.go:760` | `task:close` |
| 8 | `DeleteTask` | CHECKS | `server.go:808` | `task:write` |
| 9 | `AddComment` | CHECKS | `server.go:820` | `task:write` |
| 10 | `ListComments` | CHECKS | `server.go:851` | `task:read` |
| 11 | `GetComment` | CHECKS | `server.go:904` | `task:read` |
| 12 | `ListCollections` | CHECKS | `server.go:947` | `collection:read` |
| 13 | `GetCollection` | CHECKS | `server.go:928` | `collection:read` |
| 14 | `CreateCollection` | CHECKS | `server.go:1030` | `collection:write` |
| 15 | `UpdateCollection` | CHECKS | `server.go:1066` | `collection:write` |

*Batch 1 subtotal: CHECKS 15, CHECKED-UPSTREAM 0, LEGITIMATELY-PUBLIC 0, NO CHECK FOUND 0.*

### Batch 2 of 3 — methods 16–30

| # | RPC | Category | Citation (`633f8f2`) | Scope demanded |
|---|---|---|---|---|
| 16 | `ExportCollection` | CHECKS | `export_import.go:106` | `collection:read` |
| 17 | `ImportCollection` | CHECKS | `export_import.go:268` | `collection:admin` |
| 18 | `CreateLinkedAccount` | CHECKS | `server.go:1107` | `collection:admin` |
| 19 | `GetLinkedAccount` | CHECKS | `server.go:1155` | `collection:read` |
| 20 | `DeleteLinkedAccount` | CHECKS | `server.go:1179` | `collection:admin` |
| 21 | `ListLinkedAccounts` | CHECKS | `server.go:1203` | `collection:read` |
| 22 | `GetReadyTasks` | CHECKS | `server.go:1466` | `task:read` |
| 23 | `GetBlockedTasks` | CHECKS | `server.go:1576` | `task:read` |
| 24 | `GetDependencyTree` | CHECKS | `server.go:1686` | `task:read` |
| 25 | `GetCriticalPath` | CHECKS | `server.go:1792` | `task:read` |
| 26 | `GetBottlenecks` | CHECKS | `server.go:1969` | `task:read` |
| 27 | `ListChanges` | CHECKS | `server.go:1294` | `task:read` |
| 28 | `ListUsers` | CHECKS | `server.go:1361` | `user:read` |
| 29 | `GetUser` | CHECKS | `server.go:1410` | `user:read` |
| 30 | `WatchTasks` (stream) | CHECKS | `watch.go:26`, preceded by `RequireIdentity` at `watch.go:23` | `task:read` |

*Batch 2 subtotal: CHECKS 15, CHECKED-UPSTREAM 0, LEGITIMATELY-PUBLIC 0, NO CHECK FOUND 0.*

### Batch 3 of 3 — methods 31–33 (the entire non-CHECKS population)

| # | RPC | Category | Citation (`633f8f2`) | Other authorization present? |
|---|---|---|---|---|
| 31 | `WhoAmI` | LEGITIMATELY-PUBLIC (authenticated, deliberately unscoped) | `server.go:1348-1358`; no `RequireScope` in body | **YES — hard identity gate.** `UserIDFromContext` at `:1349`; returns `codes.Unauthenticated` at `:1351` unless a non-nil user ID is present. Reads **only the caller's own record** (`s.store.GetUser(ctx, userID)`, `:1353`) — the ID is taken from the context, **not from the request**, so it cannot be pointed at another user. |
| 32 | `GetVersion` | LEGITIMATELY-PUBLIC | `server.go:1426-1432`; no `RequireScope`; on skiplist `auth.go:104` | **NO** — and none needed. Returns three static strings (`s.version`, `"farmtable"`, `"grpc"`). Touches no store, no context, no request field. |
| 33 | `GetStatus` | LEGITIMATELY-PUBLIC **with a caveat — see F-2** | `server.go:1434-1461`; no `RequireScope`; on skiplist `auth.go:105` | **PARTIAL.** The `AuthenticatedAs` field is correctly identity-gated (`:1454`, populated only for a non-nil context user ID). But `TaskCount` (`:1451`) and store reachability (`:1444-1447`) are returned **unconditionally to unauthenticated callers**. |

*Batch 3 subtotal: CHECKS 0, CHECKED-UPSTREAM 0, LEGITIMATELY-PUBLIC 3, NO CHECK FOUND 0.*

### D2 ARITHMETIC — STATED EXPLICITLY AS REQUIRED

| Category | Count |
|---|---|
| CHECKS | 30 |
| CHECKED-UPSTREAM | 0 |
| LEGITIMATELY-PUBLIC | 3 |
| **NO CHECK FOUND** | **0** |
| **Sum** | **33** |

**30 + 0 + 3 + 0 = 33. D1 total = 33. THE SUM MATCHES.** No method is unaccounted for and no method
appears in two categories.

**On the empty NO CHECK FOUND bucket.** This is a real result, not a failed search — the classifier's
negative arm is demonstrably reachable (D3), and it fired on all three of `WhoAmI`, `GetStatus` and
`GetVersion`; I then hand-read each and reclassified them as public on their merits, not on their
names. **CHECKED-UPSTREAM is empty because nothing is checked upstream** (D4), not because I did not
look there.

**Honest characterisation of the three:** `GetVersion` is unambiguously fine. `WhoAmI` is fine and is
arguably the single best-designed handler here — it takes its subject from the context rather than
the request, which is the property that makes "unscoped" safe. `GetStatus` is the one I would not
wave through unexamined (F-2). **None of the three is a mutation, and no mutating RPC on the manifest
lacks a scope check** — MEASURED.

---

## FINDINGS

### F-1 — [HIGH] `/api/link/*` creates linked accounts with zero authorization, bypassing `collection:admin`

**This is the answer to the brief's actual question. The door is on every gRPC path; this operation
is not on a gRPC path.**

- **Location:** `internal/serverapp/linkflows.go:96-107` (routes), `:220`, `:337`, `:449` (writes) —
  all at `633f8f2`. Wired at `internal/serverapp/unified.go:93-95`.
- **Description.** Six HTTP routes are registered directly on the `net/http` mux:
  `/api/link/{github,jira,linear}/{install|connect,callback}`. Their handlers hold a
  `store.Store` directly (`NewLinkFlowManager(o.Store, o.BaseURL)`, `unified.go:94`) and call
  **`lm.store.CreateLinkedAccount(...)`** at `:220`, `:337`, `:449`. MEASURED: `linkflows.go`
  contains **no** `RequireScope`, **no** `UserIDFromContext`, **no** session lookup and **no** cookie
  check — I grepped the whole file for each. The target collection is taken **straight from an
  attacker-controlled query parameter**: `uuid.Parse(r.URL.Query().Get("collection_id"))` (`:135`).
- **Why the gRPC audit cannot see it.** The identical operation over gRPC —
  `CreateLinkedAccount` — demands `collection:admin` (`server.go:1107`, row 18 above). The
  interceptors that install scopes are gRPC interceptors; these routes never traverse them.
  **My D2 table is 33/33 clean and this is still true. That is precisely the gap the brief was
  commissioned to look for.**
- **It is not IAP-protected either.** MEASURED: in `AuthModeProxy`, `iapMiddleware` wraps **only**
  `grpcWebHandler` (`unified.go:88`), and only `/farmtable.v1/*` is served by it
  (`unified.go:99-100`). The `/api/link/*` routes are siblings on the same mux, outside that wrapper.
- **Impact.** An unauthenticated caller who can reach the HTTP port can bind an OAuth linked account —
  including a live `AuthToken`/`RefreshToken` (`:209`, `:214`) — to **any collection UUID they name**,
  an operation otherwise reserved to `collection:admin`. The `state` nonce (`:141`, `:170-181`) is
  CSRF protection for the OAuth round-trip; it is generated and redeemed by the same unauthenticated
  endpoints and so **provides no authorization** — the attacker walks the flow himself.
- **Exploitation sketch (source-derived, NOT executed — I hold no build token):**
  `GET /api/link/github/install?collection_id=<victim-uuid>` with no credential → 307 to GitHub →
  attacker consents with **his own** GitHub account → `GET /api/link/github/callback?state=...&code=...`
  → `CreateLinkedAccount` row written against the victim collection, HTTP 200 with the new account ID.
- **Recommendation.** Gate these routes on the same authority as the RPC. They already have a
  `SessionManager` available in `unified.go`; resolve the session to a user and scope set and require
  `collection:admin` for the named collection before storing:

  ```go
  // linkflows.go — at the top of each install/connect handler
  claims, ok := sm.UserFromRequest(r)          // session cookie → user + scopes
  if !ok {
      http.Error(w, "authentication required", http.StatusUnauthorized)
      return
  }
  if err := server.RequireScope(claims.Ctx(), server.ScopeCollectionAdmin); err != nil {
      http.Error(w, "collection:admin required", http.StatusForbidden)
      return
  }
  if err := server.RequireCollectionAccess(claims.Ctx(), collectionID); err != nil {
      http.Error(w, "not authorized for this collection", http.StatusForbidden)
      return
  }
  ```

  Bind the authenticated user into `linkState` at `:148` so the callback re-verifies the **same**
  principal that began the flow, rather than trusting the state nonce alone.
- **MEASURED, and it matters for sequencing:** `linkflows.go` is **not** among the 10 files the
  `scopedeny-93` fix touches (`git diff --stat 633f8f2 160e211`). **Merging that fix does not close
  this.** F-1 needs its own change.

### F-2 — [LOW] `GetStatus` discloses task counts to unauthenticated callers

- **Location:** `internal/server/server.go:1449-1452`, skiplisted at `auth.go:105` (`633f8f2`).
- **Description.** `GetStatus` sits on the pre-auth skiplist alongside `GetVersion`, but unlike
  `GetVersion` it queries the store: it sets `resp.TaskCount` from a real `ListTasks` call (`:1449-1452`)
  and probes collection reachability (`:1444`). Both are returned to callers who presented no
  credential.
- **Impact.** Anonymous disclosure of total task volume, plus an oracle for whether the datastore is
  healthy. Low on its own; it is a monitoring-grade signal exposed at an unauthenticated endpoint.
  The `AuthenticatedAs` field is *correctly* handled (`:1454`) and is not part of this finding.
- **Recommendation.** Populate `TaskCount` only when the context carries an identity, mirroring the
  pattern already used two lines below at `:1454`:

  ```go
  if userID, ok := UserIDFromContext(ctx); ok && userID != uuid.Nil {
      if _, taskTotal, err := s.store.ListTasks(ctx, store.ListTasksParams{Limit: 1}); err == nil {
          resp.TaskCount = int32(taskTotal)
      }
  }
  ```

### F-3 — [INFO / structural] Scope enforcement is per-handler convention, not a chokepoint

Covered in D4. Recorded as a finding because it is the reason this brief had to be written at all:
nothing in the type system, the interceptor chain or the build prevents RPC #34 from shipping with no
`RequireScope` line. Today's 30/30 is a fact about **author diligence**, not about **structure**, and
it is re-earned by hand on every new RPC. A registry mapping `info.FullMethod` → required scope,
consulted in the interceptor and defaulting to *deny* for unlisted methods, would convert this from
convention into structure — and would make the skiplist the single reviewed exception list it is
already trying to be.

---

## D5. TRACE DEPTH — ONE LINE

**Depth 2 for the three non-checking handlers** (handler body → every function it calls, i.e.
`UserIDFromContext`, `s.store.GetUser`, `s.store.ListTasks`, `s.store.ListCollections`), and **depth 1
for the 30 CHECKS** (a direct in-body `RequireScope` terminates the trace). **I stopped at the
`store.Store` interface boundary** and did not descend into `internal/store` implementations or Ent.
Justified by a whole-repo measurement, not assumption: `grep -rn 'RequireScope('` over non-test
`internal/` and `cmd/` returns hits in **only** `scopes.go`, `server.go`, `export_import.go` and
`watch.go` — **no scope check exists anywhere below the handler layer**, so a deeper trace could not
have found one.

---

## D6. NOT REACHED — BOUNDS AND THEIR FALSIFIERS

**Restating the load-bearing bound where a skimmer will hit it: at `633f8f2`, a CHECKS
classification does not imply enforcement** — `scopes.go:83` allows empty scope sets, so all 30
CHECKS rows are *reachability*, not *denial*. This table becomes a statement about enforcement only
once `160e211` (or equivalent) merges.

| # | Bound not measured | Falsifier — the observation that would prove me wrong |
|---|---|---|
| 1 | **Scope *correctness*.** I verified a check is reached, never that the scope is the right one. | Any handler where the demanded scope is weaker than its effect — e.g. an RPC mutating collections behind `task:read`. A reviewer reading the D2 "Scope demanded" column against each handler's actual effect would find it. |
| 2 | **Non-gRPC surfaces beyond those enumerated.** I found and audited three: gRPC-Web, MCP, and the `serverapp` HTTP mux. I did **not** exhaustively enumerate every `net/http` route in the binary. | Any `mux.HandleFunc`/`mux.Handle` registration outside `internal/serverapp/{unified,session,oauth,linkflows}.go` that reaches `store.Store`. `grep -rn 'HandleFunc\|mux.Handle'` over non-test, non-worktree Go returned only those four files at `633f8f2` — a hit elsewhere falsifies me. |
| 3 | **gRPC-Web and MCP judged safe by wiring, not by execution.** DERIVED: gRPC-Web routes to `wrappedGrpc` (`unified.go:99-100`) so interceptors apply; MCP is a **gRPC client** (`internal/mcp/server.go:19`, `pb.FarmTableServiceClient`) so its calls re-enter through the front door and inherit all 33 handler checks. | A `store.Store` (or Ent client) reference inside `internal/mcp` — i.e. MCP touching data without a `s.client.*` round-trip. Would mean MCP is a fourth door. |
| 4 | **The `ft` CLI and `cmd/decomposer`.** Not audited. If either embeds a store directly rather than dialing gRPC, it is a local-access path around the wall. | A `store.Open`/direct-Ent call in `cmd/ft` or `cmd/decomposer` not preceded by a gRPC dial. Note `internal/cli/connect.go:169` runs an **in-process server** in embedded mode — whether interceptors are installed on *that* server is UNCHECKED by me. |
| 5 | **Whether `TokenAuthInterceptor` is actually installed in every deployment.** I read the interceptor; I did not verify every `grpc.NewServer` passes it. If a deployment omits it, `lookup == nil` (`auth.go:113`) short-circuits and `authEnforcedKey` is never set — and `scopes.go:76` then allows **everything** on **all 33 RPCs**. | A `grpc.NewServer` call in non-test code without `TokenAuthInterceptor` in its options. **This is the highest-value unmeasured bound in this table and I recommend it be assigned.** |
| 6 | **Runtime behaviour, everywhere.** Source-only audit; **no build token, none requested.** No RPC was executed, no exploit run. F-1's exploitation sketch is derived from source and is **UNVERIFIED at runtime**. | Any dynamic test contradicting a static claim here. |
| 7 | **Test files excluded throughout.** All greps filtered `_test.go` and `.claude/worktrees/`. | A production code path reachable only via a test helper — unlikely, but not excluded by me. |
| 8 | **`origin/main` (`7a0f220`) not audited.** This report describes `633f8f2` only, which is 39 commits ahead. Tonight's new CI gate reportedly runs against `7a0f220`. | Any of these 33 handlers differing at `7a0f220` — plausible, since 39 commits separate them. **Do not read this report as describing what is published.** |

---

## POSITIVE OBSERVATIONS

- **30 of 33 RPCs check a scope as their first statement**, before argument parsing or store access.
  Checking before validation is the right order — it avoids leaking existence/validity information to
  unauthorized callers.
- **The scope vocabulary is granular and the assignments are plausible**: `task:claim` for `ClaimTask`,
  `task:close` for `CloseTask`, `collection:admin` for the three destructive/credential-bearing
  linked-account RPCs. This is not a one-scope-fits-all design.
- **`UpdateTask` checks twice** — a base `task:write` (`:487`) plus a **per-transition** scope
  (`:538`), so a stage change costs more than a field edit. That is genuinely careful.
- **`WatchTasks` requires identity *before* scope** (`watch.go:23` then `:26`), with a comment
  explaining that server-side subscription state demands a real principal. Correct and documented.
- **`WhoAmI` takes its subject from the context, never the request** (`:1349`, `:1353`) — the property
  that makes an unscoped handler safe. Worth copying.
- **The skiplist is closed, short, exact-match and explicit** (`auth.go:102-109`) — no wildcards, no
  prefix matching, no external config. The good version of a bypass list.
- **The generated interface really is a compiler-enforced manifest**, and the receiver-grep really
  would have failed here (zero matches). The brief's method guidance was correct and load-bearing.

## RECOMMENDATIONS

1. **Fix F-1 before the `scopedeny-93` merge, or explicitly accept it.** The merge will harden the
   gRPC door and leave `/api/link/*` exactly as open as it is now — a widening relative gap, and one
   that gets harder to see once the gRPC surface reports clean.
2. **Assign D6 bound #5** (is `TokenAuthInterceptor` installed on every `grpc.NewServer`?). It is
   cheap, source-only, and it is the one bound that could invalidate all 30 CHECKS rows at once.
3. **Convert F-3 from convention to structure**: a `FullMethod` → required-scope registry consulted in
   the interceptor, defaulting to deny for unlisted methods.
4. **Re-run this classification against `origin/main` (`7a0f220`)** if the CI gate's result is to mean
   anything about published code (D6 #8).
5. **Attach a SHA to every file:line in this project's record.** The brief that produced this report
   was itself the failure case.

---

*Source-only audit; no build, no test execution, no repository modified. Report is the sole artefact
written. Findings delivered to `coordinator` only.*
