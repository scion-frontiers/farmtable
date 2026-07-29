
### R8 / dev-xss-r8 — RESULTS. Written after the cells ran, against the predictions above.

**ROOT/DIST on every row, including the passing ones.**

| cell | ROOT | DIST | PREDICTED | OBSERVED | artefact |
|---|---|---|---|---|---|
| R8-01 | MYTREE `/workspace/farmtable-xss-r8` | ABSENT | GREEN | **GREEN**, `ok 0.003s` | `/tmp/r8-work/R8-01.txt` |
| R8-02 | MYTREE | ABSENT | GREEN 4/4 | **FALSIFIED — 4 RUN, 1 FAIL** | `/tmp/r8-work/R8-02.txt` |
| R8-02b | MYTREE | ABSENT | (re-run after fix) | **GREEN 4/4**, `ok 0.014s` | `/tmp/r8-work/R8-02b.txt` |
| R8-03 | MUTATED-v2 `/tmp/r8-mutation/mutated-v2` | ABSENT | **RED** | **RED**, 6 errors, all on the predicted arm | `/tmp/r8-work/R8-03.txt` |
| R8-04 | MUTATED-v2 | ABSENT | **GREEN** | **GREEN**, `ok 0.005s` | `/tmp/r8-work/R8-04.txt` |
| R8-05 | PRISTINE-v2 `/tmp/r8-mutation/pristine-v2` | ABSENT | GREEN 4/4 | **GREEN 4/4**, `ok 0.013s` | `/tmp/r8-work/R8-05.txt` |

**R8-02 FALSIFIED MY OWN PREDICTION AND THE CAUSE WAS MY OWN EDIT.** I predicted GREEN 4/4 and
got `TestWebRemoteDataConsumersAreDeclared` RED on one undeclared mention:
`src/capabilities.ts:112: // remote_data map containing writable=true, TOGETHER, IN ONE OBJECT. No`
— a comment line I added for item 3. The guard was right and I was wrong. Closed the way the
guard's own failure message prescribes for a reworded comment: one allowlist entry, with the
reason, not a category and not a rewording that dodges the identifier. **The guard caught a
change made by the leg sent to service the guard, on the first run after that change.**

**R8-03 + R8-04 TOGETHER ARE THE ITEM-2 RESULT, and neither is worth much alone.**
R8-03 is the red the brief asked for: revert the anchoring and the NEW test fails. R8-04 is the
discriminator: the SAME mutation, in the SAME tree, in the SAME invocation shape, leaves the OLD
test `TestWebCensusDescendsIntoShippedSource` GREEN. So the new test is not merely red — it is
red *where the existing one is blind*, which is the property r7 was missing.

**R8-05 is the control for the apparatus, not for the code.** Both `/tmp` copies are byte-identical
to MYTREE except the mutated line (`diff -r` output: exactly one hunk, `325c325`). PRISTINE-v2
green means R8-03's red is caused by the mutation and not by the copying.

**COPIES RETAINED, NOT DELETED, per the durability freeze. Disposition is the EM's:**
`/tmp/r8-mutation/pristine`, `/tmp/r8-mutation/mutated` (pre-allowlist-fix, superseded),
`/tmp/r8-mutation/pristine-v2`, `/tmp/r8-mutation/mutated-v2` (the ones the table above used).
Run artefacts under `/tmp/r8-work/`.

**NO BUILD TOKEN WAS REQUESTED OR USED.** Every cell is OP-1(b)-shaped single-package; the two
mutation cells are OP-1(h) against throwaway copies outside `/workspace`. `go build ./...`,
`go vet ./...`, `go test ./...`, `make test` and `npm test` were NOT run by this leg.
