# 2026-07-29 — Import audit-trail hardening: forged and backdated change rows

**Type:** security fix (defect 1) + measurement only, no code changed (defect 2)
**Branch:** `import-hardening` @ `2ff87d2`, based on `43bd206`. **Not pushed.**
**Measured at:** `2ff87d2`, from a **fresh checkout of the commit**, not a development tree.
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/dev-import-hardening.md`
**Related:** `2026-07-29-absence-as-permission.md` — same habit, same architect owns the sequel.

## Why this exists

`ImportCollection` let a caller write audit history **attributed to another user** and **dated to
any instant they chose**, with nothing recording who actually performed the import.

`resolveImportUsers` binds payload-supplied change and comment rows to a **real existing
account's UUID** by matching the payload email against `GetUserByEmail`. `created_at` was taken
verbatim from the payload. `RequireIdentity` was called and its result discarded into `_`.

The wildcard scope does not excuse this. A wildcard lets a principal act as **themselves** with
full permission. It does not entitle them to author history attributed to a **different** user,
nor to choose a timestamp. Impersonation and backdating are privileges nobody legitimately holds.

## What changed

Every imported task now carries a server-authored change row under the reserved field name
`server:import_provenance`, recording the authenticated importer and the server's own ingestion
time. Four properties, each pinned by a test:

- **Unforgeable.** Payload rows in the `server:` namespace are dropped with a warning. Without
  this the remedy would itself be a forgery vector — an attacker could plant a provenance stamp
  naming somebody else.
- **Non-destructive.** The payload's timestamps are **preserved, not overwritten**. Historical
  imports legitimately carry historical timestamps. The claim is stored alongside the server's
  stamp so the two are always distinguishable.
- **Visible.** Surfaced through the shipped `ListChanges → changeToProto` read path and in
  `ExportCollection` output. **No proto change, no codegen** — `buf`/`protoc`/`protoc-gen-go` are
  absent and the Makefile (13–17) records that generator versions are pinned nowhere in this repo.
- **Loud on absent identity.** Import now **refuses** a caller it cannot identify.

## The part most worth remembering

My first implementation recorded `authenticated: false, imported_by: ""` in open-access mode and
carried on. That is a **fourth instance of the exact habit** catalogued in
`2026-07-29-absence-as-permission.md` — absence read as permission — planted by us, **inside the
remedy for it**. The fix for a class is the likeliest site of a fresh instance of it.

Both of `RequireIdentity`'s absent-identity outcomes are now hard failures: a returned error
propagates, and `(uuid.Nil, nil)` in open-access mode becomes `FailedPrecondition`. The import
never writes `""`, `"unknown"`, `"system"` or a zero UUID. There is no degraded state to
interpret because none exists — the earlier draft's `Authenticated` field was deleted outright
rather than defaulted. Guarded by `TestRPC_ImportCollection_RefusesImportWithoutIdentity`, whose
failure messages begin `CANARY:` and state what they protect.

**Consequence, and it needs a binary named — "the container" is ambiguous here.** There are two
Dockerfiles and four sites constructing this service, and they do not behave alike:

| Artefact | Import reachable? | Open-access possible? | Effect |
|---|---|---|---|
| `farmtable-server` (`Dockerfile.server`, **the live service**) | yes | yes — `FARMTABLE_OPEN_ACCESS=1` **or `FARMTABLE_TOKEN` merely unset** | **import refused there** |
| `ft dashboard` (`Dockerfile`) | yes | only via explicit `FARMTABLE_OPEN_ACCESS=1` | import refused in that config |
| `ft` embedded (`connect.go:169`) | yes | **no** — lookup unconditional, `ensureLocalUser` first | **unaffected; `ft collection import` keeps working** |
| `ft` passthrough (`connect.go:306`) | no | yes (no interceptor) | not observable — store returns `ErrNotImplemented` |

The local CLI is safe; the exposure is the deployed server. The condition being refused is
**already catalogued as S1/S2** in `2026-07-29-absence-as-permission.md` — I did not rediscover it
and am not re-counting it. If production runs without `FARMTABLE_TOKEN`, import there now returns
`FailedPrecondition`. Whether that is the correct refusal or a deployment gap is an auth-side
decision about what identity such a deployment presents — not a decision to write "unknown" into
audit history. Routed, not decided.

## Scope boundary

Audit-trail integrity was classified as belonging to this track. Test applied: *does the change
alter WHO IS AUTHENTICATED, WHAT THEY MAY DO, or HOW THAT IS DECIDED?* This change **consumes**
that answer and writes an audit record with it; it alters none of the three. It encodes no
assumption about the identity model beyond *there is a caller and it has an id*. Reverts to
report-only on the auth architect's word.

## Defect 2 — unvalidated imported `users.type` — LIVE

`ImportCollection` writes `users.type` straight from the payload with **no validation at any
layer**; `root`, `Admin`, `service-account`, `reviewr`, `""` all persist.

The owner directed that the auth architecture be left as-is; this finding was measured and
transmitted to the auth design owner, `farmtable-architect-auth`. **It is LIVE.** No validator
was added and no type handling was touched.

Three `SetType` sites exist in `ImportCollection`, all import-reachable, writing **three
different columns** — only one is the defect:

| Site | Column | Validation | Verdict |
|---|---|---|---|
| `entstore.go:2102` | `users.type` | none, any layer | **the defect — LIVE** |
| `entstore.go:2139` | `tasks.type` | none | not a defect — freeform *by design*, `proto/farmtable.proto:309-311` |
| `entstore.go:2219` | `relationships.type` | ent `Enum` + `parseRelationshipType` ×2 | already safe |

A three-test oracle for this was written, went **RED at `6dbfc8c`**, and was then **removed —
not skipped**. A skipped test asserting "unknown types must be rejected" still encodes a design
decision, and that decision belongs to the architect, who has not made it. Full source is
preserved verbatim in the report and recoverable via
`git show 6dbfc8c:internal/server/export_import_provenance_test.go`.

## Method notes that generalise

- **A mutation that does not compile proves the compiler works, not that the test works.** Two of
  seven mutation arms first came back RED with **zero failing assertions** — both were build
  breaks from orphaned variables and an unused import. Redone as *compiling* mutations, both went
  RED genuinely. `go test` reports build failure and assertion failure identically.
- **A vacuous mutation arm is sometimes a report that the control itself is unreachable.** Two
  arms came back GREEN. One was a bad oracle (every payload timestamp was `now`, so substituting
  it was undetectable). The other was a **bad fix**: I had stripped provenance from exports to
  guard against a nil-UUID author that the identity refusal had already made impossible. Dead
  code defending a vanished scenario — which is exactly why no test could kill it. Removed.
- **Import only ever CREATES**, measured not inferred: `taskMapping` has 1 write
  (`export_import.go:318`, `uuid.New()`) and 10 guarded reads; the store transaction uses only
  `tx.X.Create()`, with a negative-control grep for `OnConflict|Upsert|tx.*.Update` returning
  zero. So task-level provenance covers 100% of rows.
- **Two standing rules were contradicted by measurement and both were withdrawn**: the manifest
  gate is deliberately asymmetric (MISSING fails, UNEXPECTED is a notice), and `go vet`/`go build`
  became usable at `43bd206`. *A standing rule is a measurement with an expiry nobody wrote down.*
- **A clean instrument does not tell you it is pointed at the wrong artefact.** My headline claim
  — "import refuses open-access mode" — was measured perfectly and named no binary, in a repo with
  two Dockerfiles and four service-construction sites. The answer differs per artefact, and the
  bare sentence is the part that travels. State the artefact in the same sentence as the result.
- **Predictions for CI are pre-registered in the report** (section 4b), written before EM-CI's
  runner can adjudicate, so no result can be quietly reconciled after the fact.

## Not fixed, deliberately

`internal/server/scopes.go` is gofmt-dirty (pre-existing at `faf1c8c`). It is **the auth file**,
out of scope project-wide, with an architect holding that area. A gofmt-only touch would read in
a diff exactly like a hardening track quietly editing the scope table. Six other files are
gofmt-dirty at `43bd206`; there appears to be a vet gate but no gofmt gate. Flagged, not touched.
