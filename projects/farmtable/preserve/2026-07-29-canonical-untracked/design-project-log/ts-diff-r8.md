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
