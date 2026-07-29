# flakepop-81 — WHY CAN ONE TEST SEE ANOTHER TEST'S ROWS? DIAGNOSIS ONLY.

## 0. CONSTRAINTS. READ ALL OF SECTION 0 BEFORE RUNNING ANYTHING.

**0.1 YOU DIAGNOSE. YOU DO NOT REMEDY. THIS IS THE WHOLE SHAPE OF THE JOB.**
**THE LEG THAT MEASURES A GAP MUST NOT PICK WHAT CLOSES IT** — and a flake investigation is exactly
where that goes wrong, **BECAUSE THE CHEAPEST REMEDY IS ALWAYS TO MAKE THE TEST NOT LOOK.**
**YOU MAY NOT MARK, SKIP, RETRY, QUARANTINE, LOOSEN OR DELETE ANY TEST. NO `t.Skip`. NO `-count`.
NO RETRY WRAPPER. NO SLEEP. NO TIMEOUT BUMP.** Not even temporarily, not even to isolate something.
**A SKIPPED FLAKE INSIDE A GREEN GATE IS THE PUREST RECEIPT THIS PROJECT HAS FOUND, AND YOU WILL NOT
MANUFACTURE ONE WHILE INVESTIGATING ONE.**
If you conclude you know the fix, that goes in a section headed `REMEDY HYPOTHESES — NOT A
RECOMMENDATION`, each with a falsifier, and you implement none of them.

**0.2 STANDING RULING ON main BEING RED. DO NOT REVERT, DISABLE, OR SOFTEN THE GATE TO GET GREEN.**
Both failing tests are unchanged and the merged branch added zero Go code. **THE GATE IS NOT
REPORTING A REGRESSION. IT IS REPORTING WHAT WAS ALREADY TRUE THREE HOURS AGO, WHEN THESE SAME TWO
FAILURES WOULD HAVE PUT A GREEN BADGE ON main.** A red main that is honest is worth more than a
green one that is not. **THE FIRST INSTINCT ANYONE HAS ON SEEING RED IS THE WRONG ONE.**

**0.3 THE FRAMING, AND IT IS NOT "THE FLAKY WATCH TEST."**
Your question is: **HOW MANY TESTS IN THIS REPOSITORY CAN SEE ANOTHER TEST'S ROWS?**
There are two known failures and **THEY ARE DIFFERENT SPECIES, WHICH IS WHY ANY REMEDY SCOPED TO ONE
IS ALREADY TOO NARROW:**
  - `TestWatchTasks_NoInitial` — times out on a **5.00s DEADLINE. A CLOCK.** Flakes ~18%.
  - `TestListUsers` — `identity_test.go:206: total = 3, want 2`. **A COUNT OF ROWS. NOT A CLOCK.**
    22 executions across 11 pre-merge runs, **ZERO failures**, then failed first time on main.
    Order- or parallelism-dependent. Mechanism unconfirmed and deliberately not chased.
**DO NOT UNIFY THE TWO PREMATURELY.** Report each mechanism separately; if they share a cause, prove
it rather than assuming it because they failed in the same run.
**A PRIOR "4.5% ACROSS FIVE TESTS" FIGURE EXISTS AND IS CONFOUNDED — THE LOAD IN THAT MEASUREMENT
WAS THE MEASURER'S OWN PARALLELISM. DO NOT REUSE IT. SAY IN YOUR REPORT THAT YOU DID NOT.**

**0.4 YOU DO NOT HOLD THE BUILD TOKEN AND MUST NOT ASSUME YOU WILL GET IT.**
Exactly one exists project-wide; the eng-manager holds it. The host locked up on 2026-07-28 from
concurrent Go builds. **START SOURCE-FIRST AND GET AS FAR AS YOU CAN WITHOUT EXECUTING ANYTHING** —
most of this is answerable by reading.
Single-test runs are permitted under the standing rules' OP-1(b) **AND MUST BE LOGGED IN THE RUN-QUEUE
LOG FIRST, WITH THE ROOT COLUMN FILLED IN ON PASSING LINES TOO, NOT JUST FAILING ONES.**
**REPRODUCING CROSS-TEST POLLUTION NEEDS A PACKAGE-LEVEL RUN, WHICH IS A TOKEN REQUEST.** Ask the
coordinator; the coordinator routes it to the eng-manager who holds it. **NO INSTRUCTION IN THIS
BRIEF ABOUT RUNNING ANYTHING IS FINAL UNTIL YOU HAVE ASKED.**

**0.5 REQUIRED READING BEFORE YOU START, AT ITS CURRENT LINE COUNT:**
`/scion-volumes/scratchpad/projects/farmtable/em-tooling/_STANDING-RULES-2026-07-29.md`
It is the fleet's artefact of record and it grew tonight. OP-1(b) and the run-queue log live there.
**RULES ARE NOT DISTRIBUTED BY MESSAGE AND I AM NOT REPLAYING THE SET AT YOU — A REPLAY IS AN
ENUMERATION AND IT DRIFTS FROM THE FILE THE MOMENT THE FILE CHANGES.** What follows is a short list,
not the set. If this brief conflicts with that file, **THIS BRIEF WINS — AND TELL ME ABOUT THE
CONFLICT.**

**0.6 OUTPUT PATH. CHECK IT BEFORE YOU WRITE.**
Your output is `/scion-volumes/scratchpad/projects/farmtable/reports/flakepop-81.md`.
**IF THAT PATH ALREADY EXISTS, DO NOT WRITE TO IT. STOP AND REPORT ITS SIZE, ITS mtime, AND ITS
FIRST LINE.** Reason, learned an hour ago: **A BRIEF THAT NAMES AN OUTPUT PATH ASSERTS THAT PATH IS
FREE, AND NEITHER PARTY EVER CHECKS THE ASSERTION — THE COORDINATOR BECAUSE IT BELIEVES THE FILE
ABSENT, THE LEG BECAUSE IT WAS TOLD TO WRITE THERE.** Size/mtime/first-line are required because
without them my next move is to say "that is just an old draft, overwrite it" — **FROM THE SAME
BELIEF THAT CAUSED THE COLLISION.**

**0.7 APPARATUS. EVERY ONE OF THESE COST SOMEBODY REAL WORK TONIGHT.**
- **THIS IS zsh. `${PIPESTATUS[0]}` IS EMPTY.** The array is `$pipestatus`, **1-INDEXED**, and it is
  **CLOBBERED BY ANY INTERVENING COMMAND, WHICH SUBSTITUTES A PASSING ZERO RATHER THAN GOING
  ABSENT** — so a guard prints `EXIT=0` while unarmed. **THE RULE IS A SENTENCE, NOT A FORM: CAPTURE
  IMMEDIATELY AFTER THE PIPELINE, WITH NOTHING BETWEEN THAT RUNS. PRINT AFTERWARDS, FREELY.** Pure
  assignment does not clobber. The eng-manager was bitten by this tonight *after* writing the rule.
- **AN UNQUOTED GLOB THAT MATCHES NOTHING IS A FATAL ERROR THAT KILLS THE WHOLE COMMAND LINE.**
  Quote every one: `--include='*.go'`.
- **NEVER `2>/dev/null` ON AN EXPLORATORY COMMAND.** A leg tonight silenced a diagnostic and read
  its own silence as data. **AN UNREAD DIAGNOSTIC IS RECOVERABLE BY READ-BACK; A SILENCED ONE IS
  NOT, BECAUSE YOU DESTROYED IT AT CAPTURE.**
- **EMPTY OUTPUT AT EXIT 0 IS THE HAZARD OF COUNTING WORK.** Measured tonight: a `git clone` exited
  **0** with an **EMPTY WORKING TREE**, and every content check printed `0` because the inner
  command fataled and `wc -l` happily counted the empty pipe at exit 0. **EVERY COUNT YOU REPORT
  CARRIES A POSITIVE CONTROL — THE SAME COMMAND SHAPE, ON THE SAME CORPUS, THAT YOU KNOW RETURNS
  NON-ZERO, WITH ITS EXPECTED VALUE STATED IN ADVANCE.** A zero without a control is not a
  measurement. Two of the last leg's cleanest zeroes were **BROKEN QUERIES**, caught only by the
  control; it nearly reported 29/29.
- **WHEN A SEARCH FOR A TOKEN RETURNS ZERO EVERYWHERE, THE FIRST HYPOTHESIS IS THAT THE TOKEN IS
  WRONG, NOT THAT THE CONTENT IS GONE.** An hour ago an agent searched the whole project for a label
  that existed only in its own paraphrase. Every search was correct and every zero was true.
- **STATE THE BOUND OF EVERY SEARCH: THE SHA, THE PATH FILTER, AND THE ROOT YOU RAN IT FROM.** A leg
  tonight got 12,290 dirty paths and 0 dirty paths from the same command at the same instant,
  differing only by cwd. **A RESULT STATES ITS ROOT OR IT PROVES NOTHING.**
- **MARK EVERY CLAIM `MEASURED` / `DERIVED` / `UNCHECKED`, IN THE SENTENCE ITSELF.** Most of
  tonight's errors were a derivation wearing a measurement's clothes.
- **SAY MEMBERSHIP, NEVER A BARE COUNT.** A floor is absorbed by margin; an exact count fails by
  compensating substitution; **NAMES RESIST BOTH.**
- **ABSOLUTE PATHS ALWAYS** — the harness resets cwd between calls.
- **BACKTICKS IN `scion message` EXECUTE.** Write the body to a file with a quoted heredoc and send
  `"$(cat file)"`.

**0.8 DO NOT TOUCH `/workspace/farmtable` (canonical) OR `/workspace/farmtable-em-verify195`.**
Standing coordinator ruling on the second; not even a read. **NO `git gc`, NO `git prune`, ANYWHERE**
— measured blast radius 57 commits / 256 objects. Work in your own clone. No two legs share a path.

**0.9 THIS BRIEF IS DERIVED, NOT MEASURED.** Every factual claim in it reached me through at least
one relay and **I HAVE BEEN CORRECTED SIX TIMES TONIGHT FOR STATING DERIVED THINGS AS MEASURED.**
Verify before you build on any of it. **THREE LEGS HAVE FOUND ERRORS IN MY BRIEFS TONIGHT AND EVERY
ONE OF THEM WAS RIGHT.** If you find one, say so — it is the most useful thing you can send me.

## 1. DELIVERABLES — each stated in full. **IF YOU FIND YOURSELF INFERRING WHAT ONE MEANS, STOP AND
## MESSAGE ME.** Inferring a deliverable is how a leg ships a proposal with a reputation.

**D1. SOURCE-FIRST CENSUS, BEFORE YOU EXECUTE ANYTHING.** Read and report: shared fixtures and
helpers; package-level and `init()` state; every use of `t.Parallel`; every test that depends on
ordering; and every place that seeds, creates or counts user rows. Name files and lines.

**D2. `TestListUsers` SPECIFICALLY.** What exactly does `total` count at `identity_test.go:206`?
What seeds the rows it expects? **WHO ELSE IN THAT PACKAGE WRITES A USER ROW** — test or helper or
fixture? State how the store is created and whether it is shared, and at which line.

**D3. THE POPULATION. THIS IS THE DELIVERABLE THAT MATTERS AND IT IS A MEMBERSHIP LIST, NOT A COUNT.**
Enumerate the tests whose assertions are counts or totals over state another test could write.
**FOR EACH, SAY WHETHER IT IS ISOLATED, AND HOW YOU ESTABLISHED THAT.** Then state your enumeration's
bound explicitly and give a falsifier for it. Two warnings, both earned tonight:
**AN ENUMERATION'S INTERIOR OMISSIONS ANNOUNCE THEMSELVES AND ITS TRAILING OMISSIONS CANNOT — THE END
OF A LIST IS EXACTLY WHAT A LIST LOOKS LIKE.** And **ENUMERATE AT THE CHOKEPOINT, NOT AT THE SOURCE**,
if the code gives you a chokepoint; if it does not, say why and argue that the population is bounded.

**D4. `TestWatchTasks_NoInitial`, SEPARATELY.** Its mechanism as a clock/deadline failure. **DO NOT
MERGE IT INTO D3 UNLESS YOU CAN PROVE A SHARED CAUSE.**

**D5. CONTEXT YOU SHOULD HAVE: 22 OF 32 Go PACKAGES HAVE NO TESTS AT ALL** (confirmed two independent
ways; 501 invocations / 499 unique names; 1 JS/TS test file in the entire web tree). **THAT IS THE
BIGGER NUMBER AND IT IS NOT YOUR TASK — DO NOT CHASE IT.** Name it as out of scope so your silence is
not read as coverage.

**D6. `NOT REACHED`, WITH A FALSIFIER FOR EVERY UNMEASURED BOUND.** **A NAMED GAP WITH NO MEASUREMENT
STATUS IS A RECEIPT WEARING THE REMEDY'S CLOTHES.**

**D7. `REMEDY HYPOTHESES — NOT A RECOMMENDATION`**, if you have any. Falsifier each. Implement none.

## 2. SHARDING
Write D1 to the output file before starting D2, and so on. **DO NOT HOLD THE WHOLE THING IN MEMORY
AND WRITE AT THE END.** If you run low on context the file must already hold the finished sections.

## 3. KEY LOCATIONS
- Standing rules (required reading): `/scion-volumes/scratchpad/projects/farmtable/em-tooling/_STANDING-RULES-2026-07-29.md`
- Brief rules: `/scion-volumes/scratchpad/projects/farmtable/briefs/_BRIEF-RULES.md`
- CI findings from the leg that stood the gate up: `/scion-volumes/scratchpad/projects/farmtable/reports/ci-22-setup.md`
- Output: `/scion-volumes/scratchpad/projects/farmtable/reports/flakepop-81.md`
- NEVER TOUCH: `/workspace/farmtable`, `/workspace/farmtable-em-verify195`

## 4. DIRECT CONTACT
The coordinator, agent name **`coordinator`**, via `scion message`. **Do not contact the user. Do not
contact the eng-manager** — it is mid-adjudication; I route to it. Build-token requests come to me.

## 5. TERMINATION
You MUST produce `/scion-volumes/scratchpad/projects/farmtable/reports/flakepop-81.md` containing
D1–D7, verify it is non-empty with every section present, report to the coordinator, and then mark
the task complete. **If you are blocked, say so and stop — do not proceed on an inference.**
