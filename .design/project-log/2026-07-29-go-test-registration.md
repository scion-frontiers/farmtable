# Go test membership: both-directions diff, and 45 registrations

Date: 2026-07-29
Base SHA: `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f` (main)
Registration commit: `32255b05a00e59f195d5b4617e6e9f2601e07ed4` (branch
`go-test-registration`, not pushed)
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/go-test-registration.md`

## What was asserted

`.github/expected-go-tests.txt` was compared against a real `go test ./... -v` run in
**both** directions, using the gate's own derivation from `ci.yml`.

| Quantity | Value |
|---|---|
| Go test functions executed | 548 |
| Manifest rows before | 503 |
| EXECUTED-BUT-NOT-LISTED | 45 test functions |
| LISTED-BUT-NOT-EXECUTED | 0 test functions |
| Manifest rows after | 548 |

503 + 45 − 0 = 548. The directions reconcile.

## Findings worth keeping

**The manifest was never reconciled to the tree it guards.** All 45 unlisted tests
already existed *and were executing* at `b54c573`, the last commit that changed this
manifest's content (501 → 503 rows). Zero Go source changed between `b54c573` and
`2982ffd`, so the executed set was provably identical then. Someone edited this
manifest, registered 2 tests, and left 45 running unregistered. **Genuinely new: 0.**

**`internal/webguard` was absent as an entire package**, not as stray rows — all 4 of
its test functions were outside the gate's view. 11 packages executed; 10 were listed.

**Four renames passed through the gate unobserved:**

| Old name (gone) | New name | Commit |
|---|---|---|
| `TestRemoteDataAssignmentSeesEveryShape` | `TestRemoteDataWriteSitesSeesEveryShape` | `1362bed` |
| `TestRemoteDataWriteSitesUnderInternalServerSanitize` | `TestScannedServerPackageRemoteDataWriteSitesSanitize` | `1eaf990` |
| `TestURLBearingRemoteDataKeysCoversConvertReads` | `TestURLBearingRemoteDataKeyClassification` | `54c46cc` |
| `TestGitHubPassthroughRemoteDataNeverSerialises` | `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` | `5b7dae4` |

The gate reported 0 MISSING throughout — **not because it caught the renames, but
because none of the four old names was ever registered.** A rename of an unregistered
test is invisible in both directions simultaneously. That is the compound failure mode
the one-directional design leaves open: addition-blindness keeps a test unregistered,
and an unregistered test can then be renamed or deleted with nothing to fall out as
MISSING.

`1b29165` looked like a fifth rename and is not one: `TestEphemeralGraphRouteDropsRemoteData`
is removed and re-added in the same file in the same commit. In-place rewrite, name
survives, still executing. Counting it would have invented a deletion.

## Method notes for the next person

- **The base moved mid-task** (`eca9239` → `2982ffd`, 12 commits). The set was
  re-derived from a fresh run, not carried forward. This mattered: `0f2c6f3` changed
  the *parser* to subtract skipped tests. The figure stayed 548 only because the
  skipped set is empty — which was measured, not assumed.
- **Branch `import-hardening` at `f487dc5` (510 rows, base `43bd206`) was kept
  separate** and not pooled. Different artefact, different base. On merge, re-derive
  at the merge commit; do not add.
- **B = 0 was obtained three independent ways** (`comm -23`, `grep -F -x -v -f`, awk
  set membership) because `comm` alone trusts collation. It was then **canaried**: an
  injected absent name was correctly reported MISSING, so the zero distinguishes
  "nothing missing" from "check broken".
- **Never regenerate this manifest.** Rows were appended to the existing file;
  `git diff --numstat` shows `45  0` — additions, zero deletions. Regeneration would
  have laundered away the four renames above into a clean-looking rewrite.

## Not fixed here

The asymmetry stands: MISSING fails the build, UNEXPECTED is a `::notice::` labelled
"(not a failure)". This commit zeroes the backlog but the next unregistered test starts
the drift again. The workflow's stated rationale — that mandatory manifest edits train
reflexive regeneration — is reasonable, but the measured cost of the tolerated
direction was 45 test functions, one whole package, and 4 unobserved renames. Changing
the failure policy was out of scope for this task and is flagged, not done.
