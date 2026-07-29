# xss round 7 (`e4e3d13`): fix leg for B1–B5 / A1–A3 — Code Review

**Leg:** `review-xss-r7` (code-review leg of a three-way independent review).
**Object:** commit **`e4e3d13`** on `url-scheme-validation-r6`; round base **`c108acb`**;
branch base **`d305391`**; also at `refs/preserve/xss-r7-fix-e4e3d13`.
**Tree:** `/workspace/farmtable-xss-r7-review`, detached at `e4e3d13`. `web/dist` ABSENT,
`web/node_modules` ABSENT.
**Merge target referenced by the diff:** `cc92735` — resolves in this clone (`git cat-file -t`
→ `commit`, subject `Merge PR #205: stand up CI on GitHub Actions`).

---

## FINAL VERDICT

# REQUEST CHANGES

Three **Required** findings. No **Critical**. The production behaviour change (B5, the
per-field sampler) is correct, well-tested and I would take it on its own.

**Verdict stated before the evidence, per brief. Pre-registered counterfactual:** had the
five citations in §R1 resolved at `e4e3d13`, and had mutation cell R7-REVIEW-03 gone red,
this would have been **APPROVE** with the §N nits forwarded to a cleanup pass. Nothing else
in the diff was close to blocking. Two specific observations would have flipped me, I went
and looked for both, and both landed against the change.

**Phase two changed nothing.** Everything from here to `PHASE TWO RECONCILIATION` was written
and on disk before I opened `_r7-PHASE-TWO.md` or any r6 report. Reading them produced two
self-corrections (both labelled as such in place), one new **FYI**, and zero changes to the
verdict, the severities or the three Required findings. **The single most important thing
phase two added is not a new finding but a pattern**: r6's central defect was a reachability
argument that named three writers and discharged two, and r7's replacement argument names a
mechanism that discharges one of two `doc` producers (§R3). The round reproduced the defect
class it was convened to remove — which is exactly what §R2 says about its guard, and §3 of
the reconciliation says about its canary table.

---

## POPULATION BEFORE VERDICT

What I searched, before what I concluded. Every count carries `ENUMERATED = FLAGGED + EXCLUDED`.

| # | Population | Instrument (ROOT `/workspace/farmtable-xss-r7-review`, rev `e4e3d13`) | E = F + X |
|---|---|---|---|
| P1 | Every `file:line` citation the diff **adds** (distinct targets) | `git diff c108acb..e4e3d13 -- internal/ web/ \| grep '^+'` then two greps: qualified `file.ext:N` **and** bare `:N` not preceded by a path char. **Two instruments, they do not overlap** — the bare grep excludes anything preceded by `[0-9A-Za-z_./-]`, so qualified hits are not double-counted. Each distinct target then resolved with `awk 'NR==n'`. | **27 = 5 + 22** |
| P2 | Directories under `web/` whose basename is in `skipDirs` | `find web -type d \( -name node_modules -o -name dist -o -name build -o -name .vite -o -name coverage -o -name .tmp-test \) -print` → **no output**; cross-checked against `find web -type d \| sort` (16 dirs). | **16 = 0 + 16** |
| P3 | Occurrences of `writable` in Go | `grep -rn --include='*.go' -w 'writable' .` (9). Bound checked with `grep -i -c` (no word boundary, case-insensitive): 6+4+2 = 12 across three files, i.e. the `-w` census is a **subset**; the 3 extra are `not-writable` / `isCollectionWritable`-style substrings, none of them readers. | **9 = 0 + 9** |
| P4 | Production call sites of the drop-log sampler | `grep -rn --include='*.go' -e 'structOrNilLoggingErr(' -e 'logRemoteDataDropped(' . \| grep -v '_test.go'` | **2 = 0 + 2** |
| P5 | Mutation cells I ran (reviewer matrix, in a throwaway copy) | see `_run-queue-log.md` R7-REVIEW-03..07 | **5 killed 3 + survived 2** |

**Excluded counts are non-zero where it matters** (P1: 22, P3: 9), so those filters are
demonstrably matching something. **P2's flagged count is zero and that is itself the
finding** — see §R2; I did not treat the empty result as a pass.

### Negatives, with the command verbatim

Every "nothing does X" below was executed at ROOT `/workspace/farmtable-xss-r7-review`,
revision `e4e3d13`.

- *No directory under `web/` at any depth carries a `skipDirs` basename.*
  `find web -type d \( -name node_modules -o -name dist -o -name build -o -name .vite -o -name coverage -o -name .tmp-test \) -print` → empty.
- *No functional Go reader of `writable`.* `grep -rn --include='*.go' -w 'writable' .` → 9
  hits, 7 comments + 2 Go **string literals** in `internal/webguard/remotedata_consumers_test.go`
  (:171, :181). Zero executable reads. **Claim holds in substance; see §N2 for the wording.**
- *No `UseNumber` on any decoder.* `grep -rn --include='*.go' 'UseNumber' .` → 2 hits, **both
  are the r7 comment's own text** (`convert.go:780`, `:799`). Worth knowing: the negative that
  argument (2) rests on is now self-matching, so the next person grepping `UseNumber` finds
  the comment before they find an absence.
- *No web test mentions `remote_data` today.*
  `grep -rn --include='*.ts' --include='*.mjs' -e remoteData -e remote_data web/src web/scripts | grep -i test` → empty. `.tmp-test` in `skipDirs` is therefore latent, exactly as the comment says.
- *No nested `node_modules` under `web/`.* Same `find` as above. So anchoring `skipDirs` to
  top level does not widen the walk into anything expensive on this tree.

### Execution evidence

Both targeted runs pre-registered in `reports/_run-queue-log.md` **before** running, with
ROOT and DIST filled in, including on the lines I expected to pass.

- **R7-REVIEW-01** `go test ./internal/webguard/ -run '^Test' -count=1 -v` → **3 `=== RUN`,
  0 FAIL**, ends `ok …/internal/webguard 0.011s`. Matched the pre-registered 3.
- **R7-REVIEW-02** `go test ./internal/server/ -run '^TestRemoteData' -count=1 -v` → **49
  `=== RUN`, 0 FAIL**, ends `ok …/internal/server 0.017s`. Reconciles with the fix leg's R7-17.

**No wide run.** I hold no build token and did not request one. `go build ./...`, `go vet
./...`, `go test ./...`, `make test`, `npm test` were **not** run by me. `web/src/capabilities.ts`
is still comment-only-edited with no `tsc` and no `npm test` against it, as the fix leg
itself flagged. **A wide run is still wanted before merge and my APPROVE-if-fixed is
conditional on one.**

---

## PRE-REGISTERED FALSIFIER FOR MY HEADLINE FINDING

**Headline (§R2):** *`TestWebCensusDescendsIntoShippedSource` cannot fail for the regression
it was written for.*

**What would sink it, written before I looked:**

1. Reverting `skipDirs[rel]` to `skipDirs[d.Name()]` turns the test **red**. If it does, the
   test guards its fix and I am wrong.
2. A directory exists under `web/` at any depth whose basename is in `skipDirs` and which is
   an ancestor of shipped source. If one does, basename matching prunes real source, the
   `must` list goes unsatisfied, and the test fires.

**I went and looked for both.**

1. **Cell R7-REVIEW-03**, run in `/tmp/mut`: the mutation compiled and the package went
   **GREEN — 3 `=== RUN`, 0 FAIL, `ok`.** Falsifier not found.
2. `find` over all 16 directories under `web/`: **zero** matches. Falsifier not found.

I then ran the control the falsifier implies: **R7-REVIEW-04**, prune disabled outright
(`if false && skipDirs[rel]`) — also **GREEN**. So it is not merely that the anchoring is
unguarded; the two `descended[...]` prune assertions cannot fire in this root either.

**Naming the cause as a number I had not yet checked** (per the method): the cause is not
"the test is badly written". The cause is **the integer 0 in P2** — the number of
directories on this tree that the two implementations disagree about. I did not have that
number when I formed the suspicion; getting it is what turned a hunch into a result, and it
is also what makes the finding *fair* to the author: B4 is a correct fix for a real hole,
it is simply inert today, and a canary that plants files (as the fix leg's R7-02 did)
measures something different from a canary that reverts the fix.

---

## Executive Summary

Round 7 is 931 insertions across 7 files, almost entirely prose plus tests, with one real
behaviour change. The behaviour change (per-field drop-log sampler, B5) is correct,
minimal, and backed by a test I confirmed fails when the fix is reverted. **Risk level:
LOW for the running system, MEDIUM for the artefact** — the diff's job is to be an accurate
in-tree record, and it ships five line citations that its own edits invalidated plus a
regression guard that cannot detect its own regression.

---

## Critical

**None.** No security vulnerability, data loss or broken functionality introduced. I
specifically checked the one behaviour change for a lock/lifetime defect and for unbounded
map growth (§FYI-4) and found neither.

---

## Required

### R1. Five line citations added by this diff do not resolve at `e4e3d13` — and all five point into the two files this diff edited. *(cold pass raised the suspicion; the role-brief citation sweep produced the population)*

`ENUMERATED 27 distinct citation targets = FLAGGED 5 + EXCLUDED 22.`

The 22 that resolve correctly are every citation into a file this round **did not touch** —
`entstore.go` (6), `server.go` (5), `passthrough.go` (4), `graph_routing.go` (2),
`urlvalidate.go`, `beads_import.go`, `assets.go`, `Dockerfile`, `Dockerfile.server`. I
checked all 22 individually with `awk 'NR==n'`; they are accurate, including the
`entstore.go:2112-2118` range and the three `passthrough.go` return sites.

The 5 that fail are every citation into a file this round **did** touch:

| Cited | Diff claims it is | Actually at `e4e3d13` | True line |
|---|---|---|---|
| `export_import.go:306` | `if doc.Collection.Platform != …` (conjunct A) | first line of the **new comment block itself** | **335** |
| `export_import.go:331` | `Platform: collection.PlatformFarmtable` | prose inside the new comment | **363** |
| `export_import.go:332` | `RemoteData: sanitizeRemoteData(doc…)` | prose inside the new comment | **367** |
| `export_import.go:412` | `s.store.ImportCollection(ctx, importParams)` | `if err != nil {` in an unrelated loop | **447** |
| `web/src/capabilities.ts:94` | the `FARMTABLE` early return | first line of the **new comment block itself** | **110** |

**The mechanism, which is the part worth fixing.** All five were *exactly right at `c108acb`*
— I resolved them there and they hit their targets. They were made wrong by the very
commit that wrote them: `6a48b86` inserted 29 comment lines above the export_import targets
and 16 above the capabilities target, shifting each by precisely that amount. **This is a
self-invalidating citation: the act of writing the annotation moved the thing annotated.**

That matters more than an ordinary stale reference because of where these five sit. Four of
the seven occurrences of `:306` are inside `export_import.go` itself, written as
present-tense self-references — "*Second half of CONJUNCT A (see :306)*", "*what makes the
:306 check load-bearing*", "*Inert only by conjuncts A and B at :306*". A reader who opens
`export_import.go`, jumps to 306, and lands on the comment's own opening line has been sent
in a circle by the file's own navigation aid. `capabilities.ts:94` is cited from two
different files (`export_import.go` and the webguard allowlist reason) as the anchor for
conjunct B.

**The SHA stamp is a partial defence and does not cover these.** `convert.go`'s PRODUCERS
block is honestly stamped *"ENUMERATED AT c108acb. AS-OF-THIS-COMMIT, NOT AN INVARIANT"*,
and under that stamp `:306`/`:331` are defensible. But the same targets are cited **unstamped**
in three other places: `convert.go`'s argument (2) (`:332`, `:412`), `convert.go`'s ARMING
EDITS list (`export_import.go:306 and :331`, `(export_import.go:332)`), and all six
self-references inside `export_import.go` and `capabilities.ts`. Those carry no revision and
read as present tense.

**Suggested fix.** Two options, either is fine, but pick one and apply it uniformly:

- **Preferred — drop the numbers for the intra-file and newly-written references and cite by
  symbol.** The diff already articulates this principle and applies it elsewhere:
  *"Cited by name, not line: this round spent most of itself on citations that resolved to the
  wrong thing."* (`export_import.go`) That sentence is 25 lines above four line citations.
  Make the practice match the stated rule: "*the platform check below*", "*the
  `PlatformFarmtable` hardcode in the params literal*", "*the `Platform.FARMTABLE` early
  return in `getCapabilities`*". None of those can drift.
- **Or** re-resolve all five against `e4e3d13` (335 / 363 / 367 / 447 / 110) and put the SHA
  on each one, the way the PRODUCERS block already does.

Do **not** just bump the five numbers without a SHA — the next comment edit in either file
breaks them again by exactly the same mechanism.

---

### R2. `TestWebCensusDescendsIntoShippedSource` passes unchanged when the B4 fix is fully reverted, but its doc comment tells the reader it is the guard for that regression. *(cold pass)*

This is the round's own declared defect class — the brief opens by noting *"a previous round
shipped a comment describing a test that could not fail"* — recurring in the test convened
to prevent it.

**Measured, not argued.** Cell **R7-REVIEW-03**, in a throwaway `cp -a` copy at `/tmp/mut`
(no production file in the review tree was modified; the copy ended with `git status
--porcelain` reporting 0 modified files):

```
skipDirs[rel]  ->  skipDirs[d.Name()]        # i.e. revert B4 entirely
go test ./internal/webguard/ -run '^Test' -count=1 -v
  -> EXIT 0, 3 === RUN, 0 --- FAIL, 3 --- PASS, ok …/internal/webguard 0.011s
```

And the control, cell **R7-REVIEW-04**, prune disabled outright — also green. So both
`descended[...]` prune assertions are vacuous here too.

**Why.** `P2 = 16 = 0 + 16`: no directory under `web/` at any depth has a `skipDirs`
basename. The `must` list is `src, src/components, src/gen, src/store, src/util, src/utils`
— all six exist (I checked, including `src/utils`, which is easy to mistake for a typo of
`src/util`; both are real), and none is pruned under **either** implementation. The three
directories the failure story is about — `web/src/build/`, `web/src/util/dist/`,
`web/src/components/coverage/` — were **planted by the r6 test leg and do not exist in the
tree**. The test therefore cannot distinguish anchored from basename matching.

**What the test does and does not do.** It genuinely catches a *future widening* of
`skipDirs` — adding `"src/util"` fails it by name, which is what the fix leg's cell R7-04
measured, and that cell is real and correctly reported. But the in-code doc comment claims
more than that:

> *"When skipDirs matched on basename, web/src/build/, web/src/util/dist/ and
> web/src/components/coverage/ were pruned; three planted consumers in those directories were
> invisible and BOTH arms of the guard above stayed silent … so the reach has to be asserted
> separately, here."*

"here" reads as *this test covers that*. It does not. R7-REVIEW-03 is the counterexample.

The fix leg's canary matrix is not dishonest — every cell in it is real and I re-ran three of
them. Its gap is structural and worth naming as a transferable point: **R7-04 mutates
`skipDirs` (the data); it never mutates the matching expression (the code). A canary that
only perturbs a fix's inputs cannot tell you whether the fix itself is load-bearing.**
The three server-side canaries do revert the code, which is exactly why they discriminate
(§Test Coverage).

**Suggested fix.** Pick one; the first is cheapest and I would take it:

1. **Make the doc comment true.** State plainly that the test asserts *reach against future
   widening of `skipDirs`*, and that on the tree as it stands the anchoring change is
   behaviourally inert (P2 = 0), so **no test distinguishes anchored from basename matching**.
   That is an honest, checkable sentence and it costs one paragraph. It is squarely in this
   file's established register — `doc.go` already carries a "TWO LIMITS ON THE CENSUS" block
   doing exactly this.
2. **Or make the test bite.** Add a `t.TempDir()`-rooted unit test over
   `censusRemoteDataMentions`: build `sub/dist/x.ts` containing `remoteData`, assert the
   census **finds** it, and assert `web/dist`-equivalent at top level is pruned. That tests the
   matching expression directly, is independent of what happens to exist under `web/`, and
   kills R7-REVIEW-03 and R7-REVIEW-04 together. It also removes the dependency on `web/dist`
   and `web/node_modules` being present, which is what made the prune assertions vacuous in
   my root (§FYI-3).

I am not asking for both. Option 1 discharges the Required; option 2 is the better
engineering and I would call it Optional on top.

---

### R3. Argument (2) in `collectionToProto` discharges one of the **two** producers of `doc` in `ImportCollection`, and presents its mechanism as the complete reason. *(role-brief checklist: "where it makes a claim about a population, check the population, not a sample")*

The comment says:

> *"(2) A TYPE argument, covering Import … What stops it is that the payload arrives through
> `encoding/json` into a `map[string]any`, with no `UseNumber` on the decoder, so every value
> is nil, bool, float64, string, []any or map[string]any …"*

`ImportCollection` (`export_import.go:264`) switches on `detectImportFormat` and has **two**
branches that populate `doc`:

- `case "farmtable"` (:294) — `json.NewDecoder(...).Decode(&doc)`, no `UseNumber`. The
  comment's mechanism applies exactly. ✅
- `case "beads"` (:277) — `doc = converted`, where `converted` comes from
  `convertBeadsToExportDocument`. **`doc` here is a Go struct literal built in
  `beads_import.go:385-402`, not a JSON decode of the import document.** The comment's
  mechanism does not apply to it at all.

**The conclusion survives; the argument does not cover the case.** I checked: the beads
literal at `beads_import.go:389-396` sets `ID, Name, Description, Platform, CreatedAt,
UpdatedAt` and **omits `RemoteData` entirely** (`grep -n 'RemoteData' internal/server/beads_import.go`
→ no match). So `doc.Collection.RemoteData` is nil on that path and nothing hostile reaches
the store. **No security defect.** But the discharge is by a *different* mechanism — the
field is never populated — and the comment does not say so.

This is the same shape as B1, one level down, and the comment is unusually well placed to
notice: it already says, about its own predecessor, *"An earlier version of this comment named
all three writers and then discharged only two, which is this round's own defect class — a
conclusion written at a wider scope than its evidence — committed in the very comment convened
to remove it."* Argument (2) names one decoder and discharges one of two `doc` producers.

It matters for the reason the whole block exists: the block is a **notice to a future editor**.
Someone extending the Beads importer to carry issue metadata into collection `remote_data`
would read argument (2), see "encoding/json, therefore representable", and conclude they are
covered. They would not be — their values would be whatever Go types
`convertBeadsToExportDocument` constructs, and `structOrNilLoggingErr` would start dropping
the collection's `remote_data` wholesale.

**Suggested fix.** One sentence inside argument (2), in the block's existing vocabulary:

> `doc` has **two** producers, not one. The `"farmtable"` branch (`export_import.go`, the
> `json.NewDecoder` case) is covered by the decoder argument above. The `"beads"` branch
> builds `doc` as a Go struct literal in `convertBeadsToExportDocument`
> (`beads_import.go`), where the decoder argument does **not** apply — it is discharged
> instead by that literal setting no `RemoteData` field at all, the same way
> `syntheticCollection` is. Adding one there arms this path without touching argument (1)
> **or** the decoder.

While there, add the beads producer to the "INVALIDATING EVENTS, NAMED" list, which
currently has three and does not include it.

---

## Nit / Optional

### N1. `remotedata_log_test.go:217` says "sole input"; `convert.go:815` says "ONE OF THE TWO INPUTS". Same diff, same gate. *(cold pass)* — **Nit**

- `convert.go:815`: *"THIS FIELD IS ONE OF THE TWO INPUTS TO A WRITE-AUTHORIZATION GATE."*
- `convert.go:821` states the invariant as a conjunction: platform GITHUB **and**
  `writable=true`, *"TOGETHER, IN ONE OBJECT."*
- `remotedata_log_test.go:217`: *"collection remote_data is the **sole** input to the
  write-authorization gate documented in collectionToProto."*

The test comment contradicts the invariant it cites. "Sole" is the count-in-present-tense
form that §"WHY THERE IS NO NUMBER IN THE PARAGRAPH ABOVE" argues against, three files away.
`convert.go:333` gets it right with the bare "*is the input to*". **Fix:** in the test
comment, "is one of the two inputs to".

### N2. "`writable` … appears in Go only in comments" is false by two occurrences. *(cold pass)* — **Nit**

`P3 = 9 = 0 + 9`. Seven are comments; **two are Go string literals** —
`internal/webguard/remotedata_consumers_test.go:171` and `:181`, the allowlist `text`/`reason`
fields. The substantive claim ("no functional Go reader", "no server-side notion of a
read-only collection") is **true and I verified it**; only the wording is off, and it is off
in the direction of a population claim that a grep disproves in one line. **Fix:** "`writable`
has no functional Go reader — in Go the identifier appears only in comments and in the
webguard allowlist's declaration strings."

### N3. `remotedata_consumers_test.go:428` cites `R6-23`, which is unresolvable inside the repository. *(cold pass)* — **Nit**

`grep -rn 'R6-23' .` at ROOT → exactly one hit: the citation itself. `R6-23` is a cell ID in
`reports/_run-queue-log.md` on the scratch volume, which is deliberately **not** in the repo
and, per `_r7-COMMON`, lives on disposable storage. A reader of the merged tree has no way to
resolve it. Same objection the round makes to a SHA that resolves in one clone. **Fix:** state
the fact inline — "*(a byte-identical copy of a declared line was measured landing in this arm,
not the undeclared one)*" — and drop the ID, or move the ID into the repo's own project log,
which `.design/project-log/` already exists for (79 entries; the convention is established
and this round follows it correctly for its own entry).

### N4. The `getCapabilities` pseudo-code in `convert.go:826-832` drops two conjuncts. *(cold pass)* — **Optional**

Comment: `if (rd && rd.writable === true)`. Source (`capabilities.ts:115`):
`if (rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true)`. It is
presented as indented pseudo-code and the omission is not misleading about direction — the
real guard is *stricter*, so the comment over-states reachability, which is the safe way to be
wrong. Worth an ellipsis for exactness, as `dev-xss-r7-fix.md` A1 itself wrote it
(`if (rd && ... && rd.writable === true)`).

---

## FYI

1. **B4 is behaviourally inert on this tree.** `P2 = 0`. The anchoring change alters no
   observable behaviour at `e4e3d13`; it closes a hole that opens the moment anyone creates
   `web/src/<anything>/dist/` or similar. That is a good reason to make the change and a bad
   reason to believe a green suite says anything about it. Not a criticism of B4 — context for R2.
2. **`graph_support.go:25 collectionSupportsGraph` is a live functional Go reader of collection
   `remote_data`** (key `graph_queries`; if present and a bool, it is returned, overriding the
   per-platform default). The diff's claims are all correctly scoped to the identifier
   `writable` and remain true. The fix leg found this and routed it in its project log; I
   confirm it independently and confirm it does **not** falsify anything in the diff. Flagged
   only because "AND NOTHING IN GO ENFORCES ANY OF IT" sits four lines from a sentence about
   collection `remote_data` generally, and a skimming reader may over-generalise.
3. **The two prune assertions in `TestWebCensusDescendsIntoShippedSource` are vacuous in a
   bare checkout** (`descended["node_modules"]`, `descended["dist"]` — neither directory
   exists; R7-REVIEW-04 confirms they do not fire even with the prune fully disabled). They
   are **non-vacuous under CI**, because at `cc92735` `npm ci` (workflow step 4) and `make
   build` precede `go test ./... -v`, so both directories exist by then. So this is a
   local-versus-gate asymmetry rather than a dead assertion. Worth one clause in the test
   saying which.
4. **Unbounded-map question: correctly answered.** `P4 = 2 = 0 + 2`. Both production call
   sites (`convert.go:570`, `:921`) pass string literals. The map is bounded by call sites,
   the comment says so, and I could not construct a per-request key. Map access is entirely
   under `remoteDataLogMu` in both production and the test helper. No leak, no race.
5. **The `UseNumber` negative is now self-matching** — the only two hits in the tree are the
   r7 comment's own text. Harmless today; means the grep that would detect the invalidating
   event now returns a false positive first. Mentioned because the comment names that exact
   grep as the trip-wire.
6. **The non-blocking "note it in the log" item on proto-shape vs payload-shape is half
   noted.** The producer-side coverage gap is recorded; the guard's payload-shape blind spot is
   not. Detail and instrument in **COMPLETENESS IN BOTH DIRECTIONS**. One sentence in the
   existing `Coverage gap, unclosed` bullet closes it.

---

## Positive Feedback

Specific, not manufactured.

- **The B5 sampler change is the right fix and the right size.** `remoteDataSamplerState` +
  a keyed map is the minimal correct shape; the lock discipline is unchanged and correct; the
  closed-key-space question is anticipated and answered in place. `TestRemoteDataDropLogIsSampledPerField`
  is a genuinely good test: it asserts the setup is non-vacuous *before* the real assertion
  (`if n := countLines(buf); n != 1 { t.Fatalf("setup: …") }`), it separates the timer defect
  from the counter defect, and its failure message tells the next person what **not** to do
  ("Do not fix this by shortening the interval; key the limiter by field"). I reverted the fix
  and it went red on the first try.
- **`unrepresentableKeys` "no unrepresentable VALUE … so the offending element is a KEY"** is a
  real improvement over "this should not happen", and the decision *not* to print the offending
  bytes is the correct call for the one case where the key is invalid UTF-8. The `%q` change is
  right and the newline-forgery test is the right test for it.
- **`withRemoteDataLogClock` registering its own `t.Cleanup`** closes an order-dependency that
  was live but invisible. The note that double-restore is harmless under LIFO is accurate — I
  checked that `captureRemoteDataLog` does not itself write `remoteDataLogNow`, so both
  cleanups do restore the same value.
- **Declaring the `capabilities.ts` security comment in the allowlist rather than rewording
  around the guard** is the correct call, and saying so in the `reason` field is better than
  doing it silently. The allowlist `text` matches the source line exactly under
  `strings.TrimSpace`; I verified the match and the `count: 1`, and the guard passes.
- **`doc.go`'s B3 rewrite is accurate.** I resolved every claim about `cc92735` against the
  workflow file: `pull_request` + `push: branches: ['**']` ✅, `go test ./... -v` invoked
  directly as its own step ✅, `make test` afterwards as a separate self-check ✅, `web/dist`
  asserted absent on checkout and produced by the run ✅, `Dockerfile:9` / `Dockerfile.server:9`
  both `RUN npm test` ✅. Recording the correction rather than deleting the wrong paragraph was
  the right choice, and *"A CLAIM ABOUT WHAT RUNS YOUR TEST IS A CLAIM ABOUT A DIFFERENT FILE,
  AND IT GOES STALE WITHOUT TOUCHING YOURS"* is the most portable sentence in the diff.
- **The fix leg's self-reporting is unusually honest** — three of its own defects recorded at
  full strength, including the "6 vs 49" miscount and the twice-fabricated mtime. That section
  made my job faster and I want it to keep happening.

---

## Test Coverage

**New code paths are covered, and I verified the coverage is real rather than nominal** by
reverting each fix in a throwaway copy (`_run-queue-log.md`, R7-REVIEW-03..07).

`ENUMERATED 5 mutations = KILLED 3 + SURVIVED 2.`

| Fix | Guard | Revert the fix → |
|---|---|---|
| B5 per-field sampler | `TestRemoteDataDropLogIsSampledPerField` | **RED** ✅ |
| `%q` on attacker keys | `TestRemoteDataLogQuotesAttackerKeys` | **RED** ✅ |
| KEY-not-paradox message | `TestRemoteDataUnrepresentableKeyIsNotAParadox` | **RED** ✅ |
| B4 top-level anchoring | `TestWebCensusDescendsIntoShippedSource` | **GREEN** ❌ (§R2) |
| B4 prune still working | same test, `descended[...]` arms | **GREEN** ❌ (§R2, §FYI-3) |

The three server-side guards discriminate cleanly and each fires on its own arm only. The
one gap is B4, and it is R2.

**Gaps, all pre-existing and all already named by the fix leg** — I confirm them rather than
re-discovering them:

- No test drives a collection with hostile `remote_data` through a **real writer** and observes
  the wire result. The fix leg records this honestly ("Coverage gap, unclosed") and correctly
  identifies that it has the same cause as the fail-closed accident: no in-tree writer populates
  the field, so there is nothing to drive.
- The web tree has **zero** tests touching `remote_data` (verified, negative above), so both
  capability gates — the thing this entire workstream is about — are untested in the language
  they are written in. Out of scope for a comments-and-tests round; **I recommend it be the
  next round's scope**, and note that the moment it lands, the `.tmp-test` entry added to
  `skipDirs` stops being latent and starts earning its place.

---

## Backward Compatibility

**No wire-format impact.** No proto change, no field added or removed, no JSON shape change,
no `omitempty` change. `web/src/capabilities.ts` is comment-only (verified: the only
non-comment lines in its hunk are context). The one behaviour change is confined to
package-private log-sampling state in `internal/server`; `remoteDataLogSamplers` and
`remoteDataSamplerState` are unexported and referenced only within the package (P4).

**Operator-visible change, worth a release note:** drop-log volume can now be up to one line
per field per minute instead of one line per process per minute — with two fields, a ceiling
of 2/min instead of 1/min. That is the intended effect of the fix. Log-line **content**
changes too: keys are now `%q`-quoted, so anything parsing these lines on the unquoted form
will need updating. I found no such parser in-tree.

---

## COMPLETENESS IN BOTH DIRECTIONS

Checked against `briefs/dev-xss-r7-fix.md` including AMENDMENT 1.

### Asked for and absent: **none.**

`ENUMERATED 16 asks = SATISFIED 14 + DEFERRED-WITH-A-NOTE 2 + ABSENT 0.`

| Ask | Status |
|---|---|
| B1 caller argument + type argument, both load-bearing | ✅ (scope defect at §R3) |
| B2 restore `syntheticCollection` clause in new vocabulary | ✅ — present, and promoted to the *likeliest* invalidating event |
| B3 rewrite `doc.go` against `cc92735`, do not delete; keep "neither Dockerfile runs `go test`" | ✅ — every sub-claim verified |
| B4 anchor `skipDirs` to top level; add `.tmp-test`; *consider* asserting descent | ✅ code — guard defect at §R2 |
| B5 key the sampler by `field` | ✅ — mutation-confirmed |
| B5 coverage note: add a test passing `"collection.remote_data"` | ✅ — three new tests do |
| Canary for B4 (re-plant three, show RED/UNDECLARED with file+line+text, revert, re-confirm) | ✅ R7-02/R7-03, evidence in `_run-queue-log.md`, correctly kept out of the repo |
| Canary for B5 (collection line prints; new test fails on revert) | ✅ R7-11; independently re-confirmed as R7-REVIEW-05 |
| A1 state that the invalidating edit arms a **client-side-only** gate | ✅ — *"creating a control that only one client honours"* |
| A2 annotate both conjuncts, each naming the other, each labelled a security control | ✅ both directions |
| A3 doc overstates population — say `dist` excluded vs `//go:embed all:web/dist` | ✅ — "IT CANNOT SEE THE BYTES THE SERVER ACTUALLY SHIPS" |
| A3 say "line census", name the unit | ✅ — in `doc.go` and on `censusRemoteDataMentions`; the `break` at :331 confirms the unit |
| A3 `withRemoteDataLogClock` register its own restore | ✅ |
| Non-blocking `%s` → `%q` | ✅ |
| Non-blocking "should not happen" message + "a test would be welcome" | ✅ both |
| HELD: say in the log whether B4 makes Go-side widening easier or harder | ✅ — answered EASIER, with a warning about population size |
| A3 import asymmetry: append a warning to `ImportCollectionResponse.Warnings` **or note it in the log** | ⏸ noted in log, not shipped — **brief permits this explicitly**; reasoning given (response-payload change in a comments-and-tests round) and I agree |
| Non-blocking payload-shape / zero collection coverage: act **or note in the log** | ⚠ **PARTIAL** — see below |

**Corrected after phase two.** I first scored the last row ⏸ "noted in log". Re-reading the
log against the ask, it is half-noted. The ask has two clauses: *"the guard catches proto-shape
changes but not payload-shape changes"* **and** *"the producer test has zero collection
coverage."* The log's `Findings recorded, not acted on` → **Coverage gap, unclosed** bullet
covers the second clause in substance (no test drives a hostile collection `remote_data` through
a real writer) but never states the first — that the B11 census is blind to a Go developer who
changes the *payload* shape without touching `web/`. Instrument:
`grep -n -i 'proto-shape\|proto shape\|collection coverage\|representability'` on
`.design/project-log/2026-07-29-dev-xss-r7-fix.md` → **no output**. This is **FYI-6**, not a
blocking finding: the brief offered "note in the log" as a full escape hatch and half of it was
taken in good faith. But the unnoted half is the one that matters more, because it is the
standing limit of the guard this whole workstream leans on, and §R2 shows that guard is weaker
than advertised in a second, independent way.

Nothing the brief asked for is **absent**. Two deferrals took the escape hatch the brief itself
offered and are argued rather than skipped; one of those two is partial.

### Present and not asked for: **three, all benign; one carries a Nit.**

1. **`TestWebRemoteDataConsumersAreDeclared`'s stale-arm error message was rewritten** (header
   changed to "DO NOT MATCH AT THE DECLARED COUNT", plus a paragraph explaining that the arm
   fires in both directions). It is a genuine improvement — the old wording did send a reader
   hunting a deletion that had not happened — and I would keep it. It carries **N3** (`R6-23`).

   **Corrected after phase two: "not asked for" is wrong, and the correction is about the
   brief, not the fix leg.** `reports/review-xss-r6.md` **PT-2** asked for exactly this and
   supplied the replacement header verbatim: *"Suggested header: `DECLARED remote_data SITE(S)
   DO NOT MATCH AT THE DECLARED COUNT`."* The shipped string at
   `remotedata_consumers_test.go:422` is that string, character for character. So the fix leg
   did not free-lance; it read the source report. What actually happened is that
   **`dev-xss-r7-fix.md` dropped PT-2 on the way from the r6 reports to the r7 ask list**, and
   I then scored the delivery against the brief instead of against the reports the brief was
   summarising. That is the same defect as my commit-count error in the next section: *I read a
   population out of an artefact instead of out of the source the artefact summarises.* Two
   instances of it in one report is a pattern and I am naming it as one.
2. **`censusRemoteDataMentions`'s signature changed** to return `descended`, with both existing
   call sites updated to `found, _ :=`. Consequential to B4's "consider asserting descent"; fine.
3. **The `rel` computation moved** from the file branch up above the `IsDir` branch. Required by
   the anchoring; it is a pure move, not a behaviour change, and the now-redundant copy in the
   file branch was correctly deleted. No dead code left behind — I checked for orphans across
   the diff and found none (`remoteDataLogLast` and `remoteDataLogSuppressed` are fully removed,
   including from the test helper).

The diff contains **no** unrequested production-behaviour change. Scope discipline is good.

---

## PHASE TWO RECONCILIATION

Everything above this line was written before I opened `_r7-PHASE-TWO.md` or any r6 report.
Nothing above has been changed except the two corrections that name themselves as corrections
(the `⚠ PARTIAL` row and "Present and not asked for" item 1) and the addition of **FYI-6**.
No finding was added, removed, re-severitied or re-worded as a result of what follows.

**The brief asked for disagreement rather than consensus. I have one real disagreement (§2,
self-report 2), one place where a prior leg's finding recurs one level down and I found it
cold (PO-1 → my §R3), and one place where a prior leg's finding recurs in the fix leg's own
log and nobody has flagged it (PT-1 → §3).**

### 1. Per-finding reconciliation

Legend: **IND** = I reached the same place independently and cold. **MISSED** = I did not
reach it; I only have it because a prior report or the completeness sweep put it in front of
me. **DISAGREE** = I do not accept it as stated. **N/A** = routed off this round, and I
verified it stayed off.

#### `reports/review-xss-r6.md`

| # | r6 finding | r7 disposition (verified at `e4e3d13`) | My status |
|---|---|---|---|
| PO-1 | reachability comment names 3 collection writers, accounts for 2 | B1/B2 — rewritten | **IND, and it recurred.** §R3 is PO-1's exact shape one level down: the *replacement* argument (2) names a mechanism that discharges **one of two** `doc` producers in `ImportCollection`. I found it cold, without having read PO-1. **A round whose central defect was "n−1 of n" shipped a fix that is "n−1 of n."** That is the single most useful thing this reconciliation produced. |
| PO-2 | rewrite dropped the `syntheticCollection()` clause | B2 — restored | **IND** (completeness sweep). Restored and *promoted* to the likeliest invalidating event, which is better than the ask. |
| PO-3 | `doc.go` placement rationale false against `cc92735` | B3 — rewritten | **IND.** I re-resolved every sub-claim against `cc92735:.github/workflows/ci.yml` myself; all TRUE. |
| PO-4 | doc claims a population it does not have (`dist` / `//go:embed all:web/dist`) | A3 — stated | **IND.** Also load-bearing for §FYI-3: `dist` exists under CI and not locally, which is why the prune assertions are vacuous only locally. |
| PO-5 | "occurrence census" is a line census | A3 — renamed | **IND** — I confirmed the unit from the `break` at `remotedata_consumers_test.go:331` rather than from the prose. |
| PO-6 | `withRemoteDataLogClock` registers no cleanup | A3 — fixed | **IND** (completeness sweep). |
| PO-7 | guard catches **proto**-shape changes, not **payload**-shape; producer test has zero collection coverage | non-blocking, "note in the log" | **MISSED cold.** I reached the population half of this (§FYI-2, §R2) but never framed the proto/payload split, and I initially mis-scored the log as having noted it. Now **FYI-6**. PO-7 is, in hindsight, the most important non-blocking finding in the r6 set, and it is the one the r7 log dropped. |
| PO-8 | `issueLabels` never nil → every passthrough task's `remote_data` is dropped today | premise of B5 | **IND, and re-verified at the tip:** `graphql_queries.go:468-474` is `make([]string, len(...))`, `:486` sets `"labels"` unconditionally. `structpb` has no `[]string` case. The premise the whole B5 canary rests on is **TRUE at `e4e3d13`**, not merely inherited. |
| PT-1 | r6's project-log canary table mixed a *deletion* result into a table about *additions* | not in the r7 brief | **IND, and it recurred — see §3.** |
| PT-2 | stale-arm failure header describes an absence on a path that also fires for a surplus | not in the r7 brief; **shipped anyway** | **MISSED that it was an ask.** Shipped verbatim as PT-2 wrote it (`remotedata_consumers_test.go:422`). Correction applied above. |
| PT-3 | `ci-suite-manifest.mjs` merge blocker | explicitly "NOT YOUR PROBLEM" | **N/A, verified off.** `git log --oneline c108acb..e4e3d13 -- web/scripts/run-tests.mjs` → **no output**; `web/package.json` likewise untouched. The fix leg did not work around it. Scope discipline confirmed by measurement, not by assertion. |

#### `reports/audit-xss-r6.md`

| # | r6 finding | r7 disposition | My status |
|---|---|---|---|
| F1 | attacker-planted keys reach collection `remote_data` via import, inert only by a conjunction nobody wrote down | A2 — both conjuncts annotated | **IND on the mechanism** (my §R3 and §N4 are both inside this argument). **And here is the sting: the annotation F1 asked for is exactly the text whose line citations §R1 shows do not resolve.** Four of my five bad citations are the conjunct-A annotation; the fifth is conjunct B. The remedy for a security control that nobody wrote down is a security control written down *against line numbers that were already stale when the commit landed.* |
| F2 | replacement comment omits `ImportCollection`, the one live collection writer | B1/B2 | **IND** — verified present and correct at the tip. |
| F3 | B11's population is web-only; live Go-side consumers are invisible to it | HELD, routed upstream | **IND, second instance.** §FYI-2 (`graph_support.go:25 collectionSupportsGraph`) is an independent hit in F3's population. Phase two says it was already filed — **I confirm the filing is correct and add that it is a *functional* reader with an override semantic**, not a passive one: a `graph_queries` bool in collection `remote_data` overrides the per-platform default. |
| F4 | attacker-authored keys formatted unquoted (`%s`) into the new log line | non-blocking `%s`→`%q` | **IND** — delivered, and mutation-confirmed by me (R7-REVIEW-06 → RED on revert). |
| F5 | merge blocker | routed off | **N/A, verified off** (same evidence as PT-3). |
| F6 | import asymmetry — task URLs **error**, collection URLs **silently drop** | deferred with a log note | **IND** (completeness sweep). Deferral noted in the log with reasoning I accept: it is a response-payload change in an otherwise comments-and-tests round. `grep -n 'Warnings' internal/server/export_import.go` shows no drop-warning appended — the deferral is real, not accidentally shipped. |
| R1 | REFUTED — no import→relink escalation, because collection platform is immutable | underpins A2 conjunct A | **IND, and re-verified at `e4e3d13` because the diff now leans on it.** `grep -rn --include='*.go' 'SetPlatform(' . \| grep -v '_test.go'`: the only **non-generated** collection sites are `entstore.go:1359` (create) and `:2115` (import); `:2273` is `linkedaccount`. `CollectionUpdate.SetPlatform` exists in Ent-generated code with **no** hand-written caller. R1's refutation **holds at the tip**. This matters more now than it did at `c108acb`: conjunct A's whole force is "platform is forced to `farmtable` at import and never changes", and that sentence is now shipped as a security-control annotation. |

#### `reports/test-xss-r6.md`

| # | r6 finding | r7 disposition | My status |
|---|---|---|---|
| F1 | `skipDirs` prunes by basename at arbitrary depth | B4 — anchored to top level | **IND on the fix being correct; IND and blocking on the fix being unguarded.** §R2. F1 is the finding that produced B4; B4's guard does not guard B4. |
| F2 | sampler global, not per-field; collection canary can never fire | B5 | **IND** — mutation-confirmed (R7-REVIEW-05 → RED on revert). This is the round's best work. |
| F3 | merge blocker, confirmed by execution | routed off | **N/A, verified off.** |
| F4 | `.tmp-test` not skipped; arms on the next commit; makes `make test` non-idempotent | B4 — `.tmp-test` added to `skipDirs` | **IND** (completeness sweep). Present at `remotedata_consumers_test.go:125` and absent at `c108acb`, with a three-line comment at `:110-112` explaining that it is *not* build output in the same sense as the other five. Good change, correctly explained. |
| F5 | "should not happen" branch is reachable and its message is wrong | non-blocking | **IND** — fixed at `convert.go:449-457` and pinned by a new test; mutation-confirmed (R7-REVIEW-07 → RED). The replacement prose correctly names the real cause (`structpb.NewStruct` rejects invalid-UTF-8 **keys**; `NewValue` never inspects keys) and deliberately does **not** print the offending key, which is the right call. |
| F6 | `doc.go` executor rationale stale vs merge target | B3 | **IND** (= PO-3). |
| F7 | `EXPECTED_ASSERTIONS = 380` pins the suite total while per-file receipts go unasserted | "not this round's work" | **N/A, verified off.** `git log --oneline c108acb..e4e3d13 -- web/scripts/run-tests.mjs` → no output; the constant is still `web/scripts/run-tests.mjs:306`. |

**Summary of the reconciliation: 19 prior findings. IND 14, MISSED 2 (PO-7, and PT-2's status
as an ask), N/A-verified-off 4** — PT-3/F3 and F5 are the same merge blocker seen by two legs,
so the row count exceeds the finding count. **DISAGREE 0 on r6 findings.** My one disagreement
is with a fix-leg self-report, below.

### 2. The fix leg's three self-reports — verified, not accepted

**Self-report 1 — pre-registered 6 `=== RUN` lines, artefact has 49. Stated cause: it counted
test functions in the FILE it was editing rather than in the PACKAGE the `-run` filter
selects. — CAUSE VERIFIED, not just the discrepancy.**

The check the brief asked for is whether the stated cause produces exactly 6, because a cause
that produces "some smaller number" is a story rather than an explanation.

- `git show c108acb:internal/server/remotedata_log_test.go | grep -c '^func Test'` → **3**
- `grep -c '^func Test' internal/server/remotedata_log_test.go` at `e4e3d13` → **6**
- Package-wide top-level functions matching the filter `^TestRemoteData` → **13**, which with
  subtests yields the 49 `=== RUN` lines observed.

**6 is exactly the post-edit count of the file it was editing.** The stated cause is not a
plausible-sounding reconstruction; it is arithmetically the number. Accepted. I note that the
error is in the *harmless* direction — under-predicting `=== RUN` lines cannot hide a failure —
and that the leg caught and reported it itself.

**Self-report 2 — two compile-receipt mtimes written from expectation, each one second off
what `ls` showed. It says the receipts still hold. — I DISAGREE WITH THE FRAMING, AGREE WITH
THE CONCLUSION, AND THE DISTINCTION IS NOT PEDANTIC.**

The two receipts are in commit messages, verbatim:

- `d025390` line 49: *"Compile receipt: /tmp/r7-b5.a, 07:43:45, one second after the pre-build stamp."*
- `0420f7c` line 47: *"Compile receipt: /tmp/r7-b2.a exists at 07:44:53, pre-build stamp 07:44:52."*

`ls /tmp/r7-b5.a` in my container: **no such file.** Both artefacts are outside my container,
so **the mtimes are permanently unverifiable by me and by anyone who was not that leg** — they
are now unfalsifiable claims sitting in immutable commit messages, which is a worse end state
than the one-second error itself. That is the part I disagree with: "the receipts still hold"
treats the defect as an accuracy error when it is a **provenance** error, and provenance errors
do not heal.

**Which parts of the canary record depend on a number written in advance — the answer the brief
asked for:** only the *compilation* claims. The canary matrix rests on `=== RUN` counts and
PASS/FAIL text, which are quoted from output rather than composed. And the compilation claims
are the ones I can and did replace with my own evidence: **R7-REVIEW-01 and R7-REVIEW-02**
compiled and ran `internal/server` and `internal/webguard` at `e4e3d13` in my own tree,
pre-registered in `_run-queue-log.md` with ROOT and DIST before running. So the underlying
proposition survives — **on my receipts, not on theirs.** The correct disposition is to stop
citing the `/tmp` mtimes at all, not to defend them.

**Self-report 3 — producer count reported wrongly once, then corrected.** Verified, and it is
the same population that carries my §R3. Two legs miscounting the producers of `doc` in
`ImportCollection` — the fix leg transiently, me not at all but only because I went and
counted — is itself the argument for §R3's remedy: **name the producers in the comment, so the
next reader does not have to recount them.**

### 3. PT-1's defect class recurred in this round's own log, and nobody has flagged it

PT-1 found that r6's project-log canary table put a **deletion** result into a table whose row
axis was **additions**, so the cells were not commensurable even though each cell individually
had evidence.

The r7 log's canary matrix does the same thing in a different dimension. Cell **R7-04** is
recorded as a canary for the B4 prune, but what it mutates is the `skipDirs` **data** (the map
contents), not the **matching expression** (`rel != "." && skipDirs[rel]`) that B4 actually
changed. Every other cell in that matrix mutates the thing the fix changed. So the matrix reads
as five commensurable canaries and is four canaries plus one adjacent experiment — and the one
that is adjacent is the one covering the finding that §R2 shows is unguarded. **I found this
cold, before reading PT-1**; it is in §R2 and in the mutation table. Reporting it here because
the recurrence is the point: *the same leg, warned about non-commensurable canary tables one
round ago, shipped a non-commensurable canary table.* This is why §R2 is Required and not FYI.

### 4. The known-items list — one confirmation with the instrument it demanded, one addition

**`.gitignore:17` — CONFIRMED, using the inside-path form and with controls, as instructed.**
The brief predicted the obvious command would mislead me in my tree, and it did.

```
ROOT /workspace/farmtable-xss-r7-review, rev e4e3d13

$ git check-ignore -v web/dist
   (no output, rc=1)                     <- the misleading answer; web/dist is ABSENT on disk

$ git check-ignore -v web/dist/index.html notdist/x distant/x \
      web/src/util/dist/deep.ts web/src/build/telemetry.ts
   .gitignore:17:dist/   web/dist/index.html
   .gitignore:17:dist/   web/src/util/dist/deep.ts
   (rc=0)
```

`.gitignore` line 17 is `dist/`. **Both positive controls fire, at top level and at depth, and
both negative controls (`notdist/x`, `distant/x`) come back NOT ignored** — so the pattern is
matching the path component and not a substring. `web/src/build/telemetry.ts` is **not** ignored,
which independently explains the fix leg's observation that `git status --porcelain` showed only
**two** of its three planted canary files: the third plant was under a `dist/` path and the other
non-`dist` plant was visible all along. The finding is real, the routing is right, and the
polarity warning in the brief was accurate — I would have refuted this item on the `web/dist`
form.

*(My `git check-ignore -v web/dist` returned rc=1, not the rc=0 the brief states. rc=0 means
"at least one path is ignored"; with a single non-ignored path git returns 1. Immaterial to the
finding — the brief's substantive claim, "reports NOT IGNORED, no warning", is correct — but I
am recording the discrepancy because a reader copying the brief's exit code into a script would
build a check that never fires.)*

**`graph_support.go:22` second Go-side consumer — confirmed, with a correction to the line.**
At `e4e3d13` the doc comment begins at `:19` and the function `collectionSupportsGraph` is at
**`:25`**; `:22` is the middle of the doc comment. Same symbol, and the routing is unaffected.

**`internal/server/scopes.go` gofmt-dirty; `scripts/ci-suite-manifest.mjs`; real `main` is
`cc92735` with CI** — all three confirmed and all three left alone. The `cc92735` CI fact is
load-bearing for §FYI-3 and I resolved `.github/workflows/ci.yml` at that SHA directly rather
than taking it from the brief.

---

## WHERE THIS BRIEF WAS WRONG

Real section. Three items, in descending order of how much they cost.

1. **A COUNT ERROR I MADE, NOT ONE YOU MADE — recorded because it is the round's own defect
   class and I committed it while auditing for it.** I first wrote this section claiming
   `r7-review.md`'s "Seven commits" was wrong and that the true figure was six. **I was wrong
   and the brief is right.** `git rev-list --count c108acb..e4e3d13` → **7**. I had taken the
   count from the fix leg's project log, whose `Commits:` line lists six — because it omits
   `e4e3d13`, the project-log commit itself, which is a reasonable thing for a log entry not to
   list. **I read a count out of an artefact instead of out of the tree, and the artefact's
   population was defined differently from the one I needed.** That is precisely
   *"whoever builds a population and whoever reads the number are different agents, and the
   handoff carries the number without the population."* The brief's stats are all correct: 7
   commits ✅, 931 insertions ✅, 7 files ✅. Caught before submission only because I re-ran the
   command rather than trusting my own prose — the same discipline §R1 asks of the author.

2. **`_r7-COMMON.md`'s "WORKED EXAMPLES" rule is technically satisfied and practically
   circumvented.** The rule says examples must come from a closed workstream because *"THE MORE
   APT AN EXAMPLE IS, THE MORE IT CONTAMINATES."* `_r7-COMMON` contains no worked example, so it
   complies. But it contains two "live cautions, both self-caught here within the last hour" —
   *"A FILTER THAT MATCHES NOTHING SILENTLY PASSES EVERYTHING"* and *"A CENSUS IS AS BOUNDED AS
   ITS MOST BOUNDED INSTRUMENT."* The first of those is, almost exactly, my §R2. I cannot now
   know whether I would have run R7-REVIEW-03 without having read that line. **A caution phrased
   at the level of a mechanism contaminates the same way an example does, and it does not trip
   your own rule, which only polices things shaped like examples.** I am reporting it because
   you asked for framing errors and because it makes my headline finding weaker evidence about
   *my* independence than it looks. It does not weaken the finding itself — that is a mutation
   result, and it reproduces regardless of what prompted me to look.

3. **The build fence and the "measure the fix, not just the code" expectation are in tension,
   and the fence wins by default.** `_r7-COMMON` permits *"a single targeted `go test
   ./internal/<pkg>/ -run '^TestName' -count=1`"*. Reverting a fix to check its guard fires needs
   a **modified tree**, and `WHAT YOU MAY NOT DO` says *"Do not modify production code. Your
   independence is the deliverable."* Read literally, a reviewer cannot mutation-test anything.
   I resolved it by `cp -a`-ing to `/tmp/mut`, mutating only there, reverting each cell
   immediately, and confirming the review tree stayed clean — but I had to invent that, and a
   more literal-minded leg would simply have skipped the cells, which is precisely how R2 stayed
   invisible for a round. **Suggest the fence say so explicitly:** "reviewers may mutate a
   throwaway copy outside `/workspace`; the prohibition is on modifying the reviewed tree."
   Cheap to add, and it is the technique that produced this round's blocking finding.

**Where the brief was right and it mattered:** `r7-review.md`'s instruction to *"resolve every
load-bearing sentence against the source at `e4e3d13`"* — specifically **at `e4e3d13`**, not at
the base — is the entire reason §R1 exists. Resolving those five citations at `c108acb`, which
is the natural thing to do when you are reading a diff against `c108acb`, returns five clean
hits and I would have reported the diff as citation-accurate.

---

## WHAT I DID NOT CHECK

Real section, and the honest one.

- **I ran no wide build or suite.** No `go build ./...`, `go vet ./...`, `go test ./...`, `make
  test`, `npm test`. I hold no token and did not request one. **Compilation of every package
  other than `internal/server` and `internal/webguard` is unverified by me.** In particular
  `web/src/capabilities.ts` has still never had `tsc` or `npm test` run against it on this
  branch — the edit is comment-only and I read every line of the hunk, but that is an argument,
  not a receipt.
- **I did not verify the fix leg's canary cells R7-01 through R7-10 and R7-12 through R7-17.**
  I independently re-ran the equivalents of R7-11, R7-12 and R7-13 (as R7-REVIEW-05/06/07) and
  all three reproduced. I did **not** reproduce R7-02/R7-03 (the three-file plant), which is the
  primary evidence for B4 working at all. I took those on the artefact. If R7-02 is wrong, B4's
  correctness is unestablished and my §R2 understates the problem.
- **I did not execute the capability gate, an import end-to-end, or anything in a browser.**
  Every claim I make about `getCapabilities`, `isCollectionWritable` and the import path is
  read-and-quoted from source at `e4e3d13`, exactly the bound the EM declared for A1/A2. I did
  not run `tsc` over `capabilities.ts` to confirm the branch structure is what the text says.
- **I did not audit `sanitizeRemoteData` itself** (`urlvalidate.go:250`) beyond confirming its
  existence at the cited line and that it is a URL sanitizer rather than a key allowlist. It is
  outside the delta. The type-preservation claim argument (2) rests on — *"sanitizeRemoteData
  preserves types, so it stays that way"* — **I did not verify.** I verified the decoder half and
  the beads half (§R3); the preservation half I took on the comment. If `sanitizeRemoteData` can
  substitute a non-JSON type for a JSON one, argument (2) has a second hole and I did not find it.
  **This is the most likely place for a real defect that I missed.**
- **I did not check the `.design/project-log` entry's 306 lines claim-by-claim.** I read it in
  full and spot-checked the claims that overlap the code (the R7-04 cell description, the
  `graph_support.go` note, the `.gitignore:17` note, the producer enumeration). I did **not**
  verify the `R7-02` evidence. *(Superseded in part by phase two: I subsequently did verify
  `.gitignore:17` with the inside-path form and controls, and established that the two
  mis-transcribed mtimes are **permanently unverifiable** rather than merely unverified —
  `/tmp/r7-b5.a` and `/tmp/r7-b2.a` do not exist in my container and never will.)*
- **I did not check whether `cc92735` is still the merge target.** I confirmed the SHA resolves
  in this clone and that its workflow says what `doc.go` says it says. If `main` has moved since,
  `doc.go`'s B3 rewrite is stale again by the same mechanism it documents — and nothing would go
  red, which is the paragraph's own stated point about itself.
- **I did not review anything outside the delta**, including `graph_support.go`'s
  `graph_queries` read (FYI-2), the pre-existing `remoteDataLogNow` global's unsynchronised
  writes from tests, or `internal/server/scopes.go` being gofmt-dirty (the fix leg's note; I did
  not confirm it).
- **Concurrency:** I reasoned about the sampler's locking by reading it and did not run
  `-race`. Every access to `remoteDataLogSamplers` I could find is under `remoteDataLogMu`, but
  that is a grep-and-read result, not `go test -race`.
- **Phase two: I read the three r6 reports for their findings, not for their evidence.** I
  re-derived every r6 fact I relied on against `e4e3d13` myself (PO-8's `issueLabels`, audit-R1's
  `SetPlatform` census, PT-3/F7's untouched-file claims, the `cc92735` workflow) — but I did
  **not** re-run the r6 legs' own measurements at `c108acb`, and where a reconciliation row says
  a prior finding was correct at `c108acb` I am taking that leg's word for it. The rows that
  matter for *this* merge are all re-measured at the tip.
- **I did not reconcile against anything the r6 legs chose not to file.** Three reports'
  `WHAT I DID NOT CHECK` sections describe a union of unexamined surface that I did not
  enumerate, let alone cover. Four rounds of review on one workstream can converge on a shared
  blind spot, and nothing in this process would detect that.

---

## Summary of findings

| ID | Severity | Finding |
|---|---|---|
| **R1** | **Required** | 5 of 27 added line citations do not resolve at `e4e3d13`; all 5 point into the two files this diff edited, and were invalidated by this diff's own insertions |
| **R2** | **Required** | `TestWebCensusDescendsIntoShippedSource` passes with B4 fully reverted (measured); its doc comment claims it guards that regression |
| **R3** | **Required** | Argument (2) covers one of two `doc` producers in `ImportCollection`; the beads branch is undischarged (conclusion still true — no security defect) |
| N1 | Nit | "sole input" contradicts "ONE OF THE TWO INPUTS" in the same diff |
| N2 | Nit | "`writable` appears in Go only in comments" — 2 of 9 occurrences are string literals |
| N3 | Nit | `R6-23` cited in committed source, unresolvable inside the repository |
| N4 | Optional | `getCapabilities` pseudo-code omits two conjuncts of the real guard |
| FYI 1–6 | FYI | B4 inert on this tree; `graph_support.go` reads collection `remote_data`; prune assertions vacuous locally but not in CI; map bounded and race-free; `UseNumber` grep now self-matching; PO-7's "note it in the log" only half noted |

**REQUEST CHANGES.** R1 and R3 are comment edits. R2 is a comment edit (option 1) or a small
new unit test (option 2). None requires touching production behaviour, and the B5 change
should be preserved exactly as written.
