# ts-diff-r8 — compiling the r8 round's TypeScript, and closing two open questions

Date: 2026-07-29 (measurements 12:50Z–13:00Z) · Agent: ts-diff-r8
Full report: `scratchpad/projects/farmtable/reports/ts-diff-r8.md`

## Why this leg existed

The r8 build differential ran `go build`, `go vet` and `go test`. Go typechecks no TypeScript,
and the round's only executable production change is three lines of TypeScript. So the round's
entire executable production delta had been read by humans and compiled by nothing. Additionally,
a 70-byte stub previously placed at `web/dist/index.html` in the build clones guaranteed the
TypeScript build step never needed to run.

Two arms, cloned from the local path into `/tmp` (never from the network remote), verified
credential-free:

- BASE `e4e3d1352809428a5dfe386bb53c0b18a562332f`
- HEAD `901670e3f09ad57386cafb8359017d8d61a75070`

`web/dist` was never created, on either arm, at any point.

## TREE STATE — WHICH TREE THESE FIGURES CAME FROM

Every build, vet, test and package-count figure below was taken in a **PRISTINE tree**: the two
throwaway `/tmp` clones above, verified from the measuring container as having zero untracked
entries, no dirty tracked files, and **no `web/dist`**. The only non-repository content was
gitignored `web/node_modules`, a build input required by `npm ci`, not frontend build output.
**None of these figures came from the main working copy**, which is a *built* tree and has been
since 27 July — a distinction that changes what whole-project commands do and which no earlier
report qualified.

**Coordinates rather than a label**, since a label routes figures to a bucket that does not
predict them: `web/dist` **absent**; `node_modules` absent at clone, **present** from `npm ci`
onward and therefore during all Go measurements; module cache **cold at first build, warm after**
(`GOMODCACHE=/home/scion/go/pkg/mod`, per-agent); `GOPROXY` live; `GOFLAGS` empty.

**Aborting pattern expansion is a property of the verb, not the tree.** `go list`, `go vet` and
`go build` abort at exit 1 with zero packages analysed. `go test` does not — it expands fully and
marks setup-failed exactly the four packages that embed `all:web/dist` (`farmtable`,
`cmd/farmtable-server`, `cmd/ft`, `internal/cli`). The other packages run normally and their
results are valid. `internal/server` is **not** among the four, which is the only reason the
flake dataset below exists at all.

Two figures that look like a contradiction and are not. Central measurement at commit `cc92735`
reports 8 ok / 32 packages; this leg at `e4e3d13` reports 9 ok / 33. **Both are correct.**
`cc92735` is on a divergent branch (neither ancestor nor descendant of either r8 arm) and
`internal/webguard` does not exist there at all, while on both r8 arms it exists with tests — the
same package this round grew by 171 test lines. So the package *total* is commit-specific and
should always carry its commit; the durable invariant is **exactly four setup-failed, named**,
which reproduced identically across divergent commits, different cache states and different proxy
settings.

A related distinction worth keeping: a cold module cache under `GOPROXY=off` collapses the run to
zero packages, and a partial one fails every package that has tests — for reasons having nothing
to do with `web/dist`, and the `setup failed` line does not say which cause it is. This leg's run
was cold-cache but network-live, so it populated rather than collapsing. That makes it a positive
control for the distinction: the discriminating variable is cache state × proxy reachability, not
tree state.

**The four embed-blocked packages, derived structurally.** From the pristine base clone,
`go list -deps` shows `internal/cli`, `cmd/ft` and `cmd/farmtable-server` all reaching the root
`farmtable` package (and failing with the embed error), while `internal/server`, `internal/webguard`
and `internal/store` do not reach it and list clean. The four are therefore root + the three that
import it, derived from the import graph rather than from a test run — a stronger footing for the
flake dataset below than the passing run originally cited. `go list` aborts per-package too,
consistent with the verb finding.

Refinement worth keeping: the tree contains **two** real `go:embed` directives, not one —
`assets.go:5` (`all:web/dist`) and `internal/decomposer/prompt.go:9` (`prompt_default.txt`, which
is present in-tree and so never fails). The precise invariant is "exactly one *web/dist* embed
directive"; the looser phrasing invites the inference that no package can ever be embed-blocked
for another reason.

## What was found

**1. The TypeScript compiles, and the instrument was proven before the result was trusted.**
`npx tsc --noEmit` exits 0 on both arms, 3/3 interleaved runs each. The green is load-bearing
because it was validated: `--showConfig` confirms `npx tsc --noEmit` resolves the *root*
`tsconfig.json` (`include: ["src"]`, 56 files) and that `ft-app.ts` is in the population; a type
error planted inside `isCollectionWritable` — the exact function the round changed — produces
`error TS2322`, exit 2. The file was then restored and the tree reconfirmed clean.

This matters because `npm test` is blind at that same site: `tsconfig.test.json` overrides the
root `include` with `["src/**/*.test.ts"]` and no test file imports `ft-app.ts`. The web suite's
`PASS: 4 test file(s), 380 assertions` (3/3, both arms) is a statement about the test files and
says nothing about the three production lines.

**Correct reading: the three executable lines typecheck and the web suite passes. That is not the
same as the round being safe, and it should not be read wider.**

**2. The round's delta was re-measured, not carried.** "Three executable lines of TypeScript" is
confirmed exactly — `ft-app.ts:278`, the `Platform.GITHUB` guard. `capabilities.ts` is
comment-only. The three *production* Go files (`convert.go` +69, `export_import.go` +56,
`webguard/doc.go` +35) were not taken on trust: parsing each at both commits with `go/parser`
without `ParseComments` and diffing the rendered ASTs shows all three **AST-identical**. They are
provably comment-only.

**3. The clean-checkout Go build (base arm) confirms the relayed claims exactly.**
`go build ./...` and `go vet ./...` both exit 1 with byte-identical
`assets.go:5:12: pattern all:web/dist: no matching files found`. `go test ./...` fails setup for
exactly four packages — root `farmtable`, `cmd/farmtable-server`, `cmd/ft`, `internal/cli` —
against a population of 9 ok and 20 with no test files (33 total). No disagreement with the relay.
Not fixed, by instruction.

**4. `TestWatchTasks_CreatedEvent` — the flake is now attributed, though not explained.**
Ten interleaved runs (5 per arm, count fixed in advance) of `go test ./internal/server/ -count=1`
produced **zero reds on either arm**. That is a real result but a weak one: the container was
quiet, and it is not evidence the flake does not exist.

The strong result is structural rather than statistical. `internal/server`'s only changes this
round are the two comment-only files above, and `watch_test.go` is untouched — so the package's
executable content is *identical* across arms. **The flake cannot be a regression introduced by
this round, because there is no executable delta in that package for a regression to come from.**
That holds independently of sampling and of load.

An attempt to demonstrate this at the binary level *failed as an instrument* and is recorded as
such: the compiled test binaries differ (9.26 MB of ~41.4 MB differing). This is expected from a
comment-only change — added comment lines shift source line numbers into DWARF, pclntab and the
build ID — so binary comparison is too blunt here. The AST comparison is the sound instrument.

The LOST-EVENT race hypothesis for the flake's mechanism remains **UNCHECKED**; nothing measured
here supports or refutes it. Reproducing it needs load, not more quiet runs.

## Methodological notes worth keeping

- **Interleaving plus a pre-declared, fixed run count**, written to the report file *before* the
  first build command ran. No early stop on a clear pattern, no extra runs on an unclear one.
- **A zero needs its population.** A green typecheck was not reported until the file list was
  shown to contain the changed file, and a green package was not reported until the named test
  was shown to have executed.
- **A green instrument should be made to go red once.** The planted-type-error control is what
  separates "nothing is wrong" from "nothing is being looked at" — and here it directly
  distinguished `tsc` from `npm test` at the same source line.
- **Common-mode factors were ruled out by measurement, not assertion:** `package.json`,
  `package-lock.json` and `tsconfig.json` are all unchanged across the round, so dependency
  resolution and compiler configuration cannot manufacture a divergence between arms.
- All work ran after the 12:33Z build-rationing lift, so no arm straddles that load discontinuity.

## Durability findings from this leg's wind-down (worth keeping for future legs)

These came out of the archival step, not the differential, but they are general and each one was
measured rather than reasoned.

- **`git bundle create --all` DOES NOT PACK UNREACHABLE OBJECTS.** Verified by restoring into an
  empty bare repo: 308 unreachable commits were silently dropped, with no warning and rc=0. The
  bundle looked complete by every check short of a restore. Fix that worked: promote the
  unreachables to real refs (`refs/preserve/*`) first, then bundle. Complete bundle for this leg
  is `bundles/ts-diff-r8-complete.bundle` (4,077,623 B, 724 refs, restore-verified — 723 refs
  back, 0 of 308 unreachables missing). The earlier `ts-diff-r8.bundle` (2,867,963 B, 209 refs) is
  the defective one and is retained deliberately as an audit specimen.
  **A bundle is not verified until it has been restored.** Size and ref count do not detect this.
- **`git fsck` treats reflogs as reachability roots**, so it will not report an object that only a
  reflog keeps alive. Object-existence sweeps should enumerate reflog SHAs explicitly and
  `cat-file` each one; fsck alone gives a false all-clear.
  **Pooled across the whole operation this inverted the intuition** (figures from
  `farmtable-em-hardening`, DERIVED here, not measured by this leg): the fsck sweep found
  *nothing* genuinely at risk on any leg, while the reflog sweep found *everything* — 21 at-risk
  objects on `dev-xss-r9`, 8 on `dev-scopedeny-93`, and the one real `test-xss-r8` object, all on
  the reflog side, intersection with fsck zero. The fsck sweep moved ~1 MB of bundle per leg and
  preserved nothing that was not already durable. The cheap step everyone wants to skip is the
  only one that paid. Final yield across thousands of enumerated objects: **three** commits that
  existed only on local disk, one of them (`32255b0`) a deliverable absent from canonical entirely.
- **`git bundle verify` is unreliable in both directions** — observed false-PASS on deficient
  bundles and false-FAIL on bundles that restore perfectly (when run outside a repo). Do not use
  it as the check. Restore into an empty repo and probe for named objects, with a negative control.
- **In a leg tree, `origin` is the local canonical clone, NOT GitHub**, and canonical's fetch
  refspec is heads-only. "It's on origin" therefore does not mean "it's on the network remote" —
  two tips reported as on-origin elsewhere on this project were not on GitHub. Closed here by a
  targeted `ls-remote origin refs/heads/main` (stderr redacted, not suppressed):
  GitHub `main` = `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f` = canonical `main`, and both r8 arms
  are ancestors of it, so the round is genuinely on GitHub.
- **Resolve a branch by name, never via a bare fetch or HEAD.** Canonical's HEAD is the feature
  branch `task-state-web-ui-v2` (`633f8f26`), which is *not* an ancestor of `main` — a bare
  `git fetch <path>` hands back that tip and any ancestry test against it reads as "unreachable"
  almost everywhere. Use `git -C <repo> rev-parse main`, or an explicit `refs/heads/*` refspec.
- **A leg cloned into `/tmp` IS NOT ON THE SAME FILESYSTEM AS THE HOST, and a host-side sweep
  cannot see it.** Measured: `/tmp/tsdiff/{base,head}` are `st_dev 1048722` (overlay,
  container-local); `/workspace/farmtable` and `/scion-volumes/scratchpad` are both `st_dev 2049`
  (`/dev/root`, host-backed). The failure is silent and in the worst direction — a NOT-FOUND from a
  host-side sweep is **string-identical** to a leg that genuinely has nothing to preserve. Worse,
  fetching a container path like `/tmp/tsdiff` *from another container* resolves against that
  container's own `/tmp`, so a name collision succeeds against the wrong repository and exits 0.
  **The direction is not symmetric:** the leg can read the host, the host cannot read the leg, so
  only the leg can answer "is anything of mine container-only?" — and it must show a firing
  negative arm, because its zero and the sweep's blindness produce the same output.
  For this leg the answer was a real zero, over the **full object store** of all five overlay
  repos: 33,507 objects / 4,722 commits, **0 absent** from canonical, negative-control rc printed
  (=1) on every row. Also verified that none of the six repos uses a gitfile, linked worktree, or
  `objects/info/alternates` — a path on `st_dev 2049` can still keep objects on the overlay, so
  check `--absolute-git-dir`, `--git-common-dir`, `objects/` and alternates, not just the directory.
- **ENUMERATING A REPO BY REFS OR BY REACHABILITY UNDERCOUNTS THE STORE, SILENTLY.** Measured on
  `/tmp/bundlecheck`:
  ```
  for-each-ref                    ->    1 ref        (hiding 672 commits)
  rev-list --objects --all        -> 3710 objects    (reachable only)
  cat-file --batch-all-objects    -> 5227 objects    <- the store
  ```
  This leg first reported populations of 491/489 for its two clones; the true stores hold 1045 and
  980 commits. **The conclusion did not move — 0 absent either way — which is precisely why it was
  nearly missed.** A wrong population and a right population produce an identical zero, so no
  amount of re-reading the answer exposes it; it surfaced only because a population of `1` was
  implausible on its face. The corollary to "a zero is meaningless without its population" is that
  **the population itself has to be checked** — a zero over 1 and a zero over 672 read the same.
  Note the self-inflicted shape: this leg proved `git bundle --all` drops unreachable objects, then
  used a *reachability-based* spelling to verify the bundles. Same blind spot, opposite direction.
- **`for-each-ref` with a `*` glob DOES NOT CROSS `/`, and returns a clean rc=0 zero.** Measured:
  ```
  canonical:  refs/preserve  glob=3   bare-prefix=2836
              refs/netcheck  glob=0   bare-prefix=834
              refs/salvage   glob=0   bare-prefix=368
              refs/heads     glob=96  bare-prefix=207
  ```
  Use a bare prefix ending in `/`. (`rev-list --glob` *is* recursive, which is why two instruments
  can disagree.) **There is no safe "shallow namespace" exception**: `refs/heads` is the namespace
  anyone would validate the idiom on, and it still undercounts 96 vs 207 because 111 branches here
  contain a slash. Depth is a property of the *data*, not the namespace — so an idiom validated
  correctly today starts silently under-reporting the moment someone pushes `feature/x`. The
  figures in this leg's reports are unaffected: they came from *unpatterned* `for-each-ref` or from
  `git bundle list-heads`, and the restore count reconciles exactly by namespace
  (207 fresh + 1 heads + 308 preserve + 207 remotes = 723).
- **Make the gate OBJECT-TYPED, not commit-typed.** This leg's first "full sweep" enumerated 33,507
  objects and then filtered to commits before testing — leaving 28,785 trees and blobs counted but
  untested. Re-run over every object of every type: 33,507 objects (8,516 tree… i.e. blob+commit+
  tree across five repos), **0 absent**. Another leg's entire final yield was 11 trees and 7 blobs
  with *zero* commits — conflict-resolution states and superseded report revisions that no
  commit-shaped enumerator of any spelling could return. Such objects need packs, not bundles: a
  bundle requires a commit.
- **THE UNIFYING DEFECT: we control the comparison and never the population.** Five instances on
  this leg alone — refs-vs-store, reachability-vs-`--batch-all-objects`, commit-vs-object type,
  bare-vs-peeled rc, and glob-vs-bare-prefix. Every one silently returned a *subset*; every one
  produced a correct-looking zero; not one was caught by a control, because a negative arm proves
  only that the comparison can say "no" — it says nothing about whether the items you failed to
  enumerate would also have said no. **A population needs its own positive arm: a member known to
  be in the set, which must appear.** And per em-hardening: a firing negative arm and a wholly dead
  instrument are indistinguishable, so at least one arm must be required to come back *different*.
- **Name the loss event before comparing devices.** Against *host* loss, a scratchpad bundle and
  `/workspace` share `st_dev 2049` and are not redundant. Against *container* loss — the live
  exposure — the split runs the other way: the bundle is on `/dev/root` and outlives the container,
  the clone is on the overlay and does not. Same two numbers, opposite conclusions; the coordinate
  that selects between them is which failure you are insuring against.
- **`2>/dev/null` inside a verification loop is how a table gets fabricated**: the error branch
  goes quiet and every entry falls into the success bucket. Any reported zero needs a negative
  control proving the other branch can fire — here, fabricated SHA → non-zero, against
  known-present SHA → rc=0.
- **`cat-file -e`'s exit code depends on the SPELLING of the argument, not just on presence.**
  Measured on this repo, rc printed rather than inferred from a branch:
  ```
  cat-file -e <absent>            rc=1     (stderr empty)
  cat-file -e <absent>^{commit}   rc=128   fatal: Not a valid object name ...
  cat-file -e <present>           rc=0
  cat-file -e <present>^{commit}  rc=0
  ```
  So a control written `[ $rc -eq 1 ]` **fires on the bare spelling and silently does not fire on
  the peeled one**, falling through to whatever branch was defaulted — verified directly:
  `[ rc -eq 1 ]` DID NOT FIRE at rc=128, `[ rc -ne 0 ]` FIRED. Use `-ne 0`, or bind `&&`/`||` to
  the command itself, and **print the control's rc** so its absence is visible even when no test
  evaluates. Correction against this leg: the `rc=128` figure reported earlier here came from the
  peeled spelling and is not a property of absence — the bare spelling gives rc=1. The conclusions
  are unaffected (the final sweeps used the bare spelling with `if`/`else` bound to the command),
  but the number was published without its coordinate.
