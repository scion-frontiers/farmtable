# import-hardening @ `f487dc5` — Code Review, round 3

# VERDICT: **REQUEST CHANGES**

**Reviewer:** code-reviewer leg
**Artefact under review:** commit `f487dc566dc9f6b89255d15501a8c4111338c4ec` (`f487dc5`), base `43bd20627e0b07c50f113fda266117d419a9b4ad` (`43bd206`), 5 commits.
**Measurement instrument:** private clone at `/workspace/farmtable-review-ih-r3`, cloned `--local` from `/workspace/farmtable`, never from a network remote. Nothing was pushed. `/workspace/farmtable/web/dist` was not touched.
**Branch ref in the source repo:** `refs/salvage/farmtable-import-hardening/import-hardening` = `f487dc5`. There is no `refs/heads/import-hardening`; a bare `git rev-parse import-hardening` returns exit 128 in that repo. Recorded because it is the kind of lookup that fails quietly for the next reader.

## Executive Summary

Risk level: **LOW**. The code on this branch is good — the provenance control, the diagnostic-cause plumbing, and the test battery are all sound, and the gate is genuinely green at `f487dc5` by my own independent replication. **REQUEST CHANGES** is driven by one user-facing correctness defect inside the diff (the refusal message asserts something false about the `ft` binary in a configuration the author's own report documents as reachable) and by three surviving instances of round 2's dominant defect class in the evidence that accompanies the change.

Four of the five round-1/round-2 items are discharged as claimed. The fifth (**REQ 2**) is implemented, well-designed, and well-tested — but its user-facing string is wrong in one reachable case.

---

## Answers to the four commissioned checks

### CHECK 1 — "The manifest was not regenerated"

**Non-regeneration: CONFIRMED, and confirmed harder than the developer claimed. The developer's stated *evidence* for it is scoped to the wrong reference point.**

`git diff --numstat` against the base, at `f487dc5`:

```
9	0	.github/expected-go-tests.txt
```

**ZERO DELETIONS.** That is the answer to the question you asked, and it holds. But the number of additions against the base is **9, not 3**.

Per-commit, so nothing is pooled (each figure is rows in `.github/expected-go-tests.txt`):

| Commit | numstat on the manifest | Total manifest rows at that commit |
|---|---|---|
| `43bd206` (base) | — | **501 rows** |
| `6dbfc8c` | no change | 501 rows |
| `a809849` | no change | 501 rows |
| `33f59e8` | no change | 501 rows |
| `2ff87d2` | `6	0` | **507 rows** |
| `f487dc5` | `3	0` | **510 rows** |
| **base → head** | **`9	0`** | **501 → 510 rows** |

So:

- The developer's "**3 additions, 0 deletions**" is **true only for the range `2ff87d2..f487dc5`**, i.e. the last commit alone. It is not the branch figure.
- Your framing "this manifest moved 507 → 510 during the branch" is **also not right**: the branch moved it **501 → 510 rows**. 507 is an intra-branch waypoint at `2ff87d2`. (Struck and corrected in place per your instruction — see **Finding R3-2**, which is about the report making the same slip.)
- **Zero deletions at every single commit**, not just net. This matters for exactly the reason you gave.

**NAMING THE ADDED ROWS INDIVIDUALLY.** You asked for three; against the base there are nine. All nine, with the commit each arrived in:

Added at `2ff87d2` (6 rows):
1. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ExportCollection_CarriesImportProvenance`
2. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ImportCollection_PayloadCannotForgeProvenance`
3. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ImportCollection_ProvenanceNeverNamesAPlaceholder`
4. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ImportCollection_RefusesImportWithoutIdentity`
5. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ImportCollection_StampsEveryImportedTask`
6. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ImportCollection_StampsImporterProvenance`

Added at `f487dc5` (3 rows — these are the three the developer meant):

7. `github.com/farmtable-io/farmtable/cmd/farmtable-server	TestOpenAccessCauseForMapsEveryConfiguration`
8. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause`
9. `github.com/farmtable-io/farmtable/internal/server	TestRPC_ImportCollection_RefusalMessageNamesTheCause`

**Two stronger proofs of non-regeneration than numstat, both run at `f487dc5`.** Numstat can in principle be satisfied by a rewrite that happens to net out; these cannot.

- **Set-wise.** `comm -23` of the 501 sorted base rows against the 510 sorted head rows returns **empty**. Every base row survives.
- **Order-wise.** `diff` of the base file against the head file emits **0 `<` lines** — the 501-row base file is a strict *subsequence* of the 510-row head file. Rows were inserted in sorted position; nothing was moved, rewritten, or reordered.

**The displacement scenario you were worried about is independently ruled out.** Across `43bd206..f487dc5`, Go source adds exactly **9 new `Test` functions** and removes **0**:

```
=== new test funcs base..head ===   9
=== removed test funcs base..head === (end)   0
```

9 new test functions, 9 new manifest rows, 0 removed of either. An added test cannot have displaced a listed one because nothing was removed on either side of the ledger.

**Overlap with the other track's 45-executed-but-unlisted set, measured against an older 503-row manifest — I CAN tell, and the answer is NO OVERLAP.** I did not pool the numbers.

The 503-row manifest exists in this repository's history. It is `b54c573` ("Merge main (43bd206) and register the two conjunct-A tests in the manifest"). Measured:

- `b54c573`'s manifest blob is the **same 501-row blob** as base `43bd206` (`git rev-parse` on both paths returns the identical blob `e102430df5ec851fef27ca4d9aff61ea1c76e866`) plus exactly two rows: `TestConjunctA_ImportAcceptsFarmtableAndStoresItAsFarmtable` and `TestConjunctA_ImportRejectsNonFarmtableCollection`. 501 + 2 = 503 rows.
- `comm -12` of my branch's 9 added rows against `b54c573`'s 503 rows returns **empty**. Zero overlap.
- `b54c573`'s tree **does not contain `internal/server/export_import_provenance_test.go` at all** (`git ls-tree -r` count = 0). Eight of the nine tests are defined only in that file, so on the other track's tree they cannot be *executed*, and therefore cannot be inside an executed-but-unlisted set measured there.

The one inference I am making: that the other track's "older 503-row manifest" *is* `b54c573`. It is the only 503-row state of this file anywhere in the history I can reach. If the other track is measuring against a 503-row manifest that is not `b54c573`, this conclusion does not carry and I would need that SHA. **The two accountings share the same 501-row ancestor blob and diverge from it independently — 501 + 2 on that track, 501 + 9 on this one. They must not be added together.**

**CHECK 1 result: PASS on the substance (zero deletions, three ways, at `f487dc5`). The developer's evidentiary sentence is under-scoped — see Finding R3-2.**

### CHECK 2 — "R-1 is a doc-only correction"

**PASS. The code really is untouched, and I looked for the quiet behaviour change specifically.**

R-1 was filed at `2ff87d2` against `internal/server/export_import.go:533-542`, the `for _, imported := range importParams.Tasks` provenance stamp loop: a task-less import writes a collection and users with zero provenance rows.

Measured at `f487dc5`:

- **The stamp loop is byte-identical** between `2ff87d2` and `f487dc5`. In the full `git diff` of `export_import.go` across that range, the loop appears only as unchanged context (`export_import.go:571` at head).
- **No task-less guard was added anywhere.** Grepping the head revision of `export_import.go` for `len(...Tasks)`, `Tasks) == 0`, `task-less`, `no tasks` returns only two hits, both pre-existing and both benign: `taskMapping := make(map[string]uuid.UUID, len(doc.Tasks))` (`:440`, a capacity hint) and `Tasks: int32(len(doc.Tasks))` (`:483`, a stats field). There is no new pre-flight refusal and no new attachment point.
- **`export_import.go` did change at `f487dc5`, and both changes are attributable to *other* review items**, not to R-1:
  - `+34 lines` adding `unattributableImportMessage` and swapping the refusal string at `:387-390` — that is **REQ 2**.
  - `-4 / +7 lines` removing the unreachable `json.Marshal` error branch at `:556-571` — that is **N-1**.
  Neither touches the task-less path.
- **A14 is not duplicated.** The branch modifies **zero** documentation files: `git diff --name-status 43bd206 f487dc5` lists 8 paths, all of them `.github/expected-go-tests.txt` or `.go`. `OUT-OF-SCOPE-BACKLOG.md` is not in the repository tree at `f487dc5` at all; it lives in the scratchpad, where the EM's A14 row ("Import provenance covers TASK rows only… PROVENANCE ROWS = 0") is present exactly once for this subject.
- **The claim really was corrected**, and correctly. §3 "Create-vs-merge" of `dev-import-hardening.md` now reads: *"Provenance covers 100% of rows attached to tasks. An import carrying no tasks writes no provenance row at all, while still creating a collection and users."* That is the honest statement, and the false one it replaced is quoted in place rather than deleted.

### CHECK 3 — "The pre-registration repair"

**PASS. The restored block contains the superseded figures, struck, attributed to the correct SHA. I verified each superseded value against the commit it is attributed to — a struck figure tagged to the wrong SHA would be a worse artefact than the overwrite it repairs.**

§4b of `dev-import-hardening.md` now carries three struck rows:

| Row | Struck value, as restored | Attributed to | Verified at that SHA |
|---|---|---|---|
| Membership gate | ~~0 MISSING, 0 UNEXPECTED (507 = 507)~~ | `2ff87d2` | **Correct.** Manifest at `2ff87d2` = 507 rows. |
| Manifest entries | ~~507 (501 inherited + my 6)~~ | `2ff87d2` | **Correct.** 501 rows at base `43bd206`; `+6	0` at `2ff87d2`; 507 rows total. |
| gofmt scope | ~~my 3 files~~ | `2ff87d2` | **Correct as to the number.** 3 Go files changed across `43bd206..2ff87d2`. See the scoping defect below. |

The repair is real and the disclosure paragraph is the right one: *"a prediction that can be edited after the fact is not a prediction."* The superseded values are recoverable from the block itself without going to git, which is the property that makes a pre-registration worth having.

**One defect inside the repair — logged as Finding R3-4.** The gofmt row's struck value and its replacement are measured on **different scopes**. `3` is *cumulative across the branch* at `2ff87d2` (commit `2ff87d2` alone changed **0** Go files — it is the manifest-only commit). `6` is *that single commit* at `f487dc5`. The cumulative figure at `f487dc5` is **7**. Both numbers are individually true; struck-through against replacement they invite the reader to see a 3→6 progression of the same quantity, and it is not the same quantity.

### CHECK 4 — Unit discipline

**THREE remaining instances. All three are in the report, none in the code.** Round 2's shape — every supporting number correct, the noun or the reference point attached to it wrong — has not been fully cleared. Findings **R3-2**, **R3-3**, **R3-4** below.

The developer has correctly internalised the habit in the places they applied it deliberately (§3's *"NAME THE UNIT IN THE SAME SENTENCE AS THE NUMBER"*, and the §1 re-measure table, which is clean). What survives is in the sentences that were written before the rule and not re-swept — which is itself the finding: the rule was adopted, not applied backwards.

---

## Independent verification of the gate at `f487dc5`

I did not take the developer's gate figures on trust. I replicated the CI membership gate from `.github/workflows/ci.yml` (the `awk` extractor at lines 310-318 and the `comm` assertion at lines 384-408) against my own `go test ./... -v` run at `f487dc5`:

| Check | Result at `f487dc5` |
|---|---|
| `go list ./...` | **32 packages**, exit 0 |
| `go build ./...` | exit 0, no output |
| `go vet ./...` | exit 0, no output |
| `go test -count=1 ./...` | exit 0 |
| Package result lines recognised by the CI parser | **32 package result lines** (parser self-check passes) |
| CI failure-line grep `^(--- FAIL:\|FAIL\t\|FAIL$)` | **0 failure lines** |
| Executed package-qualified top-level Go test functions | **510 rows** in `executed-go-tests.txt` |
| Manifest rows, `sort -u .github/expected-go-tests.txt` | **510 rows** |
| MISSING (manifest rows that did not execute) | **0 rows** — gate PASSES |
| UNEXPECTED (executed tests not in the manifest) | **0 rows** |
| `(unterminated)` rows | **0 rows** |
| Manifest duplicate rows | **0** — 510 lines, 510 unique, already `sort`-ordered |
| `gofmt -l` on the 7 Go files changed across `43bd206..f487dc5` | **0 unformatted files** |
| `gofmt -l` repo-wide | **7 files, none on this branch** — exactly the seven the author pre-registered |

**510 rows in `.github/expected-go-tests.txt` = 510 package-qualified top-level Go test functions executed by `go test ./... -v`, at `f487dc5`.** Both sides of that equality are the same unit and I measured both myself. The developer's headline figure is correct.

The repo-wide `gofmt` pre-registration is confirmed exactly: `internal/server/scopes.go`, `internal/serverapp/{linkflows_test,oauth,tokenrefresh,unified_test}.go`, `internal/streaming/{eventbus,eventbus_test}.go`. Predicted before measurement, seven for seven.

---

## Critical

None.

## Required

### R3-1. The refusal message tells the operator something false about the `ft` binary, in a configuration the author's own report documents as reachable

**File:** `internal/server/export_import.go:157-159` (the `scope` constant in `unattributableImportMessage`), pinned by `internal/server/export_import_provenance_test.go:777` and justified at `:722-723`.

The message every refused import emits ends with:

> " Only collection import is affected; other operations are unchanged, and the embedded \`ft\` CLI is unaffected because it always authenticates locally."

The test asserts this substring is present under **every** cause, including `OpenAccessCauseDeliberate` (`export_import_provenance_test.go:777`), and the test comment gives the justification: *"must not imply that local tooling is broken, because the embedded CLI is never open-access."*

**MEASURED.** The justification is true of one construction site and is then applied to the binary:

- `internal/cli/connect.go:169` — the embedded path — installs `lookup := server.NewStoreTokenLookup(s)` **unconditionally**, after `ensureLocalUser`. Never open-access. The author's claim holds here.
- `internal/cli/dashboard.go:80-84` — **`ft dashboard`, a subcommand of the same `ft` binary** (`Use: "dashboard"` at `:39`; `cmd/ft/main.go` is the only `ft` main) — honours `FARMTABLE_OPEN_ACCESS=1`, leaves `lookup` nil, and at `:97` now passes `server.WithOpenAccessCause(server.OpenAccessCauseDeliberate)`.

So `ft dashboard` started with `FARMTABLE_OPEN_ACCESS=1` refuses `ImportCollection` and hands the operator a message asserting that the `ft` CLI is unaffected. **The author knows this**: §2 of `dev-import-hardening.md` has a four-row artefact table whose second row is *"`ft dashboard` — `Dockerfile` (`CMD ["/ft","dashboard"]`) | Import reachable? Yes | Can run open-access? Yes | **Import refused in that configuration**"*. The Dockerfile CMD means the containerised deployment of this repo is `/ft dashboard` — the operator most likely to read this message is running the binary the message tells them is fine.

Within the report's own vocabulary, "*embedded* `ft` CLI" is precise: it names the `connect.go:169` row, not the `dashboard.go` row. But that vocabulary exists only in the report. The string ships alone, and REQ 2's premise — the author's own words in the `f487dc5` commit message — is *"the refusal an operator actually sees is the deliverable."*

**This is the round-2 defect class, in the deliverable rather than in the prose.** A code path was measured (`connect.go:169`, unconditional lookup — correct) and a *binary* was reported (`the ft CLI is unaffected`). Mutation arm **M9** removed this sentence and correctly turned all three wording subcases RED, so the sentence is well *pinned* — but no arm ever asked whether it is *true*. A pinned falsehood is worse than an unpinned one, because the test now defends it.

**Suggested fix.** Name the path, not the binary — the same remedy the author already applied to their own "which artefact" ambiguity in §2. In `export_import.go`, replace the `scope` constant with something like:

```go
const scope = " Only collection import is affected; other operations are unchanged. " +
    "Local `ft` commands backed by the embedded database are unaffected — they always " +
    "authenticate locally. (`ft dashboard` started with FARMTABLE_OPEN_ACCESS=1 is a " +
    "server and is refused in the same way.)"
```

Then update the invariant substring at `export_import_provenance_test.go:777` and the justification comment at `:722-723` to match. Cheapest acceptable alternative: delete the CLI clause entirely and keep only *"Only collection import is affected; other operations are unchanged"* — which is unconditionally true and costs the operator nothing.

### R3-2. §1's non-regeneration evidence names no reference point, and as stated does not establish the conclusion it draws

**File:** `/scion-volumes/scratchpad/projects/farmtable/reports/dev-import-hardening.md:49`.

> "Manifest denominator: 507 → **510**, three added by name; `git diff --numstat` on the manifest is **3 additions, 0 deletions**, which is the mechanical proof it was not regenerated."

Every number in that sentence is correct **for the range `2ff87d2..f487dc5`**, which the sentence never names. Against the branch base `43bd206` the numstat is **`9	0`** and the denominator moved **501 → 510 rows**.

The consequence is not cosmetic. `3 additions, 0 deletions` across the last commit is *not* mechanical proof that the manifest was not regenerated **on the branch** — it says nothing whatsoever about `2ff87d2`, which is the commit that actually edited the manifest first and the one where a regeneration would have happened. The conclusion is true (I verified `6	0` at `2ff87d2`, `9	0` base-to-head, set-wise `comm` empty, and order-wise strict-subsequence), but the reader is handed evidence that covers one of the two edits and told it proves both.

This is the sentence that will travel. It is one hop from being cited as "the manifest diff is 3/0" by someone who never sees `2ff87d2`.

**Suggested fix.** State both ranges and the stronger proof:

> Manifest rows in `.github/expected-go-tests.txt`: **501 at `43bd206` → 507 at `2ff87d2` → 510 at `f487dc5`**. `git diff --numstat` on that path is **`6	0` at `2ff87d2`**, **`3	0` at `f487dc5`**, and **`9	0` for `43bd206..f487dc5`** — **zero deletions at every commit**. Additionally, the 501-row base file is a strict subsequence of the 510-row head file (`diff` emits 0 `<` lines), so no pre-existing row was removed, rewritten, or reordered. That, not the net count, is the mechanical proof it was not regenerated.

### R3-3. §3's mutation-arm heading claims a denominator of 7 over a table of 12

**File:** `dev-import-hardening.md:183` (heading) and `:189` (body).

> `### Mutation arms — 7 of 7 RED via assertion`
> "Each arm records its **diff delta** … **All seven deltas are non-zero.**"

The table immediately beneath lists **twelve** arms: M1, M2, M3, M4, M4b, M5, M6′, M7, M8, M9, M10, M11. §4b's per-arm prediction table lists the same twelve plus a baseline. The body three paragraphs down says *"M7–M11 were run in a throwaway clone at `f487dc5` … all five compile, all five RED."*

7 is the correct count of arms run at `2ff87d2`. 12 is the correct count for the branch. The heading is a round-2-era figure carried forward over a round-3 table, so the heading and the table it heads disagree about how much work was done, and the reader has no way to know which is authoritative without counting rows.

This one **understates** the author's own work, which is why it survived the sweep — the unit-discipline rule catches inflation more readily than deflation. It is still an internally contradictory count in the evidence section of an audit artefact for a security-relevant change.

**Suggested fix.** `### Mutation arms — 12 of 12 RED via assertion (7 arms at 2ff87d2, 5 arms M7–M11 at f487dc5)`, and change *"All seven deltas are non-zero"* to *"All twelve deltas are non-zero."*

### R3-4. Inside the pre-registration repair, the struck gofmt figure and its replacement are measured on different scopes

**File:** `dev-import-hardening.md:454` (the gofmt row of the §4b table).

> `| gofmt -l on ~~my 3 files~~ my **6 changed Go files** at f487dc5 | 0 unformatted files |`

Measured:

- **3** = Go files changed across `43bd206..2ff87d2` — a **branch-cumulative** figure. (Commit `2ff87d2` in isolation changed **0** Go files; it is the manifest-only commit.)
- **6** = Go files changed **in commit `f487dc5` alone** — a **single-commit** figure.
- Branch-cumulative at `f487dc5` is **7** (`cmd/farmtable-server/{main,main_test}.go`, `internal/cli/dashboard.go`, `internal/server/{export_import,export_import_provenance_test,export_import_test,server}.go`).

Both figures are true. Presented as strike-through-and-replace they read as one quantity being revised, and they are two different quantities. This lands inside the block whose entire purpose is that it cannot be quietly reconciled — which makes it the one place in the report where the defect costs the most.

I verified all **7** cumulative files are `gofmt`-clean, so the underlying property holds either way.

**Suggested fix.** Rewrite the row as: `| gofmt -l on ~~the 3 Go files changed across 43bd206..2ff87d2~~ (that scope, at 2ff87d2) → the **6 Go files changed in commit f487dc5**, and the **7 Go files changed across 43bd206..f487dc5** | 0 unformatted files in every scope |`

---

## Nit / Optional

### O-1. The env→cause mapping now exists twice, and only one copy is testable

**Files:** `cmd/farmtable-server/main.go:174-183` (`openAccessCauseFor`, unexported, package `main`) and `internal/cli/dashboard.go:80-84` (an inline `if os.Getenv("FARMTABLE_OPEN_ACCESS") == "1"`).

The `f487dc5` commit message calls `openAccessCauseFor` *"the SINGLE source of truth for main's auth-mode branch"* — correctly scoped to `main`, and within `main` the design is genuinely good: the cause **drives** the `switch` rather than being computed alongside it, so the diagnostic cannot drift from the auth mode it describes. But `internal/cli` cannot reach that helper (it is unexported in `package main` under `cmd/`), so `dashboard.go` re-derives the cause inline. Two mappings of the same environment to the same type, one covered by a six-case table test and one covered by nothing.

They agree today, and they differ *by design* (dashboard has no missing-token case because it always installs a lookup). This is not a bug. It is a helper sitting in a package that structurally cannot be reused, which is how the second copy came to exist.

**Consider:** move `openAccessCauseFor` into `internal/server` beside the `OpenAccessCause` type it produces, export it, and have both `main.go` and `dashboard.go` call it — dashboard passing `""` for the token so it lands on `Deliberate`/`Unspecified` and never `MissingToken`. That deletes a duplicate conditional and brings the second wiring site under the existing table test. Non-blocking.

### O-2. `ft dashboard`'s cause wiring has no test

`TestOpenAccessCauseForMapsEveryConfiguration` covers `cmd/farmtable-server` only. Nothing asserts that `internal/cli/dashboard.go:97` passes a cause at all — mutation arm **M10** (`WithOpenAccessCause` silently fails to store the cause) would not catch a `dashboard.go`-only regression, because it mutates the setter, not the call site. Low value while O-1 stands; if O-1 is taken, this closes for free. Non-blocking.

## FYI

### F-1. `OUT-OF-SCOPE-BACKLOG.md` has two rows numbered A14 and two numbered A15

`A14` is both "Stage 5 Google OAuth login is NEVER REGISTERED…" (line 33) and "Import provenance covers TASK rows only…" (line 39). Same for `A15`. The file already carries a banner — *"ID COLLISION — CITE BY PHRASE, NOT BY NUMBER"* — so this is known and handled. Recorded only because the developer's §7 disposition table cites **"the EM's A14"** by number, and that citation is ambiguous in isolation. Not this branch's defect; no action required of this branch. Citing it by phrase would cost four words.

### F-2. `taskMapping` "11 references"

`dev-import-hardening.md:232` says *"`taskMapping` has 11 references: **1 write, 10 guarded reads**."* A plain grep of `export_import.go` at `f487dc5` returns **23** lines containing the identifier (the difference is 1 comment, 1 declaration, 5 parameter declarations, 5 pass-as-argument sites). The load-bearing decomposition is exactly right, and I checked it line by line: **1 write** at `:445`, and **10 guarded reads** at `:693`, `:704`, `:707`, `:718`, `:895`, `:948`, `:1009`, `:1024`, `:1028`, `:1043`. The claim is sound; only the word "references" is looser than the numbers under it. Informational — do not renumber anything on my account.

### F-3. Verdict scope

`REQUEST CHANGES` here rests on **R3-1** (code, one string and two test lines) and **R3-2/R3-3/R3-4** (three report edits). None of them requires re-running the mutation battery, and none of them touches the provenance control, the gate, or the manifest. This is a short round.

## Positive Feedback

Specific, and not manufactured.

- **`OpenAccessCause` is the right shape for a dangerous idea.** Adding a wiring-time value that describes the auth posture is exactly how a diagnostic acquires authority it was never meant to have. The author saw that coming and built the guard first: `TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause` (`export_import_provenance_test.go:677`) iterates all three declared causes **plus an unrecognised one** (`"something-nobody-has-written-yet"`) and asserts identical code, identical refusal, and zero collections written under each. The doc comment at `server.go:52-70` states the invariant and names the test that pins it. That is how you add a field that must never grow teeth.
- **M7 versus M8 is the best piece of evidence on this branch.** Predicting that M7 turns the *wording* test RED while leaving the *invariance* test GREEN — and pre-registering that mixed outcome as a pass condition — is what separates a real invariance test from one that passes because the refusal happens to be unconditional. M8 then supplies the arm that would fail if it were vacuous. Most mutation batteries never establish this.
- **The item-3 attribution guard is a genuinely novel move.** `newControl bool` on the subcase struct with a runtime `if newControls != 1 { t.Fatalf(...) }` at `export_import_provenance_test.go:381-388` converts a prose claim about evidentiary weight into something the test suite enforces. *"A count that is only written in prose drifts; this one now has to stay true to compile a passing run."* That is right, and I have not seen it done before.
- **N-1 was taken properly.** The unreachable `json.Marshal` branch is gone, and the replacement comment (`export_import.go:559-565`) records *why* it is unreachable and the exact condition under which it must come back: *"If a non-string field is ever added to importProvenance, restore the error check along with it."* Deleting dead code without deleting the reason it was dead is the failure mode; this avoids it.
- **`openAccessCauseFor` drives the branch instead of shadowing it.** Rewriting `main.go`'s `if/else if/else` into a `switch` on the computed cause means there is exactly one decision, so the diagnostic text structurally cannot disagree with the auth mode. That is a better fix than the obvious one.
- **The pre-registration repair was volunteered.** Nobody had caught the overwrite. Disclosing it and restoring the struck values costs the author credibility in the short run and is the only thing that makes the block worth anything in the long run.

## Test Coverage

**Good, with one gap that is O-2 above.**

- 9 new test functions, 0 removed, all 9 registered by name in the manifest. Verified from Go source, not from the manifest — the two agree.
- New code paths at `f487dc5`: `unattributableImportMessage` (3 causes × wording assertions, plus 5 cause-invariant properties per case), `openAccessCauseFor` (6 cases covering the full 2×3 env space, including the non-canonical-truthy typo case `"true"` — a good instinct: a `FARMTABLE_OPEN_ACCESS=true` typo must not silently disable auth), `WithOpenAccessCause` / `s.openAccessCause` (exercised through the service API by both new server tests, never via `os.Getenv`).
- `TestOpenAccessCauseForMapsEveryConfiguration` tests the mapping as a **pure function**, which was the correct call and is the reason it is assertable at all. The author pre-registered the falsifier for getting this wrong (*"If it fails on `FARMTABLE_OPEN_ACCESS` being read from the real environment, I have failed to keep it a pure function"*).
- Mutation evidence: 12 arms, all RED **by assertion** rather than by build break — after the author caught and redid two arms (M1, M2) that were RED only because they failed to compile. That correction is worth more than the arms themselves.
- **Gap:** `internal/cli/dashboard.go:97` — the second wiring site — is unasserted. See O-2.
- **Gap created by R3-1:** `export_import_provenance_test.go:777` currently pins a substring that is false in the `ft dashboard` + `FARMTABLE_OPEN_ACCESS=1` configuration. Fixing R3-1 must fix this line, or the test will defend the defect.

## Backward Compatibility

No wire-format change. `proto/farmtable.proto` is untouched by this branch.

- `ServiceOption` is variadic; `WithOpenAccessCause` is purely additive. All 9 other `NewFarmTableService` call sites (`connect.go:169`, `connect.go:306`, `graph_routing.go:128`, and 7 in `internal/testutil/testserver.go`) compile unchanged and receive `OpenAccessCauseUnspecified`, the zero value — which is also what a correctly-configured, identity-enforcing deployment carries. Correct default.
- **The one real compatibility fact is pre-existing and already ruled on:** `ImportCollection` returns `FailedPrecondition` in configurations where it previously succeeded. That is A10 in the backlog, **RULED SHIP by the coordinator**, and it landed at `33f59e8`, not at `f487dc5`. This round changes only the message text of that refusal, not its reachability — which the cause-invariance test pins directly. No new breakage in round 3.
- Exported surface added: `server.OpenAccessCause`, its three constants, and `server.WithOpenAccessCause`. Additive only; nothing removed or renamed.

## Final Verdict

**REQUEST CHANGES**

Blocking: **R3-1** (refusal message asserts something false about the `ft` binary in a reachable, Dockerfile-default configuration — one string in `export_import.go` plus the substring assertion and comment in `export_import_provenance_test.go`), **R3-2**, **R3-3**, **R3-4** (three scoping corrections in `dev-import-hardening.md`).

Non-blocking and forwarded for a cleanup pass: **O-1**, **O-2**.

The code on this branch is materially better than the code it replaces, the gate is green by my own independent replication at `f487dc5`, the manifest was demonstrably not regenerated, and R-1 is a clean doc-only correction. Round 4 should be short.

**Recommendation to the dispatcher:** no specialist escalation needed. R3-1 is a security-adjacent *message*, not a security *control* — the refusal itself fires correctly under every cause, which is directly pinned. A security-auditor pass would find nothing this review did not.

---

## Corrections to this document

Struck in place per the standing rule; nothing deleted.

- ~~The manifest moved 507 → 510 rows during the branch.~~ — this framing came in with the round-3 brief and I repeated it while orienting. **Corrected at `f487dc5`:** the manifest moved **501 rows at `43bd206` → 510 rows at `f487dc5`**. 507 rows is an intra-branch waypoint at `2ff87d2`, not the branch's starting denominator.

- ~~`go build ./...` exit 0 and `go vet ./...` exit 0, measured at `f487dc5`.~~ — **the values were right; the instrument that produced them could not have told me otherwise.** I ran `go build ./... 2>&1 | tail -20 && echo "BUILD_EXIT=$?"`. In a pipeline `$?` is **tail's** status, not the command's. Demonstrated: `false | tail -5` then `$?` = **0**; bare `false` then `$?` = **1**. A failing build would have printed `BUILD_EXIT=0` and I would have filed it. **Re-measured at `f487dc5` with no pipe, status captured directly: `BUILD_EXIT=[0]`, `VET_EXIT=[0]`.** The conclusion in the verification table stands and is now actually evidenced. Recorded rather than silently re-run, because the original figure was true by luck.

  Partial mitigation that was already present, stated so the correction is not overclaimed: `go test -count=1 -json ./...` and `go test ./... -v > log` used **redirects, not pipes**, so `TEST_EXIT=0` and `GOTEST_EXIT=0` were always sound — and `go test` compiles every package, so a build break could not have hidden behind them. **`go vet` had no such backstop and was the real exposure.**

## Instrument notes

Recorded because the failure modes are the expensive kind.

- Every revision-spec argument was written braced (`"${rev}:${path}"`) and echoed as `arg …=[…]` before use. No unbraced `$var:` was ever passed to git under zsh.
- **No measurement was `2>/dev/null`'d.** The one exit-128 encountered was allowed to surface and was informative: `git rev-parse import-hardening` in `/workspace/farmtable` fails, because the branch exists only as `refs/salvage/farmtable-import-hardening/import-hardening`. Suppressing that would have left me measuring a working tree instead of the commit.
- All content reads used `git show "<SHA>:<path>"` or `git ls-tree` against a named SHA. The single `git checkout --detach f487dc5` was for `go build` / `go vet` / `go test` only, in the private clone, and `git status --porcelain` was empty at checkout.
- Nothing was staged, committed, stashed, or pushed. No `git add -A`, no `git add .`, no `git add -u`, no `git commit -a`, no `git stash -u`.
- `/workspace/farmtable/web/dist` was not read, written, or deleted. The source repository was used read-only as a clone source.
- **`cmd | tail -N; echo $?` reports tail's status.** I hit this on build/vet — see Corrections above. Every other exit status in this review came from a redirect or a bare command.

## Durability sweep — added 2026-07-29T15:4x, after the EM's defect-7 and retraction messages

Measured in my clone at `/workspace/farmtable-review-ih-r3`, not argued.

| Quantity | Value |
|---|---|
| Commits authored by me | **0.** I am the review leg. No commits, no resets, no rebases, no amends. |
| Mutation arms run by me | **0**, therefore **no arm commits to bundle.** Stated explicitly rather than reported as "nothing to bundle." The twelve arms M1–M11 belong to `dev-import-hardening`. |
| Sweep (a) `git fsck --unreachable --dangling` | **169 unreachable commits** |
| Sweep (b) `git reflog --all` | **2 commits** |
| Intersection of (a) and (b) | **0.** Empirical confirmation that the two sweeps are complementary and neither subsumes the other. |
| Ref-reachable commits (`rev-list --all`) | **1060** |
| Total distinct commits in my container | **1229** |
| **Absent from `/workspace/farmtable`** | **0 of 1229.** |

**I am therefore not bundling for durability.** Nothing originates in my container; a bundle would carry 1229 commits all of which are already in canonical.

**Limitation on that number, stated rather than left implicit.** `0 of 1229` means *present in canonical*, which is **not** the same as *on GitHub*. Per the EM's own withdrawal of the reference set: in a leg tree `origin` is canonical, and canonical's fetch refspec is heads-only, so this measurement cannot speak to the network at all. It discharges "did this leg take anything to the grave" and nothing wider.

**Non-ref artefacts were my real exposure, and they are now preserved.** My gate-replication evidence lived only in `/tmp`. It is copied to `reports/_evidence-review-ih-r3/` with `SHA256SUMS.txt` and a `RE-DERIVATION.md` giving every measurement, its reference point, and its expected value. The project log at `/workspace/farmtable/.design/project-log/import-hardening-code-review-r3.md` is **untracked** — no ref points at it, so no sweep or bundle would ever have carried it; a copy is in the evidence directory.

**Strongest single artefact preserved:** `executed-go-tests.f487dc5.txt` and `manifest-rows.f487dc5.sorted.txt` share sha256 `0321268aab72f7c675a7e5d8ba74832463e9d3624bc2f4fc288c0fadafb0a970`. The 510-row executed set and the 510-row manifest set are **byte-identical** — a stronger and cheaper statement of "0 MISSING, 0 UNEXPECTED" than the `comm` pair.
