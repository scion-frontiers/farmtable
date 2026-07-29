# ROLE BRIEF — test-xss-r8 (TEST REVIEW)

Read `briefs/_r8-COMMON.md` in full first. It is apparatus and contains no targeting.
Your tree: **`/workspace/farmtable-test-r8`**, already at `901670e`.
Your report: **`reports/test-xss-r8.md`**. Your log: **`reports/test-xss-r8-project-log.md`**.

## YOUR PASS

**COLD PASS FIRST, WRITTEN TO DISK, BEFORE YOU OPEN `briefs/_r8-PHASE-TWO.md` OR ANY PRIOR REPORT.**

`internal/webguard/remotedata_consumers_test.go` gained 171 lines this round. That file is the
round's main test artefact and it is the thing least able to tell you whether it works.

What I want, in order:

1. **FOR EVERY NEW OR CHANGED ASSERTION: WHAT MUTATION MAKES IT GO RED?** If you cannot name one, the
   assertion is UNRESOLVED, not passing. **A SURVIVED ROW MUST CARRY EXECUTION EVIDENCE** — if the
   evidence is absent, the row is UNRESOLVED, not SURVIVED.
2. **Vacuity.** A test whose fixture issues zero of the operations it claims to pin. A tautological
   assert. A count-pin that a count-neutral corruption walks straight through. **A GATE THAT READS A
   COUNT IS STRUCTURALLY BLIND TO A COUNT-NEUTRAL CORRUPTION OF THE THING IT COUNTS.**
3. **Does anything actually RUN these tests?** Delivery is not consumption. A test file that no CI
   path, no `make` target and no `npm` script reaches is not coverage. **A CHECK CAN PIN DELIVERY
   WITHOUT PINNING CONSUMPTION**, and this project has shipped that too.
4. **Coverage locality:** if the only pin on a behaviour lives in a different package, say so.

## THE FLAKE — READ THIS BEFORE YOU BUILD ANY MATRIX

**[MEASURED, prior rounds] `TestWatchTasks_NoInitial` and four siblings flake at ~4.5% per sequential
full-suite run.** A 27-row single-run mutation matrix is **~71% likely to contain at least one
spurious RED.** So:

- **A SINGLE-RUN RED IS NOT A RESULT.** Re-run any RED before you report it, and say how many times.
- The flake is a **LOST EVENT, not a timeout.** Raising the deadline does not fix it and makes the
  suite slower. Do not propose that.
- **[MEASURED, and it is mine] the flake rate is LOAD-SENSITIVE and the load is MY OWN PARALLELISM.**
  Every flake rate this project has recorded is confounded by how many legs I was running. I am
  running the token policy partly for this reason. **If your observed rate differs from 4.5%, THAT IS
  A RESULT AND I WANT IT** — it is a measurement of my scheduling, not just of the suite.

## THE TOKEN

You are the leg most likely to need it. See `_r8-COMMON.md` §4 — request it with your exact command
list and your PRE-REGISTERED expected outcome. **Pre-register before you run, not after.** A receipt
composed before the event is a prediction wearing a measurement's format; a prediction ANNOUNCED as a
prediction is exactly what I want.

You may add test files in your own tree to run an experiment. **Do not commit them and do not modify
any production file.** State which experiments required a code change and what it was.

## VERDICT

`APPROVE` / `APPROVE WITH CONDITIONS` / `REQUEST CHANGES`, at the top, findings numbered with
severity. **Separate your verdict from your support for it.**
