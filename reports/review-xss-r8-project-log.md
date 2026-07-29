# review-xss-r8 — PROJECT LOG

**Leg:** `review-xss-r8` (code review axis)
**Commit reviewed:** `901670e3f09ad57386cafb8359017d8d61a75070`
**Range:** `e4e3d13..901670e`, 10 commits, 7 files
**Tree:** `/workspace/farmtable-review-r8` — never left it, never wrote to it
**Report:** `reports/review-xss-r8.md`
**Verdict:** APPROVE WITH CONDITIONS (= REQUEST CHANGES under the `code-review` skill's
binary, because two Required findings are open)

---

## What I did, in order

1. Read `_r8-COMMON.md` in full, then the role brief. Verified tree identity
   (`git rev-parse HEAD`), cleanliness (`git status --porcelain`, empty), and
   `$options[multios]` = `on` before running any pipeline.
2. Captured the diff (672 lines) and read **every line** of it, plus all ten commit messages
   in full.
3. Cold pass: verified the diff's factual claims against the tree, in this order — the one
   behavioural change and its callers; the new test's construction; the Go census; the
   allowlist/guard simulation; every citation.
4. **Wrote the cold pass to disk** before opening `_r8-PHASE-TWO.md`.
5. Received the 10:35Z §7 correction. Re-armed every published zero with a **planted**
   positive control in `/tmp` (§I-13 of the report).
6. Opened `_r8-PHASE-TWO.md`, reconciled, and found one disagreement worth the round.
7. Wrote report, this log, and messaged the EM.

## Findings, by severity

| # | severity | finding |
|---|---|---|
| R-1 | **Required** | The round **net-added two bare counts** ("nine") into the exact comment blocks that prohibit bare counts. Population before → after: **3 → 5**. Currently true (`GITHUB_CAPABILITIES` has exactly 9 `true`), unguarded, now load-bearing in 5 places / 3 files / 2 languages. |
| R-2 | **Required** | No build, vet, typecheck, gofmt or suite executed by this leg. Declared, not cleared. |
| O-1 | Consider | 207 added lines in production files, **3 executable**. Much of the rest is review-process history, duplicated in the project log the same round created. |
| O-2 | Consider | The F1 allowlist `reason` still describes the pre-F1 model. True, but it teaches the thing F1 fixed. |
| O-3 | Nit | New test comment says three fixture dirs "is compiled … in the real tree and therefore ships". All three are **absent** from the real tree. |
| O-4 | Nit | Project log's *"Fifteen … in `convert.go` and neighbours"* — 15 is `convert.go` alone; with neighbours it is 17. |
| F-1 | FYI | `AS-OF-THIS-COMMIT` next to `af9ea8c`, which is the parent of the commit carrying the block. |
| F-2 | FYI | A line-number citation in a `.test.ts` outside the diff. |

Plus, against the brief rather than the branch: **OP-2's "17 … in the tree" is a scope error;
tree-wide is 39 occurrences / 34 lines over 275 files.**

## The reasoning I most want preserved

**The headline finding is a shape, not a number.** R-1, O-4 and the OP-2 disagreement are the
same error at three scales: *a correctly-measured number attached to a wider population than
it was measured over.* The round exists to remove exactly that defect from r7's prose, it
removed two instances of it (items 3 and 4), and it simultaneously created two new ones and
mislabelled two of its own populations. I did not see this until reconciliation forced the
scope question — the cold pass measured the six files in front of it and would have let "17 in
the tree" stand. **That is the argument for the cold-pass/reconcile split, made from the side
that lost.**

**Why I did not request the build token.** The diff is 3 executable lines. Spending the single
project-wide token on my confirmation of a 3-line change, while the largest unmeasured object
on the project sat unexecuted, would have been the wrong allocation. I declared the gap
instead. The EM routed the whole-tree differential at 10:41Z, which is the right consumer.
**R-2 is not dischargeable by one green build** — per the EM's own pre-registration a single
run against `901670e` is guaranteed RED for a pre-existing reason (untracked `web/dist`), so
only the differential against `e4e3d13` can close it.

**Why the verdict is not REQUEST CHANGES flat.** The code in this round is *correct*. F1 is a
real fix, verified against both callers; the new regression test is a genuine guard whose red
condition I traced by hand; the census re-measures exactly; every citation resolves. The
blocking findings are about *prose discipline in a round whose deliverable is prose*. That
distinction is worth keeping visible, so I stated both verdict vocabularies rather than
collapsing to the harsher one.

**What I checked hardest because it would have been the biggest find.** A behaviour change on
an untrusted-input path in `convert.go` or `export_import.go` (role brief axis 4). There is
none: both files have **0 non-comment added lines**. I confirmed that by enumeration, not by
reading, because "I read it and saw no code" is exactly the claim that fails quietly.

**A near-miss I want on record.** My first citation regex excluded hyphens and truncated
`ft-inspector-meta.ts` to `meta.ts`, which presented as a *non-resolving citation* — a finding
**against the fix leg**. I caught it only because I resolved the target instead of trusting
the count. Had I published it, it would have been a false accusation delivered with a
measurement attached. The brief's instruction to check the numbers that damage others as hard
as the ones that acquit you is what saved it.

## Instruments and controls

Full detail in the report's INSTRUMENT section (§I-1 … §I-13). Summary of discipline:

- Zsh 5.9, `multios=on` verified before any pipeline. No `(N)` glob qualifier anywhere. No
  unquoted glob. No `2>/dev/null | wc -l`. No `|| true` / `|| echo 0`. `$pipestatus`
  (1-indexed) used where producer status mattered. `while read -r` for every file list; never
  a scalar. No mawk interval expressions.
- **Five instruments re-armed with planted positives + near-miss arms** after the 10:35Z §7
  correction, all reaching state **PUBLISHABLE**. Plants are literal (`printf`, hand-typed),
  landing verified before measurement, and confined to `/tmp/r8-ctl-a1` — **outside the
  repository**, so no finding can be an artefact of my own fixture.
- **One instrument declared positive-only and not upgraded:** the census-mention predicate
  (arm E). Its over-matching behaviour is UNCHECKED. Stated rather than glossed.

## Discipline notes

- **No build, test, vet, gofmt, tsc, npm or make command was run**, in any tree, at any point.
- **No production file created, modified or deleted.** No file written inside
  `/workspace/farmtable-review-r8` at all.
- **No git write of any kind.** No `add`, no `commit`, no `stash`, no bulk capture, no push.
  Only `rev-parse`, `status`, `log`, `diff`, `show`, `ls-files`, `rev-list`.
- **No deletion or tidying anywhere**, including my own `/tmp` fixture, which I left in place
  under the durability freeze.
- Did not create or enter any clone or worktree. Did not read, enter or measure
  `/workspace/farmtable-audit-r8`, `/workspace/farmtable-test-r8`,
  `/workspace/farmtable-build-r8`, `/workspace/farmtable-build-base`, or
  `/workspace/farmtable` — and ran no host-wide git-object sweep, so the 10:41Z 115→117
  clone-count classification does not apply to any figure I published.
- Did not contact the other two legs and do not know who they are.

## Open for the EM

1. **R-1** — remove the two new "nine" counts; the round's own item-3 remedy applies verbatim.
2. **R-2** — route the whole-tree differential result back; my verdict moves on it.
3. **OP-2** — decide the re-anchoring scope now that the population is 39, not 17.
4. **OP-1** — file and assign the coverage follow-up rather than leaving it dispositioned by
   commit message.
5. **§5 apparatus** — add the ugrep `-c` vs `-co` units switch. It inflates, and it is
   invisible.
6. **Run both differential arms under the same concurrency, and re-run both or neither.**
   Added 12:33Z, after the rationing lift. See the report's ADDENDUM under R-2. The lift
   removed the *contention* reason for keeping builds out of trees; the *contamination*
   reason from 10:41Z is untouched, so I am still not building in this tree. More
   importantly, concurrency adds a second variable to a two-arm design whose entire value
   was having only one, and *"re-run before you believe a red"* does not compose across a
   differential — re-running only the red arm until it matches the green one is a stopping
   rule that cannot distinguish a regression from a flake.
