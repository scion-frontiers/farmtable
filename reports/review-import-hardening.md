# `import-hardening` @ `f487dc5` — Code Review (Round 2)

**Reviewer:** `farmtable-reviewer` **Date:** 2026-07-29
**Branch:** `import-hardening`, base `43bd206`, 5 commits, not pushed.
**Round 1 reviewed:** `2ff87d2` — REQUEST CHANGES (1 Required, 1 Nit, 4 FYI). Superseded by this file.
**Reviewer artefact:** every figure below was measured at `f487dc5` in a throwaway clone at
`/tmp/rev-ih2/ft` (`git clone --no-local`, detached HEAD). Not the developer's tree
(`/workspace/farmtable-import-hardening`), and not `/workspace/farmtable`, which is on another
agent's branch with a dirty tree and which I neither built nor tested in.
`git status --porcelain -uall` = 0 entries and `-uall --ignored` = 0 entries before the first
measurement and after the last; all scratch outside the repo except the mutation battery and one
scratch test, each removed and the restoration proven by `sha256sum -c` and by
`git write-tree` == `HEAD^{tree}` == `a579ea929979472019fa80d3b4e0490bb8af4397`.

## Executive Summary

Round 1's Required finding is discharged by a correction that is **true, not merely narrower**, and
the residual the EM flagged as outranking everything — that the restructured auth branch in
`cmd/farmtable-server/main.go` might select a different lookup than the code it replaced — is
**clean under measurement, not under reading**: 196 input combinations compared old predicate
against new switch, zero divergence, with both the permit and the deny arms exercised so the
comparison is not vacuous. Risk level: **LOW**. Verdict: **APPROVE**.

---

## Critical

None.

## Required

None.

Round 1's **R-1** ("a task-less import records no provenance at all"; the report's claim that
provenance covers 100% of rows the import writes was false as written) is **discharged**. The EM
ruled correct-the-claim-not-the-code, and my instruction was to verify the corrected sentence is
*true* rather than *narrower*. It is true.

The corrected sentence, `dev-import-hardening.md:239`:

> Provenance covers **100% of rows attached to tasks**. An import carrying **no tasks** writes
> **no provenance row at all**, while still creating a collection and users.

- **MEASURED:** at `f487dc5` in `/tmp/rev-ih2/ft`, `validateImportReferences`
  (`internal/server/export_import.go:689-724`) rejects every comment, relationship and change whose
  `TaskID` / `SourceTaskID` / `TargetTaskID` is absent from `taskMapping`, and `taskMapping`
  (`export_import.go:440-446`) is built solely from `doc.Tasks`. No row attached to a task can reach
  the store unless that task is created by this same import. The stamp loop
  (`export_import.go:571-580`) appends exactly one provenance row per element of
  `importParams.Tasks`, and `TestRPC_ImportCollection_StampsEveryImportedTask`
  (`export_import_provenance_test.go:476-512`) executes that at 4 tasks → 1 row each, PASS.
- **NOT MEASURED:** I did not re-execute the zero-task half of the sentence at `f487dc5`; that half
  is my own round-1 measurement at `2ff87d2` (zero-task document accepted, collection created, two
  users persisted, **0** provenance rows). The stamp loop and its `importParams.Tasks` key are
  unchanged between the two commits.
- **PRECONDITIONS:** the claim holds only while every task-attached row must reference an
  in-document task. Checked — that is enforced in `validateImportReferences` and nowhere else, so a
  future relaxation of that validator would silently falsify the sentence.

---

## THE RESIDUAL — auth-branch restructure in `cmd/farmtable-server/main.go`

Ruled ALLOW by the EM; not re-litigated. What I judged is the one thing left open: **does the
restructured branch select the same `lookup` as the code it replaced, for every input?**

**Yes. Zero divergence across 196 combinations.** This is the item the EM said would outrank
everything if it went the other way, so I converted "reading the diff" into an executed comparison.

- **MEASURED:** at `f487dc5` in `/tmp/rev-ih2/ft` I wrote a scratch test
  (`cmd/farmtable-server/zzz_review_residual_test.go`, since deleted) that re-implements the
  pre-`f487dc5` predicate verbatim — `if OPEN_ACCESS == "1" {nil} else if token == "" {nil} else
  {lookup}` — and compares its lookup decision against `openAccessCauseFor(...)` fed through main's
  new `switch` (`main.go:72-81`), over the cross product of 14 `FARMTABLE_OPEN_ACCESS` values × 14
  `FARMTABLE_TOKEN` values (`""`, `"1"`, `"0"`, `"true"`, `"TRUE"`, `"1 "`, `" 1"`, `"01"`, `"yes"`,
  `"secret"`, and others). Output: `RESULT: 196 combinations compared, all agree`.
- **MEASURED (anti-vacuity):** the comparison asserts both arms explicitly rather than only "they
  agree" — `(OPEN_ACCESS="", token="secret")` must yield a **non-nil** lookup (permit), and
  `(OPEN_ACCESS="1", token="secret")` and `(OPEN_ACCESS="", token="")` must each yield **nil**
  (deny). All three held. Without those, two identically-broken predicates would also have printed
  "all agree".
- **MEASURED:** cause mapping at the three live points — `("1", tok) → deliberate`,
  `("", tok) → unspecified`, `("", "") → missing_token`; and `openAccessCauseFor` treats only the
  exact string `"1"` as truthy (`main.go:182-191`), so `"true"` and `"TRUE"` do **not** disable
  auth, matching the base.
- **MEASURED:** `OpenAccessCauseUnspecified` is genuinely the zero value of the type
  (`internal/server/server.go:79`, `OpenAccessCause = ""`). `internal/cli/dashboard.go:83` depends
  on this — it declares `var openAccessCause server.OpenAccessCause` and assigns only in the
  open-access branch — so the dashboard's non-open-access path is correct **because** the zero value
  is Unspecified, not because anything assigns it.
- **NOT MEASURED:** I did not run the compiled `farmtable-server` binary against a live port and
  observe which interceptor it installed; the comparison is at the level of the two predicates and
  the variable they assign.
- **PRECONDITIONS:** the equivalence covers `lookup` at both of its consumers (`main.go:103-104`
  interceptors and `main.go:122` `TokenLookup:`) because both read the same variable. Checked:
  `lookup` is assigned in exactly one place in the new code (`main.go:79`).

**One structural consequence worth stating, because the restructure created it and the base did not
have it:** the auth mode is now derived from the cause value, so the `default:` arm of main's switch
handles any cause this code does not recognise — and `default:` is the arm that **installs the token
lookup**. A future cause value added without a matching `case` therefore fails **closed** (auth on),
not open. That is the right direction and worth keeping.

---

## Verification of the developer's evidence — checked, not inherited

### Arms M7–M11: all five reproduced independently

Run by me at `f487dc5` in `/tmp/rev-ih2/ft`, not inherited from the dev's `/tmp/arms`. Baseline
before the battery: both new refusal tests **PASS**. Every arm below **compiles**
(`go build ./...` rc=0) and goes RED **by a named assertion**, never by a build break.

| Arm | Mutation I applied | numstat | Result I observed | Dev's claim |
|---|---|---|---|---|
| **M7** | `switch cause` → `switch OpenAccessCause("")` in `unattributableImportMessage` (`export_import.go:162`) | `1 1` | wording test **RED** at `export_import_provenance_test.go:790`; invariance test **GREEN, all 4 subcases** | matches |
| **M8** | `if importerID == uuid.Nil` → `&& s.openAccessCause != OpenAccessCauseDeliberate` (`export_import.go:389`) | `1 1` | invariance test **RED** — `CANARY:` fired at `:700` on subcase `deliberate`; wording test also RED at `:770` | matches (2 tests) |
| **M9** | `const scope` loses the "embedded \`ft\` CLI is unaffected" clause (`export_import.go:159-160`) | `1 2` | wording test **RED in all 3 subcases**; invariance test GREEN | matches |
| **M10** | `WithOpenAccessCause` → `func(s *FarmTableService) { _ = c }` (`server.go:91`) | `1 1` | wording test **RED** (`deliberate` subcase); invariance GREEN | matches |
| **M11** | `openAccessCauseFor`: `token == ""` → `Deliberate` (`main.go:186-187`) | `1 1` | `TestOpenAccessCauseForMapsEveryConfiguration` **RED**, 2 of 6 subcases, assertions at `main_test.go:117` | matches |

**The M7/M8 disagreement holds, and it is the strongest piece of evidence on this branch.**

|  | M7 (message ignores cause) | M8 (cause grants passage) |
|---|---|---|
| `RefusalMessageNamesTheCause` | RED | RED |
| `RefusalDoesNotDependOnOpenAccessCause` | **GREEN** | **RED** (`CANARY:`) |

The reasoning the EM asked me to test is sound, and I now hold it as measurement rather than
argument. M7 staying green is a **pass condition**: an invariance test that reddened when only the
*wording* changed would be coupled to text, and its claim to pin an outcome would be false. M8 is
what earns the invariance test its place — against an unconditional refusal it passes trivially, and
a trivially-passing test is indistinguishable from a vacuous one until the defect it exists to catch
is actually introduced. M8 introduces exactly that defect (one cause becoming a reason to let an
unattributable import through) and the canary fires, on the right subcase, with a message naming
what was violated. I could not construct a version of this pair that would look the same if the
invariance test were vacuous.

One methodological note, in the developer's favour: an arm caught a *methodological* error of mine
mid-battery. My first M11 patch did not apply — the source was gofmt-aligned differently than my
pattern assumed — and the run came back all-PASS. Read carelessly that is "M11 is a survivor, the
mapping test is vacuous". It was a no-op mutation. `git diff --numstat` after each patch is what
caught it; the corrected patch reddened the test immediately. **A zero-diff mutant reports on your
patch, not on the test** — the same error class as the dev's non-compiling arms, from the other side.

### Req 1 (refusal fires pre-flight, zero rows written) — still holds at `f487dc5`

- **MEASURED:** `ImportCollection` (`export_import.go:363-...`) touches the store in exactly two
  places — `s.resolveImportUsers(...)` at `:475` and `s.store.ImportCollection(ctx, importParams)`
  at `:589`. `resolveImportUsers` (`export_import.go:728-...`) issues only `GetUserByEmail`; its
  `usersToCreate` is an in-memory slice handed to the single write. The refusal returns at `:390`,
  before both. Grep for `s.store.` within the function body returns those two lines and no others.
- **MEASURED:** the round-2 diff of this function is two hunks (the message call, and the
  `json.Marshal` error drop). Neither moves a store call or the refusal.
- **MEASURED (behaviourally, and this is new evidence):**
  `TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause`
  (`export_import_provenance_test.go:677-715`) snapshots `ListCollections` before and after each
  refused call and fails if the count moves; it passes for all four causes. That is a
  zero-rows-written assertion, not an "it returned an error" assertion.
- **NOT MEASURED at `f487dc5`:** the round-1 row-level count across users/changes/comments after a
  refused import. Not re-run; the structural argument is unchanged and the collection-count
  assertion is new evidence in the same direction.
- **PRECONDITIONS:** the guarantee is "no write before the refusal", which depends on
  `resolveImportUsers` staying read-only. Checked at `f487dc5`; it is.

### The EM's figures — all confirmed at `f487dc5`, in my clone

`go list ./...` **32 packages** (stderr captured to a separate file, not `/dev/null`; it was empty) ·
`go build ./...` rc=0 · `go vet ./...` rc=0 · `go test ./...` **ok=10, no-test-files=22, FAIL=0,
total=32**, stderr 0 bytes, re-run after the arm battery with the same result ·
`gofmt -l` **0 unformatted** across all **7** changed `.go` files (a superset of the 6 the dispatch
named) · `.github/expected-go-tests.txt` **507 → 510 rows**, `git diff --numstat` = **`3	0`**,
zero deletions, prior 507 lines byte-for-byte and in the same order, file fully sorted ·
membership gate **510 rows in the manifest = 510 test functions executed by `go test`**,
0 MISSING, 0 UNEXPECTED.

The `3	0` numstat is the figure the EM cared most about, and it is the right thing to care about: it
is mechanical proof the manifest was appended to rather than regenerated. A regeneration that
happened to produce the same 510 rows would still show deletions.

---

## Nit / Optional

### N2-1 (Nit) — the "unspecified" refusal *does* name a knob, and its own comment says it must not

`internal/server/export_import.go:172-176`; test comment at
`internal/server/export_import_provenance_test.go:753-758`.

- **MEASURED:** the `default:` arm returns `"... Enable authentication (set FARMTABLE_TOKEN) and
  retry as an authenticated user."` The wording test's unspecified subcase comments *"No knob is
  known, so it must not guess at one"* and then asserts `wantAll: []string{"FARMTABLE_TOKEN"}`. Both
  read at `f487dc5`. The dispatch's summary ("unspecified stays generic and guesses at no knob") is
  therefore not accurate as written.
- **NOT MEASURED:** whether any shipped wiring can deliver `Unspecified` *together with*
  `importerID == uuid.Nil`. I reasoned it cannot — main's `default:` arm installs a lookup, the
  dashboard sets `Deliberate` in its only open-access branch, and the embedded CLI always
  authenticates — but I did not execute a configuration that produces it outside tests.
- **PRECONDITIONS:** the advice becomes actively wrong only if some future site is open-access
  without setting a cause *and* `FARMTABLE_TOKEN` is already set. Not checked, because no such site
  exists at `f487dc5`.
- **Move:** keep the text — generic-but-actionable beats generic-and-useless — and fix the comment
  to say what the text does: *no cause was supplied, so it names the variable that enables auth on
  every shipped binary rather than guessing at a cause*. The mismatch matters because that comment
  is what the next person will trust when deciding whether the default arm may name a knob.

### N2-2 (Nit) — the `missing_token` wording subcase cannot tell its own arm from `default`

`internal/server/export_import_provenance_test.go:745-752`.

- **MEASURED:** under M7 — which forces *every* cause through the `default:` arm — only **1 of 3**
  wording subcases went RED (`deliberate`). `missing_token` and `unspecified` both **PASSED**,
  because the default text also contains `FARMTABLE_TOKEN` and does not contain
  `FARMTABLE_OPEN_ACCESS=1`, which is exactly what those two subcases assert.
- **NOT MEASURED:** nothing inferred; this is the arm's own subtest output.
- **PRECONDITIONS:** it bites if the `OpenAccessCauseMissingToken` case is ever deleted or falls
  through. Checked — M7 *is* that scenario, and the subcase stayed green.
- **Move:** assert a phrase unique to that arm, e.g. `wantAll: []string{"FARMTABLE_TOKEN is not
  set"}`. That string appears only in the MissingToken branch and is already used as a `wantNone` on
  the deliberate subcase, so the two subcases would become genuine mutual controls.

Non-blocking, and I want to be explicit about why rather than hedging: a fall-through to `default`
still tells the operator to set `FARMTABLE_TOKEN`, which is the correct action in the state that
produces MissingToken. The loss is diagnostic precision, not correctness. But it is the same shape
as round 1's finding — a table-driven test showing one green line while a subcase carries no
discriminating power — one level further down, and worth fixing while the pattern is fresh.

---

## FYI

### F2-1 — no test starts `main()`: reading **is** sufficient here, and this is why

The disclosure is accurate: `openAccessCauseFor` is pinned (`main_test.go:88-118`) and
`WithOpenAccessCause` is pinned (through the two refusal tests), but the lines joining them —
`main.go:72`, `:73-81`, `:106`, and `dashboard.go:83`, `:86`, `:97` — execute in no test.

I judge reading sufficient, on three grounds, one of which is not a reading argument at all:

1. **The highest-risk part is not read, it is measured.** The failure that would matter — the
   restructure changing which lookup gets installed — is the residual above, compared mechanically
   over 196 combinations. What remains unexecuted is branch-free assignment.
2. **The worst case of the remaining gap is bounded, and it is not behavioural.** If
   `WithOpenAccessCause(openAccessCause)` were dropped from `main.go:106` — the one mistake here
   that compiles silently — the service would fall to `Unspecified` and emit the generic message. It
   would still refuse, with the correct code, and still name a real knob.
   `RefusalDoesNotDependOnOpenAccessCause` is what makes that bound true rather than hopeful: no
   cause value, including one nobody has written, can change the outcome. I reddened that test
   myself (M8) to confirm the bound is enforced and not merely asserted.
3. **A test that started `main()` would measure something else.** It would need a port, a store, a
   signal handler and a teardown, and would be reporting on process startup. The honest unit here is
   the pure function, and it is tested.

The residual risk I am accepting: a wrong-variable or dropped-option edit across six lines that the
compiler will not catch. That is a code-review-scale risk, and it has now had one.

### F2-2 — 6 of 9 provenance tests are not oracle-first; accepted for this branch, with the limit named

The three tests added at `f487dc5` were written after the code, and their RED evidence is arms
M7–M11 rather than commit order. I reproduced **all five** of those arms myself, so each of the three
new tests has at least one arm, run by me, that reds it by assertion at a named line. On that basis
the weaker standard is discharged *for these tests*.

The limit is worth stating plainly rather than waving through: an arm battery proves a test can fail
for defects **the author thought of**. Oracle-first additionally proves the test was written before
the answer was known, which is the part that catches a test shaped to the implementation. N2-2 is a
small instance of exactly that gap — a subcase shaped to text the author had already written, which
no arm in the dev's own battery was aimed at. Not a reason to block; a reason not to let 6-of-9
become 9-of-9 on the next branch.

### F2-3 — `dashboard.go` depends on `OpenAccessCauseUnspecified` being the zero value

**MEASURED:** it is (`internal/server/server.go:79`). **NOT MEASURED:** nothing.
**PRECONDITIONS:** changing that constant to a non-empty string would silently change the
dashboard's cause (`internal/cli/dashboard.go:83`) with no compile error and no failing test.
Currently correct; no action.

### F2-4 — N-1 (round 1) was taken, and taken the right way

`json.Marshal` on a five-string struct cannot fail, so the `codes.Internal` guard was unreachable —
the same dead-control shape as the export-side strip the dev had already found and deleted. The
error is now discarded with a comment stating the precondition *and* naming the trigger for
restoring the check ("if a non-string field is ever added"). That is the version of this change that
survives contact with the next editor.

### F2-5 — auth-architecture boundary

Nothing on this branch alters WHO IS AUTHENTICATED, WHAT THEY MAY DO, or HOW THAT IS DECIDED.
`OpenAccessCause` is plumbed from wiring to handler and consumed only by
`unattributableImportMessage`; the invariance test pins that it can never select an outcome, and I
reddened that test myself to confirm the pin is real. `internal/server/scopes.go` is untouched and
was not reviewed. Reported for your record, not raised as a question.

---

## Positive Feedback

**The `newControl bool` guard is the best thing on this branch.** Round 1's finding was that a
table-driven test claimed three subcases of evidence for a control only one of them reaches. The fix
could have been a comment. Instead `export_import_provenance_test.go` counts the subcases flagged
`newControl` and fails the run if the count is ever anything but 1 — so the attribution has to stay
true to keep the suite green. That converts a claim in prose, which drifts silently, into a claim
the build enforces. It is a mechanism, not a wording fix, and it generalises to every table-driven
test in this repo that mixes new controls with base regression guards.

**Deriving the auth branch from the cause rather than computing the cause alongside it** was the
right call, and it is the reason the residual was checkable at all. Two copies of one decision, free
to drift, would eventually produce a diagnostic that contradicts the mode it describes. One source
of truth reduced the whole question to a 196-row equivalence check.

**The refusal message reads like a deliverable, which is what it is.** It says what was refused,
why, which knob to turn, and — the load-bearing clause — that the embedded `ft` CLI is unaffected.
That clause is not decoration: the local CLI genuinely cannot hit this refusal, and a message that
read like a global breakage would send local users chasing a fault that does not exist. M9 confirms
all three subcases die without it, so it is pinned, not merely present.

---

## Test Coverage

New code paths are covered. Nine provenance tests, three added this round; the manifest gate carries
all of them (`3	0`, no deletions). The two new server-side tests are non-vacuous under arms I ran
myself, and the pure mapping function has a six-case table including the non-canonical-truthy cases
(`"true"`, `"TRUE"`) that a naive truthiness check would get wrong.

Gaps, both non-blocking and both stated above: the `main()`/`dashboard.go` wiring lines (F2-1), and
the `missing_token` wording subcase's lack of discriminating power (N2-2).

## Backward Compatibility

No proto change, no codegen, no wire-format change, no removed field. `OpenAccessCause` is a new
exported type whose zero value means "nothing was said", so existing `NewFarmTableService` call
sites that pass no option behave exactly as before — verified at `internal/cli/connect.go` (embedded
and passthrough, neither of which passes the option).

The one behavioural change to a shipped artefact remains from round 1 and is settled policy, not a
finding: `farmtable-server` running open-access — deliberately, or with `FARMTABLE_TOKEN` merely
unset — now returns `FailedPrecondition` from `ImportCollection`. The embedded `ft` CLI is
unaffected.

## Final Verdict

**APPROVE.**

No Critical, no Required. The residual is clean under measurement. N2-1 and N2-2 are worth a cleanup
pass and neither blocks merge; N2-2 is the one I would actually spend the five minutes on, because
it repairs a control rather than a sentence.
