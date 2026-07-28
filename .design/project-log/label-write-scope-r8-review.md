# label-write-scope r8 — independent code review (diff/structure axis)

Reviewed `158c8ae` against `1d4442f`: 9 commits, 14 files, +2468/−39.
Verdict: **REQUEST CHANGES**, risk MEDIUM.
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r8.md`.

## The fix is right

The C-1 rewrite — derive the minimal edit from `applyLabelDelta` instead of
mirroring its rule — is correct, and I established that independently rather
than accepting the round's own claim.

The invariant is `keys(S) \ keys(after) ⊆ keys(R)`, because `applyLabelDelta`
drops a current label only when its key is empty, is in the remove set, or has
already been seen (and a seen key is still in `after`). So replaying the emitted
minimal edit reproduces `after` exactly, and spellings line up because `after`
iterates the snapshot before the adds. Measured over 524,288 triples: 0
round-trip failures, 0 spelling violations. Positive control — reinstating the
round-7 two-per-list restrictor in production — compiled (so it measured
something) and went RED, exit 1, 5 FAIL lines.

The six-site `stageWritePolicy` partition is complete, correct, and fails safe.
Completeness is compile-enforced: `policy` is a required positional parameter, so
a seventh call site that omits it does not build. Each classification is
load-bearing under an over-reach mutant (stage arm → 12 RED; caller-supplied
label arms → 15 RED; policy check neutered → 4 RED).

## What blocks merge: the guard on the guard is a copy

All four findings are one shape. Not the fix — the machinery meant to stop the
fix regressing.

**R1.** P2 — the sole pin for the whole A-4 unpriced-write class — is itself
deletable. Delete either discriminating arm, or gut P2 entirely, and
`go test ./...` stays at exit 0 with zero failures. The probe that claims to
guard it (*"If this test ever fails, P2 has stopped discriminating"*) does not
call P2; it **reimplements it inline** — the exact hand-rolled-oracle mistake the
same file's docblock condemns 300 lines earlier. Fix: extract a shared
`p2Violations` helper and call it from both.

**R2.** The F-2 decision — emit removals in the *snapshot's* spelling, because
`labelNameToID` lowercases without `TrimSpace` — is unpinned. A mutant emitting
the caller's spelling instead compiles and leaves the suite green. Nothing can
see it: `sameLabelSet` compares normalised key sets, so spelling is invisible to
both properties by construction. Fix: P3 — every emitted removal is verbatim an
element of `t.Labels` (measured to hold across all 524,288 triples) — plus one
named row with a padded caller spelling.

**R3.** The `removeKeys` "safety belt" comment names a hazard that cannot occur.
A duplicate match key in the snapshot is still in `afterKeys`, so the loop skips
it either way. 0 differences over 524,288 triples with three spellings of one key
deliberately in the vocabulary. The implementation report's claim that the belt
is "covered by a named row" is false — no named row and no sweep vocabulary
contains a duplicate-key snapshot. The clause is still worth keeping as a hedge
against a future `applyLabelDelta` that drops labels for reasons other than the
remove list, which is also the qualification the docblock's absolute *"NO FUTURE
CHANGE … CAN DESYNCHRONISE THEM"* currently lacks.

**R4.** `checkLifecycleKeyCollisions` misses a case in the class its own first
sentence defines. With `stages: {"ft:mydone": completed}` + `types:
{"ft:mydone": bug}`, `authorizationStage` grants the label privilege,
`Validate()` returns nil, and a type change destroys it. `owned` is seeded only
from the bare stage names, not from `labelToStage`. Runtime
`assertStageWriteAllowed` catches it — defence in depth doing its job, which is
why this is Required and not Critical — but the docblock's "Scope is deliberately
narrow" enumeration reads as exhaustive and omits this. Fix: merge
`m.labelToStage` into `owned` (its keys are already `stripForMatch`-normalised),
plus an over-reach control row per the M6e lesson.

## Two structural notes worth carrying

**Both defence layers fail open through one untested list.** `allStages` is
hand-maintained and feeds `checkLifecycleKeyCollisions` *and* `labelToStage`,
hence `authorizationStage`, hence the runtime backstop. A stage added to the ent
enum but not to the slice is invisible to both. 10 = 10 today, nothing pins it.
Related: `StageToLabel`'s fallback branch is dead — replacing it with `panic`
leaves the suite at exit 0 — so the missing-stage path is unexercised. One
totality test converts a silent fail-open into a build failure.

**M6c is a genuine equivalent mutant and the "…Today" pin does expire loudly.**
Equivalence confirmed over 9 push prefixes × 4 stage tables × 10 stages, 0
divergences — wider than the round tested. Changing the real spelling makes the
pin fire with 40 divergence messages. Caveat: my first attempt at that control
mutated `StageToLabel`'s *fallback* and the pin stayed GREEN, because that branch
is dead. The pin guards the live path only.

## Where the brief and the report were wrong

Four in the brief: (1) the workspace shipped with an unusable git object store —
a `--shared` clone whose alternates path resolved only on the host — which also
produced the spurious `go build` exit 1 that test-194-r8 reported; re-measured
after repair, `go build ./...` exits 0 with no flag; (2) "a missed call site
defaults to the zero value" presumes a defaultable field that does not exist —
omission is a compile error; (3) the `removeKeys` rationale is relayed as
established and is false; (4) "`LoadConfig`'s public API is unchanged" is true of
the signature but three error messages now interpolate the absolute path.

Five in the implementation report: 9 commits not 8 (the EM's account of
`53edc46` → `158c8ae` as a docs-only plain descendant is correct — verified by
`diff --stat`, `rev-list --parents`, and `merge-base --is-ancestor`, not
accepted); the vet table's `GetBottlenecks` base row contradicts its own "uniform
+45" conclusion (base is 2232, and the +45 is real — I measured the baseline in a
separate `1d4442f` worktree); the belt "covered by a named row" claim; and two
undercounts, M-P1 is 4 failing tests not 3, M-P2 is 15 not 11.

## Measurement discipline

Every mutant applied one at a time by a script asserting its anchor matched
exactly once, compiled before being trusted, reverted with `git checkout --`, and
followed by `git diff --quiet`. Exit codes read from the child process, never
through a pipe — my own first build measurement was wrong for exactly that
reason and I caught it on re-run. Two temporary probe files created and deleted.
No production code was modified and nothing was pushed; tree clean at exit.

Baseline reproduced: `go build ./...` exit 0; `go test ./...` exit 0, zero FAIL;
`go vet ./...` exit 1, exactly 4 copylocks at 1782/1892/2100/2277 with the stated
messages. `TestWatchTasks` re-run at 6-way concurrency: 5 of 6 batches RED
(brief said 4 of 6), all failures within `TestWatchTasks*`, pre-existing.
