# test-194-r9 — test-engineering review of `label-write-scope-r9` @ `06f01d7`

**Read `/scion-volumes/scratchpad/projects/farmtable/briefs/_r9-baseline-block.md` FIRST and in
full.** It contains your tree, your commit, the gate baseline, a baseline correction I got wrong for
many rounds, the flake and its containment, and the method rules. Everything there applies to you.

**You are one of three independent legs reviewing this change.** A code-review leg and a
security-audit leg are running in parallel, in their own clones, on the same commit, on different
axes. **You will not see their reports and they will not see yours.**

**Your axis is: can this evidence fail?** This round is **+1663 / −97 across 12 files and roughly
90% of it is test code.** The whole round is a claim about evidence. Your job is to find out whether
the claim is true.

## The change

`158c8ae..06f01d7`, six commits, round 9 of the #194 lifecycle-label write-authorization sequence.

| commit | claim |
|---|---|
| `49c1c7e` | MUST 1 — give C-1 a server-layer pin beside the two A-4 ones (+173, all test) |
| `94c0aa9` | MUST 2 — make the P2 probe drive P2 instead of a copy of P2 (+224 / −59) |
| `058a973` | MUST 3 — pin the snapshot-spelling rule with P3 and an end-to-end row |
| `a08addc` | MUST 4 — replace the removeKeys belt's false rationale with a proof and a property |
| `794bdce` | MUST 5 — lifecycle-label authority follows `enabled`; validation ignores it |
| `3675bb9` | SHOULD — make the startup banner, the policy type and `allStages` testable |

Production code is only `config.go`, `passthrough.go`, `terminal_label_stages.go`, `main.go`.

The author's report is at `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r9.md`.
**Form your own view first, then read it, and treat every RED/GREEN claim in it as unverified until
you reproduce it.**

## The single most important thing in this brief

MUST 2 exists because of a defect the author found in their **own** previous work, and the remedy
they chose is the thing I most want independently tested.

The prior P2 probe read a **multi-arm oracle through a single-bit result**. Deleting P2's C-1 arm
left `go test ./internal/platform/github/` at **exit 0**, because the identity case's output tripped
two arms at once and the surviving arm masked the deleted one. Their remedy: change the probe to
return `p2Violations(...) []string` rather than a bool, add **five broken restrictors each designed
to trip exactly one arm**, plus two negative rows.

**Test the remedy, not the story.** Concretely:

1. **Does each of the five restrictors actually trip exactly one arm?** Delete each arm in turn and
   confirm that exactly one restrictor goes RED, and that the failure message *names that arm*. An
   arm whose triggering inputs are a subset of another arm's can still be deleted undetected — that
   is the defect class, and adding restrictors does not automatically fix it. **Report the full
   arm × restrictor matrix.** If it is not a permutation matrix, say which arms overlap.
2. **Do the two negative rows require a positive outcome?** A negative row asserting "no violations"
   permits an empty result and therefore cannot fail when the input population is emptied. Empty the
   restrictor list and the arm list separately and report what happens.
3. Apply the same question to the **rest of the round's fixtures**, since the same author wrote them
   in the same sitting.

## The rest of what I want established

4. **Vacuity census with denominators, measured not reasoned.** For every loop and every fixture
   table added or modified in this diff, force it to iterate zero times and report whether the suite
   goes RED. The criterion: *a loop is non-vacuous exactly when some assertion **requires a positive
   outcome** from it; a loop whose assertion only ever **permits** an empty result cannot fail when
   emptied.* Give me `guarded / total` for each file, not prose. (Go table tests report zero subtests
   as PASS by design — note it once as a repo-wide convention issue, do not file it per-table.)

5. **The green control the author already found, and whether they fixed it correctly.**
   `TestLifecycleKeyCollision_DiagnosticIsDeterministic` ran 200 iterations and was, by construction,
   a control that could never fail. They renamed it
   `…DiagnosticNamesTheDeploymentsOwnStage`, added a which-stage assertion, and **kept** the 200-run
   half explicitly labelled in-source as a green control. **Is the new assertion discriminating?**
   Mutate the diagnostic to name a *different* stage and confirm RED with a named message. And is the
   retained 200-run half now honestly labelled, or is it still doing work it cannot do?

6. **MUST 1's pin.** +173 lines of server-layer test for C-1. Unwire the C-1 gate and confirm the new
   pin — **and specifically the new one, not a sibling** — goes RED. Coverage that only fires from
   another package's test is coverage locality, not a pin; this project has hit that before.

7. **MUST 4's "property".** The author claims they replaced a false rationale with *a proof and a
   property*. A property must hold for inputs the fixtures do not contain. Generate inputs outside
   the fixture set and see whether the property survives. If it is really a fixture restatement, that
   is form (7) in our taxonomy and I want it named.

8. **Over-strictness, not just under-strictness.** Most of this round tightens authorization. Which
   tests fail if the gate becomes *too* strict — i.e. if a legitimate `task:close` holder is now
   denied? If the answer is "none", the round has no protection against breaking the product, and
   that is a finding.

## Flake containment — required, not optional

`TestWatchTasks*` flakes at ~8% per full-suite run and a single-run mutation matrix carries roughly
1-in-12 odds of a spurious RED. Constrain your Go cells with `-run` selection, verify against a `-v`
baseline that the excluded tests match zero lines in your selected set, and put a tripwire in your
runner that greps each RED for `TestWatchTasks` and shouts. **Report that the tripwire never fired**
— a matrix without flake containment is not a measurement.

Also: **revert by snapshot restore (`cp` from `/tmp`), never `git checkout`** — a previous leg lost
uncommitted work that way. Assert `git status --porcelain` empty after every cell and report the
count of cells where the tree was dirty after restore.

## Out of scope

The 4 pre-existing vet copylocks; the `web/dist` clean-checkout condition (#100); and the
`enabled=false` write-authorization finding, which is **already ruled** and going into r10 — do not
design a fix for it. If your mutation work happens to produce a sharper *measurement* of it, that is
welcome; a redesign is not.

## Deliverables — you are not done until all six exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r9.md`** with a
   verdict — **APPROVE** or **REQUEST CHANGES** — findings numbered and severity-classified.
2. **The full arm × restrictor matrix** for MUST 2.
3. **The vacuity census** with `guarded / total` denominators per file.
4. **Your mutation table with predictions stated before measurement**, and an explicit score
   including your misses. Chasing a wrong prediction is the highest-yield thing you can do; the most
   serious finding in the parallel XSS round came from exactly that.
5. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
6. **An explicit list of every place this brief is wrong.** At least fifteen consecutive rounds have
   contained one.

**You MUST produce all six deliverables and then mark the task complete. Do NOT push.**
