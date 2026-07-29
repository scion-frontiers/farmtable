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
- **`2>/dev/null` inside a verification loop is how a table gets fabricated**: the error branch
  goes quiet and every entry falls into the success bucket. Any reported zero needs a negative
  control proving the other branch can fire — here, fabricated SHA → rc=128 with
  `fatal: Not a valid object name` visible, against known-present SHA → rc=0.
