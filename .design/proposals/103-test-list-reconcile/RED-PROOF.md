# D4 RED PROOF — check-test-membership.mjs

Every line below is verbatim captured output. **Nothing here compiled or ran a
test suite.** The only thing executed is the guard itself, which reads
`package.json` and `tsconfig.test.json` as text. No build token was used.

Reproduce: `zsh .design/proposals/103-test-list-reconcile/red-proof-arms.sh`
(fixture at `/tmp/d103/fixture/web`, built from the real blobs of both sides).

## Why there are seven arms and not one

A guard that has only ever printed 0 has been observed agreeing, not firing.
ARM A is the green control; if it were missing, a guard that fails on every
input would look identical to a working one. ARM E is the arm that justifies
pinning membership instead of a count: it holds the executed count fixed at
five and swaps one suite for another, so a `>= 5` floor and an `== 5` exact
count are BOTH GREEN on that tree, and this pin is RED. ARMS D and F are the
fail-closed arms: the guard reports UNDETERMINED (exit 2) rather than passing
on a wiring it cannot model. ARM G is a regression arm — see below.

## ARM G exists because the guard was RED FOR THE WRONG REASON at 03:10Z

On its first run against the real `#195` tree the guard exited 1 — the result
that tree should produce — while reporting `src/util/markdown.test.test.ts`,
a path that exists nowhere. The internal stem is `util/markdown`; the
hand-written pin said `util/markdown.test`; nothing normalised. All five names
in that report were wrong, including the two suites that were running fine.

The six original arms missed it because every one of their pins was generated
by `--write-pin`, so the writer and reader shared a private convention and
always agreed. The untested path was the hand-written pin — the only kind a
human ever maintains. **A guard tested only against its own generated input
has tested its agreement with itself.** The exit code was the expected one,
which is exactly why it would have shipped.

Fixed by canonicalising both sides through one function, and by making an
unparseable pin entry UNDETERMINED rather than a reported missing suite — a
false accusation against a live suite is indistinguishable in the output from
the real defect, and only one of them is worth waking someone for.

## Captured output

```

############ ARM A: reconciled/XSS wiring, all five union suites discovered. GREEN CONTROL. ############
Execution mode: delegated discovery (scripts/run-tests.mjs globs src/**/*.test.ts)
Executed suites (5):
  src/util/assertions.test.ts
  src/util/markdown.test.ts
  src/util/safe-url.test.ts
  src/util/url-binding-scan.test.ts
  src/utils/task-ready.test.ts

PASS: all 5 pinned suite(s) execute.
EXIT=0  (expected 0)  OK

############ ARM B: take-195 resolution on a merged tree. Three suites stop running. ############
Execution mode: explicit invocation list in package.json "test"
Executed suites (2):
  src/util/markdown.test.ts
  src/utils/task-ready.test.ts

FAIL: 3 pinned suite(s) are NOT executed by `npm test`:
  src/util/assertions.test.ts
  src/util/safe-url.test.ts
  src/util/url-binding-scan.test.ts

  These files may still exist on disk and may still compile. They are not
  being run. `npm test` will exit 0 without them and report no smaller number.
  If the removal is deliberate, remove the name from the pin file in the same
  commit, so the diff records which suite stopped running and why.
EXIT=1  (expected 1)  OK

############ ARM C: 195 package.json + XSS glob tsconfig. Compiled, never executed. ############
Execution mode: explicit invocation list in package.json "test"
Executed suites (2):
  src/util/markdown.test.ts
  src/utils/task-ready.test.ts

FAIL: 3 pinned suite(s) are NOT executed by `npm test`:
  src/util/assertions.test.ts
  src/util/safe-url.test.ts
  src/util/url-binding-scan.test.ts

  These files may still exist on disk and may still compile. They are not
  being run. `npm test` will exit 0 without them and report no smaller number.
  If the removal is deliberate, remove the name from the pin file in the same
  commit, so the diff records which suite stopped running and why.
EXIT=1  (expected 1)  OK

############ ARM D: XSS package.json + 195 hand include. Runner aborts; NOT a membership answer. ############
GUARD-UNDETERMINED: the test script delegates to scripts/run-tests.mjs, but tsconfig.test.json "include" is ["src/utils/task-ready.test.ts","src/util/markdown.test.ts"], not ["src/**/*.test.ts"].
  run-tests.mjs aborts on exactly this mismatch, so `npm test` fails closed and
  runs nothing. Fix the wiring; there is no membership answer to give.
  Refusing to report a membership result. This is not a pass.
EXIT=2  (expected 2)  OK

############ ARM E: COUNT-NEUTRAL SUBSTITUTION. 5 executed, 5 pinned. A FLOOR AND AN EXACT COUNT BOTH PASS HERE. ############
Execution mode: explicit invocation list in package.json "test"
Executed suites (5):
  src/util/assertions.test.ts
  src/util/decoy.test.ts
  src/util/markdown.test.ts
  src/util/safe-url.test.ts
  src/utils/task-ready.test.ts

FAIL: 1 pinned suite(s) are NOT executed by `npm test`:
  src/util/url-binding-scan.test.ts

  These files may still exist on disk and may still compile. They are not
  being run. `npm test` will exit 0 without them and report no smaller number.
  If the removal is deliberate, remove the name from the pin file in the same
  commit, so the diff records which suite stopped running and why.
EXIT=1  (expected 1)  OK

############ ARM F: unrecognised invocation form. Open form space, bounded from the other end. ############
GUARD-UNDETERMINED: unrecognised step in the test script: "node --test .tmp-test/"
  This guard cannot tell which suites that step runs, so it will not report a
  membership result. Add the step to this guard, or express it in a form the
  guard already understands.
  Refusing to report a membership result. This is not a pass.
EXIT=2  (expected 2)  OK

############ ARM G: hand-written pin, all four spellings mixed. REGRESSION ARM. ############
Execution mode: delegated discovery (scripts/run-tests.mjs globs src/**/*.test.ts)
Executed suites (5):
  src/util/assertions.test.ts
  src/util/markdown.test.ts
  src/util/safe-url.test.ts
  src/util/url-binding-scan.test.ts
  src/utils/task-ready.test.ts

PASS: all 5 pinned suite(s) execute.
EXIT=0  (expected 0)  OK
```
