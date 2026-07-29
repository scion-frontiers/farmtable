# 2026-07-29 — Round 5 code review of `url-scheme-validation-r5` (d305391)

Code-review leg of a three-way independent review. Angle: correctness, architecture,
readability, and whether the change means what it says. Reviewed a detached local clone at
`d305391ee6dc473f5e7bf202167221e15cf52e10`, base `e6bda71`, 13 commits.

Full report is on the scratchpad volume at `reports/xss-r5-review.md` (not tracked in git).
This entry records the durable conclusions only.

## Verdict

**REQUEST CHANGES.** Six Required findings, no Critical. The behaviour of the change is sound
and the discarded-`structpb` error fix is a real improvement. What blocks it is that several
newly shipped justification comments and test names would lead a later reader to a false
conclusion — the exact defect class this round exists to remove.

## Durable findings

1. **`collectionToProto`'s "THIS LOG LINE CANNOT FIRE TODAY" is false as written.** Its cited
   evidence (`entstore.go:408`, `:898`) points at the **Task** write sites; the two real
   Collection writers (`:1366`, `:1399`) are uncited. Worse than a stale pointer, because the
   cited lines *do* resolve to plausible-looking `SetRemoteData` calls. The conclusion holds,
   but for a **caller** property (nothing in-tree populates `CreateCollectionParams.RemoteData`)
   rather than the **type** property the comment asserts. I fired the line by passing a
   Go-native `map[string]string` into `CreateCollection`.

2. **Two comments in the same file give opposite epistemic verdicts** on collection
   reachability: the function doc says "I am NOT recording that as unreachable," the call site
   forty lines later says "CANNOT FIRE TODAY."

3. **The round's headline property is pinned by a test that never touches its producer.**
   `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` hand-types `[]string{"bug"}`.
   **No test in the repository calls `issueBuildRemoteData` or `issueLabels`**, and
   `internal/platform/github` never imports `structpb`. Change `issueLabels` to return `[]any`
   and every assertion still passes while the property dies. Fix: assert
   `structpb.NewStruct(issueBuildRemoteData(...))` errors, from inside the github package.

4. **A new hand-rolled line scanner was added to a package that already carries a measured
   verdict against line scanners.** `urlvalidate_differential_test.go` has held, since before
   this branch, a section titled "WHY THIS IS AN AST WALK NOW, having been a line scanner",
   concluding "a text-scan of Go source was the wrong tool"; `go/ast` and `go/parser` are
   already imported there. This change nonetheless adds `remoteDataAssignment` /
   `firstTopLevelSeparator` / `maskGoLiterals` in `remotedata_depth_test.go`, and I measured it
   reproducing the second failure mode that note lists. Four ordinary gofmt-stable shapes are
   **silent misses** (single-line composite literals in three positions; any line beginning
   with a closing bracket), while its doc comment claims "shapes nobody has thought of are all
   visible without being predicted."

5. `TestEphemeralGraphRouteDropsRemoteData` never calls `loadEphemeralStore`.

6. The new `log.Printf` fires once per task on every passthrough read (`issueLabels` returns a
   non-nil `[]string` unconditionally; page size 50–200) and carries no task or issue
   identifier.

## Negative results, pre-registered

- **The persistence premise survives independent enumeration.** I enumerated by transformation
  rather than by file (JSON round trip, ent write+read, structpb round trip, deep copy,
  gob/yaml/cbor, re-parsing boundary) and **found no third path**. Export→import looked live
  and died on `ExportCollection` refusing non-`farmtable` platforms; a `json.Marshal` pair in
  `server.go` turned out to be `pageCursor` encoding.
- **All 26 `file.go:NNN` citations added by the diff resolve correctly.** My staleness
  hypothesis was refuted. Finding 1 is not a counterexample — those resolve precisely, to the
  wrong entity.
- **The `metadata` exemption repair is fully verified.** I measured the step its own reason
  string marks `[REASONED, NOT MEASURED]`: `json.RawMessage` → ent `field.TypeJSON` → read
  back as `map[string]interface{}`, sanitizer drops a nested `html_url: javascript:…`, result
  is representable and reaches the wire.

## Pre-existing, outside the delta

The sanitizer and the import validator **disagree about depth accounting** in the two
`[]map[string]any` arms (`depth+1` vs. an effective `depth+2`), so against
`maxRemoteDataDepth = 32` they truncate in different places — while
`validateRemoteDataURLs`'s doc claims "the same traversal, at the same depths." Production
reachability is nil, because the only caller is fed JSON-decoded data and `encoding/json`
cannot produce `[]map[string]any`. Filed as FYI with a precise fix for a follow-up.
Relatedly, `TestSanitizeAndImportAgreeAtEveryDepth` bottoms out around depth 4 against a bound
of 32, so its fixtures cannot reach the region where the divergence lives.

## Process findings

- **My dispatch and my brief contradicted each other** ("read the brief in full" vs. "do not
  read section 4 until pass 1 is done"). I obeyed the dispatch, so my PASS-1/PASS-2 attribution
  is contaminated and was reported as low-confidence rather than re-tagged.
- **The mandatory shared `_run-queue-log.md` broke three-leg independence.** Pre-registering
  into one shared file means reading the other legs' predictions. Recommended per-leg queue
  files reconciled after the fact.
- **`web/dist` is gitignored**, so a `--local` clone cannot run `go build ./...` from its root.
- I did not spend the build token; no full suite, `go vet`, or `npm test` run. Bounded
  explicitly in the report rather than glossed.
