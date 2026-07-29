# URL Scheme Validation — Round 7 Fix Leg (B1–B5, A1–A3)

Date: 2026-07-29
Branch: `url-scheme-validation-r6`
Base: `c108acb`
Commits: `bd71af2`, `3ff66f4`, `6a48b86`, `d025390`, `0420f7c`, `6f967c7`
Verdict: `FIXED` — all five blocking findings resolved, both amendment items done,
all non-blocking items done. Not pushed.

Round six closed with three independent legs returning APPROVE WITH CONDITIONS,
REQUEST CHANGES and DO NOT MERGE AS-IS. This was the single fix leg.

## The headline, and it is not one of the five findings

> **A MUTATION MATRIX MEASURES THE DETECTOR AND ASSUMES THE CENSUS.**

Round six shipped a 2×2 table of planted mutations with execution evidence in
every cell, and concluded that the `remote_data` consumer guard "catches the
accidental addition and is blind to the deliberate one." The table was honest,
every cell was real, and the conclusion was still wrong — because **all four
plants sat in files the census already reached.** The matrix has an axis for
spelling and an axis for declared-entries. It has no axis for *the file the walk
never opens.*

A test leg found the missing axis in one move: three plain
`const rd = coll.remoteData;` consumers in `web/src/build/`,
`web/src/util/dist/` and `web/src/components/coverage/`. All three compiled,
bundled and shipped — `web/tsconfig.json` is `"include": ["src"]` — and all
three were invisible while the guard stayed green.

**That is the ACCIDENTAL case, not the deliberate one.** Nobody putting a helper
in `src/build/` is evading anything. So it did not sit inside the documented
hole; it falsified the bound the guard shipped under.

The mechanism is worth stating separately from the bug, because the bug is
one line and the mechanism is general:

> **A FILE THE WALK NEVER OPENS ADDS NO MENTION AND REMOVES NONE, SO BOTH ARMS
> OF THE GUARD ARE SILENT BY CONSTRUCTION.** The guard cannot fail in that
> direction. Reach is not something an allowlist check can assert about itself.

Which is why B4 is not just an anchoring fix. `TestWebCensusDescendsIntoShippedSource`
asserts the set of directories actually descended into, so widening `skipDirs`
is a **visible event** rather than a silent narrowing.

I reproduced the failure mode deliberately to prove that new test is not
decorative: adding `"src/util"` to `skipDirs` fails it by name, **while both
arms of the guard pass.** That pass/pass is the whole finding.

## B1/B2 — the comment that discharged two of three writers

B1 named three collection writers and discharged two. A review leg falsified the
third by type: `ImportCollection` reaches the line with data it decoded itself.
The block now says outright that **two separate arguments hold the line down and
both are load-bearing** — a caller argument for Create/Update, a type argument
for Import — and reconciles the type argument with the universal type claim that
an earlier leg *falsified*. The difference is scope, not subject, and saying so
in the comment is cheaper than the next reader rediscovering the contradiction.

B2 is where this round earned its keep, and it went through three versions.

**Version one (mine):** restore the deleted `syntheticCollection` clause as a
statement about the log line.

**Version two (the EM's amendment):** it is not a comment nit. `getCapabilities`
reads `remote_data` on exactly one branch — GITHUB — and `syntheticCollection`
is the only producer of a GitHub-platform collection object, so its nil
`RemoteData` is the **sole** reason `GITHUB_CAPABILITIES` is unreachable. The
amendment shipped with an explicit falsifier: *if you find a second producer,
A1 is wrong, tell me inside ten minutes.*

**The falsifier fired.** `CreateCollection` (`server.go:1035`) takes
`req.Platform` from any caller holding `ScopeCollectionWrite`, maps
`PLATFORM_GITHUB` through `platformFromProto` and **persists** it
(`entstore.go:1359`). The only extra condition is a non-empty `remote_id`
(`:1053`) that is never validated against GitHub. A stored, listed,
GitHub-platform collection reaches the capability gate without
`syntheticCollection` being involved.

**Version three, and the part I got wrong.** My reply said "two producers." The
EM's response was the right correction and it is the second transferable lesson
of the round:

> **A COUNT IS THE OBJECT THAT HAS BEEN WRONG ALL NIGHT. INCREMENTING A WRONG
> COUNT PRODUCES A WRONG COUNT.** Enumerate the population instead of adding to
> it.

He enumerated. The census turned up a third producer neither of us had, and it
outranks both:

```
entstore.go:2112   collCreate := tx.Collection.Create().
                       ...SetPlatform(p.Collection.Platform)
entstore.go:2116   if p.Collection.RemoteData != nil {
entstore.go:2117       collCreate.SetRemoteData(p.Collection.RemoteData) }
```

**Both inputs to the capability gate, written from the same caller-supplied
struct, three lines apart, in one statement and the branch under it.** Not two
features that would have to meet. It is held shut by two *adjacent* lines one
layer up — `export_import.go:306` rejects a non-farmtable document, `:331`
hardcodes farmtable — and **both are removed by the same single feature**:
"support importing a GitHub collection export." The `remote_data` half is
already wired from the uploaded document at `:332`, because `sanitizeRemoteData`
is a URL sanitizer and not a key allowlist: `writable` is not URL-bearing, so it
passes through untouched.

So the comment now leads with an **invariant** and contains no count at all:

> The GitHub capability set is reachable only by a collection object carrying
> platform GITHUB *and* `remote_data` containing `writable: true`, **together,
> in one object.** No producer in this tree yields both. That conjunction
> failing is the entire gate.

The producers are listed **below** the invariant, under `c108acb`, explicitly as
an as-of-this-commit observation, each with the one-line reason it cannot yield
both halves. **A list under a SHA is honest; a count in the present tense is
not** — add a producer and the count is false with nothing going red. That is
the same defect as an instrument that measures a result and assumes its
population, which is the round's headline. It showed up in the prose about the
bug as well as in the bug.

And the thing that makes any of it matter: **`writable` has no functional Go
reader.** There is no server-side notion of a read-only collection. The nine
operations `GITHUB_CAPABILITIES` unlocks are gated in the browser and nowhere
else, so whoever arms this is not enabling a feature behind an existing control
— they are creating a control a `curl` caller is not subject to.

## A2 — the two conjuncts, each now naming the other

Import copies an uploaded document's collection `remote_data` into storage with
no key validation, so a `ScopeCollectionAdmin` caller can plant any key. It is
inert only by a conjunction across two languages that nothing recorded:

- **A** — `export_import.go:306` + `:331`: imports are always farmtable-platform.
- **B** — `capabilities.ts:94`: FARMTABLE returns `ALL_ENABLED` *before* the read.

Both are annotated, each naming the other, each labelled a security control —
neither was marked as one, and either can be moved by somebody with no reason to
think they are touching security. **They are one early return seen from two
sides**, which is why they and B2 are the same commit: consulting `writable`
before the platform check arms the planted key *and* changes the GitHub path in
a single edit. No key allowlist was built; that is a separate round.

### The guard fired on my own commit, and I did not reword around it

The `capabilities.ts` annotation names the field. The census counts identifiers
in comments, so my own security comment became an undeclared mention and the run
went red.

**I could have reworded to avoid the identifier.** Trivial, invisible in review,
green. Writing prose that evades this guard in order to describe what this guard
protects is the worst option on the table, so the line is declared in the
allowlist with exactly that as its stated reason.

This is also the first time the instrument has been observed firing on an edit
nobody made in order to test it. Every previous red was a plant.

## B5 — the sampler that swallowed the line that matters

The drop-log sampler kept **one process-wide** `last`/`suppressed` pair;
`field` was a formatting parameter and never keyed the limiter.

`labels` is unconditional on the passthrough task path, so `task.remote_data`
drops **continuously** while anyone browses a passthrough collection. Any
`collection.remote_data` drop inside that minute was swallowed entirely,
suppressed-counter included. **The highest-volume, lowest-value event in the
system was silencing the one that reports on the input to the write-
authorization gate**, and it fails in the direction that hides things.

Now keyed per field. The key space is closed — `field` is only ever a literal
written in that package — so the map sizes with call sites, not with traffic,
and the comment says so rather than leaving it to be re-derived.

**Why nothing caught it: every existing test passed `"task.remote_data"`. Not
one passed `"collection.remote_data"`.** The parameter was exercised only as
formatting, for three rounds.

## Canary evidence

Every fix that is a guard was observed firing. Full pre-registrations and
artefacts in `reports/_run-queue-log.md` (scratch volume, not in this repo).

| Cell | Mutation | Predicted | Observed |
|---|---|---|---|
| R7-02 | re-plant all three deep consumers | RED, **undeclared** arm | RED at `:381`, all three files with line and text |
| R7-03 | plants removed | GREEN | GREEN 3/3 |
| R7-04 | add `src/util` to `skipDirs` | RED on the **descent** test, **both guard arms PASS** | exactly that, `:495` |
| R7-05 | mutation reverted | GREEN | GREEN 3/3 |
| R7-07 | *(not a plant — my own A2 comment)* | not predicted | RED, undeclared; declared rather than reworded |
| R7-11 | revert per-field keying | RED on `…SampledPerField` **only**; `…IsSampled` PASSES | exactly that, 1 FAIL in the package |
| R7-12 | `%q` → `%s` | RED on `…QuotesAttackerKeys` only | that, and **the forged second record is visible in the artefact** |
| R7-13 | restore "should not happen" | RED on `…IsNotAParadox` only | exactly that |
| R7-14 | all reverted | GREEN | 49 `=== RUN`, 0 FAIL |

Two cells carry more than a colour.

**R7-04's pass/pass is the point of the new test**, not a side effect: a prune
that swallows shipped source leaves both arms of the guard green, which is the
r6 miss reproduced on purpose.

**R7-11's PASS is the discriminator.** `TestRemoteDataDropLogIsSampled` passes
under the mutation because a one-field test is structurally incapable of seeing
a cross-field defect. That pass is the evidence the old suite was *blind* rather
than merely quiet.

## Does the B4 fix make Go-side widening easier or harder? — EASIER

Recorded because it was asked and the decision is above me.

**Easier, for three reasons, and one of them is a warning.**

1. `censusRemoteDataMentions` now returns the descended-directory set alongside
   the mentions, so a Go-side census gets reach-assertion for free rather than
   needing it invented a second time.
2. The prune is now anchored to a root, which is what makes the walk
   root-parameterisable at all. Basename pruning would have been actively
   dangerous over a Go tree — `internal/store/ent/build`, any vendored `dist`.
3. `TestWebCensusDescendsIntoShippedSource` is the template for the assertion a
   Go-side census would need on day one, and it exists now with a canary.

**The warning: the population is not analogous and a copy-paste widening would
be wrong.** The web side has two consumers and eight declared mentions. A Go
census over `remote_data` would return hundreds — `internal/store/ent` alone —
and an allowlist of that size is a file nobody reads, which is how a guard
becomes a rubber stamp. If this widens, it wants a different shape: the *write*
sites, or the *branch* sites, not every mention.

Also relevant to the scoping call, and found while checking the falsifier:
`graph_support.go:22` `collectionSupportsGraph` reads collection `remote_data`
key `graph_queries` and, if present and a bool, **returns it**, overriding the
per-platform default. That is functional Go code branching on an
attacker-influencable key in collection `remote_data`. It does not touch the
capability gate and it is inert for the same nil-`RemoteData` reason. It means
the *wider reading* of the security leg's "zero Go readers" result is wrong —
the measurement itself was about the identifier `writable` specifically and is
fine. Routed by the EM, not acted on here.

## Findings recorded, not acted on

- **`.gitignore:17` is `dist/`, unanchored.** Found because when I planted the
  three canary files, `git status --porcelain` showed only **two**.
  `git check-ignore -v` names line 17. Same defect class as B4 — a basename
  pattern matching at any depth — with a worse blast radius: anything under any
  `*/dist/` is invisible to `git status`, to `git add -A` and to review. The
  census caught it anyway because the census walks the **filesystem** and does
  not ask git, which is the only reason R7-02 listed all three files. Shared
  infrastructure, not in the brief, untouched.
- **Import asymmetry (INFO).** `validateImportedTaskURLs` **errors** on a bad
  URL in task `remote_data` while `sanitizeRemoteData` **silently drops** it in
  collection `remote_data`. Both fail closed, so not exploitable. The suggested
  minimum — a warning appended to `ImportCollectionResponse.Warnings` — is a
  change to a response payload rather than a comment, so it is noted here rather
  than shipped in a fix round that is otherwise comments and tests.
- **`internal/server/scopes.go` is gofmt-dirty at HEAD.** Not touched by this
  branch. Left alone.
- **Coverage gap, unclosed.** The tests here cover the proto/log shape of a
  collection `remote_data` drop. There is still no test that produces a
  collection with a hostile `remote_data` through a real writer and observes the
  wire result, because no in-tree writer populates it — the fail-closed accident
  and the coverage gap have the same cause, and closing either one changes the
  other.

## My own defects this round, in the order I made them

Recorded at full strength; a fix leg that only reports other people's errors is
not measuring itself.

1. **I pre-registered "6 `=== RUN` lines" and the run produced 49.** I counted
   test functions in the *file I was editing* rather than in the *package the
   `-run` filter actually selects* — 13 functions, several of them table tests.
   **I scoped a count to the wrong population inside the round about scoping
   counts to the wrong population.** The rule worked: 6 vs 49 is visible, and
   what it caught was my arithmetic rather than a vacuous filter.
2. **I wrote a compile-receipt timestamp from expectation, twice.** `d025390`
   and `0420f7c` each state an artefact mtime one second later than the `ls`
   actually shows. The receipts hold — the artefacts were removed before each
   build and exist with mtimes not earlier than the pre-build stamp — but the
   numbers are wrong. Once is a slip; twice is a **practice**: I composed the
   message with the receipt line already in it, then ran the build. A number
   that is nearly right is exactly the citation class this round exists to
   remove. Order of operations changed mid-round; both wrong numbers left on the
   record rather than amended out.
3. **I incremented a wrong count instead of enumerating.** See B2 above. The
   correction produced the best result of the round, and it was not mine.

## Method notes

- **Verify a build by its artefact, never by a reported exit code.** Every
  compile check here is `go build -o /tmp/<name>.a ./internal/<pkg>/` with the
  artefact removed first, a separate `date -u` before, and a separate `ls -l`
  after. No status was echoed. (Then I mis-transcribed two of the mtimes; the
  method was right and my copying was not.)
- **State the expected `=== RUN` count in advance and check the artefact ends on
  a package verdict line.** `go test` prints `ok` and exits 0 when a `-run`
  filter matches nothing.
- **Name the arm, not just the colour.** Getting RED from the wrong arm is a
  different result from getting RED. Every cell above names its arm, in the
  cell.
- **A falsifier attached to a claim, handed to someone whose job is not to
  defend it, is worth more than the claim.** A1 was true. It was not all of the
  truth, and *the true part is what stopped the search.* It only broke because
  it shipped with an explicit "here is what would kill this, tell me fast."

Full pre-registrations, artefacts and per-cell evidence:
`reports/_run-queue-log.md` on the scratch volume, section `FIX ROUND r7`.
