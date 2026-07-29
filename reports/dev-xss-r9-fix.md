# dev-xss-r9-fix — ROUND 9 FIX LEG REPORT

Leg: fix. Branch: `url-scheme-validation-r9`. Tree: `/workspace/farmtable-dev-xss-r9`.
Base at dispatch: `901670e3f09ad57386cafb8359017d8d61a75070` (MEASURED — `git rev-parse HEAD` at start).
Branch head at report time: `bb092d38bded3f43b81c1d40c5023644902758eb` (MEASURED).
Not pushed. Nothing staged with a glob, a directory pathspec, or `-A`/`-u`/`-a`.

**Every figure in this report is tagged MEASURED, DERIVED or UNCHECKED.** DERIVED
means computed from figures that are themselves MEASURED here, with the
arithmetic shown. UNCHECKED means I did not verify it and am repeating it.

### ADDENDUM, 13:30Z — TREE QUALIFICATION, per the coordinator's constraint set

The constraint set relayed at 13:29:48Z requires that **every build, vet, test or
package-count figure name the tree it was taken in, in band, from the process
that took it.** Applied to this report as a re-label, not a re-run:

**RESTATED 13:45Z as COORDINATES, not labels, per bulletin 20 §4.** The axes are
`web/dist ∈ {absent, stub, real}` × `node_modules ∈ {absent, present}` ×
`module cache ∈ {cold, partial, warm}`, and I have added the commit, because
bulletin 20 §2's own figures were taken at a different commit from mine and that
turned out to matter (see the 32-vs-33 resolution below).

| Tree | Path | commit | web/dist | node_modules | module cache | Figures taken here |
|---|---|---|---|---|---|---|
| **T1** branch tree | `/workspace/farmtable-dev-xss-r9` | `bb092d3` | **absent** | **present** (+ `web/.tmp-test/`) | **partial** (shared, `/home/scion/go/pkg/mod`) | §5.2 tsc, §8 `npm test` / `go test webguard` / `gofmt`, all git figures |
| **T2** pristine clone | `/tmp/r9-clean` | `bb092d3` | **absent** | **absent** | **partial** (same shared cache) | all of §6 — item E vet, `go list`, `go build` |
| **T3** mutation clone | `/tmp/r9-arms` | `2738599` | **absent** | **present** | **partial** (same shared cache) | §2.4 acceptance arms, §2.6 mutants, §5.2 population/planted pairs |

**The module-cache coordinate is `partial`, not `warm`, and I would not have
known that without bulletin 20 §3:**

```
$ go env GOMODCACHE GOPROXY
/home/scion/go/pkg/mod
https://proxy.golang.org,direct
$ du -sh $(go env GOMODCACHE)
518M	/home/scion/go/pkg/mod
$ GOPROXY=off go mod download
go: github.com/davecgh/go-spew@v1.1.2-0.20180830191138-d8f796af33cc: module lookup disabled by GOPROXY=off
```
At least one module is missing from the cache. **`GOPROXY` was at its default
(network-enabled) for every figure in this report**, so nothing of mine was
blocked by it — but that means my figures were, in principle, cache-sensitive
and possibly network-assisted. **§6.2a below shows they are not**, by control.

Evidence for the `web/dist` and `node_modules` coordinates of T1, measured
rather than asserted:
```
$ cd /workspace/farmtable-dev-xss-r9 && ls -d web/dist
ls: cannot access 'web/dist': No such file or directory
$ git clean -ndx
Would remove web/.tmp-test/
Would remove web/node_modules/
```
**None of the three is the main working copy**, and none of them contains a
built frontend. I did not create one anywhere, and I did not delete one anywhere.

Three consequences worth stating rather than leaving implied:

- **T1 and T3 sit at coordinates the 13:29Z list could not express**: `web/dist`
  absent but `node_modules` present. For **Go** commands they behave as a
  pristine tree does (the embed fails identically); for **web** commands they
  behave as a built one. Every Go figure I report comes from T2 anyway. Bulletin
  20 §4 has since replaced the list with axes, which is the right fix — a list
  built by collecting examples can only ever be short.
- **The 13:29Z pristine-tree sentence is confirmed for `go vet` by §6.3 and
  WITHDRAWN for `go test` by bulletin 20 §1.** My §6.3 measured `go vet ./...`
  and `go list ./...`, both of which do abort, so **the correction does not
  touch any figure I reported.** It does falsify a *reason* I gave in §8 for not
  running `go test ./...`; corrected in place there.
- **THE 32-vs-33 PACKAGE-COUNT DISCREPANCY IS RESOLVED AND IT IS NOT A
  DISAGREEMENT.** Bulletin 20 §2 measures **32** packages; I measure **33**.
  Both are right, at different commits:

  ```
  $ cd /tmp/r9-clean
  $ git checkout --detach bb092d3 && go list -e ./... | wc -l
  33
  $ git checkout --detach cc927355 && go list -e ./... | wc -l
  32
  $ go list -e ./... | grep webguard      (at cc92735)
  (no output, exit 1)
  ```
  **The one package is `internal/webguard`, which exists on this branch and not
  on `real-main`** — confirmed structurally by `git ls-tree -d --name-only`,
  which lists `internal/webguard` under `HEAD` and not under `real-main`. The
  bulletin's figures are at `cc92735`; mine are at `bb092d3`. **Anyone
  reconciling 32 against 33 without the commit will conclude one of us
  miscounted.** This is the case for adding *commit* to the coordinates
  alongside the three tree axes.

Also per rule 7: **both throwaway clones were cloned from the local path on this
host, never from a network remote** (MEASURED, output piped through redaction):
```
$ git -C /tmp/r9-arms remote -v | sed -E 's#://[^@]*@#://<redacted>@#g'
origin	/workspace/farmtable-dev-xss-r9 (fetch)
origin	/workspace/farmtable-dev-xss-r9 (push)
$ git -C /tmp/r9-clean remote -v | sed -E 's#://[^@]*@#://<redacted>@#g'
origin	/workspace/farmtable-dev-xss-r9 (fetch)
origin	/workspace/farmtable-dev-xss-r9 (push)
```
No network URL in either config; no new credential carrier was manufactured by
this round.

---

## 0. THE HEADLINE, BECAUSE TWO OF THESE ARE WORSE THAN THE BRIEF EXPECTED

1. **Item A required moving code, not just adding a test.** The r8 fix lived in
   a private method on a Lit element and no node test could reach it. Details
   in §2. The struck 15.8 vehicle was avoided.
2. **`go vet ./...` in a clean checkout does not analyse four packages badly. It
   analyses ZERO packages.** `go list ./...` returns 0 too — the failure is in
   pattern expansion. §6.
3. **THE SECTION 7 REBASE DOES NOT APPLY CLEANLY AND I DID NOT FORCE IT.**
   Conflict at commit 21 of 71. Aborted, branch restored byte-for-byte. There is
   also a second-order problem with rebasing at all, which I do not think has
   been noticed: it rewrites `af9ea8c`, and **14 citations of that SHA are
   committed in this tree**. §7. This is the one thing in this report I would
   like a decision on before anyone rebases.

---

## 1. WHAT WAS COMMITTED

```
$ git log --format='%h %s' --stat fb766c7^..HEAD
```

```
bb092d3 docs(log): round 9 fix leg project log entry
 .design/project-log/2026-07-29-dev-xss-r9-fix.md | 136 +++++++++++++++++++++++
 1 file changed, 136 insertions(+)
b976f48 docs(log): r8's F1 claim is TYPECHECK-VERIFIED, not verified (test F11)
 .design/project-log/2026-07-29-dev-xss-r8-fix.md | 67 +++++++++++++++++++++---
 1 file changed, 59 insertions(+), 8 deletions(-)
2738599 test(web): pin the af9ea8c platform guard and the capability gate's two readers
 internal/webguard/remotedata_consumers_test.go |  71 +++++--
 web/scripts/run-tests.mjs                      |  11 +-
 web/src/capabilities.test.ts                   | 256 +++++++++++++++++++++++++
 web/src/capabilities.ts                        |  62 ++++++
 web/src/components/ft-app.ts                   |  50 ++---
 5 files changed, 399 insertions(+), 51 deletions(-)
fb766c7 docs(server,web): state the gated set by identifier, not by count (review R-1)
 internal/server/export_import.go | 8 ++++++--
 web/src/capabilities.ts          | 9 +++++++--
 2 files changed, 13 insertions(+), 4 deletions(-)
```

4 commits, 7 distinct files (MEASURED, from the stat above). No file outside
this list was modified: `git status --porcelain` is 0 lines (MEASURED).

---

## 2. ITEM A + C — THE af9ea8c PIN, AND WHY IT NEEDED A MOVE

### 2.1 What the problem actually was

`af9ea8c` added three lines to `isCollectionWritable`. That function was a
**private method on the `FtApp` Lit element**, in `web/src/components/ft-app.ts`.
A node test cannot call it. There is no seam.

The r8 log had already measured the neighbouring fact and it is worth restating,
because it is the reason the defect went unpinned rather than anyone being lazy:

```
$ cd web && npx tsc -p tsconfig.test.json --noEmit --listFiles | grep -c ft-app.ts
0
```
MEASURED, and **still 0 at branch head today** — I re-ran it. The test config
never loads that file.

So the only exported thing near the subject was `getCapabilities`. That is
exactly the 15.8 vehicle, and it is struck for exactly the right reason: it had
both conjuncts before r8, so it is green on the defect in both directions.
**Writing a test against it would have produced a green suite, a plausible
report, and zero evidence.**

### 2.1a The brief's §0 measurement, re-measured as it asked

§0 says "MEASURED, and you should re-measure rather than believe me:
`isCollectionWritable` has exactly THREE references tree-wide."

```
$ git grep -n isCollectionWritable 901670e -- web/src
901670e:web/src/components/ft-app.ts:230:    return !this.isCollectionWritable(this.currentCollection);
901670e:web/src/components/ft-app.ts:240:    return this.isCollectionWritable(this.currentCollection);
901670e:web/src/components/ft-app.ts:254:  private isCollectionWritable(coll: Collection): boolean {
count=3
```

**CONFIRMED at the base commit: exactly 3, all in `ft-app.ts`, one declaration
and two getter calls** (MEASURED). The brief was right and it is right for the
reason that made item A hard — three references, zero of them a test.

At branch head:

```
$ git grep -c isCollectionWritable -- web/src
web/src/capabilities.test.ts:16
web/src/capabilities.ts:1
web/src/components/ft-app.ts:5
```
22 total (DERIVED: 16+1+5). `ft-app.ts`'s 5 are the import, the two getter
calls, and two mentions in the do-not-reintroduce comment — **no declaration**,
which is what §3 of the test asserts.

### 2.2 What I did instead

Lifted `isCollectionWritable` into `web/src/capabilities.ts` and exported it.
`ft-app.ts` now imports it; its private copy is gone and a comment stands where
it was telling the next person not to reintroduce one.

Three properties of the move, stated because each was a decision:

- **The two census-declared lines moved byte-identically.** `const rd =
  coll.remoteData;` and `// Check remote_data for explicit writable flag` are
  the same bytes in the new location. This was not cosmetic care — the
  `internal/webguard` census matches on exact text and exact multiplicity, and
  it caught the move (§2.5).
- **The seam is narrowed, not closed.** `isCollectionWritable` is deliberately
  NOT implemented as `getCapabilities(c) === GITHUB_CAPABILITIES`. Two
  independent implementations is what makes the agreement assertion in the test
  a real assertion rather than a tautology. This is audit F3's own preference —
  F3 says "Lifting it is the better fix: it removes the seam rather than pinning
  it" — and I read F3 in `reports/audit-xss-r8.md` rather than a paraphrase, as
  item C instructs.
- **It sits immediately before `getCapabilities`.** The rule it must agree with
  is now the next thing on the screen.

### 2.3 The test: `web/src/capabilities.test.ts`, 103 assertions (MEASURED, from
the harness receipt `#assertions 103`)

Three arms, and they are separate arms on purpose because they fail for
different reasons:

- **§1 `pinTheAf9ea8cGuard`** — every non-GITHUB platform carrying
  `{writable: true}` must be false, plus a **control arm** (GITHUB + writable →
  true) without which a predicate that refuses everything satisfies the whole
  section.
- **§2 `pinTheTable`** — 7 platforms × 6 remote-data shapes = **42 cases**
  (DERIVED: 7 × 6, both MEASURED from the source constants). Expected values are
  written out **as data**, not computed — a formula would be a second copy of
  the implementation, and a second copy of a wrong implementation agrees with
  the first. Also asserts the two readers agree on every cell, includes
  near-miss rows (`writable: 'true'` the string, `writable: 1` the number, both
  of which a truthiness check would let through), and carries `sawTrue`/
  `sawFalse` anti-vacuity assertions **with their denominators in the message**.
- **§3 `pinTheCallSite`** — reads `components/ft-app.ts` from disk as text and
  asserts it imports the shared predicate and declares none of its own. Text,
  not import, because of the `--listFiles` measurement above: the test config
  cannot see that file. It asserts non-zero bytes read first, so the two regex
  assertions cannot pass on an empty string.

One detail worth flagging, measured rather than recalled. `Object.values()` on a
numeric TypeScript enum returns the **reverse mapping as well**:

```
$ node --experimental-strip-types enumprobe.ts    (throwaway probe, deleted after; tree left at 0 dirty lines)
Object.values(Platform).length = 14
numeric-filtered length        = 7
raw = ["UNSPECIFIED","FARMTABLE","GITHUB","LINEAR","JIRA","ASANA","BEADS",0,1,2,3,4,5,6]
```

**14 entries for 7 members** (MEASURED). The `typeof v === 'number'` filter in
`PLATFORMS` is load-bearing, not defensive noise: without it the loop runs 14
times and 7 of those iterations feed a string to a predicate comparing against a
number, passing vacuously. The remedy sketch in audit F3 uses bare
`Object.values(Platform)`; see the error list, item 6.

### 2.4 *** SECTION 3: THE PASTED RED OUTPUT ***

Schedule fixed **before the first run**, per §3.1 and bulletin 19.1: **3 pairs,
6 runs, strictly alternating reverted → fixed, no arm re-run alone.** Executed
in a throwaway clone at `/tmp/r9-arms`, outside `/workspace`. Script and full
transcript: `/tmp/r9-arms/arms.sh`, `/tmp/r9-arms/arms.out` (247 lines).

The mutation is the exact three lines of `af9ea8c`, removed by full-line textual
match, with the script aborting if the match is not exactly one occurrence.

Tool declaration, emitted by the script itself:

```
=== TOOL DECLARATION, MEASURED FROM INSIDE THIS SCRIPT ===
shell:      /usr/bin/bash  5.2.15(1)-release
node:       /usr/local/bin/node  v20.20.2
npm:        /usr/local/bin/npm  10.8.2
tsc:        /tmp/r9-arms/web/node_modules/.bin/tsc  Version 5.9.3
python3:    /usr/bin/python3  Python 3.11.2
git:        /usr/local/bin/git  git version 2.54.0
repo:       /tmp/r9-arms at 27385995e94caa685d4b932440499dad5bbcfa40
branch:     url-scheme-validation-r9
schedule:   3 pairs, reverted-then-fixed, fixed before the first run
```

**PAIR 1 / ARM reverted** — `$ cd web && npm test`:

```
Discovered 5 test file(s).

--- src/capabilities.test.ts
file:///tmp/r9-arms/web/.tmp-test/util/assertions.js:53
        throw new Error(`${message} (got ${String(actual)}, want ${String(expected)})`);
              ^

Error: af9ea8c GUARD BREACHED: platform UNSPECIFIED with an explicit writable flag is treated as WRITABLE. The gate requires GITHUB *and* writable, together. If you just removed the platform check from isCollectionWritable, this is the line that says so (got true, want false)
    at assertEqual (file:///tmp/r9-arms/web/.tmp-test/util/assertions.js:53:15)
    at pinTheAf9ea8cGuard (file:///tmp/r9-arms/web/.tmp-test/capabilities.test.js:131:9)
    at run (file:///tmp/r9-arms/web/.tmp-test/capabilities.test.js:199:5)
    at file:///tmp/r9-arms/web/.tmp-test/capabilities.test.js:204:1
    at ModuleJob.run (node:internal/modules/esm/module_job:325:25)
    at async ModuleLoader.import (node:internal/modules/esm/loader:606:24)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)

Node.js v20.20.2
#assertions 1

--- src/util/assertions.test.ts
assertions: ok
#assertions 9

--- src/util/safe-url.test.ts
safe-url: ok
#assertions 204

--- src/util/url-binding-scan.test.ts
url-binding-scan: ok
#assertions 157

--- src/utils/task-ready.test.ts
#assertions 10

FAIL: 1 of 5 test file(s) failed:
  src/capabilities.test.ts (exit 1)
### PAIR 1 / ARM reverted  EXIT=1  finished 2026-07-29T12:47:31Z
```

**PAIR 1 / ARM fixed:**

```
Discovered 5 test file(s).

--- src/capabilities.test.ts
capabilities: ok
#assertions 103

--- src/util/assertions.test.ts
assertions: ok
#assertions 9

--- src/util/safe-url.test.ts
safe-url: ok
#assertions 204

--- src/util/url-binding-scan.test.ts
url-binding-scan: ok
#assertions 157

--- src/utils/task-ready.test.ts
#assertions 10

PASS: 5 test file(s), 483 assertions.
### PAIR 1 / ARM fixed  EXIT=0  finished 2026-07-29T12:47:36Z
```

**PAIR 2 / ARM reverted** — byte-identical failure, same assertion, same message:

```
Error: af9ea8c GUARD BREACHED: platform UNSPECIFIED with an explicit writable flag is treated as WRITABLE. The gate requires GITHUB *and* writable, together. If you just removed the platform check from isCollectionWritable, this is the line that says so (got true, want false)
    at pinTheAf9ea8cGuard (file:///tmp/r9-arms/web/.tmp-test/capabilities.test.js:131:9)
#assertions 1
FAIL: 1 of 5 test file(s) failed:
  src/capabilities.test.ts (exit 1)
### PAIR 2 / ARM reverted  EXIT=1  finished 2026-07-29T12:47:40Z
```

**PAIR 2 / ARM fixed:**
```
PASS: 5 test file(s), 483 assertions.
### PAIR 2 / ARM fixed  EXIT=0  finished 2026-07-29T12:47:45Z
```

**PAIR 3 / ARM reverted:**
```
Error: af9ea8c GUARD BREACHED: platform UNSPECIFIED with an explicit writable flag is treated as WRITABLE. The gate requires GITHUB *and* writable, together. If you just removed the platform check from isCollectionWritable, this is the line that says so (got true, want false)
    at pinTheAf9ea8cGuard (file:///tmp/r9-arms/web/.tmp-test/capabilities.test.js:131:9)
#assertions 1
FAIL: 1 of 5 test file(s) failed:
  src/capabilities.test.ts (exit 1)
### PAIR 3 / ARM reverted  EXIT=1  finished 2026-07-29T12:47:49Z
```

**PAIR 3 / ARM fixed:**
```
PASS: 5 test file(s), 483 assertions.
### PAIR 3 / ARM fixed  EXIT=0  finished 2026-07-29T12:47:53Z
```

**RESULT: reverted EXIT=1 in 3 of 3 pairs. Fixed EXIT=0 in 3 of 3 pairs. NO PAIR
DISAGREED WITH THE OTHERS. NO ARM WAS RE-RUN ALONE.** (All MEASURED; the six
EXIT lines above are the raw output.)

Final state check emitted by the script: `guard PRESENT`, and
`git status --short` of the throwaway clone showed only `?? arms.sh` — i.e. the
mutation was fully reverted and no tracked file was left modified (MEASURED).

**On the count-pin caveat in section 3.** The suite has an absolute
`EXPECTED_ASSERTIONS` pin, so a count-pin RED is available cheaply and is worth
nothing on its own. **The RED above is not a count RED.** It is a named
assertion failing at `pinTheAf9ea8cGuard`, naming the platform that escaped, and
the run aborts at `#assertions 1` — before the count is ever compared. The
count-neutral corruption the section asks for is supplied separately in §2.6:
mutants M2 and M4b each change behaviour without changing the assertion count,
and each is RED.

### 2.5 The webguard census went RED, and that is the guard working

Lifting the two declared lines out of `ft-app.ts` broke
`internal/webguard`'s exact-text census immediately: two declarations matched 0
occurrences, and the new file introduced undeclared mentions. Repaired by
**re-filing the entries and declaring the new fixture**, not by relaxing the
matcher. The move is written into each entry's reason.

One non-obvious consequence: `TestWebRemoteDataCensusIsNonVacuous` keyed its
`mustSee` control map **file → text**. Both known consumers now live in one
file, so that map silently collapses from two entries to one. Re-keyed
**text → file**:

```go
mustSee := map[string]string{
    "const rd = collection.remoteData;": "src/capabilities.ts",
    "const rd = coll.remoteData;":       "src/capabilities.ts",
}
```

**That collapse would not have shown up as a failure. It was found by mutation
(M5), not by reading.** A map literal losing an entry to key collision is
exactly the kind of silent narrowing this project keeps finding.

### 2.6 Supplementary mutants — every arm exercised, each one an interleaved pair

Section 8.5 item 4: an instrument that has never returned a non-empty result is
not evidence. The acceptance run exercises §1 only. So each remaining arm got
its own mutant, **each run as one interleaved pair (mutant, then clean),
declared in advance**. Transcript: `/tmp/r9-arms/mutants.out`.

Tool declaration from that script — **note the Go version, it differs from the
host and this matters, see §6.1**:

```
shell:   /usr/bin/bash  5.2.15(1)-release
node:    /usr/local/bin/node  v20.20.2
go:      /usr/local/go/bin/go  go version go1.26.5 linux/amd64
python3: /usr/bin/python3  Python 3.11.2
repo:    /tmp/r9-arms at 27385995e94caa685d4b932440499dad5bbcfa40
```

**M2** — `isCollectionWritable` uses truthiness instead of `=== true`. Target:
the near-miss rows. Count-neutral.
```
############ MUTANT M2 -- ARM mutant
Error: isCollectionWritable(GITHUB, writable: 'true' (string near-miss)) (got true, want false)
FAIL: 1 of 5 test file(s) failed:
  src/capabilities.test.ts (exit 1)
### M2 mutant EXIT=1
############ MUTANT M2 -- ARM clean
PASS: 5 test file(s), 483 assertions.
### M2 clean EXIT=0
```

**M3** — `FtApp` reinstates a private `isCollectionWritable`. Target: arm 3 only.
```
############ MUTANT M3 -- ARM mutant
Error: components/ft-app.ts DECLARES ITS OWN isCollectionWritable. There must be exactly one implementation of this rule; a second copy is precisely the divergence af9ea8c fixed
FAIL: 1 of 5 test file(s) failed:
  src/capabilities.test.ts (exit 1)
### M3 mutant EXIT=1
############ MUTANT M3 -- ARM clean
PASS: 5 test file(s), 483 assertions.
### M3 clean EXIT=0
```

**M4 — THIS ONE IS THE INTERESTING RESULT AND IT IS A NEGATIVE ONE.**
Intended mutant: `getCapabilities` drops its GITHUB check, rewritten as
`!== Platform.FARMTABLE`. The filtered transcript showed **no matching output
line at all** and EXIT=1:
```
############ MUTANT M4 -- ARM mutant
### M4 mutant EXIT=1
############ MUTANT M4 -- ARM clean
PASS: 5 test file(s), 483 assertions.
### M4 clean EXIT=0
```
Re-run unfiltered (`/tmp/r9-arms/m4full.out`), and the reason is not that my
test is weak:
```
#### M4 RERUN -- ARM mutant (full output)

> farmtable-web@0.0.1 test
> rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs

src/capabilities.ts(222,7): error TS2367: This comparison appears to be unintentional because the types 'Platform.UNSPECIFIED | Platform.GITHUB | Platform.LINEAR | Platform.JIRA | Platform.ASANA | Platform.BEADS' and 'Platform.FARMTABLE' have no overlap.
#### M4 rerun mutant EXIT=2
#### M4 RERUN -- ARM clean (full output)
PASS: 5 test file(s), 483 assertions.
#### M4 rerun clean EXIT=0
```
**The mutant never reached the test runner. tsc rejected it, EXIT=2 not 1.** Had
I reported "M4 killed", the credit would have gone to the wrong instrument.
**A mutant your compiler rejects is not a test of your tests.** I record this as
its own finding.

**M4b** — the repair: `getCapabilities` grants LINEAR as well as GITHUB. This
typechecks, so it actually runs. Count-neutral. Target: arm 2 only.
```
#### M4b -- ARM mutant (getCapabilities also grants LINEAR)
Error: THE TWO READERS OF THE CAPABILITY GATE DISAGREE for (LINEAR, writable: true): isCollectionWritable says false and getCapabilities grants GITHUB_CAPABILITIES. One rule, two implementations; r8 fixed a divergence here by hand and this is what makes the next one red (got false, want true)
FAIL: 1 of 5 test file(s) failed:
  src/capabilities.test.ts (exit 1)
#### M4b mutant EXIT=1
#### M4b -- ARM clean
PASS: 5 test file(s), 483 assertions.
#### M4b clean EXIT=0
```
**This is audit F3 discharged with evidence:** the two readers diverging by hand
is now RED.

**M5** — `isCollectionWritable`'s parameter renamed `coll` → `c`. Target: the
webguard declared-site arm **and** the re-keyed non-vacuity control.
```
############ MUTANT M5 -- ARM mutant
--- FAIL: TestWebRemoteDataConsumersAreDeclared (0.00s)
          src/capabilities.ts: want 1 occurrence(s) of "const rd = coll.remoteData;", found 0
--- FAIL: TestWebRemoteDataCensusIsNonVacuous (0.00s)
    remotedata_consumers_test.go:541: the census did NOT find the known capability consumer in src/capabilities.ts ("const rd = coll.remoteData;").
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/webguard	0.017s
### M5 mutant EXIT=1
############ MUTANT M5 -- ARM clean
ok  	github.com/farmtable-io/farmtable/internal/webguard	0.018s
### M5 clean EXIT=0
```

**Mutant tally: 5 mutants attempted, 4 killed by the test suite, 1 (M4) killed
by the typechecker before the suite ran and replaced by M4b** (MEASURED, from
the five EXIT pairs above). Every mutant arm EXIT=1; every clean arm EXIT=0; no
pair split.

### 2.7 The assertion pin

`web/scripts/run-tests.mjs`: `EXPECTED_ASSERTIONS` **380 → 483** (MEASURED: the
`PASS:` receipt reads `483 assertions`). Delta **+103** (DERIVED: 483 − 380),
which equals `capabilities.test.ts`'s own receipt `#assertions 103` (MEASURED) —
so **no pre-existing assertion was removed**. The comment on the pin records
this and records that the RED evidence does not rest on that number moving.

---

## 3. ITEM B — REVIEW R-1, THE SET STATED BY IDENTIFIER

Two prose sites stated the gated set as a **count**. Both now name it.

- `internal/server/export_import.go` — the conjunct-A comment now says the gated
  operations are "the ones enabled in `GITHUB_CAPABILITIES`, in
  `web/src/capabilities.ts`", and states why: "a count here is a population
  claim with nothing guarding it, and flipping one flag in that object would
  falsify the number silently."
- `web/src/capabilities.ts` — the same substitution in `getCapabilities`'s
  conjunct-B comment.

**Compliance check on the `file:LINE` prohibition, and I am reporting what the
command actually returned rather than what I expected it to:**

```
$ git diff 901670e3..HEAD | grep -E '^\+' | grep -nE '\.(go|ts|mjs|tsx):[0-9]+'
125:+assets.go:5:12: pattern all:web/dist: no matching files found
```

**One match, not zero** (MEASURED). It is in
`.design/project-log/2026-07-29-dev-xss-r9-fix.md`, and it is **pasted `go vet`
output inside a fenced code block** — the finding of item E, quoted verbatim.
It is not a citation I authored and it is not an instruction pointing anyone at
a line; deleting the line number would be falsifying tool output. **Authored
`file:LINE` citations added by this round: zero** (DERIVED — one match, and
inspection shows it is quoted output). Every cross-file reference I wrote names
a function, an exported symbol, or a file without a line.

I flag this rather than reporting "zero" because a compliance check whose result
is edited to match the prediction is not a check. The same caveat applies to
this report, which quotes vet output extensively.

**One thing I did NOT do, deliberately:** the brief says state the set by
identifier, and Rule 30 says a count is a population claim. I did not replace
the count with a *different* count (e.g. "nine of fifteen flags are true"). That
would have reintroduced the defect in new clothes.

---

## 4. ITEM C — AUDIT F3

Read as filed in `reports/audit-xss-r8.md`, not from the brief's paraphrase.
Discharged by the **agreement arm (§2 of the test)** plus the lift, which is
F3's own stated preference. Evidence that it is not vacuous: **mutant M4b**,
§2.6 — a hand-made divergence between the two readers is RED, naming the exact
`(platform, remote-data shape)` cell where they disagree.

F3's remedy sketch contains an error I did not copy; error list item 6.

---

## 5. ITEM D — F11, AND THE DELIVERABLE WORD IS TYPECHECK-VERIFIED

### 5.1 What changed

`.design/project-log/2026-07-29-dev-xss-r8-fix.md` said **"F1 VERIFIED"** in two
places. Both now read **TYPECHECK-VERIFIED**, corrected **in place** with an
annotation at each site recording what changed and why. In place rather than
annotation-only because an unqualified "VERIFIED" is read once and not
re-derived — the correction has to sit where the claim sat.

I also annotated a third paragraph in that file: it said `getCapabilities` and
`isCollectionWritable` have "zero test coverage — no test file references
either". **This round falsified that for the web half**, so leaving it standing
would have been a defect I introduced. The conjunct-A half of that paragraph is
untouched and still true.

### 5.2 The typechecker output, pasted

**In the branch tree**, `/workspace/farmtable-dev-xss-r9/web`:

```
$ npx tsc --noEmit
EXIT=0
```
No diagnostics. (MEASURED. Empty output with exit 0 is what a clean tsc run
looks like; the planted-error pairs below are what make that zero non-vacuous.)

**Population — what tsc actually loaded** (from `/tmp/r9-arms/typecheck.out`):

```
=== TOOLS, DECLARED FROM INSIDE THIS SCRIPT ===
tsc: /tmp/r9-arms/web/node_modules/.bin/tsc  Version 5.9.3
node: /usr/local/bin/node v20.20.2

$ cd web && npx tsc --noEmit --listFiles | wc -l
exit=0
407
$ ... | grep -c "^/tmp/r9-arms/web/src/"   (project sources, excludes lib.d.ts and node_modules)
58
$ ... | grep -E "(capabilities|ft-app)"
/tmp/r9-arms/web/src/capabilities.ts
/tmp/r9-arms/web/src/capabilities.test.ts
/tmp/r9-arms/web/src/components/ft-app.ts
```

**407 files loaded, 58 of them project sources under `web/src`** (both MEASURED),
and all three files this round cares about are in the list. A zero with a
population beside it, as section 4E asks for.

**Non-vacuity of that zero — 2 interleaved pairs, schedule fixed in advance,
planted-then-clean:** a type error planted on the af9ea8c line itself.

```
=== SCHEDULE FIXED IN ADVANCE: 2 pairs, planted-then-clean, interleaved ===
#### PAIR 1 ARM planted (near-miss on the af9ea8c line itself)
src/capabilities.ts(139,34): error TS2339: Property 'GITHUB_TYPO_PLANTED_BY_R9' does not exist on type 'typeof Platform'.
#### PAIR 1 planted EXIT=2
#### PAIR 1 ARM clean
#### PAIR 1 clean EXIT=0  (no output above means no diagnostics)
#### PAIR 2 ARM planted (near-miss on the af9ea8c line itself)
src/capabilities.ts(139,34): error TS2339: Property 'GITHUB_TYPO_PLANTED_BY_R9' does not exist on type 'typeof Platform'.
#### PAIR 2 planted EXIT=2
#### PAIR 2 ARM clean
#### PAIR 2 clean EXIT=0  (no output above means no diagnostics)
```
Planted EXIT=2 in 2 of 2; clean EXIT=0 in 2 of 2; no split (MEASURED).

### 5.3 The scepticism F11 asked for, applied to my own claim

The r8 evidence was a typechecker, and a typechecker cannot observe a
behavioural change — planting a type error on a line proves tsc *reads* the
line, not that the line *does* anything. That is why F11 is right and why the
word had to change.

**The same limit applies to §5.2 above.** The tsc evidence in this section is
also only typecheck evidence. What upgrades r9's claim past r8's is not the
typechecker — it is §2.4, an actual RED on the actual revert. I have kept the
two separate rather than letting the stronger one launder the weaker one.

One measurement that survives r9 unchanged and should not be misread as fixed:

```
$ cd web && npx tsc -p tsconfig.test.json --noEmit --listFiles | grep -c ft-app.ts
0
$ cd web && npx tsc -p tsconfig.test.json --noEmit --listFiles | grep -E 'src/(capabilities|components/ft-app)'
/workspace/farmtable-dev-xss-r9/web/src/capabilities.ts
/workspace/farmtable-dev-xss-r9/web/src/capabilities.test.ts
```
The test config now loads `capabilities.ts` — that is the seam the lift created.
It still never loads `ft-app.ts`, which is why arm 3 reads it as text.

---

## 6. ITEM E — go vet FROM A CLEAN CHECKOUT. DIAGNOSTIC. RAW OUTPUT IN FULL.

### 6.1 The tree, and the toolchain disclosure I owe you first

**Toolchain: the host `go` and the `go` that performed this analysis are
different binaries, and my earlier scripts declared the wrong one.** Section 8.5
item 5 is exactly about this, so it goes first:

```
$ go version                         (host shell, outside any module)
go version go1.26.1 linux/amd64
$ cd /tmp/r9-clean && go version     (inside the module; GOTOOLCHAIN may switch it)
go version go1.26.5 linux/amd64
$ cd /tmp/r9-clean && go env GOTOOLCHAIN GOFLAGS GOOS GOARCH
auto

linux
amd64
$ grep -E "^(go|toolchain) " /tmp/r9-clean/go.mod
go 1.26.5
```
`GOTOOLCHAIN=auto` + `go 1.26.5` in `go.mod` ⇒ **every figure in this section was
produced by go1.26.5, not by the host's go1.26.1** (MEASURED, both versions
above; DERIVED for the causal claim, from `GOTOOLCHAIN=auto`). `GOFLAGS` is
empty. There is no `toolchain` directive in `go.mod`.

**Is the tree clean? Yes, and here is the evidence rather than the assertion:**

```
$ git -C /tmp/r9-clean rev-parse HEAD
bb092d38bded3f43b81c1d40c5023644902758eb
$ git -C /tmp/r9-clean status --porcelain | wc -l          (0 = no modified, no untracked)
0
$ git -C /tmp/r9-clean clean -ndx | wc -l                  (0 = nothing untracked OR ignored, incl. web/dist)
0
$ ls -d /tmp/r9-clean/web/dist /tmp/r9-clean/web/node_modules
ls: cannot access '/tmp/r9-clean/web/dist': No such file or directory
ls: cannot access '/tmp/r9-clean/web/node_modules': No such file or directory
$ git -C /tmp/r9-clean ls-files web/dist | wc -l           (tracked files under web/dist)
0
```

`clean -ndx` is the load-bearing one: `status --porcelain` alone would not show
a `web/dist` that git considers ignored, and `-x` includes ignored files. It is 0.

> **NOTE ADDED 13:50Z, after bulletin 20.1 §1.** The sentence above originally
> read "and `web/dist` is gitignored," which is exactly the claim 20.1 shows is
> state-dependent: the pattern is `dist/` **with a trailing slash, so it matches
> directories only**, and `check-ignore` consults the disk rather than a
> hypothetical. In my own tree:
> ```
> $ git check-ignore -v web/dist          → exit 1, no output   (web/dist ABSENT)
> $ grep -n dist .gitignore               → 17:dist/
> $ git check-ignore -v web/node_modules web/.tmp-test
> .gitignore:45:node_modules/	web/node_modules
> .gitignore:46:web/.tmp-test/	web/.tmp-test   → exit 0
> ```
> Arm 1 of 20.1 reproduced. **I did not run arms 2 or 3: both require creating a
> `web/dist`, which item 10 prohibits.** I did not need to — the two ignored
> directories that already exist in T1 are a natural positive control for the
> same mechanism, and they show the command working on trailing-slash patterns
> over directories that are present. **The falsifiable claim can be tested
> without manufacturing the artefact.**
>
> **My conclusion is unaffected, and the reason is the instrument choice rather
> than luck worth claiming.** 20.1's class is *an instrument only available in
> the state where its answer does not matter*. `git clean -ndx` is not in that
> class: it enumerates untracked **and** ignored entries, so a `web/dist` shows
> up under it **whether or not git would ignore it**. It answers "is there one"
> without first settling "would it be ignored" — which is why 0 from it is a
> stronger negative than anything `status` or `check-ignore` can give here. **There is no `web/dist`, tracked, untracked or ignored, and no
`node_modules`.** The driving script lives at `/tmp/vet3.sh`, **outside the
tree**, so running it does not dirty the checkout — an earlier attempt put the
script inside `/tmp/r9-clean` and made it non-pristine (`?? vet.sh`); that clone
was discarded and re-made. Post-run re-check at the end of this section.

**ANSWER TO THE BRIEF'S QUESTION 3, EXPLICITLY: this was a CLEAN CHECKOUT, with
NO untracked `web/dist`.**

### 6.2 The population, measured before the finding

```
$ cd /tmp/r9-clean && go list -e ./... | wc -l     (-e tolerates broken packages: the denominator)
33
$ cd /tmp/r9-clean && go list ./... | wc -l        (no -e: what an ordinary ./... invocation sees)
0
$ cd /tmp/r9-clean && go list ./... 2>&1 >/dev/null
assets.go:5:12: pattern all:web/dist: no matching files found
```

**33 packages in the module. An ordinary `./...` sees 0 of them.** The embed
failure aborts *pattern expansion*, not just compilation of the affected
packages. (Both MEASURED.)

### 6.2a CONTROL ADDED 13:45Z — is item E's figure cache-sensitive? No.

Bulletin 20 §3 shows that the module cache, which is **not in the tree at all**,
can change a package count by 27 with nothing printable about the tree
explaining it. `GOMODCACHE` is `/home/scion/go/pkg/mod` and is per-agent. Mine
is **partial** (a module is missing under `GOPROXY=off`; see the addendum), and
every §6 figure was taken with `GOPROXY` at its network-enabled default. So the
figure could have been network-assisted and non-reproducible offline.

**It is not.** Same tree, same commit, same verb, one variable changed:

```
$ cd /tmp/r9-clean && for p in $(go list -e ./...); do GOPROXY=off GOFLAGS=-mod=readonly go vet "$p"; done
GOPROXY=off  per-package vet:  clean=28  failed=5  denominator=33
failed:
  github.com/farmtable-io/farmtable
  github.com/farmtable-io/farmtable/cmd/farmtable-server
  github.com/farmtable-io/farmtable/cmd/ft
  github.com/farmtable-io/farmtable/internal/cli
  github.com/farmtable-io/farmtable/internal/server
```

**Identical to §6.4: 28 / 5 / 33, same five packages** (MEASURED). The missing
module is a test-only dependency and is not in vet's build graph, so item E's
result is **cache-insensitive and reproducible offline**. Tree re-checked
pristine after: `status --porcelain` 0, `clean -ndx` 0.

Recording this because the honest version of "my cache is partial" is not "so my
figure might be wrong" — it is "so here is the control that shows it isn't."

### 6.3 THE MEASUREMENT — raw output, in full

```
$ cd /tmp/r9-clean && go vet ./...
assets.go:5:12: pattern all:web/dist: no matching files found
go vet ./... EXIT=1
```

**That is the entire output. One line.**

- Command: `go vet ./...` (shown above).
- Count: **1 diagnostic, and it is not a vet finding** — it is a load error.
  Findings-by-analyser: **0** (MEASURED).
- **Population analysed: 0 of 33 packages** (MEASURED — `go list ./...` returns
  0; vet cannot analyse what the pattern did not expand to).
- Clean checkout, no untracked `web/dist` (§6.1).

**This is a worse result than the brief's expectation and it is the result.**
The brief's §7 says a clean checkout "does not build: go build, go test and go
vet all fail." True, but it understates the mechanism: the common reading is
"four packages fail to build and the rest are fine." **The rest are not
analysed either.** Any clean-checkout vet claim of the form "N findings" that
was produced with `./...` was produced by a command that inspected no code at
all. **IF VET CANNOT RUN CLEAN, THAT IS THE RESULT** — reported as blocked, not
substituted.

### 6.4 BUT IT IS NOT ACTUALLY UNREACHABLE, AND THIS IS THE PART THAT MATTERS

`-e` makes `go list` tolerate the broken packages instead of aborting. Iterating
vet per-package over that listing runs **28 of 33 packages in the same pristine
clean checkout**. Raw output, in full:

```
=== PER-PACKAGE, over the -e listing, so the analysed population is visible ===
FAIL  github.com/farmtable-io/farmtable (exit 1)
        assets.go:5:12: pattern all:web/dist: no matching files found
OK    github.com/farmtable-io/farmtable/api/farmtable/v1
OK    github.com/farmtable-io/farmtable/cmd/decomposer
FAIL  github.com/farmtable-io/farmtable/cmd/farmtable-server (exit 1)
        assets.go:5:12: pattern all:web/dist: no matching files found
FAIL  github.com/farmtable-io/farmtable/cmd/ft (exit 1)
        assets.go:5:12: pattern all:web/dist: no matching files found
FAIL  github.com/farmtable-io/farmtable/internal/cli (exit 1)
        assets.go:5:12: pattern all:web/dist: no matching files found
OK    github.com/farmtable-io/farmtable/internal/convert
OK    github.com/farmtable-io/farmtable/internal/decomposer
OK    github.com/farmtable-io/farmtable/internal/mcp
OK    github.com/farmtable-io/farmtable/internal/platform
OK    github.com/farmtable-io/farmtable/internal/platform/beads
OK    github.com/farmtable-io/farmtable/internal/platform/github
FAIL  github.com/farmtable-io/farmtable/internal/server (exit 1)
        internal/server/server.go:1509:14: assignment copies lock value to ephReq: github.com/farmtable-io/farmtable/api/farmtable/v1.GetReadyTasksRequest contains google.golang.org/protobuf/runtime/protoimpl.MessageState contains sync.Mutex
        internal/server/server.go:1619:14: assignment copies lock value to ephReq: github.com/farmtable-io/farmtable/api/farmtable/v1.GetBlockedTasksRequest contains google.golang.org/protobuf/runtime/protoimpl.MessageState contains sync.Mutex
        internal/server/server.go:1827:13: assignment copies lock value to ephReq: github.com/farmtable-io/farmtable/api/farmtable/v1.GetCriticalPathRequest contains google.golang.org/protobuf/runtime/protoimpl.MessageState contains sync.Mutex
        internal/server/server.go:2004:13: assignment copies lock value to ephReq: github.com/farmtable-io/farmtable/api/farmtable/v1.GetBottlenecksRequest contains google.golang.org/protobuf/runtime/protoimpl.MessageState contains sync.Mutex
OK    github.com/farmtable-io/farmtable/internal/serverapp
OK    github.com/farmtable-io/farmtable/internal/store
OK    github.com/farmtable-io/farmtable/internal/store/ent
OK    github.com/farmtable-io/farmtable/internal/store/ent/apitoken
OK    github.com/farmtable-io/farmtable/internal/store/ent/change
OK    github.com/farmtable-io/farmtable/internal/store/ent/collection
OK    github.com/farmtable-io/farmtable/internal/store/ent/comment
OK    github.com/farmtable-io/farmtable/internal/store/ent/enttest
OK    github.com/farmtable-io/farmtable/internal/store/ent/hook
OK    github.com/farmtable-io/farmtable/internal/store/ent/linkedaccount
OK    github.com/farmtable-io/farmtable/internal/store/ent/migrate
OK    github.com/farmtable-io/farmtable/internal/store/ent/predicate
OK    github.com/farmtable-io/farmtable/internal/store/ent/relationship
OK    github.com/farmtable-io/farmtable/internal/store/ent/runtime
OK    github.com/farmtable-io/farmtable/internal/store/ent/task
OK    github.com/farmtable-io/farmtable/internal/store/ent/user
OK    github.com/farmtable-io/farmtable/internal/store/schema
OK    github.com/farmtable-io/farmtable/internal/streaming
OK    github.com/farmtable-io/farmtable/internal/testutil
OK    github.com/farmtable-io/farmtable/internal/webguard

PER-PACKAGE TOTALS: analysed-clean=28  failed=5  denominator=33
```

**Denominator 33, clean 28, failed 5** (MEASURED, from the totals line, which
the script computed by counting rather than by my reading the list). Of the 5:
**4 are the embed failure** (`farmtable`, `cmd/farmtable-server`, `cmd/ft`,
`internal/cli`) and **1 is `internal/server`, carrying 4 real vet findings**
(MEASURED, counted from the four output lines).

**So the correct statement of EM-100 for vet is:** *`go vet ./...` cannot run in
a clean checkout and analyses zero packages; the per-package form over
`go list -e ./...` can, and covers 28 of 33.*

**This bears on the retraction.** The 12:44Z correction retracted "four
outstanding vet findings" partly on the ground that the figure "cannot have come
from a clean checkout, because go vet CANNOT RUN in one." **The caution was
right but that specific reason is not.** Four findings *are* obtainable from a
pristine clean checkout — I just obtained them, at exactly four, in
`internal/server`. The remembered figure appears to have been correct. It was
correct without provenance, which is why treating it as UNCHECKED was still the
right call; but "the number is unobtainable" is a stronger claim than the
evidence supports and I would not want it carried forward.

Also worth recording: **the coincidence is a trap.** "Four packages fail to
build" and "four vet findings" are both true and are **different fours**. The
four failing-to-build packages are not the package with the four findings.

### 6.5 Item E.4 — what I fixed, and what I filed and left alone

**Fixed: nothing.** The four findings are not in code this round touches, and
here is the provenance rather than my say-so.

They are pre-existing, and they exist **on main independently of this branch**:

```
$ cd /tmp/r9-clean && git checkout --detach cc927355 && go vet ./internal/server/
internal/server/server.go:1500:14: assignment copies lock value to ephReq: ...GetReadyTasksRequest contains ...MessageState contains sync.Mutex
internal/server/server.go:1610:14: assignment copies lock value to ephReq: ...GetBlockedTasksRequest contains ...MessageState contains sync.Mutex
internal/server/server.go:1818:13: assignment copies lock value to ephReq: ...GetCriticalPathRequest contains ...MessageState contains sync.Mutex
internal/server/server.go:1995:13: assignment copies lock value to ephReq: ...GetBottlenecksRequest contains ...MessageState contains sync.Mutex
EXIT=1
```
(Full text as printed; I have elided the repeated fully-qualified package paths
with `...` for width and nothing else. Tree still clean: `status --porcelain` 0,
verified before and after.)

Same four RPCs, same analyser, at **`real-main` cc92735** — which no commit of
this branch is an ancestor of in the relevant direction. Also present at the r8
merge-base:

```
$ git log --oneline e4e3d13..bb092d3 -- internal/server/server.go | wc -l
0
```
**0 commits touched `server.go` between the r8 merge-base and this branch head**
(MEASURED). Two commits on the branch touched it, both from earlier rounds:

```
$ git log --oneline real-main..HEAD -- internal/server/server.go
cedef7b Close the list-position and attribution gaps in the URL rejection tests
4187910 Reject non-http(s) URL schemes at the task write boundary
```

This round touched `internal/server/export_import.go` — **same package,
different file.** Under E.4 ("fix ONLY vet findings that are in code this round
already touches") these are **filed and left alone.** I did not open a vet
cleanup inside a fix round.

**Filed, for whoever gets the ticket:** four `copylocks` findings, all the same
shape — `ephReq := *req` style assignment copying a protobuf request struct,
which embeds `protoimpl.MessageState`, which contains a `sync.Mutex`. Sites:
`GetReadyTasks`, `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks`, all in
`internal/server/server.go`. **Named by identifier; the line numbers above are
pasted tool output and differ between commits, which is itself the Rule 30
argument in miniature.** A later leg should expect the diff confined to that one
file and should not treat this round's presence in the package as prior art.

### 6.6 For the record, and the post-run cleanliness re-check

```
$ cd /tmp/r9-clean && go build ./...
assets.go:5:12: pattern all:web/dist: no matching files found
go build EXIT=1
```
EM-100 confirmed independently, in a tree I made myself (MEASURED).

```
$ git -C /tmp/r9-clean status --porcelain | wc -l   (after everything: still 0?)
0
$ git -C /tmp/r9-clean clean -ndx | wc -l
0
```
**Still pristine after every command in this section** (MEASURED). Nothing I ran
created a `web/dist`, and I did not run `npm run build` to make the finding go
away.

---

## 7. SECTION 7 REBASE — ATTEMPTED, CONFLICTED, ABORTED, NOT FORCED

Done last, after all work was committed, exactly as the brief instructs.

```
$ git rev-parse HEAD
bb092d38bded3f43b81c1d40c5023644902758eb
$ git log --oneline real-main..HEAD | wc -l
71
$ git status --porcelain | wc -l
0
$ git rebase real-main
Rebasing (1/71) ... Rebasing (21/71)
Auto-merging Makefile
CONFLICT (content): Merge conflict in Makefile
error: could not apply 2f6500f... Make `make test` run this branch's own URL guard
```

**Conflict at commit 21 of 71** (MEASURED). I aborted:

```
$ git rebase --abort
$ git rev-parse HEAD
bb092d38bded3f43b81c1d40c5023644902758eb
$ git status --porcelain | wc -l
0
```
**Branch restored to the identical SHA, tree clean** (MEASURED).

### 7.1 Why I aborted rather than resolved

Three reasons, in increasing order of importance.

**a. The Makefile is shared infrastructure and the conflicting commit is not
mine.** `2f6500f` is from an earlier round of this branch.

**b. The conflict is the "upstream already did it" kind.** `2f6500f` split
`make test` into `test-go` + `test-web`. Main has since done the same thing
independently, and gone further:

```
$ git show real-main:Makefile | grep -nE "^(test|test-go|test-web|test-changed):"
43:test: test-go test-web
45:test-go:
48:test-web: web-deps
57:test-changed:
$ git show 2f6500f:Makefile | grep -nE "^(test|test-go|test-web):"
22:test: test-go test-web
24:test-go:
27:test-web:
$ git merge-base --is-ancestor 2f6500f real-main; echo $?   → NO
```
Main's version is a superset (adds `web-deps` incremental installation and
`test-changed`) and is **not** descended from `2f6500f`. Resolving means
deciding whether that branch commit is now redundant and whether its
justification comment should survive. **That is a merge decision, not a fix-leg
decision.**

**c. AND THIS IS THE ONE I ACTUALLY WANT LOOKED AT: rebasing rewrites
`af9ea8c`, and this tree cites that SHA fourteen times.**

```
$ git merge-base --is-ancestor af9ea8c real-main; echo   → NO, af9ea8c is inside the 71 rewritten commits
$ git grep -c af9ea8c
.design/project-log/2026-07-29-dev-xss-r8-fix.md:3
.design/project-log/2026-07-29-dev-xss-r9-fix.md:1
internal/server/convert.go:1
web/scripts/run-tests.mjs:1
web/src/capabilities.test.ts:7
web/src/capabilities.ts:1
```
**14 citations across 6 tracked files** (MEASURED; DERIVED total 3+1+1+1+7+1=14).
One of them is the **runtime failure message** of the acceptance test — the
string a future engineer reads when the guard breaks.

Brief section 0 requires artefacts to identify commits by SHA. Section 7
requires a rebase, which invalidates every such SHA on the branch. **These two
instructions are in tension, and it is not a tension I should resolve
unilaterally.** I am flagging it rather than stopping, because the rebase is
explicitly "NOT YOUR ACCEPTANCE CRITERIA" and the branch is in a valid state
either way.

For what it is worth, I do not think the citations should block the rebase — the
r8 log already reasoned that a log cannot cite its own SHA, and the same
fixpoint applies here. But it should be a decision someone makes, not a side
effect someone discovers.

### 7.2 The section 7 figures, re-measured after the ref move

```
$ git merge-base HEAD real-main
7a0f220dbd9332cb8db62138c841777432b4eda4
$ git rev-list --left-right --count real-main...HEAD
12	70
```
Fork point **7a0f220** and **behind 12** — both exactly as the brief states
(MEASURED). Ahead is **70** at commit `b976f48`, **71** at `bb092d3`, versus the
brief's 67; the difference is my own commits (DERIVED: 67 + 4 = 71). **The
12:44Z retraction of pre-12:35Z figures against main does not bite here — I
re-measured, and the brief's fork point and behind-count both survive the ref
move intact.** Recording this because a retraction that sweeps up correct
figures is its own cost.

---

## 8. VERIFICATION — WHAT I RAN, AND WHAT I DID NOT

Section 8.5 item 3: a green run must state what it covered.

**Ran, in the branch tree at `/workspace/farmtable-dev-xss-r9`, WITH NO
`web/dist` PRESENT:**

```
$ cd web && npm test
PASS: 5 test file(s), 483 assertions.
npm test EXIT=0
```
Covers: `capabilities.test.ts` (103), `util/assertions.test.ts` (9),
`util/safe-url.test.ts` (204), `util/url-binding-scan.test.ts` (157),
`utils/task-ready.test.ts` (10). Sum 483 (DERIVED; matches the MEASURED total).

```
$ cd web && npx tsc --noEmit
EXIT=0
```

```
$ go test ./internal/webguard/ -run '^Test' -count=1 -v
--- PASS: TestWebRemoteDataConsumersAreDeclared (0.00s)
--- PASS: TestWebRemoteDataCensusIsNonVacuous (0.00s)
--- PASS: TestWebCensusDescendsIntoShippedSource (0.00s)
--- PASS: TestWebCensusAnchoringIsTopLevelOnly (0.00s)
PASS
ok  	github.com/farmtable-io/farmtable/internal/webguard	0.013s
go test EXIT=0
```
Covers **1 package, 4 tests** (MEASURED).

```
$ gofmt -l internal/webguard internal/server/export_import.go
(no output)
```
Clean. **Scoped to the paths I touched, not to a directory** — the r8 log records
that a directory-scoped `gofmt` cell falsified its own prediction, and I did not
repeat it. `internal/server/scopes.go` is unformatted at base and I did not
touch it.

**NOT run, and NOT claimed:**

- **`make test`** — cannot pass in this tree. Bulletin 19.1 §3 and the 12:44Z
  correction both say so, and §6.6 above confirms `go build ./...` EXIT=1
  independently. The brief's §2 says "Run make test freely"; the EM has already
  corrected that himself.
- **`go build ./...`** in the branch tree — same reason, and correct:
  `go build` aborts pattern expansion.
- **`go test ./...`** in the branch tree — **not run, and MY STATED REASON FOR
  NOT RUNNING IT WAS WRONG. Corrected 13:45Z, falsified by bulletin 20 §1.**
  This line previously read "same reason" as `go build`. It is not the same
  reason: **aborting pattern expansion is a property of the verb, not of the
  tree.** `go list`, `go vet` and `go build` abort; **`go test` does not** — it
  expands fully and marks exactly the four `all:web/dist` embedders
  setup-failed, while the rest run normally and their results are valid.
  So `go test ./...` **was available to me and I wrongly believed it was not.**
  What survives: I did not run it, so I claim nothing from it. What does not
  survive: the implication that it was unavailable. Two caveats on any future
  run, both from bulletin 20: on this branch the denominator is **33, not 32**
  (`internal/webguard` is branch-only), and a **partial module cache** can make
  nearly every package report `setup failed` for a reason that has nothing to do
  with `web/dist` — the output line does not say which cause it is.
- **I did not create `web/dist`.** Creating it is one command and it would have
  turned three of these into greens. It would also have manufactured the
  artefact whose absence is finding E. **The repair that erases the evidence is
  the cheapest repair available.**

**WHICH ROOT AND WHICH DIST, as §7 demands, and as the 13:29Z constraint set
now requires of every figure of this kind:** tree **T1**,
`/workspace/farmtable-dev-xss-r9`, **no `web/dist`** — evidenced by
`ls -d web/dist` → *No such file or directory* and `git clean -ndx` listing only
`web/.tmp-test/` and `web/node_modules/`. For item E, tree **T2**,
`/tmp/r9-clean` at `bb092d3`, fully pristine, `git clean -ndx` = 0. See the tree
table in the addendum at the head of this report.

**Where mutation and execution happened:** throwaway clones **outside
`/workspace`** (`/tmp/r9-arms`, `/tmp/r9-clean`), per bulletin 19.1 §2. No
review or audit tree was built in or tested in.

**Staging discipline:** every `git add` in this round named a single full path
typed out in the command. No `-A`, no `.`, no `-u`, no `-a`, no `stash -u`, no
glob, no directory pathspec. `git status --porcelain` was checked after each
`add` and before each `commit`. No credential value was ever a command-line
argument. Nothing was pushed to any remote.

---

## 9. EVERY FIGURE IN THIS REPORT, TAGGED

| Figure | Value | Tag | Command |
|---|---|---|---|
| Branch head | `bb092d3` | MEASURED | `git rev-parse HEAD` |
| Commits this round | 4 | MEASURED | `git log --format='%h %s' --stat fb766c7^..HEAD` |
| Files touched | 7 | MEASURED | same `--stat` |
| Working tree dirt | 0 lines | MEASURED | `git status --porcelain \| wc -l` |
| Acceptance pairs | 3 pairs / 6 runs | MEASURED | `/tmp/r9-arms/arms.sh`, fixed in advance |
| Reverted arm RED | 3 of 3, EXIT=1 | MEASURED | pasted §2.4 |
| Fixed arm GREEN | 3 of 3, EXIT=0 | MEASURED | pasted §2.4 |
| New assertions | 103 | MEASURED | harness receipt `#assertions 103` |
| Suite assertions | 483 | MEASURED | `PASS: 5 test file(s), 483 assertions.` |
| `EXPECTED_ASSERTIONS` delta | +103 (380→483) | DERIVED | 483 − 380 |
| Test files | 5 | MEASURED | `Discovered 5 test file(s).` |
| Table cases | 42 | DERIVED | 7 platforms × 6 rd shapes |
| `isCollectionWritable` refs at base | 3 | MEASURED | `git grep -n … 901670e -- web/src` |
| …at head | 22 (16+1+5) | MEASURED / DERIVED sum | `git grep -c … -- web/src` |
| Authored `file:LINE` citations added | 0 (1 grep match, quoted vet output) | MEASURED / DERIVED | `git diff 901670e..HEAD \| grep -E …` |
| `Object.values(Platform)` length | 14 for 7 members | MEASURED | filtered vs unfiltered length |
| Mutants attempted | 5 | MEASURED | `/tmp/r9-arms/mutants.out`, `m4b.out` |
| Mutants killed by the suite | 4 | MEASURED | four EXIT=1 pairs |
| Mutants killed by tsc instead | 1 (M4) | MEASURED | `m4full.out`, EXIT=2 + TS2367 |
| tsc files loaded | 407 | MEASURED | `tsc --noEmit --listFiles \| wc -l` |
| …of which project sources | 58 | MEASURED | `grep -c '^…/web/src/'` |
| `ft-app.ts` in test config | 0 | MEASURED | `tsc -p tsconfig.test.json --listFiles \| grep -c` |
| tsc planted/clean pairs | 2 pairs, EXIT 2/0, no split | MEASURED | `/tmp/r9-arms/typecheck.out` |
| Module packages **at `bb092d3`** | 33 | MEASURED | `go list -e ./... \| wc -l` |
| Module packages **at `cc92735`** | 32 | MEASURED | same, after `git checkout --detach cc927355` |
| The 1-package difference | `internal/webguard`, branch-only | MEASURED | `git ls-tree -d --name-only real-main internal/` vs `HEAD` |
| Per-package vet under `GOPROXY=off` | 28 / 5 / 33, identical | MEASURED | §6.2a control loop |
| Module cache state | **partial** | MEASURED | `GOPROXY=off go mod download` reports a missing module |
| Module cache size | 518M | MEASURED | `du -sh $(go env GOMODCACHE)` |
| Packages `go vet ./...` analysed | **0** | MEASURED | `go list ./... \| wc -l` = 0 |
| `go vet ./...` exit | 1, one load-error line | MEASURED | pasted §6.3 |
| Per-package vet clean | 28 of 33 | MEASURED | script totals line |
| Per-package vet failed | 5 of 33 | MEASURED | script totals line |
| …embed failures | 4 | MEASURED | pasted §6.4 |
| …packages with real findings | 1 (`internal/server`) | MEASURED | pasted §6.4 |
| copylocks findings | 4 | MEASURED | pasted §6.4 |
| Same findings on `real-main` | 4 | MEASURED | pasted §6.5 |
| Commits touching `server.go` since `e4e3d13` | 0 | MEASURED | `git log --oneline e4e3d13..bb092d3 -- …` |
| Vet findings fixed | 0 | MEASURED | by decision, per E.4 |
| Go toolchain used | go1.26.5 | MEASURED | `cd module && go version` |
| Host Go | go1.26.1 | MEASURED | `cd /tmp && go version` |
| Rebase conflict point | 21 of 71 | MEASURED | `git rebase real-main` output |
| Behind main | 12 | MEASURED | `git rev-list --left-right --count real-main...HEAD` |
| Ahead of main | 71 | MEASURED | same |
| Fork point | `7a0f220` | MEASURED | `git merge-base HEAD real-main` |
| `af9ea8c` citations in tree | 14 across 6 files | MEASURED / DERIVED sum | `git grep -c af9ea8c` |
| webguard tests | 4, all PASS | MEASURED | `go test ./internal/webguard/ -v` |
| `gofmt -l` on touched paths | 0 lines | MEASURED | `gofmt -l <two paths>` |
| "FOUR outstanding vet findings" (inherited) | 4 | **was UNCHECKED, now MEASURED as 4** | §6.4 |
| Whether the 4 are exploitable / worth fixing | — | **UNCHECKED** | I did not assess severity |
| Whether `make test` passes anywhere | — | **UNCHECKED** | I did not run it, anywhere |
| Whether the 28 clean packages are vet-clean under other analysers | — | **UNCHECKED** | only default vet analysers ran |
| Whether earlier branch commits introduced other vet findings | — | **UNCHECKED** | I vetted head and `real-main`, not the 71 |
| Whether resolving the Makefile conflict is safe | — | **UNCHECKED** | deliberately not attempted |

---

## 10. ERRORS FOUND IN THE BRIEF

Nine. Section 4 explicitly asks for the first one.

1. **§3 header says "FOUR ITEMS", and the status line says "Four items IN".**
   Line 3: `STATUS: BOUNDED FIX ROUND. Four items IN, five items explicitly OUT.`
   Line 59: `## 3. THE NON-NEGOTIABLE ARM. READ THIS BEFORE YOU READ THE FOUR ITEMS.`
   Section 4 says: *"If you find any other place in this document that still says
   four, that is one of my errors and I want it in your error list."* Two places.

2. **§0's "branch under repair ....... url-scheme-validation-r8" is at best
   ambiguous and at worst wrong.** §0 is headed "IDENTITY" and its other rows
   are things to act on; a leg reading it as its working branch would work in
   the wrong tree, and the dispatch message had to say "do not work in
   `/workspace/farmtable`, `/workspace/farmtable-build-r8`, or any other leg's
   tree" to prevent exactly that. If the intended meaning is "the branch whose
   *work* is under repair," say so — the working branch is
   `url-scheme-validation-r9` and §1 is where it appears. **This is the lowest-
   confidence item on my list**; it may be intended as provenance rather than
   instruction.

3. **"five items explicitly OUT" does not match §5.** §5.2 lists four bullets
   (audit F8, audit F4, OP-2, review O-1..O-4 — and that last is itself four
   items collapsed into one bullet, so the count is ambiguous on its own terms),
   plus §5.1's struck vehicle. Depending on how O-1..O-4 counts, "five" is either
   right by coincidence or wrong; either way it is not derivable from the list.

4. **§2 says "Run make test freely."** It cannot pass in any tree without
   `web/dist`. Self-corrected at 12:44Z ("true as permission and false as
   expectation") — noted for completeness, and because the brief text still
   reads that way for anyone who reads it fresh.

5. **§5.1's "THE CONDITION ATTACHED TO 15.8 ... STILL GOVERNS, VERBATIM" does
   not resolve to a unique referent.** §15.8 of the r8 test report contains a
   recommendation, a measured mechanism note, and a caveat. Which one is "the
   condition" is not stated. I read it as the caveat about non-vacuity and
   satisfied it through item A's pin against `isCollectionWritable`, which I
   believe is the intent — but I had to choose, and a brief that says "verbatim"
   should not require a choice.

6. **The audit F3 remedy the brief routes me to contains a real bug, and copying
   it would have silently halved the test.** It iterates
   `for (const platform of Object.values(Platform))`. `Platform` is a **numeric**
   TypeScript enum, so `Object.values` returns the **reverse mapping too** — 14
   entries for 7 members, alternating names and numbers. Feeding the string
   `'GITHUB'` to a predicate comparing against `Platform.GITHUB` yields false for
   every string entry, so the loop would have looked like 14 cases and tested 7,
   with 7 vacuous passes propping up the count. My test filters with
   `typeof v === 'number'` and says so in a comment.

7. **§7's "go vet ... fails" understates the failure by a lot.** It is not that
   vet fails on four packages; **`go vet ./...` analyses zero of 33**, because
   pattern expansion itself aborts. §6.3.

8. **The 12:44Z retraction's stated *reason* is wrong, even though the retraction
   was right.** It says the four-findings figure "cannot have come from a clean
   checkout, because go vet CANNOT RUN in one." Four findings **are** obtainable
   from a pristine clean checkout via the per-package form, and I measured
   exactly four. Treating the figure as UNCHECKED was still correct — it had no
   command behind it — but "unobtainable" overstates the case and would mislead
   the next leg into not trying.

9. **§7 requires a rebase that destroys the SHA identifiers §0 requires.** Not a
   typo — a genuine tension between two instructions. The rebase rewrites
   `af9ea8c`, which is cited 14 times in tracked files including inside a test's
   runtime failure message. §7.1c. Per §10 of the brief I am flagging rather than
   picking, but I have not stopped, because the rebase is explicitly not an
   acceptance criterion and the branch is valid either way.

**Not errors, recorded so they are not re-raised.** §0's "exactly THREE
references tree-wide" is **confirmed exactly**, and it invited the re-measure
that confirmed it (§2.1a). §7's `67 ahead / 12 behind
and forked at 7a0f220` survives the ref move — I re-measured 12 behind and fork
point 7a0f220 against `cc92735` and both hold (§7.2). And §5.1's diagnosis of
the 15.8 vehicle is exactly right; it is the single most useful paragraph in the
brief, and following it is what stopped me writing a green test that proved
nothing.

---

## 11. THINGS I GOT WRONG DURING THE ROUND

Recorded because a report that only lists the brief's errors is not being
symmetric.

1. **I committed the test before running the arms**, then wrote in a code comment
   that the RED was observed "before this file was committed." False as an
   ordering claim. Both comments reworded to state the evidence without the
   ordering.
2. **`grep` in a pipeline masked npm's exit code** in the mutant script, giving a
   wrong EXIT for one arm. Fixed with `set -o pipefail`, and I **re-ran the whole
   M4b pair**, not the one arm that looked wrong.
3. **`$?` clobbered** by a `$(date …)` in the same `echo`. Fixed by capturing
   `rc=$?` on its own line, before anything else runs.
4. **I wrote a script inside `/tmp/r9-clean`**, which made the "clean checkout"
   non-pristine (`?? vet.sh`). Discarded that clone and re-made it, with the
   script outside the tree. Cleanliness verified before *and* after.
5. **My scripts declared the wrong Go version** — host go1.26.1, while the
   analysis was performed by go1.26.5 via `GOTOOLCHAIN=auto`. Disclosed in §6.1.
6. **`--include=*.go` eaten by zsh globbing** — the exact failure the r8 log
   documents, repeated by me one round later. Quoted it.
7. **I attributed to the TREE what is a property of the VERB.** §8 said
   `go test ./...` could not run "same reason" as `go build ./...`. Falsified by
   bulletin 20 §1: `go test` expands fully and only the four embedders fail.
   I had measured `go list`, `go vet` and `go build` all aborting, saw a clean
   pattern in three data points, and **generalised to a fourth verb I never
   ran.** Three of three is a suggestive sample, not a law, and the tell was
   available: I wrote "the failure is in pattern expansion" without asking which
   commands *do* pattern expansion eagerly. Corrected in place in §8.
8. **I reported my tree state as a label when the load-bearing variable was not
   in the tree.** My 13:30Z addendum gave `web/dist` and `node_modules` and
   called that a full qualification. The module cache is per-agent, invisible to
   every tree command, and can move a package count by 27 (bulletin 20 §3). I
   now give coordinates including the cache, plus the offline control in §6.2a.
   **The instructive part is that my label was more precise than the taxonomy
   asked for and still insufficient** — precision inside the wrong frame does
   not escape the frame.
