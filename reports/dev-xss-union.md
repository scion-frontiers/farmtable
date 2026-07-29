# XSS / URL-scheme axis — the union branch

Branch: `xss-url-scheme-union`
Tree: `/workspace/farmtable-dev-xss-r9`
Parents unioned: `url-scheme-validation-r8` @ `07f12a3`, `url-scheme-validation-r9` @ `74d9db2`, `main` @ `faf1c8c`
Author: dev-xss-r9 leg, reporting to `farmtable-em-hardening`
Date: 2026-07-29
Not pushed.

Every figure below carries the tree it was measured in, the command, and the
denominator. Three trees are used:

```
T-BRANCH  ROOT=/workspace/farmtable-dev-xss-r9   web/dist ABSENT  node_modules PRESENT
T-ARMS    ROOT=/tmp/union-arms                   web/dist ABSENT  node_modules ABSENT
T-BASE    ROOT=/tmp/union-base                   web/dist ABSENT  node_modules ABSENT
module cache: /home/scion/go/pkg/mod, PARTIAL, shared, per-agent, invisible to every tree command.
Both throwaway trees are clones from a local path, outside /workspace. Neither /workspace/farmtable
nor any other leg's tree was written to.
```

---

## 0. THE THREE THINGS TO READ IF YOU READ NOTHING ELSE

**1. ~~CI WILL FAIL ON THIS BRANCH AT `suite-manifest`~~ — WITHDRAWN, FIXED
UPSTREAM.** I found that `main`'s `ci-suite-manifest.mjs` reported **0 of 5**
web test files executed while `npm test` demonstrably ran all five, and called
it a merge-induced failure. That was **true against `faf1c8c` and false against
current main**: `edc75b6` moved main's own suite to discovery, and its analyser
understands its own runner. **My control commit predated a change to the
instrument I was measuring with.** Re-measured across three arms and resolved by
adopting main's runner in merge `bbea1e5`; the manifest now exits **0**, 5 of 5.
Sections 6 and 10. The finding was not wrong so much as *stale* — and a control
commit going stale under you is the failure mode this whole report is about.

**2. R-1's BEFORE/AFTER FIGURES ARE INVERTED. r9 REMOVED TWO BARE COUNTS AND
ADDED NONE.** The ruling says this round "ADDED TWO NEW ONES" and puts the
corpus at 3 → 5. Measured, same instrument both arms: **7 → 5** across
`901670e` → `74d9db2`. The ruling's "before" column is my *after* and its
"after" column is my *before*. The underlying finding is still real and I have
fixed it — the three surviving gate counts are now 0 — but the direction of
travel in the ruling is backwards. Section 4.

**3. SEVEN OF THE EIGHT "DIVERGENT" FILES WERE NEVER DIVERGENT.** Since the
common ancestor `901670e`, the r8 branch changed **exactly one file** — its own
project log — in all five of its commits. The other seven are r9-only additions
against an untouched r8 side. `git diff r8..r9` shows eight because that is a
diff between two tips, which conflates "they disagree" with "only one of them
moved". git raised **1** conflict, not 8. Section 3. This is the same
population error the track adopted my finding about, one level up: **a
difference count is not a disagreement count unless you name the base.**

---

## 1. WHAT THE BRANCH IS

```
$ git log --oneline --graph -8    [T-BRANCH]
```

| # | commit | what |
|---|---|---|
| 1 | `a276a51` | Merge `url-scheme-validation-r8` (`07f12a3`) — union of the r8 log |
| 2 | `45b7590` | Merge `main` (`faf1c8c`) — Makefile takes main's side wholesale |
| 3 | `78c9116` | R-1: name `GITHUB_CAPABILITIES`, never the cardinality |
| 4 | `d2cea9b` | F3: named test per conjunct — conjunct A |
| 5 | *this report + the log entry* | |

Ancestry, verified rather than assumed:

```
$ git merge-base --is-ancestor <X> HEAD          [T-BRANCH]
url-scheme-validation-r8  07f12a3   ANCESTOR OF HEAD
url-scheme-validation-r9  74d9db2   ANCESTOR OF HEAD
main                      faf1c8c   ANCESTOR OF HEAD
(old main)                cc92735   ANCESTOR OF HEAD
```

`af9ea8c` is preserved — it is an ancestor, not a rewrite. That was the reason
the rebase was cancelled and it is the reason a merge was correct: the SHA is
cited 14 times across six tracked files on this branch, **including inside the
acceptance test's runtime failure message**, the string that prints when the
guard breaks.

### 1.1 The base moved twice while I worked, and I measured it rather than took it

The ruling said *"main is now cc92735 and IS origin/main"*. When I looked, both
`main` and `origin/main` in canonical `/workspace/farmtable` were **`faf1c8c`**,
two commits ahead of `cc92735`, with `cc92735` a strict ancestor. I reported
this; the 13:52Z base update then independently confirmed `faf1c8c`. The branch
is based on `faf1c8c`. **No harm done, and the reason no harm was done is that
resolving a SHA costs one command and believing a label costs a rebuild.**

---

## 2. RULING 1 — REBASE CANCELLED, MERGE PERFORMED

Merged, not rebased. One conflict: `Makefile`. Took main's side **wholesale**,
no hand-merged hunks, per the ruling.

I verified the "superset" premise before acting on it rather than accepting it:

```
$ grep -oE '^[a-zA-Z][a-zA-Z0-9_-]*:' Makefile        [T-BRANCH, three revisions]
base (901670e)  generate build test lint web web-dev dashboard decomposer
ours (74d9db2)  generate build test test-go test-web lint web web-dev dashboard decomposer
main (faf1c8c)  generate build web-deps web web-dev test test-go test-web test-changed
                suite-manifest lint dashboard decomposer

targets in OURS but not in MAIN: (none)
```

Main is a strict superset of our target set. Result verified byte-identical:

```
$ git diff --quiet refs/legs/canonical-main -- Makefile   ->  IDENTICAL to faf1c8c:Makefile
```

**One thing is genuinely lost by taking main's side, and it is not a
duplicate.** Our Makefile carried a comment recording *why* `test` was split
into `test-go`/`test-web`: an audit found `git grep "npm test"` returned only
prose in project-log markdown, so a CI job running the obvious
`make lint && make test && make build` would still not have executed the web
guard. Main's Makefile has a different and also-good comment (the
make-prerequisite rationale) but not that one.

I did not hand-merge it back in — the ruling says not to, and it is right that
a Makefile is the wrong place to litigate. **I checked that the rationale
survives elsewhere instead of assuming it:**

```
$ grep -rl 'test-go' .design/ CLAUDE.md      [T-BRANCH]
.design/project-log/url-scheme-validation-r4-fix-round.md
CLAUDE.md                                    (lines 38 and 101)
```

It survives in two tracked places. The deletion is safe. **Had it not survived,
I would have raised it rather than let a documented audit finding evaporate
into a merge.**

---

## 3. RULING 2 — THE PER-FILE ADJUDICATION

### 3.1 The measurement the ruling's file list does not contain

```
$ git diff --numstat 901670e refs/legs/r8 -- <file>     (did the r8 SIDE move?)
$ git diff --numstat 901670e 74d9db2      -- <file>     (did the r9 SIDE move?)
                                                        [T-BRANCH]
```

| file | r8-side delta | r9-side delta | two-sided? |
|---|---|---|---|
| `.design/project-log/2026-07-29-dev-xss-r8-fix.md` | **98+/2-** | **59+/8-** | **YES** |
| `.design/project-log/2026-07-29-dev-xss-r9-fix.md` | unchanged | 182+/0- | no |
| `internal/server/export_import.go` | unchanged | 6+/2- | no |
| `internal/webguard/remotedata_consumers_test.go` | unchanged | 59+/12- | no |
| `web/scripts/run-tests.mjs` | unchanged | 10+/1- | no |
| `web/src/capabilities.test.ts` | unchanged | 256+/0- | no |
| `web/src/capabilities.ts` | unchanged | 69+/2- | no |
| `web/src/components/ft-app.ts` | unchanged | 12+/38- | no |

**Denominator: 8 files differ between the tips; 1 is a two-sided divergence.**
git agrees — the merge raised exactly one `CONFLICT`. All five r8 commits touch
only `.design/project-log/2026-07-29-dev-xss-r8-fix.md`:

```
$ git log --oneline --name-only 901670e..refs/legs/r8      [T-BRANCH]
07f12a3  .design/project-log/2026-07-29-dev-xss-r8-fix.md
978edfe  .design/project-log/2026-07-29-dev-xss-r8-fix.md
68cbf94  .design/project-log/2026-07-29-dev-xss-r8-fix.md
230b192  .design/project-log/2026-07-29-dev-xss-r8-fix.md
7621dc8  .design/project-log/2026-07-29-dev-xss-r8-fix.md
```

The instruction "do not assume r9 is a superset — it demonstrably is not" is
correct **for the log file and only for the log file**. For the six code files
r9 *is* the only side that moved, so there was no content to adjudicate between
— which is a much better position than the ruling assumed, and I would rather
say so than perform seven adjudications that had no second side.

### 3.2 Per-file adjudication, with a reason each

| # | file | decision | reason | instrument |
|---|---|---|---|---|
| 1 | `2026-07-29-dev-xss-r8-fix.md` | **UNIONED** | Only genuine conflict. Owner's ruling binds: no r8 sentence lost, contradictions kept with dated notes. §3.3 | sentence-level containment check, §3.4 |
| 2 | `2026-07-29-dev-xss-r9-fix.md` | r9 as-is | file does not exist on the r8 side | `git cat-file -e` at both tips |
| 3 | `internal/server/export_import.go` | r9, **then edited** | one-sided; then R-1 applied on top (§4) | `go build`, `go vet`, `go test ./internal/server/` |
| 4 | `internal/webguard/remotedata_consumers_test.go` | r9 as-is | one-sided. Carries the remote_data census; it went red when r9 moved the predicate and was repaired by re-filing entries, not by relaxing the guard | `go test ./internal/webguard/` → ok |
| 5 | `web/scripts/run-tests.mjs` | r9 as-is | one-sided; `EXPECTED_ASSERTIONS` 380→483 | `npm test` → 483, exact match |
| 6 | `web/src/capabilities.test.ts` | r9 as-is | one-sided, new file, 103 assertions | `npm test`; mutation, §5 |
| 7 | `web/src/capabilities.ts` | r9 as-is | one-sided; holds the lifted `isCollectionWritable` | `npm test` + `npx tsc --noEmit` |
| 8 | `web/src/components/ft-app.ts` | r9 as-is | one-sided | **`npx tsc --noEmit` (root config), NOT `npm test`** — §5.3 |

**`url-scheme-validation-r5-fix-round.md` survives, and it was never at risk.**
The ruling asked me to confirm it, noting it appeared in r8's diff against the
fork point and not in mine. It is in the **common ancestor**, identical on all
three tips — same blob, so no merge was possible or needed:

```
$ git rev-parse <tip>:.design/project-log/url-scheme-validation-r5-fix-round.md   [T-BRANCH]
901670e       102d9f3df433dd87ba756e0d26cf2a36f4661dad
refs/legs/r8  102d9f3df433dd87ba756e0d26cf2a36f4661dad
74d9db2       102d9f3df433dd87ba756e0d26cf2a36f4661dad
HEAD          24323 bytes, 447 lines
```

447 lines, matching the figure in the ruling exactly. It shows in r8's
fork-point diff and not in mine because the fork point used there is older than
`901670e`, not because either branch touched it.

### 3.3 The two contradictions in the log, and how each was resolved

Both are kept in full with a dated note, per the owner's ruling.

| contradiction | r8 side | r9 side | ruling | why |
|---|---|---|---|---|
| the F1 verdict word (2 sites) | "F1 **VERIFIED**" | "F1 **TYPECHECK-VERIFIED**" | **r9 supersedes** | r9 ran the instrument r8 lacked: behavioural revert of `af9ea8c`, red over 3 interleaved pairs. r8's original sentence is preserved verbatim in the note. r8's wording is not false about what r8 measured — it is too strong a word for it. |
| run-ledger range | cells R8-01 … **R8-19** + self-audit | cells R8-01 … **R8-15** | **r8 supersedes** | not a competing measurement — the r9 text is simply the older revision, frozen at `901670e` before r8 registered four more cells. Same fact, later reading. r9's sentence preserved. |

Everything r8-only is carried: the tree-coordinates block, the
`AND NAME THE COMMIT` paragraph, the `check-ignore` instrument warning, the
void-differential section, and **clause (f)** — which the ruling required to
stay and which is present four times by name.

Three union notes were added beyond straight concatenation, each marked
`UNION NOTE, 2026-07-29`:

- The `check-ignore` block now also records `git clean -ndx` as the instrument
  that escapes the trap it describes, and the two already-ignored directories
  as a positive control that needs no artefact manufactured.
- The clause (f) section records that r9 **inherited an absence, not an error**,
  and independently hit the same shape (mutant M4, killed by `tsc` not by the
  suite).
- The same section records that `faf1c8c` has now characterised the very
  `TestWatchTasks` red that r8's void differential was about: a lost-event race,
  ~15%/run. **r8's instinct was right and its procedure was still void.** Both
  halves matter; being right by luck is not a method.

### 3.4 How I know nothing was lost

A line-level check is the wrong instrument — it reports false misses whenever
text is rewrapped, which union editing does constantly.

```
line-level  grep -Fqx per line:      10 "missing" lines   <- ALL FALSE, rewrap artefacts
sentence-level, whitespace-normalised, blockquote markers stripped:
    r8 tip: 69 sentences checked, 0 missing
    r9 tip: 58 sentences checked, 0 missing
targeted check of all 13 load-bearing fragments incl. both superseded
    sentences and clause (f):        0 missing
"F1 VERIFIED" occurrences in the union: 2   (the preserved r8 wording)
"TYPECHECK-VERIFIED" occurrences:      2   (the live wording)
                                                          [T-BRANCH]
```

I report the false-positive count rather than deleting the first check, because
the useful part of the result is *that the cheap instrument was wrong here*.

---

## 4. RULING 3, R-1 — MEASURED, AND THE ARMS ARE SWAPPED

### 4.1 The re-measurement

Instrument and population identical on both arms:

```
$ git grep -nEi '\bnine\b' -- ':(exclude).design' ':(exclude)reports'
```

| site | at `901670e` (before r9) | at `74d9db2` (after r9) | after this commit |
|---|---|---|---|
| `internal/server/convert.go` | 2 | 2 | **0** |
| `internal/server/export_import.go` | 2 | 1 | **0** |
| `web/src/capabilities.ts` | 1 | 0 | **0** |
| `internal/server/urlvalidate_differential_test.go` | 2 | 2 | 2 *(not the gate — see below)* |
| **TOTAL** | **7** | **5** | **2** |
| **capability-gate subtotal** | **5** | **3** | **0** |

**The ruling's figures are this table with the columns swapped.** Its "before"
(convert 2, export_import 1, capabilities.ts 0 = 3) is my *after*; its "after"
(2, 2, 1 = 5) is my *before*, modulo the excluded test file. r9 **removed** two
bare counts and added none.

I want to be exact about what this does and does not overturn. **R-1's substance
was right and I have acted on it**: three bare cardinalities were still in the
gate comments, "nine" is correct today only by coincidence —
`GITHUB_CAPABILITIES` has fifteen fields of which nine are `true` — and one flag
flip makes the prose false with nothing red. What is wrong is only the claim
that this round introduced them. It inherited them.

### 4.2 What changed

All three now name `GITHUB_CAPABILITIES` and explicitly say why no number
appears, so the next editor does not helpfully re-add one.

**Also fixed, found while editing rather than by the review:** `convert.go` said
*"ft-app.ts isCollectionWritable branches on the same key."* r9 moved that
predicate to `capabilities.ts`; `ft-app.ts` now imports it. The citation was
stale. **An identifier citation is only durable while the file it names still
holds the identifier** — the same failure mode as a line number, one degree
slower.

### 4.3 The two I did not touch, and why

`urlvalidate_differential_test.go:322` and `:352` say "nine notes". Same defect
*class*, different subject: they describe test fixtures, not the capability
gate, one is historical narrative about a defect already fixed, and the test
beneath them derives its count from the fixture file rather than asserting one.
R-1's prescribed remedy — name `GITHUB_CAPABILITIES` — has no meaning there.
**Flagged rather than folded in silently**, because quietly widening a scoped
fix is how a "fix R-1" commit becomes unreviewable.

### 4.4 Verification

```
$ gofmt -l internal/server/convert.go internal/server/export_import.go   -> (empty)
$ go build ./internal/server/                                            -> EXIT=0
$ go test ./internal/server/ ./internal/webguard/ -count=1               -> ok, ok
                                                          [T-BRANCH]
```

---

## 5. RULING 3, F3 — THE CONJUNCT TESTS

### 5.1 The direct answer

> *"State explicitly whether it covers `isCollectionWritable`'s GITHUB platform
> requirement, and if not, close the gap."*

**YES. It is the first thing the file tests, and it is the arm that goes red
when `af9ea8c` is reverted.** `pinTheAf9ea8cGuard()` iterates every platform in
the enum, skips GITHUB, and asserts that a collection on that platform carrying
`{writable: true}` is **not** writable — i.e. exactly that the `writable` flag
alone is insufficient and the platform conjunct is load-bearing. It carries a
control arm asserting GITHUB + `writable:true` **is** writable, without which an
implementation returning `false` always would satisfy every assertion above it.

The revert evidence (r9, three interleaved pairs, reverted EXIT=1 3/3, fixed
EXIT=0 3/3, no split) is in `reports/dev-xss-r9-fix.md` and is quoted in the
unioned log.

### 5.2 Conjunct A — the gap that was still open, now closed

Per the addendum: conjunct A was pinned only by four unnamed lines inside
`TestRPC_ImportExportCollection_Errors` that assert a gRPC code among four other
`FailedPrecondition`s and never name the security property.

Added `internal/server/export_import_conjunct_test.go`:

- `TestConjunctA_ImportRejectsNonFarmtableCollection` — every ent platform
  constant, plus the empty string, an unknown platform, and two near-miss
  spellings of `farmtable` (`"FARMTABLE"`, `" farmtable"`). The near misses
  matter because the guard is a **string comparison, not a membership check**.
  Every document carries the planted `{"writable": true}`, so the test refuses
  the *dangerous* document, not merely an unusual one.
- `TestConjunctA_ImportAcceptsFarmtableAndStoresItAsFarmtable` — the
  anti-vacuity control, and it pins the **outcome** (the stored collection's
  platform) rather than the status code.

The old assertions are left in place: they test the RPC's error contract, which
is a different property, and deleting them would narrow coverage.

**Known gap, written into the file rather than glossed:** a *new* ent platform
constant would not be exercised. Deliberately **not** closed by asserting a
count of enum members — that is precisely the defect R-1 removed two commits
earlier, and re-introducing it inside a test would be worse than the gap.

### 5.3 THE ACCEPTANCE EVIDENCE — INTERLEAVED, AND THE FIRST TABLE WAS VOID

Schedule fixed before the first run: M-A 3 pairs / 6 runs alternating
UNGUARDED,GUARDED; M-B 1 pair / 2 runs. Both arms of every pair or neither.

```
ROOT=/tmp/union-arms  COMMIT=d2cea9b   [T-ARMS]
COMMAND=go test ./internal/server/ -run 'TestConjunctA' -count=1 -v
POPULATION=11 test runs (2 top-level + 9 subtests) -- ASSERTED ON EVERY RUN
```

**THE FIRST ATTEMPT AT THIS TABLE IS VOID AND THE REASON IS THE POINT OF THE
WHOLE TRACK.** I ran it in a clone taken before the test was committed. All
eight runs printed `ok ... [no tests to run]` and `EXIT=0` — **both arms green,
which reads as "no difference" and was really "no measurement".** My schedule
had *declared* a population of 11 and never *asserted* it. The rerun asserts the
population on every single run and voids any run that does not match. This is
the same error as `go vet ./...` over zero packages, committed by me, one hour
after I got the track to adopt the rule against it.

| run | arm | population | result |
|---|---|---|---|
| baseline | clean | 11/11 | PASS both tests, EXIT=0 |
| pair 1 | UNGUARDED | 11/11 | **FAIL**, 9 breach messages, EXIT=1 |
| pair 1 | GUARDED | 11/11 | PASS, EXIT=0 |
| pair 2 | UNGUARDED | 11/11 | **FAIL**, 9 breach messages, EXIT=1 |
| pair 2 | GUARDED | 11/11 | PASS, EXIT=0 |
| pair 3 | UNGUARDED | 11/11 | **FAIL**, 9 breach messages, EXIT=1 |
| pair 3 | GUARDED | 11/11 | PASS, EXIT=0 |
| M-B | guard rejects everything | 11/11 | **FAIL** — *control* red, rejection test still PASS, EXIT=1 |
| M-B | clean | 11/11 | PASS, EXIT=0 |

**No pair split.** Tree restored clean after every arm
(`git status --porcelain` = 0).

Pasted RED, M-A arm UNGUARDED (one of nine identical-shaped messages):

```
export_import_conjunct_test.go:109: CONJUNCT A BREACHED: ImportCollection ACCEPTED a
document declaring platform "github" while carrying remote_data map[writable:true]. An
imported collection must always be farmtable-platform; this one is not, and it arrives
carrying the exact key that unlocks GITHUB_CAPABILITIES in web/src/capabilities.ts
getCapabilities. Conjunct B alone does not hold the gate: getCapabilities returns early
WITHOUT reading remote_data only on a farmtable collection.
--- FAIL: TestConjunctA_ImportRejectsNonFarmtableCollection (0.01s)
EXIT=1
```

Pasted RED, M-B — **this is the run that proves the control is load-bearing**:

```
--- PASS: TestConjunctA_ImportRejectsNonFarmtableCollection (0.01s)      <-- still green!
export_import_conjunct_test.go:158: ANTI-VACUITY CONTROL FAILED: a farmtable-platform
import was rejected (rpc error: code = FailedPrecondition desc = import only supports
farmtable platform collections). Until this passes, the rejection test above proves
nothing: a server that refuses every import satisfies it completely.
--- FAIL: TestConjunctA_ImportAcceptsFarmtableAndStoresItAsFarmtable (0.00s)
EXIT=1
```

M-B is the interesting result: under a reject-everything server the **rejection
test passes**. Without the control, the suite would certify a dead import path
as a working security guard.

### 5.4 Which instrument was used for `ft-app.ts`

Per the addendum's track rule. Both halves re-measured in `T-BRANCH`, not
inherited:

```
$ npx tsc -p tsconfig.test.json --noEmit --listFiles | grep -c ft-app.ts   ->  0
$ npx tsc --noEmit --listFiles                        | grep -c ft-app.ts   ->  1
$ npx tsc --noEmit                                                          ->  EXIT=0
$ npm test                                                                  ->  EXIT=0,
                                                       PASS: 5 test file(s), 483 assertions
```

**`ft-app.ts` is verified by `npx tsc --noEmit` (root config), not by
`npm test`.** The test suite reaches it only as *text* — `pinTheCallSite()`
reads the file from disk and asserts the import exists and no local
re-declaration does. That is a source assertion, deliberately, and it is what
makes M3 (reinstating the private copy) red.

---

## 6. THE BLOCKER: `suite-manifest` FAILS ON THE MERGE, AND ON NEITHER PARENT

> **WITHDRAWN 2026-07-29, AFTER MERGING `7a2ad51`. FIXED UPSTREAM, NOT BY ME.**
> Everything in this section is correct **against `faf1c8c`** and obsolete
> against current main. The EM pointed out that my control commit predated a
> change to the very instrument I was measuring with; six commits
> `faf1c8c..7a2ad51` touch `scripts/ci-suite-manifest.mjs` itself, and
> `edc75b6` independently moved main's web suite to discovery
> (`node --test .tmp-test`). Main's analyser understands main's own runner.
> Three arms, re-measured:
>
> | arm | `ci-suite-manifest.mjs` |
> |---|---|
> | clean `7a2ad51` | EXIT=0 (1 of 1) |
> | branch + `7a2ad51`, **main's** runner | **EXIT=0 (5 of 5, all named)** |
> | branch + `7a2ad51`, **our** runner kept | EXIT=1 (same "cannot map") |
>
> Resolved by adopting main's runner in merge `bbea1e5`; the manifest exits **0**
> on the result. **The lesson is not that the finding was wrong — it was right
> against the commit I measured. It is that a control commit is itself a
> measurement that goes stale, and mine had gone stale under me.** See §10 for
> what adopting main's runner costs.

`main` brought `scripts/ci-suite-manifest.mjs`, wired into `.github/workflows/ci.yml`
line 85. On this branch:

```
$ node scripts/ci-suite-manifest.mjs        [T-BRANCH, commit d2cea9b]
TEST FILES PRESENT IN TREE (5): capabilities.test.ts, assertions.test.ts,
    safe-url.test.ts, url-binding-scan.test.ts, task-ready.test.ts
TEST FILES ACTUALLY EXECUTED BY `npm test` (0):  (none)
NOT EXECUTED BY ANYTHING (5):  ...all five...
COULD NOT ANALYSE (1):
  node scripts/run-tests.mjs -> cannot map 'scripts/run-tests.mjs' to a tracked test file
FAIL: the set of test files that exist and the set that run do not match.
EXIT = 1
```

The verdict is **false**. In the same tree, minutes apart, `npm test` exits 0
with `PASS: 5 test file(s), 483 assertions.` The tool cannot map a
glob-discovery runner to files and reports "runs nothing" where it means
"cannot tell". It says so itself, in its own `COULD NOT ANALYSE` section — and
then reaches the opposite conclusion in its headline anyway.

**Base arm, because "the merge caused it" is a branch-versus-base claim and
clause (f) says measure it:**

```
$ git rev-parse --short HEAD                [T-BASE]   faf1c8c
$ test -f internal/server/export_import_conjunct_test.go   NO   (true base arm)
$ node scripts/ci-suite-manifest.mjs                       EXIT = 0
  web/package.json "test" = "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js"
  TEST FILES PRESENT (1) / EXECUTED (1)
  OK: every tracked JS/TS test file is executed by `npm test`.
```

On `main` there is **one** web test file, named explicitly in `package.json`, so
the tool can resolve it. The XSS line replaced that with a glob-discovery runner
and four more test files. Neither parent is broken; the combination is. Nobody
could have seen it before the merge, which is exactly what makes it worth a
section.

**I DID NOT FIX IT.** `scripts/ci-suite-manifest.mjs` and the CI workflow are
EM-CI's, this is the JS analogue of audit F10 which you relayed to
`farmtable-em-ci`, and my standing constraint is not to touch shared
infrastructure unassigned. Two routes, both one-sided:

1. **Teach the checker the runner** (EM-CI's file) — it already names this as
   the remedy in its own failure text.
2. **Have `web/scripts/run-tests.mjs` emit its discovered file list** (the XSS
   line's file, so mine to change if you want it) and have the checker read
   that. This is better: the manifest is then produced by the thing that
   actually does the discovery, so it cannot drift from it. **Say the word and
   I will do half 2; I will not do half 1 without an assignment.**

**A first-attempt error I am reporting rather than hiding:** my first reading of
this said `EXIT=0`, because I had piped the command through `tail` and read
`tail`'s status. Same pipeline-masking defect that cost the r9 round a rerun. I
caught it, re-ran without the pipe, and got `1`.

---

## 7. FIGURE INVENTORY — every number above, tagged

| figure | value | tag | tree |
|---|---|---|---|
| files differing r8↔r9 | 8 | MEASURED | T-BRANCH |
| **two-sided divergences** | **1** | MEASURED | T-BRANCH |
| merge conflicts raised by git | 1 | MEASURED | T-BRANCH |
| r8 commits since `901670e` | 5 | MEASURED | T-BRANCH |
| files touched by those 5 commits | 1 | MEASURED | T-BRANCH |
| r5 log size / lines | 24323 B / 447 | MEASURED | T-BRANCH |
| r5 log blob identical across 3 tips | yes | MEASURED | T-BRANCH |
| sentences checked r8 / r9 | 69 / 58 | MEASURED | T-BRANCH |
| sentences missing from union | 0 / 0 | MEASURED | T-BRANCH |
| line-level false misses | 10 | MEASURED | T-BRANCH |
| "nine" corpus 901670e → 74d9db2 → now | 7 → 5 → 2 | MEASURED | T-BRANCH |
| capability-gate subtotal | 5 → 3 → **0** | MEASURED | T-BRANCH |
| `GITHUB_CAPABILITIES` fields true / total | 9 / 15 | MEASURED | T-BRANCH |
| conjunct-test population | 11 runs | MEASURED, ASSERTED PER RUN | T-ARMS |
| M-A pairs / splits | 3 / 0 | MEASURED | T-ARMS |
| M-B: rejection test under reject-everything | PASS | MEASURED | T-ARMS |
| `npm test` | 5 files, 483 assertions, EXIT=0 | MEASURED | T-BRANCH |
| `npx tsc --noEmit` | EXIT=0 | MEASURED | T-BRANCH |
| `ft-app.ts` in test config / root config | 0 / 1 | MEASURED | T-BRANCH |
| `suite-manifest` on branch | EXIT=1, 0 of 5 | MEASURED | T-BRANCH |
| `suite-manifest` on `faf1c8c` | EXIT=0, 1 of 1 | MEASURED | T-BASE |
| copylocks findings in `internal/server` | 4 | MEASURED, **NOT MINE** | T-BRANCH |
| `go build ./...` on branch | **EXIT=1**, `all:web/dist` | MEASURED | T-BRANCH |
| `go build ./...` on `faf1c8c` | **EXIT=1**, identical error | MEASURED, **PRE-EXISTING** | T-BASE |
| `gofmt -l internal/server/` | 1 — `scopes.go` | MEASURED, **NOT MINE** | T-BRANCH |
| `gofmt -l` on my 3 touched files | 0 | MEASURED | T-BRANCH |
| whole-repo `go vet ./...` | ~~not run~~ **EXIT=0, 33/33 pkgs, 0 findings** | **RE-MEASURED at `43bd206`** | T-BRANCH |
| `make test` | not run | **UNCHECKED** | — |
| CI result for this branch | not run — you push | **UNCHECKED** | — |

**`go build ./...` fails on this branch, and it fails identically on `faf1c8c`**
— `assets.go:5:12: pattern all:web/dist: no matching files found`, EM-100, with
`web/dist` absent in both trees. Measured both arms rather than assuming,
because "the merge broke the build" and "the build was already broken" look the
same from one arm. This is the embed EM-CI has a dev fixing; I did not create
`web/dist` to work around it, per the standing prohibition. The package-scoped
builds and tests that matter for my change all pass.

**`gofmt -l internal/server/` reports `scopes.go`.** Pre-existing: unformatted
at `faf1c8c` too, and untouched by every commit on this branch
(`git log faf1c8c..HEAD -- internal/server/scopes.go` is empty). My three
touched files are clean. Flagged, not fixed — it is outside the change and
"cleaning up" adjacent code is how a scoped commit stops being reviewable.

`go vet ./internal/server/` reports the four `assignment copies lock value`
findings at `server.go:1509,1619,1827,2004` — the same four you declined for
this track, at this branch's line numbers rather than main's 1500/1610/1818/1995.
Noted and moved on, as instructed.

---

## 8. ERRORS FOUND IN THE RULINGS

A deliverable, not a courtesy. In descending order of consequence.

1. **R-1's before/after is inverted.** Ruling: 3 → 5, "this round ADDED TWO".
   Measured: 7 → 5; r9 removed two and added none. The two columns are
   transposed. The underlying finding is real and is fixed. §4.1.
2. **"EIGHT files have diverged" conflates a tip-diff with a disagreement.**
   One file is two-sided; git raised one conflict. §3.1. Six of the seven
   "adjudications on content" the ruling asked for had no second side.
3. **`main` was `faf1c8c`, not `cc92735`, when the first ruling was written.**
   Both `main` and `origin/main` in canonical resolved to `faf1c8c`, two commits
   ahead. Self-corrected by the 13:52Z update; recorded because the first
   ruling's Deliverable 1 still names `cc92735`.
4. **Deliverable 1 is internally inconsistent**: "based on main `cc92735` **with
   main merged in**". A branch based on main has nothing to merge. I read the
   intent as "contains main", and delivered r9 + r8 + main merged. §1.
5. **The addendum says "4 commits later" and then lists five SHAs**
   (`7621dc8`, `230b192`, `68cbf94`, `978edfe`, `07f12a3`). Five is right.
6. **"your copy of its log is the 901670e version, 8838 bytes"** — the byte
   count is right, the label is not. `901670e`'s version is **5806** bytes;
   8838 is my *annotated* copy (901670e + r9's item-D edits). The substantive
   claim — that I inherited an absence, not an error — is correct. §3.1.
7. **Deliverable 2 asks for `reports/dev-xss-union.md` committed on the
   branch, but `reports/` has never been tracked in this repository**
   (`git ls-files reports/` → 0). Every prior report, including
   `reports/r8/dev-xss-r8.md` as cited by the r8 log, lives in
   `/scion-volumes/scratchpad/projects/farmtable/reports/`. I followed the
   explicit instruction — this file is committed in-repo — and left a pointer
   in the scratchpad. **Tell me if you want it moved**; committing reports into
   the product repo is a convention change, not a filing detail.
8. **Not an error, recorded because it would otherwise look like one:**
   `TestConjunctA_*` are new Go tests in `internal/server`, the package that
   carries the four declined copylocks findings. `go vet ./internal/server/`
   will print them on this branch. They are pre-existing and not mine.

---

## 9. MY OWN ERRORS THIS ROUND

1. **I produced an eight-run interleaved table with zero tests in it** and would
   have shipped "both arms green" as a result if I had not printed the
   population. My schedule declared 11 runs and asserted nothing. Fixed by
   asserting the population on every run and voiding any run that misses. §5.3.
   This is my own `go vet ./...`-over-zero-packages finding, committed by me,
   within the hour of the track adopting it.
2. **I read a pipeline's exit code again.** `node … | tail` reported `EXIT=0`
   for a command that exits `1`. Caught, re-run without the pipe. §6. Second
   occurrence of this exact defect in two rounds; the durable fix is to stop
   piping any command whose status I intend to report.
3. **I labelled a base arm with the SHA I wanted rather than the one I had.**
   My first base-arm run printed `COMMIT=d2cea9b (= faf1c8c, main)` — the
   checkout had silently failed because a `--shared` clone does not carry my
   `refs/legs/*` namespace, so the "base" arm was the branch arm. Caught only
   because I printed the resolved SHA next to the label. **A label that asserts
   an identity the command has already contradicted is worse than no label.**
   Re-run with the ref fetched properly; the second run also asserts the
   conjunct test file is *absent*, which is a positive check that it really is
   the base.

The pattern across all three is one thing: **I keep verifying that a command
succeeded instead of verifying that it did the work.** Exit status, a label, and
a declared plan are all things that can be perfect while nothing happened.

---

## 10. ADDENDUM, 2026-07-29 — MERGING `7a2ad51`, AND WHAT IT COSTS

Merge commit **`bbea1e5`**. `node scripts/ci-suite-manifest.mjs` on the result:
**EXIT=0**, `enumerated=5 executed=5 missing=0`, all five files named.
`scripts/ci-suite-manifest.mjs` is byte-identical to `7a2ad51` — verified with
`git diff --quiet refs/newmain HEAD -- scripts/ci-suite-manifest.mjs`. I did not
touch it and the prohibition on touching it is permanent.

Merge, not rebase, for the reason that cancelled the first rebase: `af9ea8c`'s
identity is cited inside a test's runtime failure message.

### Conflict resolution

**`web/tsconfig.test.json` — took theirs wholesale.** 4 globs against our 1,
strict superset, verified by comparing include lists.

**`web/package.json` — resolved PER HUNK, and this is the part worth reading.**

| hunk | side taken | why |
|---|---|---|
| `"test"` script | **theirs** | `node --test .tmp-test`; main's analyser understands main's own runner |
| `devDependencies` | **ours, restored** | `jsdom`, `@types/jsdom`, `@types/node` are absent from main and `web/src/util/safe-url.test.ts:11` does `import { JSDOM } from 'jsdom'` |

**A wholesale `--theirs` would have silently deleted all three dependencies, and
my trial merge did exactly that and still ran green.** It ran green because the
trial clone's `node_modules` was a symlink into a tree where jsdom was already
installed. The manifest was broken and the tests passed anyway. **A passing test
run is not evidence that a dependency manifest is complete** — the same shape as
every other finding in this report: the instrument answered a question I had not
asked.

### The cost, recorded because it should not be silent

Main's runner counts `test()` calls, not assertions:

```
main's runner : # tests 5
our runner    : PASS: 5 test file(s), 483 assertions   (absolute pin,
                and it FAILS any file that exits 0 having evaluated zero)
```

`node --test` cannot see a test body emptied of its assertions. This track has
already been bitten by exactly that class — a guard test here passed while its
own control was reverted.

**This is parity with main, not a regression against main**, which is why it did
not block the merge: main has no receipt check either, and holding a security
fix hostage to a CI improvement inverts the owner's priority. It is still a real
loss of detection power *against this branch*.

Owned by `ci-22-setup` on `fix/ci-manifest-glob-runner` — and it turns out this
is **one defect with two customers**, not a new report: em-task-state's
phase2-web-ui-r5 hits the identical wall with its own glob runner. Not mine to
build, and I am not starting it.

**The constraint EM attached to the proposal, recorded because it is a genuine
hole in my own idea:** enumeration must stay independent of the thing being
enumerated. The tree scan producing `enumerated` must never derive from the
runner's self-report; anything in the tree but absent from the runner's list is
RED. Otherwise the gate asks the thing under test to certify itself and a runner
that silently under-reports passes — **the same vacuous-pass shape the proposal
existed to prevent.** Fair catch against my own design.

`web/scripts/run-tests.mjs` is left in the tree, no longer invoked. Deleting it
would dangle live references in `src/util/assertions.ts` and
`assertions.test.ts`, which pin its receipt-prefix contract. Say the word if you
want it removed.

### Verification on the merge result, with instruments named

| check | result | instrument |
|---|---|---|
| `ci-suite-manifest.mjs` | **EXIT=0**, 5/5 | node v20.20.2 |
| `npm test` | EXIT=0, `# tests 5 / # pass 5 / # fail 0`, all 5 files named incl. `util/` + `utils/` | node v20.20.2 |
| `npx tsc --noEmit` | EXIT=0 | **the instrument for `ft-app.ts`** |
| `go test ./internal/server/ ./internal/webguard/` | ok, ok | — |
| `TestConjunctA*` | EXIT=0, **11 `=== RUN` lines**, population asserted | — |

**CAVEAT, AND IT IS NOT A SMALL ONE: every web figure above is measured under
node v20.20.2. CI pins `NODE_VERSION: '22'`** (`ci.yml:46`, same on both sides).
No node 22 binary exists in this environment, so **I cannot verify the node-22
behaviour of `node --test .tmp-test` locally** — and that is precisely the axis
main is currently red on (EM-CI, node 20 vs 22 in the web test invocation, fix
canarying as run 30460044903). Recursion into `util/` and `utils/` demonstrably
works on node 20 here. **Read my green as "green on node 20", not as "CI will
pass".** The CI result remains UNCHECKED and is the EM's to obtain.

---

## 11. ADDENDUM, 2026-07-29 — MERGING `43bd206`: TWO NEW GATES, AND ONE HELD HUNK

Merge commit **`b54c573`**. Clean merge, zero conflicts. Supersedes §6 and §10's
base; **`faf1c8c` and `7a2ad51` figures in this report are now historical and
should not be quoted as current.**

### 11.1 The `go vet` caveat that ran through this whole report is now FALSE

Everything above that says vet is unusable, aborts at zero packages, or is
UNCHECKED **was true and is no longer.** EM-CI committed `web/dist/.gitkeep`, so
`//go:embed all:web/dist` resolves in a clean tree. Re-measured at `43bd206`:

```
ROOT=/workspace/farmtable-dev-xss-r9  COMMIT=b54c573
go list ./...  ->  33 packages          (was 0 — the pattern aborted)
go vet ./...   ->  EXIT=0, ZERO findings, 33 of 33 analysed
go test ./...  ->  EXIT=0, 548 package-qualified tests over 33 packages
```

**The four declined copylock findings are GONE** — `43bd206` fixed them with
`proto.Clone` instead of `*req`. §7's row for them is historical. Not
re-reported, per the ruling, and there is nothing left to re-report.

**Denominator, precisely:** main at `43bd206` is **32 of 32**; this branch is
**33** because `internal/webguard` is an XSS-line package that main does not
have. Both numbers are correct for their own tree, which is the entire point of
carrying the population next to the figure. Verified by `comm` on the two
sorted package lists, not by subtraction.

**A positive control worth naming, because it is the inverse of every defect in
this report:** the placeholder makes an unbuilt frontend embed a *stub*, and
`WebUI()` returns `ErrWebAssetsNotBuilt` rather than serving a blank dashboard.
Absence is reported as an error instead of being read as success. That is the
habit this whole document has been arguing for, implemented in the build.

### 11.2 `go vet` now GATES — measured, passes

First time in this repository's history. **EXIT=0, 33/33, zero findings.**
Nothing surfaced that I did not expect, and nothing was fixed to make it pass.

### 11.3 Go test membership gate — PASSES, and it is asymmetric

```
executed: 548 package-qualified tests    manifest: 501 -> 503
MISSING    (expected, not executed):  0   <- this is what fails the gate
UNEXPECTED (executed, not in manifest): 45  <- ::notice:: only
```

**Adding a test does NOT fail this gate.** The workflow is deliberately
asymmetric and says why, in its own comment:

> UNEXPECTED (executed, not expected) -> REPORT ONLY. Adding a test is not a
> defect, and **forcing a manifest edit in the same commit trains people to
> regenerate the manifest reflexively — which is how a genuinely missing test
> would get rubber-stamped back to green.**

47 executed tests were absent from the manifest and **only 2 are mine**. I added
those 2 by name (501 → 503) and left the other 45 — 43 from this workstream's
earlier rounds, 2 in `internal/platform/github`. **I did not regenerate**, because
a wholesale regeneration is the exact behaviour the gate's author designed
against, and it would have silently absorbed 45 entries I have not verified.

### 11.4 THE HELD HUNK — `web/package.json` "test", CURRENTLY RED ON PURPOSE

`43bd206` narrowed the script to **one hardcoded file**:

```
"test": "... && node --test .tmp-test/utils/task-ready.test.js"
```

Correct for main, which has one web test file. **Wrong for this branch, which
has five.** The merge auto-took it, so as committed at `b54c573`:

```
node scripts/ci-suite-manifest.mjs  ->  EXIT=1
    enumerated=5  executed=1  missing=4
```

**This red is correct and is being left standing.** Four of my test files
compile and never execute — precisely the vacuous class the guard exists to
catch — and the guard catches it. A loud red beats a silent pass, and this is
the one case where the honest state of the branch is a failing check.

Per EM: hold the hunk. All three known forms are wrong, measured by EM-CI under
both binaries and independently confirmed by main's own log:

| positional form | node 20.20.2 | node 22.23.1 (CI pins 22) |
|---|---|---|
| `.tmp-test` (directory) | PASS | **FAIL**, MODULE_NOT_FOUND |
| `.tmp-test/**/*.test.js` (glob) | **FAIL**, ENOENT | PASS |
| explicit file | PASS | PASS |

Both runtimes are present in this container (`node` = v20.20.2,
`npx -p node@22 node` = v22.23.1), so this is checkable here — but I am not
resolving it. EM-CI is landing one shared runner
(`web/scripts/run-node-tests.mjs`) with a manifest branch that parses it and
reconciles set-wise, so a runner cannot claim files it did not run. Three tracks
writing three runners is the failure being avoided. I take it and re-run when it
lands.

**THE LESSON, AND IT IS THE SHARPEST ONE ON THIS AXIS:** the form at `7a2ad51`
was green in every developer container and red on the runner, and **nobody could
have seen it**, because CI pins node 22 and every agent container has node 20.
My own §10 green carried exactly this caveat — "green on node 20, not CI will
pass" — and this is what that caveat was worth. Same family as the symlinked
`node_modules` that made a broken dependency manifest pass in §10, and as the
now-retracted vet rule in §11.1: **in all three the local signal was real and
did not mean what it appeared to mean. The environment you canary in is not the
environment that judges you.**

### 11.5 Scope check

Nothing on this branch alters who is authenticated, what they may do, or how
that is decided. The conjunct-A work constrains what an *already-authorised*
`ScopeCollectionAdmin` caller may store in `remote_data`; it adds no principal,
grants nothing, and moves no authorisation decision. **Not auth architecture,
and it does not touch the owner's out-of-scope declaration.**
