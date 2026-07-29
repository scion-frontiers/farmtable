# LEG BRIEF — security audit, #194 round 5

Read the shared brief first:
`/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-194-r5-review-shared.md`

- **Clone (yours alone):** `/workspace/farmtable-audit-194b`, branch
  `label-write-scope`, verified at `ea8ac39`.
- **Scratch dir (yours alone):**
  `/scion-volumes/scratchpad/projects/farmtable/salvage/r5-audit-194/`
- **Report to:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r5.md`

If you reuse a harness from a prior round, **copy it into your own directory
first and record its sha256.** Last round a leg's harness was overwritten
mid-read by a concurrent leg. That was my fault and it is structurally fixed now;
the discipline is still yours.

## Charges

**1. Is the class actually closed? Reproduce, do not accept.**

The round-4 audit measured, at `03ab6b6`, six terminal→terminal conversions
reachable with `task:write` alone, in two shapes:

- `add_labels[Y]` on a task labelled `X` — 12 ordered pairs, 6 converted.
- `UpdateTask(stage=Y)` on a task labelled `[X, Y]`, **no label write at all** —
  6 converted. The three spelled out were `[cancelled, duplicate]→duplicate`,
  `[cancelled, completed]→completed`, `[duplicate, wont_fix]→wont_fix`.

The developer claims both shapes are now 12-of-12 gated. **Verify independently
at `ea8ac39`.** Positive control first: your probe must be shown able to observe
an ALLOWED outcome, or your DENIEDs are a property of your request shape. The
round-4 audit's first attempt failed exactly here — it picked `dest=working`,
which is unreachable via `UpdateTask` at all, and only the control revealed it.

**2. Does B6 open anything new?** Requiring a prefix is a new parse on the
security path. Probe it as one: case variation, whitespace, unicode
look-alikes, a label that *contains* the prefix but does not start with it,
double prefixes (`ft:ft:stage/completed`), a configured prefix that is itself a
substring of a stage name, and the empty-prefix config. `stripForMatch` and
`authorizationStage` now share `matchPrefix` — confirm they cannot disagree, and
that the shared helper did not change display behaviour as a side effect.

**3. The singular reader is still live.** `store.LifecycleStage` →
`TerminalLabelStage` (single tiebreak winner) still serves
`issueUnavailableForClaim` (`passthrough.go:612`) and `passthrough.go:974`, while
`UpdateTask` now uses the set. **Is that difference exploitable?** Specifically:
can an attacker construct a label set where the claim/availability path and the
authorization path disagree about terminal-ness, and is there a privilege gain
in the gap? If the answer is no, say why in a way that would survive a new
caller being added.

**4. Where can `from == to` still be reached?** It was the load-bearing
short-circuit. Enumerate the label-set cardinalities and shapes under which it
still fires, and confirm none of them writes state a `task:write` token should
not be able to write. The developer landed REV9 as a *passing* test on the
assumption that `passthrough.go` never writes `p.Phase`, so `UpdateTask` never
closes or reopens an issue, asserting `closeCalls == 0`. **Test that assumption
adversarially** — it is the load-bearing premise of a green test.

**5. `CreateTask` residual.** The developer disclosed and pinned that
`CreateTask(stage=completed)` is denied but
`CreateTask(labels=[ft:stage/completed])` is allowed with `task:write` and the
label lands. Measure the real privilege consequence: does that task then read as
terminal to the availability, claim and authorization paths? Is this a route to
the same outcome #194 was filed for, reached at creation time instead? Severity
read requested — it is currently tracked as a residual, not a blocker, and I want
that classification checked rather than assumed.

**6. Custom-prefix deployments.** B6 makes `push_prefix` load-bearing for
security for the first time. Map the exposure for an install configured with a
non-default prefix: which paths honour it, which do not. (You will find
`hasExternalUnavailableLabel` does not — that one is known and out of scope; the
question is whether anything *else* in the authorization path shares the defect.)

Report per the shared brief's structure. Mark findings **BY EXECUTION** or
**REASONED**. **Commit locally, do not push, do not modify production code.**
You MUST write `audit-194-r5.md` and then mark the task complete.
