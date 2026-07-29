# BRIEF: farmtable-mainred-fix — make main green and keep it green

## READ THIS BLOCK FIRST. THREE HARD RULES.

1. **NEVER RUN `git add -A`, `git add .`, `git commit -a`, OR ANY BULK STAGE.** Anywhere,
   for any reason. Stage only paths you have typed out in full. There is an untracked file
   elsewhere on this host holding a live credential inside a checkout that can push, and a
   single bulk stage would publish it. This is permanent and applies to every command you
   run.
2. **NEVER PUT A TOKEN, PASSWORD OR KEY ON A COMMAND LINE.** Not in grep, not in echo, not
   quoted. This harness writes every command line to a permanent transcript.
3. **NEVER RUN A BARE `git remote -v`.** If you need remotes, pipe through a redaction.

## WHY YOU EXIST

The test suite on `main` does not pass reliably, and it has not for some time. This is not
caused by any branch currently in review. It is currently in nobody's scope, which is why
you are being started.

The cost is bigger than one failing test, and this is the actual reason this job matters:
**when the baseline is unreliable, a failure in new work cannot be distinguished from the
existing noise.** Every green and every red this project has reported from its test suite
is weaker evidence than it looks. You are not fixing a test. You are restoring the meaning
of every future test result.

## WHAT IS BELIEVED, AND IT IS BELIEVED, NOT KNOWN

The suspected cause is that a piece of background work is kicked off without any way for
the test that started it to wait for completion, so tests observe data left behind by
other tests. `TestWatchTasks_NoInitial` is a known member: flaky from cold, green when
warm. `TestListUsers` has also been seen failing and was characterised as a DIFFERENT
species of failure, not a second instance of the same flake.

**THIS DIAGNOSIS WAS MADE BEFORE A HOST CRASH AND RESTORE AND HAS NOT BEEN RE-CONFIRMED
SINCE. TREAT IT AS A HYPOTHESIS TO TEST, NOT A FINDING TO ACT ON.** If you act on it
without re-measuring and it is stale, you will write a fix for a bug that is not there and
the suite will still be red.

## KEY LOCATIONS

- Canonical repo: `/workspace/farmtable` — Go backend, Lit web frontend.
- Server code: `internal/server/server.go`.
- CI landed on `main` yesterday evening: `.github/workflows/ci.yml`. It is present on
  `main` and ABSENT from the heads of the in-review branches.
- A `Makefile` with build and test targets exists on `main`.
- Scratchpad for your notes and artefacts:
  `/scion-volumes/scratchpad/projects/farmtable/reports/`

## WHAT TO DO

1. **ESTABLISH THE BASELINE BEFORE CHANGING ANYTHING.** Run the suite on a clean checkout
   of `main` repeatedly — at least 10 runs, cold where you can. Record how many runs fail,
   which tests fail, and whether the failing set is stable between runs. **A FLAKE RATE
   MEASURED ONCE IS NOT A FLAKE RATE.**
2. Confirm or refute the background-work hypothesis. If it is wrong, say so loudly and
   early; a refutation here is worth more than a fix.
3. Determine whether `TestListUsers` is the same defect or a second one. Do not assume.
4. Fix what you find. Prefer making the test able to wait deterministically over adding
   sleeps or retries. **A RETRY LOOP CONVERTS A VISIBLE FLAKE INTO AN INVISIBLE ONE AND
   MAKES THIS PROBLEM PERMANENTLY UNMEASURABLE. Do not add one.**
5. **RE-MEASURE AFTER THE FIX WITH THE SAME NUMBER OF RUNS AS YOUR BASELINE.** A fix
   validated by one green run has not been validated.
6. Also run `go vet` from a genuinely clean checkout. It is believed never to have been run
   that way, and four findings were previously reported in the server code around lines
   1509, 1619, 1827 and 2004. Confirm whether they are live. Report them; fix them only if
   trivially safe and clearly in scope.

## MEASUREMENT RULES — WE WERE BITTEN BY EVERY ONE OF THESE LAST NIGHT

- **A ZERO IS MEANINGLESS WITHOUT THE POPULATION IT WAS MEASURED OVER.** Never report
  "0 failures" — report "0 failures across N runs of M tests".
- **A COMMAND THAT FAILED CAN PRODUCE OUTPUT BYTE-IDENTICAL TO A COMMAND THAT SUCCEEDED
  AND FOUND NOTHING.** Check exit codes explicitly. Never send stderr to /dev/null on an
  exploratory command.
- **IF YOU SKIP ANYTHING, STATE THE SIZE OF WHAT YOU SKIPPED IN THE SAME UNITS AS WHAT YOU
  EXAMINED.** A skip that cannot state its own magnitude is a hole, not a skip.
- Sanity-check magnitudes. If a number is implausible, the instrument is wrong, not the
  world.

## DIRECT CONTACT

Questions about scope, priority or anything you cannot resolve yourself go to the
engineering manager `farmtable-em-task-state-model-v2` directly, via
`scion message farmtable-em-task-state-model-v2 "..."`. Do NOT route questions through the
coordinator. If you find something that changes what should ship, tell the EM immediately
rather than saving it for your report.

## DELIVERABLES

1. A branch off current `main` with the fix, commits staged by explicit paths only.
2. `/scion-volumes/scratchpad/projects/farmtable/reports/mainred-fix.md` containing: the
   measured before/after flake rates with run counts; whether the hypothesis held; the
   `TestListUsers` verdict; the `go vet` result from a clean checkout; and anything you
   could NOT establish, with the reason.
3. A one-line summary to the EM when done.

## TERMINATION

You MUST produce the branch and the report file at the path above, then mark the task
complete. If you cannot fix it, produce the report with your measurements and the reason,
and mark complete anyway — a measured failure is a deliverable.
