# dev-xss-r8-fix — fix leg report

**Leg:** round-8 fix, XSS / URL-scheme workstream
**Tree:** `/workspace/farmtable-xss-r8` · **Branch:** `url-scheme-validation-r8`
**Base:** `e4e3d1352809428a5dfe386bb53c0b18a562332f`
**HEAD:** `230b192` (was `901670e` when §0–§6 were written; two later docs-only
commits struck a void result and recorded clause (f)).
**Not pushed.** Twelve commits, local only. Working tree clean
(`git status --porcelain -uall` empty at 10:00:28Z and again at 12:48:12Z).

*This report lives outside the tree, so unlike the in-tree project log it can
name its own HEAD without moving it. The log cannot, and says so.*

> **TREE PROVENANCE OF EVERY FIGURE IN THIS REPORT.** Added 13:31Z, **rewritten
> 13:40Z under Bulletin 20 §4, which falsified the first version.**
>
> The 13:31Z version said "a leg tree WITH NO BUILT FRONTEND" and treated that as
> the coordinate. **It was a label, not a coordinate, and it put my tree in the
> wrong bucket** — the bulletin's instruction is DECLARE THE COORDINATES, NOT THE
> LABEL, and I did the thing it warns about within ten minutes of being told not
> to. Self-classifying against a list of example states picks the nearest name;
> mine was "pristine", and my tree is not pristine.
>
> **COORDINATES, measured 13:39Z, on the three axes the bulletin names:**
>
> ```
> ROOT        /workspace/farmtable-xss-r8   (clone from local path, item 7)
> web/dist        ABSENT   (ls -> No such file or directory, entry and exit)
> node_modules    PRESENT  (web/node_modules, 81 top-level dirs, since 09:56:04Z)
> module cache    WARM     (GOMODCACHE=/home/scion/go/pkg/mod, 11 entries)
> GOCACHE         /home/scion/.cache/go-build   (outside /workspace)
> ```
>
> **That is `web/dist:absent × node_modules:present × cache:warm` — Go-pristine,
> web-built.** It is the same state `dev-xss-r9` reported, and per Bulletin 20 it
> is probably the most common state on this host, because every leg tree enters
> it the moment it runs `npm install`. It is **not** the main working copy
> (~4,108 built frontend files since 27 July) and **not** the CI runner.
>
> **THE WARM CACHE IS LOAD-BEARING AND I CAN CORROBORATE IT FROM THE OUTPUT.**
> Bulletin 20 §3 shows a partial module cache under `GOPROXY=off` failing
> *every* test-bearing package with an indistinguishable `setup failed` line.
> My runs recorded **exactly 4 setup-failed** (ledger R8-18, R8-19), which is the
> web/dist signature and not the cold-cache one. Had my cache been partial I
> would have reported ~31 and read it as EM-100.
>
> This matters most for §7. **The word "repo-wide" in the EM-100 finding was
> unqualified; it is corrected in place there and the EM has withdrawn it.**

---

## 0. READ THIS FIRST — THE THREE THINGS THAT MATTER

1. **F1 IS VERIFIED.** *(Updated after the EM granted a build token at 09:55Z;
   the body of this report still reads UNVERIFIED in places written before that
   — §6 is the authoritative statement and supersedes them.)* Typecheck green,
   **coverage proven**, and a **near-miss RED arm at the exact changed line**.
   Token handed back. See §6.

2. **THE EM'S "FIVE STALE CITATIONS" WAS AN UNDERCOUNT BY MORE THAN HALF.** The
   real population was 47 citations, of which **12 were demonstrably stale**. See
   §2 item 1.

3. **NEITHER HALF OF THE ROUND'S CENTRAL SECURITY ARGUMENT IS PINNED WHERE IT
   MATTERS MOST.** Conjunct A is pinned but anonymously; conjunct B has zero
   test coverage, and F1 changed conjunct B. See §3, finding OP-1. This is the
   most useful thing in this report and it was not on the checklist.

---

## 1. THE FIVE ITEMS — STATUS

| # | item | commit | verified? |
|---|---|---|---|
| 1 | re-anchor stale citations | `d739c06`, `4026dca` | YES — each re-anchoring resolved by identifier and re-read |
| 2 | B4 guard is inert | `6a0b8bd` | YES — red-on-revert, with a blindness discriminator |
| 3 | drop the producer count | `253ab14` | YES — webguard green, guard caught my own edit first |
| 4 | `doc.go` "TWO LIMITS" is false | `3961f30` | YES — word gone, third limit written |
| 5 | audit's seven conditions, F1 first | `af9ea8c`, `5e8b826` | **F1 VERIFIED (§6 — typecheck + coverage + near-miss RED); conditions 5 and 6b ROUTED AWAY, still open** |

Ten commits total; the five beyond the five items are item 1 spillover,
condition 6(a), the project log, and two corrections to that log — all explained
below. The log corrections are follow-up commits rather than amends, for the
reason the log itself states: a record rewritten to look right the first time is
worse than one that shows its own correction.

---

## 2. ITEM BY ITEM, WITH THE MEASUREMENTS

### Item 1 — citations. THE BRIEF'S NUMBER WAS WRONG AND HERE IS THE RIGHT ONE.

    CITATIONS IN THE ROUND'S FILES
    ENUMERATED 47 = FLAGGED 12 + EXCLUDED 35

Instrument: a Python enumerator (`/tmp/r8-work/enumerate.py`), not grep.

**Why the population grew from the audit's 27 to 47, and why that matters.** The
audit's instrument was a regex over the diff and it says so, and bounds itself
honestly. It cannot see (a) bare `:NNN` self-references, or (b) citations to
extensionless targets such as `Dockerfile:9`. I wrote an enumerator that resolves
both, and the population went 27 → 47 and the stale count 5 → 12. **The audit's
number was not careless; it was the honest output of a narrower instrument. That
is the whole theme of this round and it recurred three more times below.**

Three further citations were re-anchored that were not stale, making 15 changed.

**MY OWN POPULATION BOUNDARY WAS ALSO WRONG, and I am flagging it rather than
burying it.** I initially scoped item 1 to production files and excluded
`_test.go`. That missed a stale `export_import.go:306` sitting inside an
allowlist `reason` string in `remotedata_consumers_test.go`. Prose in a test
file is still prose. Fixed; disclosed in `d739c06`'s message.

### Item 2 — the inert guard. SOLVED THE EXPENSIVE WAY ON PURPOSE.

Added `TestWebCensusAnchoringIsTopLevelOnly`, using `t.TempDir()` fixture roots so
that top-level-only pruning and substring pruning become *distinguishable* — which
they were not before, which is why the old guard was inert.

Two mutation cells, both against throwaway copies outside `/workspace` under
OP-1(h), and **they are only worth anything as a pair**:

| cell | mutation | test | result |
|---|---|---|---|
| R8-03 | revert the anchoring | **NEW** test | **RED** |
| R8-04 | *same* mutation, same tree, same invocation | **OLD** test | **GREEN** |

R8-04 is the point. The new guard is not merely red — it is red **exactly where
the existing one is blind**. R8-05 was the apparatus control: the pristine copy
is byte-identical but for one hunk (`325c325`) and is green, so the red is caused
by the mutation and not by the copying.

**COPIES RETAINED PER THE DURABILITY FREEZE**, disposition yours:
`/tmp/r8-mutation/{pristine,mutated,pristine-v2,mutated-v2}`.

### Item 3 — the producer count. AND A FALSIFIED PREDICTION OF MINE.

Count removed; the invariant is now stated as a **conjunction** (platform GITHUB
*and* `writable=true`, in one object), with producers listed below it under a SHA
as an as-of-that-commit observation.

**I PREDICTED GREEN 4/4 FOR R8-02 AND IT WENT RED.** The red was
`src/capabilities.ts:112` — a comment line **I had just written** for this very
item. The guard caught the leg sent to service the guard, on the first run after
the change. **The guard was right and I was wrong.** Closed via one allowlist
entry with a reason, which is the route the guard's own failure message
prescribes for a reworded comment; not a category, and not a rewording that dodges
the identifier.

**`grep -rn 'two producers'` CANNOT DISCRIMINATE THIS DEFECT, AND THIS IS A TRAP
FOR THE VERIFYING LEG.** A prohibition must quote the phrase it forbids. Before:
1 prohibiting occurrence + 1 committing occurrence = 2. After: 2 prohibiting + 0
committing = 2. **The count is 2 either way, forever.** The discriminator is
`grep -rn -B1 'two producers'` and reading the composition. If a later leg
verifies item 3 by count alone it will get the right number for the wrong reason.

### Item 4 — `doc.go`.

"TWO LIMITS ON THE CENSUS" → "LIMITS ON THE CENSUS", the list made open, and the
third limit (proto-shape vs payload-shape) written down. This also discharges
audit condition 7 by the first of its two offered routes.

### Item 5 — the seven conditions.

| cond | subject | status |
|---|---|---|
| 1 | five broken citations | **DONE** — 12 found, 15 re-anchored |
| 2 | second reader's weaker predicate | **DONE by MAKING IT MATCH** (F1), the stronger of the two offered routes |
| 3 | browser-only caveat in both files | **DONE** (`af9ea8c`) |
| 4 | delete "the two producers" | **DONE** (`253ab14`) |
| 5 | raise `canEditRelationships` | **NOT DONE — ROUTED AWAY (F2). See below.** |
| 6a | `convert.go` distinguishes planted key from `writable` | **DONE** (`5e8b826`) |
| 6b | note in `graph_routing.go` | **NOT DONE — ROUTED AWAY (F9).** File untouched. |
| 7 | the unanswered non-blocking item | **DONE** (`3961f30`) |

**A GENUINE CONFLICT IN MY INSTRUCTIONS, FLAGGED RATHER THAN SILENTLY RESOLVED.**
The brief tells me to work the seven conditions AND tells me F2 and F9 are routed
away, "do not fix, do not scope". Conditions 5 and 6b *are* F2 and F9. I obeyed
the routing, because a prohibition on touching a file is more specific than an
inherited checklist. **Conditions 5 and 6b are therefore OPEN and belong to
whoever holds F2 and F9.** They are not done and I am not claiming them.

**I did split condition 6.** Its second half is a note in `graph_routing.go` —
routed. Its first half is in `convert.go`, a file already in my diff, so I did it.
That required a census:

    COLLECTION-SCOPE remote_data READERS IN GO
    ENUMERATED 8 = FLAGGED 1 + EXCLUDED 7

    instrument: grep -rn 'RemoteData\[' --include='*.go' internal/ | grep -v _test.go
                then resolve each receiver's TYPE, which grep cannot do

    FLAGGED 1 — reads a COLLECTION's map:
      collectionSupportsGraph (internal/server/graph_support.go), key graph_queries
    EXCLUDED 7 — read a TASK's map, or write a params struct and never read it:
      taskToProto ×3 (platform, remote_id, remote_url); BeadsAdapter and
      GitHubAdapter buildRemoteIDIndex (remote_id each); UpdateTask ×2 (writes only)

**The result:** `writable` has no functional Go reader, but collection
`remote_data` *does*, and a planted `graph_queries` **is** consulted in Go. So the
r7 phrasing "the FARMTABLE path never consults the planted key" — a claim about
*every* key — was false as a universal. It now reads "the planted **WRITABLE**
key" and names its own counterexample.

**I VERIFIED THE PREMISE RATHER THAN INHERITING IT.** The comments assert import
does "no key validation". `sanitizeRemoteData` (`urlvalidate.go`) keeps every key
and only sanitises values under URL-bearing keys. **Claim checked and true**:
`writable` and `graph_queries` both pass through untouched.

---

## 3. THE OPEN, UNSCOPED PASS

Run as a first-class pass, not as a checklist leftover. **It produced the most
important finding in this report.**

### OP-1 — [HIGH VALUE, NOT A VULNERABILITY] THE TWO-CONJUNCT ARGUMENT IS ASYMMETRICALLY PINNED, AND THE UNPINNED HALF IS THE ONE THIS ROUND JUST CHANGED

| conjunct | what it is | test coverage |
|---|---|---|
| A — Go, `ImportCollection` platform guard | **real server-side enforcement** | **PINNED, but anonymously** |
| B — browser, `getCapabilities` + `isCollectionWritable` | **not enforcement at all** | **ZERO** |

Receipts:

```
$ grep -rln "getCapabilities\|isCollectionWritable" src --include='*.test.ts'
(no output)
$ grep -rln "getCapabilities\|isCollectionWritable" src --include='*.ts' | grep -v test
src/components/ft-app.ts
src/capabilities.ts
```

**ZERO test files reference either reader.** Two rounds of review and five items
of documentation have been spent on the accuracy of the prose describing conjunct
B, and there is not one test on the behaviour that prose describes. **The arming
edits the comments warn about in capital letters would not turn anything red.**
F1 — this round's only behavioural change — landed in exactly this uncovered half.

**AND A RETRACTION, WHICH IS ITSELF THE FINDING'S BEST ILLUSTRATION.** I first
wrote that conjunct A was unpinned too, on the strength of grepping test files for
the guard's error string. **That was false and I struck it.**
`TestRPC_ImportExportCollection_Errors` sets `collection.platform = "github"` on
an import document and asserts `codes.FailedPrecondition` — precisely the guard's
false branch. Verified green (cell R8-10). The test asserts the *code*, never the
*string*, so my grep found nothing and I briefly read absence-of-match as
absence-of-coverage. **That is the same grep-is-not-an-oracle error as the "two
producers" count, made by me, in the pass whose job was to find it.** I caught it
by opening the file before writing the claim down.

Corrected and weaker, the finding still stands: conjunct A's coverage is **real
but anonymous** — four unnamed lines inside a grab-bag error test whose name ties
it to nothing in the security argument. Anyone auditing "is conjunct A pinned?"
by search concludes it is not, as I did.

**Recommended, NOT DONE, because it would widen a round the brief bounds to five
items:** one named test per conjunct.

### OP-2 — [MEDIUM] SEVENTEEN LINE-NUMBER CITATIONS SURVIVE IN FILES WHOSE OWN PROSE FORBIDS THEM

    PATH-BEARING LINE CITATIONS REMAINING AT HEAD, IN THE ROUND'S SIX FILES
    ENUMERATED 17 = FLAGGED 0 + EXCLUDED 17     (criterion: staleness — item 1's)
    ENUMERATED 17 = FLAGGED 17 + EXCLUDED 0     (criterion: cite-by-identifier — the prose's)

`convert.go` 15, `doc.go` 1, `remotedata_consumers_test.go` 1. **I resolved all
seventeen and every one is correct today.**

**THE TWO CENSUSES ARE OF THE SAME POPULATION AND THEY DISAGREE BECAUSE THE
CRITERION DISAGREES.** Item 1 was scoped to citations that had *gone stale*. But
`convert.go` now contains, in its own voice, the sentence that a line number in a
cross-file citation is stale from the commit that writes it — and fifteen line
numbers. **The prose and the practice contradict each other inside one file.**

I re-anchored two of the seventeen (`4026dca`) because they sat in a block
condition 6(a) had already opened, and left the other fifteen. That is an
inconsistency and I would rather name it than pretend to a policy. Re-anchoring
all fifteen is a round of its own and needs your call, not mine at the end of a
bounded one.

### OP-3 — [LOW, PRE-EXISTING, NOT MINE] `internal/server/scopes.go` IS UNFORMATTED

`gofmt -l internal/server/` prints it. Const-block alignment only. **Pre-existing
and outside my diff**, established three ways: absent from `git diff --name-only
e4e3d13..HEAD`; clean in `git status`; and already unformatted at base `e4e3d13`,
verified by extracting the file at that commit and running `gofmt` on it. **Not
fixed — fixing it would widen the round.** Routing is yours.

This also **falsified my pre-registered cell R8-07**, and the error is worth more
than the finding: I wrote a *whole-directory* command and predicted an outcome for
*my own diff*. The cell I should have written was
`gofmt -l $(git diff --name-only e4e3d13..HEAD -- '*.go')`. Scoped correctly it is
green. I logged the mis-scoped cell rather than replacing it, because replacing it
would hide that the error happened.

### OP-4 — [METHODOLOGY, LIVE] THE `zsh` GLOB HAZARD IN `_BRIEF-RULES.md` §32.2 FIRED AGAIN, ON ME

`grep -rn ... --include=*.go` **did not run at all** — zsh tried to glob `*.go`,
found no match in the cwd, and aborted the command with "no matches found". **A
silently empty result from a command that never executed is indistinguishable
from a clean census unless you check.** This is the exact recorded
`audit-194-r11.md` failure mode. Fixed by quoting every glob. Separately, zsh does
**not** word-split unquoted `$spec`, which broke a `for` loop over "file line"
pairs; I moved that work to Python.

**Both are the same class as OP-1's retraction and item 3's grep trap: the
instrument answered a narrower question than the one asked.** Four instances in
one small round.

### OP-5 — [INFO] `web/dist` ABSENT

Confirmed absent. Known as EM-100, pre-existing, repo-wide. Noted only so the
record shows it was observed and not stumbled into; no token spent on it.

### OP-6 — [LOW] THE r7 PROJECT LOG OVERSTATES ITS OWN COMPLETION

The audit noted the r7 log says "all non-blocking items done" when one was not.
That log is a durable record of a closed round; **I have not edited it.** The r8
in-tree log entry records the correction instead. It also carries stale citations
of its own, for the same reason every other artefact in this round did.

---

## 4. VERIFICATION LEDGER — WHAT WAS AND WAS NOT RUN

**NO BUILD TOKEN WAS USED FOR ANY CELL IN THIS TABLE** (R8-01 … R8-10). Every one
is OP-1(b)-shaped single-package, or OP-1(h) mutation work against throwaway
copies outside `/workspace`. All were pre-registered in
`reports/_run-queue-log.md` **before** running, with ROOT and DIST columns
including on passing lines. **A token was later granted and spent on
R8-11 … R8-15 — see §6, which is a separate session.**

| cell | predicted | observed | |
|---|---|---|---|
| R8-01 … R8-05 | see log | as predicted except R8-02 | R8-02 **FALSIFIED** (see item 3) |
| R8-06 | GREEN 4/4 | GREEN 4/4 | ✓ |
| R8-07 | empty | `internal/server/scopes.go` | **FALSIFIED** (OP-3) |
| R8-08 pre-fix | **RED**, 1 of 4, one named line | exactly that | ✓ predicted red |
| R8-08 post-fix | GREEN 4/4 | GREEN 4/4 | ✓ |
| R8-09 | empty | empty | ✓ |
| R8-10 | GREEN 1/1 | GREEN 1/1 | ✓ retracts an OP-1 claim |

**THREE OF MY OWN PREDICTIONS WERE FALSIFIED THIS ROUND** (R8-02, R8-07, and the
un-numbered conjunct-A claim). All three are recorded as falsifications with
receipts rather than quietly rescoped.

**NOT RUN AT ANY POINT IN THIS LEG, INCLUDING THE TOKEN SESSION:**
`go build ./...`, `go vet ./...`, `go test ./...`, `make test`. The Go side of
this branch has been exercised only per-package (`internal/webguard`,
`internal/server` with a single `-run` filter). **A whole-tree Go build is still
owed by somebody and it is not in this report.**

**RUN LATER, UNDER THE GRANTED TOKEN:** `npx tsc --noEmit` and `npm test` — §6.

What I could establish for F1 *before* the token, recorded because it shows how
little static reading is worth against a compiler: `Platform` imported in
`ft-app.ts`, `Platform.GITHUB` present in `gen/types.ts`, the same comparison form
used twice already in the file. All three were true, all three were consistent
with the code being wrong, and none of them is what verified F1.

---

## 5. WHAT I DID NOT TOUCH

`canEditRelationships` (F2) · `EntStore.UpdateCollection` producer-census omission
(F7) · `graph_routing.go` (F9) · `internal/server/scopes.go` (OP-3) · the r7
project log (OP-6) · the fifteen remaining line citations (OP-2).

**Not pushed.** No deletions of any kind; the durability freeze was observed,
including for scratch I created myself. Every commit used
`git commit --only <explicit paths>`; no `-A`, no `-a`, no `.`, no globs, no
directories, no stash.

---

## 6. BUILD TOKEN SESSION — F1 VERDICT: **VERIFIED**

Token granted 09:55Z for this tree only; **handed back on completion**. Full
receipts in `reports/_run-queue-log.md`, cells R8-11 … R8-15. This section
supersedes every earlier "F1 is UNVERIFIED" statement above.

### THE TOKEN WAS NEARLY SPENT ON THE WRONG INSTRUMENT — BY BOTH OF US

I asked for `npm test`. The EM refused that framing, saying `npm test` runs
Vitest, which strips types via esbuild and cannot answer F1. **The EM's stated
reason was factually wrong: there is no Vitest in this package and `npm test`
does chain `tsc`.** Pasted, per rule 26:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "test": "rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit"
}
```

The instruction said that if `test` already chains `tsc` I should say so and skip
the separate typecheck. **I did not skip it, and skipping it would have been
wrong** — because the EM's *conclusion* was right for a reason neither of us had
identified:

```json
// tsconfig.test.json
{ "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": ".tmp-test" },
  "include": ["src/**/*.test.ts"] }
```

**The test config includes only test files.** TypeScript reaches a non-test file
only by import, and OP-1 established that no test imports `ft-app.ts`. Measured,
not argued:

```
$ npx tsc -p tsconfig.test.json --noEmit --listFiles | grep -c ft-app.ts
0
$ npx tsc --noEmit --listFiles | grep -c ft-app.ts
1
```

**`npm test` never typechecks F1.** A green `npm test` would have been precisely
the false assurance the EM was guarding against. **My request would have bought a
green that measured nothing, and the EM's own reasoning would not have caught
why.** Two wrong models, one correct decision.

This also sharpens OP-1: the file with no test coverage is the same file the
test-time typechecker never loads. **The uncovered conjunct is uncovered twice.**

### THE EVIDENCE, BOTH ARMS

| step | command | result |
|---|---|---|
| typecheck | `npx tsc --noEmit` | **exit 0**, no output |
| coverage | `npx tsc --noEmit --listFiles \| grep ft-app.ts` | file present, 406 files loaded |
| **near-miss RED** | same, with `Platform.GITHUB` → `Platform.GITHUB_DELIBERATE_TYPO` | **exit 2** |
| restore | `cp` from out-of-repo backup, re-run | **exit 0**, sha256 match |
| suite | `npm test` | **exit 0**, `PASS: 4 test file(s), 380 assertions.` |

The red arm, verbatim:

```
src/components/ft-app.ts(278,36): error TS2339: Property 'GITHUB_DELIBERATE_TYPO' does not exist on type 'typeof Platform'.
```

**Line 278, column 36 is the `Platform.GITHUB` comparison that F1 added.** The
error was planted on the changed line itself, not somewhere convenient, so the
control excludes not just "tsc never opened the file" but "tsc opened it and is
blind at the site of the change". `--listFiles` alone could not have excluded the
second. **Only the red arm proves the checker is doing work.**

Restored by `cp` from `/tmp/r8-work/ft-app.ts.PRISTINE-BACKUP`, taken outside the
repo before any mutation. **`git checkout` was not used.** Restoration verified by
hash: `fb6f7772…2666ce` on both sides.

### THE dist BLINDNESS HAZARD DID NOT FIRE — A MEASURED NON-EVENT

> **BULLETIN 20.1 §1 CONFIRMS THIS SECTION AND EXPLAINS WHY THE INSTRUMENT I
> AVOIDED WOULD HAVE MISLED ME.** `dist/` has a **trailing slash, so it matches
> directories only**, and `git check-ignore` consults the disk rather than a
> hypothetical. In a tree where `web/dist` is absent it exits **1** — "not
> ignored" — and that answer is *wrong about what happens when you build*. Once
> a real build creates the directory, everything under it is ignored and
> **nothing is stageable, so the feared item-4 collision does not exist.**
>
> **THIS IS THE ROUND'S OWN RECURRING DEFECT IN A NEW DRESS: an instrument that
> is only available in the state where its answer does not matter, and
> unavailable in the state where it does.** It is the same shape as
> grep-is-not-an-oracle, which cost this leg four errors — the instrument
> answers a narrower question than the one asked. I checked with `ls` rather
> than `check-ignore` here, but for the item-10 reason (do not write into the
> tree), not because I had seen the polarity trap. **Accidental compliance
> again.** A later leg should not read my clean result as evidence I had the
> right model.
>
> One consequence worth keeping: commit-addressed evidence is immune for the
> **content** of `.gitignore` and *not* for the **behaviour** of a command that
> reads it. `git show` settles line 17; it settles nothing about what
> `check-ignore` will answer.

`.gitignore:17` is `dist/`, unanchored **at the left**, so it does match at any
depth — but it is directory-only, so it matches nothing until a build exists.
`git status` would indeed be blind under a real `web/dist/`. **But `npm test`
does not build** — only `npm run build` runs `vite build`, and I did not run it.
Checked without git: `web/dist` **ABSENT at entry, ABSENT at exit**. EM-100
stands,
unmasked. npm created `web/node_modules` and `web/.tmp-test`, both confirmed
ignored via `git check-ignore -v`, **neither deleted**, per the freeze.

### VERIFICATION COMMANDS ARE WRITES

I am not certifying this tree read-only. Four logged invocations, each of which
created/renamed `index.lock` and ticked the `.git` mtime:

| UTC | tree | command |
|---|---|---|
| 09:57:29Z | `/workspace/farmtable-xss-r8` | `git status --porcelain -uall` |
| 09:57:29Z | `/workspace/farmtable-xss-r8` | `git diff HEAD --stat` |
| 09:57:29Z | `/workspace/farmtable-xss-r8` | `git diff af9ea8c --stat` |
| 09:57:37Z | `/workspace/farmtable-xss-r8` | `git check-ignore -v web/.tmp-test web/node_modules web/dist` |

Earlier cells ran further `git status` invocations predating the instruction to
log them. Those timestamps are not reconstructable and **I am not inventing any.**

**Exit state:** `git status --porcelain -uall` EMPTY, `git diff HEAD` EMPTY.
`git diff af9ea8c` shows the three commits made after af9ea8c — it was HEAD when I
sent the token request and is no longer; `git diff HEAD` is the cleanliness test.

### VERDICT

**F1: VERIFIED.** Typecheck green + coverage proven + near-miss RED at the exact
changed line + restoration hash-confirmed + suite green. Not "VERIFIED on step 3
alone" — step 3 is the weakest evidence here and on its own proves nothing about
F1.

**`internal/server/scopes.go` remains untouched** (OP-3), per instruction. The
falsified prediction R8-07 stays logged as a falsification and has not been
rescoped.

**TOKEN HANDED BACK.**

---

## 7. POST-RATIONING — THE OWED GO BUILD, NOW RUN. **EM-100 IS A HARD BLOCKER.**

Rationing lifted 12:33Z. §4 recorded that no whole-tree Go build had happened and
that somebody owed it. **I closed it myself** — my tree, my commits, cheap.
Cells R8-16 … R8-19. It changes what EM-100 costs.

### `go build ./...` AND `go vet ./...` BOTH EXIT 1, ON EM-100 ALONE

```
$ go build ./...
assets.go:5:12: pattern all:web/dist: no matching files found
EXIT: 1
```

`go vet ./...`: byte-identical error, same exit. `go test ./...`: four packages
cannot be built at all — the root package, `cmd/farmtable-server`, `cmd/ft`,
`internal/cli`, all `[setup failed]`.

> **BULLETIN 20 §1–§2 SHARPENS THIS, AND IN THIS ONE INSTANCE MY FIGURE SURVIVED
> INTACT. THE ABORT IS A PROPERTY OF THE VERB, NOT THE TREE.** `go list`, `go
> vet` and `go build` abort pattern expansion at exit 1 with **zero** packages
> analysed. **`go test` does not** — it expands fully to all 32 packages and
> marks **exactly four** setup-failed, the four that embed `all:web/dist`. My
> R8-18/R8-19 cells recorded exactly those four and named them, matching the
> EM's independent probe at `cc92735`.
>
> **THE CONSEQUENCE IS THAT 28 PACKAGES RAN AND THEIR RESULTS ARE VALID**, which
> is what licenses the `internal/server` observation below — `internal/server` is
> **not** among the four. Reading the zero-packages claim as a universal would
> have discarded that whole dataset. `ts-diff-r8` made this point first and
> loudly.
>
> **RESIDUAL, NOW CLOSED — AND MY HYPOTHESIS ABOUT IT WAS WRONG.** I flagged the
> EM's `ok=8` against my `ok=9` and guessed that "my branch adds a test file to a
> package that had none, moving one package from `no test files` to `ok`",
> keeping the total at 32. **Bulletin 20.1 §2 settles it and my guess is
> falsified on both halves.**
>
> ```
> EM,   cc92735      32 pkgs = 4 setup-failed + 8 ok + 20 no-test-files
> r8 lineage         33 pkgs = 4 setup-failed + 9 ok + 20 no-test-files
> ```
>
> The delta is **a whole additional package, `internal/webguard`** — not a
> package changing bucket. `no-test-files` stays at 20, which is exactly the
> column my hypothesis required to *drop* to 19. **The arithmetic that falsifies
> me was printed in the bulletin and I could have checked it against my own cell
> instead of guessing.** I flagged the discrepancy honestly and then offered a
> mechanism I had not tested; the flag was worth something and the guess was not.
>
> **AND IT IS NOT MY PACKAGE.** `internal/webguard` was created by `7cee4a6`
> ("B11: pin the web tree's remote_data consumers as a named allowlist"), which
> is an earlier r8-round commit and is **already present at my base**:
>
> ```
> $ git ls-tree -r --name-only e4e3d13 -- internal/webguard
> internal/webguard/doc.go
> internal/webguard/remotedata_consumers_test.go
> ```
>
> So the +1 is r8-round work but not this leg's diff. My commits modify both
> files; they create neither. The bulletin's "which the r8 round added" is right
> at round granularity and should not be read as crediting these fourteen
> commits.

`assets.go` sits at the repo root with `//go:embed all:web/dist` and **is not in
my diff** (`git diff --name-only e4e3d13..HEAD | grep -c assets.go` → 0).

**EM-100 HAS BEEN CARRIED AS AN ABSENT DIRECTORY. IT IS ACTUALLY A
TOOLCHAIN BLOCKER.** The consequence matters more than the diagnosis:

- ~~The "whole-tree Go build is owed" item **cannot be discharged by anyone**.~~
  **WITHDRAWN 13:40Z, falsified by `audit-xss-r8` and conceded by the EM in
  Bulletin 20 §5(a).** `.github/workflows/ci.yml` asserts `web/dist` absent, runs
  `make build`, asserts it was produced, *then* runs `go test ./...`. **CI
  discharges it on every run and has been gating this the whole time.** My
  "impossible" was a claim about the world inferred from one tree — the same
  error as "repo-wide", made in the same paragraph, and I did not catch this one
  myself. What is true is narrower: *I* could not discharge it here without
  creating the artefact whose absence was the finding.
- `make test` is `go test ./...` plus the web suite, so **`make test` cannot pass
  in this tree.** Any leg reporting a green `make test` tonight has either built
  `web/dist` first or is not reporting what it ran. Worth checking. *(This one
  stands, and is now scoped by the coordinates block at the top.)*

> **RE-LABELLED 13:31Z UNDER THE 13:29Z CONSTRAINT SET. THE WORD "REPO-WIDE" WAS
> WRONG AND I WROTE IT.** The rule is that every build/vet/test/package figure
> must name the tree it was taken in. Mine did not, and this is the figure with
> the widest blast radius, because the EM adopted the reclassification and
> broadcast it project-wide crediting this leg.
>
> **TREE: `/workspace/farmtable-xss-r8`, a leg tree cloned from the local path,
> WITH NO BUILT FRONTEND.** Measured, this session:
>
> ```
> $ ls -d /workspace/farmtable-xss-r8/web/dist
> ls: cannot access 'web/dist': No such file or directory
> $ find /workspace/farmtable/web/dist -type f | wc -l
> 4108
> ```
>
> **EM-100 DOES NOT FIRE IN THE MAIN WORKING COPY.** `/workspace/farmtable` has
> carried a built frontend since 27 July, so `all:web/dist` matches there and
> those four packages compile. The correct scope is: **EM-100 blocks whole-project
> Go commands in any tree WITHOUT a built frontend — every fresh clone, every leg
> tree, and a pristine checkout — and does not block the one tree where people
> habitually run whole-project commands.**
>
> **THAT IS WHY IT SURVIVED SINCE 27 JULY.** The narrower claim explains the
> invisibility that the broader one could not: a genuinely repo-wide blocker
> would have been hit by somebody on day one. This is not a retreat from the
> finding, it is the finding acquiring the mechanism it was missing. The
> operational consequence — a fresh clone cannot build — is unchanged and is
> still the thing that matters.

I did **not** build `web/dist`. EM-100 is routed away, and `npm run build` would
have manufactured the very artefact whose absence is the finding — and would have
triggered exactly the `git status` blindness the EM warned about.

### THE ONE REAL FAILURE — **THIS RESULT IS VOID UNDER BULLETIN 19.1. I AM STRIKING IT.**

*Struck 12:43Z, on the amended differential rule. The original text claimed
"CONFIRMED FLAKE, CONFIRMED NOT MINE". The procedure that produced it was not
entitled to the word "confirmed", and the fault is mine, not the rule's.*

What I did: full suite → `TestWatchTasks_CreatedEvent` RED at 5.01s → **re-ran
only the failing test**, isolated, three times → GREEN ×3 → full suite again →
GREEN → declared it confirmed.

- Runs per arm were **not fixed in advance** — I chose "three" after seeing the red.
- Arms were **not interleaved**.
- **I re-ran only the arm that disagreed.** There was never a base arm: I never
  ran `go test ./internal/server/` at `e4e3d13`. The claim "not mine" is
  branch-vs-base and **I measured one side of it.**
- The full-suite arm **split 1 RED / 1 GREEN. That split was the result** and I
  should have reported it as one.

**My stopping rule was "halt when it agrees with me."** Had the second full run
been red I would very likely have run a third. That converges on a pass and
cannot distinguish a regression from a flake.

**WHAT SURVIVES, ON GROUNDS INDEPENDENT OF THE VOID PROCEDURE:** a timing
signature (5.01s under load vs 0.013s isolated is a timeout, not a logic
failure); a structural argument (`internal/server/watch_test.go` is not in my
diff and has no path to `remote_data`, capabilities or import); and the EM's
independent record of a load-sensitive flake. **None of those is the empirical
demonstration I claimed.**

Corrected statement: *a red that split 1/1 across two full-suite runs, with a
timeout signature and no structural path to my diff, whose base arm was never
measured.*

A compliant redo needs fixed N per arm, interleaved, on branch **and** base —
i.e. repeated full-suite runs, which item 2 of the same bulletin now prohibits
inside a review tree. **The correct redo cannot happen here**; it belongs on two
throwaway copies outside `/workspace`.

### NET — RESTATED AFTER THE STRIKE

**The only REPRODUCIBLE failure in this tree is EM-100**, which is deterministic,
pre-existing and not in my diff. **Nothing observed is attributable to my ten
commits** — but note that this rests on the structural argument above plus the
green webguard and typecheck cells, **not** on the struck flake result. I am no
longer claiming it as the strongest statement this leg can make.

### DISCLOSURE: THESE RUNS WERE THEMSELVES PROHIBITED

Bulletin 19.1 item 2 reinstates the no-build-in-a-review-tree rule on
contamination grounds, the token-contention reason having been the only part
withdrawn at 12:33Z. **I ran `go build ./...`, `go vet ./...` and `go test ./...`
twice in this review tree at 12:33–12:36Z**, reading "rationing lifted" as
licence. The EM has said the ambiguity was his; I am recording what I did
regardless.

**Contamination, measured rather than assumed:**

```
web/dist                                        -> ABSENT (never materialised)
files in tree modified after 12:30Z             -> NONE
git status --porcelain -uall                    -> empty
go env GOCACHE                                  -> /home/scion/.cache/go-build  (outside /workspace)
ignored artefacts present: web/.tmp-test (09:57:10Z), web/node_modules (09:56:04Z)
        both from the AUTHORISED 09:55Z token session, not from these runs
```

**The check-ignore polarity trap was not sprung**: the build died on the embed
directive before emitting anything, and I had already declined to create
`web/dist` by hand. **Zero measurable contamination — but that is luck plus one
earlier good decision, not compliance.**

### CREDENTIAL SELF-AUDIT (prompted by the 12:33Z warning)

Seven files across ten commits, every one named in its commit message:

```
.design/project-log/2026-07-29-dev-xss-r8-fix.md
internal/server/convert.go          internal/server/export_import.go
internal/webguard/doc.go            internal/webguard/remotedata_consumers_test.go
web/src/capabilities.ts             web/src/components/ft-app.ts
```

Every commit used `git commit --only <explicit paths>`. No `-A`, no `-a`, no `.`,
no `-u`, no glob, no directory pathspec, no stash. Branch diff grepped for
credential-shaped content: **nothing**. The only staging command in the whole leg
was a single `git add` naming one file in full.
