# dev-import-hardening — import audit-trail hardening

**Agent:** `dev-import-hardening`   **Track:** `farmtable-em-hardening`   **Date:** 2026-07-29
**ROOT:** `/workspace/farmtable-import-hardening` (private clone; push disabled at the remote)
**Branch:** `import-hardening` — **NOT PUSHED**
**Base:** `43bd206` (rebased from the original base `faf1c8c`, which is an ancestor)

| Commit | Subject |
|---|---|
| `6dbfc8c` | test: oracle for forged/backdated import audit rows and unvalidated user type |
| `a809849` | test: retire the defect-2 user-type oracle under the owner directive |
| `33f59e8` | fix: record unforgeable server-authored provenance on every import |
| `2ff87d2` | ci: register this branch's six new tests in the membership manifest |
| `f487dc5` | fix: name the cause in the unattributable-import refusal (**review round 2**) |
| `9f5fadb` | test: assert the phrase unique to the missing-token branch (**round 2 nits; APPROVED**) |

> Original pre-rebase SHAs were `3fc9792`, `c33b5dc`, `d5e3f00`. They are unreachable now.
> The recovery pointer inside the removal commit was rewritten to `6dbfc8c` so it still resolves.

---

## 1. Verification — measured from a FRESH CHECKOUT of the commit

Every figure below was produced in a **throwaway clone at `/tmp/freshmeasure/ft`, checked out at `2ff87d2`** — not in my development tree, however clean that looked. The instrument was made *incapable* of seeing anything the commit does not contain, rather than merely trusted not to.

Disclosure, per the standard: in the fresh checkout `git status --porcelain -uall` returned **0 entries**, and `--ignored` showed **nothing gitignored present on disk** — no `node_modules/`, no scratch, no build output. All mutation scratch lived in `/tmp`, outside the repository. `web/dist/` contained **only the committed `.gitkeep`**, so the embed resolves from commit content alone.

| # | Check | Result | `-uall` porcelain after |
|---|---|---|---|
| 1 | `go list ./...` | **32** packages | EMPTY |
| 2 | `go build ./...` | OK, no output | EMPTY |
| 3 | `go vet ./...` | OK, no output | EMPTY |
| 4 | `go test ./...` | **ok=10, no-test-files=22, FAIL=0, total=32** | EMPTY |
| 5 | `gofmt -l` on my 3 files | 0 unformatted | EMPTY |
| 6 | Membership gate | 507 executed vs 507 manifest, **0 MISSING, 0 UNEXPECTED** | EMPTY |

### Re-measured at `f487dc5` (review round 2)

Same protocol, **new throwaway clone at `/tmp/fresh487`, `git clone --no-local`, checked out at `f487dc5`** — deliberately a *different directory* from the `/tmp/arms` clone where M7–M11 ran, so no arm residue can be in scope even in principle. Porcelain `-uall` EMPTY at checkout and after every check below.

| # | Check | Result at `f487dc5` | `-uall` porcelain after |
|---|---|---|---|
| 1 | `go list ./...` | **32** packages (unchanged — no new package) | EMPTY |
| 2 | `go build ./...` | OK, no output | EMPTY |
| 3 | `go vet ./...` | OK, no output | EMPTY |
| 4 | `go test ./...` | **ok=10, no-test-files=22, FAIL=0, total=32**, `--- FAIL` count **0** | EMPTY |
| 5 | `gofmt -l` on my 6 changed Go files | 0 unformatted | EMPTY |
| 6 | Membership gate | **510 executed vs 510 manifest, 0 MISSING, 0 UNEXPECTED** | EMPTY |

**ROOT** for all of the above is the throwaway clone, not `/workspace/farmtable-import-hardening`. ~~Manifest denominator: 507 → **510**, three added by name; `git diff --numstat` on the manifest is **3 additions, 0 deletions**, which is the mechanical proof it was not regenerated.~~

**Corrected at `f3b6efa` (review R3-2).** The struck sentence gave one range and did not say which, so it read as the whole branch's accounting when it was a single commit's. Every figure in it was correct; the scope was missing. **The headline is the subsequence proof, not the arithmetic** — the arithmetic is consistent with a regenerate-and-re-sort that happens to land on the same count, and the subsequence proof is not.

| Range | Rows before → after | manifest `--numstat` |
|---|---|---|
| **`43bd206..f3b6efa` — the whole branch, the figure that matters for merge** | 501 → **511** | **10 additions, 0 deletions** |
| `43bd206..f487dc5` | 501 → 510 | 9 additions, 0 deletions |
| `2ff87d2..f487dc5` (what the struck sentence actually measured) | 507 → 510 | 3 additions, 0 deletions |

**Subsequence proof at `f3b6efa`:** all **510 rows** of the manifest as it stood at `9f5fadb` are present at `f3b6efa`, **in the same order**, verified by `diff <(git show 9f5fadb:.github/expected-go-tests.txt) <(grep -Fxf … .github/expected-go-tests.txt)` — empty. `sort -c` passes. Zero deletions at every range above. That is the mechanical proof of add-by-name; the row count alone is not.

I did **not** use `git status --porcelain -uno` at any point; bare `--porcelain` was used throughout, and every claim above was re-confirmed with explicit `-uall`.

**What question did the flag actually answer?** Asking this of my own instruments changed one result. `go test ./...` reports `FAIL` for a package that fails to *build* and for one that fails an *assertion*, identically — which is precisely how two of my mutation arms nearly banked a meaningless RED (section 3).

**Correcting a stale figure of my own.** Earlier in this task I measured, correctly at the time, that `go list ./...` returned **0 of 33** packages at `faf1c8c` and that 3 packages failed on the `//go:embed all:web/dist` pattern. **That is no longer true.** At `43bd206`, `web/dist/.gitkeep` is committed and the figure is **32 of 32 with 0 failures**. Denominator note: 32 is right for *this* tree and for main; the XSS branch's 33 is right for *its* tree because it adds `internal/webguard`.

**The `.gitkeep` change is worth recording as a positive control on the design, not just a build fix.** With no built frontend the binary embeds a stub and `WebUI()` returns `ErrWebAssetsNotBuilt`. That is the exact inverse of the habit this track spent the day documenting: absence reported as an error instead of read as success.

---

## 2. Defect 1 (HIGH) — forged and backdated audit rows — FIXED

### What was wrong

`ImportCollection` accepted a JSON document whose change and comment rows carry an author id. `resolveImportUsers` binds those payload rows to a **real existing account's UUID** by matching the payload email against `GetUserByEmail`. `created_at` was taken **verbatim from the payload**. No field recorded who actually performed the import. `ImportCollection` called `RequireIdentity` and discarded the result into `_`.

Net effect: any principal who could call import could write audit history **attributed to someone else** and **dated to any instant they chose**, indistinguishable from genuine history.

The wildcard scope does not excuse this. A wildcard lets a principal act as **themselves** with full permission. It does not entitle them to author history attributed to a **different** user, nor to choose a timestamp. Impersonation and backdating are privileges nobody legitimately holds.

### What the fix does

Every imported task now carries a server-authored change row under the reserved field name `server:import_provenance`, whose JSON body records the authenticated importer and the server's own ingestion time.

- **(a) Provenance recorded.** `AuthorID` is the identity `RequireIdentity` already returned.
- **(b) It reaches a read path — two of them.** Surfaced through the shipped `ListChanges → changeToProto → pb.Change` path, following the `task_state_migration` precedent already in this file, and also carried in `ExportCollection` output. **No proto change and no codegen.** Justification: `buf`, `protoc` and `protoc-gen-go` are all absent from this environment, and the repo's own Makefile (lines 13–17) states the generator versions "are pinned nowhere in this repo (there is no tools.go and no go.mod tool directive)". Regenerating to add one field would produce a large unreviewable diff. Ent codegen *was* proven reproducible, but ent schema changes were denied by the EM.
- **(c) Server ingestion time recorded alongside the payload's claim, not instead of it.** The payload's timestamps are deliberately **left intact** — historical imports legitimately carry historical timestamps, and silently rewriting them would be a real regression. The claim is stored in `claimed_collection_created_at` next to the server's `imported_at`, so the two are always distinguishable.
- **Unforgeable by the payload.** Payload rows in the `server:` namespace are dropped with a warning. Without this the remedy would itself be a forgery vector: an attacker could plant a provenance stamp naming somebody else.
- **Fails loudly on absent identity.** See below — this is the part most likely to have gone wrong.

### Absent identity: both outcomes are loud

`RequireIdentity` has **two distinct** absent-identity outcomes, and both are now hard failures:

| Outcome | Condition | Result |
|---|---|---|
| returns a non-nil error | auth enforced, identity missing or nil | propagated as-is → `Unauthenticated` |
| returns `(uuid.Nil, nil)` | open-access mode | **`FailedPrecondition`**, import refused |

The import **never** records `""`, `"unknown"`, `"system"`, `"anonymous"` or a zero UUID and carries on. There is no degraded state to interpret, because no degraded state exists — the earlier draft's `Authenticated bool` field and `importerIDString` helper were deleted outright rather than defaulted.

This matters more than it looks. This track is documenting that **absence is read as permission** in three places in this codebase. An audit fix that read absent identity as "unknown, proceed" would be a **fourth instance of that habit, planted by us, inside the remedy**. My first implementation did exactly that — recorded `authenticated: false, imported_by: ""` and proceeded — and the EM was right to reject it. The fix for a class is the likeliest site of a fresh instance of it.

Pinned by `TestRPC_ImportCollection_RefusesImportWithoutIdentity`, whose failure messages begin `CANARY:` and say what they protect.

**CORRECTION — attribution of that test, narrowed from three subcases to one.** I presented all three of its subcases as evidence for the new refusal. Only **one** of them is:

| Subcase | Condition | What it is actually evidence for |
|---|---|---|
| open-access, `(uuid.Nil, nil)` | no interceptor / open access | **The new control.** This is the only subcase that exercises the branch this branch added. |
| auth enforced, no user id | `RequireIdentity` errors | **Base regression guard** — already refused at `43bd206`, before my change. |
| auth enforced, explicit nil uuid | `RequireIdentity` errors | **Base regression guard** — same. |

The two guards are worth keeping and worth running; they are not worth *counting*. Claiming three where one is load-bearing inflates the apparent evidence for the new code by 3×, and the inflation is invisible because all three genuinely pass. The test now carries the attribution in a comment and enforces it at runtime: a `newControl bool` on the subcase struct and a guard that fails if the number of subcases claimed as new controls is ever anything but exactly 1. **A count that is only written in prose drifts; this one now has to stay true to compile a passing run.**

### The fix encodes no assumption about the identity model

It needs exactly one thing: **that a caller exists and has an id.** It does not inspect the caller's type, scopes, provisioning, or anything else. It consumes the identity answer; it does not decide who is authenticated or what they may do.

### Scope boundary — NOTIFICATION, not a question

Audit-trail integrity was classified as belonging to this track, not to the auth architect. The boundary test applied, verbatim:

> **"Does the change alter WHO IS AUTHENTICATED, WHAT THEY MAY DO, or HOW THAT IS DECIDED? If yes, it is the architect's. If it CONSUMES that answer and does something else with it, it is ours."**

This change consumes the answer and writes an audit record with it. It alters none of the three. **This reverts to report-only on the architect's word.** No confirmation is being requested.

### WHICH ARTEFACT: import refuses open-access — but in *which* binary?

I originally wrote "import now refuses to run in open-access mode" without naming a binary. That sentence is the part that travels, and it is ambiguous: **there are four sites that construct this service and two Dockerfiles**, and they do not behave alike. Re-resolved at `2ff87d2`:

| Artefact | Import reachable? | Can run open-access? | Effect of this change |
|---|---|---|---|
| **`farmtable-server`** — `Dockerfile.server`, **the live service per deploy logs** | Yes | **Yes** — `FARMTABLE_OPEN_ACCESS=1` **or `FARMTABLE_TOKEN` merely unset** (`cmd/farmtable-server/main.go:63-72`) | **Import refused in those configurations** |
| **`ft dashboard`** — `Dockerfile` (`CMD ["/ft","dashboard"]`) | Yes | Yes — but **only** via explicit `FARMTABLE_OPEN_ACCESS=1` (`internal/cli/dashboard.go:79-84`) | Import refused in that configuration |
| **`ft` embedded** — `internal/cli/connect.go:169`, backs the local CLI | Yes | **No** — `lookup := server.NewStoreTokenLookup(s)` is unconditional and `ensureLocalUser` runs first | **Unaffected.** `ft collection import` keeps working |
| **`ft` passthrough** — `internal/cli/connect.go:306` | No | Yes (no interceptor at all) | **Not observable** — `GitHubPassThroughStore.ImportCollection` already returns `ErrNotImplemented` (`passthrough.go:766`) |

**The practical answer: the local CLI path is safe, and the exposure is the deployed server.** The passthrough row is a useful negative control — fully open-access, yet the change cannot be observed there because import was never implemented.

**The condition I refuse to proceed under is already catalogued.** `FARMTABLE_TOKEN` unset nilling the lookup is **S1/S2** in `audit-absence-as-permission.md` (lines 187-189, 322). I did not discover it, I am not counting it again, and I have not touched it. My change is a *consumer* of that condition, which is precisely why it is this track's and not the architect's.

**What this means for the deployed service, stated as a question for auth and not a decision by me:** if production runs `farmtable-server` without `FARMTABLE_TOKEN`, then after this change collection import returns `FailedPrecondition` there. That is either the correct refusal or a deployment gap, and which one it is depends on facts about the deployment I cannot see from the repository. The resolution is an auth-side decision about what identity such a deployment presents — **not** a decision to write "unknown" into audit history. Routing, not deciding.

### REQ 2 (review round 2) — the refusal now names the knob that caused it

The refusal is the entire user-facing surface of this change; an operator who hits it has no other signal. It previously said only that identity was missing, leaving them to guess which of two unrelated variables produced that state. Now:

| Cause | Message names | Message must NOT say |
|---|---|---|
| `OpenAccessCauseDeliberate` | `FARMTABLE_OPEN_ACCESS=1` disables enforcement; set `FARMTABLE_TOKEN` **and unset** it | "`FARMTABLE_TOKEN` is not set" — it may well be set |
| `OpenAccessCauseMissingToken` | `FARMTABLE_TOKEN` is not set; set it and restart | `FARMTABLE_OPEN_ACCESS=1` — nobody asked for open access |
| `OpenAccessCauseUnspecified` | Generic but still actionable: enable auth via `FARMTABLE_TOKEN` | must not *guess* at a knob it cannot know |

Every message additionally states that **only collection import is affected** and that **the embedded `ft` CLI is unaffected**. That last clause is load-bearing and is asserted in all three subcases: per the artefact table above the local CLI genuinely cannot hit this, and a refusal that reads like a global breakage would send local CLI users chasing a fault that does not exist.

**Plumbed at wiring time, not sniffed in the handler.** `os.Getenv` inside `ImportCollection` was rejected on two grounds: it is untestable through the service API, and it is *wrong* for the embedded path, which reads the same environment but is never open-access. Only the wiring site can distinguish the two causes at all — **by request time they are identical**, both arriving as `(uuid.Nil, nil)` from `RequireIdentity`.

- `server.OpenAccessCause` + `WithOpenAccessCause(...)` — a diagnostic value set at construction.
- `openAccessCauseFor(openAccessEnv, token)` — the env mapping, extracted as a pure function following the existing `serverPort` / `serverStoreOptions` convention in the same file. It is now the **single source of truth for main's auth-mode branch**: unspecified means, and only means, token auth is on. Computing the cause *alongside* the branch would have created two copies of one decision, free to drift, and a diagnostic that contradicts the auth mode it describes is worse than no diagnostic.
- The auth branch's behaviour is **unchanged** — same conditions, same lookup, re-expressed so one decision drives both outcomes.

**The obvious risk in this change is the one I tested hardest.** A value plumbed in from the wiring site can quietly acquire authority it was never granted — some cause becoming, now or in a later edit, a reason to let an unattributable import through. `TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause` pins the invariant across every cause **including an unrecognised one**, asserting both `FailedPrecondition` and that no collection was written. This is also what discharges **EM CONDITION 2**: the cause selects words and can never select an outcome, so the change still only *consumes* the auth answer and stays on this track's side of the boundary test. Arm M8 is its evidence (above).

**Not covered, stated plainly:** no test starts `main()`. The mapping `openAccessCauseFor` is pinned, and the option is pinned, but the single line wiring them together in `cmd/farmtable-server/main.go` and `internal/cli/dashboard.go` is verified by reading, not by execution.

---

## 3. The tests, and an honest account of which were oracle-first

Nine new tests, all registered in the membership manifest by name.

| Test | Oracle-first? |
|---|---|
| `TestRPC_ImportCollection_StampsImporterProvenance` | **Yes** — RED at `6dbfc8c` |
| `TestRPC_ImportCollection_PayloadCannotForgeProvenance` | **Yes** — RED at `6dbfc8c` |
| `TestRPC_ImportCollection_StampsEveryImportedTask` | **Yes** — RED at `6dbfc8c` |
| `TestRPC_ImportCollection_RefusesImportWithoutIdentity` | **No** — added in the fix commit |
| `TestRPC_ImportCollection_ProvenanceNeverNamesAPlaceholder` | **No** — added in the fix commit |
| `TestRPC_ExportCollection_CarriesImportProvenance` | **No** — added in the fix commit |
| `TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause` | **No** — added in `f487dc5` |
| `TestRPC_ImportCollection_RefusalMessageNamesTheCause` | **No** — added in `f487dc5` |
| `TestOpenAccessCauseForMapsEveryConfiguration` | **No** — added in `f487dc5` |

Nine tests now, six of them not oracle-first. The three from `f487dc5` are pinned by arms M7–M11 instead; same weaker standard, stated the same way.

**Stating this plainly because it would be easy to imply otherwise.** Three of six never went RED-before-GREEN in the tree. Two of them (the canary and the placeholder test) exist because EM CONDITION 1 arrived *after* the oracle commit; the third exists because of the M6 vacuity finding below. Their RED evidence is the mutation arms, not commit order. That is weaker evidence than oracle-first and should be read as such.

At `6dbfc8c`, against unfixed code: **5 FAIL, 1 PASS** of the 6 tests that existed then. The single PASS was `TestRPC_ImportCollection_AcceptsRecognisedUserTypes`, a deliberate positive control confirming the instrument worked against the substrate rather than failing for environmental reasons.

The main oracle carries an explicit **control arm** asserting the forged row *still imports verbatim* — victim's remapped UUID, backdated `created_at` preserved. Without it, every provenance assertion could pass because the import broke entirely.

### Mutation arms — ~~7 of 7 RED via assertion~~ **14 of 14 RED via assertion (7 arms at `2ff87d2`, 5 arms M7–M11 at `f487dc5`, 2 arms M9′/M12 at `f3b6efa`)**

**Corrected at `f3b6efa` (review R3-3).** The struck heading counted 7 over a table that had grown to twelve, and now fourteen. Worth naming the direction: this error **understated my own work**, and I did not catch it while catching others that inflated. Unit discipline is easier to apply to figures that flatter you; a heading that undersells reads as modest rather than as wrong, so nothing prompts a re-check. Same defect either way — a number whose denominator was named once and then silently outgrown.

**These were run DIRTY, and the dirt is the point** — a mutation arm mutates the source by definition, so a clean tree here would mean the arm did nothing. They were nonetheless anchored to a commit: the battery ran in the **throwaway clone at `2ff87d2`**, so the baseline is the commit and each arm is a single declared delta from it. Pristine backups were kept **outside** the repository. Restoration was verified by **SHA-256 comparison — identical** — with `-uall` porcelain empty and the suite green afterwards.

Each arm records its **diff delta**, so a mutation that silently changed nothing cannot be mistaken for a surviving mutant. ~~All seven deltas are non-zero.~~ **All fourteen deltas are non-zero**, each measured against the commit the arm was anchored to.

**The zero-diff guard fired for real at `f3b6efa`, and it saved a false result.** Running M12 I reused a clone that carried the fix as *uncommitted* working state; `git checkout -- <file>` between arms reverted it, so M12's `perl` found no match, the file returned to the unfixed `9f5fadb` code, and the run printed a convincing RED on exactly the test I wanted red. The numstat was **empty**, so it was reported as a zero-diff mutant and discarded rather than banked. **A zero-diff mutant reports on your patch, not on the test** — here it would have reported "the new arm catches the defect" using a tree in which the defect had never been fixed. Re-run against the *committed* tip `f3b6efa` so the baseline could not drift, plus an M0 no-mutation positive control that correctly self-reported as zero-diff. M12 then failed to compile (a Perl `.` where Go needs `+`); **a mutation that does not compile proves the compiler works, not that the test works**, so that was discarded too and re-run.

| Arm | Control reverted | Delta | Result |
|---|---|---|---|
| M1 | Provenance row not emitted (loop iterates zero times) | 1+/1- | RED — 4 tests |
| M2 | Reserved-namespace strip predicate never matches | 1+/1- | RED — 2 tests |
| M3 | Absent-identity refusal removed | 0+/4- | RED — canary |
| M4 | Ingestion time taken from the payload | 1+/1- | RED — 1 test |
| M4b | Payload's claimed timestamp not preserved | 1+/1- | RED — 1 test |
| M5 | Provenance attributed to a non-importer | 1+/1- | RED — 2 tests |
| M6′ | Export strip re-added (provenance hidden) | 1+/0- | RED — 1 test |
| M7 | Refusal message ignores the cause (always default branch) | 1+/1- | RED — wording test only |
| M8 | **Cause allowed to change the OUTCOME**, not just the words | 1+/1- | RED — invariance canary |
| M9 | "embedded `ft` CLI is unaffected" sentence removed | 1+/2- | RED — all 3 wording subcases |
| M10 | `WithOpenAccessCause` silently fails to store the cause | 1+/1- | RED — wording test |
| M11 | Env mapping blames the wrong knob (missing-token → deliberate) | 1+/1- | RED — mapping test |
| **M0** *(at `f3b6efa`, positive control)* | nothing mutated | **0+/0-** | **correctly self-reported ZERO-DIFF and refused to emit a result** — the guard proving the other two rows mean something |
| **M9′** *(at `f3b6efa`)* | whole scope clause deleted (`scope = ""`) | 1+/1- | RED — `RefusalMessageNamesTheCause` **and** `RefusalDoesNotDisclaimTheFtBinary`. The second RED is the new test's **control arm** firing: it proves the new test cannot pass on a message that drops scope language entirely. |
| **M12** *(at `f3b6efa`)* | the false `ft` CLI exemption reinstated — i.e. R3-1 reverted | 2+/1- | RED — **`RefusalDoesNotDisclaimTheFtBinary` only**. `RefusalMessageNamesTheCause` stays **GREEN**. |

M7–M11 were run in a **throwaway clone at `f487dc5`** (`/tmp/arms`, `git clone --no-local`), same protocol: all five **compile**, all five RED **by assertion** (never a build break), restoration verified by SHA-256 against a baseline taken before the battery — all three mutated files `OK` — and `-uall` porcelain empty afterwards.

**M7 versus M8 is the pair that carries the argument, and they had to disagree.**

| | M7 — message ignores cause | M8 — cause grants passage |
|---|---|---|
| `RefusalMessageNamesTheCause` | **RED** | RED |
| `RefusalDoesNotDependOnOpenAccessCause` | **GREEN** | **RED** (`CANARY:` fired) |

M7 staying GREEN on the invariance test is a *pass condition*, not a survivor: that test must be blind to wording or it is not testing invariance. M8 is the arm that earns the invariance test its place — without it, that test passes trivially because the refusal is unconditional, and a trivially-passing test is indistinguishable from a vacuous one **until you introduce the very defect it exists to catch**. M8 introduces exactly that defect — one cause becoming a reason to let an unattributable import through — and the canary fires on it.

### R3-1 at `f3b6efa` — a pinned falsehood, and the arm that could never have found it

**The defect.** The refusal message ended *"and the embedded `ft` CLI is unaffected because it always authenticates locally."* That sentence is true of `internal/cli/connect.go:169`, which installs a token lookup unconditionally. It is **false of the `ft` binary**, because `ft dashboard` is a subcommand of that same binary (`cmd/ft/main.go` is the only `ft` main), honours `FARMTABLE_OPEN_ACCESS=1`, leaves `lookup` nil, and passes `OpenAccessCauseDeliberate` at `internal/cli/dashboard.go:97` — reaching this exact refusal. `Dockerfile`'s `CMD` is `["/ft","dashboard"]`, so **the operator statistically most likely to read the message is the one it misinforms.**

**Where this came from, precisely.** In §"WHICH ARTEFACT" above I established that the *embedded CLI construction site* cannot reach the refusal. That was correct, and I then shipped it as a user-facing string. **My report's vocabulary does not ship.** In the report "embedded `ft` CLI" named one construction site; in a gRPC error message read by an operator, "the `ft` CLI" names the binary they typed. The claim did not become false — it was always false under the only reading the audience has. This is the same family as R-1: nothing in the supporting analysis was wrong, and the conclusion still misleads.

**Why fourteen arms could not catch it.** M9 deleted this very sentence and correctly turned all three wording subcases RED. **The sentence was among the best-pinned strings in the branch — and no arm ever asked whether it was TRUE.** Presence and truth are orthogonal, and a mutation battery only measures presence. **A pinned falsehood is strictly worse than an unpinned one, because the test suite now actively defends it**: the next person to notice and delete it gets a red build and reasonable grounds to conclude they were wrong. This is backlog item C26 — *an arm battery only covers defects the author imagined* — landing on my own work rather than in the abstract.

**The fix, and why the cheapest one.** Two options were offered. I took the deletion: the clause is gone, leaving `" Only collection import is affected; other operations are unchanged."`, which holds in **every** configuration that can reach the function. I declined to write a narrower replacement exemption, because any replacement is **new unpinned prose making configuration claims**, and this defect is direct evidence that I get those wrong. The comment left at the constant states the obligation on the next editor: no per-caller exemption without a test asserting it is *true* in the configuration it exempts.

**The arm that was missing, now present.** `TestRPC_ImportCollection_RefusalDoesNotDisclaimTheFtBinary` drives `OpenAccessCauseDeliberate` — the cause `dashboard.go:97` actually passes — and asserts the message does **not** claim the CLI/binary is unaffected, across four spellings of the claim. **Genuinely oracle-first**: shown RED against the unfixed constant *before* any code change (`export_import_provenance_test.go:866`, naming the dashboard configuration in the failure text), GREEN after. It carries a control arm requiring the surviving scope clause to still be present, so it cannot pass on a message that says nothing about scope at all — M9′ confirms that control fires.

**M12 is the discriminating pair, and it is the whole argument.** Reverting R3-1 turns the new test RED while leaving `RefusalMessageNamesTheCause` **GREEN**. That green is not a defect in the wording test — it is the *measurement* of the blindness R3-1 identified, reproduced on demand. Before this branch, the entire suite was green on a message that lied to Docker operators.

### Two findings from the arms that generalise

**1. A mutation that does not compile proves the compiler works, not that the test works.**
M1 and M2 initially reported RED — but with **zero failing assertions**. Both were build breaks: deleting the emission loop orphaned variables, and deleting the import-side strip left `strings` imported and unused. I had nearly banked two arms whose "RED" carried no information about the tests at all. Redone as **compiling** mutations (`Tasks[:0]`, and a predicate changed to a never-matching prefix), both went RED via genuine assertion failures. This is the most transferable thing in this finding, and it is the same error class approached from the opposite side as a leg that nearly reported a vacuous zero-diff mutant as a survivor.

**2. A control that no test can kill is usually dead code, and the vacuity is the tell.**
M4 and M6 came back **GREEN** on the first battery — genuinely vacuous.

- **M4** was a bad *oracle*: `minimalImportDoc` stamps `collection.created_at = now`, so substituting the payload timestamp for the server clock landed inside the test's own ±2s window. Unfalsifiable by construction. Fixed by backdating the collection to a second distinct instant (2018) and asserting the stamp matches **neither** payload timestamp, plus M4b asserting the claim *is* preserved.
- **M6** was a bad *fix*. I had stripped provenance rows from exports, and my own code comment gave the reason: their author might be "the nil UUID when the import ran in open-access mode", which would be absent from `users[]` and break the document's self-consistency. **CONDITION 1 had already made that case impossible** by refusing open-access import outright. The strip was defending a scenario that no longer existed, which is exactly why no test could kill it. Removed. Provenance is now exported — it is audit content, and an operator reading an export of an imported collection should be able to see that it arrived by import and who performed it. Replaced with `TestRPC_ExportCollection_CarriesImportProvenance`, which pins that the row is exported, that its author appears in `users[]`, and that **re-importing as a different principal drops the payload's copy and stamps the new importer** (M6′ kills it).

The general form: **a vacuous mutation arm is not only a weak test, it is sometimes a report that the control itself is unreachable.** Both readings need checking before the arm is dismissed.

### Create-vs-merge — measured, not inferred

Provenance is recorded per imported *task*. That is equivalent to per-row here, and the equivalence was measured rather than reasoned from the shape of the code:

- `taskMapping` has 11 references: **1 write, 10 guarded reads.** The single write is `internal/server/export_import.go:318` — `taskMapping[exportedTask.ID] = uuid.New()`. Every read errors when the key is absent, so a payload **cannot** name a pre-existing task.
- Store side: the import transaction uses only `tx.X.Create()`. Negative control — grep for `OnConflict|Upsert|tx.Task.Update|tx.User.Update|tx.Collection.Update` across the transaction body — returned **zero**.

**Import only ever CREATES.** That much holds.

**CORRECTION — the claim I drew from it was false as written.** I wrote that task-level provenance "covers 100% of rows the import writes." It does not. The honest claim is:

> Provenance covers **100% of rows attached to tasks**. An import carrying **no tasks** writes **no provenance row at all**, while still creating a collection and users.

The reviewer found this; I did not. The measurement underneath it was sound — import really does only create, and every task really is stamped — and the error was entirely in the sentence I built on top of it. "Every task is stamped" and "every row the import writes is covered" are the same claim only if every import has tasks, which I never checked. **The denominator I verified was tasks; the denominator I reported was rows.** A correct measurement generalised one step past what it measured, which is harder to catch than a wrong number because every figure in the supporting bullets is still accurate.

**The code is NOT changed on this branch.** Scope is frozen, and the EM has already filed the gap as **A14** in `OUT-OF-SCOPE-BACKLOG.md`. I am not duplicating it and have not filed anything.

### N2-2 at `9f5fadb` — the same defect class, one level down

Round 2 approved with 2 nits. N2-2 is a nit by severity and a member of today's dominant class by shape, which is why it was fixed before landing rather than deferred.

**The missing-token wording subcase asserted `"FARMTABLE_TOKEN"` — a substring the GENERIC FALLBACK also contains** (`"Enable authentication (set FARMTABLE_TOKEN)"`). So it could not distinguish its own branch from the fallback: **green whether the code was right or wrong.** A test present, executing, and measuring nothing. It survived arm M7 — the arm built specifically to catch a message that ignores its cause — and I banked M7 as evidence anyway.

Fixed by asserting `"FARMTABLE_TOKEN is not set"`, the diagnosis only that branch can make. **Demonstrated, not asserted:**

| | missing-token subcase under M7 |
|---|---|
| at `f487dc5` | **PASS** — the defect |
| at `9f5fadb` | **FAIL** — `message does not name "FARMTABLE_TOKEN is not set"` |

The arm compiles, so that RED is an assertion and not a build break, and `git diff --numstat` confirmed the patch applied (1+/1-) *before* the result was read. A fix to an inert assertion that cannot be shown to redden is just a reworded inert assertion.

The *unspecified* subcase still passes under M7, and that is correct: it **is** the fallback branch, so no phrase is unique to it.

**The reviewer's framing, which is the part worth keeping:** this is round 1's finding recurring one level down — at subcase level rather than test level. **A correction scoped to the instances in front of you is the original defect one level up.** In round 1 I fixed the tests I was shown and did not ask which *other* assertions could not distinguish their branch. The same is true of the arms: **an arm battery only covers defects the author imagined, and N2-2 is exactly the gap that leaves.**

**A standing rule earned by the reviewer's own near-miss, recorded because it is the third independent instance today:** its first M11 patch silently failed to apply on gofmt alignment and came back ALL-PASS — which read carelessly is "M11 is a survivor", a false negative that looks exactly like the result you wanted. **A ZERO-DIFF MUTANT REPORTS ON YOUR PATCH, NOT ON THE TEST.** The rule is now: **numstat after every patch, before reading any result.** I applied it to the M7 re-run above.

**N2-1 (comment only).** The unspecified subcase's comment claimed the message "must not guess at [a knob]". It does name one — `(set FARMTABLE_TOKEN)` — as the **remedy**, which is correct. The comment misdescribed working code, so the *comment* changed and the code did not. I initially also strengthened that subcase's `wantNone` and reverted it: the instruction was comment-only and scope was frozen. The opportunity is recorded in the comment instead of taken.

### The defect class this exposed, recorded at the EM's direction

> **I VERIFIED A DENOMINATOR OF TASKS AND REPORTED A DENOMINATOR OF ROWS. THAT IS HARDER TO CATCH THAN A WRONG FIGURE, BECAUSE EVERY SUPPORTING NUMBER STAYS CORRECT.**

The EM's classification, which is sharper than mine: this is **the same family as a corruption that leaves the text readable.** Nothing is false, nothing goes red, and the reader draws the wrong conclusion. There is no failing check to trip because there is nothing wrong with any individual component — the measurement, the grep, the line numbers, the negative control all hold. The defect lives in the *join* between a verified quantity and the noun attached to it.

**Three of five review items shared this shape, which makes it a pattern in the writing step, not five separate slips.** That distinction decides the remedy: five slips get five edits, a pattern gets a habit. The habit, as the EM put it:

> **NAME THE UNIT IN THE SAME SENTENCE AS THE NUMBER.** Not "510" but "510 rows in the manifest at `f487dc5`".

This is the same correction as the artefact rule from earlier today — *state what artefact the measurement is about in the same sentence as the result* — applied one level down, to the unit rather than the binary. Both exist because **the bare sentence is the part that travels**, and it travels stripped of exactly the context that made it true. A number and its unit separated by even one sentence are already two claims, and only one of them was checked.

Applied retroactively to the figures in this report: "510 = 510" now reads **510 rows in `.github/expected-go-tests.txt` = 510 test functions executed by `go test`, at `f487dc5`** — and the two sides being equal is only meaningful because those are the same unit, which is the thing the old phrasing left the reader to assume.

---

## 4. Defect 2 (LOW) — unvalidated imported `users.type`

### ➤ FOR THE ATTENTION OF: `farmtable-architect-auth`

**Status: LIVE.** The owner directed that the auth architecture be left as-is; this finding was measured and is transmitted to the auth design owner. It has **not** been fixed, and nothing on this track has changed the behaviour described below. No validator was added; `resolveImportUsers` type handling was not touched; none of the three `SetType` sites were modified.

### The finding

`ImportCollection` writes `users.type` **straight from the payload with no validation at any layer**. A document can create accounts of type `root`, `Admin`, `service-account`, `reviewr` (typo), or `""`, and all are persisted.

### Enumeration of the three `SetType` sites

All three are inside `ImportCollection` and all three are import-reachable. **They write three different columns**, and only one is the defect:

| Site | Call | Column | Validation | Verdict |
|---|---|---|---|---|
| `entstore.go:2102` | `tx.User.Create().SetType` | `users.type` | **None, at any layer** | **THE DEFECT — LIVE** |
| `entstore.go:2139` | `tx.Task.Create().SetType` | `tasks.type` | None | **Not a defect.** Freeform *by design* — `proto/farmtable.proto:309-311`: "Freeform to accommodate platform-specific types". No vocabulary exists to validate against. |
| `entstore.go:2219` | `tx.Relationship.Create().SetType` | `relationships.type` | **Validated twice** — ent `Enum` at `schema/relationship.go:20`, plus `parseRelationshipType` at `export_import.go:526` and `:848` | Already safe |

This enumeration corrected a standing instruction. I was told that validating one of three sites would make the fix cosmetic; measurement showed the three are unrelated columns and only `2102` was ever the defect. The EM accepted the correction ("My 'N-of-M' warning was itself the error that time").

**These measurements stand on their own.** They do not depend on the removed tests, on any fix, or on the scope ruling. If the ruling is later overruled, the fix is lost and the measurements remain valid.

### The retired oracle — recoverable

Three tests were written against this defect and were **RED at `6dbfc8c` against unfixed code**. They were then removed, not skipped. A skipped test asserting "unknown types must be rejected" still encodes a design decision in the codebase — and that decision belongs to the auth architect, who has not made it. A draft left in the tree becomes the default answer to an open question.

**They are fully recoverable from this document, or with:**

```
git show 6dbfc8c:internal/server/export_import_provenance_test.go
```

Removal commit: `a809849`, which cites the owner directive and this report path.

#### RED output at `6dbfc8c`, against unfixed code

```
=== RUN   TestRPC_ImportCollection_RejectsUnknownUserType
=== RUN   TestRPC_ImportCollection_RejectsUnknownUserType/type=root
    export_import_provenance_test.go:406: ImportCollection accepted unrecognised user type "root"
=== RUN   TestRPC_ImportCollection_RejectsUnknownUserType/type=reviewr
    export_import_provenance_test.go:406: ImportCollection accepted unrecognised user type "reviewr"
=== RUN   TestRPC_ImportCollection_RejectsUnknownUserType/type=
    export_import_provenance_test.go:406: ImportCollection accepted unrecognised user type ""
=== RUN   TestRPC_ImportCollection_RejectsUnknownUserType/type=Admin
    export_import_provenance_test.go:406: ImportCollection accepted unrecognised user type "Admin"
=== RUN   TestRPC_ImportCollection_RejectsUnknownUserType/type=service-account
    export_import_provenance_test.go:406: ImportCollection accepted unrecognised user type "service-account"
    export_import_provenance_test.go:426: collections = 5, want 0: a rejected import still wrote a collection
--- FAIL: TestRPC_ImportCollection_RejectsUnknownUserType (0.01s)
=== RUN   TestRPC_ImportCollection_AcceptsRecognisedUserTypes
=== RUN   TestRPC_ImportCollection_AcceptsRecognisedUserTypes/admin
=== RUN   TestRPC_ImportCollection_AcceptsRecognisedUserTypes/agent
=== RUN   TestRPC_ImportCollection_AcceptsRecognisedUserTypes/reviewer
=== RUN   TestRPC_ImportCollection_AcceptsRecognisedUserTypes/orchestrator
=== RUN   TestRPC_ImportCollection_AcceptsRecognisedUserTypes/viewer
=== RUN   TestRPC_ImportCollection_AcceptsRecognisedUserTypes/human
```

Note the last line: `collections = 5, want 0: a rejected import still wrote a collection`. The unvalidated types are not merely accepted — the import **commits** them.

`TestRPC_ImportCollection_AcceptsRecognisedUserTypes` PASSED at `6dbfc8c`. It is a positive control: it confirms the six recognised types already import cleanly, so the three RED results above are the instrument detecting the substrate, not the instrument being broken.

#### Full source of all three removed tests, verbatim

These assert that (1) `ImportCollection` must reject unrecognised `users.type` values and write nothing, (2) the same holds on the dry-run path, and (3) the six recognised types are accepted — the positive control.

```go
// TestRPC_ImportCollection_RejectsUnknownUserType is the oracle for defect 2.
// exportUser.Type is free-text JSON copied verbatim through to
// tx.User.Create().SetType (entstore.go:2102) with no validator at any layer.
//
// This is input validation and a persistence vector. It is NOT a privilege
// escalation: reaching ImportCollection already requires collection:admin, and
// only wildcard user types hold that, so the privilege delta is zero.
func TestRPC_ImportCollection_RejectsUnknownUserType(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	beforeColls, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Limit: 100})
	if err != nil {
		t.Fatalf("ListCollections: %v", err)
	}

	for _, badType := range []string{"root", "reviewr", "", "Admin", "service-account"} {
		t.Run("type="+badType, func(t *testing.T) {
			userID := uuid.New().String()
			taskID := uuid.New().String()
			email := "bogus-" + uuid.New().String() + "@example.com"
			doc := minimalImportDoc("bad type", []map[string]interface{}{
				{"id": userID, "display_name": "Bogus", "email": email, "type": badType, "status": "active"},
			}, []map[string]interface{}{importTaskDoc(taskID)}, []map[string]interface{}{
				{"id": uuid.New().String(), "task_id": taskID, "author_id": userID, "body": "hi"},
			}, nil, nil)
			data, _ := json.Marshal(doc)

			_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
			if err == nil {
				t.Fatalf("ImportCollection accepted unrecognised user type %q", badType)
			}
			if status.Code(err) != codes.InvalidArgument {
				t.Fatalf("error code = %s, want InvalidArgument (err: %v)", status.Code(err), err)
			}
			users, err := s.GetUserByEmail(ctx, email)
			if err != nil {
				t.Fatalf("GetUserByEmail: %v", err)
			}
			if len(users) != 0 {
				t.Fatalf("a rejected import still persisted %d users with type %q", len(users), badType)
			}
		})
	}

	afterColls, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Limit: 100})
	if err != nil {
		t.Fatalf("ListCollections: %v", err)
	}
	if len(afterColls) != len(beforeColls) {
		t.Fatalf("collections = %d, want %d: a rejected import still wrote a collection", len(afterColls), len(beforeColls))
	}
}

// TestRPC_ImportCollection_DryRunRejectsUnknownUserType pins that validation
// happens at ingestion, before the write, so --dry-run reports the same verdict
// a real import would.
func TestRPC_ImportCollection_DryRunRejectsUnknownUserType(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	userID := uuid.New().String()
	taskID := uuid.New().String()
	doc := minimalImportDoc("dry run bad type", []map[string]interface{}{
		{"id": userID, "display_name": "Bogus", "email": "dryrun-bogus@example.com", "type": "root", "status": "active"},
	}, []map[string]interface{}{importTaskDoc(taskID)}, []map[string]interface{}{
		{"id": uuid.New().String(), "task_id": taskID, "author_id": userID, "body": "hi"},
	}, nil, nil)
	data, _ := json.Marshal(doc)

	_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data, DryRun: true})
	if err == nil {
		t.Fatalf("dry-run accepted unrecognised user type but a real import would reject it")
	}
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("error code = %s, want InvalidArgument (err: %v)", status.Code(err), err)
	}
}

// TestRPC_ImportCollection_AcceptsRecognisedUserTypes is the positive control
// for the test above. Without it, a validator that rejected EVERY type would
// pass the rejection test — the control validates the instrument.
func TestRPC_ImportCollection_AcceptsRecognisedUserTypes(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	for _, userType := range strings.Fields(recognisedUserTypeList) {
		t.Run(userType, func(t *testing.T) {
			userID := uuid.New().String()
			taskID := uuid.New().String()
			doc := minimalImportDoc("type "+userType, []map[string]interface{}{
				{"id": userID, "display_name": "U " + userType, "email": userType + "@example.com", "type": userType, "status": "active"},
			}, []map[string]interface{}{importTaskDoc(taskID)}, []map[string]interface{}{
				{"id": uuid.New().String(), "task_id": taskID, "author_id": userID, "body": "hi"},
			}, nil, nil)
			data, _ := json.Marshal(doc)

			if _, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data}); err != nil {
				t.Fatalf("ImportCollection rejected recognised type %q: %v", userType, err)
			}
		})
	}
}
```

---

## 4b. PRE-REGISTERED PREDICTIONS — written before CI can adjudicate

Recorded at `2ff87d2` on 2026-07-29, **before** EM-CI's runner reaches main, so that nothing here can be quietly reconciled afterwards. When CI re-measures, diff against this table. **Any row that disagrees is a finding and gets reported loudly, including — especially — in my favour.**

### What I expect CI to report for this branch

| Prediction | Value |
|---|---|
| `go list ./...` | 32 packages |
| `go build ./...` | exit 0 |
| `go vet ./...` | exit 0 |
| `go test ./...` | 32 packages, **0 FAIL** |
| Membership gate | ~~0 MISSING, 0 UNEXPECTED (507 = 507)~~ — pre-registered at `2ff87d2`. Superseded at `f487dc5`: **0 MISSING, 0 UNEXPECTED, 510 manifest rows = 510 executed tests** |
| Manifest entries | ~~507 (501 inherited + my 6)~~ at `2ff87d2` → **510 manifest rows at `f487dc5`** (501 inherited + my 9) |
| ~~`gofmt -l` on ~~my 3 files~~ my **6 changed Go files** at `f487dc5`~~ **superseded — see the scoped table below (R3-4)** | ~~0 unformatted files~~ |
| `gofmt -l` repo-wide | **7 files, none mine** — `internal/server/scopes.go`, `internal/serverapp/{linkflows_test,oauth,tokenrefresh,unified_test}.go`, `internal/streaming/{eventbus,eventbus_test}.go`. If CI has no gofmt gate this is invisible; I predict it is invisible. |

**gofmt figures re-stated with the scope named beside every number (review R3-4), measured at `f3b6efa` in `/tmp/verify-f3b6efa`.** The struck figure and its replacement were *different quantities* wearing the same label — "my files" silently changed denominator between them, which is the R-1 defect recurring a third time. Each row below names what is being counted and over which range:

| Quantity — scope stated | Figure |
|---|---|
| Go files **this branch changed**, cumulative `43bd206..2ff87d2` | 3 |
| Go files **changed by commit `f487dc5` alone** | 6 |
| Go files **this branch changed**, cumulative `43bd206..f487dc5` | 7 |
| Go files **this branch changed**, cumulative `43bd206..f3b6efa` | 7 |
| `gofmt -l` over **just those 7 branch-changed Go files** at `f3b6efa` | **0 unformatted** |
| `gofmt -l` over the **whole tree** at `f3b6efa` | **7 unformatted** |
| `gofmt -l` over the **whole tree** at base `43bd206` | **7 unformatted** |

**3, 6 and 7 are three different denominators, and the whole-tree 7 is a fourth quantity that merely collides numerically with the branch-changed 7.** That collision is the trap: two unrelated measurements printing the same digit, in adjacent rows, is how an unnamed unit survives review.

**A measurement that disagrees with the correction I was handed, reported as such.** The round-3 note characterised the whole-tree figure as "7 = cumulative at `f487dc5`", implying it accumulated over the branch. It does not. The whole-tree gofmt count is **7 at every one of the eight commits `43bd206`, `6dbfc8c`, `a809849`, `33f59e8`, `2ff87d2`, `f487dc5`, `9f5fadb`, `f3b6efa`** — the identical 7 files at each, all present already at the base. **The branch introduced zero gofmt-dirty files and cleaned zero**; the intersection of the 7 dirty files with the 7 files this branch changed is **empty**. So the figure is invariant, not cumulative, and `internal/server/scopes.go` remains untouched by this track as directed.

**Correction to this table's own integrity, at `f487dc5`.** When re-registering for round 2 I *overwrote* the `2ff87d2` figures instead of striking them through. That is precisely the wrong move in a pre-registration block: a prediction that can be edited after the fact is not a prediction. The original values are restored above, struck through, with the SHA each belongs to. Recorded rather than silently repaired, because the block's whole value is that it cannot be quietly reconciled.

### Per-arm predicted RED sets

Each arm reverts one control and must turn the listed tests RED **via assertion**, not via build break. Deltas are non-zero for all seven, so no arm is a no-op mutant.

| Arm | Predicted RED tests | Count |
|---|---|---|
| M1 provenance row not emitted | `StampsImporterProvenance`, `StampsEveryImportedTask`, `ProvenanceNeverNamesAPlaceholder`, `ExportCollection_CarriesImportProvenance` | 4 |
| M2 namespace strip never matches | `PayloadCannotForgeProvenance`, `ExportCollection_CarriesImportProvenance` | 2 |
| M3 absent-identity refusal removed | `RefusesImportWithoutIdentity` | 1 |
| M4 ingestion time from payload | `StampsImporterProvenance` | 1 |
| M4b payload claim not preserved | `StampsImporterProvenance` | 1 |
| M5 provenance author not the importer | `StampsImporterProvenance`, `ExportCollection_CarriesImportProvenance` | 2 |
| M6′ export strip re-added | `ExportCollection_CarriesImportProvenance` | 1 |
| M7 message ignores cause | `RefusalMessageNamesTheCause` **only** — `RefusalDoesNotDependOnOpenAccessCause` must stay **GREEN** | 1 |
| M8 cause grants passage | `RefusalDoesNotDependOnOpenAccessCause`, `RefusalMessageNamesTheCause` | 2 |
| M9 CLI-unaffected sentence removed | `RefusalMessageNamesTheCause` (all 3 subcases) | 1 |
| M10 `WithOpenAccessCause` no-op | `RefusalMessageNamesTheCause` | 1 |
| M11 env mapping blames wrong knob | `TestOpenAccessCauseForMapsEveryConfiguration` | 1 |
| **baseline (unmutated)** | **none — all green** | 0 |

M7's prediction is deliberately a *mixed* one: an arm that turns everything red proves less than an arm that turns red exactly what it should and leaves the rest alone. If M7 also killed `RefusalDoesNotDependOnOpenAccessCause`, that test would be reacting to wording and would not be an invariance test at all.

### Predictions that would falsify parts of my reasoning

Stated explicitly so they cannot be quietly dropped:

- **If any arm comes back GREEN in CI that was RED here**, the corresponding control is not doing what I claim and the finding is wrong, not the runner.
- **If `ExportCollection_CarriesImportProvenance` is flaky**, my removal of the export strip is under-specified.
- **If `StampsImporterProvenance` fails on a slow runner**, the ±2s ingestion window is too tight — that is a real defect in my oracle, not an infrastructure excuse, and the fix is a wider window, never deletion of the timestamp assertion.
- **If the membership gate reports MISSING**, my 9 entries do not match the runner's name extraction and I got the format wrong.
- **If M7 turns `RefusalDoesNotDependOnOpenAccessCause` RED**, that test is coupled to message text and my claim that it pins an *outcome* invariant is wrong.
- **If M8 comes back GREEN**, the invariance test is vacuous — it would be passing only because the refusal is currently unconditional, which is exactly the failure mode it exists to rule out.
- **If `TestOpenAccessCauseForMapsEveryConfiguration` fails on `FARMTABLE_OPEN_ACCESS` being read from the real environment**, I have failed to keep it a pure function and it is no longer a wiring test.

## 5. Things I surfaced but did NOT fix

| Item | Why untouched |
|---|---|
| `internal/server/scopes.go` is **gofmt-dirty** | Not mine, pre-existing at `faf1c8c`. More importantly it is *the auth file* — out of scope project-wide by owner declaration, with a dedicated architect holding that area. A gofmt-only touch would collide with live work and would read in a diff exactly like a hardening track quietly editing the scope table. Recorded as a known cosmetic defect; **not fixed by this track.** |
| 6 other gofmt-dirty files at `43bd206` | `internal/serverapp/{linkflows_test,oauth,tokenrefresh,unified_test}.go`, `internal/streaming/{eventbus,eventbus_test}.go`. All inherited, none mine. There appears to be no gofmt gate in CI, only vet. Flagging, not fixing. |
| Copylock quartet in `server.go` | Fixed upstream at `43bd206` via `proto.Clone`. Moot; not re-reported. |
| `web/package.json` test script | Not touched. Held pending EM-CI's shared multi-file runner. |
| `scripts/ci-suite-manifest.mjs` | Not touched, per standing instruction. |
| **Manifest accounting across the two tracks — a merge-time hazard, not a defect in either branch** | My branch and the other hardening track each add rows to `.github/expected-go-tests.txt`. The two sets have **zero overlap**, so neither can clobber the other. **The two accountings must never be added together.** Each track's before→after is measured against a base that already excludes the other's rows, so summing them double-counts the shared base and produces a total that matches no tree that will ever exist. Membership is **re-derived at the merge commit**, not carried forward from either branch's figure. My branch's own figure is `501 → 511` over `43bd206..f3b6efa`; it is valid **only** for that range and is not an input to the post-merge count. Flagged for whoever merges; nothing for me to change. |

## 6. Two EM rules this work independently contradicted

Recorded because the pattern matters more than either instance.

1. **"Update the manifest in the same commit or the gate fails."** Measured false. `.github/workflows/ci.yml` (lines 370–408) makes the gate **deliberately asymmetric**: MISSING → FAIL, UNEXPECTED → `::notice::` only, explicitly "not a failure". The workflow's own comment gives the reason: *"forcing a manifest edit in the same commit trains people to regenerate the manifest reflexively -- which is how a genuinely missing test would get rubber-stamped back to green."* I reached this independently before the correction landed; two other legs did too. I added **only my own tests, by name, in sorted position** (six at `2ff87d2`, three more at `f487dc5`), and asserted programmatically that every pre-existing line survived byte-for-byte and in order. The manifest was **not regenerated**.

2. **"`go vet` and `go build` are unusable as evidence here."** True at `faf1c8c`, false at `43bd206`. Corrected in section 1 rather than left standing as a stale caveat.

Both rules were true when made and both outlived their truth. **A standing rule is a measurement with an expiry nobody wrote down.**

## 7. Deliverables

- **Branch** `import-hardening` at ~~**`f487dc5`**~~ **`f3b6efa`** (`f3b6efaafd4722f68eb48466e793c3a46daf94eb`), based on `43bd206`, ~~five commits~~ **seven commits, NOT PUSHED.** Push URL on this clone is `DISABLED_NO_PUSH`. Confirmed **not** an ancestor of canonical `main` (`2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`, resolved **by name** in `/workspace/farmtable`), `git merge-base --is-ancestor` exit **1**, 7 commits unmerged.
- **This report.**
- **Project log:** `/workspace/farmtable/.design/project-log/2026-07-29-dev-import-hardening.md`

### Review round 2 — what `f487dc5` discharges

| Review item | Disposition |
|---|---|
| **REQ 1** — unforgeable provenance | **No new work, per the EM's instruction.** Already satisfied structurally; a belt-and-braces guard was explicitly declined because the structure is the proof and a redundant guard would be an unreachable branch — the very thing nit N-1 removes. |
| **REQ 2** — refusal names the cause | **Done**, plumbed at wiring time, not `os.Getenv` in the handler. Section 2, "REQ 2" heading. Arms M7–M11. |
| **R-1** — task-less import writes no provenance | **Claim corrected, code deliberately unchanged.** Section 3, "Create-vs-merge". Scope frozen; the gap is the EM's **A14** in `OUT-OF-SCOPE-BACKLOG.md` and I have **not** duplicated it. |
| **Item 3** — canary attribution | **Narrowed from three subcases to one**, in the report *and* enforced at runtime in the test. Section 2. |
| **Nit N-1** — unreachable `json.Marshal` error branch | **Taken.** Removed, with a comment recording the condition under which it should return. |

Three of the five items were errors in **what I claimed**, not in what the code does. The measurements behind them were sound; the sentences built on them over-reached. That is the failure mode this round actually surfaced, and it is harder to catch than a wrong figure because every supporting number stays correct.

### Review round 3 — what `f3b6efa` discharges

| Review item | Disposition |
|---|---|
| **R3-1** — refusal message falsely claims the `ft` CLI is unaffected *(merge-gating, shipping code)* | **Fixed.** Clause deleted; only the unconditionally-true scope sentence remains. New oracle-first arm `RefusalDoesNotDisclaimTheFtBinary` shown **RED before, GREEN after**. Invariant list and justification comment updated. Arms M9′ and M12 added; M12 is the discriminating pair. Section 3, "R3-1 at `f3b6efa`". |
| **R3-2** — manifest range unstated | **Struck in place**, original legible. All three ranges tabulated; **subsequence proof promoted to the headline** because the row count alone cannot distinguish add-by-name from a regenerate that lands on the same total. Section 1. |
| **R3-3** — "7 of 7" over a table of twelve | **Struck in place.** Now **14 of 14**, denominators named per anchor commit. Recorded that this error *understated* my own work and that I missed it while catching inflating errors. Section 3. |
| **R3-4** — struck gofmt figure and its replacement are different quantities | **Struck in place**, replaced by a table naming the scope beside every number, and **a measurement that disagrees with the correction**: the whole-tree 7 is invariant across all eight commits, not cumulative. Section 4b. |
| **Not-my-defect** — cross-track manifest accounting | **Recorded, nothing changed.** Zero overlap; the two accountings must never be summed; membership re-derived at the merge commit. Section 5. |

**The one that matters is R3-1, and it is a different species from rounds 1 and 2.** Those were errors in what I *claimed*. This was an error in what the code *says to a user*, defended by a passing test. Fourteen mutation arms, a manifest gate, `vet`, and a green suite all held steady over a sentence that told Docker operators their configuration was unaffected while refusing their import. **Every instrument I built measures whether a string is present. None measured whether it was true.**

### Preservation — answering the `st_dev` question

Measured, not read off the path, since the failure being described is exactly that of trusting a plausible label:

| Path | `st_dev` | Filesystem | |
|---|---|---|---|
| `/workspace/farmtable-import-hardening` — **my clone** | **2049** | `/dev/root` | **host-backed, in the EM's namespace, already covered** |
| `/workspace/farmtable` | 2049 | `/dev/root` | |
| `/scion-volumes/scratchpad` | 2049 | `/dev/root` | |
| `/tmp/verify-f3b6efa`, `/tmp/arms4` | **164** | **overlay** | container-local — unreachable by any sweep from outside |

My clone is host-backed, so the one-line answer applies. **But the question is worth asking of my throwaway clones too**, and I checked rather than assuming: every commit reachable in both `/tmp` clones was tested with `git cat-file -e` against the host-backed clone — **0 commits exist only on the overlay**, with both controls fired **unpiped** (`f3b6efa` rc=0; fabricated SHA rc=1). The arms produced no commits, which is why; that was already recorded in `ARM-DEFINITIONS.md` for exactly this reason.

**Bundle refreshed for the new tip** (the earlier ones under `salvage/` are stale at `9f5fadb`):

- `/scion-volumes/scratchpad/projects/farmtable/bundles/import-hardening-f3b6efa-COMPLETE.bundle`
- **3,107,025 bytes, 226 refs**, sha256 `67f4d9f0035387bf304d8a7e35d450feaecabc4b4caaf76e7b337d6a212d61b6`
- Reflog re-sweep at the new tip promoted **0** further refs (the 14 `refs/preserve/*` from the earlier sweep were already in place).
- **Verified by RESTORING, not by `git bundle verify`:** cloned the bundle to a scratch dir; all **7 branch commits and all 5 known orphans** (`3fc9792`, `56d3f00`, `9a68bf1`, `c33b5dc`, `d5e3f00`) return rc=0; fabricated SHA returns rc=1; the restored tree at `f3b6efa` hashes identically to the source (`e24d0db3410ae9a0f773ba17a2ff0b97c312c3c4`).
