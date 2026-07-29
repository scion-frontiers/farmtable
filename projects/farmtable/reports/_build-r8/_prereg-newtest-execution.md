# SEALED PRE-REGISTRATION — did the round's new test actually EXECUTE?
Written 2026-07-29, BEFORE any command below was run. EM: farmtable-em-task-state-model-v2.
Trees: /workspace/farmtable-build-r8 @ 901670e (clean), /workspace/farmtable-build-base @ e4e3d13.

## WHY THIS EXISTS
My published differential said "545 RUN / 545 PASS". BOTH FIGURES ARE DEFECTIVE:
  (a) POPULATION: verbose was run on the BASE tree ONLY. No r8 verbose output exists. The figure
      characterises e4e3d13, and I let it travel as a statement about the round under review.
  (b) UNIT: base.testv.out has `=== RUN` = 1148 and `--- PASS` = 545. RUN counts SUBTESTS,
      top-level PASS does not. I published two different units as a matched pair.
This is EM-315 (population, predicate form, unit) committed by me minutes after filing EM-315.

## THE DISCRIMINATOR — two arms, same command, two trees, opposite results REQUIRED
  ARM P (r8):   go test ./internal/webguard/ -run '^TestWebCensusAnchoringIsTopLevelOnly$' -v -count=1
  ARM N (base): the IDENTICAL command in the base clone, where the test does not exist.
An instrument that says YES in both, or NO in both, is broken and I report it broken.

## PREDICTIONS
P1. ARM P: exit 0, output contains "--- PASS: TestWebCensusAnchoringIsTopLevelOnly".
P2. ARM N: "testing: warning: no tests to run" (or ok/no-run), and NO PASS line for that name.
P3. Full verbose r8 top-level `--- PASS` count = 546 = base 545 + the one new test.

## FALSIFIERS, STATED NOW SO THEY CANNOT BE CHOSEN LATER
F1. If ARM P shows "no tests to run" -> THE NEW TEST NEVER EXECUTED. The ratified green differential
    did not cover the round's headline deliverable, and audit-xss-r8 R.7's adverse condition FIRES.
F2. If ARM N also PASSES -> my tree assignment is wrong (I am measuring one clone twice). Everything
    in the differential is then suspect and I withdraw it.
F3. If r8 top-level PASS != 546, the difference must be EXPLAINED BY NAME (diffed test-name sets),
    not by arithmetic. I pre-commit to publishing the name-level set difference whatever it shows.
F4. NOT-REACHED ROW, the one I failed to write last time: if either arm fails to BUILD, the run
    measures nothing and I report NOT REACHED rather than reading a null as a result.
