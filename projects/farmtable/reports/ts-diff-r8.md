# ts-diff-r8 — the TypeScript half of the r8 build differential

Agent: ts-diff-r8 · Date: 2026-07-29 · All measurements 12:50Z–13:00Z
Re-labelled 13:30Z for tree-state qualification (figures NOT re-run — see next section).

---

## TREE STATE — WHICH TREE EVERY FIGURE IN THIS REPORT WAS TAKEN IN

Required by the coordinator's authoritative constraint set: every build/vet/test/package-count
figure must name the tree it was taken in, in band, from the process that took it.

**Every figure in this report was taken in a PRISTINE tree.** Specifically, in two throwaway
`git clone`s under `/tmp`, never in the main working copy:

```
/tmp/tsdiff/base @ e4e3d1352809428a5dfe386bb53c0b18a562332f
/tmp/tsdiff/head @ 901670e3f09ad57386cafb8359017d8d61a75070
```

Tree state verified from the same container that took the measurements:

| Property | base | head |
|---|---|---|
| tracked files dirty | none | none |
| untracked entries (`-uall`) | **0** | **0** |
| `web/dist` | **ABSENT** | **ABSENT** |
| `web/node_modules` | present (gitignored) | present (gitignored) |

The only non-repository content is `web/node_modules`, which is gitignored (hence 0 untracked
entries) and is a build *input* required by the brief's `npm ci` step, not frontend build output.
**No frontend build output existed in either tree at any point.** These are pristine trees in
exactly the sense the constraint set means, and they are *not* the main working copy — which I
never entered, built in, or read a figure from.

Ordering note, for precision: `npm ci` ran before the Go measurements, so `web/node_modules`
existed during them. It is irrelevant to the Go embed directive, which matches `all:web/dist`.

### COORDINATES, NOT A LABEL (Bulletin 20 §4)

Bulletin 20 is right that self-classifying against a label picks the nearest bucket and then
reports figures the label does not predict. My coordinates on the stated axes, for every figure
in this report:

| Axis | Value |
|---|---|
| `web/dist` | **absent** (both arms, verified at 4 checkpoints, never created) |
| `node_modules` | **absent** at clone; **present** from `npm ci` onward — so present during all Go measurements |
| module cache | **cold at first `go build`, warm thereafter** — `GOMODCACHE=/home/scion/go/pkg/mod` (per-agent) |
| `GOPROXY` | `https://proxy.golang.org,direct` — **network ON** |
| `GOFLAGS` | empty |

**This is exactly why I measured 4 setup-failed and not 31.** My cache was cold when
`go build ./...` started — 55 `go: downloading` lines — but `GOPROXY` was live, so it populated
instead of collapsing. ci-22-setup's cold cache under `GOPROXY=off` had no such escape. The
distinguishing variable is *cache state × GOPROXY reachability*, not the tree. Bulletin 20 §3 is
correct and my run is the positive control for it: same defect, cold cache, network on → 4.

### RECONCILED WITH BULLETIN 20 — BOTH FIGURES ARE CORRECT, THE DIFFERENCE IS THE COMMIT

Bulletin 20 §2 measures `ok = 8, no test files = 20, setup-failed = 4, packages = 32` at commit
`cc92735`. I measured `ok = 9, no test files = 20, setup-failed = 4, packages = 33` at `e4e3d13`.
**Neither is an error.** I resolved the one-package gap without re-running anything:

```
$ git rev-parse cc92735^{commit} -> cc927355e5a23c45bfd983cd331eb540b0a61ad5
   "Merge PR #205: stand up CI on GitHub Actions"
$ git merge-base --is-ancestor cc92735 901670e -> NO
$ git merge-base --is-ancestor 901670e cc92735 -> NO
$ git merge-base --is-ancestor e4e3d13 cc92735 -> NO
```
**`cc92735` is on a divergent branch — neither ancestor nor descendant of either r8 arm.**

The entire delta is one package, `internal/webguard`, which **does not exist at all** at
`cc92735` and exists *with tests* on both r8 arms:
```
$ git ls-tree -r --name-only cc92735 | grep -c '^internal/webguard/'   -> 0
$ git ls-tree -r --name-only e4e3d13 | grep  '^internal/webguard/'
internal/webguard/doc.go
internal/webguard/remotedata_consumers_test.go
```
Total Go package directories: **cc92735 → 32, e4e3d13 → 33.** Both totals are right for their
commit, and `8 + 1 = 9` is that same package. (It is also the package this round grew by 171
lines of tests, so it is squarely in r8's footprint.)

**CONSEQUENCE FOR THE OPERATIVE SENTENCE.** The clause "expands fully to all 32 packages" is
**commit-specific and is wrong by one on both r8 arms**, where the correct figure is 33. The
portable, defect-characterising part is the other half — **exactly FOUR setup-failed, named:
`farmtable`, `cmd/farmtable-server`, `cmd/ft`, `internal/cli`** — which the EM and I measured
identically from divergent commits, different cache states and different proxy settings. That
four is the robust invariant; the package total is not, and should carry its commit whenever it
is quoted.

### THE VERB FINDING — UPHELD, ORIGINAL WORDING RETAINED BELOW

The constraint set states: *"In a pristine tree the whole-project pattern fails outright at exit
one with zero packages analysed."* **That is true for two of the three whole-project commands I
ran and FALSE for the third.** Measured in the pristine `/tmp/tsdiff/base`:

- `go build ./...` → exit 1, **zero packages built**. Matches.
- `go vet ./...` → exit 1, **zero packages analysed**. Matches.
- `go test ./...` → exit 1, but **33 packages were processed**: 4 setup-failed, **9 ok**,
  20 with no test files. **This is NOT "zero packages analysed".**

This matters and is not a quibble. `go test ./...` in a pristine tree yields real signal from 29
packages; only the 4 packages transitively needing the `web/dist` embed fail setup. Anyone
applying "pristine ⇒ zero packages analysed" as a universal rule would wrongly discard my
9-packages-ok result and, more importantly, the entire `internal/server` flake dataset — that
package is *not* embed-blocked and ran fine, which I confirmed directly rather than assumed.

Per the standing instruction that my numbers win: **the above is what a pristine tree actually
does.** I have not re-run anything to produce it; these are the original figures, now labelled.

---

## HEADLINE (brief §9 asks for the build result in the first line)

**It does NOT all build.** `go build ./...` on a genuinely clean checkout exits 1 with
`assets.go:5:12: pattern all:web/dist: no matching files found`. The relayed claim is confirmed
exactly — same error, same exit code, same 4 setup-failed packages. Nothing new there.

**The TypeScript differential is GREEN ON BOTH ARMS, and the instrument is proven live.**
`npx tsc --noEmit` exits 0 on both arms, 3/3 runs each. A planted type error inside the exact
function the round changed makes it exit 2. So the green is a real green, not a blind one.

**The flake is UNREPRODUCED but also UNATTRIBUTABLE TO THIS ROUND — and the second half is
proven by construction, not by sampling.** See Measurement 3.

---

## PRE-DECLARED RUN SCHEDULE (written to this file before the first build command ran)

| Measurement | Command(s) | Runs per arm | Order |
|---|---|---|---|
| 1. TypeScript setup | `npm ci` (in `web/`) | 1 | base, head |
| 1. TypeScript check | `npx tsc --noEmit` (in `web/`) | 3 | interleaved base, head ×3 |
| 1. Web suite | `npm test` (in `web/`) | 3 | interleaved base, head ×3 |
| 2. Clean-checkout Go | `go build/vet/test ./...` | 1 each, **BASE only** (§9) | base |
| 3. Flake | `go test ./internal/server/ -count=1` | **5** | interleaved base, head ×5 |

Schedule was honoured exactly. No early stop, no added runs.

---

## TREES (announced at creation, per §2f)

```
/tmp/tsdiff/base  <- git clone /workspace/farmtable  @ e4e3d1352809428a5dfe386bb53c0b18a562332f
/tmp/tsdiff/head  <- git clone /workspace/farmtable  @ 901670e3f09ad57386cafb8359017d8d61a75070
```
Owner: ts-diff-r8. Both created by `git clone` from the local path. No `cp -a`/`rsync`/`tar`/`mv`.

**Both SHAs from the brief: MEASURED CORRECT.** They resolve in `/workspace/farmtable`:
```
$ git rev-parse e4e3d13^{commit} -> e4e3d1352809428a5dfe386bb53c0b18a562332f
$ git rev-parse 901670e^{commit} -> 901670e3f09ad57386cafb8359017d8d61a75070
```

### Credential verification (§2d)
```
$ git -C /tmp/tsdiff/base remote -v
origin	/workspace/farmtable (fetch)
origin	/workspace/farmtable (push)
$ grep -c -E 'github_pat_|ghp_' /tmp/tsdiff/base/.git/config || true
0
$ git -C /tmp/tsdiff/head remote -v
origin	/workspace/farmtable (fetch)
origin	/workspace/farmtable (push)
$ grep -c -E 'github_pat_|ghp_' /tmp/tsdiff/head/.git/config || true
0
```
Clean. Remotes point only at the local path.

### web/dist — NOT CREATED (§2e, the most important instruction)
Checked after clone, after `npm ci`, after all tsc/test runs, and at the end. **Absent on both
arms throughout.** No command I ran created it.
```
$ ls -d /tmp/tsdiff/base/web/dist /tmp/tsdiff/head/web/dist
ls: cannot access '/tmp/tsdiff/base/web/dist': No such file or directory
ls: cannot access '/tmp/tsdiff/head/web/dist': No such file or directory
```
I verified in advance that `npm test` emits to `web/.tmp-test` (`tsconfig.test.json` sets
`outDir: ".tmp-test"`), not `web/dist`, and that `tsc --noEmit` emits nothing. I never ran
`npm run build` — its script is `tsc --noEmit && vite build`, and `vite build` would have
created `web/dist`.

Nothing under `/workspace` was entered, built in, or modified. Read-only `git rev-parse`/`log`/
`diff` against `/workspace/farmtable` only.

---

## THE ROUND'S DELTA — I RE-MEASURED IT RATHER THAN CARRYING IT

`git diff --stat e4e3d13 901670e` — 7 files, 476 insertions, 40 deletions:

```
 .design/project-log/2026-07-29-dev-xss-r8-fix.md | 103 ++++++++++++++
 internal/server/convert.go                       |  69 +++++++--
 internal/server/export_import.go                 |  56 ++++++--
 internal/webguard/doc.go                         |  35 ++++-
 internal/webguard/remotedata_consumers_test.go   | 171 ++++++++++++++++++++++-
 web/src/capabilities.ts                          |  56 +++++++-
 web/src/components/ft-app.ts                     |  26 ++++
```

**"THREE EXECUTABLE LINES OF TYPESCRIPT": MEASURED, AND IT IS EXACTLY RIGHT.** The only
non-comment production change in the entire round is in `ft-app.ts:278`:

```ts
    if (coll.platform !== Platform.GITHUB) {
      return false;
    }
```

Three lines. `web/src/capabilities.ts` is comment-only. I did not take the Go files on trust
either — `convert.go`, `export_import.go` and `webguard/doc.go` are three *production* `.go`
files and a stat line of `+69` on `convert.go` deserved checking. I parsed each file at both
commits with `go/parser` **without** `ParseComments` and rendered the AST:

```
AST IDENTICAL (comments ignored): internal/server/convert.go
AST IDENTICAL (comments ignored): internal/server/export_import.go
AST IDENTICAL (comments ignored): internal/webguard/doc.go
```

So all three are provably comment-only, not merely comment-only by eye. The claim holds.

---

## §8 — THE SHARED-PATHWAY QUESTION, ANSWERED BEFORE RUNNING

**IS THERE ANYTHING THAT WOULD MAKE THE HEAD ARM FAIL FOR A REASON OTHER THAN THE DIFF?**

I checked the brief's four candidates before running:

- **Lockfile resolving differently at the two commits — RULED OUT, MEASURED.**
  `git diff --stat e4e3d13 901670e -- web/package-lock.json web/package.json` is **empty**.
  Neither file is among the 7 changed. Identical lockfile, identical `package.json`.
  `tsconfig.json` is also unchanged. Dependency resolution and compiler configuration are
  genuinely common-mode here and cannot manufacture a divergence.
- **npm ci reaching the network and getting a different answer — RULED OUT by the above,
  and corroborated:** both arms installed `102 packages`, `103 audited`, 79 top-level
  `node_modules` entries. Identical.
- **A cache warmed by the first arm and reused by the second — PRESENT, and it is a real
  asymmetry, but it is benign here.** Base `npm ci` took 3s, head 2s; the go module cache was
  cold on the first `go build` and warm afterwards. This affects *duration*, and it is why I
  report wall-clock separately from the package time the toolchain reports. It cannot flip a
  typecheck result given an identical lockfile and identical compiler config.
- **Wall-clock/ordering effects in the web suite — no instability observed;** all 6 `npm test`
  runs produced the same `380 assertions`.

**DID ANY ARM RUN BEFORE 12:33Z AND ANY OTHER AFTER IT?** **No. Everything ran after.** First
build command ~12:52Z, last ~13:00Z. My whole comparison sits entirely on one side of the
12:33Z rationing discontinuity, so it is not exposed to it. Stated, not inferred.

I note the §8 warning applies with real force to Measurement 3 and I have handled it there
rather than trusting a separation.

---

## MEASUREMENT 1 — THE TYPESCRIPT DIFFERENTIAL

**Tree: pristine clones `/tmp/tsdiff/base` and `/tmp/tsdiff/head`, `web/dist` absent throughout,
`web/node_modules` installed by the brief's `npm ci` step. Not the main working copy.** The
56-file tsc population and the 380-assertion suite population are both pristine-tree figures.

### 1a. Instrument verification — THIS IS THE PART THAT MATTERS

The EM's mid-run message established that `npm test` does not typecheck application source. That
makes `tsc --noEmit` the only load-bearing instrument in the task, so I verified it rather than
assuming it.

**Which tsconfig does `npx tsc --noEmit` pick up?** The ROOT one, not the test one:
```
$ npx tsc --noEmit --showConfig
include: ["src"]
noEmit: true
outDir: undefined
files count: 56
ft-app in files: true
```
```
$ npx tsc --noEmit --listFiles | grep -E 'ft-app|capabilities'
/tmp/tsdiff/head/web/src/capabilities.ts
/tmp/tsdiff/head/web/src/components/ft-app.ts
```
**Population: 56 files, and both changed TypeScript files are in it.**

**Positive control — would it actually go red?** I planted a type error *inside
`isCollectionWritable`*, the exact function the round changed, on the head arm:
```
$ npx tsc --noEmit
src/components/ft-app.ts(278,11): error TS2322: Type 'string' is not assignable to type 'number'.
CONTROL (mutated) EXIT=2
```
**The instrument fires, at the exact site, with exit 2.** This is the same location where
test-xss-r8 measured `npm test` staying GREEN — so this control demonstrates directly that
`tsc --noEmit` sees what the web suite is blind to.

I then restored the file with `git checkout -- web/src/components/ft-app.ts` (one named file, no
bulk pathspec), reconfirmed `HEAD` is still `901670e...`, the tree is clean, and post-restore
`tsc --noEmit` exits 0.

### 1b. `npm ci` — 1 run per arm, interleaved
| Arm | Exit | Output |
|---|---|---|
| base | **0** | `added 102 packages, and audited 103 packages in 3s` / `found 0 vulnerabilities` |
| head | **0** | `added 102 packages, and audited 103 packages in 2s` / `found 0 vulnerabilities` |

`npm ci` completed on both arms; §4's blocked-measurement clause was not triggered.

### 1c. `npx tsc --noEmit` and `npm test` — 3 interleaved pairs, every run reported
```
PAIR1 | base | npx tsc --noEmit | EXIT=0 | 4.54s | 0 lines of output
PAIR1 | base | npm test         | EXIT=0 | 5.05s
PAIR1 | head | npx tsc --noEmit | EXIT=0 | 4.17s | 0 lines of output
PAIR1 | head | npm test         | EXIT=0 | 3.59s
PAIR2 | base | npx tsc --noEmit | EXIT=0 | 3.38s | 0 lines of output
PAIR2 | base | npm test         | EXIT=0 | 3.52s
PAIR2 | head | npx tsc --noEmit | EXIT=0 | 3.65s | 0 lines of output
PAIR2 | head | npm test         | EXIT=0 | 3.77s
PAIR3 | base | npx tsc --noEmit | EXIT=0 | 3.82s | 0 lines of output
PAIR3 | base | npm test         | EXIT=0 | 4.90s
PAIR3 | head | npx tsc --noEmit | EXIT=0 | 3.98s | 0 lines of output
PAIR3 | head | npm test         | EXIT=0 | 4.01s
```
**12/12 green. No split. No instability in the web suite** (so no new observation to name under §3).

`npm test` population, identical on every run and both arms:
```
PASS: 4 test file(s), 380 assertions.
```

### 1d. What this does and does not mean

- **`tsc --noEmit` green on both arms: the three executable lines TYPECHECK, and the delta
  introduces no type error.** This is a real result — the population includes `ft-app.ts` and the
  instrument demonstrably reddens on a fault at that exact line.
- **The `npm test` green says NOTHING WHATSOEVER about the three executable production lines.**
  It is a statement about the 4 test files and their 380 assertions only. `tsconfig.test.json`
  overrides the root `include` with `["src/**/*.test.ts"]`, no test file imports `ft-app.ts`, so
  it is not pulled in transitively. I report the suite result solely as a statement about the
  test files, per the EM's instruction, and I did not re-derive test-xss-r8's mutation result.
- **A green on both arms does not mean the round is safe. It means the three executable lines
  typecheck and the web suite passes.** Those words, and no wider reading.
- Per review-xss-r8's pre-registered note: a red on both arms would equally have discharged the
  task. It did not arise — both arms are green — but the reasoning stands: only a *diverging*
  arm is a finding, and there was no divergence.

---

## MEASUREMENT 2 — THE CLEAN-CHECKOUT GO BUILD (BASE ARM)

**Tree: pristine clone `/tmp/tsdiff/base` @ `e4e3d13`. No frontend build output present. Not the
main working copy.** All package counts below are pristine-tree counts.

All three claims relayed as UNCHECKED are **CONFIRMED EXACTLY**. No disagreement to report.

```
$ go build ./...
assets.go:5:12: pattern all:web/dist: no matching files found
EXIT=1
```
```
$ go vet ./...
assets.go:5:12: pattern all:web/dist: no matching files found
EXIT=1
```
Byte-identical to the build error — verified with `diff` against the expected string: `IDENTICAL`.

```
$ go test ./...
EXIT=1
FAIL	github.com/farmtable-io/farmtable [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/farmtable-server [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/ft [setup failed]
FAIL	github.com/farmtable-io/farmtable/internal/cli [setup failed]
FAIL
```

**The package list I actually observed** — root `farmtable`, `cmd/farmtable-server`, `cmd/ft`,
`internal/cli` — **is exactly the relayed set of 4. Same count, same packages, same error.**
(The 5th `FAIL` line is the bare trailing summary line, not a package.)

**Population for that "4":** 4 setup-failed, **9 packages ok**, **20 packages with no test
files**. So the 4 failures sit against 33 packages examined, and 20 of those 33 contributed no
test signal at all — that is the magnitude of what this sweep skips, in the same units.

Note: `go list ./...` returns 0 lines, because listing also trips the same embed failure. That is
why the population above is counted from the `go test` output rather than from `go list`.

**I did not fix it.** No `web/dist`, no stub, no `npm run build`.

---

## ADDENDUM (13:45Z) — THE FOUR PACKAGES DERIVED FROM THE IMPORT GRAPH, IN A PRISTINE TREE

Corroborating Bulletin 20.1 §1 from my pristine `/tmp/tsdiff/base` @ `e4e3d13`. This derives the
four *structurally*, without needing a test run, and independently re-establishes the one fact my
flake dataset depends on.

```
$ go list -deps <pkg>            (root = github.com/farmtable-io/farmtable)
./internal/server        -> EXIT=0 : does NOT depend on root
./internal/webguard      -> EXIT=0 : does NOT depend on root
./internal/store         -> EXIT=0 : does NOT depend on root
./internal/cli           -> EXIT=1 : assets.go:5:12: pattern all:web/dist: no matching files found
./cmd/ft                 -> EXIT=1 : assets.go:5:12: pattern all:web/dist: no matching files found
./cmd/farmtable-server   -> EXIT=1 : assets.go:5:12: pattern all:web/dist: no matching files found
```

The four = root `farmtable` (which holds the directive) plus the three packages reaching it.
**`internal/server` does not reach it** — confirmed here from the import graph, not from a run,
which is a stronger footing for the flake dataset than the passing test run I originally cited.
Note `go list` aborts *per-package* too, consistent with the verb finding.

### TWO REFINEMENTS TO CLAIMS IN BULLETIN 20.1

**(a) "exactly ONE embed directive" is imprecise — there are TWO.** Measured:
```
$ grep -rn "go:embed" --include="*.go" . | grep -v node_modules
assets.go:5://go:embed all:web/dist
internal/decomposer/prompt.go:9://go:embed prompt_default.txt
internal/webguard/doc.go:64:                    (comment, references assets.go:5)
internal/webguard/remotedata_consumers_test.go:284:  (comment, references assets.go:5)
```
Two *real* directives; the other two hits are comments. The precise claim is **"exactly one
`web/dist` embed directive"**. `internal/decomposer/prompt.go:9` embeds `prompt_default.txt`,
which is present in-tree, so it never fails and `internal/decomposer` is correctly among the
9 ok. This matters because "exactly one embed directive" invites the inference that no package
can ever be embed-blocked for another reason; the durable invariant is the narrower one. (The two
comment hits are both in `internal/webguard` — the package that distinguishes the two commits.)

**(b) ARM 1 of the check-ignore finding reproduces here, in a genuinely pristine tree:**
```
$ git check-ignore -v web/dist        -> exit 1, no output    (web/dist ABSENT; I did not create it)
$ git show HEAD:.gitignore | sed -n 17p -> dist/
```
Consistent with Bulletin 20.1: the pattern `dist/` matches directories only, `check-ignore`
consults the disk rather than a hypothetical, so exit 1 here is the honest answer and is *wrong
about what happens when you build*. I tested only ARM 1 — reproducing ARMs 2 and 3 requires
creating `web/dist`, which item 10 prohibits, so I did not.

---

## MEASUREMENT 3 — RE-CHARACTERISING THE FLAKE

**Tree: pristine clones `/tmp/tsdiff/base` and `/tmp/tsdiff/head`, no frontend build output in
either. Not the main working copy.** This matters for the flake specifically: the original red
was observed elsewhere, and tree state is a candidate difference between that observation and
mine, alongside load.

`internal/server` is **NOT** one of the four embed-blocked packages — I confirmed that myself
before relying on it, as instructed:
```
$ go test ./internal/server/ -count=1
ok  	github.com/farmtable-io/farmtable/internal/server	0.568s
```

### Pre-declared: 5 runs per arm, interleaved. Every run reported.
```
RUN 1 | base | EXIT=0 |  1.78s | ok  ...internal/server  0.561s
RUN 1 | head | EXIT=0 |  9.29s | ok  ...internal/server  0.572s
RUN 2 | base | EXIT=0 |  1.81s | ok  ...internal/server  0.590s
RUN 2 | head | EXIT=0 |  1.98s | ok  ...internal/server  0.575s
RUN 3 | base | EXIT=0 |  1.79s | ok  ...internal/server  0.552s
RUN 3 | head | EXIT=0 |  1.78s | ok  ...internal/server  0.577s
RUN 4 | base | EXIT=0 |  1.77s | ok  ...internal/server  0.578s
RUN 4 | head | EXIT=0 |  1.77s | ok  ...internal/server  0.562s
RUN 5 | base | EXIT=0 |  1.84s | ok  ...internal/server  0.592s
RUN 5 | head | EXIT=0 |  1.80s | ok  ...internal/server  0.573s
```
**Zero reds on either arm across ten runs.** I did not stop early and did not add runs.

The 9.29s on run 1/head is **wall-clock including a cold compile of the head arm's test binary**;
the toolchain-reported package time was 0.572s, in line with every other run. It is a cache
artefact, not a slow test.

### Population check (not part of the 5-pair schedule; an instrument check)
A green package is meaningless if the named test did not execute. It did, on both arms:
```
=== RUN   TestWatchTasks_CreatedEvent
--- PASS: TestWatchTasks_CreatedEvent (0.01s)   [base]
--- PASS: TestWatchTasks_CreatedEvent (0.00s)   [head]
```
`internal/server` contains **235 test functions**; the 10 runs above exercise all of them.

### The required wording
**The flake is load-dependent and my container is quiet. That is a REAL result. It is NOT
evidence the flake does not exist.** Ten quiet-container runs cannot rule out a defect whose
trigger is concurrent load I cannot see or generate from inside this container.

### THE PART THAT ACTUALLY SETTLES IT — and it is not the ten greens

The dispatch warned that where a confound shares a causal pathway with the intervention, a wide
separation between arms proves nothing. Here the point cuts the other way and much harder:

**There is no intervention in this package at all.** `internal/server`'s only changes in this
round are in `convert.go` and `export_import.go`, and I proved above by AST comparison that both
are **comment-only**. `watch_test.go` is not among the 7 changed files. The executable content of
`internal/server` is *identical* on the two arms.

Therefore **`TestWatchTasks_CreatedEvent` cannot be a regression introduced by this round** — not
because ten runs came back green, but because there is no executable delta in that package for a
regression to come from. That conclusion is independent of my sampling and independent of load.

I tried to demonstrate this at the binary level and **that attempt failed as an instrument** —
reporting it because it is a measurement I took:
```
$ sha256sum base-server.test head-server.test
36f7d2ab...  base-server.test
ca908b99...  head-server.test
DIFFER (9,261,082 differing bytes of ~41.4 MB; sizes differ by 8 bytes)
```
The compiled test binaries are **not** identical. This does **not** contradict the above: the
comment additions shift source line numbers, which propagate into DWARF and pclntab metadata and
into the Go build ID, so widespread byte differences are expected from a comment-only change.
Binary comparison is simply too blunt here. **The AST comparison is the sound instrument and it
is the one I rely on.** I am flagging the failed one rather than quietly dropping it.

### So what is the flake?
**Still UNCHARACTERISED as to mechanism, but now ATTRIBUTED: it is pre-existing, not this
round's.** The original 5.01s-vs-0.013s observation remains unexplained by my data — I never
reproduced a red. The LOST-EVENT race hypothesis handed to me is **UNCHECKED**; I did not test
it, and nothing I measured either supports or refutes it. Whoever picks it up needs load, not
more quiet runs — ten more of mine would add nothing.

---

## TAGGED FIGURES

| Figure | Tag |
|---|---|
| Both commit SHAs resolve as given | MEASURED |
| "Three executable lines of TypeScript" is the round's only executable production change | MEASURED — correct |
| The 3 Go production files are comment-only | MEASURED (AST, comments stripped) |
| `tsc --noEmit` exit 0 on both arms, 3/3 each | MEASURED |
| `tsc --noEmit` population = 56 files, includes `ft-app.ts` | MEASURED |
| `tsc --noEmit` reddens on a fault in `isCollectionWritable` (exit 2, TS2322) | MEASURED |
| `npm test` = 4 files / 380 assertions, 3/3 green both arms | MEASURED |
| `npm test` does not typecheck app source | Relayed from test-xss-r8; corroborated by my `--showConfig` reading of `tsconfig.test.json` — DERIVED |
| `go build`/`go vet` exit 1, identical embed error | MEASURED |
| Exactly 4 setup-failed packages, and which 4 | MEASURED — matches relay |
| 9 ok / 20 no-test-files / 4 failed | MEASURED |
| `internal/server` not embed-blocked | MEASURED |
| Flake: 0 reds in 10 interleaved runs | MEASURED |
| Flake cannot be this round's regression | DERIVED from the AST-identity measurement |
| LOST-EVENT race as the flake's mechanism | **UNCHECKED** — not tested |
| Whether the round is *safe* | **NOT ESTABLISHED** — outside what I measured |

## DISAGREEMENTS WITH THE DISPATCH

**None.** Every relayed figure I checked — both SHAs, the three-executable-lines claim, the
embed error text, the four-package list — came back matching. Stated explicitly because the
instruction was to call out disagreement loudly, and silence should not be read as skipped.

## COMPLIANCE

No push. No bulk staging — the only `git add`-family command used was
`git checkout -- web/src/components/ft-app.ts`, one named file. No credential on any command
line. No tree under `/workspace` entered, built in, or modified. `web/dist` never created.
Both clones left clean at their pinned SHAs.
