# Six CI gates watched going red on the runner

Date: 2026-07-29
Base commit for every canary: `43bd206`
Repository: `scion-frontiers/farmtable`

Every gate in this workflow had been written, reviewed, and reasoned about. None
had ever been *observed failing on the runner*. A guard that has only been
argued about is a guard with an unknown pass/fail axis: it may be asserting what
its author believed, or it may be asserting nothing.

This entry records nine runs. Six break a gate's **subject** and watch that gate
go red. Two are controls that are expected to stay **green**, and one of those
two is the most informative result in the batch. The ninth is the deliverable
itself, green.

The rule throughout: **break the subject, never the gate.** A canary that edits
the assertion proves only that an edited assertion fails. On `g3`, `g4`, `g5`
and `g5b`, `.github/workflows/ci.yml` is byte-identical to `43bd206`. On `g1`
and `g2` the gate's own script is likewise untouched — those two diffs are
insertions only, zero deletions, adding a separate step that produces the
condition the gate exists to catch.

## The six red arms

| Gate | Branch / commit | Subject broken | Run | Red step | Error line |
|---|---|---|---|---|---|
| G1 | `canary/g1-dist-prebuild` `0d8e63e` | A step plants untracked `web/dist/assets/index-canary000.js` before the arm, reproducing a restored cache | `30462183955` | Assert web/dist holds no build output before the build | `web/dist contains build output BEFORE anything built it.` |
| G2 | `canary/g2-dist-content` `3e308ef` | Built `index.html` overwritten with a 53-byte stub after Build; nothing deleted | `30462193493` | Assert web/dist has real build content | `web/dist/index.html is only 53 bytes; expected a real document.` |
| G3 | `canary/g3-vet` `4297565` | `copylocks` violation in a new file | `30462180538` | Lint (go vet) — **sole red** | `internal/decomposer/canary_copylocks.go:14:17: variable declaration copies lock value to canaryMuB: sync.Mutex` |
| G4 | `canary/g4-membership` `8d62e1c` | `TestParseResult_MalformedJSON` renamed off the `Test` prefix | `30462183557` | Go test membership (asserted against a committed manifest) — **sole red** | `Go tests listed in the manifest DID NOT RUN:` then `…/internal/decomposer<TAB>TestParseResult_MalformedJSON` |
| G5 | `canary/g5-makefile` `7bb35cc` | `test-web` recipe points at a nonexistent npm script | `30462188131` | Makefile self-check (make test reaches both suites) — **sole red** | `npm error Missing script: "test:canary-does-not-exist"` / `make: *** [Makefile:53: test-web] Error 1` |
| G6 | `canary/g6-tracked-dist` `f513fb7` | `web/dist/index.html` force-added to the index | `30462188275` | Assert web/dist holds no build output before the build | `web/dist has TRACKED files that are not the placeholder:` |

**Every red landed on its own gate. Not one canary reddened an earlier step.**
That was the acceptance condition: a canary that trips something upstream proves
nothing about the gate it was written for.

## The two controls

| Control | Branch / commit | Run | Result | What it establishes |
|---|---|---|---|---|
| G5b | `canary/g5b-suite-dropped` `4e2281b` | `30462186962` | **SUCCESS**, as predicted | The Makefile self-check is blind to a dropped suite. See the finding below. |
| G6b | `canary/g6b-tracked-dist-unfixed` `691e8af` | `30462190434` | **SUCCESS**, as predicted | The hole G6 closes was genuinely open at `43bd206`. |
| — | `fix/dist-tracked-allowlist` `6927b11` | `30462191673` | **SUCCESS** | The tightened arm does not red a legitimate tree. |

### G6 and G6b are one result, not a red plus a footnote

G6's red, on its own, proves only that the *new* allow-list arm is **capable of
failing**. It says nothing about whether the arm was needed, because a red is
what you would see either way — a necessary fix and an over-eager one produce
the identical colour.

G6b runs the **identical canary** — the same force-added `web/dist/index.html` —
against unfixed `43bd206`, where the allowed tracked set was defined as
"whatever git tracks here". `git add -f` makes build output tracked, tracked
makes it allowed, and the arm waves it through: run `30462190434` is green with
committed build output sitting in `web/dist`.

**The pair is the claim, not the red.** Same canary, same base, two colours:
red with the fix, green without it. This is the general test — *a control that
comes out the same colour under both hypotheses is not a control* — and this
pair passes it because the two arms disagree. Neither run should be cited
alone; a fix that cannot be shown to have been necessary is indistinguishable
from one that was not.

### A guard exercised free, as a side effect

| Guard | Observed in | Run | Error line |
|---|---|---|---|
| `if-no-files-found: error` on `Upload test membership evidence` | G1's cascade | `30462183955` | `No files were found with the provided path: go-test.log` |

This is the one guard previously reported as **impossible to exercise
off-runner**: `if-no-files-found` is behaviour inside `actions/upload-artifact`,
and until a real runner refuses a real absent artefact, the change from `warn`
to `error` was verified only against that action's published input schema. G1
skipped the Go suite, no `go-test.log` was written, and the upload step failed
instead of printing a warning and leaving the job green.

An evidence gate that passed when there was no evidence now fails. Nobody paid
for this run; it arrived as a consequence of a canary aimed at something else.

## Finding: a gate whose name claims more than the gate does

**`Makefile self-check (make test reaches both suites)` cannot detect a Makefile
that stops reaching a suite.**

The step is, in full, `run: make test`. That detects a Makefile whose targets
**fail**. It cannot detect a Makefile that silently stops **reaching** a target,
because a `test:` rule with a prerequisite removed still exits 0.

This is **observed, not argued**. `canary/g5b-suite-dropped` changes one line —
`test: test-go test-web` becomes `test: test-go` — and nothing else. Run
`30462186962`, head `4e2281b`:

- overall conclusion **SUCCESS**;
- the step named "Makefile self-check (make test reaches both suites)"
  **ran** and **passed**;
- that step's log contains **zero** occurrences of `npm` and zero of `vitest`.
  `make test` reached the Go suite and stopped.

**A step named for reaching both suites reached one, and reported success.**

The distinction matters for how this is weighted. "The name overstates the gate"
is a reading of the source; anyone can disagree with a reading. A green run in
which the step demonstrably never touched the web suite is a measured fact, and
it is not open to a second opinion.

This matters more than the six reds. A gate that is absent is a known gap. A
gate whose **name overstates it** is read as coverage, and the reader stops
looking — which is the same mechanism that produced every defect this track was
convened to fix. The step is not useless: it does catch a broken Makefile, which
is what G5 demonstrates. It simply does not do the thing its name promises.

Recorded as a finding, not fixed. Making the self-check honest means asserting
that `make -n test` *reaches* each suite, which is a change to the gate itself
and therefore outside this task's scope. Under the owner's scope freeze it is
filed in `OUT-OF-SCOPE-BACKLOG.md` rather than added to the defect list, with
this run ID attached so nobody has to re-derive it.

## Cascade assessment (requested; nothing changed)

`g1`, `g2` and `g6` each show **three** failing steps; `g3`, `g4` and `g5` show
one. The extra two in the three-red runs are always the same pair:

```
Go test membership (asserted against a committed manifest)
  ##[error]go-test.log absent: the Go suite produced no evidence.
Upload test membership evidence
  ##[error]No files were found with the provided path: go-test.log
```

**Mechanism.** The first gate reds. Every following step with default `if:`
skips — including `Go tests (invoked directly)`, so `go-test.log` is never
written. The membership step carries `if: always()`, so it runs anyway, finds no
log, and fails closed. The upload step also runs, finds no artefact, and errors
because `if-no-files-found: error`.

**Is this the intended design?** Yes, and both `always()` and `error` are
load-bearing. The reason not to make the membership step success-gated, stated
exactly: **the membership step running only on success would blind it exactly
when an earlier failure is what is doing the concealing.** The failure mode this
repository actually shipped — a green run concealing a failing Go test — has a
failure elsewhere as its precondition, so gating the guard on the absence of
failures switches it off in precisely the runs that need it. (The `error` half
of this is recorded above as its own row: run `30462183955` is the
`if-no-files-found` change firing on a real runner for the first time.)

**Is a genuine membership failure at risk of being dismissed as noise?** On the
evidence, no — the two cases are disjoint on three independent axes:

1. **Message text.** Cascade says `go-test.log absent: the Go suite produced no
   evidence.` A genuine failure says `Go tests listed in the manifest DID NOT
   RUN:` and then names the package-qualified tests. Neither string appears in
   the other case.
2. **Position.** In a genuine failure the membership step is the *first* red in
   step order (`g4`, run `30462183557`, is a one-red run). In a cascade it is
   never first; some earlier gate is red above it.
3. **Skip pattern.** In a cascade, `Go tests (invoked directly)` shows as
   *skipped*, not passed — visible without opening a log.

So the reading rule "the first red in step order is the real one" is sound here
and mechanically checkable.

**Assessment: correct as-is.** The residual risk is not misreading, it is
habituation: a three-red run teaches a reader that two of the three reds are
consequences, and the membership step is one of the two they learn to skip past.
That only bites when an early gate red and a genuine missing test occur in the
*same* run — and in that case the earlier red already blocks the merge, so the
outcome is a delayed diagnosis rather than a false green. Narrow, and strictly
better than the alternative.

Explicitly **not** done, and it should not be done: making the membership step
skip when an earlier step failed. A skipped guard is how this repository got
here.

**What was done**, after review approved it: the "absent log" branch now says
that it is probably a consequence, tells the reader to look above, and states
how a genuine missing test reports differently (`DID NOT RUN`, with the tests
named). This is a message change only — the `::error::` and the `exit 1` are
untouched, and no assertion is weakened. It removes the one residual the
assessment identified, by making the habituated reader's shortcut correct
instead of hoping they resist it.

## Limitation of G6, stated plainly

A faithful reproduction of the committed-build-output case would commit the real
4109-file build. That is forbidden, and rightly. G6 and G6b therefore commit a
**single stub file** under `web/dist`. It exercises the same code path — the
tracked-set comparison — with a much smaller blast radius, but it is a stand-in.
What the pair proves is that the arm's tracked-set logic changed behaviour on
committed build output. It does not prove anything about scale, and it should
not be cited as if it did.

## Measurement discipline: a void result found in my own work

The track rule became *measure the commit, not the tree* partway through this
task. It immediately caught something in my own work, and this is the part of
this entry most worth keeping.

My first probe of the G6 arm ran in my working tree. That tree carried a full,
real, **untracked** `web/dist` build left over from earlier work. Because
`.gitignore` ignores `web/dist/*`, `git status --porcelain` was **empty**. Under
the previous rule I would have reported, truthfully, that the tree was clean —
and the measurement would still have been void, because the arm was reading
4109 files the commit did not contain.

A truthful clean-tree declaration and a void measurement, at the same time, on
the same command. That is the exact shape the new rule exists to eliminate:
declaring tree state is a diligence remedy, and diligence does not see what the
instrument cannot distinguish. The measurement was redone from a fresh clone of
`f513fb7`, which can only see what the commit contains, and the runner results
above supersede it entirely.

It is also, precisely, the incident now written into the comment at the
pre-build arm: a tree that builds and a commit that does not, indistinguishable
to whoever reads the result.

Every run ID above was cross-checked against its local ref before being
recorded: all nine `head_sha` values match the commits in this tree exactly.

## Canary hygiene

All eight canary branches are throwaway. None is merged, none is based on a
canary, and every canary file and comment says `CANARY ONLY - NEVER MERGE` in
its own text as well as in its commit message. The only branch intended for
merge is `fix/dist-tracked-allowlist`.

## Provenance of the commits cited above

Every canary was based on `43bd206`, and the run IDs in the tables are the runs
of exactly those commits. Afterwards `fix/dist-tracked-allowlist` was rebased
from `43bd206` onto `aa08f1a` (main having gained the shared web test runner).
The rebase was mechanical and conflict-free: this branch touches `ci.yml` and
this log, main's four new commits touch `scripts/ci-suite-manifest.mjs`,
`web/package.json`, `web/scripts/run-node-tests.mjs` and two other log entries —
**no file in common**.

The run recorded for the deliverable, `30462191673`, was therefore measured at
pre-rebase `6927b11`. `ci.yml` is unchanged by the rebase, but a commit the
runner has not seen is not a commit the runner has approved, so the rebased and
reworded branch is being re-run before merge rather than inheriting that green.
