# Mutation arm definitions — `import-hardening` @ `9f5fadb`

**Written because these arms produced NO COMMITS.** Every arm was applied in a throwaway
clone (`/tmp/arms`, `/tmp/arms2`), reverted, verified restored by SHA-256, and the clone
deleted. No ref points at any of them, so **no sweep and no bundle would have carried
them**. They existed only as prose in my report until this file.

**ROOT for every anchor below:** `/workspace/farmtable-import-hardening` at `9f5fadb`.

## Honesty about provenance of these anchors

| Arms | Anchor fidelity |
|---|---|
| **M7–M11** | **Verbatim.** Applied and re-run this session; the strings are copied from the scripts that ran. |
| **M1–M6′** | **Reconstructed.** Run before a context compaction, in clones since deleted. Semantics and expected RED targets are from my report and are reliable; the exact patch text is *reconstructed against the current tree*, not copied from what ran. Line numbers verified present at `9f5fadb`; treat the strings as a faithful re-derivation, not a transcript. |

Recording the distinction rather than presenting all eleven as equally solid — a
reconstructed anchor that silently fails to apply is a zero-diff mutant, which reports on
the patch and not on the test.

## Standing rule for anyone re-running these

```
git diff --numstat <file>      # AFTER the patch, BEFORE reading any test result
```
A zero delta means the patch did not apply and the ALL-PASS you are about to read is a
false negative shaped exactly like the result you wanted. Also confirm the arm **compiles**
(`go vet ./internal/server/`): a mutation that does not compile proves the compiler works,
not that the test works.

## The arms

Files: `EI = internal/server/export_import.go`, `SRV = internal/server/server.go`,
`MAIN = cmd/farmtable-server/main.go`.

| Arm | File | Control reverted | Expected RED | Delta |
|---|---|---|---|---|
| M1 | EI | Provenance row never emitted | `StampsImporterProvenance`, `StampsEveryImportedTask`, `ProvenanceNeverNamesAPlaceholder`, `ExportCollection_CarriesImportProvenance` | 1+/1- |
| M2 | EI | Reserved-namespace strip never matches | `PayloadCannotForgeProvenance`, `ExportCollection_CarriesImportProvenance` | 1+/1- |
| M3 | EI | Absent-identity refusal removed | `RefusesImportWithoutIdentity` | 0+/4- |
| M4 | EI | Ingestion time taken from the payload | `StampsImporterProvenance` | 1+/1- |
| M4b | EI | Payload's claimed timestamp not preserved | `StampsImporterProvenance` | 1+/1- |
| M5 | EI | Provenance attributed to a non-importer | `StampsImporterProvenance`, `ExportCollection_CarriesImportProvenance` | 1+/1- |
| M6′ | EI | Export-side strip re-added (provenance hidden) | `ExportCollection_CarriesImportProvenance` | 1+/0- |
| M7 | EI | Message ignores the cause (always fallback) | `RefusalMessageNamesTheCause` **only** | 1+/1- |
| M8 | EI | Cause allowed to change the OUTCOME | `RefusalDoesNotDependOnOpenAccessCause`, `RefusalMessageNamesTheCause` | 1+/1- |
| M9 | EI | "embedded `ft` CLI is unaffected" removed | `RefusalMessageNamesTheCause` (all 3 subcases) | 1+/2- |
| M10 | SRV | `WithOpenAccessCause` silently stores nothing | `RefusalMessageNamesTheCause` | 1+/1- |
| M11 | MAIN | Env mapping blames the wrong knob | `TestOpenAccessCauseForMapsEveryConfiguration` | 1+/1- |

### Verbatim anchors — M7 to M11

**M7** — `EI`, in `unattributableImportMessage`:
```
FIND:    \tswitch cause {\n\tcase OpenAccessCauseDeliberate:
REPLACE: \tswitch OpenAccessCause("") {\n\tcase OpenAccessCauseDeliberate:
```
**M8** — `EI` line ~389:
```
FIND:    \tif importerID == uuid.Nil {
REPLACE: \tif importerID == uuid.Nil && s.openAccessCause != OpenAccessCauseDeliberate {
```
**M9** — `EI`, in `unattributableImportMessage`:
```
FIND:    \tconst scope = " Only collection import is affected; other operations are unchanged, " +\n\t\t"and the embedded `ft` CLI is unaffected because it always authenticates locally."
REPLACE: \tconst scope = ""
```
**M10** — `SRV`:
```
FIND:    return func(s *FarmTableService) { s.openAccessCause = c }
REPLACE: return func(s *FarmTableService) { _ = c }
```
**M11** — `MAIN`, in `openAccessCauseFor`:
```
FIND:    \tcase token == "":\n\t\treturn server.OpenAccessCauseMissingToken
REPLACE: \tcase token == "":\n\t\treturn server.OpenAccessCauseDeliberate
```

### Reconstructed anchors — M1 to M6′

**M1** — `EI` ~line 576, the provenance stamp loop:
```
FIND:    for _, imported := range importParams.Tasks {
REPLACE: for _, imported := range importParams.Tasks[:0] {
```
**M2** — `EI` line 529, the reserved-namespace strip predicate:
```
FIND:    strings.HasPrefix(exportedChange.FieldName, serverAuthoredFieldPrefix)
REPLACE: strings.HasPrefix(exportedChange.FieldName, "zzz-never-matches:")
```
**M3** — `EI` line 389; delete the whole 3-line refusal block (0+/4- includes the comment).
**M4** — `EI` line 567: `ImportedAt: ingestedAt.Format(...)` → format `doc.Collection.CreatedAt` instead.
**M4b** — `EI` line 570: `ClaimedCollectionCreatedAt: claimedTime(doc.Collection.CreatedAt)` → `""`.
**M5** — `EI` ~line 575: `AuthorID: importerID` → the payload-resolved author id.
**M6′** — `EI`, export path: re-add a strip dropping `ImportProvenanceField` rows from export output.

## The two results that carry the argument

**M7 vs M8 must DISAGREE.** M7 turns the wording test red and must leave
`RefusalDoesNotDependOnOpenAccessCause` **green** — that test has to be blind to wording or
it is not testing invariance. M8 must turn it **red**. M8 is the only reason that test is
not vacuous: it otherwise passes merely because the refusal is unconditional, and a
trivially-passing test is indistinguishable from a vacuous one until you inject the exact
defect it exists to catch.

**M7 is also the arm that caught review nit N2-2.** At `f487dc5` the missing-token wording
subcase asserted the bare substring `"FARMTABLE_TOKEN"`, which the generic fallback also
contains, so it **passed under M7** — present, executing, measuring nothing. At `9f5fadb`
it asserts `"FARMTABLE_TOKEN is not set"` and correctly fails. The *unspecified* subcase
still passes under M7 and that is correct: it **is** the fallback branch, so no phrase is
unique to it.
