# go-test-registration — code review of `32255b0`

**Date:** 2026-07-29
**Reviewer:** code-reviewer leg (`review-import-hardening-r3`)
**Artefact:** `32255b05a00e59f195d5b4617e6e9f2601e07ed4` (`32255b0`), parent `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f` (`2982ffd`), branch `go-test-registration`
**Branch HEAD:** `e374367` (docs-only project-log commit, 79 lines)
**Leg clone:** `/workspace/farmtable-reg-goleg` — *not* derivable from the agent name; `/workspace/dev-gotest-registration` and two other plausible spellings do not exist
**Full review:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-gotest-registration.md`
**Evidence:** `/scion-volumes/scratchpad/projects/farmtable/reports/_evidence-review-goreg/` (47 files, `SHA256SUMS.txt`)

## Verdict

**APPROVE.** Risk **LOW**. No Critical, no Required. Four non-blocking findings, all in the accompanying report rather than in the commit.

The commit changes **one file**, adds **45 manifest rows**, deletes nothing, and touches no Go source. It cannot make CI less protective.

## What the commit does

Registers 45 already-executing Go tests in `.github/expected-go-tests.txt`, closing a gap where 45 test functions across 3 packages — including the whole of `internal/webguard` — were running outside the CI membership gate's view.

## Independently re-derived at the commit

Not taken on trust. The CI gate's own awk extractor (`ci.yml:521-547`) was applied to my own `go test ./... -v` run at a detached checkout of `32255b0`.

| Quantity | Value |
|---|---|
| Manifest rows at `2982ffd` (blob `3c01012d`) | **503** |
| Manifest rows at `32255b0` (blob `ab04c212`) | **548** |
| Executed package-qualified top-level test functions | **548** |
| Packages in the executed set | **11** |
| Package result lines recognised | **33** (gate aborts at 0) |
| Top-level skips / `(unterminated)` / failure lines | **0 / 0 / 0** |
| `go test` exit status | **0** (captured unpiped) |
| MISSING / UNEXPECTED at `32255b0` | **0 / 0** |
| MISSING / UNEXPECTED at `2982ffd` | **0 / 45** |

Row count equals set size in both manifests (no duplicates, no blanks, trailing newline present), so "503 rows" and "503 tests" are one number rather than two that happen to agree.

## Non-regeneration — proven three ways

- **Mechanical:** `git diff --numstat 2982ffd 32255b0` → **`45	0`**. One file. Diff body: 45 addition lines, **0 deletion lines**.
- **Set-wise:** `comm -23` of the 503 base rows against the 548 head rows is **empty**.
- **Order-wise (strongest):** the base file is a strict **subsequence** of the head file — `diff` emits **0** `<` lines and 45 `>` lines. Rows were inserted in sorted position; nothing was moved, rewritten, or reordered.

**Control:** removing one known row from the head file made the set-wise check report exactly 1 loss. The instrument can see a deletion; it saw none.

## Two byte-identities that subsume whole tables

- At `32255b0` the manifest and the executed set are **byte-identical** (sha256 `e259d999…`). Stronger and cheaper than either `comm` direction.
- The 45 added rows are **byte-identical** to the 45 rows that were UNEXPECTED at the base (sha256 `69685a34…`). The commit registered exactly the set the gate was complaining about — no more, no less.

## Cross-track accounting — one 45, not two

The "other track's 45" referenced in the `import-hardening` round-3 review **is this 45**. Proven, not inferred: the base manifest at `2982ffd` and the manifest at `b54c573` are **the same blob** (`3c01012d`), and `b54c573 → 2982ffd` touches 17 files with **0** Go/mod/sum. Same manifest and same source means the same executed set, hence the same difference. A preserved evidence file from the earlier review is byte-identical to the manifest extracted today (sha256 `91e71738…`).

Everything reconciles onto one 501-row ancestor:

- **501** rows common to both tracks — byte-identical to the `43bd206` manifest
- **501 + 47 = 548** here (47 = the 45 registered + 2 pre-listed `TestConjunctA_*` rows)
- **501 + 9 = 510** on `import-hardening`
- **501 + 2 = 503** base manifest

Overlap between this 45 and `import-hardening`'s 9 added rows: **0**. No report anywhere pools the figures.

## The population nobody named

The tree at `32255b0` holds **598** package-qualified top-level test functions. **548** execute. **50** do not, and all 50 are explained exactly — with nothing left over — by three `//go:build integration` files (`internal/store/entstore_postgres_test.go` 23, `internal/platform/github/integration_test.go` 18, `internal/server/server_postgres_test.go` 9).

The accompanying report never uses the words "build tag", "go:build" or "integration". Its central figure of 548 therefore has no stated denominator. **Consequence worth recording:** those 50 tests can be deleted, renamed or broken and this gate will never notice, in either direction — not as drift that accumulates, but permanently and by design. Filed as O-1 (non-blocking).

## The zero that is partly a tautology

At the base, "0 listed-but-not-executed" is a genuine measurement over a named population of **503** rows, obtained three independent ways and verified with a live canary injection. At the head commit, both zeros are **entailed by construction**: the 45 were derived as `executed \ manifest` and appended, so 45 of the 548 rows cannot be MISSING and the informative population is still 503. The post-commit run verifies that the append was performed correctly — a check on a file operation, not on the codebase. Filed as O-2 (non-blocking).

## Audit of the 45 — clean

All 45 exist as real top-level functions at the commit; none is generated; none carries `t.Skip` or `testing.Short()`; none is build-tagged; all 45 execute. The skip check matters because a registered test that skips becomes MISSING under the post-`0f2c6f3` parser and **fails CI** — registering a conditionally-skipped test would be a latent red. None of the 45 is one.

The report's rename analysis was verified rather than accepted: all four superseded names are absent from tree, manifest and executed set, and none was ever in the manifest — so the gate's Direction-B zero is, as the report itself says, luck rather than design.

## Reviewer's own corrections, struck in place

1. **A broken parser produced a clean zero.** A gawk-only three-argument `match()` ran under mawk, threw a syntax error, emitted an **empty** population, and downstream lines printed `count=[0]` and `REGISTERED BUT NOT EXECUTING=[0]` — reassuring zeros over a population of nothing. ~~First recorded as a result.~~ **Struck**; re-derived with a `sed` parser carrying an explicit population control (598 parsed, 0 residual `func ` lines, 0 executed-rows-not-in-tree). Same answer, but the first run was not evidence for it.
2. **zsh glob trap hit twice** — unquoted `--include=*.md` and unquoted `--glob=refs/*`. Both failed loudly ("no matches found") rather than fabricating an empty result.
3. **`for-each-ref` glob (defect 12) self-check.** My reported ref counts used the bare spelling and are unaffected (4 and 934, identical under `refs/`). Measured on canonical: `for-each-ref 'refs/preserve/*'` → **3**, `for-each-ref refs/preserve/` → **2836**. The glob hides 2833 refs at rc=0. Worse, `'refs/*'` returns **0** on any normal repository, because a real ref sits two segments below `refs/`.

## Instrument discipline

Read-only `--local` clone at `/workspace/review-goreg`; never cloned from a network remote; nothing staged, committed, stashed or pushed; no `git add -A`/`.`/`-u`, no `git commit -a`, no `git stash -u`; `web/dist` untouched. All revision specs braced and echoed before use. No measurement was `2>/dev/null`'d. Existence probes used the bare spelling classified on the rc value in three visible buckets — real `0`, fabricated `1`, malformed `128` — so ABSENT is provably not collapsed into "the question was malformed". Every reported zero was preceded by a control that produced a non-zero in the same invocation.
