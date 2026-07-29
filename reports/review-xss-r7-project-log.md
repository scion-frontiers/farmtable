# Project log — `review-xss-r7` (code-review leg)

**Date:** 2026-07-29
**Leg:** code review, one of three independent legs at `e4e3d13`.
**Tree:** `/workspace/farmtable-xss-r7-review`, detached at `e4e3d13`. `web/dist` ABSENT,
`web/node_modules` ABSENT. **0 modified files at exit** (`git status --porcelain | wc -l` → 0).
**Deliverable:** `reports/review-xss-r7.md` (865 lines).
**Verdict:** **REQUEST CHANGES** — 3 Required, 0 Critical, 4 Nit/Optional, 6 FYI.

---

## What I did, in order

1. Read `_r7-COMMON.md`, then `r7-review.md`. Did **not** open `_r7-PHASE-TWO.md` until the
   cold-pass report was on disk.
2. Built the diff (`git diff c108acb..e4e3d13`, split into code and project-log halves) and
   read all 931 insertions.
3. Ran the role brief's specific instruction — resolve every load-bearing sentence against the
   source **at `e4e3d13`** — as a census rather than a spot check. That census is §R1.
4. Pre-registered `R7-REVIEW-01/02` in `_run-queue-log.md` with ROOT and DIST **before**
   running, then ran the two permitted targeted `go test` invocations.
5. Pre-registered a falsifier for my headline finding, went looking for it, did not find it.
6. Ran a five-cell mutation matrix (`R7-REVIEW-03..07`) in a `cp -a` copy at `/tmp/mut`,
   reverting each cell immediately.
7. Wrote the report.
8. **Only then** opened `_r7-PHASE-TWO.md` and the three r6 reports, and appended
   `PHASE TWO RECONCILIATION`.

## What the round is

931 insertions, 7 commits, 7 files. One behavioural change (B5 — the drop-log sampler is now
keyed per field). Everything else is comments and tests. On a workstream whose defect class is
*"a comment that states a false property of the tree"*, that makes prose the primary object of
review, which is what the brief said and it was right.

## The three blocking findings

- **R1** — 5 of 27 distinct line citations the diff **adds** do not resolve at `e4e3d13`. All
  five point into the two files this diff edited, and all five were exactly right at `c108acb`:
  the comment blocks this round inserted (29 lines in `export_import.go`, 16 in
  `capabilities.ts`) shifted their own targets downward. A security-control annotation that
  cites the control by a line number it has itself invalidated.
- **R2, the headline** — `TestWebCensusDescendsIntoShippedSource`, the test written to make B4
  falsifiable, **passes green with B4 fully reverted** (cell `R7-REVIEW-03`). Root cause named
  as a number I had not yet checked: `P2 = 0` directories under `web/` at any depth carry a
  `skipDirs` basename, so the anchored and unanchored implementations are indistinguishable on
  this tree. The guard is not wrong; it is inert, and its doc comment tells the reader otherwise.
- **R3** — argument (2) in `collectionToProto` discharges **one of two** producers of `doc` in
  `ImportCollection`; the `"beads"` branch builds `doc` as a Go struct literal, not through
  `encoding/json`. The conclusion survives (the literal omits `RemoteData` entirely), so there
  is no security defect — but the stated mechanism does not cover the stated population.

## Method notes worth keeping

- **A guard whose population is empty is indistinguishable from a guard that works.** R2 is
  R1-of-the-tests: both are cases where the *evidence* is well formed and the *population it
  ranges over* is not what the prose says.
- **Mutation testing was the only instrument that produced R2**, and the build fence read
  literally forbids it (a reviewer may not modify production code). I resolved that by mutating
  a throwaway copy outside `/workspace`. A more literal-minded leg skips those cells, which is
  how R2 survived a full round of three-way review. Filed as a suggested amendment to the fence.
- **I made the round's own defect twice.** I read the commit count out of the fix leg's project
  log (six — it omits the log commit itself) instead of out of the tree (seven), and I scored
  the PT-2 header rewrite as "unrequested" by reading the fix brief instead of the r6 report the
  brief summarised. Both are *"a population read out of an artefact rather than out of the
  source the artefact summarises."* Both are recorded in the report as self-corrections rather
  than quietly fixed, because a report that audits for a defect class should show its own
  instances of it.

## Phase two — what reconciliation added

19 prior findings across the three r6 reports: **IND 14, MISSED 2, N/A-verified-off 4,
DISAGREE 0** (rows exceed findings because two legs saw the same merge blocker). The verdict,
the severities and the three Required findings were unchanged by it.

The one thing worth escalating from reconciliation is not a finding but a **pattern**:

- r6's central defect (PO-1/F2) was a reachability argument naming three writers and
  discharging two. r7's replacement argument names a mechanism discharging one of two `doc`
  producers — **§R3**.
- r6's guard (test-F1) pruned by basename at arbitrary depth. r7's fix is correct and its guard
  cannot see it — **§R2**.
- r6's project log (PT-1) shipped a canary table whose cells were not commensurable. r7's log
  ships a canary matrix in which cell R7-04 mutates `skipDirs` **data** rather than the matching
  **expression** B4 changed — **§3 of the reconciliation**, found cold.

Three independent recurrences of the defect class the round was convened to eliminate. That is
the argument for R2 being Required rather than FYI: the round's problem is not any one comment,
it is that its verification instruments keep ranging over the wrong population.

My one disagreement is with a fix-leg self-report: it calls the two mis-transcribed compile
receipts an accuracy error and says they "still hold". They are a **provenance** error.
`/tmp/r7-b5.a` and `/tmp/r7-b2.a` do not exist in my container, so those mtimes are now
permanently unfalsifiable claims in immutable commit messages. The underlying proposition
survives only because I re-established it on my own receipts (`R7-REVIEW-01/02`). The right
disposition is to stop citing the mtimes, not to defend them.

I verified self-report 1's **stated cause**, not just its discrepancy: the pre-registered 6 is
exactly `remotedata_log_test.go`'s post-edit `^func Test` count (3 at `c108acb`, 6 at
`e4e3d13`), while the `-run` filter selects 13 package-wide functions yielding 49 `=== RUN`
lines. The cause is arithmetically the number, not a plausible reconstruction.

## Fence and scope compliance

- No push, from any ref, at any point.
- No production code modified in the review tree. All mutation ran in `/tmp/mut`.
- No build token requested or used. No `go build ./...`, `go vet ./...`, `go test ./...`,
  `make test`, `npm test`.
- Two targeted `go test` runs, both pre-registered in `_run-queue-log.md` with ROOT and DIST
  filled in **before** execution, including on the lines expected to pass. My DIST column
  reads ABSENT where the fix leg's read PRESENT; the divergence is recorded in the log, and it
  turned out to matter (§FYI-3).
- Contacted `eng-manager` only. No contact with the other two legs, the coordinator, or a human.

## Recommendation to the EM

Not a specialist escalation. All three Required findings are cheap: two are comment edits
(cite by symbol, and make the descent test's doc comment true), one is a test that would
actually fail — a `t.TempDir()`-rooted unit test of the matching expression, which is the only
way to make B4 falsifiable on a tree where `P2 = 0`.
