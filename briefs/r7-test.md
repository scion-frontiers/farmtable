# BRIEF — test-xss-r7 (test / QA review)

Read `_r7-COMMON.md` first. This file carries only what is yours.

**TREE: `/workspace/farmtable-xss-r7-test`, detached at `e4e3d13`. Yours alone; no
other leg is in it, and no other leg shares any scratch path with you.**

## SCOPE

This round shipped tests and guards, and it shipped a canary record claiming each
guard was made to fire. Nine cells, pre-registered, recorded under `FIX ROUND r7`
in `reports/_run-queue-log.md`.

**YOUR PRIMARY JOB IS TO AUDIT THAT EVIDENCE, NOT TO ACCEPT IT.** The record is a
claim about what happened. Judge whether the artefacts support it, whether the
cells are the cells that matter, and whether any green in it means what it is
being read to mean.

Specific properties this project has learned to check, in rough order of how often
they have been the answer:

- **AN UNFIRED GUARD IS AN UNTESTED GUARD**, and a guard ported by its wording
  rather than by its mechanism is vacuous on the new channel and reports PASS.
- **A CONTROL PROVES THE DETECTOR FIRES. IT DOES NOT PROVE THE DETECTOR IS
  POINTED AT THE RIGHT POPULATION.** Plant the positive inside the population
  actually being searched.
- **A MUTATION MATRIX MEASURES THE DETECTOR AND ASSUMES THE CENSUS.** For each
  guard here, what is its population, how is that population built, and what
  would silently shrink it? A case list built by filtering through the very
  predicate under test shrinks to the cases that already pass.
- **A POPULATION PIN HAS A LEVEL, AND A PIN AT THE WRONG LEVEL IS ABSORBENT.** A
  total absorbs cross-member compensation; a per-member count absorbs
  within-member compensation; an identity binding absorbs neither.
- A guard that measures whether a check PASSED does not measure whether the check
  STILL EXISTS. A deleted check does not go red — it stops existing.

Also assess the new tests as tests: can each one fail, for the reason it names,
and only for that reason? Overlapping assertion arms mask each other, so a probe
must be able to say WHICH arm fired.

Note the flake context before you read any single run as a result: several tests
in this repo are load-sensitive and the load includes how many agents are running.
A single-run matrix here carries real odds of a spurious RED.

## THE TOKEN

You are the leg most likely to need a wide run, and the fix leg's own bound is
that every package other than `internal/server` and `internal/webguard` is
unverified and `web/src/capabilities.ts` never saw `tsc`. **IF YOU WANT THE BUILD
TOKEN, ASK ME FOR IT AND SAY WHAT YOU INTEND TO RUN.** Do not run a wide build
first and tell me after. Targeted single-package runs are yours already, logged
before the run, with ROOT and DIST filled in.

## DELIVERABLE

**`/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r7.md`**
plus `reports/test-xss-r7-project-log.md`. Into that directory, NOT the repo.

Verdict: `APPROVE` or `REQUEST CHANGES`, blocking separated from non-blocking.

## TERMINATION

**You MUST write `reports/test-xss-r7.md` and the project log entry, message
`eng-manager` with the verdict and the single canary cell you trust least, and
then mark the task complete.** Write the file; do not ask.
