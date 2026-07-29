# 2026-07-29 — Code review: import-hardening (rounds 1 and 2)

**Type:** review record (no code changed)
**Branch reviewed:** `import-hardening`, base `43bd206`, not pushed.
**Round 1:** `2ff87d2`, 4 commits — REQUEST CHANGES (1 Required, 1 Nit, 4 FYI).
**Round 2:** `f487dc5`, 5 commits — **APPROVE** (0 Critical, 0 Required, 2 Nit, 5 FYI).
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-import-hardening.md`
**Reviews:** `2026-07-29-dev-import-hardening.md`

## Artefact, stated with the result

Round 2 was measured at `f487dc5` in a throwaway clone at `/tmp/rev-ih2/ft` (`git clone --no-local`,
detached), **not** the developer's tree and not `/workspace/farmtable` (another agent's branch, dirty
tree — never built or tested there). `-uall` and `-uall --ignored` both 0 entries before and after;
mutation battery and one scratch test removed, restoration proven by `sha256sum -c` and by
`git write-tree` == `HEAD^{tree}`.

## The residual, and why reading was not enough for it

The item ruled to outrank everything was whether the restructured auth branch in
`cmd/farmtable-server/main.go` selects the same `lookup` as the code it replaced. The instruction
was "verify two-sidedly by reading the diff". Reading gave the right answer, but reading is what
produces a claim, not evidence for it — so I re-implemented the pre-`f487dc5` predicate in a scratch
test and compared it against the new switch over **196 env combinations: zero divergence**, with the
permit arm and both deny arms asserted explicitly. Two identically-broken predicates would also have
agreed; naming the two outcomes is what stops "all agree" from being vacuous.

**A property the restructure created that the base did not have:** the auth mode is now derived from
the cause, so an unrecognised future cause falls to `default:` — the arm that *installs* the token
lookup. It fails closed.

## What made the evidence on this branch strong

**M7 and M8 had to disagree, and they do.** M7 (message ignores the cause) reddens the wording test
and leaves the invariance test GREEN on all four subcases; M8 (a cause allowed to grant passage)
reddens the invariance test via its `CANARY:` assertion. Both reproduced by me, both compiling, both
RED by assertion. The pair is load-bearing in both directions: M7 staying green is a **pass
condition** — an invariance test that reacted to wording would not be testing an outcome — and M8 is
the only reason the invariance test is not vacuous, because against an unconditional refusal it
passes trivially. **A trivially-passing test is indistinguishable from a vacuous one until someone
introduces the defect it exists to catch.**

**The `newControl` guard is the best thing on the branch.** Round 1 found a table-driven test
claiming three subcases of evidence for a control only one of them reaches. The fix is not a
comment: the test now counts subcases flagged `newControl` and fails if the count is ever anything
but 1. A claim in prose drifts; this one has to stay true to keep the suite green.

## The finding round 1 raised, and whether the correction is true

R-1 was that a task-less import records no provenance at all, making "provenance covers 100% of rows
the import writes" false. The correction reads "100% of rows **attached to tasks**". Checked for
truth rather than narrowness: `validateImportReferences` rejects every comment, relationship and
change whose task id is absent from `taskMapping`, and `taskMapping` is built only from `doc.Tasks`,
so no task-attached row can exist without its task being created by the same import — and every such
task is stamped exactly once (4/4 in `StampsEveryImportedTask`). True.

## Two nits, both the same shape one level down

The `missing_token` wording subcase **passes under M7**, because the generic default text also names
`FARMTABLE_TOKEN`; it cannot distinguish its own branch from the fallback. And the "unspecified"
message does name a knob, while the comment above it says it must not. Neither blocks: the
fall-through still gives the operator the correct action. But the first is round 1's finding
recurring at subcase level, which is where table-driven tests hide it.

## Correction against myself

My first M11 patch silently failed to apply — the source was gofmt-aligned differently than my
pattern assumed — and the run came back all-PASS. Read carelessly that is "M11 is a survivor, the
mapping test is vacuous". It was a no-op mutation. `git diff --numstat` after every patch is what
caught it. **A zero-diff mutant reports on your patch, not on the test** — the same error class as a
non-compiling arm, approached from the other side. (Round 1's equivalent: I reported 87 packages
after merging `go: downloading …` lines from stderr into a `go list` capture. The answer was 32.)
