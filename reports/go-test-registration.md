# Go test membership: both-directions set diff and registration

**Base SHA (measured at, and nowhere else): `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`** (`main`)
Subject: `merge: ci.yml review findings onto the manifest floor fix (r2wfix)`

**Registration commit: `32255b05a00e59f195d5b4617e6e9f2601e07ed4`** on branch
`go-test-registration`, in leg clone `/workspace/farmtable-reg-goleg`. **Not pushed.**

Leg tree cloned from the local path `/workspace/farmtable`, never from the network
remote.

---

## 0. The base moved under this task. The number was re-derived, not carried.

I began at **`eca923953776b0e1c3eb563640ab0465b9c3d88e`** and derived 45 there.
Before committing, `main` had advanced 12 commits to `2982ffd`. Per instruction the
whole measurement was re-run from a fresh `go test ./... -v` at `2982ffd`; the earlier
integer was discarded rather than carried forward.

This was not a formality. One of the intervening commits, **`0f2c6f3` "Guard the
committed tree, and stop counting skipped tests as executed"**, *changes the
derivation itself*: the parser now subtracts top-level `--- SKIP` lines from the
executed set. A number produced by the old parser is not the same measurement as a
number produced by the new one, whatever the two integers happen to be.

Re-derived at `2982ffd`, the executed figure is again **548 test functions** — but it
is 548 *by the new parser*, and the reason it did not move is measured, not assumed:
the skipped set at `2982ffd` is **0 test functions**, so the subtraction removed
nothing. Had any test been carrying a `t.Skip`, the two figures would have differed.

Corroborating that no test-level drift occurred: `git diff --name-only eca9239 2982ffd`
matching `\.go$|go\.mod|go\.sum` returns **0 files**. The 12 commits touched
`ci.yml`, `Makefile`, and `.design/` docs only.

### Not pooled with branch `import-hardening`

Branch `import-hardening` at `f487dc5` reports a **510-row** manifest with 0 MISSING
and 0 UNEXPECTED across 32 packages. That is **a different artefact on a different
base (`43bd206`)**. Its 510 is not this 503, its 32 packages are not these 11, and
nothing in this report adds to, subtracts from, or reconciles against it. If the two
branches merge, the membership must be **re-derived at the merge commit**, not
arithmetically combined. Both `f487dc5` and `43bd206` were confirmed to exist as
objects in the source repo; neither was fetched into the measurement.

---

## 1. Both directions, as explicit lists

Derivation is the CI gate's own, copied verbatim from `.github/workflows/ci.yml` at
`2982ffd` (the `RUN`/`SKIP` awk with package attribution, `sort -u`, then
`comm -23 ran skipped`). `LC_ALL=C` throughout, matching the workflow.

Instrument self-checks, reported rather than skipped:

| Self-check | Result |
|---|---|
| Package result lines recognised in `go-test.log` | **33** (gate aborts at 0) |
| `go test ./... -v` exit status | **0** |
| Failure lines matched (`--- FAIL:` / `FAIL\t` / `FAIL$`) | **0** |
| Rows attributed to `(unterminated)` package | **0** |
| Top-level tests skipped | **0** |

| Quantity | Value |
|---|---|
| Go test functions executed | **548 test functions** |
| Rows in `.github/expected-go-tests.txt` before this commit | **503 rows** |
| Packages executed | **11 packages** |
| Packages named in the manifest before this commit | **10 packages** |

Identity check: 503 rows + 45 additions − 0 absences = **548**, equal to the executed
count. The two directions reconcile exactly.

### Direction A — EXECUTED-BUT-NOT-LISTED: **45 test functions**

Ran at `2982ffd`; absent from the 503-row manifest. Package-qualified, as registered:

| # | Package | Test function |
|---|---|---|
| 1 | `internal/platform/github` | `TestGitHubBuilderRepresentabilityAsymmetry` |
| 2 | `internal/platform/github` | `TestIssueBuildRemoteDataIsNotStructpbRepresentable` |
| 3 | `internal/server` | `TestDivergenceNoteRuleRejectsANoteThatDescribesNothing` |
| 4 | `internal/server` | `TestEphemeralGraphRouteDropsRemoteData` |
| 5 | `internal/server` | `TestMapStringStringStaysUnrepresentable_GuardsO1` |
| 6 | `internal/server` | `TestNestedURLReachesTheWireWithoutRecursion` |
| 7 | `internal/server` | `TestNoteDeclaresBaseDependence` |
| 8 | `internal/server` | `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` |
| 9 | `internal/server` | `TestPassthroughReadDropsUnsafeRemoteURL` |
| 10 | `internal/server` | `TestRPC_ImportCollection_AcceptsHTTPURLs` |
| 11 | `internal/server` | `TestRPC_ImportCollection_RejectsScriptURLs` |
| 12 | `internal/server` | `TestRPC_UpdateTask_AcceptsHTTPURLs` |
| 13 | `internal/server` | `TestRPC_UpdateTask_RejectsScriptURLInPullRequest` |
| 14 | `internal/server` | `TestRPC_UpdateTask_RejectsScriptURLInRemoteURL` |
| 15 | `internal/server` | `TestRemoteDataDropIsLoggedWithOffendingKeys` |
| 16 | `internal/server` | `TestRemoteDataDropLogIsSampled` |
| 17 | `internal/server` | `TestRemoteDataDropLogIsSampledPerField` |
| 18 | `internal/server` | `TestRemoteDataFuncIdentSeparatesMethodsFromFunctions` |
| 19 | `internal/server` | `TestRemoteDataKeyClassification` |
| 20 | `internal/server` | `TestRemoteDataKeysWrittenByAdaptersAreClassified` |
| 21 | `internal/server` | `TestRemoteDataLiteralKeysIn` |
| 22 | `internal/server` | `TestRemoteDataLogQuotesAttackerKeys` |
| 23 | `internal/server` | `TestRemoteDataRepresentableMapLogsNothing` |
| 24 | `internal/server` | `TestRemoteDataTraversalsTerminateOnACycle` |
| 25 | `internal/server` | `TestRemoteDataUnrepresentableKeyIsNotAParadox` |
| 26 | `internal/server` | `TestRemoteDataWriteIsSanitized` |
| 27 | `internal/server` | `TestRemoteDataWriteSitesSeesEveryShape` |
| 28 | `internal/server` | `TestSanitizeAndImportAgreeAtEveryDepth` |
| 29 | `internal/server` | `TestSanitizeRemoteDataDoesNotMutateItsInput` |
| 30 | `internal/server` | `TestSanitizeRemoteDataRecursesThroughEveryCarrier` |
| 31 | `internal/server` | `TestSanitizeRemoteDataScrubsEveryURLCarrier` |
| 32 | `internal/server` | `TestSanitizeRemoteDataStopsAtTheDepthBound` |
| 33 | `internal/server` | `TestScannedServerPackageRemoteDataWriteSitesSanitize` |
| 34 | `internal/server` | `TestSharedFixturesRecordRealDivergences` |
| 35 | `internal/server` | `TestTaskToCreateParamsOmitsRemoteData` |
| 36 | `internal/server` | `TestTaskToProtoScrubsRemoteDataURLCarriers` |
| 37 | `internal/server` | `TestURLBearingRemoteDataKeyClassification` |
| 38 | `internal/server` | `TestValidateImportedTaskURLsReachesNestedCarriers` |
| 39 | `internal/server` | `TestValidateURLFieldMatchesSharedFixtures` |
| 40 | `internal/server` | `TestValidateURLField_AcceptsHTTPAndHTTPS` |
| 41 | `internal/server` | `TestValidateURLField_RejectsScriptBearingSchemes` |
| 42 | `internal/webguard` | `TestWebCensusAnchoringIsTopLevelOnly` |
| 43 | `internal/webguard` | `TestWebCensusDescendsIntoShippedSource` |
| 44 | `internal/webguard` | `TestWebRemoteDataCensusIsNonVacuous` |
| 45 | `internal/webguard` | `TestWebRemoteDataConsumersAreDeclared` |

By package: `internal/server` 39, `internal/webguard` 4, `internal/platform/github` 2.

**`internal/webguard` was missing from the manifest as an entire package, not as stray
rows.** All 4 of its test functions were unregistered — a whole package's worth of
assertions outside the gate's view. This is why the package counts differed (11
executed vs 10 listed).

### Direction B — LISTED-BUT-NOT-EXECUTED: **0 test functions**

**Zero. Asserted, not assumed.** How it was obtained — three mutually independent
methods, all agreeing:

| Method | Result |
|---|---|
| `comm -23 expected-go-tests.sorted executed-go-tests.txt` | 0 rows (0 bytes) |
| `grep -F -x -v -f executed-go-tests.txt <manifest>` | exit 1, 0 rows (no unmatched line) |
| `awk 'NR==FNR{ex[$0]=1;next} !($0 in ex)'` | 0 unmatched manifest rows |

`comm` alone would have been insufficient: it silently misbehaves if its two inputs
are sorted under different collations. The `grep -F -x -v -f` and `awk` checks make no
ordering assumption at all, so agreement across all three rules out a collation
artefact rather than merely not exhibiting one.

**The zero is a lit instrument.** A control was run: a row known to be absent
(`internal/server TestCanaryThatDoesNotExist`) was injected into a copy of the manifest
and the same comparison **reported it as MISSING**. The check therefore distinguishes
"nothing is missing" from "the check stopped working". Without that control, a 0 here
would be indistinguishable from a dead comparison.

Consequence: **no test registered in the manifest has stopped running.** In particular
no *registered* test was renamed away — see §2, where that turns out to be luck rather
than design.

---

## 2. Classification of the 45

| Category | Count |
|---|---|
| Genuinely new | **0 test functions** |
| Renamed | **4 test functions** |
| Previously executed but never registered | **41 test functions** |

### Why "genuinely new" is zero

The manifest last *changed content* at **`b54c573`** (Jul 29 14:26, "Merge main
(43bd206) and register the two conjunct-A tests in the manifest", 501 → 503 rows).
`b54c573` is an ancestor of `2982ffd`.

All **45 of 45** test function names already existed in the tree at `b54c573`
(checked with `git grep -E '^func Test[A-Za-z0-9_]+\(' b54c573 -- '*_test.go'`; the
tree held 596 distinct top-level test function names at that point).

Further, `git diff --name-only b54c573 2982ffd` matching `\.go$|go\.mod|go\.sum`
returns **0 files**. With zero Go source drift, the executed set at `b54c573` was
necessarily identical to the 548 measured here. So all 45 were **executing** at the
moment the manifest was last edited — not merely present on disk. "Previously executed"
is therefore proven, not inferred.

The gap is not a backlog of new tests that outran the manifest. Someone updated this
manifest, added 2 rows, and left 45 executing tests unregistered. The manifest was
never reconciled to the tree it guards.

### The 4 renames — the dangerous category

A rename is one addition plus one deletion and nets to nothing in a count. Found by
scanning each introducing commit's diff for removed `func Test…` alongside added ones
in the same file:

| Old name (gone) | New name (registered here) | Commit |
|---|---|---|
| `TestRemoteDataAssignmentSeesEveryShape` | `TestRemoteDataWriteSitesSeesEveryShape` | `1362bed` |
| `TestRemoteDataWriteSitesUnderInternalServerSanitize` | `TestScannedServerPackageRemoteDataWriteSitesSanitize` | `1eaf990` |
| `TestURLBearingRemoteDataKeysCoversConvertReads` | `TestURLBearingRemoteDataKeyClassification` | `54c46cc` |
| `TestGitHubPassthroughRemoteDataNeverSerialises` | `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` | `5b7dae4` |

Each old name was checked against three sets. All four are: **not in the manifest
(0 occurrences), not in the executed set (0), and not present in any `_test.go` in the
tree.** They are genuinely gone.

**Why the gate never noticed:** none of the four old names was *ever* in the manifest.
Every one of these renames happened on a side branch while the test was still
unregistered, so there was no manifest row to fall out as MISSING. Direction B is 0
not because renames were caught, but because the renamed tests were invisible to the
gate on both sides of the rename. Had any of these four been registered first, the
one-directional gate *would* have caught the rename — that is the one thing it does
well. The blindness to additions is what kept them unregistered long enough for the
rename to pass unobserved.

Two of the four sit on a longer chain worth recording, since an intermediate name
existed only between `5b7dae4` and `1eaf990` (three minutes apart) and never appeared
in any manifest:

- `TestEveryRemoteDataWriteSiteSanitizes` → split at `5b7dae4` into
  `TestRemoteDataAssignmentSeesEveryShape` + `TestRemoteDataWriteSitesUnderInternalServerSanitize`,
  which were then renamed again at `1362bed` and `1eaf990` respectively.

### One near-miss, deliberately *not* classified as a rename

`1b29165` shows `TestEphemeralGraphRouteDropsRemoteData` as both removed and added in
`internal/server/graph_routing_test.go`. That is an in-place rewrite, not a rename: the
name survives, and the test is present in the tree and executing at `2982ffd`. Counting
it as a rename would have invented a fifth deletion that never happened. It is
classified as never-registered (#4 in the list above), introduced at `d305391`.

---

## 3. Registration commit — non-regeneration proof

**The manifest was NOT regenerated.** The 503 existing rows were carried through
byte-for-byte and 45 rows added (`cat <existing-file> <45-additions> | sort`). Before
committing, the original 503 rows were confirmed to survive as a subsequence: 503 of
503 present, **0 lost**.

The mechanical proof, as required:

```
$ git diff --numstat -- .github/expected-go-tests.txt
45      0       .github/expected-go-tests.txt
```

And on the landed commit `32255b0`:

```
$ git show --numstat --format='' 32255b05a00e59f195d5b4617e6e9f2601e07ed4
45      0       .github/expected-go-tests.txt
```

**Additions: 45. Deletions: 0.** A direct count of deletion lines in the diff body
(`grep -c '^-[^-]'`) is also **0**. The commit touches **exactly one file**.

Manifest is now **548 rows**, equal to the 548 executed test functions.

Had this diff contained even one deletion I would have stopped and said so; it does
not. A regenerated manifest would silently launder away every test deleted or renamed
without notice — precisely the four renames documented in §2 would have vanished into
a clean-looking rewrite.

---

## 4. What the final verification run caught

A green that caught nothing is an unlit instrument. This run's green is qualified:

| Check | What it was expected to catch | Did it catch it? |
|---|---|---|
| MISSING (manifest → executed) | A registered test that stopped running | **Nothing to catch: 0.** Verified live by injecting `TestCanaryDeletedTest`, which it **did** report as MISSING. |
| UNEXPECTED (executed → manifest) | A test running outside the manifest | **Caught 45 before the commit; 0 after.** The 45 are the entire subject of this report. |
| Parser self-check | Truncated log / changed `go test` format | Recognised **33** package result lines (aborts at 0). Did not fire — correctly. |
| Failure-line scan | Failing Go tests across all four `FAIL` forms | **0 lines matched.** Suite exit status 0, independently consistent. |
| `(unterminated)` attribution | A package that never printed a result (panic/timeout) | **0 rows.** Did not fire. |
| Skip subtraction (new at `2982ffd`) | A `t.Skip` masquerading as an executed test | **0 skipped.** Did not fire — and this was measured, not assumed; it is why re-derivation left 548 unchanged. |

Second canary, run against the post-commit manifest: removing a registered row
(`internal/streaming TestEventBus_Unsubscribe`) produced that row as **UNEXPECTED**,
confirming the executed→manifest direction is also live and not short-circuited.

So: the MISSING arm caught nothing because there was nothing to catch, and that was
demonstrated by making it catch something on demand. The UNEXPECTED arm caught 45 real
unregistered tests, which is the finding this task exists to report.

---

## 5. What this commit does not fix

Registering 45 names closes today's gap; **it does not change the asymmetry.** In
`ci.yml` MISSING sets `status=1` and fails the job, while UNEXPECTED prints a
`::notice::` explicitly labelled "(not a failure)". The next test added without a
manifest edit will again be invisible, and the drift will start over from 0.

The workflow's own comment argues the asymmetry is deliberate: forcing a manifest edit
in the same commit "trains people to regenerate the manifest reflexively — which is how
a genuinely missing test would get rubber-stamped back to green." That reasoning is
sound as far as it goes. But the evidence here is that the tolerated direction drifted
to **45 test functions across 3 packages, including one entire package**, and carried
**4 unobserved renames** through the gate while doing so. A rename of an *unregistered*
test is invisible in both directions at once. That is the gap the current design
leaves open, and it is a policy decision rather than a defect — flagged here, not
changed, since altering the gate's failure policy is not in this task's scope.

---

## Appendix — commands of record

```
# leg clone from the LOCAL path, never the network remote
git clone --no-local --branch main /workspace/farmtable /workspace/farmtable-reg-goleg

# measured at, and only at:
2982ffd8f3f6e231d8855b9cae7c448c2bd3144f

export LC_ALL=C
go test ./... -v > go-test.log 2>&1          # exit 0; stderr NOT suppressed
# ci.yml's own RUN/SKIP awk -> go-test-rows.txt -> ran / skipped
comm -23 ran-go-tests.txt skipped-go-tests.txt > executed-go-tests.txt   # 548
sort -u .github/expected-go-tests.txt > expected-go-tests.sorted         # 503
comm -13 expected-go-tests.sorted executed-go-tests.txt   # A: 45
comm -23 expected-go-tests.sorted executed-go-tests.txt   # B: 0

cat .github/expected-go-tests.txt A-executed-not-listed.txt | sort > new   # append, never regenerate
git add .github/expected-go-tests.txt                                      # every file named
```

No measurement was run with `2>/dev/null`. No `git add -A`/`.`/`-u`, no `git commit -a`,
no `git stash -u`. Nothing pushed. `web/dist` untouched — `web/dist/.gitkeep` remains
the sole tracked entry.

---

## Corrections and durability

Durability, sweeps and bundle verification: see companion note
`go-test-registration-durability.md` in this directory. Headline: **2 of 739 commits in
my leg exist only in my container** (`32255b0`, `e374367`); both are bundled to
`/scion-volumes/scratchpad/projects/farmtable/bundles/` and verified by restore.

Corrections to this report and to what I stated while producing it. Struck in place with
the SHA, never deleted:

1. **`clone exit=[0]`, reported during bundle verification at `32255b0`/`e374367`.**
   ~~Reported as the exit status of `git clone`.~~ It was the exit status of `tail`, the
   last command in a `git clone … 2>&1 | tail -3` pipeline. The clone did succeed — the
   restored refs and objects prove it independently — but the evidence I first cited for
   it did not show that. All exit statuses were subsequently captured unpiped.

2. **"The preserve refs did not survive the restore: count is 0", stated at `32255b0`.**
   ~~Read as a bundle deficiency.~~ Wrong diagnosis. `git bundle list-heads` shows the 5
   `refs/preserve/*` refs **are** in the bundle. What I measured was `git clone`'s
   refspec, which fetches heads and tags only. The EM's retraction of "defect 3" is
   correct and my alarm was not.

   The corrected finding is narrower and still real: `git clone` of a bundle restores the
   *objects* but drops the `refs/preserve/*` *ref names*, so a preserved orphan becomes a
   dangling object again in the restored repo and a routine `gc --prune=now` deletes it —
   while `cat-file -e` still answers YES, so the prescribed verification passes. Restore
   with `git init --bare` + `git fetch <bundle> 'refs/*:refs/*'` instead. Detail and the
   purpose-built reproduction are in §4 of the durability note.

3. **No figure in this report was pooled across the two base SHAs**, and none is combined
   with branch `import-hardening`. That was true when written and remains true; restated
   here because §0 is the part most likely to be skimmed.

The registration finding itself — 548 executed, 503 listed, 45 additions, 0 absences,
`45  0` numstat, 0 genuinely new, 4 renames — is unaffected by either correction. Both
concern how I verified the *bundle*, not how I derived the *set*.
