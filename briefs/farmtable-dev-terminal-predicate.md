# dev-terminal-predicate — issue #191: pin and consolidate the terminal-stage availability rule

## Context and standing constraints

Go backend work. **Phase 1 is merged, deployed and LIVE in production.** This
task touches Phase 1 backend files, which is why it is deliberately a
**separate, small PR** — it must NOT be bundled into the Phase 2 web branch or
its deploy. Phase 2 has stayed cleanly clear of Phase 1 files and we are
preserving that.

Your workspace is `/workspace/farmtable-terminal-predicate`, branch
`terminal-predicate`, **based on `origin/main` @ `7a0f220`** — not on any Phase 2
branch. Verified in sync with GitHub `main` at the time of writing. Do not merge
or rebase any Phase 2 branch into this.

`origin` in your clone points at a local path, so `git fetch` and
`git diff origin/main...HEAD` work with no GitHub credentials.

**This must be a behaviour-preserving change.** Test additions plus a mechanical
refactor. If you find yourself changing what the code *does*, stop and report.

## The problem (issue #191)

The contract requires server-computed availability to exclude terminal tasks:
"ClaimTask rejects unavailable tasks by ID, including triage, terminal, held,
dependency-blocked, and future-start tasks". The Phase 2 web client has just
been ruled to **trust this absolutely**, with no client-side defensive check
(issue #189). So this invariant is load-bearing for two phases.

It is currently **untested** and the rule is **hand-copied**.

### Part 1 — add the missing test coverage

`store.AvailabilityReasonTerminal` is never asserted in any Go test.

Two existing tests look like they cover it and do not. Read both before you
start, because your new test must not repeat their mistake:

- `TestComputeAvailability_ReasonsAndTerminalDependencies`
  (`internal/store/entstore_test.go:502`) — four-case table: `triage`, `held`,
  `future`, `dependency`. No terminal case.
- `TestComputeAvailability_TerminalDependencyMatrix` (`:589`) — tests whether a
  terminal *blocker* satisfies a *dependency*. A different property.

"Terminal" in both names refers to dependency semantics. Coverage is implied by
the naming and absent in fact.

**Required:** a table test asserting that for every terminal stage
(`completed`, `wont_fix`, `duplicate`, `cancelled`) the task itself is
`Available: false` carrying `AvailabilityReasonTerminal` — run against **all
four** availability implementations, not just `EntStore`:

1. `internal/store/entstore.go:1088` `computeAvailability` (canonical)
2. `internal/server/convert.go:121` `basicAvailabilityForTask`
3. `internal/store/multistore.go:236` `MultiStore.ComputeAvailability`
4. `internal/platform/github/passthrough.go:612`
   `GitHubPassThroughStore.ComputeAvailability`

Name the test so it cannot be mistaken for the two above. If covering all four
needs different harnesses per package, that is fine — four honest tests beat one
clever abstraction.

### Part 2 — consolidate onto ONE exported predicate

`isTerminalStage` (`internal/store/entstore.go:1075`) is currently unexported
and is the only named form of this rule. Export it (`store.IsTerminalStage`) and
use it at the **four availability sites above**.

**Scope this precisely. I checked all seven matches for the terminal-stage set
and only four are the availability predicate.** Do NOT blindly replace every
match — the others are distinct concepts that merely share the same set today,
and coupling them to the availability predicate would create a false dependency:

| Site | What it actually is | Action |
|---|---|---|
| `entstore.go:1077` | the canonical predicate | export it |
| `entstore.go:1279` | `CloseTask` validating a *close target* stage | **LEAVE** — "valid close stage" is not "terminal for availability" |
| `multistore.go:247` | availability | consolidate — **see warning** |
| `convert.go:67` | `phaseForStage` stage->phase projection | **LEAVE** — different concept |
| `convert.go:127` | availability | consolidate |
| `passthrough.go:618` | availability | consolidate |
| `labels.go:425` | second copy of `phaseForStage` | **LEAVE** — see note below |

Also leave `export_import.go:656` and `:901` alone entirely; those enumerate all
ten stages for validation and are not this rule.

**Warning on `multistore.go:247` — read carefully, this is the one that can
silently change behaviour.** That site is not a plain copy. It reads:

```go
if t.Phase == task.PhaseClosed || t.Stage == task.StageCompleted || ... {
    reasons = append(reasons, AvailabilityReasonTerminal)
}
...
return TaskAvailability{Available: len(reasons) == 0 && t.Phase == task.PhaseOpen && t.Stage == task.StageAccepted, ...}
```

Two things it does that the others do not: it also treats `Phase == PhaseClosed`
as terminal, and its `Available` carries the extra conjunction
`Phase == PhaseOpen && Stage == StageAccepted`, making it strictly stricter than
the other three. **Both must survive exactly.** If you replace the condition
with a bare `IsTerminalStage(t.Stage)` you will drop the `PhaseClosed` arm and
change behaviour on live code. Keep it as `IsTerminalStage(t.Stage) || t.Phase
== task.PhaseClosed`, or leave the site alone and say why.

## Out of scope — note, do not fix

`phaseForStage` is itself duplicated across two Go packages (`convert.go:61` and
`labels.go:422`). That is a real smell and it is the exact same defect class as
frontend issue #190, where `BOARD_COLUMNS` hardcodes lane labels and phases
instead of reading `STAGE_LABEL` / `phaseForStage`. **Do not fix it here** — it
would widen a deliberately small PR touching live Phase 1 code. If you confirm
the two copies are behaviourally identical, say so in your report and I will
file it.

## Acceptance criteria

- New terminal-availability coverage across all four implementations.
- **A real mutation test for the new coverage.** Deliberately break the terminal
  arm in each of the four implementations one at a time, paste the ACTUAL
  failing output, restore, confirm green. A claim of "verified" without pasted
  output will be sent back — this is the standing bar on this workstream, and it
  is the whole point of the issue, since the existing tests looked like
  coverage and were not.
- Behaviour preserved. Call out explicitly that `multistore`'s `PhaseClosed` arm
  and its stricter `Available` conjunction both survive.
- `go build ./...` and `go test ./...` green, output pasted.
- `gofmt` clean.
- No web/frontend files touched. No Phase 2 branch merged in.

## Deliverables — all required

1. Commits on branch `terminal-predicate` in
   `/workspace/farmtable-terminal-predicate`.
2. A project log entry at `.design/project-log/terminal-predicate.md` with a
   "Not done, and why" section.
3. A report to me: what you tested, the four killing mutations with real output,
   which sites you consolidated and which you deliberately left, and anything
   found but not fixed.

**Do not push.** Commit locally; the manager pushes.

This gets the same review rigor as everything else on this workstream — code
review, security audit, and test review — despite being small. It touches shared
availability logic across four backend paths, so the "small clean diff, skip
review" shortcut does not apply.

You MUST commit your work, write the project log entry, and then mark the task
complete.
