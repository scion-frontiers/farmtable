# #194 round 6 — TEST REVIEW leg

Read `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-194-r6-shared.md`
FIRST and in full.

You are `test-194-r6`. Report to
`/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r6.md`.

## Your charge

This round added roughly 3000 lines of tests. Your job is to find the ones that
**cannot fail**. On this branch that is not a hypothetical: it is the dominant
defect class and it has produced eight instances.

## Prior rounds

Round 5's test leg found T-1 (a wrong remediation sentence producing a dead
alias), T-2 (unreachable duplicated fallbacks), T-3 (a "swap" test that never
swapped), T-4 (a panic silently truncating 104 tests from every measurement on
the tree). All addressed. T-4 is the one to remember: **a panic corrupts every
count taken on that tree**, including yours.

## Targeted charges

T-1. **Mutation-test the new gates.** For `CreateTask`'s label gate and the
fail-closed `ErrEmptyLifecycleStageSet` path: remove the guard, confirm something
goes RED, restore, verify by sha256 against an out-of-repo pristine copy.
Content-addressed anchors only; abort if an anchor is not unique.

T-2. **The two seam tripwires assert DEFECTIVE behaviour on purpose.** Verify
they actually fire when the seam is CLOSED, not merely that they pass today. A
tripwire that cannot go red when the thing it guards changes is decorative, and
these two are the only thing stopping round 7 from closing the seam silently.

T-3. **Fixture expressiveness sweep.** For each new test table, ask whether the
fixture can construct the input that would falsify it. Emptying a fixture table
and finding the suite still green is a fast way to find decorative ones — leg B's
own `Charge4_REV9PremiseAdversarially` validates that a mock counter can reach 1
before relying on its being 0, which is the bar.

T-4. **The salvaged probes.** `internal/server/audit_r5_probe_test.go` is 4 of 11
round-5 audit probes, kept selectively with drop reasons written in-file. Judge
the keeps AND the drops. Overturn me if the reasoning is wrong.

T-5. **The flake.** `TestWatchTasks_CreatedEvent` failed once at 5.01s under
`go test -v` on the final leg-B tree; an identical rerun passed; plain
`go test ./...` has always passed. Mechanism is believed to be subscribe-after-
return in `watch.go`. Characterize it. **Do not silence it** — this flake is
currently the only detector for an undocumented API precondition, and every
instinct will point at making it quiet.

T-6. **Count discipline.** I measured 625 top-level / 1825 result lines and
PREDICTED 625/1823 beforehand; the +2 resolved to leg A's own total being 2 low,
verified by measuring their package in isolation (526) and combined (526).
Re-measure independently. If you get a different number, say so loudly.
