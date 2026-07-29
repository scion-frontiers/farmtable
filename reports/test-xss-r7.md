# test-xss-r7 — TEST / QA REVIEW OF `e4e3d13`

**Object:** `e4e3d1352809428a5dfe386bb53c0b18a562332f`, branch `url-scheme-validation-r6`.
**Round base:** `c108acbcfa2357862576092469828709bb6c4090`.
**Branch base:** `d305391`.
**Merge target referenced by the round:** `cc92735` (resolves in this clone; claims verified, §7).

**ROOT for every command in this report:** `/workspace/farmtable-xss-r7-test`, detached at `e4e3d13`.
**DIST: ABSENT.** `web/dist` does not exist in this ROOT. `web/node_modules` does not exist either.
Every r7 fix-leg cell ran with **DIST PRESENT**. That difference was itself tested (T7-01).

**VERDICT: `REQUEST CHANGES`.** Four blocking items, ten non-blocking. Three of the four (B1, B2, B3)
are cold-pass findings that appear in no r6 artefact; B4 arises in reconciliation (§11.2) and is a
carried-forward r6 condition, not a new defect. Nothing here says the
round is wrong about the security question; the round's central factual claims survived every
check I could point at them. What fails is the round's own standard — the citations it added
resolve to the wrong lines, and the fix it is proudest of has no test that fails when it is removed.

---

## 0. POPULATION BEFORE VERDICT — WHAT I SEARCHED

All commands run in ROOT above at `e4e3d13` unless stated.

**P1 — the round diff.** `git diff --stat c108acb..e4e3d13` → 7 files, 931 insertions, 81 deletions.
Read in full: `internal/server/convert.go`, `internal/server/export_import.go`,
`web/src/capabilities.ts`, `internal/webguard/doc.go`,
`internal/webguard/remotedata_consumers_test.go`, `internal/server/remotedata_log_test.go`.
The seventh is the project log. **ENUMERATED 7 = READ 7 + EXCLUDED 0.**

**P2 — the canary record.** `_run-queue-log.md` lines 1924–2253, `# FIX ROUND r7 — dev-xss-r6`.
Cells carrying an explicit advance PREDICTION: R7-01, R7-02, R7-03, R7-04, R7-10, R7-11, R7-12,
R7-13, R7-14. **ENUMERATED 9 = AUDITED 9 + EXCLUDED 0.** That is the "nine cells" of the brief.
Six further cells exist without a PASS/FAIL prediction (R7-05, R7-06, R7-07, R7-08, R7-15, R7-16,
R7-17 — seven labels, R7-07/R7-08 explicitly not pre-registered). **R7-09 does not exist anywhere
in the file** (`grep -n 'R7-09' _run-queue-log.md` → no output); a gap in the numbering with no
note against it (N7).

**P3 — citations added by the round.** Every `file:line` and bare `:line` reference on an added
line of the r7 diff, extracted by
`git diff c108acb..e4e3d13 -- internal/ web/ | grep '^+' | grep -oE ...`, deduplicated to distinct
targets, and each one resolved with `sed -n "${L}p" ${F}` at `e4e3d13`.
**ENUMERATED 27 = RESOLVES-AS-DESCRIBED 22 + STALE 5 + EXCLUDED 0.**
The excluded count is zero and that is deliberate, not a filter that matched nothing: no
citation was dropped from the population. The two instruments (the `file.ext:N` grep and the bare
`:N` grep) OVERLAP, and the union was deduplicated by hand against the source comments; both are
listed in §1 so the arithmetic can be re-run.

**P4 — executable coverage of the two conjuncts the round documents.**
`grep -rn "import only supports farmtable" --include='*.go' .` → 1 hit, production only.
`grep -n 'FailedPrecondition' internal/server/export_import_test.go` → conjunct A **is** covered
(§3). `find web -name '*.test.ts' -o -name '*.spec.ts'` → 4 files:
`src/util/assertions.test.ts`, `src/util/safe-url.test.ts`, `src/util/url-binding-scan.test.ts`,
`src/utils/task-ready.test.ts`. `grep -rn "getCapabilities" --include='*.ts' web/` → 3 hits, all
production. **ENUMERATED 4 web test files = EXERCISING `getCapabilities` 0 + NOT 4.**

**P5 — the `skipDirs` precondition.**
`find web -depth +1 -type d \( -name node_modules -o -name dist -o -name build -o -name .vite -o -name coverage -o -name .tmp-test \) -print` → **NO OUTPUT**, exit 1.
`for d in node_modules dist build .vite coverage .tmp-test; do [ -e "web/$d" ]; done` → all absent.
**ENUMERATED 6 skipDirs entries = MATCHING SOMETHING IN THIS TREE 0 + MATCHING NOTHING 6.**
This is the COMMON brief's own caution — a filter that matches nothing silently passes everything —
holding literally, and it is the mechanism behind blocking item B2.

**P6 — the compiled web population.** `find web/src -name '*.ts' -printf '%h\n' | sort -u` → 12
directories contain TypeScript compiled by `web/tsconfig.json` (`"include": ["src"]`, verified at
line 25). `TestWebCensusDescendsIntoShippedSource`'s `must` list names 6.
**ENUMERATED 12 = PINNED 6 + UNPINNED 6** (N3).

**P7 — seven execution cells,** T7-01…T7-07, pre-registered in `_run-queue-log.md` with ROOT and
DIST before any of them ran, results recorded in the same file. All are targeted single-package
runs; **no build token was requested or spent; no `./...`, no `make`, no `npm`.**
No production code was modified in any cell. The only mutation was one line of a `_test.go` file,
plus one untracked `.ts` fixture, both reverted; `git status --porcelain` is **empty** and
`gofmt -l internal/webguard/` is **empty** at the end.

---

## 1. BLOCKING B1 — FIVE CITATIONS ADDED BY THIS ROUND ARE STALE, AND THIS ROUND INVALIDATED THEM

**Attribution: cold pass.** Not on my checklist; found by resolving every citation in the diff.

The round's own words, on an added line of `internal/server/export_import.go`:

> Cited by name, not line: this round spent most of itself on citations that resolved to the
> wrong thing.

Five citations added by `e4e3d13` do not resolve to what they describe. All five were **correct at
`c108acb`** and were broken by the insertion of the very comment blocks that cite them: the
`export_import.go` block adds 29 lines above the lines it cites, the `capabilities.ts` block adds 16.

| Citation | Described as | Resolves at `e4e3d13` to | Correct line at `e4e3d13` | At `c108acb` |
|---|---|---|---|---|
| `export_import.go:306` | "refuses a non-farmtable document" | `// SECURITY CONTROL, CONJUNCT A OF TWO...` | **335** | 306 ✓ |
| `export_import.go:331` | "hardcodes farmtable into the params" | `// platform check, turns an unvalidated...` | **363** | 331 ✓ |
| `export_import.go:332` | "builds `RemoteData` from the uploaded doc" | `// privilege grant. Do not relax this...` | **367** | 332 ✓ |
| `export_import.go:412` | "reaches the store" | `if err != nil {` | **447** | 412 ✓ |
| `web/src/capabilities.ts:94` | "the FARMTABLE branch returns ALL_ENABLED" | `// SECURITY CONTROL -- CONJUNCT B OF TWO...` | **110** | 94 ✓ |

Reproduction, verbatim, ROOT above:

```
grep -n 'doc.Collection.Platform != string' internal/server/export_import.go       # -> 335
grep -n 'Platform: collection.PlatformFarmtable' internal/server/export_import.go  # -> 363
grep -n 'RemoteData: sanitizeRemoteData' internal/server/export_import.go          # -> 367
grep -n 'ImportCollection(ctx' internal/server/export_import.go                    # -> 264, 447
grep -n 'collection.platform === Platform.FARMTABLE' web/src/capabilities.ts       # -> 110
git show c108acb:internal/server/export_import.go | grep -n 'doc.Collection.Platform != string'  # -> 306
git show c108acb:web/src/capabilities.ts | grep -n 'collection.platform === Platform.FARMTABLE'  # -> 94
sed -n '306p;331p;332p;412p' internal/server/export_import.go
sed -n '94p' web/src/capabilities.ts
```

**Why this is blocking rather than a nit.** `export_import.go:306` is cited from THREE files —
`convert.go`, `capabilities.ts`, and `export_import.go` itself — and it is the anchor of the entire
CONJUNCT A / CONJUNCT B argument. `capabilities.ts:94` is the anchor of conjunct B. A reader
following either lands on the first line of a prose block rather than on the check, and the round's
whole product is prose that a future engineer is supposed to be able to follow. This is the round's
declared defect class, committed in the commit convened to remove it, in the same comment that
declares it.

**The `:306` self-reference is the one ambiguous member.** `// Second half of CONJUNCT A (see :306)`
can be read as pointing at the start of the CONJUNCT A comment block, which is where 306 now lands.
That reading does not rescue the other four, and it does not rescue the same `:306` in `convert.go`
and `capabilities.ts`, both of which describe it as the *check*.

**Cheapest fix, and it is the fix the comment already argues for: drop the line numbers.** Cite
`ImportCollection`'s platform precondition and `getCapabilities`'s FARMTABLE early return by name.
Line numbers in this repository have now been broken twice by the comments that carry them.

**Falsifier I pre-registered and looked for:** that `e4e3d13` line numbers were never intended and
the citations are relative to the merge target `cc92735`. Checked —
`git show cc92735:internal/server/export_import.go | sed -n '306p'` is not the platform check
either, and no revision on this branch other than `c108acb` and earlier puts the check at 306. The
numbers are base-commit numbers, not target-commit numbers.

---

## 2. BLOCKING B2 — THE B4 FIX HAS NO TEST THAT FAILS WHEN IT IS REMOVED, AND THE NEW TEST'S OWN COMMENT SAYS IT DOES

**Attribution: cold pass, then confirmed by the checklist item "AN UNFIRED GUARD IS AN UNTESTED
GUARD" and by "a control proves the detector fires, it does not prove it is pointed at the right
population".** This is my headline finding.

`TestWebCensusDescendsIntoShippedSource` says of itself, in the error string a future engineer will
read:

> Check skipDirs: it is anchored to TOP-LEVEL entries under web/ on purpose, and a basename match
> here is the exact defect this test exists to catch.

**It does not catch it.** Measured, three cells:

| Cell | Mutation | Predicted | Observed | Artefact |
|---|---|---|---|---|
| T7-01 | none (baseline, DIST ABSENT) | GREEN 3/3 | **GREEN 3/3**, `ok 0.012s` | `/tmp/t7-01.txt` |
| T7-03 | `if rel != "." && skipDirs[rel]` → `if skipDirs[d.Name()]` | GREEN 3/3 | **GREEN 3/3**, `ok 0.012s` | `/tmp/t7-03.txt` |
| T7-04 | T7-03 **plus** plant `web/src/util/dist/deep.ts` = `const rd = coll.remoteData;` | GREEN 3/3 | **GREEN 3/3**, `ok 0.011s` | `/tmp/t7-04.txt` |
| T7-05 | anchoring restored, **same plant kept byte-identical** | RED, UNDECLARED arm | **RED**, `:393`, `src/util/dist/deep.ts:1` | `/tmp/t7-05.txt` |
| T7-06 | full revert | GREEN 3/3 + clean tree | **GREEN 3/3**, `git status --porcelain` empty | `/tmp/t7-06.txt` |

Command for all five, output to a file, no pipe:
`go test ./internal/webguard/ -run '^Test' -count=1 -v > /tmp/t7-0N.txt 2>&1`
Each artefact read in full and each has exactly **3 `=== RUN`** lines, stated in advance from
`grep -c '^func Test'` = 3 and `t.Run` count 0.

**T7-03 is the finding.** The entire behavioural content of B4 can be reverted and the package stays
green. **T7-04 is what that costs**: a live, undeclared consumer of attacker-authored data sitting
in a directory `tsconfig.json` compiles, invisible to all three tests. **T7-05 is the control that
makes T7-04 mean something** — the same plant, unchanged, drives the guard red the moment the
anchoring is back, so T7-04's green is a blind guard and not a dud plant.

**The mechanism, and it is the COMMON brief's own caution.** `descended` is identical under both
pruning policies because **no directory under `web/` at depth ≥ 1 carries a `skipDirs` basename**
(P5). The six-entry filter matches nothing in this tree, so the two policies are observationally
identical to an assertion that only inspects the real tree.

**What R7-04 actually measured.** R7-04 mutated `skipDirs` by *adding* `"src/util": true` — a
top-level widening. I replicated it at the committed SHA (T7-02): **RED on
`TestWebCensusDescendsIntoShippedSource` only, PASS/PASS on the other two**, exactly as recorded.
So R7-04 is a true and well-run cell. It proves the detector fires. It does not prove the detector
is pointed at the basename defect, and the record reads R7-04's green-then-red as evidence for a
claim about the basename defect that R7-04 never tested. **R7-02 is the cell that really
demonstrated the anchoring fix — and R7-02's evidence was deleted in R7-03.** The three plants were
scaffolding; nothing in the repository inherited their power.

**The remedy is already sitting in the code and is not being used.** `censusRemoteDataMentions`
takes `root string`. Point it at a `t.TempDir()` fixture containing
`web/src/build/x.ts`, `web/src/util/dist/x.ts`, `web/src/components/coverage/x.ts` and assert the
census finds all three. That converts R7-02's deleted plants into a permanent test, needs no change
to the guard, and would go red on T7-03's mutation. Until something like it exists, the second
sentence of the test's error message is false and should be deleted even if nothing else changes.

**Falsifier, pre-registered before T7-03 ran:** if any directory under `web/` at depth ≥ 1 had a
`skipDirs` basename, the two policies would differ and T7-03 would go red, killing the finding.
Command and empty result in P5. T7-03 was run to give the falsifier its chance; it did not fire.

---

## 3. BLOCKING B3 — CONJUNCT B IS ASSERTED IN THREE FILES AND ENFORCED BY NOTHING

**Attribution: cold pass.**

The round's load-bearing sentence, stated in `export_import.go`, `convert.go` and `capabilities.ts`:

> EITHER ONE MOVING ARMS THE OTHER. Accepting a non-farmtable platform here, **or reordering
> capabilities.ts to consult writable before the platform check**, turns an unvalidated
> user-supplied map into a privilege grant.

The two conjuncts are presented as equally load-bearing. They are not equally guarded.

**Conjunct A is covered, and the round does not say so.**
`internal/server/export_import_test.go:629 TestRPC_ImportExportCollection_Errors`, lines 649–652,
sets `collection.platform = "github"` in the uploaded document and asserts
`assertCode(t, err, codes.FailedPrecondition)`. Removing the `export_import.go:335` check goes red.
Verified by reading; not run in isolation (see §9). **The comment should cite this test** — an
invalidating event that is already caught is the single most useful thing a comment like this can
tell the next engineer, and it is the one thing it omits.

**Conjunct B is covered by nothing.** Reorder `getCapabilities` so the `remoteData`/`writable` read
precedes the `Platform.FARMTABLE` early return and:

- `go test ./internal/webguard/` stays **green** — the declared allowlist text
  `const rd = collection.remoteData;` is unchanged by moving the line, `count: 1` still holds, and
  `TestWebRemoteDataCensusIsNonVacuous` still finds it. The census keys on the *text of a line*,
  not on its position, so a reordering is exactly the class of edit it is structurally blind to.
- `npm test` stays **green** — 4 web test files, **none** exercises `getCapabilities` (P4).
- `tsc` stays green; the reorder is type-correct.

So the round documents a privilege-escalation gate in three languages of prose and ships zero
executable assertions on the half of it that lives in TypeScript. The fix leg knew: the `skipDirs`
comment says "a test for the two capability gates cannot be written without a fixture naming the
field". It reasoned about what such a test would do to the census and then did not write it.

**Recommended test, highest priority in this report.** In the existing harness
(`web/tsconfig.test.json` compiles `src/**/*.test.ts`, `scripts/run-tests.mjs` runs them),
`web/src/capabilities.test.ts`:

1. `getCapabilities({platform: FARMTABLE, remoteData: {writable: true}})` → `ALL_ENABLED`, **and
   assert the function did not consult `remoteData`** — pass a `Proxy` or a getter that throws, so
   the test fails on *the read*, not on the returned value. Returning `ALL_ENABLED` is true under
   both orderings; only the read is discriminating. This is the arm that catches the reorder.
2. `getCapabilities({platform: GITHUB, remoteData: {writable: true}})` → `GITHUB_CAPABILITIES`.
3. `getCapabilities({platform: GITHUB, remoteData: {writable: "true"}})` → `ALL_DISABLED`
   (string, not boolean — the production check is `rd.writable === true`).
4. `getCapabilities({platform: GITHUB, remoteData: null})` → `ALL_DISABLED`.
5. `getCapabilities({platform: GITHUB})` (field absent) → `ALL_DISABLED`.

Adding it will make the census go red on the fixture, which is correct and is one allowlist line —
the same honest cost the fix leg paid at R7-07/R7-08, and the entry's `reason` should say
"test fixture" so it is not mistaken for a consumer.

---

## 4. THE NINE PRE-REGISTERED CELLS — CELL BY CELL

Judged as evidence, not accepted as claims. `T` marks something I re-ran here.

| Cell | Claim | My assessment |
|---|---|---|
| R7-01 | baseline GREEN 3/3, 3 `=== RUN` | **SOUND.** Replicated as T7-01 at the committed SHA with DIST ABSENT. |
| R7-02 | 3 plants → RED, UNDECLARED arm, all three named | **SOUND AND IT IS THE BEST CELL IN THE ROUND.** Positive control planted inside the population actually searched. Reproduced in spirit as T7-05 (one plant, same directory class, same arm, same shape of output). Its weakness is not the cell, it is that its evidence was deleted (B2). |
| R7-03 | plants removed → GREEN | **SOUND**, and non-vacuous exactly as argued: R7-02 drove the same command red minutes earlier. |
| R7-04 | `skipDirs += "src/util"` → RED on the descent test only, PASS/PASS elsewhere | **THE CELL I TRUST LEAST.** Faithfully executed and faithfully reported — T7-02 reproduces it exactly, including the PASS/PASS. But it is read in the record as evidence that the new test catches the basename defect, and it tests a different mutation. See B2. |
| R7-10 | `-run '^TestRemoteData'` GREEN | **SOUND.** Replicated as T7-07: 49 `=== RUN`, 0 `--- FAIL`. |
| R7-11 | revert per-field keying → RED on `TestRemoteDataDropLogIsSampledPerField` only; `TestRemoteDataDropLogIsSampled` PASSES | **SOUND, AND THE DISCRIMINATOR IS THE RIGHT ONE.** Pre-registering that the *old* test passes under the mutation is the strongest single move in the record: it measures the blindness rather than asserting it. Not reproduced here (would require mutating production code — §9). One gap: it reverts timer **and** counter together, so the test's counter arm never fired (N5). |
| R7-12 | `%q`→`%s` → RED on `TestRemoteDataLogQuotesAttackerKeys` only | **SOUND**, and the artefact reportedly shows the forged record breaking across two lines, which is the right evidence: a demonstrated injection primitive, not an argued one. |
| R7-13 | restore "this should not happen" → RED on `...IsNotAParadox` only | **SOUND.** The branch is genuinely reachable: `structpb.NewStruct` validates key UTF-8, `NewValue` never sees keys. Verified by reading `unrepresentableKeys`; the test's `got != nil` premise guard is the right shape. |
| R7-14 | all reverted → GREEN | **SOUND.** |

**The record's line citations are exact, and I checked because I doubted them.** R7-04 reports
`remotedata_consumers_test.go:495`; the `t.Errorf` is at :494 in the unmutated file at `3ff66f4`.
That looked off by one. It is not: the mutation *adds a line to `skipDirs`*, shifting the `Errorf`
to 495. T7-02 reproduces the arithmetic exactly — :506 unmutated here, Go reported **:507** with my
one added line. R7-02's `:381` reconciles the same way (a `.ts` plant shifts no Go line, and :381
is the `Errorf` at `3ff66f4`). **These numbers were read off artefacts, not composed**, which given
the round's two self-reported instances of composing mtimes from expectation is worth stating.

**The 6-vs-49 self-correction is the best thing in the record.** Pre-registering a count, getting
49 against a stated 6, and publishing the reason (`grep` scoped to the edited file, `-run` scoped
to the package, plus subtests) is the instrument working. Two reservations, both N-grade: the
corrected 49 is derived from the artefact it validates, so it cannot fail on first use (N6); and 49
is a **total**, which absorbs cross-member compensation (N6). T7-07 is the first independent
re-derivation and it matched, in a different ROOT, with every one of the 13 top-level functions
passing **by name** — which is the identity binding the total lacks.

---

## 5. THE THREE NEW `internal/server` TESTS, AS TESTS

Criterion: can each fail, for the reason it names, and only for that reason?

**`TestRemoteDataDropLogIsSampledPerField` — the strongest of the three.** It has a real setup
assertion (`if n := countLines(buf); n != 1 { t.Fatalf("setup: ...") }`) that fails *as setup*
rather than as the headline, so a broken fixture cannot masquerade as the finding. The advance to
`time.Second` is well inside `remoteDataLogInterval`, so the discriminating condition is sharp. The
clock seam means it is **not** load-sensitive, which matters given the flake context in my brief.
One defect: **its third arm has never fired** (N5).

**`TestRemoteDataUnrepresentableKeyIsNotAParadox` — sound, with a weak second arm.** The
`got != nil` premise guard is right: if `structpb` ever accepts an invalid-UTF-8 key the test says
its own premise died rather than reporting a false pass. But `!strings.Contains(out, "KEY")` passes
on any message containing that substring anywhere, including one that has drifted to say something
else entirely in capitals. Prefer asserting the operator-actionable phrase, e.g. `"is a KEY"` plus
`"UTF-8"`.

**`TestRemoteDataLogQuotesAttackerKeys` — sound; two arms fire together on one fault.** Under the
`%s` mutation, arm 1 (raw newline present) and arm 2 (escaped form absent) both fire, plus arm 3
(2 lines). R7-12 records exactly that: "RED ... on all three of its assertions". They do not mask
each other and the reader can tell which fired, so this is cosmetic (N8) — but a probe reporting
three failures for one fault trains readers to skim.

**Fixture hygiene is good and worth naming.** `captureRemoteDataLog` resets
`remoteDataLogSamplers` to a fresh map on entry *and* in `t.Cleanup`, and the round's addition of a
self-registering `t.Cleanup` in `withRemoteDataLogClock` — fixing a frozen clock that would have
leaked into unrelated tests in the package — is a real, unglamorous, correctly-reasoned fix. No
`t.Parallel` in the file, which is required given the package-level globals and the redirected
`log` output, and is correctly absent.

---

## 6. THE WEBGUARD ALLOWLIST AND CENSUS

**Sound and I want to say so.** Keying on exact trimmed text rather than line numbers is right and
has now been vindicated twice (B1 is what happens to the other choice). Exact multiplicities rather
than floors is right. Listing generated transport code line by line rather than excluding
`src/gen/` by directory is right. `TestWebRemoteDataCensusIsNonVacuous` duplicating part of the
allowlist deliberately, so that an emptied allowlist cannot make both tests pass, is right and is
the kind of thing that usually gets "simplified" away. `filesScanned == 0` → `t.Fatalf` is a real
non-vacuity check on the walk.

The stale-arm error message rewrite is a genuine improvement: it now tells the reader the arm fires
on inequality in *either* direction and names the byte-identical-duplicate case (R6-23) that lands
there rather than on the undeclared arm. T7-05's output confirms the undeclared arm's message
renders correctly with a real finding in it.

Residual issues are N2, N3, N4 below, and B2 above.

---

## 7. CLAIMS I TRIED TO BREAK AND COULD NOT

Recorded because a review that only lists defects is not a measurement.

- **`doc.go`'s entire CI rewrite verifies.** `cc92735` resolves in this clone
  (`git log --oneline -1 cc92735` → `Merge PR #205: stand up CI on GitHub Actions`).
  `git show cc92735:.github/workflows/ci.yml` confirms: triggers `pull_request` and
  `push: branches: ['**']`; `go test ./... -v` invoked **directly** as its own step (line 144) with
  `make test` afterwards as a separate Makefile self-check (line 185); and steps asserting
  `web/dist` is **absent** before the build (line 102) and **produced** by it (line 118).
  Retracting a paragraph that was true when written, in place, with the general lesson attached, is
  the right handling and the claims are accurate.
- **`.github/workflows` does not exist at `e4e3d13`** (`git ls-tree -r --name-only HEAD -- .github`
  → two template files only), which is consistent with the doc's framing of CI as a property of the
  merge target rather than of this tree.
- **`Dockerfile:9` and `Dockerfile.server:9` are both `RUN npm test`.** ✓
- **`assets.go:5` is `//go:embed all:web/dist`.** ✓ (repo root, not `internal/`).
- **The `npm test` script is quoted exactly**: `rm -rf .tmp-test && tsc -p tsconfig.test.json &&
  node scripts/run-tests.mjs`, and `tsconfig.test.json` sets `"outDir": ".tmp-test"`, so the
  `.tmp-test` non-idempotency prediction in `skipDirs` is mechanically correct.
- **`tsconfig.json` line 25 is `"include": ["src"]`.** ✓
- **22 of 27 citations resolve as described** (§1) — including all 11 into `entstore.go` and
  `server.go`, which are the load-bearing ones for the write-authorization argument, and all four
  `passthrough.go` references.
- **DIST PRESENT was immaterial.** T7-01 and T7-07 reproduce the fix leg's greens with `web/dist`
  and `web/node_modules` both absent. The r7 results are a property of the commit.
- **A hypothesis of mine died here, and it is worth recording.** I suspected the three r6
  falsification plants were all in `.gitignore`d paths, which would have meant the B4 fix defended a
  population that cannot reach the merge target through git. **False.** `git check-ignore -v` on the
  three: only `web/src/util/dist/deep.ts` is ignored (`.gitignore:17:dist/`); `web/src/build/` and
  `web/src/components/coverage/` are **not** ignored (`bin/` and `coverage.*` do not match them).
  Two of three plant classes are committable and would ship. The B4 fix defends real ground and my
  broader claim was wrong. The fix leg's unanchored-`dist/` finding stands on its own and is real.

---

## 8. NON-BLOCKING

- **N1 — `capabilities.ts` reintroduces the exact count `convert.go` forbids in capitals.**
  `convert.go` spends a paragraph headed *"WHY THERE IS NO NUMBER IN THE PARAGRAPH ABOVE, AND PLEASE
  DO NOT ADD ONE"*, explaining that "the two producers" is a population claim with nothing guarding
  it. Sixteen lines added to `capabilities.ts` in the same commit say: *"see ... convert.go, for the
  **two producers** of a GITHUB-platform collection object and why **both** currently yield null."*
  The count is accurate today (`CreateCollection` RPC and `syntheticCollection`) and rots on the day
  a third appears, with nothing going red — which is precisely the argument. It survived because it
  is in the other language, where the Go reviewer does not look. Restate as the conjunction.
- **N2 — the `capabilities.ts` allowlist key reads as the opposite of the line it declares.** The
  declared text is `// STYLE CHOICE. Import copies an uploaded document's collection remoteData`.
  The source says `...AND IT IS NOT A` / `STYLE CHOICE. Import copies...` — the key is a wrapped
  mid-sentence fragment whose plain reading inverts the meaning. The allowlist's value is that a
  human wrote down what each site is; an entry captioned "STYLE CHOICE" for a security annotation
  costs that. Rewrapping the comment so the identifier lands on a self-describing line fixes it.
- **N3 — the descent test pins 6 of 12 compiled directories.** `must` names `src`,
  `src/components`, `src/gen`, `src/store`, `src/util`, `src/utils`. Twelve directories under
  `web/src` contain `.ts` (P6). The six unpinned are all `src/components/*`:
  `dependency`, `inspector`, `kanban`, `minimap`, `ready-queue`, `tree`. A `skipDirs` entry naming
  one of those is invisible to the very test written to make pruning visible. Derive `must` from the
  walk (assert every directory containing a `.ts` file was descended into) rather than hand-listing.
- **N4 — the descent test's two prune controls are vacuous in this tree, and the bound matters.**
  `if descended["node_modules"]` and `if descended["dist"]` cannot fire when those directories do
  not exist, and **neither exists in a fresh checkout** — so in T7-01…T7-06 both passed for the
  wrong reason, and they would pass with `skipDirs` emptied entirely. **Bound, stated with the
  finding:** in CI they are non-vacuous, because `npm ci` (ci.yml:73) and `make build` (ci.yml:115)
  both precede `go test ./...` (ci.yml:144), so both directories exist by then. It is the local
  developer run — the one `doc.go` argues this package exists to serve — where the control is dead.
  A one-line `t.Skip`-or-assert on the precondition would make the vacuity visible.
- **N5 — the counter-separation arm of `TestRemoteDataDropLogIsSampledPerField` has never fired.**
  R7-11 reverts the timer *and* the counter together; the first assertion is a `t.Fatalf`, so
  execution stops before the "first collection line reports suppressed drops it did not have" arm
  is reached. The missing cell is a mutation that keys the **timer** per field while leaving
  `suppressed` package-level. I did not run it because it requires mutating production code
  (`convert.go`) and my brief forbids that; I predict RED on that arm — the shared counter would be
  49 at the collection line, printing `(+49 further drop(s) suppressed ...)` — and I would like the
  cell run rather than the arm trusted.
- **N6 — R7-17's pin is a total, derived from the run it validates.** "49 `=== RUN`, 0 `--- FAIL`"
  cannot fail on the run it was read off, and a total absorbs cross-member compensation: a deleted
  test plus an added table row leaves 49 intact. It does detect an uncompensated deletion. T7-07
  supplies the missing level — 13 named `--- PASS` lines — and that list, not the total, is what a
  future round should pin.
- **N7 — `R7-09` does not exist in `_run-queue-log.md`.** A gap in a pre-registered sequence is
  indistinguishable from a cell that was run and not reported. Almost certainly a numbering slip;
  worth one line saying so.
- **N8 — overlapping arms in `TestRemoteDataLogQuotesAttackerKeys`.** Three failures for one fault
  (§5). Diagnosable, not masking. Cosmetic.
- **N9 — `.gitignore:17` is `dist/`, unanchored.** The fix leg's own unplanned finding, correctly
  routed rather than fixed. I confirm it and add the scope: of the three r6 plant paths, **only**
  `web/src/util/dist/` is ignored; `build/` and `coverage/` at depth are committable (§7). So the
  gitignore defect and the `skipDirs` defect overlap on one path out of three and are otherwise
  independent problems.
- **N10 — `convert.go` presents a paraphrase as a transcription.** The indented block quoting
  `getCapabilities` renders the GITHUB test as `if (rd && rd.writable === true)`. The source
  (`capabilities.ts:114`) is
  `if (rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true)`. The paraphrase is
  faithful in effect and the simplification is defensible, but it is set as a code block, and in a
  round about citations resolving to the right thing a quoted block that is not the code should say
  it is abridged.

---

## 9. WHAT I DID NOT CHECK

Real section. These are the places a defect could be and I would not have seen it.

- **No wide run. No `go build ./...`, no `go vet ./...`, no `go test ./...`, no `make`, no
  `npm test`, no `tsc`.** I did not request the token. **Every package other than `internal/server`
  and `internal/webguard` is unverified by me**, exactly as the fix leg stated, and
  `web/src/capabilities.ts` has still never been type-checked. Its edit is comment-only — I read the
  diff and it adds only `//` lines — but comment-only is an argument, not a receipt, and an
  unterminated construct is precisely the thing arguments miss. **I recommend the token be spent on
  `npm test` and `tsc --noEmit` before anything else**, because that is the only unverified language
  in the round.
- **I did not run `TestRPC_ImportExportCollection_Errors`.** My claim that conjunct A is covered
  (§3) rests on reading lines 637–652, not on observing a red under a mutation of
  `export_import.go:335`. That mutation is production code and my brief forbids it. **The claim is
  therefore READ-VERIFIED, NOT EXECUTION-VERIFIED**, and by the COMMON brief's own standard it is
  unresolved rather than clean.
- **I did not fire N5's cell** (per-field timer, shared counter) for the same reason. The arm is
  unmeasured, in both directions.
- **I did not mutate anything in `internal/server`.** R7-11, R7-12 and R7-13 are audited by reading
  the tests, the production code they exercise, and the record — not by reproduction. If those three
  artefacts are wrong, I would not know. T7-07 shows only that all 13 tests pass at `e4e3d13`.
- **I did not attempt the aliasing or dynamic-access evasions** the census documents as out of
  scope (`const x = coll['remote'+'Data']`, a consumer receiving the value as a differently-named
  parameter). The guard says it cannot see them; I did not test that it cannot, and I did not test
  whether any such consumer exists today.
- **I did not audit `web/dist`.** It does not exist in this ROOT, so I could not inspect the bytes
  actually embedded by `assets.go:5`. `doc.go` names this gap; I did nothing to close it.
- **I did not verify the r7 artefacts `/tmp/r7-*.txt`.** They live on the fix leg's container and
  are not reachable from mine. Everything I say about those cells is from the record plus
  reproduction, and where the two agree I have said so.
- **I did not re-run anything more than once.** My brief warns that several tests here are
  load-sensitive and a single-run matrix carries real odds of a spurious RED. All my reds were
  *predicted* reds that reverted cleanly, and all my greens were reproduced at least twice
  (T7-01/T7-06 are the same command on the same tree state, 15 minutes apart, both green), but
  **no cell here was repeated for flake**, and the 49 in T7-07 is a single observation.
- **I did not check whether any consumer of this API exists outside `web/`.** Out of tree, as the
  guard says.
- **I did not open `_r7-PHASE-TWO.md` before writing everything above.** §§0-10 are the cold pass
  exactly as written; §11 is the reconciliation, appended after, and it is the only section that
  draws on prior artefacts. B4 is flagged there as partly handed to me.

---

## 10. WHERE THIS BRIEF WAS WRONG

- **`r7-test.md` says "Nine cells, pre-registered, recorded under `FIX ROUND r7`". The section
  contains sixteen labelled cells, of which nine carry an advance prediction.** The number is
  recoverable — nine is exactly the count of cells with an explicit `PREDICT`/`PREDICTION` — but I
  spent real time deciding whether "nine" meant the brief was stale, whether cells had been added
  after it was written, or whether I was looking at the wrong section. **`R7-09` is also missing
  from the sequence**, which made "nine" look like it might be a stale count of a renumbered set.
  Say "nine cells carry an advance prediction; there are sixteen labelled cells in the section."
- **The brief's most useful line is also the one that nearly cost me the finding.** "AN UNFIRED
  GUARD IS AN UNTESTED GUARD" is first in the list, and the fix leg's record *answers it directly* —
  R7-04 exists, is titled `CANARY FOR THE NEW TEST ITSELF. AN UNFIRED GUARD IS AN UNTESTED GUARD`,
  and passes. A checklist item that the artefact under review has already answered **in its own
  words** is the hardest kind to press on, because the box is visibly ticked. What actually got me
  there was the next item down — "a control proves the detector fires, it does not prove it is
  pointed at the right population" — applied to R7-04 rather than to the code. **The ordering of
  those two items is doing real work and I would keep it**, but it is worth stating explicitly that
  item 2 is meant to be applied to *item 1's evidence*, not only to the round's guards. As written,
  each item reads as a separate axis.
- **"Do not modify production code" and "audit the canary evidence" are in tension, and the brief
  does not resolve it.** Four of the nine pre-registered cells (R7-11…R7-14) are mutations of
  `internal/server/convert.go`. I cannot reproduce a production-code mutation without modifying
  production code. I read the rule as protecting the deliverable — do not ship fixes — rather than
  banning reverted local mutation, but I did not act on that reading, and the result is that the
  four cells I could not reproduce are the four with the largest security consequence. **This is the
  single biggest gap in my report and it is caused by the brief.** Either say "reverted local
  mutations in your own tree are fine, prove the tree is clean afterwards", or accept that the fix
  leg's own mutation cells are unauditable by the leg convened to audit them. I chose the
  conservative reading and lost coverage for it; N5 and the second bullet of §9 are the price.
- **Minor, and possibly deliberate: `_r7-COMMON.md` says every worked example is drawn from a closed
  workstream.** `r7-test.md` then cites `(R6-23)` — no, that is the code, not the brief. The briefs
  are clean on this. Recording that I checked and found nothing, because the COMMON brief asks for
  the defect to be reported and a silent absence is indistinguishable from not looking.
- **Credit where it is due:** the instruction to note the flake context *before* reading any single
  run as a result changed how I designed T7-01…T7-06 — every green is bracketed by a predicted red
  on the same command and the same tree — and the instruction to plant the positive *inside* the
  population being searched is the entire reason T7-05 exists and therefore the reason T7-04's green
  means anything.

---

## 11. PHASE TWO — RECONCILIATION AGAINST r6 AND AGAINST THE FIX BRIEF

Opened after everything above was on disk. Sections 0–10 are unedited; this section is additive,
and one new blocking item (B4) arises here.

### 11.1 Every r6 finding the round was told to fix — did it land?

| r6 finding | Brief item | Landed? | My independent position |
|---|---|---|---|
| review PO-1 / audit F2 — three writers named, two discharged | B1 | **YES** | Read it; the Caller/Type split is correct and the "yes, (2) is a type argument" self-defence is the right shape. |
| review PO-2 / A1 — `syntheticCollection` clause deleted | B2 | **YES** | Restored and escalated to the gate, as A1 asked. All four `passthrough.go` citations resolve (§7). |
| review PO-3 / test F6 — `doc.go` CI rationale stale vs `cc92735` | B3 | **YES** | **Independently verified against `cc92735` in §7. Every claim accurate.** Best-executed item in the round. |
| test F1 — `skipDirs` prunes by basename at any depth | B4 | **YES, and it works** | T7-05 proves the fix. **But see B2 in §2: it has no test.** |
| test F2 — sampler global, not per-field | B5 | **YES** | Best-canaried item (R7-11's discriminator). |
| audit F4 — `%s` on attacker keys | non-blocking | **YES** | Canaried at R7-12. |
| test F5 — "this should not happen" reachable | non-blocking | **YES** | Canaried at R7-13. |
| test F4 — `.tmp-test` missing from `skipDirs` | B4 | **YES** | Added; the non-idempotency prediction is mechanically correct (§7). |
| review PO-5 / A3(ii) — "occurrence census" is a line census | A3 | **YES** | Corrected in `doc.go` and in the census doc comment. |
| review PO-6 / A3(iii) — `withRemoteDataLogClock` no cleanup | A3 | **YES** | §5. Correctly reasoned, unglamorous, right. |
| review PO-4 / A3(i) — doc overstates population re `dist`/embed | A3 | **YES** | `doc.go`'s "IT CANNOT SEE THE BYTES THE SERVER ACTUALLY SHIPS" is a good, honest limit. |
| review PT-2 / test F8 — stale-arm header describes only absence | non-blocking | **YES** | §6. The rewrite names the R6-23 surplus case explicitly. |
| audit F1 / A2 — annotate the two conjuncts | A2 | **YES, and it is where B1 came from** | The annotation is correct in substance and carries four of the five stale citations (§1). |
| audit F6 / A3(iv) — import URL-error vs silent-drop asymmetry | A3, "or note in the log" | **YES, in the log** | Project log line 252 discharges it as instructed. |
| "does B4 make Go-side widening easier or harder" | required log note | **YES** | Project log line 207: EASIER, with a warning that the population is not analogous. A good answer. |
| audit F3 / Condition 2 — census population is web-only, live Go consumers exist | **HELD, "do not attempt"** | **PARTLY — see B4 below** | The widening was correctly not attempted. The *qualification* was not made in the code. |
| review PT-3 / audit F5 / test F3 — `ci-suite-manifest.mjs` merge blocker | NOT YOURS | correctly untouched | Out of my scope too; not checked. |

**Fourteen of fifteen in-scope items landed, and the two hardest (B3, B5) landed well.** That is
the context for a REQUEST CHANGES: the round did what it was told, and the three blocking items in
§§1–3 are all things nobody told it.

### 11.2 BLOCKING B4 (new, arises in phase two) — THE GUARD STILL STATES A LIMIT THAT IS FALSE

`internal/webguard/remotedata_consumers_test.go:83`, in "WHAT IT DOES NOT COVER, stated plainly
because an unstated limit is how a guard becomes a false assurance":

> - Anything outside web/. **Other clients of this API are not in this tree.**

That sentence is false. `internal/server/graph_support.go:22` `collectionSupportsGraph` reads
collection `remote_data` — `c.RemoteData["graph_queries"]` — and, if the key is present and holds a
bool, **returns it, overriding the per-platform default**. That is an in-tree, Go-side, non-web
consumer of the same attacker-authored map, keyed on a non-URL-bearing key that `sanitizeRemoteData`
passes through exactly as it passes `writable`. Import plants it: platform is forced to farmtable,
and unlike `writable`, `collectionSupportsGraph` has **no platform early return** — conjunct B does
not protect it. The reachable effect is feature denial rather than privilege escalation, so the
severity is low; the *documentation* defect is not, because this is the sentence a future engineer
will use to decide the guard's population.

**Attribution, honestly:** `_r7-PHASE-TWO.md` handed me `graph_support.go:22` under "things already
known". I did not find it cold. What is mine is that it directly contradicts a sentence *in the
guard*, and that this is r6 audit **Condition 2** — "qualify the claim or add a Go census" —
discharged in the **project log** (line 230) and **not in the code**. The correction landed in the
artefact nobody reading the guard will open. One sentence fixes it: *"Anything outside `web/`,
including in-tree Go consumers — `collectionSupportsGraph` (`internal/server/graph_support.go`) is
one today."*

**Not the round's fault, and I want that recorded**: the fix brief HELD the widening ("Do not
attempt it") and never carried Condition 2's *alternative* — qualify the claim — into a work item,
even though it did carry A3(i), which is the same kind of correction to the same doc.
`collectionSupportsGraph` does have direct tests (`graph_support_test.go`, including both boolean
override cases), so the behaviour is covered; only the guard's self-description is wrong.

### 11.3 Where I agree, disagree, and where I am independent

- **INDEPENDENT (§2, blocking).** No r6 leg raised it — the basename bug was r6's F1 and the fix is
  r7's. Mine is the next question: the fix ships with no test that fails when it is removed. Worth
  noting the brief *caused* this: **B4's canary requirement is specified as "re-plant, show RED,
  then revert and re-confirm green"**, which by construction produces evidence and leaves no
  residue. The fix leg executed that instruction exactly. **The canary shape is the defect, not the
  compliance.** B4 also said "consider asserting the count of directories actually descended into";
  a *count* would have been strictly weaker than the name-list that shipped — a total, absorbent to
  compensation, the same shape as test-r6's own F7.
- **INDEPENDENT (§3, blocking), and it is a dropped hand-off.** `test-xss-r6.md` F4 forecast it in
  as many words — "the obvious follow-up to this round is a web test for the two capability gates,
  `getCapabilities` and `isCollectionWritable`" — and it was used only to argue for `.tmp-test` in
  `skipDirs`. It was never carried into `dev-xss-r7-fix.md` as a work item. r6 predicted the gap,
  r7 did not close it, and r7's `skipDirs` comment reasons about what such a test *would* do to the
  census without writing it.
- **INDEPENDENT (§1, blocking), and it is a SECOND-ROUND RECURRENCE.** `review-xss-r6.md:277-282`
  and `audit-xss-r6.md:444` both observed that the *previous* comment's line citations resolved to
  plausible-but-wrong lines, and both noted that resolvability is precisely what made them
  dangerous. **Neither recommended by-name citation, and the brief took no position** — it cites by
  line throughout and instructs the dev to reproduce that style. So r7 rewrote the comment, fixed
  the wrong-line problem it inherited, and created five new instances of it in the same commit. The
  fix leg reached the right rule on its own — "Cited by name, not line" — and then did not apply it
  four lines later. **This is now a standing repository defect, not a leg's slip, and it will recur
  in r8 unless it becomes a rule.**
- **AGREE, and I extend it.** test-r6 F7 (`EXPECTED_ASSERTIONS = 380` pins a suite total; cross-file
  compensation stays green). My N6 is the same defect in a different instrument (R7-17's `49`), and
  N3 is a third (`must` pins 6 of 12 compiled directories). **Three independent instances of
  "the pin is a total where it needs to be an identity" in one branch.** Per the COMMON brief's own
  remedy — name the cause as a number you have not yet checked — the number I checked was 12, and
  6 of them are unpinned.
- **DISAGREE, mildly, with test-r6 BE4.** BE4 says the `DIST=present` log column is under-specified
  and "carries no information". It carries exactly one piece of information and nobody used it:
  **`DIST` decides whether the descent test's two prune controls are vacuous** (N4). With DIST
  PRESENT, `!descended["dist"]` is a real assertion; with DIST ABSENT — every r7 review leg's tree,
  and any fresh clone — it cannot fail. The column should stay, and `NODE_MODULES` should join it.
- **AGREE with review-r6 PO-8, and it is load-bearing for B5.** `labels` unconditional on the
  passthrough task path is what makes `task.remote_data` a continuous drop, which is what makes the
  shared limiter a real suppression rather than a theoretical one. The r7 comment restates it
  correctly and `TestRemoteDataDropLogIsSampledPerField` encodes it as a 50-task page.

### 11.4 The fix leg's three self-reports — verified, not accepted

1. **6 vs 49, stated cause: counted functions in the FILE, not the PACKAGE the `-run` filter
   selects. CAUSE CONFIRMED, and it is complete.**
   `grep -c '^func TestRemoteData' internal/server/remotedata_log_test.go` → **6**.
   `grep -rn '^func TestRemoteData' internal/server/` → **13** functions.
   T7-07 → **49 `=== RUN`**, 13 top-level + 36 subtests. The stated cause fully accounts for the
   gap; there is no second cause hiding behind it. **The self-report is sound.**
2. **Two compile-receipt mtimes written from expectation, each one second off `ls`.** The
   self-diagnosis — the message was composed with the receipt already in it, then the build was run
   — is the correct and more damning reading, and the leg reached it itself after the second
   instance. **Which parts of the canary record depend on a number written in advance?**
   **Only R7-06 and the two commit messages for `d025390` and `0420f7c`** — i.e. the *compile
   receipts*, and nothing else. Every PASS/FAIL cell in §4 is pinned by an artefact that was read
   after the run: R7-01/02/03/04's arms, the 49, and the `--- FAIL` counts. I checked the most
   falsifiable consequence available to me — the *line numbers* in R7-02 and R7-04, which cannot be
   composed from expectation because they depend on a one-line mutation shifting a `t.Errorf` — and
   **they reconcile exactly** (§4). A leg composing numbers from expectation would have written
   :494 and :381; it wrote :495 and :381, which is what the artefacts say. **The receipts are the
   contaminated class; the canary record is not, and the separation is clean.**
   I would still not accept R7-06 as a compile receipt on its own terms: existence-plus-mtime after
   an `rm -f` is sound, but `internal/server` compiling is better evidenced by T7-07 having *run*
   its tests, which no mtime can fake.
3. **Producer count reported wrongly once and corrected.** Corrected in `convert.go`, which now
   refuses to state a count and says why. **And then re-introduced it in `capabilities.ts`** — see
   N1. The correction was made in one language and undone in the other, in the same commit.

### 11.5 Two corrections to `_r7-PHASE-TWO.md`

- **The `git check-ignore` exit code is wrong, and the error runs against the brief's own argument.**
  PHASE-TWO states `git check-ignore -v web/dist` reports "NOT IGNORED, **rc=0**, no warning", and
  builds the hazard on that: "a correct-looking command with a **zero exit code** will tell a
  careful person the finding is false." Measured in ROOT at `e4e3d13`:
  `git check-ignore -v web/dist` → no output, **rc=1**. `check-ignore` exits 1 when no path matches,
  so the command does *not* fail silently-green; anyone chaining it with `&&` or checking `$?` sees
  the miss. **The misleading part is the human-readable output, not the status.** The hazard is
  real and the prescribed remedy is right; the polarity argument attached to it is not.
- **The instrument advice is correct and I had already used it.** My §7 refutation was run in the
  inside-path form. Re-run with the negative controls PHASE-TWO asks for, single invocation:
  `web/dist/index.html` → IGNORED (`:17 dist/`); `web/src/util/dist/deep.ts` → IGNORED (`:17`);
  `web/src/coverage.ts` → IGNORED (`:35 coverage.*`); `web/node_modules/pkg/x.js` → IGNORED
  (`:45`); and the four that must NOT match — `web/src/build/telemetry.ts`,
  `web/src/components/coverage/deep2.ts`, `web/src/notdist/x.ts`, `web/src/distant/x.ts` — all came
  back **NOT IGNORED**. The filter is not over-matching, and §7's conclusion stands under the
  stricter method: **only one of the three r6 plant classes is uncommittable.**

### 11.6 Additions to §10, WHERE THIS BRIEF WAS WRONG

- **The embargo worked this round and it is worth saying so.** r6's three legs all reported the same
  structural defect (review B1, audit 6.1, test BE1): the phase-two material sat inside the file the
  dispatch ordered read first, and it destroyed the cold pass on all three legs. Splitting it into
  `_r7-PHASE-TWO.md` fixed it. **§§1–3 of this report are all cold-pass findings and none of them
  appears in any r6 artefact.** The repair is measurable and it held.
- **The one place phase-two material still leaked is `r7-test.md` itself.** My role brief says "the
  fix leg's own bound is that every package other than `internal/server` and `internal/webguard` is
  unverified and `web/src/capabilities.ts` never saw `tsc`". That is a phase-two fact — it is the
  fix leg's self-report, restated verbatim in the last paragraph of the r7 log section — delivered
  to me in the file I am told to read second, before the cold pass. It cost me little because it is
  a bound rather than a finding, but by COMMON's own standard it belongs in `_r7-PHASE-TWO.md`.
- **The brief never asked whether the round's own citations resolve.** Given that two r6 reports
  named wrong-line citations as the mechanism that made the previous comment dangerous, and given
  that the round's deliverable is almost entirely comments carrying citations, "re-resolve every
  citation the diff adds" is the single highest-yield checklist item that was not on the list. It
  produced my cheapest blocking finding. **I would put it on every future prose-heavy round's brief.**
- **The recipient named in the dispatch does not resolve.** `scion message eng-manager` returns
  `agent_not_found ... (status: 404)`. The eng-manager-template agent in this project is
  `farmtable-em-task-state-model-v2`; the verdict was delivered there, and only there. Worth fixing
  in the dispatch template, because the failure mode for a less careful leg is to treat a 404 as
  "no such agent, therefore report to the coordinator" — which every r7 brief forbids.

---

## 12. ARTEFACT INDEX

| Artefact | Path |
|---|---|
| This report | `reports/test-xss-r7.md` |
| Project log | `reports/test-xss-r7-project-log.md` |
| Cell pre-registration + results, T7-01…T7-07 | `reports/_run-queue-log.md`, appended blocks |
| Verdict message as sent | `reports/_msg-em-test-r7.txt` |

**Exit state of ROOT:** `git status --porcelain` empty, `gofmt -l internal/webguard/` empty,
still detached at `e4e3d13`. Nothing pushed, no production file modified, no build token spent,
no agent contacted except the eng-manager.
