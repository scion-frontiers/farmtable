# 2026-07-29 — Import audit-trail hardening: forged and backdated change rows

**Type:** security fix (defect 1) + measurement only, no code changed (defect 2)
**Branch:** `import-hardening` @ `9f5fadb`, based on `43bd206`. **Not pushed.** **APPROVED at `f487dc5`**;
`9f5fadb` lands the two round-2 nits.
**Measured at:** `9f5fadb`, from a **fresh checkout of the commit**, not a development tree.
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
failure messages begin `CANARY:` and state what they protect. **One** of its three subcases is
evidence for the new refusal; the other two are base regression guards that passed before this
change existed. Claiming all three inflated the apparent evidence 3× while every subcase genuinely
passed — invisible until someone asked which branch each one reaches. The test now enforces the
attribution at runtime instead of asserting it in prose.

**Consequence, and it needs a binary named — "the container" is ambiguous here.** There are two
Dockerfiles and four sites constructing this service, and they do not behave alike:

| Artefact | Import reachable? | Open-access possible? | Effect |
|---|---|---|---|
| `farmtable-server` (`Dockerfile.server`, **the live service**) | yes | yes — `FARMTABLE_OPEN_ACCESS=1` **or `FARMTABLE_TOKEN` merely unset** | **import refused there** |
| `ft dashboard` (`Dockerfile`) | yes | only via explicit `FARMTABLE_OPEN_ACCESS=1` | import refused in that config |
| `ft` embedded (`connect.go:169`) | yes | **no** — lookup unconditional, `ensureLocalUser` first | **unaffected; `ft collection import` keeps working** |
| `ft` passthrough (`connect.go:306`) | no | yes (no interceptor) | not observable — store returns `ErrNotImplemented` |

**The refusal names the knob that caused it.** Saying only "no identity" leaves an operator
guessing between two unrelated variables, so the message now names `FARMTABLE_OPEN_ACCESS` or
`FARMTABLE_TOKEN` according to which one produced the state — and says that only collection import
is affected and the embedded `ft` CLI is not, because a refusal that reads like a global breakage
sends local users chasing a fault that does not exist.

The cause is plumbed **at wiring time**, never `os.Getenv` in the handler: the handler cannot tell
the two causes apart (both arrive as `(uuid.Nil, nil)`), it would be untestable through the service
API, and it would be wrong for the embedded path, which reads the same environment but is never
open-access. The env→cause mapping is a pure function and is now the single source of truth for
main's auth-mode branch, so the diagnostic cannot drift from the mode it describes.

**The risk in plumbing a value from the wiring site is that it acquires authority nobody granted
it** — some cause becoming a reason to let an unattributable import through, now or in a later
edit. `TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause` pins the invariant across
every cause including an unrecognised one: the cause selects **words**, never an **outcome**. That
is also what keeps the change on the "consumes the auth answer" side of the boundary test.

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
  twelve mutation arms first came back RED with **zero failing assertions** — both were build
  breaks from orphaned variables and an unused import. Redone as *compiling* mutations, both went
  RED genuinely. `go test` reports build failure and assertion failure identically.
- **A vacuous mutation arm is sometimes a report that the control itself is unreachable.** Two
  arms came back GREEN. One was a bad oracle (every payload timestamp was `now`, so substituting
  it was undetectable). The other was a **bad fix**: I had stripped provenance from exports to
  guard against a nil-UUID author that the identity refusal had already made impossible. Dead
  code defending a vanished scenario — which is exactly why no test could kill it. Removed.
- **A correct measurement can still produce a false claim one step later.** Measured, and true:
  import only ever CREATES — `taskMapping` has 1 write (`export_import.go:318`, `uuid.New()`) and
  10 guarded reads; the store transaction uses only `tx.X.Create()`, negative-control grep for
  `OnConflict|Upsert|tx.*.Update` returns zero. What I then *wrote* was that provenance "covers
  100% of rows the import writes." **False.** It covers 100% of rows **attached to tasks**; an
  import carrying no tasks writes no provenance row at all, while still creating a collection and
  users. The denominator I verified was tasks; the denominator I reported was rows. Caught in
  review, not by me. Code unchanged here — scope frozen, gap filed by the EM as A14.
  **The class, and it is the sharpest one collected today:** *I verified a denominator of tasks and
  reported a denominator of rows. That is harder to catch than a wrong figure, because every
  supporting number stays correct.* Same family as a corruption that leaves the text readable —
  nothing is false, nothing goes red, the reader draws the wrong conclusion. No check can trip,
  because the defect is in the join between a verified quantity and the noun attached to it.
  Three of five review findings on this branch shared that shape, which makes it a pattern in the
  WRITING step, not five slips — so the remedy is a habit, not five edits: **name the unit in the
  same sentence as the number.** Not "510" but "510 rows in the manifest at `f487dc5`". This is the
  artefact rule from earlier today applied one level down, to the unit instead of the binary, and
  for the same reason: the bare sentence is the part that travels, stripped of what made it true.
- **Two standing rules were contradicted by measurement and both were withdrawn**: the manifest
  gate is deliberately asymmetric (MISSING fails, UNEXPECTED is a notice), and `go vet`/`go build`
  became usable at `43bd206`. *A standing rule is a measurement with an expiry nobody wrote down.*
- **A clean instrument does not tell you it is pointed at the wrong artefact.** My headline claim
  — "import refuses open-access mode" — was measured perfectly and named no binary, in a repo with
  two Dockerfiles and four service-construction sites. The answer differs per artefact, and the
  bare sentence is the part that travels. State the artefact in the same sentence as the result.
- **An arm that turns everything red proves less than one that turns red exactly what it should.**
  Of the twelve arms, the informative pair is M7/M8 on the new diagnostic plumbing. M7 (message
  ignores the cause) *must leave* the outcome-invariance test GREEN, or that test is reacting to
  wording rather than to behaviour. M8 (a cause allowed to grant passage) *must turn it RED*, and
  does — that arm is the only reason the invariance test is not vacuous, since it otherwise passes
  merely because the refusal is currently unconditional.
- **A test can be present, executing, and measuring nothing.** Review nit N2-2: the missing-token
  wording subcase asserted `"FARMTABLE_TOKEN"`, a substring the *generic fallback* also contains,
  so it could not distinguish its own branch from the fallback — green whether the code was right
  or wrong. It survived arm M7, the arm built precisely to catch a message that ignores its cause,
  and I banked M7 as evidence anyway. Fixed by asserting the phrase unique to that branch
  (`"FARMTABLE_TOKEN is not set"`) and **demonstrated** by re-running M7: PASS at `f487dc5`, FAIL at
  `9f5fadb`. *A fix to an inert assertion that you cannot show reddening is just a reworded inert
  assertion.* The reviewer's framing: this is round 1's finding recurring one level down, at subcase
  level — **a correction scoped to the instances in front of you is the original defect one level
  up** — and **an arm battery only covers defects the author imagined.**
- **A ZERO-DIFF MUTANT REPORTS ON YOUR PATCH, NOT ON THE TEST.** The reviewer's first M11 patch
  silently failed to apply on gofmt alignment and returned ALL-PASS, which read carelessly is
  "M11 is a survivor" — a false negative shaped exactly like the result you were hoping for. Third
  independent instance today of a vacuous mutation nearly being banked as evidence. Now a standing
  rule: **numstat after every patch, before reading any result.**
- **Retire a predicate by measured equivalence, not by reading it.** The reviewer retired one by
  enumerating 196 combinations (14 × 14 env states) with the permit arm and *both* deny arms
  asserted explicitly, so "all agree" could not itself be vacuous — then verified the tree left no
  residue by matching `write-tree` against `HEAD^{tree}`.
- **Predictions for CI are pre-registered in the report** (section 4b), written before EM-CI's
  runner can adjudicate, so no result can be quietly reconciled after the fact.

## Not fixed, deliberately

`internal/server/scopes.go` is gofmt-dirty (pre-existing at `faf1c8c`). It is **the auth file**,
out of scope project-wide, with an architect holding that area. A gofmt-only touch would read in
a diff exactly like a hardening track quietly editing the scope table. Six other files are
gofmt-dirty at `43bd206`; there appears to be a vet gate but no gofmt gate. Flagged, not touched.

## Round 3 — `f3b6efa`: a pinned falsehood

The finding worth carrying off this branch is not the fix, it is the shape of the miss.

The import refusal message told operators *"the embedded `ft` CLI is unaffected because it
always authenticates locally."* True of `internal/cli/connect.go:169`. **False of the `ft`
binary**: `ft dashboard` honours `FARMTABLE_OPEN_ACCESS=1`, leaves the token lookup nil, passes
`OpenAccessCauseDeliberate` at `internal/cli/dashboard.go:97`, and hits that exact refusal.
`Dockerfile` CMD is `["/ft","dashboard"]` — the operator most likely to read the message is the
one it misinforms.

**My report's vocabulary does not ship.** In the report, "embedded `ft` CLI" named one
construction site and the claim was correct. In a gRPC error string it names the binary the
operator typed. The sentence never became false; it was only ever true under a reading the
audience does not have. Precision inside an analysis does not survive being copied into
user-facing prose.

**Fourteen mutation arms could not find it.** Arm M9 deleted that sentence and correctly
reddened all three wording subcases — it was among the best-pinned strings on the branch.
Presence and truth are orthogonal, and a mutation battery only measures presence. **A pinned
falsehood is worse than an unpinned one, because the suite now defends it**: whoever notices it
next gets a red build and reasonable grounds to think they were mistaken.

Fix: delete the clause, keep only what is unconditionally true. A narrower replacement
exemption was declined — it would be new unpinned prose making configuration claims, and this
defect is the evidence that those go wrong. New arm
`TestRPC_ImportCollection_RefusalDoesNotDisclaimTheFtBinary` asserts the message is *true* in
the dashboard-open-access configuration; RED before, GREEN after. Arm M12 (revert the fix)
reddens only that test and leaves the wording test green — the blindness, reproduced on demand.

**Transferable rule:** before adding a substring to an invariant list, name the test that
asserts it is *true* in the configuration it describes. If there is none, you are pinning a
claim, not verifying one.

Two instrument failures caught by guards rather than by judgement, both worth repeating:
a zero-diff mutant (M12 first run against uncommitted state that `git checkout --` had silently
reverted — it printed a convincing RED from code where the defect was never fixed), and a
non-compiling arm (Perl `.` where Go needs `+`). Anchor arms to a **committed** tip; numstat
after every patch, before reading any result.
