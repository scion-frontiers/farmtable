# import-hardening — code review, round 3

**Date:** 2026-07-29
**Reviewer:** code-reviewer leg (`farmtable-review-ih-r3`)
**Artefact:** `f487dc566dc9f6b89255d15501a8c4111338c4ec` (`f487dc5`), base `43bd20627e0b07c50f113fda266117d419a9b4ad` (`43bd206`), 5 commits
**Branch ref:** `refs/salvage/farmtable-import-hardening/import-hardening` in `/workspace/farmtable`. There is **no** `refs/heads/import-hardening`; a bare `git rev-parse import-hardening` exits 128 there.
**Full review:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-import-hardening-r3.md`

## Verdict

**REQUEST CHANGES.** Risk level LOW. Four blocking findings — one in code, three in the accompanying report. No Critical findings.

## Round-3 disposition of the five prior items

| Item | Developer's claim | Verified at `f487dc5` |
|---|---|---|
| REQ 1 — unforgeable provenance | No new work, per instruction | **Confirmed.** No belt-and-braces guard added. |
| REQ 2 — refusal names the cause | Implemented, plumbed at wiring time | **Implemented and well-tested — but its user-facing string is false in one reachable configuration.** See R3-1. |
| R-1 — task-less import writes no provenance | Claim corrected, code deliberately untouched, A14 not duplicated | **Confirmed on all three counts.** |
| Item 3 — canary attribution | Narrowed to one subcase, enforced at runtime | **Confirmed.** `newControl bool` + `if newControls != 1 { t.Fatalf }` at `export_import_provenance_test.go:381-388`. |
| N-1 — unreachable `json.Marshal` branch | Taken | **Confirmed**, with a comment recording the restore condition at `export_import.go:559-565`. |

## Gate, independently replicated at `f487dc5`

Not taken on trust. The CI membership gate was re-derived from `.github/workflows/ci.yml` against my own `go test ./... -v` run in a private `--local` clone.

- **32 packages** from `go list ./...`; **32 package result lines** recognised by the CI parser.
- `go build ./...` exit 0; `go vet ./...` exit 0; `go test -count=1 ./...` exit 0.
- CI failure-line grep: **0 failure lines**.
- **510 rows** in `.github/expected-go-tests.txt` = **510 package-qualified top-level Go test functions executed by `go test`**, at `f487dc5`. **0 MISSING, 0 UNEXPECTED, 0 unterminated.**
- `gofmt -l` on the 7 Go files changed across `43bd206..f487dc5`: **0 unformatted**. Repo-wide: **7 files, none on this branch** — exactly the seven pre-registered.

## Manifest non-regeneration — confirmed three ways, and the developer's evidence for it is scoped wrong

**Manifest rows in `.github/expected-go-tests.txt`: 501 at `43bd206` → 507 at `2ff87d2` → 510 at `f487dc5`.**

`git diff --numstat` on that path: **`6	0` at `2ff87d2`**, **`3	0` at `f487dc5`**, **`9	0` for `43bd206..f487dc5`**. **Zero deletions at every commit.**

Two proofs stronger than numstat, both at `f487dc5`:

- **Set-wise:** `comm -23` of the 501 sorted base rows against the 510 sorted head rows is **empty**.
- **Order-wise:** the 501-row base file is a strict **subsequence** of the 510-row head file (`diff` emits **0** `<` lines). Rows were inserted in sorted position; nothing moved, rewritten, or reordered.

**Displacement is independently ruled out:** Go source across `43bd206..f487dc5` adds **9 new `Test` functions** and removes **0**. Nine new functions, nine new rows, nothing removed on either side.

**Caution for anyone citing this branch's numbers.** "3 additions, 0 deletions" is true **only for `2ff87d2..f487dc5`**. Against the base it is **9 additions, 0 deletions**, and the branch moved the manifest **501 → 510 rows**, not 507 → 510. The 3/0 figure alone does not establish non-regeneration *on the branch*, because it says nothing about `2ff87d2` — the commit that first edited the manifest. Logged as finding R3-2.

## Cross-track accounting — do not pool

The other track's **45 executed-but-unlisted Go tests** are measured against a **503-row** manifest, which is `b54c573`. Measured: `b54c573`'s manifest is the **same 501-row blob** as base `43bd206` (blob `e102430df5ec851fef27ca4d9aff61ea1c76e866`) plus exactly the two `TestConjunctA_*` rows.

**Zero overlap with this branch's 9 added rows** (`comm -12` empty), and `b54c573`'s tree does not contain `internal/server/export_import_provenance_test.go` at all, so eight of the nine cannot execute there.

**The two accountings share the 501-row ancestor and diverge independently — 501 + 2 there, 501 + 9 here. They must not be added together.**

## Blocking findings

- **R3-1 (Required, code).** `export_import.go:157-159` — the refusal message asserts "the embedded `ft` CLI is unaffected because it always authenticates locally." True of `connect.go:169` (unconditional lookup). **False for `ft dashboard` started with `FARMTABLE_OPEN_ACCESS=1`** (`dashboard.go:80-84`, `:97`), which is the same `ft` binary and is the `Dockerfile` CMD. The author's own §2 artefact table documents that configuration as reachable and refused. `export_import_provenance_test.go:777` currently **pins** the false sentence under every cause. Fix: name the code path, not the binary, and update the test substring and comment together.
- **R3-2 (Required, report).** `dev-import-hardening.md:49` — non-regeneration evidence names no reference point; see above.
- **R3-3 (Required, report).** `dev-import-hardening.md:183, :189` — heading reads "Mutation arms — 7 of 7 RED" over a table listing **12** arms (M1–M6′ plus M7–M11); body says "All seven deltas are non-zero." 7 is the count at `2ff87d2`; 12 is the branch count.
- **R3-4 (Required, report).** `dev-import-hardening.md:454` — inside the pre-registration block, the struck gofmt figure (**3** = branch-cumulative at `2ff87d2`) and its replacement (**6** = commit-only at `f487dc5`) are different scopes. Branch-cumulative at `f487dc5` is **7**.

Non-blocking: **O-1** (the env→cause mapping now exists twice — `openAccessCauseFor` is unexported in `package main`, so `internal/cli/dashboard.go` re-derives it inline and is untested; consider moving it to `internal/server` beside the type), **O-2** (no test on the dashboard wiring site).

## Pre-registration repair — verified

§4b's restored block does contain the superseded figures, struck, with per-SHA tags, and each superseded value checks out against the commit it is attributed to: manifest 507 rows at `2ff87d2`; 501 inherited + 6; 3 Go files across `43bd206..2ff87d2`. The repair is real and the disclosure was volunteered. The one defect inside it is R3-4.

## The pattern worth keeping

Round 2's dominant defect — **verify a denominator of tasks, report a denominator of rows** — is *reduced* but not cleared. Three instances survive (R3-2, R3-3, R3-4), and all three sit in sentences written **before** the author adopted the "name the unit in the same sentence as the number" rule and not re-swept afterwards. R3-1 is the same shape moved into the shipped artefact: a code path was measured (`connect.go:169`) and a **binary** was reported ("the `ft` CLI").

**The extension the round-3 evidence supports: name the REFERENCE POINT as well as the unit.** "3 additions, 0 deletions" names its unit perfectly and is still misleading, because it omits which two SHAs the diff is between. R3-3 understates the author's own work, which is why it survived a sweep aimed at inflation — a unit-discipline pass has to check deflation too.

## Instrument notes

Read-only `--local` clone of `/workspace/farmtable` at `/workspace/farmtable-review-ih-r3`; never cloned from a network remote; nothing staged, committed, stashed, or pushed; `/workspace/farmtable/web/dist` untouched. All revision specs written braced and echoed before use. **No measurement was `2>/dev/null`'d** — the one exit-128 encountered (`git rev-parse import-hardening`) was the informative one, and suppressing it would have led to measuring a working tree instead of the commit.
