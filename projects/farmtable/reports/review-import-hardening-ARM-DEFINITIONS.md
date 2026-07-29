# import-hardening — mutation arm definitions and expected RED targets (reviewer's independent battery)

**Why this file exists:** these arms were **never committed**. They were working-tree edits, each
applied, built, run, and reverted, with restoration proven by `sha256sum -c` and `git write-tree`.
No ref points at them, so no `fsck` sweep, no reflog sweep and no bundle will carry them. Prose is
the only recoverable form, and this is the prose.

**Commit:** `f487dc5` (`import-hardening`, base `43bd206`).
**Clone used:** `/tmp/rev-ih2/ft`, `git clone --no-local`, detached at `f487dc5`.
**Tree SHA the arms were reverted back to each time:** `a579ea929979472019fa80d3b4e0490bb8af4397`
(== `HEAD^{tree}` at `f487dc5`). Round-1 clone `/tmp/rev-ih/ft` at `2ff87d2`: tree
`9657d01ea5af1e3e5b0accd20016465ca9064d25`.

**Protocol for every arm:** apply → `git diff --numstat` must be non-zero (a zero-diff mutant
reports on your patch, not on the test) → `go build ./...` must return rc=0 (a mutation that does
not compile proves the compiler works, not that the test works) → run the target tests → revert →
`sha256sum -c` the baseline.

**Baseline before the battery:** `TestRPC_ImportCollection_RefusalMessageNamesTheCause` PASS and
`TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause` PASS (all 4 subcases).

---

## The five arms, reproduced by the reviewer

| Arm | Exact mutation | numstat | Expected / observed RED target |
|---|---|---|---|
| **M7** | `internal/server/export_import.go:162`, in `unattributableImportMessage`: `switch cause {` → `switch OpenAccessCause("") {` | `1 1` | wording test **RED**, assertion `export_import_provenance_test.go:790`, subcase `deliberate` **only** (1 of 3); invariance test **GREEN, all 4 subcases** — staying green is a PASS CONDITION |
| **M8** | `internal/server/export_import.go:389`: `if importerID == uuid.Nil {` → `if importerID == uuid.Nil && s.openAccessCause != OpenAccessCauseDeliberate {` | `1 1` | invariance test **RED**, `CANARY:` at `export_import_provenance_test.go:700`, subcase `deliberate`; wording test also RED at `:770` |
| **M9** | `internal/server/export_import.go:159-160`: drop `" and the embedded \`ft\` CLI is unaffected because it always authenticates locally."` from `const scope` | `1 2` | wording test **RED in all 3 subcases**; invariance test GREEN |
| **M10** | `internal/server/server.go:91`: `return func(s *FarmTableService) { s.openAccessCause = c }` → `return func(s *FarmTableService) { _ = c }` | `1 1` | wording test **RED** (`deliberate`); invariance GREEN |
| **M11** | `cmd/farmtable-server/main.go:186-187`, in `openAccessCauseFor`: `case token == "": return server.OpenAccessCauseMissingToken` → `... return server.OpenAccessCauseDeliberate` | `1 1` | `TestOpenAccessCauseForMapsEveryConfiguration` **RED**, 2 of 6 subcases, assertions at `main_test.go:117` |

## The argument the M7/M8 pair carries

|  | M7 — message ignores cause | M8 — cause grants passage |
|---|---|---|
| `RefusalMessageNamesTheCause` | RED | RED |
| `RefusalDoesNotDependOnOpenAccessCause` | **GREEN** | **RED** (`CANARY:`) |

M7 staying GREEN on the invariance test is a **pass condition**, not a survivor: a test that
reddened when only the wording changed would be coupled to text and would not be pinning an
outcome. M8 is what earns the invariance test its place — against an unconditional refusal that
test passes trivially, and **a trivially-passing test is indistinguishable from a vacuous one until
someone introduces the defect it exists to catch**. M8 introduces exactly that defect.

## The residual equivalence test (also never committed)

Scratch file `cmd/farmtable-server/zzz_review_residual_test.go`, since deleted. It re-implemented
the pre-`f487dc5` predicate verbatim —

```
if os.Getenv("FARMTABLE_OPEN_ACCESS") == "1" { lookup = nil }
else if token == "" { lookup = nil }
else { lookup = NewStoreTokenLookup(s) }
```

— and compared its lookup decision against `openAccessCauseFor(...)` fed through the new `switch` at
`cmd/farmtable-server/main.go:72-81`, over the cross product of 14 `FARMTABLE_OPEN_ACCESS` values ×
14 `FARMTABLE_TOKEN` values (`""`, `"1"`, `"0"`, `"true"`, `"TRUE"`, `"1 "`, `" 1"`, `"01"`,
`"yes"`, `"secret"`, …). Output: `RESULT: 196 combinations compared, all agree`.

**Anti-vacuity assertions, without which "all agree" would also hold for two identically-broken
predicates:** `("", "secret")` must yield a **non-nil** lookup (permit arm); `("1", "secret")` and
`("", "")` must each yield **nil** (deny arms). All three held.

## Reviewer's own errors, recorded because they are the reusable part

1. **A zero-diff mutant reports on your patch, not on the test.** My first M11 patch did not apply —
   the source was gofmt-aligned differently than my pattern assumed — and the run came back
   all-PASS. Read carelessly that is "M11 is a survivor, the mapping test is vacuous".
   `git diff --numstat` after every patch is what caught it.
2. **`go list ./...` reported 87 packages** (round 1) because I merged stderr into the capture and
   counted 55 `go: downloading …` lines as packages. The answer is 32.
3. **`--all` does carry HEAD and does carry non-standard namespaces** on git 2.54.0. I asserted the
   opposite to the EM from docs-shaped intuition; a direct experiment with a `refs/preserve/*` probe
   pointing at a commit no branch pointed to showed the ref coming through with its correct refname.
