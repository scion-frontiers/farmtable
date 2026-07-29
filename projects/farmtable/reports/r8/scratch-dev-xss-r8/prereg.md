
---

## R8 / dev-xss-r8 — PRE-REGISTRATION, written BEFORE any cell ran (OP-1(c))
**Leg:** `dev-xss-r8` (fix leg). **Base SHA:** `e4e3d1352809428a5dfe386bb53c0b18a562332f`.
**Tier:** OP-1(b) single-package, plus OP-1(h) mutation against throwaway copies OUTSIDE
`/workspace`. **NO BUILD TOKEN REQUESTED OR HELD FOR ANY CELL BELOW.**

**ROOTS, all three stated up front because the column binds passing lines too:**
| label | ROOT | DIST |
|---|---|---|
| MYTREE | `/workspace/farmtable-xss-r8` | **ABSENT** (verified `[ -d web/dist ]` false) |
| PRISTINE | `/tmp/r8-mutation/pristine` | **ABSENT** (copied from MYTREE, tar excluded only `.git`) |
| MUTATED | `/tmp/r8-mutation/mutated` | **ABSENT** (same copy, one line changed) |

**THE MUTATION**, one line of `internal/webguard/remotedata_consumers_test.go`, in
`censusRemoteDataMentions`, applied ONLY in MUTATED:
`if rel != "." && skipDirs[rel] {`  ->  `if skipDirs[d.Name()] {`
This is a revert of the B4 anchoring fix. No production code is mutated in any cell.

**PREDICTIONS, DERIVED HERE AND NOT INHERITED FROM r7's T7-0N.** The derivation is stated so
it can be attacked independently of whether r7 measured the same thing:
- `find web -mindepth 2 -type d \( -name node_modules -o -name dist -o -name build -o -name .vite -o -name coverage -o -name .tmp-test \)` returns **EMPTY** in MYTREE. So in the real tree the two
  pruning policies select the same set and no assertion that reads only the real tree can tell
  them apart.
- The six directories `TestWebCensusDescendsIntoShippedSource` asserts (`src`, `src/components`,
  `src/gen`, `src/store`, `src/util`, `src/utils`) have basenames none of which is in `skipDirs`,
  so basename pruning does not prune any of them and that test cannot go red on this mutation.

| cell | ROOT | command | PREDICTED |
|---|---|---|---|
| R8-01 | MYTREE | `go test ./internal/webguard/ -run '^TestWebCensusAnchoringIsTopLevelOnly$' -count=1` | GREEN |
| R8-02 | MYTREE | `go test ./internal/webguard/ -run '^Test' -count=1 -v` | GREEN, **4** `=== RUN` top-level |
| R8-03 | MUTATED | `go test ./internal/webguard/ -run '^TestWebCensusAnchoringIsTopLevelOnly$' -count=1` | **RED** |
| R8-04 | MUTATED | `go test ./internal/webguard/ -run '^TestWebCensusDescendsIntoShippedSource$' -count=1` | **GREEN** — the discriminator: the OLD test is blind to this mutation |
| R8-05 | PRISTINE | `go test ./internal/webguard/ -run '^Test' -count=1 -v` | GREEN, 4/4 — control that the copy itself is not the cause of any red in R8-03 |

**FALSIFIER, pre-registered:** if R8-03 comes back GREEN, the new test does not discriminate
either and item 2 is NOT fixed by it — I would fall back to the brief's cheap option (delete the
claim) rather than report a guard I had not seen fail. If R8-04 comes back RED, my derivation
above is wrong and the r7 finding needs re-reading before I rely on it.

**Expected `=== RUN` count of 4 is derived from** `grep -c '^func Test' internal/webguard/remotedata_consumers_test.go`
= 3 at base + 1 added by this leg, with 0 `t.Run` subtests.
