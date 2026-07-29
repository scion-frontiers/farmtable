# review-xss-r8 — CODE REVIEW of `url-scheme-validation-r8`

**COMMIT UNDER REVIEW:** `901670e3f09ad57386cafb8359017d8d61a75070`
**RANGE:** `e4e3d13..901670e` (10 commits, 7 files)
**TREE:** `/workspace/farmtable-review-r8` (mine alone; never left it)
**LEG:** `review-xss-r8`

---

# VERDICT: APPROVE WITH CONDITIONS

Under the `code-review` skill's binary vocabulary this is **REQUEST CHANGES**, because two
**Required** findings are open. I state both labels rather than picking the one that sounds
better: the EM's brief offers a three-way verdict, the skill offers a two-way one, and the
mapping is worth making explicit instead of silently choosing.

**Risk level: LOW.** The round contains **three (3) lines of executable change** [MEASURED, §I-9].
Everything else in production files is comment. The one behavioural change is a correct
tightening and I verified it against both of its callers.

### What would have changed my verdict

- **To a clean APPROVE:** removal of the two newly-added bare counts (R-1), plus a
  whole-tree build/typecheck measurement I could execute myself (R-2).
- **To REQUEST CHANGES outright:** any of these, none of which I found — a non-resolving
  citation (I checked all 17, all resolve); a quoted-source citation matching no source
  (checked all 6, all match verbatim); an undeclared census mention in a changed web file
  (checked, allowlist balances 4 = 4); a functional Go reader of `writable` (checked, all
  13 occurrences are comments); or `isCollectionWritable` having a caller that does not
  exclude FARMTABLE.
- **Axis I could not answer:** whether the tree compiles. See R-2. I hold no build token
  and did not run one. **UNMEASURED is the finding, and I am not dressing it as clean.**

---

## TREE QUALIFICATION — required by the 13:29Z constraint set, added 13:33Z

The 13:29Z coordinator relay requires that *"every figure any leg reports from a build, vet,
test or package count must name the tree it was taken in, in band, from the process that took
it,"* and that figures already held be **re-labelled, not re-run**.

**Every figure in this report was taken in `/workspace/farmtable-review-r8` at
`901670e3f09ad57386cafb8359017d8d61a75070`.** State of that tree, **[MEASURED 13:33Z]**:

```
web/dist                          ABSENT
git check-ignore -v web/dist      exit 1   (NOT ignored)
git status --porcelain            0 lines
git status --porcelain --ignored  0 lines
```

**This tree is PRISTINE** — the first of the three states the relay names. Two consequences:

1. **No figure in this report is of the class that needs re-labelling, because I ran no build,
   vet, test or package count in any tree at any point.** R-2 is the declaration of that gap.
2. **The counting sweeps are invariant across all three tree states anyway, by construction.**
   Their corpus is `git ls-files '*.go' '*.ts'` (275 files) — **tracked content only**, so an
   untracked built frontend cannot enter it. The few filesystem walks I ran were constrained to
   `--include='*.go'` or to `.github/`, and a built `web/dist` contains no `.go` files. So these
   figures would come out identical in the built main copy and on the CI runner. That was
   luck as much as design on the walks, and design on the sweeps.

### ~~`web/dist` is untracked AND unignored here~~ — **RETRACTED 13:46Z. THIS CLAIM WAS FALSE AND IT WAS MINE.**

I published: *"had anything built in this tree it would have produced several thousand
untracked, unignored, therefore stageable files — a constraint-4 bulk-staging hazard."* The EM
relayed it to every web leg as a hazard. **`architect-reviewer` falsified it and is right.**

The `check-ignore` exit 1 was correctly measured and **wrong about the state it was used to
predict.** `.gitignore:17` is `dist/` **[MEASURED — sole `dist` pattern in the file]**, and a
trailing slash matches **directories only**. `check-ignore` consults the disk, not a
hypothetical. I reproduced all three arms independently, in a throwaway repo containing **zero
farmtable content** and **zero remotes** (no carrier), to test the pattern semantics rather than
accept the conclusion:

```
.gitignore = "dist/"
ARM 1  dist ABSENT              check-ignore -v dist              -> exit 1
ARM 2  dist as a DIRECTORY      check-ignore -v dist              -> .gitignore:1:dist/  exit 0
       (what a real build makes) check-ignore -v dist/index.html  -> .gitignore:1:dist/  exit 0
                                 porcelain -uall lines w/ dist    -> 0
ARM 3  dist as a REGULAR FILE   check-ignore -v dist              -> exit 1
                                 porcelain -uall lines w/ dist    -> 1
```

**A real build creates a directory; everything under it is ignored; nothing is stageable. The
item-4 collision does not exist.** The **item-10** half stands untouched — `npm run build` is
`tsc --noEmit && vite build`, it emits, do not run it — and item 10 was always the load-bearing
reason not to build here.

**This is my error, and it is the exact error class I spent this review charging others with.**
R-1, O-4, OP-2 and the EM's "the comparison survives" are all *a correctly-measured result
attached to a population or state it was not measured over.* **This is the fifth scale and it is
mine.** I measured `exit 1` in the pristine state and extended it to predict the post-build
state.

**Worse, my own instrument discipline would have caught it in thirty seconds.** §7 requires that
before publishing a negative, I prove the instrument can say **yes** about something I planted.
`check-ignore` returning exit 1 *is* a negative result. **Had I planted a `dist/` directory in a
throwaway fixture — precisely the fixture above, which took under a minute — the instrument
would have said exit 0 and the inference would have died at birth.** I applied that rule
rigorously to five sweeps I classified as "findings" and skipped it for a corollary I tossed
into a message. **The rule does not distinguish between the two, and the one I skipped is the
one that propagated to every web leg.**

The EM's naming of the class is better than mine and I adopt it: *an instrument that is only
available in the state where its answer does not matter, and unavailable in the state where it
does.* The honest pristine-tree answer to "is `web/dist` ignored" is exit 1, and that answer is
wrong about what happens when you build.

**What survives.** The tree qualification above is unaffected — `web/dist` is genuinely absent
here and the tree is genuinely pristine. And the conclusion *"do not build in this tree"* was
correct; one of my two justifications for it was void. That is the 13:29Z warning turned on its
author: **a caution with several justifications cannot be safely amended by naming only the one
that went** — and I am fortunate the surviving justification was the load-bearing one rather
than the other way round.

## Executive Summary

This round is 476 insertions of which **3 are executable**. It is overwhelmingly a prose-
accuracy round, and judged as such it is unusually good: I independently re-ran the census
it stakes itself on and got its exact arithmetic, and every citation claim I could falsify
held. The one behavioural change (`isCollectionWritable` requiring `Platform.GITHUB`) is
correct, is a strict tightening, and matches the invariant `getCapabilities` enforces.

The finding that matters is that **the round net-added two instances of exactly the defect
it exists to remove.**

---

## Critical

**None.** I looked specifically for a reachable behaviour change on an untrusted-input path
(role brief axis 4). `convert.go` and `export_import.go` have **0 non-comment added lines**
[MEASURED, §I-9], so neither changes behaviour on any path, reachable or not.

---

## Required

### R-1 — The round net-added two bare counts, into the blocks that prohibit bare counts

**Severity: Required. [MEASURED]**

The round's own stated rule, written three times in these files, is that a cardinal number
in front of a population is a claim with nothing guarding it. `convert.go`
`collectionToProto` carries it as *"WHY THERE IS NO NUMBER IN THE PARAGRAPH ABOVE, AND
PLEASE DO NOT ADD ONE"*. Item 3 (`253ab14`) removed *"the two producers"* on that basis,
and item 4 (`3961f30`) removed *"TWO LIMITS"* on that basis.

The same round then added the bare count **"nine"** twice.

Population of the token `nine`, before and after, same corpus [MEASURED, §I-10]:

| file | before (`e4e3d13`) | after (`901670e`) |
|---|---|---|
| `internal/server/convert.go` | 2 | 2 |
| `internal/server/export_import.go` | 1 | **2** |
| `web/src/capabilities.ts` | 0 | **1** |
| **total** | **3** | **5** |

The two new ones are in the added blocks:

- `export_import.go`, `ImportCollection`, the "WHAT THE PAIR PROTECTS" paragraph:
  *"the nine GitHub write operations it gates"*.
- `capabilities.ts`, `getCapabilities`, the "READ THIS BEFORE TREATING THE LABEL" paragraph:
  *"the nine write operations this function gates"*.

**The count is TRUE today.** `GITHUB_CAPABILITIES` has exactly 9 `true` and 6 `false`
[MEASURED, §I-8]. That is the point: it is true, unguarded, and now load-bearing in five
places across three files in two languages. Flipping one flag in `GITHUB_CAPABILITIES` —
the single most likely future edit to that object — silently falsifies all five, and no test
goes red. This is the identical failure mode the round spent items 3 and 4 correcting.

**Suggested fix.** Apply the round's own remedy, the one item 3 already demonstrated: state
the set by identifier, not by cardinality. Replace *"the nine GitHub write operations"* with
*"the write operations enabled in `GITHUB_CAPABILITIES`"*. That is guarded — the identifier
resolves or it does not — and it costs nothing in meaning. The two pre-existing `convert.go`
occurrences are outside this diff and I am **not** asking for them here.

---

### R-2 — No build, vet, typecheck or suite was executed by this leg. Declared, not cleared.

**Severity: Required (verification gap, not a defect). [UNCHECKED]**

I hold no build token and did not run `go build`, `go vet`, `go test`, `gofmt`, `tsc`, or
`npm test` in any tree. I did not request one, because for a diff measured at 3 executable
lines the token is better spent on the whole-tree build the EM says has not happened.

What this means for the claims in the commit messages, which I record as **claims I did not
reproduce**, not as results:

- `af9ea8c` / `4026dca` claim `go test ./internal/webguard/ -run '^Test' -count=1` GREEN 4/4.
  **UNCHECKED by me.** If true, the new test compiled and passed.
- `1cba5b5` claims `npx tsc --noEmit` green with `--listFiles` proof and a planted-error RED
  arm. **UNCHECKED by me.**
- Multiple commits claim `gofmt` clean. **UNCHECKED by me.** I treated `gofmt` as
  token-adjacent and did not run it.

What I *can* say statically about compilability of the new test, and it is not a substitute
for a compile [DERIVED, §I-11]: `TestWebCensusAnchoringIsTopLevelOnly` uses `t.TempDir`,
`os.MkdirAll`, `os.WriteFile`, `filepath.Join`, `filepath.FromSlash`, `filepath.Dir`,
`filepath.ToSlash`. The file's import block already contains `fmt`, `os`, `path/filepath`,
`sort`, `strings`, `testing`. No import is added and none is orphaned. It calls
`censusRemoteDataMentions(t, root)`, whose signature is
`func(t *testing.T, root string) ([]mention, map[string]bool)` [MEASURED, §I-3], and binds
both results. It reads `m.file`, a real field of `mention`. There is no duplicate symbol.

**Condition:** a whole-tree `make test` (or `go build ./... && go vet ./... && npm run
typecheck`) must be measured by someone holding the token before this merges. Given 3 lines
of executable change I expect it to pass; expectation is not measurement.

---

## Nit / Optional

### O-1 — `getCapabilities` is now ~69 lines of comment in front of 8 lines of code, and much of it is review-process history

**Severity: Consider (structural). [MEASURED, §I-9]**

Added lines in production files, comment vs executable:

| file | added | comment | code |
|---|---|---|---|
| `internal/server/convert.go` | 58 | 58 | **0** |
| `internal/server/export_import.go` | 41 | 41 | **0** |
| `web/src/capabilities.ts` | 49 | 49 | **0** |
| `web/src/components/ft-app.ts` | 26 | 23 | **3** |
| `internal/webguard/doc.go` | 33 | 33 | **0** |
| **total** | **207** | **204** | **3** |

I am not objecting to long comments on subtle security reasoning — that reasoning is
genuinely subtle and I verified it is correct. I am objecting to a specific subset: prose
whose subject is *the review process* rather than *the code*. Examples, cited by content:

- `capabilities.ts` `getCapabilities`: *"This sentence used to say 'the two producers' ...
  That was wrong twice over"*, and *"that adjective is load-bearing and an earlier draft
  omitted it"*.
- `convert.go` `collectionToProto`: *"A neighbouring comment once generalised this to..."*.
- `remotedata_consumers_test.go` allowlist reason: *"This is the SECOND time in r8 that
  annotating this guard's subject tripped this guard"*.
- `doc.go`: *"THIS BLOCK DELIBERATELY CARRIES NO COUNT, AND IT USED TO."*

This is drafting history. It has three costs: it is untested by construction (the round's
own axis-2 premise), it will read as noise to anyone who did not live through r7, and **this
same round created `.design/project-log/2026-07-29-dev-xss-r8-fix.md`, which is the correct
home for it** — so it is duplicated, and the two copies can now diverge.

**Suggested move.** Keep in code the statements that are invariants a future editor must not
break (the conjunction, the ordering constraint, the browser-only caveat, the "do not add a
count" rule). Move the drafting narrative to the project log that already exists. This
deletes concepts from the reader's path rather than relocating them.

### O-2 — The F1 allowlist reason was not updated for F1

**Severity: Consider. [MEASURED, §I-5]**

`remotedata_consumers_test.go`, the `declaredConsumer` for `src/components/ft-app.ts` /
`const rd = coll.remoteData;`, reads: *"The second write-authorization gate. Both of its
callers return early on FARMTABLE before reaching it."*

That sentence is **still true** — I verified both callers [MEASURED, §I-4] — so this is not
a false comment. But it is the pre-F1 mental model, and it is the exact model F1 was written
to correct: it presents FARMTABLE exclusion as the callers' responsibility, with no mention
that `isCollectionWritable` now enforces `Platform.GITHUB` itself. A reader who trusts this
reason learns the thing F1 fixed.

**Suggested fix.** Append one clause: *"and since r8 the method itself returns false for any
platform other than GITHUB."*

### O-3 — A counterfactual stated in the present indicative, in a round about false comments

**Severity: Nit. [MEASURED, §I-7]**

`TestWebCensusAnchoringIsTopLevelOnly`, on the `nested` fixture slice:

> *"Every one of these is compiled by web/tsconfig.json (\"include\": [\"src\"]) in the real
> tree and therefore ships. These are the three directories that actually hid planted
> consumers while the guard was green."*

All three directories are **ABSENT** from the real tree [MEASURED, §I-7]:

```
ABSENT: web/src/build
ABSENT: web/src/util/dist
ABSENT: web/src/components/coverage
```

The tsconfig rule itself is real (`"include": ["src"]` confirmed), so the intended meaning —
*if* such a directory existed under `src/`, it would ship — is correct, and the second
sentence is accurate about past plants. Only the present-tense "is compiled ... in the real
tree and therefore ships" overstates. Recommend "would be compiled ... and would therefore
ship".

### O-4 — The project log's "fifteen" is right for the wrong population

**Severity: Nit. [MEASURED, §I-6]**

`.design/project-log/2026-07-29-dev-xss-r8-fix.md`: *"Fifteen line-number citations remain in
`convert.go` and neighbours; all fifteen resolve today."*

Measured across the round's files:

| file | residual `file:NNN` citations |
|---|---|
| `internal/server/convert.go` | **15** |
| `internal/server/export_import.go` | 0 |
| `internal/webguard/doc.go` | 1 |
| `internal/webguard/remotedata_consumers_test.go` | 1 |
| `web/src/capabilities.ts` | 0 |
| `web/src/components/ft-app.ts` | 0 |
| **total** | **17** |

**15 is `convert.go` alone. `convert.go` *and neighbours* is 17.** Commit `4026dca`'s
"SEVENTEEN SUCH CITATIONS REMAIN IN THE ROUND'S FILES" is the correct figure for the wider
population; the log restates it against a wider label with the narrower number. The two
figures are reconcilable and neither is a fabrication — this is a scope-label error, not a
count error. Worth noting only because `901670e` is titled *"correct two stale facts in the
r8 log"* and this one survived that pass.

The substantive half of the claim holds: **all 17 resolve** [MEASURED, §I-6].

---

## FYI

### F-1 — `AS-OF-THIS-COMMIT` sits next to a SHA that is not this commit

The `convert.go` census header reads *"ENUMERATED AT af9ea8c. AS-OF-THIS-COMMIT, NOT AN
INVARIANT."* The block was added by `5e8b826`; `af9ea8c` is its parent [MEASURED, §I-1]. No
factual harm — `5e8b826` is comment-only, so the census is equally valid at both — and this
is the same un-closable fixpoint the log names for itself. Recording it because the two
phrases are literally inconsistent and a later reader may waste time on it. "ENUMERATED AT
`af9ea8c`, the parent of the commit carrying this block" would close it.

### F-2 — A line-number citation exists in a `.test.ts` outside the diff

`web/src/util/url-binding-scan.test.ts` contains `ft-app.ts:766` [MEASURED, §I-12]. Outside
this diff and outside item 1's population. Not a finding against this round; flagged only
because `6a0b8bd` concluded that excluding test files from the citation sweep "was the wrong
boundary", and this is one the corrected boundary would catch. No action requested.

---

## Positive Feedback

Specific, and none of it manufactured — each item below is something I actively tried to
falsify and could not.

1. **The census re-measures exactly.** `convert.go`'s `ENUMERATED 8 = FLAGGED 1 + EXCLUDED 7`
   reproduced on the nose, including the part grep cannot do. I resolved all 8 receivers to
   their enclosing functions independently [MEASURED, §I-2]: `taskToProto` ×3,
   `GitHubAdapter.buildRemoteIDIndex`, `BeadsAdapter.buildRemoteIDIndex`,
   `FarmTableService.UpdateTask` ×2, and `collectionSupportsGraph` as the single flagged
   collection-scope reader. The arithmetic balances and the classification is right.

2. **The "third farmtable early return" is real.** `resolveGraphRoute` does return on
   `coll.Platform == collection.PlatformFarmtable` before reaching `collectionSupportsGraph`,
   and `graph_routing.go:42` is its only non-test caller [MEASURED, §I-2]. The round could
   have quietly asserted this; it is checkable and it checks out.

3. **`export_import.go`'s self-referential claim is true.** The block asserts *"EVERY CITATION
   IN THIS BLOCK IS BY IDENTIFIER OR BY QUOTED SOURCE TEXT, NEVER BY LINE NUMBER."* Measured
   over the **whole file**, not just the block: **0** line-number citations [MEASURED, §I-6].
   Given this branch's history of shipping false self-descriptions, a self-description that
   survives measurement is worth naming.

4. **All 6 new quoted-source citations exist verbatim** [MEASURED, §I-6], including the
   cross-file one into `entstore.go`. The new citation style is not decorative.

5. **F1 is correct and is genuinely a tightening.** Both callers (`isReadOnly`,
   `isExternalWritable`) do exclude FARMTABLE first [MEASURED, §I-4]; the enum has exactly 6
   non-FARMTABLE values [MEASURED, §I-4]; and the new predicate now matches `getCapabilities`
   exactly (`GITHUB` ∧ `writable === true`). GITHUB behaviour is unchanged.

6. **The new regression test is a real guard, not a receipt.** I hand-traced the mutation
   `skipDirs[rel]` → `skipDirs[d.Name()]`: all three nested fixture dirs prune, producing 3
   "did NOT find" + 3 "did NOT descend" = **6 errors**, matching `6a0b8bd`'s pre-registered
   prediction exactly [DERIVED, §I-11]. The liveness `t.Fatalf` on `src/app.ts` correctly
   prevents the negative arms passing vacuously, and `src` is not in `skipDirs` so the
   liveness check survives the mutation and does not mask the regression arm. The prune arm
   genuinely blocks buying reach by emptying `skipDirs`. The fixture is not driven off
   `skipDirs`, as the comment claims. **This is the rare case of a guard whose red condition
   I could verify without running it.**

7. **"Nothing in Go enforces `writable`" is true.** All 13 occurrences of `writable` in
   production Go are inside comments; there is no functional reader [MEASURED, §I-1]. This is
   the load-bearing security claim of the whole two-conjunct model and it survives.

---

## Test Coverage

- **New test:** `TestWebCensusAnchoringIsTopLevelOnly`. Well-constructed — see Positive #6.
  It closes the exact blindness the r7 guard had.
- **The one behavioural change has no test, and the gap is real.** `getCapabilities` and
  `isCollectionWritable` have **zero** references from any `*.test.ts` [MEASURED, §I-12, with
  a positive control confirming `.test.ts` files exist and the grep matches them]. F1 landed
  in an untested function. The commit `af9ea8c` states this itself and declines to fix it
  under the round's five-item bound.
  **I agree with the disclosure and disagree with the disposition being left implicit:** a
  three-line security-relevant predicate change with zero coverage should carry a filed,
  assigned follow-up, not a paragraph in a commit message. Recommend one test per conjunct
  as the immediate next round.
- **Conjunct A is pinned, weakly.** `TestRPC_ImportExportCollection_Errors` exists and does
  drive a non-farmtable document to `codes.FailedPrecondition` [MEASURED, §I-12]. It asserts
  gRPC codes and never names the security property, which matches the log's own
  characterisation.

## Backward Compatibility

No wire-format change. No proto change. No field removed, added, or made required. The only
behavioural delta is client-side and is a **narrowing**: collections with platform
UNSPECIFIED / LINEAR / JIRA / ASANA / BEADS carrying `remote_data.writable = true` move from
writable to read-only in the dashboard. GITHUB and FARMTABLE are unaffected. Read-only is the
documented default for external collections, and `getCapabilities` already treated those
platforms as `ALL_DISABLED`, so this **removes** a divergence between the two readers rather
than creating one. No migration needed.

---

# INSTRUMENT SECTION

Every sweep, its exact command, and its controls. Shell is zsh 5.9; `$options[multios]`
returned **`on`**, confirmed before any pipeline [MEASURED]. I used no `(N)` glob qualifier,
no unquoted glob, and no `2>/dev/null | wc -l` idiom. `$pipestatus` used where a pipeline's
producer status mattered. **I ran no build, test, vet, gofmt, tsc or npm command.**

**Self-matching control:** every sweep below targets files in the repository tree only. No
sweep read my own transcript, my report, or the brief files, so the
instrument-matching-itself class is structurally excluded rather than filtered. My report is
written to `/scion-volumes/...`, outside every corpus I searched.

### §I-1 — Tree identity, shell, `writable` readers
```
git rev-parse HEAD                    -> 901670e3f09ad57386cafb8359017d8d61a75070
git rev-parse --abbrev-ref HEAD       -> url-scheme-validation-r8
git status --porcelain                -> (empty; clean)
echo "multios=$options[multios]"      -> multios=on
git rev-list --count e4e3d13..901670e -> 10
grep -rn 'writable' --include='*.go' . | grep -v '_test.go'   -> 13 hits, ALL in comments
```
*Control (paired):* POSITIVE — `grep -rln 'writable' --include='*.go' .` returned 4 files,
proving the pattern and the `--include` filter both match. NEAR-MISS — the discrimination is
not absence-of-match but *classification*: every one of the 13 hits was inspected and each
begins with `//`. The pass condition is a discrimination, not an empty result.

### §I-2 — The `convert.go` census, re-run and receiver-resolved
```
grep -rn 'RemoteData\[' --include='*.go' internal/ | grep -v '_test.go'   -> 8 lines
  (pipestatus 0,0 — producer verified, not inferred from the count)
```
Receiver resolution, which the comment correctly says grep cannot do:
```
awk -v N=<line> 'NR<=N && /^func /{last=$0} END{print last}' <file>
```
*Note on that awk:* mawk. No interval expression `{n,}` used anywhere — the brief warns these
silently never match. Result: `taskToProto` ×3 (471, 530, 533), `GitHubAdapter.buildRemoteIDIndex`
(github.go:360), `BeadsAdapter.buildRemoteIDIndex` (beads.go:499),
`FarmTableService.UpdateTask` ×2 (server.go:663, 669), `collectionSupportsGraph`
(graph_support.go:27). **ENUMERATED 8 = FLAGGED 1 + EXCLUDED 7. Balances.**
```
grep -rn 'collectionSupportsGraph' --include='*.go' .   -> single non-test caller: graph_routing.go:42
sed -n '25,50p' internal/server/graph_routing.go        -> farmtable early return confirmed above the call
```
*Control:* the awk resolver was validated against a known case (`convert.go:471` →
`taskToProto`) before being trusted on the rest. Absent control: I did not verify the awk
resolver against a method with a non-column-0 `func`, so a receiver declared inside a block
would be missed — none of the 8 are.

### §I-3 — Census implementation and skipDirs semantics
```
grep -n 'func censusRemoteDataMentions' -A 60 internal/webguard/remotedata_consumers_test.go
grep -n 'skipDirs' -A 12 internal/webguard/remotedata_consumers_test.go
sed -n '1,40p' internal/webguard/remotedata_consumers_test.go     (import block)
```
Confirmed `descended` is keyed on slash-normalised path-relative-to-root and is populated
*after* the `SkipDir` return, so a pruned dir is correctly absent from it.

### §I-4 — F1 and its callers
```
grep -n 'isCollectionWritable\|isReadOnly\|isExternalWritable' web/src/components/ft-app.ts
Read ft-app.ts offset 220 limit 70
grep -rn 'enum Platform' -A 20 web/src/gen/types.ts   -> 7 values, 6 non-FARMTABLE
sed -n '85,175p' web/src/capabilities.ts              -> getCapabilities body
```
*Control:* the caller sweep is by identifier across the whole file, so a third caller would
have appeared. Two found (lines 230, 240); both return early on FARMTABLE.
**UNITS NOTE:** both predicates compared in the same form —
`getCapabilities`: `platform === Platform.GITHUB` ∧ `rd.writable === true`;
`isCollectionWritable`: `platform !== Platform.GITHUB → false`, then `rd.writable === true`.
Same enum, same key, same strict equality.

### §I-5 — Guard simulation (the allowlist must cover every matching line)
```
grep -n 'remoteData\|remote_data' web/src/capabilities.ts               -> 4 lines
grep -c 'remoteData\|remote_data' web/src/capabilities.ts               -> 4
grep -n 'remoteData\|remote_data' web/src/components/ft-app.ts          -> 2 lines
grep -n 'ft-app.ts' internal/webguard/remotedata_consumers_test.go
Read remotedata_consumers_test.go offset 155 limit 75                   (declared entries)
```
**CHECKED 4 = MATCHED 4 + MISMATCHED 0 + UNCHECKABLE 0** for `capabilities.ts`;
**CHECKED 2 = MATCHED 2 + MISMATCHED 0 + UNCHECKABLE 0** for `ft-app.ts`. Every declared
`text` compared byte-for-byte against the trimmed source line. Both files are the only web
files in the diff, so the guard's changed surface is fully covered.
*Control:* the census trims lines before comparison; I compared against trimmed source to
stay in the same units. *Absent control:* I did not simulate the census over the entire
`web/` tree, only the two changed files — an undeclared mention introduced elsewhere at
`e4e3d13` would not be caught by me. Scoped zero, stated with its scope.

### §I-6 — Citations: residual line numbers, resolution, and quoted-source
```
# old predicate (hyphen excluded — DEFECTIVE, published anyway per the both-rows rule)
grep -oE '[A-Za-z_/]+\.(go|ts):[0-9]+' <file> | wc -l
# corrected predicate (hyphen and digits allowed)
grep -oE '[A-Za-z0-9_/.-]+\.(go|ts):[0-9]+' <file> | wc -l
```
**Both rows, same corpus, the variable that moved is the character class:**

| file | old | new |
|---|---|---|
| convert.go | 15 | 15 |
| export_import.go | 0 | 0 |
| doc.go | 1 | 1 |
| remotedata_consumers_test.go | 1 | 1 |
| capabilities.ts | 0 | 0 |
| ft-app.ts | 0 | 0 |

Counts unchanged; only the *extracted names* were truncated. **I caught this because
`meta.ts:628` did not resolve — the real target is `ft-inspector-meta.ts`, and my character
class had eaten the hyphens.** Had I stopped at the first predicate I would have filed a
false "non-resolving citation" finding. Recording the near-miss because the brief asks for
the numbers that damage me to be checked as hard as the ones that acquit me.

Resolution of all 17, via `sed -n '<N>p' <file>`: `graphql_queries.go:480`,
`ft-inspector-meta.ts:628` (real path `web/src/components/inspector/`), `entstore.go:408`,
`:1359`, `:1366`, `server.go:1035`, `:1057`, `:1085`, `graph_routing.go:83`,
`passthrough.go:645` ×2, `entstore.go:2112` ×2, `urlvalidate.go:250`, `assets.go:5` ×2.
**CHECKED 17 = RESOLVED 17 + FAILED 0 + UNCHECKABLE 0.**

Quoted-source citations, verified with `grep -qF` (fixed-string, so regex metacharacters in
the quoted code cannot silently alter the pattern):
all 6 FOUND — `RemoteData: sanitizeRemoteData(doc.Collection.RemoteData)`,
`doc.Collection.Platform != string(collection.PlatformFarmtable)`,
`Platform: collection.PlatformFarmtable`, `s.store.ImportCollection(ctx, importParams)`,
`collCreate.SetRemoteData(p.Collection.RemoteData)` (in `entstore.go`),
`collection.platform === Platform.FARMTABLE`.
*Control:* `grep -qF` returns a discrimination (found/not-found) per string, not an aggregate
zero, so a dead instrument would show as all-not-found rather than as a clean pass.

### §I-7 — Real-tree shape claims behind the new test
```
find web -mindepth 2 -type d \( -name node_modules -o -name dist -o -name build \
  -o -name .vite -o -name coverage -o -name .tmp-test \) -print   -> empty, rc=0
```
*Control (paired, and this one matters):* POSITIVE — `find web -mindepth 2 -type d -name gen
-print` returned `web/src/gen`, proving the `find` form, the `-mindepth`, and the `-type d`
all work and that the empty result is a real absence, **not a silent zero**. `find ... -print`
used throughout; no `(N)` qualifier anywhere.
```
[ -d web/src/build ] etc.        -> all three ABSENT
grep -n 'include' -A 3 web/tsconfig.json  -> "include": ["src"]
```

### §I-8 — The `nine` population
```
awk '/^export const GITHUB_CAPABILITIES/,/^\}\);/' web/src/capabilities.ts | grep -c ': true,'   -> 9
awk '/^export const GITHUB_CAPABILITIES/,/^\}\);/' web/src/capabilities.ts | grep -c ': false,'  -> 6
```
*Control:* true + false = 15 = the field count of `CollectionCapabilities` (read directly),
so the awk range captured the whole literal and did not truncate. Range expression, not an
interval expression — mawk-safe.

### §I-9 — Comment vs code composition of the diff
```
git diff e4e3d13..901670e -- <file> | grep -cE '^\+[^+]'                      (added lines)
git diff e4e3d13..901670e -- <file> | grep -cE '^\+[[:space:]]*(//|\*|/\*)'   (added comments)
git diff e4e3d13..901670e -- web/src/components/ft-app.ts | grep -E '^\+[^+]' | grep -vE '^\+[[:space:]]*//'
```
The last command prints the executable delta in full — 3 lines — rather than asserting a
count. `^\+[^+]` excludes the `+++` file header. *Limitation, stated:* this classifier keys
on line-leading comment markers, so a continuation line inside a `/* */` block that does not
begin with `*` would be miscounted as code. It would inflate the *code* column; the code
column is 0 for four of five files and exactly the 3 printed lines for the fifth, so the
error direction is closed by the enumeration.

### §I-10 — `nine`, before vs after, same corpus
```
git show e4e3d13:<file> | grep -c 'nine'
git show 901670e:<file> | grep -c 'nine'
git diff e4e3d13..901670e -- <file> | grep -nE '^[+-].*nine'
```
Both endpoints measured at the same time, from git objects rather than the worktree, so the
comparison is in identical units. The `git diff` arm independently confirms *which*
occurrences are new (2 additions, 0 deletions), so the before/after delta is corroborated by
two instruments that fail differently.

### §I-11 — Static analysis of the new test (no execution)
By reading only. Mutation trace `skipDirs[rel]` → `skipDirs[d.Name()]` performed by hand
against the census source in §I-3. **[DERIVED, not MEASURED — I did not run it.]** Predicted
6 errors, matching `6a0b8bd`'s pre-registered figure; agreement with a prior claim is *not*
independent confirmation and I flag it as convergence, per the brief's third failure
direction.

### §I-12 — Coverage claims
```
grep -rn 'getCapabilities\|isCollectionWritable' --include='*.test.ts' web/src/   -> rc=1, no matches
find web/src -name '*.test.ts' -print                                            -> 4 files
grep -rn 'ft-app' --include='*.test.ts' web/src/                                 -> 1 hit, a comment
grep -rn 'func TestRPC_ImportExportCollection_Errors' --include='*_test.go' .
grep -c 'Collection\|writable' internal/platform/github/remotedata_representability_test.go -> 0 (rc=1)
grep -c 'RemoteData' internal/platform/github/remotedata_representability_test.go           -> 18
ls -l internal/platform/github/remotedata_representability_test.go
```
*Control (paired) on the two zeros — the brief is explicit that `grep -c` prints `0` and exits
1 on no match, which is indistinguishable from a broken command:*
- For the coverage zero: POSITIVE arm `find` proved 4 `.test.ts` files exist and are reachable
  by the same path expression. The zero is a real absence.
- For the `Collection|writable` zero: POSITIVE arm `grep -c 'RemoteData'` on **the same file**
  returned 18, and `ls -l` proved the file exists and is non-empty (10927 bytes). The zero is
  a real absence, not a missing file and not a dead pattern.
I did not write `|| true` or `|| echo 0` anywhere.

### §I-13 — PLANTED-POSITIVE RE-ARMING, after the 10:35Z §7 correction

The corrected §7 makes binding a rule none of my original controls satisfied:

> *A NEGATIVE CONTROL CANNOT DISTINGUISH "CORRECTLY ABSENT" FROM "INCAPABLE OF FINDING
> ANYTHING". IT IS PASSED MOST EASILY BY A DEAD INSTRUMENT. Before you publish any zero,
> prove your instrument can say YES about something you actually planted.*

My original positive arms were **in-tree** positives (`web/src/gen` exists; `RemoteData`
appears 18×). Those prove the predicate is not dead, but they are found objects, not planted
ones. I re-armed every zero I publish with a **planted** positive and a **near-miss**.

**Corpus and contamination.** All plants are in `/tmp/r8-ctl-a1`, which is per-container and
**outside the repository tree**. Nothing was planted in `/workspace/farmtable-review-r8`, so
no finding above can be an artefact of my own fixture — the failure mode the brief says three
legs already hit. No production file was created, modified or deleted anywhere.

**On the marker-assembly failure mode, and why it does not apply here.** The withdrawn rule's
defect was that *the corpus stores what was typed, not what ran*, so a runtime-assembled
marker never lands. **My corpus is a filesystem, not a transcript.** A literal written by
`printf` genuinely lands in the file, and I verified landing explicitly (the "PLANTS LANDED"
step: `grep -l` returned each planted file by name before any measurement ran). That is the
three-state table's *marker PRESENT* arm, adapted to a filesystem corpus. All plants are
hand-typed literals; none uses `$RANDOM` or command substitution. Fixture id `r8-ctl-a1` is a
typed literal, unique to this attempt, and I did not retry any arm.

| # | instrument | planted positive → must say YES | near-miss → must say NO | state |
|---|---|---|---|---|
| A | `grep -rn 'writable' --include='*.go' \| grep -v '_test.go'` | `planted_reader.go` containing a **functional** read `c.RemoteData["writable"].(bool)` — **FOUND** | same token inside `planted_thing_test.go` — **REJECTED (0)** | **PUBLISHABLE** |
| B | `grep -oE '[A-Za-z0-9_/.-]+\.(go\|ts):[0-9]+'` | `export_import.go:306` **and** `ft-inspector-meta.ts:628` — **BOTH FOUND** | identifier with no `:NNN` — **REJECTED (0)** | **PUBLISHABLE** |
| C | `find -mindepth 2 -type d \( -name dist … \)` | planted `src/util/dist` — **FOUND** | top-level `dist/` at depth 1 — **REJECTED (0)** | **PUBLISHABLE** |
| D | `grep -rn 'getCapabilities\|isCollectionWritable' --include='*.test.ts'` | `tests/planted.test.ts` — **FOUND** | same token in a non-`.test.ts` — **REJECTED (0)** | **PUBLISHABLE** |
| E | `grep -n 'remoteData\|remote_data'` | planted `const rd = coll.remoteData;` — **FOUND** | *(not armed — see below)* | positive only |

**What each re-arming changes about a figure above:**

- **C is the one that mattered most.** My §I-7 zero — no directory at depth ≥ 1 in `web/`
  carrying a `skipDirs` basename — is the premise the entire new regression test rests on. The
  planted positive was `src/util/dist`, **the exact shape the real tree lacks**, and the
  instrument found it. The real-tree empty result is therefore a measured absence, not a dead
  `find`. This independently corroborates commit `6a0b8bd`'s claim by a different route than
  the commit used.
- **A** upgrades "no functional Go reader of `writable`" from *no non-comment hits* to *the
  predicate demonstrably admits a functional reader when one exists*. The plant was written as
  real reader syntax precisely so a comment-only filter could not pass it.
- **B** upgrades the `export_import.go` **0** — the file's own self-assertion. The plant also
  recovered the full hyphenated `ft-inspector-meta.ts:628`, re-confirming the corrected
  character class from §I-6 on an object where I control the answer.
- **D** upgrades the zero-test-coverage claim behind the Test Coverage section.
- **E is positive-only and I am not dressing it otherwise.** I did not arm a near-miss for the
  census-mention predicate, so I have shown it can say YES but not that it does not
  over-match. Per §7, *a control proves the branch it traverses and nothing else*. This is the
  one instrument in my set whose over-matching behaviour is **UNCHECKED**. It affects only
  §I-5, where over-matching would produce *extra* undeclared mentions and so fails toward
  alarm, not toward clean — but that is an argument, not a control, and I record it as the
  gap it is.

**Honest limitation on all five.** These arms prove each predicate discriminates correctly on
a fixture I built. They do not prove the fixture is representative of the real tree. That
residual is not closable by more controls of this kind.

---

## Ledger — errors in the EM's brief, itemised

Requested every round, and the EM notes the count has never come back zero. Mine, measured
against my own transcript:

1. **The two rules withdrawn at 10:35Z cost this leg zero time. [MEASURED]** I planted no
   markers before the correction, and I never audited my own transcript as a corpus — every
   sweep I ran targets the repository tree only. So neither the fatal marker-assembly clause
   nor the over-matching "exclude your own reporting commands" parenthetical was ever on my
   path. **I am reporting a genuine zero and declining to manufacture a cost to match the
   expected pattern.** Section 7's own warning about failing toward the last thing authority
   broadcast cuts in this direction too: an itemised cost I did not incur would be exactly
   that failure.
2. **The `_r8-COMMON.md` §1 stat block is accurate. [MEASURED]** `git diff --stat
   e4e3d13..HEAD` reproduced 7 files / 476 insertions / 40 deletions, and `git rev-list
   --count` reproduced 10 commits. No error found in the premise I was given.
3. **The one instrument defect this round was mine, not the brief's. [MEASURED]** My first
   citation regex excluded hyphens and truncated `ft-inspector-meta.ts` to `meta.ts`, which
   briefly presented as a non-resolving citation — i.e. as a **finding against the branch**.
   I caught it by resolving the target rather than trusting the count, published both
   predicate rows over the same corpus (§I-6), and the counts were unchanged. Recorded here
   because it is precisely the "instrument answered a narrower question" shape the brief
   warns about, and because it would have damaged the fix leg rather than me.

4. **OP-2's population label is wrong, and it is the EM's relay that is wrong, not the leg's
   commit. [MEASURED — added after reconciliation]** *"17 line-number citations remain in the
   tree"* is the round's-six-files figure. Tree-wide is **39 occurrences / 34 lines** across
   275 tracked `.go`/`.ts` files. Full working in the Reconciliation section. This one **did**
   cost time — it is the single largest measurement in this report by corpus size — and the
   EM asked to be held to the same standard, so it is itemised here rather than only in the
   reconciliation.

5. **APPARATUS, NOT IN §5, AND IT WILL BITE ANOTHER LEG TONIGHT. [MEASURED]** `grep` is ugrep
   7.5.0, and **ugrep's `-c` changes meaning when combined with `-o`**:

   ```
   grep -cE  '<pat>' internal/server/convert.go   -> 14   (matching LINES)
   grep -coE '<pat>' internal/server/convert.go   -> 15   (matching OCCURRENCES)
   grep -oE  '<pat>' internal/server/convert.go | wc -l -> 15
   ```

   **GNU grep ignores `-o` when `-c` is given and always reports lines.** So a habit carried
   over from GNU grep silently switches units here, and it does so in the direction that
   *inflates*. I hit this mid-reconciliation: one pass reported 17 for a population that is 16
   by lines, and the two figures disagreed for no visible reason. §5 already warns that
   `grep -c` prints 0 and exits 1 on no match; it does not warn about this. Recommend adding
   it. **Any leg that has published a `grep -c` figure with `-o` in the same flag cluster has
   published occurrences while very likely believing it published lines.**

**Count against the brief this round: 1** (item 4). **Apparatus gaps found: 1** (item 5).
Count against my own instruments: 1, self-caught (item 3).

---

## Note on the 10:41Z build clones

The EM announced `/workspace/farmtable-build-r8` and `/workspace/farmtable-build-base` at
10:41Z, after my cold pass was on disk. **I did not read, enter, or measure either tree**, and
I ran no host-wide git-object sweep at any point, so the 115→117 classification the bulletin
offers does not apply to any figure in this report.

Two consequences for **R-2**, and they point in opposite directions, so I state both:

- The bulletin **corroborates R-2 independently**: *"NOBODY HAS RUN `go build ./...`, `go vet
  ./...` or `go test ./...` against this branch tonight."* My declared gap was real and is now
  being actioned.
- It also **raises the bar on how R-2 can be closed**. Per the bulletin, a single run against
  `901670e` is *guaranteed* RED for a pre-existing reason (untracked `web/dist`, embedded),
  and that red would be filed against this branch. **R-2 is therefore not dischargeable by
  one green build.** It requires the differential against `e4e3d13`. I have not seen the
  result and my verdict does not assume one; if the differential comes back clean, R-2
  discharges and my verdict moves on that condition alone.

### ADDENDUM 12:33Z — the rationing lift introduces a commensurability risk to that differential

Build/test rationing was lifted at 12:33Z, with the measured caveat that *"this project has
MEASURED that its worst flake is load-sensitive, so an unexpected RED under concurrency may
not be yours."* Two consequences for R-2, and the second is a live risk to a measurement that
has not been taken yet:

1. **I am still not building in this tree, and the lift does not change that.** The 10:41Z
   reasoning for keeping builds out of the three live review trees was *contamination*, not
   *contention* — `make test` may materialise `web/dist` inside a tree a leg is reading, which
   silently flips the documented `check-ignore` polarity trap under an active leg. The lift
   removes the contention constraint only. **Two reasons supported one rule; one was
   withdrawn and the rule still stands on the other.**

2. **The differential's two arms must be run under commensurable load, or it cannot answer the
   question it was designed for. [UNCHECKED — flagged before the fact, not after]** The whole
   value of the `901670e` vs `e4e3d13` design is that the *only* variable between the arms is
   the diff under test — the EM's own announcement says the clones were created by an
   identical command "differing only in the ref, so the only variable between them is the diff
   under test." Concurrency reintroduces a second variable. If the `901670e` arm happens to
   run alongside other legs' builds and the `e4e3d13` arm does not, a load-sensitive flake in
   the r8 arm presents as **"the diff broke the build"** — a red filed against this branch for
   a reason that is not this branch, which is the exact failure the differential exists to
   prevent. This is `_r8-COMMON.md` §6's *"BEFORE COMPARING TWO SETS: assert they are in the
   SAME UNITS"* applied to run conditions rather than to string forms.

   The asymmetry in the bulletin — *"Re-run before you believe a red. A GREEN gets no such
   allowance"* — is correct per-arm but **does not compose across a differential**. Re-running
   only the arm that went red, until it agrees with the other, is a retry that converges on a
   pass: the stopping rule is "until the arms match", so the procedure cannot report a real
   regression distinguishable from a flake. **Recommend: run both arms under the same
   concurrency conditions, and if either is re-run, re-run both.**

   *Accepted by the EM 12:42Z and amended project-wide (fixed-N per arm, interleaved, re-run
   both or neither, report every run, a split is the result). Credited to this leg.*

### ADDENDUM 12:47Z — R-2 CANNOT BE DISCHARGED BY THE GO DIFFERENTIAL. IT IS BLIND TO THE ONLY EXECUTABLE PRODUCTION CHANGE IN THE ROUND.

Bulletin 19.1 §4 states: *"Arm-to-arm comparison SURVIVES: identical stub on both arms,
common-mode contamination."* **The common-mode argument is sound, and the conclusion is still
too broad.** Common-mode cancellation makes a differential valid for changes the instrument
can *see*. It says nothing about changes the instrument cannot see at all.

**[MEASURED]** `git diff --numstat e4e3d13..901670e`, with added lines classified as executable
by stripping `+`, trimming, and excluding blank / `//` / `*` / `/*` lines:

| file | added | executable |
|---|---|---|
| `.design/project-log/2026-07-29-dev-xss-r8-fix.md` | 103 | 80 *(markdown, not code)* |
| `internal/server/convert.go` | 58 | **0** |
| `internal/server/export_import.go` | 41 | **0** |
| `internal/webguard/doc.go` | 33 | **0** |
| `internal/webguard/remotedata_consumers_test.go` | 166 | **106** *(Go, test-only)* |
| `web/src/capabilities.ts` | 49 | **0** |
| `web/src/components/ft-app.ts` | 26 | **3** *(TypeScript, production)* |

So: **the round's only executable *production* change is 3 lines of TypeScript in
`ft-app.ts`.** The 106 Go executable lines are all test code.

**[MEASURED]** the pipeline, from `Makefile`:

```
22: test: test-go test-web
27: test-web:
28: 	cd web && npm test
34: web:
35: 	cd web && npm ci && npm run build
```

The differential as run is `go build ./...` / `go vet ./...` / `go test ./...` — **Go only**.
No Go command typechecks TypeScript. And the 70-byte `web/dist/index.html` stub is precisely
what guarantees `make web` (`npm ci && npm run build`, the vite/tsc step) never runs: the stub
satisfies `assets.go:5`'s `//go:embed all:web/dist` **[MEASURED]** so nothing ever needs to
produce the real bundle.

**Therefore the differential can discharge the Go half of R-2 and is structurally incapable of
discharging the TypeScript half — which is the half containing every executable production
line this round ships.**

**This is why it matters beyond bookkeeping.** If a green Go differential is read as "R-2
discharged", that is *a correctly-measured result attached to a wider population than it was
measured over* — the identical defect shape as **R-1**, **O-4**, and the **OP-2** disagreement,
which this report already identifies as the round's signature error at three scales. **The
proposed remedy for R-2 would reproduce the defect R-1 exists to flag.** That is the fourth
scale.

**Recommend splitting R-2:**
- **R-2a (Go)** — dischargeable by the fixed-N interleaved differential, with the stub
  disclosed. Common-mode holds here; the EM's reasoning is correct for this half.
- **R-2b (TypeScript)** — requires `cd web && npm ci && npx tsc --noEmit` and `npm test` on
  **both** arms. Per Bulletin 19.1 §2 this needs no token and contaminates nothing if run in a
  **throwaway copy outside `/workspace`** — the mechanism the EM now explicitly encourages.
  Until that runs, the 3 executable lines of this round have been read by humans and compiled
  by nothing.

#### UPDATE 13:42Z — R-2a IS DISCHARGEABLE IN A PRISTINE TREE WITH NO STUB. THE STUB WAS NEVER NEEDED FOR IT.

Bulletin 20 §2 supersedes 19.1 §3 with a labelled measurement: `go test ./...` does **not**
abort pattern expansion. It expands to **32 packages** and marks exactly **four** setup-failed —
`farmtable`, `cmd/farmtable-server`, `cmd/ft`, `internal/cli` — **the other 28 run normally and
their results are valid.**

**All 106 executable Go lines this round ships live in `internal/webguard`, which is not one of
the four.** I can corroborate that from a measurement I published *before* the four-package
figure existed. **[MEASURED, coordinates declared per Bulletin 20 §4: tree
`/workspace/farmtable-review-r8` @ `901670e`; web/dist ABSENT; node_modules ABSENT; module cache
N/A — grep only, no Go command run]**

```
$ grep -rn "go:embed all:web/dist\|farmtable.WebAssets" --include='*.go' .
assets.go:5://go:embed all:web/dist
cmd/farmtable-server/main.go:100:  fs.Sub(farmtable.WebAssets, "web/dist")
internal/cli/dashboard.go:119:     fs.Sub(farmtable.WebAssets, "web/dist")
internal/webguard/doc.go:73:                    <- COMMENT
internal/webguard/..._test.go:312:              <- COMMENT

$ grep -rn 'farmtable-io/farmtable"' --include='*.go' internal/webguard/
exit: 1     (webguard does not import the root package at all)
```

The embed is in the root package; the setup-failure propagates to the root plus its importers.
That is the four, and it **predicts `internal/webguard` is excluded** — which is what Bulletin
20 measured independently.

**Consequence for R-2a.** It does not need the stub, a built frontend, or `./...`:

```
go test ./internal/webguard/...      on both arms, in a pristine tree
```

This runs the round's entire executable Go delta, needs no `web/dist` by any means, and so
breaches neither item 10 nor item 4. **The stub bought nothing for the round's Go delta** — it
was collateral for the verbs that *do* abort (`build`, `vet`), applied to a question only
`test` had to answer — **and it cost the tsc step, which is the R-2b gap.** This is
`farmtable-mainred-fix`'s point in a second instance: the finding was reachable all along by a
one-word change to the command, and `./...` is what people type.

#### DISPOSITION 12:49Z — the split was ruled as recommended

R-2 is split. **R-2a** is the EM's to run under the fixed-N interleave with the stub disclosed.
**R-2b** is dispatched to a dedicated leg — both arms, throwaway clone outside `/workspace`,
local-path clone rule, and an explicit prohibition on creating `web/dist` by any means
including a stub. **Not this leg's to run; this tree stays unbuilt.** The EM additionally
recorded the causal link himself: the stub *"removed the only step that would have compiled the
three lines that matter."*

**One note entered against R-2b before it runs, because the correct reading of its most likely
non-trivial outcome is the opposite of its surface reading. [UNCHECKED — flagged before the
fact]** `tsc --noEmit` over this tree may well come back **RED on both arms with identical
errors**, from type errors pre-dating `e4e3d13`. That result **discharges R-2b** — it says the
delta introduced no type error — and it must not be read as "R-2b failed" or as a finding
against r8. This is the same common-mode logic that was just misapplied to a green, running in
the other direction: **a differential attributes the delta, so identical output on both arms is
a clean delta whatever its colour, and only a diverging arm is a finding.** Worth pre-stating
because a red is the reading most likely to be taken at face value, and because the round
changed neither `package.json`, `package-lock.json` nor `tsconfig.json` **[MEASURED — none of
the 7 changed files]**, so dependency and compiler configuration are genuinely common-mode
across the arms and cannot themselves explain a divergence.

### Checked and DISCONFIRMED — a hypothesis of mine that did not survive

I suspected the round's **new** prune assertion (`if descended["dist"] || descended["node_modules"]`,
`+` in the diff **[MEASURED]**) was vacuous in a clean checkout, since `doc.go` — modified in
this same round — records that *"the CI workflow asserts web/dist is ABSENT on checkout"*, and
an absent directory is never descended into.

**It is not vacuous, and the test is better built than my hypothesis assumed.**
`TestWebCensusAnchoringIsTopLevelOnly` runs against a `t.TempDir()` fixture and *creates* its
own `dist/bundle.js` and `node_modules/pkg/index.ts`, so the pruned population exists by
construction regardless of the real tree. It also carries an explicit liveness control —
`PROOF THE FIXTURE IS LIVE`, a `t.Fatalf` if an ordinary fixture file is not found, on the
stated grounds that otherwise *"every 'not found' below is meaningless and the negative
assertions would pass for the wrong reason."* **That is the planted-positive discipline of §7,
implemented in the code under review, by the author, unprompted.** Reported as a negative
result because a disconfirmed hypothesis is a result.

**FYI, outside my delta:** the *pre-existing* assertion of the same shape in
`TestWebCensusDescendsIntoShippedSource` (a **context** line in the diff, not added) *does*
assert against the real tree, so `descended["dist"]` is false-for-the-wrong-reason whenever
`web/dist` is absent. Not a finding against r8 — it is unmodified. Noted only because it
inverts under the stub: the EM's build clones make that assertion non-vacuous while CI makes
it vacuous, so it means different things in his trees than in CI.

---

## Reconciliation with prior findings

Everything **above this line** was written to disk before `_r8-PHASE-TWO.md` was opened, and
was derived only from the apparatus/role briefs, the diff, and the tree at `901670e`. Nothing
above was influenced by another leg's findings or the EM's prior conclusions. Below is the
reconciliation.

### DISAGREE — OP-2: "17 line-number citations remain **in the tree**" is a scope error

**Severity of the correction: Required against the brief, not against the branch. [MEASURED]**

The EM records OP-2 as *"**17 line-number citations remain in the tree**"* and states *"I have
not verified the 17."* I verified it, and **17 is the round's-six-files figure, not the
tree's.** Corpus defined by `git ls-files '*.go' '*.ts'` (275 files), same predicate, both
units published because they differ:

| scope | files | **occurrences** | **lines** |
|---|---|---|---|
| the round's 6 changed files | 6 | **17** | 16 |
| all tracked `.go`/`.ts` | 275 | **39** | 34 |

The EM's 17 matches the round-scope **occurrence** count exactly, so the number is not
invented — it is correctly measured against a population that is **2.3× narrower than the
label it carries**. This is precisely §7's *"A TRUE ANSWER TO A NARROW QUESTION READS AS A
CLEAN ANSWER TO THE WIDE ONE"*, and it is load-bearing for OP-2's disposition: a §30
re-anchoring project scoped to 17 is a bounded cleanup, one scoped to 39 is not, and the
decision the EM is about to make is which.

*Instrument:* planted-positive control **B** (§I-13), armed before this sweep, plus a
`while read -r` loop (never a scalar file list). *Both figures I publish are occurrence-based
unless the table says lines.*

**Where I agree with OP-2:** all 17 in the round's files **resolve correctly today**
[MEASURED, §I-6]. The leg's claim on that point holds, and so does `4026dca`'s "seventeen".
The defect is in the *label*, and it originates in the EM's relay, not in the leg's commit —
`4026dca` says "IN THE ROUND'S FILES", which is correct.

### FOUND INDEPENDENTLY — OP-1: zero coverage on both gate readers

Reached before opening PHASE-TWO, and armed with a planted control (§I-13 arm D) rather than
a bare zero. See **Test Coverage**. I add one thing to the EM's open question: the round
already contains the argument for widening, in `af9ea8c`'s own commit message, and the change
it guards is three lines. My recommendation is a filed, assigned follow-up rather than
widening here — but the finding should not stay dispositioned-by-silence, which is what a
paragraph in a commit message amounts to.

### FOUND INDEPENDENTLY — `collectionSupportsGraph` as the second Go-side collection reader

§4 lists this as known and routed off. I rediscovered it cold, from the census re-run
(§I-2), as the single **FLAGGED** member of `ENUMERATED 8 = FLAGGED 1 + EXCLUDED 7`, and
separately confirmed its farmtable early return in `resolveGraphRoute`. Independent
corroboration by a different route than the original filing.

### CONSISTENT — §2.1, `npm test` cannot reach `ft-app.ts`

I did not re-run `tsc` (no token). My static half agrees: **no test imports `ft-app.ts`** —
the only occurrence of the string in any `*.test.ts` is a prose comment in
`url-binding-scan.test.ts`, not an import [MEASURED, §I-12, planted control D]. I record the
leg's `--listFiles` 0-vs-1 measurement as **[DERIVED, not reproduced]** and note that my
result and the leg's are *not independent confirmations of the same thing*: mine shows no
import edge exists in source, the leg's shows the typechecker did not load the file. They are
consistent and they could both be wrong in the same direction only if an import were
generated, which nothing here does.

### AGREE WITH THE ROUTING — conditions 5 and 6b (F2, F9)

The EM invites me to say if the routing was wrong. **It was not.** `graph_routing.go` is
genuinely absent from the diff [MEASURED — the round touches 7 files and it is not among
them], and, more importantly, the deferral did not leave a false statement behind: the
`convert.go` block explicitly names the gap it is not closing (*"a THIRD farmtable early
return, in a file this round never opened … Do not treat its absence from the two-conjunct
model as evidence that the model covers it. IT DOES NOT."*). That is the correct way to defer
a defect — the tree now describes its own incompleteness. A deferral becomes a defect when it
is silent, and this one is not.

### CORRECTION-AS-CLAIM — the two log self-corrections are themselves incomplete

`1cba5b5` and `901670e` are the leg correcting its own log, and §2 warns that a correction
*"arrives in the posture of having just been careful."* Checked:

- `901670e`'s two claimed fixes are **right**: the commit list now enumerates all ten (nine
  SHAs plus the self-referential clause) [MEASURED — matches `git rev-list`, 10], and the cell
  range reads R8-01…R8-15.
- **But a third stale fact survived both correction passes** — the *"Fifteen line-number
  citations remain in `convert.go` and neighbours"* scope mislabel, my **O-4**. 15 is
  `convert.go` alone; with neighbours it is 17. So the correcting commits corrected what they
  went looking for and did not re-derive the rest.

This is the same shape as the OP-2 disagreement above, one level down, and the two are
probably the same root error propagating: **the round has a persistent habit of attaching a
correctly-measured number to a wider population than it was measured over.** That is my
strongest cross-cutting observation and I did not have it until I reconciled.

### NOT CHECKED — declared, not cleared

- **`scopes.go` gofmt-dirty.** I ran no `gofmt` (treated as token-adjacent). **UNCHECKED.**
  Per instruction I did not fix it and did not go looking, so I supply no third sighting.
- **`.gitignore` line 17 `dist/` unanchored.** **UNCHECKED — deliberately.** It is outside the
  delta and the EM's own note shows the obvious probe returns a reassuring wrong answer in a
  never-built clone like mine. I decline to produce a figure I would have to caveat into
  meaninglessness. One in-scope consequence worth flagging without measuring: if `dist/`
  matches at any depth, then `web/src/util/dist/` — one of the three directories the new
  regression test is *about* — is invisible to `git status`, which is a plausible part of why
  the original plants went unnoticed. That is a hypothesis, not a finding.
- **`scripts/ci-suite-manifest.mjs`**, **real main `cc92735`**: out of scope, not examined.

### MISSED — nothing from §4 that I should have found

I did not independently sight the `scopes.go` formatting issue or the `.gitignore` anchoring
issue. Both are outside the diff and my role brief scopes me to the delta, so I record these
as **correctly out of scope** rather than as misses. **The one thing I would call a genuine
miss:** I did not think to check the tree-wide citation population until PHASE-TWO's OP-2
prompted the scope question — my cold pass measured exactly the six files in front of it and
would have let "17 in the tree" stand unchallenged.

---

# PRESERVATION RECORD — 15:44Z, review-xss-r8 wind-down

Written to the shared volume because the measurement below, and the fixture it describes,
otherwise existed **only in my container** and no ref points at either.

## Durability finding — the corrected predicate

The question that bears on durability is **not** "is this ref reachable from main" (that
false-positives on every unmerged branch) but **"is this object absent from every store
outside my container"**, tested with `git cat-file -e` against `/workspace/farmtable`,
stderr visible.

**TESTED 565 distinct objects = PRESENT-IN-CANONICAL 565 + CONTAINER-ONLY 0.** [MEASURED]

Union of three complementary sweeps, run because none subsumes the others:

| sweep | command | SHAs |
|---|---|---|
| (a) fsck | `git fsck --unreachable --dangling --no-progress \| awk '/commit/{print $3}'` | 386 |
| (b) reflog | `git reflog --all --format=%H \| sort -u` | 2 |
| (c) all ref tips + HEAD | `git for-each-ref --format='%(objectname)'; git rev-parse HEAD` | 179 |
| **union, deduped** | | **565** |

**The complementarity is demonstrable in this tree, not merely argued:** sweep (a) surfaced
**386 commits that (b) and (c) could not see** — `for-each-ref` cannot list an unreachable
tip and the reflog held only this clone's own two `clone:` entries. Conversely fsck roots on
reflogs, so an amended-away tip would have been invisible to (a) and visible only to (b).

*Controls, same command both directions:* `cat-file -e` on a fabricated SHA → rc=1; on
canonical tip `2982ffd` → rc=0. The instrument can say no.

*Ancestry number, reported but NOT the durability finding:* against freshly fetched canonical
main **`2982ffd`**, the single non-remote ref `refs/heads/url-scheme-validation-r8` @
`901670e` is REACHABLE. Against my clone's **stale** `origin/main` (`7a0f220`) the same
command said NOT REACHABLE. The stale answer is withdrawn.

**No bundle was created: there is nothing unreachable to put in one.** HEAD is attached.
`refs/preserve`, `refs/legs`, `refs/newmain`, `refs/newmain2`, `refs/stash` and notes: all
absent or zero, by bare `for-each-ref` filtered after the fact.

## The arms produced NO commits — and here is the recoverable form

I made **zero commits** this session. `/tmp/r8-ignore-probe` was `git init` and never
committed: 0 refs, 0 reflog SHAs, 0 loose objects, 0 packs. Nothing is recoverable from it
because nothing was ever created. Its value is prose, recorded at lines 78–82 above:

> ARM 1 `dist` ABSENT → exit 1 · ARM 2 `dist` a DIRECTORY → `.gitignore:1:dist/`, exit 0 ·
> ARM 3 `dist` a REGULAR FILE → exit 1

## The §I-13 planted fixture, verbatim — it dies with this container

§I-13 records the arms and their expected outcomes but not the fixture's contents. Full
reconstruction of `/tmp/r8-ctl-a1`:

```
.                            ./src                  ./tests
./dist                       ./src/util             ./tests/planted.test.ts
./planted_citation.go        ./src/util/dist        ./tests/planted_consumer.ts
./planted_nearmiss.go                               ./tests/planted_notatest.ts
./planted_reader.go
./planted_thing_test.go
```

**`dist`, `src/util/dist` and `src` are EMPTY DIRECTORIES and are the whole point of arm C** —
arm C's predicate is a `find` over directories, so recreating only the files reproduces a
fixture that cannot pass it.

```go
// planted_citation.go
// see export_import.go:306 and ft-inspector-meta.ts:628 for detail

// planted_nearmiss.go
// see export_import.go and capabilities.ts for detail

// planted_thing_test.go
package p

// writable appears here but this is a test file

// planted_reader.go
package p

func readsIt(c *ent.Collection) bool {
	if w, ok := c.RemoteData["writable"].(bool); ok {
		return w
	}
	return false
}
```

```ts
// tests/planted.test.ts
import { getCapabilities } from '../capabilities.js';

// tests/planted_consumer.ts
const rd = coll.remoteData;

// tests/planted_notatest.ts
export function getCapabilities() {}
```

All plants are hand-typed literals — no `$RANDOM`, no command substitution — so this listing
reproduces the fixture exactly rather than approximately.
