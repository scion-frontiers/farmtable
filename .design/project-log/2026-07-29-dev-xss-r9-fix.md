# URL Scheme Validation — Round 9 Fix Leg

Date: 2026-07-29
Branch: `url-scheme-validation-r9`
Base at start: `901670e3` (r8's tip)
Rebased onto: local `real-main` = `cc927355`
Commits: `fb766c7`, `2738599`, `b976f48`, and the one carrying this line.

> The last clause is inherited from R5 and R8 for the reason they gave: **a log
> cannot cite the SHA of the commit that carries it.** Writing the SHA in
> changes the tree, which changes the SHA. SHAs above are pre-rebase; the
> rebase rewrites them and that is expected.

Verdict: **five items closed, one of them a diagnostic that returned a worse
result than the brief predicted.** Not pushed.

---

## What this round was

Five bounded items from `briefs/dev-xss-r9-fix.md`. Full measurement record,
including every individual run of every interleaved arm, is in
`reports/dev-xss-r9-fix.md`. This entry records only what a later leg needs.

**A + C — the r8 behavioural change is now pinned, and pinning it required
moving it.** `af9ea8c` added a three-line platform guard to
`isCollectionWritable`, which was a **private method on the `FtApp` Lit
element** and therefore unreachable from a node test. The r8 log had already
worked out that `npm test` could not see `ft-app.ts` at all. So the guard
shipped with no test that could go red on its removal.

The remedy was not to test something nearby. `getCapabilities` is the tempting
vehicle and the wrong one — it contained **both** conjuncts before r8, so it is
green on the defect in both directions and a test of it certifies nothing. r9
lifted the predicate into `web/src/capabilities.ts`, exported it, and left the
two implementations **separate on purpose**: defining one in terms of the other
would make the agreement assertion tautological. `web/src/capabilities.test.ts`
(103 assertions, three arms) pins the guard, the two readers' agreement across
the whole platform enum, and the fact that `ft-app.ts` still routes through the
shared predicate rather than carrying a private copy.

**B — review R-1: the gated set is now named by identifier, not counted.** Two
prose sites said how *many* operations the capability gate covers. A count is a
population claim with nothing guarding it: flip one flag in
`GITHUB_CAPABILITIES` and the number is false with nothing red. Both now name
the set. **No `file:LINE` citation was written anywhere in this round's prose**
— an annotation displaces the line it cites, so a line number in a cross-file
citation is stale from the commit that writes it.

**D — the r8 log said "F1 VERIFIED" and the instrument was a typechecker.**
Corrected in place to TYPECHECK-VERIFIED with an annotation at each site. See
that file.

**E — `go vet` from a genuinely clean checkout. This is the one to read.**

## The three things a later leg should know

**`go vet ./...` DOES NOT ANALYSE 4 PACKAGES IN A CLEAN CHECKOUT. IT ANALYSES
ZERO.** From a pristine clone (`git status --porcelain` = 0 lines, no
`web/dist`, no `node_modules`):

```
$ go vet ./...
assets.go:5:12: pattern all:web/dist: no matching files found
EXIT=1
```

That is the entire output. The failure is in **pattern expansion**, not in four
packages: `go list ./...` returns **0 packages**, so the population vet examined
is 0 of 33. The commonly repeated form of EM-100 — "four packages cannot be
built" — understates it. Nothing is analysed. Any clean-checkout vet claim of
the form "N findings" that was produced with `./...` was produced by a command
that inspected no code.

**BUT THE FINDINGS ARE STILL REACHABLE FROM A CLEAN CHECKOUT, AND THE WAY TO
REACH THEM MATTERS.** Iterating per-package over `go list -e ./...` (the `-e`
tolerates the broken ones instead of aborting) gives denominator **33**, **28**
clean, **5** failed: four embed failures (`farmtable`, `cmd/farmtable-server`,
`cmd/ft`, `internal/cli`) plus `internal/server`, which carries **four
copylocks findings** in `server.go`. So the correct statement is not "vet cannot
run in a clean checkout" — it is "`go vet ./...` cannot, and the per-package
form can, over 28 of 33 packages."

**THOSE FOUR COPYLOCKS FINDINGS ARE PRE-EXISTING AND WERE DELIBERATELY LEFT
ALONE.** They reproduce identically at the r8 merge-base `e4e3d13` and at
`real-main` `cc92735`, and `git log e4e3d13..HEAD -- internal/server/server.go`
is **0 commits**. This round touched `internal/server/export_import.go` — same
package, different file. The brief scopes vet repair to code the round already
touches, so they are filed and not fixed. They are `assignment copies lock value
to ephReq ... contains sync.Mutex`, four sites in `server.go`. **A later leg
that fixes them should expect the diff to be confined to that file and should
not treat this round's presence in the package as prior art.**

## The methodological thing, because it changed a result

Every before/after comparison this round is **interleaved** — arms alternated in
pairs on a schedule fixed before the first run, both arms re-run or neither,
every individual run reported. That is not ceremony. It caught a real problem:

**Mutant M4 produced no test failure and the reason was not that the test is
weak.** The mutation (`getCapabilities` dropping its GITHUB check, rewritten as
`!== Platform.FARMTABLE`) was caught by **tsc**, before any test ran:
`error TS2367: This comparison appears to be unintentional ... no overlap`. Had
that been reported as "the test caught it", the credit would have gone to the
wrong instrument. It was replaced with M4b (`=== GITHUB || === LINEAR`), which
typechecks cleanly, and *that* produced the agreement-arm RED. **A mutant your
compiler rejects is not a test of your tests.**

Two smaller ones in the same family: a `grep` in a pipeline masked npm's exit
code until `set -o pipefail` went in, and the declared Go toolchain version was
measured in the wrong shell — the host `go` is go1.26.1, but inside the module
`GOTOOLCHAIN=auto` selects the go1.26.5 that `go.mod` asks for, so the analysis
was performed by a toolchain the script did not name.

## Deliberately not done

`make test` and `go build ./...` were **not run in this tree** and are not
claimed. Neither can pass without `web/dist`, and creating it would manufacture
the artefact whose absence is the finding. Scoped runs are what is claimed:
`npm test` (5 files, 483 assertions), `npx tsc --noEmit` (exit 0), and
`go test ./internal/webguard/` (4 tests). **Which root and which dist: the
branch tree at `/workspace/farmtable-dev-xss-r9`, with no `web/dist` present.**

> **ADDED 13:30Z, per the coordinator's constraint set: every build, vet, test
> or package-count figure must name the tree it was taken in.** Three trees were
> used and none of them is the main working copy:
>
> - **T1** `/workspace/farmtable-dev-xss-r9` — tracked-clean, **no `web/dist`**,
>   has `web/node_modules/` and `web/.tmp-test/`. Source of the web and
>   `webguard` figures above.
> - **T2** `/tmp/r9-clean` — **fully pristine**, `git clean -ndx` = 0. Source of
>   every `go vet` / `go list` / `go build` figure in this entry.
> - **T3** `/tmp/r9-arms` — mutation clone, same state as T1. Source of the
>   interleaved arms and mutants.
>
> **T1 and T3 are a tree state the project's taxonomy does not yet name:** no
> `web/dist` but `node_modules` present, so they behave as a pristine tree does
> for Go commands and as a built tree does for web commands. Every Go figure
> here comes from T2 regardless. No built frontend was created or deleted
> anywhere by this round, and both throwaway clones were made from the local
> path on this host, not from a network remote.

Audit F8, audit F4, OP-2, review O-1..O-4, and the struck 15.8 remedy vehicle
were out of scope and were not touched.

## One thing that changed underneath this round

The `webguard` remote_data census went **RED** when the predicate moved, which
is the guard doing its job — the declared consumer list is exact-text and
exact-multiplicity, and two of its entries were filed against `ft-app.ts`. It
was repaired by re-filing the entries and declaring the new test fixture, not by
relaxing the guard. Its non-vacuity control had to be **re-keyed from file→text
to text→file**, because both known consumers now live in one file and a
file-keyed map silently collapses to one entry. That collapse would not have
been visible; it was found by mutation (M5), not by reading.
