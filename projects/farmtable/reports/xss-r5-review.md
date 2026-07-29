# xss-r5 (`url-scheme-validation-r5`): remote_data XSS hardening — Code Review

I reviewed a private local clone at `/workspace/farmtable-xss-r5-review`, detached at
`git rev-parse HEAD` = `d305391ee6dc473f5e7bf202167221e15cf52e10`, base `e6bda71`, 13 commits,
`git status --short` empty at the time of every measurement below.

**Claim tags:** `[MEASURED]` = I ran it. `[DERIVED]` = follows from something I measured.
`[REASONED, NOT MEASURED]` = argued from reading only. `[UNCHECKED]` = stated, not verified.
**Citations are by content**, not line number, except where I am auditing a line number the
code itself asserts.

**Pass tags are soft this round — see WHERE MY BRIEF WAS WRONG.** I read the brief in full,
including section 4, before my open pass, because my dispatch instructed me to. The EM has
since confirmed the brief was controlling and the dispatch was wrong. I have tagged findings
honestly but I cannot certify the split, and you should discount it.

---

## Executive Summary

Risk level: **MEDIUM**. The *behaviour* of this change is sound and in several places a real
improvement — the discarded-error bug is genuinely fixed, and the nested-carrier sanitizer
work holds up under measurement. What blocks it is that several newly shipped justification
comments and test names would lead a competent engineer six months from now to a **false**
conclusion: one says a log line "CANNOT FIRE TODAY" (I fired it), another contradicts it
forty lines away, and the round's headline property is pinned by a test that never touches
the code that produces it.

Verdict: **REQUEST CHANGES**, on six Required findings. None requires redesign; five are
comment/test-wiring corrections and one is a log-volume fix.

---

## Critical

None. `[MEASURED]` — I found no path on which this change makes XSS more reachable than at
`e6bda71`, and the fail-closed accidents it documents are real.

---

## Required

### R1. `collectionToProto`'s "THIS LOG LINE CANNOT FIRE TODAY" is false, and its cited evidence points at the wrong entity `[MEASURED]` `[PASS-1, soft]`

The collection call site in `convert.go` carries:

> **NOTE: THIS LOG LINE CANNOT FIRE TODAY.** … no input path to a COLLECTION's remote_data
> can carry a Go type structpb rejects. Every writer of Collection.RemoteData feeds it a
> value that was decoded from JSON or from a structpb request (entstore.go:408, :898, :2117)

Three separate problems, in increasing order of severity:

1. **The citations name the wrong entity.** `entstore.go:408` and `:898` are the **Task**
   Create and Task Update `SetRemoteData` sites. The two actual Collection writers —
   `CreateCollection` and `UpdateCollection`, at `:1366` and `:1399` — are **not cited at
   all**. `[MEASURED]` Only `:2117` (ImportCollection's collection) is a genuine Collection
   writer.
2. **This is worse than a stale citation**, and it is why I am not filing it as a nit. The
   line numbers *resolve*. A future reader who does the responsible thing and checks that
   the pointer still lands somewhere gets a green light, lands in `entstore.go` on a real
   `SetRemoteData` call, and never notices it is the wrong half of the file.
3. **The stated reason is the wrong kind of reason.** The comment asserts a *type* property
   ("no input path … can carry a Go type structpb rejects"). I falsified it: I passed a
   Go-native `map[string]string` straight into `CreateCollection` and **fired the log line**.
   `[MEASURED]`

The **conclusion** survives — the line does not fire in production — but for a reason the
comment never states, and a stronger one: **no in-tree caller populates
`CreateCollectionParams.RemoteData` at all.** `[MEASURED]` — `server.go`'s two construction
sites and `graph_routing.go`'s mirror-collection site all omit the field. That is a *caller*
property, not a type property, and it is the one a reader needs, because it tells them the
exact thing that would invalidate it: someone setting that field.

**Fix:** replace the paragraph with the caller-property reason, cite `:1366` and `:1399`, and
downgrade "CANNOT FIRE TODAY" to "has no caller today." Name the invalidating event.

### R2. Two comments added in the same change give opposite epistemic verdicts on the same question `[MEASURED]` `[PASS-1, soft]`

The `structOrNilLoggingErr` doc comment says of the collection half:

> **I am NOT recording that as unreachable.** Two searches were clean, and a clean search is
> not a bound; a value can also arrive by assignment after construction…

Forty lines later the call site says **"THIS LOG LINE CANNOT FIRE TODAY."**

These cannot both be the standard. The first is the better epistemics and the second is what
a reader will act on, because it is the one adjacent to the code and it is in capitals. As
shipped, the file argues with itself, and a reader in six months resolves the conflict by
whichever one they read second.

**Fix:** pick one. Given R1, the honest version is the first, refined: *no caller populates
this today; a clean search is not a bound; here is what would change that.*

### R3. The round's headline property is pinned by a test that never touches the code that produces it `[MEASURED]` `[PASS-1, soft]`

`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` is careful in most respects — two
independent carriers, non-carriers asserted rather than assumed, a stated enumeration
boundary, a positive control. But every assertion is made against a **hand-typed literal**:

```go
labels := []string{"bug"}
```

The type under test — the entire subject of the property — is chosen by the test author, not
obtained from the code under test. **No test anywhere in this repository calls
`issueBuildRemoteData` or `issueLabels`.** `[MEASURED]` — every reference in the tree is
production code or a comment, and `internal/platform/github` never imports `structpb` at all.

The consequence is precisely the failure mode this test's own doc comment warns about, one
level up. The comment says:

> If someone "fixes" labels to `[]any`, this test would go green while remote_data STILL
> never serialises, because sub_issues is independently unrepresentable.

Correct — and it fixed that by adding the second carrier. But if someone changes
`issueLabels` to return `[]any`, **every assertion in this test still passes**, because the
test builds its own `[]string`. What is pinned is `structpb.NewStruct`'s treatment of three
literal Go types. That is a test of the standard library. The producer is unpinned.

This is the §10.25 / §10.10 shape: the plant's environment *and its type* come from the same
hand that wrote the claim, so it inherits the claim's blind spots.

**Fix:** add one test in `internal/platform/github` asserting
`structpb.NewStruct(issueBuildRemoteData(...))` returns an error, built from a real
`issueNode` fixture. That is the assertion that actually fails when the premise dies. Keep
the existing test as the mechanism explainer.

### R4. This change adds a new line-based Go scanner into a package that has already recorded a measured verdict against line-based Go scanners — and it carries one of the exact defects that verdict lists `[MEASURED]` `[PASS-1, soft]`

`remotedata_depth_test.go` gains `maskGoLiterals`, `remoteDataAssignment`, and
`firstTopLevelSeparator` — roughly 150 lines of hand-rolled lexing. `[MEASURED]` — all three
are `+` lines in the delta.

Meanwhile `urlvalidate_differential_test.go`, **in the same package and already at the base
commit**, carries a section headed *"WHY THIS IS AN AST WALK NOW, having been a line
scanner"*, which lists three measured failure modes of the old line scanner and concludes:

> The parser has no such failure modes and is in the standard library. **A text-scan of Go
> source was the wrong tool**; this says so rather than adding a fourth special case to it.

`go/ast` and `go/parser` are already imported in that file at `e6bda71`. `[MEASURED]`

The second failure mode that note lists is *"a one-line literal, `map[string]any{"html_url":
u}`, opened a frame that never closed and contributed no keys."* **I measured the new scanner
reproducing that same class.** `[MEASURED]` — with two controls green (a plain assignment and
a composite field on its own line are both seen correctly), these four ordinary,
gofmt-stable Go shapes are **silent misses** — not reported violations, invisible:

| shape | result |
|---|---|
| `p := store.CreateTaskParams{RemoteData: rd}` | *** SILENT MISS *** |
| `use(&pb.Task{RemoteData: raw})` | *** SILENT MISS *** |
| `return store.ImportTask{RemoteData: t.RemoteData}` | *** SILENT MISS *** |
| `}, RemoteData: raw})` (line begins with a closer) | *** SILENT MISS *** |

Mechanism, confirmed by the returned `rhs`: `remoteDataAssignment` splits at the **first**
top-level separator and inspects only the text to its left, so a single-line composite
literal splits at `:=` and the left side is just `p`. `firstTopLevelSeparator` tracks bracket
depth per line, so a line starting with a closer goes to `depth == -1` and the `:` arm's
`if depth != 0 { continue }` skips it.

This matters because `remoteDataAssignment`'s own doc comment makes a **universal** claim:

> `x, err =`, `x, _ =`, `s.f[i].RemoteData =`, `a.b.C.RemoteData, ok =` and **shapes nobody
> has thought of are all visible without being predicted**.

That is measured false. And the shape table `TestRemoteDataAssignmentSeesEveryShape` cannot
catch it: its 8 site rows and 7 reject rows are each a single hand-written line in isolation,
and **none is a single-line composite literal or a closer-first line.** `[MEASURED]`

I want to be fair about what happened here, because the diagnosis in commit `5b7dae4` is
*right*: it rejects widening the regex on the grounds that doing so "moves the blind spot
instead of closing it." That reasoning is correct and it is the reasoning that should have
selected `go/parser`.

**Fix:** rewrite `remoteDataAssignment` over `go/ast` — the imports and the precedent are
already in the package — or, if that is too large for this change, **delete the universality
sentence from the doc comment** and add the four shapes above to the reject table as known
blind spots. Shipping the sentence as written is the part I am blocking on.

### R5. `TestEphemeralGraphRouteDropsRemoteData` never calls the graph route `[MEASURED]` `[PASS-2]`

The test constructs `taskToCreateParams` directly and then calls `ephemeral.CreateTask` /
`GetTask`. It never calls `loadEphemeralStore`. `[MEASURED]`

Applying §10.25 as a reading criterion: the fixture places the target in a hand-assembled
environment rather than in the real routing path, and so **it could not fail** if
`loadEphemeralStore` acquired a second way to populate `RemoteData` — a later field copy, or
the `createRelationshipViaUpdate` second pass. The property the name asserts is about the
route; the measurement is about one helper function on that route.

The two named controls are real and I credit them. The scope of the name is the problem.

**Fix:** either drive the assertion through `loadEphemeralStore` against a seeded source
store, or rename to `TestTaskToCreateParamsOmitsRemoteData` and state in the doc comment that
the rest of the route is unmeasured.

### R6. The new log line fires once per task on every passthrough read, and carries no identifier `[DERIVED]` `[PASS-1, soft]`

`structOrNilLoggingErr` replaces a silently discarded error with `log.Printf`. Surfacing that
error is the right call. The volume is not:

- `issueLabels` returns `make([]string, len(...))` — never nil. `[MEASURED]`
- `issueBuildRemoteData` sets `"labels"` unconditionally in the map literal. `[MEASURED]`
- So **every** passthrough task carries an unrepresentable value and logs. `[DERIVED]`
- The list handler loops per task; `defaultPageSize` is 50, capped at 200. `[MEASURED]`

That is 50–200 identical lines per list call. The message is
`task.remote_data dropped: sanitized remote_data is not structpb-representable: proto:
invalid type: []string` `[MEASURED, H4]` — no task ID, no issue number, no key. High volume,
near-zero diagnostic value, and it is a new operational regression on a hot read path.

**Fix:** log once per call rather than once per task (accumulate a count in the list handler),
or gate behind a `sync.Once` / rate limiter, and include the offending key. Including the key
would also make the passthrough case self-identifying.

---

## Nit / Optional

- **O1.** `structOrNilLoggingErr` is 7 lines of code under ~55 lines of doc comment. Some of
  that is R1/R2 material that should shrink on its own. The remainder reads as a design
  discussion that belongs in the project log, not the function header.
- **O2.** The scanner test uses `filepath.Join("..", "..", "internal", "server")` to reach the
  package it is compiled into. `"."` is correct and cannot break under a directory move.

---

## FYI

- **F1. A real depth-accounting divergence between the sanitizer and the import validator,
  which is pre-existing and outside this delta.** `[MEASURED]` The two `[]map[string]any` arms
  of `validateRemoteDataValue` recurse at `depth+1`, while the sanitizer's equivalent path
  goes through `sanitizeRemoteValue` and recurses again at `depth+2`. Against `maxRemoteDataDepth
  = 32` the two therefore disagree about where truncation begins. `validateRemoteDataURLs`'s
  doc claims "the same traversal, at the same depths, over the same URL-bearing-key predicate,"
  which is measurably not true.

  **Production reachability is nil** `[DERIVED]`: the only production caller is fed
  JSON-decoded data, and `encoding/json` cannot produce `[]map[string]any`. Not blocking, and
  not this change's fault. The precise fix, if you want it in a follow-up: route both
  `[]map[string]any` arms through `validateRemoteDataValue(..., depth+1)` to mirror the
  sanitizer.

  Worth noting alongside it, as a §10.25 point: `TestSanitizeAndImportAgreeAtEveryDepth`'s
  name promises "every depth," but its seven wrappers bottom out around depth 4 against a
  bound of 32. `[MEASURED]` The environment its fixtures build **cannot reach** the region
  where I measured the two traversals diverging.

- **F2. My third-path hunt came back negative, and I am reporting it as instructed.** Details
  under *Persistence premise* below.

---

## Positive Feedback

Not manufactured; these are things I checked and found genuinely good.

- **Every one of the 26 `file.go:NNN` citations added by this diff resolves correctly at
  `d305391`.** `[MEASURED]` I pre-registered staleness as a hypothesis and it was refuted.
  (R1 is not a counterexample: those two resolve *precisely*, to the wrong thing.)
- **The `metadata` exemption reason — the round's own repair — is fully verified.** `[MEASURED]`
  I measured the step the shipped reason itself marks `[REASONED, NOT MEASURED]`:
  `json.RawMessage` → ent `field.TypeJSON` → read back as `map[string]interface{}`; the
  sanitizer then reaches inside and drops a nested `html_url: javascript:…`; the result is
  representable and reaches the wire. Every clause of that reason string is now measured true.
- **`TestScannedServerPackageRemoteDataWriteSitesSanitize` pins membership, not totals**, states
  its scope in its own name, and separates four assertions. "NO TOTAL IS PINNED ANYWHERE" is a
  discipline I wish more of the suite had.
- **`TestMapStringStringStaysUnrepresentable_GuardsO1` is the best-constructed test in the
  diff.** Its two `t.Fatalf` preconditions are genuine anti-vacuity guards, and — unusually —
  its failure messages tell a future reader *which* of two very different things has happened
  and what to do about each. The distinction it draws between "normalise on ENTRY" and
  "normalise at the EXIT" is the correct and non-obvious one.
- **`TestRemoteDataKeyClassification` checks anti-vacuity in both directions.**
- The extraction of three inline `t.Errorf` arms into `classifyRemoteDataKeys` returning typed
  `remoteDataKeyIssue` kinds is a real readability improvement.

---

## Test Coverage

New paths are covered, with two structural gaps, both filed above: the producer of the
headline property is untested (**R3**) and the graph route is asserted but not executed
(**R5**). The new scanner has measured blind spots its own table cannot see (**R4**).

I did **not** run the full suite — see WHAT I DID NOT CHECK.

---

## Backward Compatibility

No wire-format change. `remote_data` moves from "silently absent because the struct failed to
build" to "absent, and logged." No field removed, no field added, no proto change. `[MEASURED]`
The only externally visible delta is log output (**R6**).

---

## Final Verdict

**REQUEST CHANGES**

**Blocking:** R1, R2, R3, R4, R5, R6.
**Not blocking, disposition still owed:** O1, O2, F1.

I want to be explicit about the character of this, because "six Required" overstates the
danger. **The code is close to right.** Five of the six are corrections to what the change
*says about itself*, and R6 is a two-line volume fix. None needs a redesign. But the defect
class this round exists to eliminate is "correct code with a wrong explanation attached," and
R1, R2, R3 and R4 are all instances of exactly that, shipped in the change that is supposed to
be removing them.

---

## Persistence premise — my assigned item, enumerated independently

I enumerated by **transformation**, not by file: every way a `map[string]any` could be
type-normalised. (a) `encoding/json` round trip, (b) an ent write + read, (c) a structpb/proto
round trip, (d) a deep copy, (e) gob/yaml/cbor, (f) an API boundary that re-parses.

Search space `[MEASURED]`: all non-test, non-generated `RemoteData` references repo-wide; all
`json.Marshal` / `Unmarshal` / `NewDecoder` / `NewEncoder` / `protojson` / `proto.Marshal` /
`gob.` / `yaml.Unmarshal` in `internal/` and `cmd/`; all `store.Store` implementations; all
`taskToProto` call sites.

Result: **I did not find a third path.** Two candidates that looked live and died:

- **Export → import** looked like a genuine third path (`taskExport` → `json.MarshalIndent` →
  `json.NewDecoder` → `store.ImportTask`). **`ExportCollection` refuses any collection whose
  platform is not `farmtable`**, so a passthrough collection can never enter it. `[MEASURED]`
  Pre-registered falsifier fired; negative.
- **A `json.Marshal`/`Unmarshal` pair in `server.go`** looked like an in-process deep copy. It
  is `pageCursor` encoding, not a task. `[MEASURED]` Negative.

`MultiStore` is a pure delegator with no serialisation; `internal/streaming/eventbus.go` and
`internal/convert/convert.go` contain no `RemoteData` and no `json.` calls; `internal/mcp`
marshals for output only. `[MEASURED]`

**The author's two-path claim survives an independent enumeration.** I am reporting this as a
negative result and I think it is worth as much as a third path would have been, because it
was pre-registered and the search space is stated above so you can audit what I did not cover.

---

## WHERE MY BRIEF WAS WRONG

1. **The dispatch and the brief contradicted each other, and I obeyed the wrong one.** The
   dispatch said read the brief "FIRST AND IN FULL"; the brief said do not read section 4
   until pass 1 is done. I read section 4 first. **My PASS-1 / PASS-2 split is therefore
   contaminated and you should treat every `[PASS-1, soft]` tag as unverified self-report.**
   I have not retroactively re-tagged to look better. The EM has since confirmed the brief was
   controlling; I am recording it here because the tags are the measurement and the
   measurement is degraded.

2. **The mandatory shared `_run-queue-log.md` broke three-leg independence.** The brief
   requires every leg to append pre-registered predictions to one shared file *before*
   running. That makes it a cross-leg channel. **I read the test leg's pre-registered
   predictions while appending my own**, and one of them duplicates a finding I had already
   reached independently and earlier in my transcript. For that finding you now have two
   reports and one-and-a-bit legs of evidence, and no way to tell from the outside which.
   **Fix for next round:** per-leg queue files, reconciled by the EM after all legs report.
   The serialisation goal does not require a shared *readable* file.

3. **"Run the project's build, lint, and test commands" (my role template) is unsatisfiable
   under the build fence.** The fence requires a token you hold and grant serially; the
   template requires a verdict backed by a full run. I resolved it by bounding the gap
   explicitly below rather than by requesting the token, because brief section 4 item 6 states
   the suite is not currently a trustworthy oracle (`main` is RED), which makes a full green a
   weak signal and a full red an ambiguous one. **That was my judgement call and you may
   disagree with it** — if you want the token spent on a full run, I will do it.

4. **Minor, but it cost me time:** `web/dist` is gitignored, so a `--local` clone of the repo
   cannot run `go build ./...` from its root at all. Any leg told to clone and build hits this.
   Worth putting in the tree table in section 0.

---

## WHAT I DID NOT CHECK

- **The full test suite. I never requested the build token.** No `go build ./...`, no
  `go test ./...`, no `make test`, no `npm test`. Everything above rests on single-package
  runs of `./internal/server/` plus reading. **I do not know that this branch is green**, and
  in particular I have not run the web half (`web/src/util/*.test.ts`), which `CLAUDE.md`
  identifies as the client-side half of this very security property. This is the largest gap
  in my review.
- **`go vet` beyond one unplanned single-package run** on `./internal/server/`.
- **The security-auditor's angle**, deliberately: I did not attempt exploit construction, and
  I did not assess whether the sanitizer's URL scheme predicate is complete. A Critical of
  "none" from me is a statement about the delta's *logic*, not a clearance of the guard.
- **The test-engineer's angle**, deliberately: I did not do systematic mutation testing. R4's
  blind spots were found by direct probing of one function, not by a mutation sweep, so
  **there may be more of them** — I measured four shapes because I predicted four, which is
  exactly the "shapes nobody has thought of" problem the doc comment claims to have solved.
- **Postgres.** All measurement was SQLite. The ent round-trip behaviour in F1/the metadata
  verification is `[UNCHECKED]` against Postgres.
- **§10.25 compliance of my own controls.** My R4 probe's two positive controls each placed
  the target alone on its own line — the exact arrangement §10.25 warns about. They were
  adequate for their purpose (proving the instrument can return `true` at all) and the finding
  rests on the *misses*, not the controls. But per the EM's instruction I am stating it rather
  than quietly re-running: **my controls do not meet §10.25 point 1, and I did not pad them.**
- **Whether R4's blind spots are reachable by any *current* write site.** I measured that the
  scanner cannot see four shapes; I did **not** sweep the tree for existing code in those
  shapes. `[UNCHECKED]` The finding is about the guard's coverage claim, not about a live
  unsanitized write.

---

## Method notes

- Production code was never modified. All probing was done in added `zz_reviewer_probe*_test.go`
  files, deleted afterwards, with `git status --short` verified empty and
  `sha256sum` recorded for `convert.go`, `urlvalidate.go` and `remotedata_depth_test.go`.
  `[MEASURED]`
- Nothing was pushed. The clone is detached at `d305391`; `git rev-parse --abbrev-ref HEAD`
  returns `HEAD`, so `url-scheme-validation-r5` cannot have moved. `[MEASURED]`
- One instrument error, self-caught and disclosed publicly in `_run-queue-log.md` rather than
  silently replaced: my first RV-1 probe put a **bad** URL at the leaf, which made
  `dropped == errored` at every chain length and **could not have failed**. It returned green
  and the green was worthless. Re-run with a good URL, each side's flip point became visible
  and the F1 divergence appeared immediately. I mention it because it is a §10.25 instance I
  committed *before* reading §10.25.
