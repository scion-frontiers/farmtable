# dev-xss-r9-fix — XSS / url-scheme-validation, ROUND 9 FIX LEG

STATUS: BOUNDED FIX ROUND. Four items IN, five items explicitly OUT.
ADJUDICATED BY: EM, from the three r8 reports read in full from disk.
RATIFIED BY: coordinator ruling of 2026-07-29T11:23:30Z. Where this brief and that ruling differ,
THE RULING WINS AND YOU SHOULD TELL ME I GOT IT WRONG.

---------------------------------------------------------------------------------------------------
## 0. IDENTITY — EVERY ARTEFACT IN THIS ROUND IDENTIFIES A COMMIT BY SHA

  branch under repair ....... url-scheme-validation-r8
  r8 HEAD (your base) ....... 901670e
  merge-base with main ...... e4e3d13
  THE BEHAVIOURAL COMMIT .... af9ea8c   <-- memorise this, section 3 turns on it
  real main ................. cc92735   (canonical's refs are STALE; do not trust a stale ls-remote)

  r8's ONLY behavioural change to production code is three lines inside isCollectionWritable in
  web/src/components/ft-app.ts:

      if (coll.platform !== Platform.GITHUB) {
        return false;
      }

  MEASURED, and you should re-measure rather than believe me:
    isCollectionWritable has exactly THREE references tree-wide — its declaration, one call in the
    isReadOnly getter, one call in the isExternalWritable getter. All three are in ft-app.ts.
    command: grep -rn 'isCollectionWritable' web/src

## 1. YOUR TREE — ANNOUNCED, NOT ASSUMED

  Work in:  /workspace/farmtable-dev-xss-r9
  It will be a git clone. NOT cp -a, NOT rsync, NOT tar. Bulletin 10 item 5 prohibits any
  filesystem-level copy of a .git directory or working tree OUTRIGHT, not conditionally.
  If the path does not exist when you start, create it BY CLONE and message me the moment you do —
  a new working tree is announced AT CREATION, not at completion.
  DO NOT work in /workspace/farmtable, /workspace/farmtable-build-r8, or any other leg's tree.

## 2. BUILDS AND TESTS — THE RESTRICTION WAS LIFTED, AND ONE CAVEAT SURVIVES IT

  This section previously rationed builds to one agent at a time and HELD make test project-wide.
  BOTH RESTRICTIONS WERE LIFTED BEFORE YOU WERE DISPATCHED. Build freely. Run make test freely.
  You do not need to ask me and you do not need to hand anything back.

  THE CAVEAT, AND IT IS A MEASUREMENT CAVEAT NOT A PERMISSION ONE: several legs may now be
  building concurrently on this host, and this project has MEASURED that its worst test flake is
  LOAD-SENSITIVE — the flake rate rises with how much else is running. Roughly five tests flake at
  around 4.5%, so a single-run matrix of any size is quite likely to contain at least one spurious
  RED that has nothing to do with your change.

  CONSEQUENCE FOR YOU, and it cuts in the direction people do not expect:
    - A RED you did not expect may be the flake. Re-run before you believe it, and SAY IN YOUR
      REPORT that you re-ran and how many times.
    - A GREEN is NOT protected by this. Load-sensitivity inflates false REDs; it does not excuse
      a green. Section 3 still governs and a green pin is still worthless until you have seen it
      red on the revert.
  A BUILD IS A WRITE TO THE ENVIRONMENT EVEN WHEN IT WRITES NO FILE TO THE TREE.

---------------------------------------------------------------------------------------------------
## 3. THE NON-NEGOTIABLE ARM. READ THIS BEFORE YOU READ THE FOUR ITEMS.

  For the regression pin required by item A below, I WILL NOT ACCEPT "test added".

  *** THE ACCEPTANCE CRITERION IS: TEST ADDED, AND DEMONSTRATED RED ON REVERT OF af9ea8c,
      WITH THE RED OUTPUT PASTED INTO YOUR REPORT. ***

  You pick the mechanism — revert the commit in a scratch checkout, patch the three lines out by
  hand, stash, whatever you can execute and describe. THE LEG PICKS; THE ARM IS NON-NEGOTIABLE.

  Why it is non-negotiable, stated so you can judge whether I have scoped it correctly rather than
  just complying: this project has now shipped, repeatedly, tests that are GREEN both with and
  without the fix they were written to pin. A test that has never been observed RED is not evidence
  of anything. A count-pin RED is likewise not evidence of non-vacuity unless a COUNT-NEUTRAL
  corruption is also RED — if your pin keys on a number, corrupt the thing without changing the
  number and show me that goes RED too.

  PASTE THE RED. Not a description of the red. The output.

  *** 3.1 HOW TO RUN THE RED-ON-REVERT ARM, AND THE OBVIOUS WAY IS WRONG ***
  ADDED AFTER DISPATCH. This is a correction to the arm itself, not a decoration on it.

  The obvious way to run this arm is: run the suite with the fix in, see green; revert the fix,
  run the suite, see red; restore. TWO RUNS, ONE AFTER THE OTHER. Do not do that.

  Several other agents are building on this host concurrently, and this project has MEASURED
  that its worst flake is LOAD-SENSITIVE - the rate rises with how much else is running, and you
  cannot see that load from inside your container. A sequential before/after therefore samples a
  load-dependent function at two different moments and attributes the difference to your revert.

  AND NOTE WHICH WAY IT FAILS, because this is the part that matters:
  *** A SPURIOUS RED ON THE REVERT ARM CERTIFIES YOUR PIN AS NON-VACUOUS WHEN IT IS NOT. ***
  The contamination does not merely add noise here. It fails toward ACCEPTED. It produces
  exactly the evidence this section exists to demand, for the wrong reason, and it will look
  like a clean result. Every other failure this project has had this month has failed toward
  clean; this one fails toward "proven".

  SO: INTERLEAVE. Alternate reverted and fixed runs in pairs - reverted, fixed, reverted, fixed -
  at least three pairs, and report EVERY run's outcome, not a summary. Load is then matched by
  construction rather than recorded and hoped about. What I want to see is the reverted arm red
  in EVERY pair and the fixed arm green in EVERY pair. If a single pair disagrees with the
  others, say so plainly - a 5-of-6 result reported honestly is worth more to me than a 6-of-6
  I cannot check, and a split result is itself a finding about the test you just wrote.

  If your pin is a targeted single test rather than the full suite, this is cheap. Do it anyway.

---------------------------------------------------------------------------------------------------
## 4. IN SCOPE — FIVE ITEMS, AND NOTHING ELSE
  (This section said FOUR when the brief was first written. Item E was added on the coordinator's
  instruction before dispatch. If you find any other place in this document that still says four,
  that is one of my errors and I want it in your error list.)

### A. test F1 — the r8 behavioural change is UNPINNED
  The three-line platform guard is the entire production delta of r8 and nothing in the suite goes
  RED if it is removed. Add the pin. Subject to section 3 in full.

### B. review R-1 — STATE THE SET BY IDENTIFIER
  R-1 asks for the affected set to be stated. State it BY IDENTIFIER — function names, exported
  symbol names, test names. DO NOT cite file:LINE anywhere in the deliverable.
  Rule 30 exists because an annotation instruction citing file:NNN is falsified by the act of
  obeying it: your edit moves the line, and the citation you just wrote is now wrong.

### C. audit F3
  As filed in reports/audit-xss-r8.md. Read the finding in the report, not my paraphrase of it —
  I have been wrong about my own paraphrases in nineteen consecutive rounds and the two most
  material errors of round 15 were both my framing, not the legs' work.

### D. test F11 — and the deliverable word is TYPECHECK-VERIFIED
  F11 is discharged only if the result is typecheck-verified. "It should typecheck" is not the
  deliverable. Run the typechecker and paste what it said.

### E. go vet FROM A CLEAN CHECKOUT — ADDED AFTER THIS BRIEF WAS FIRST WRITTEN
  This is a fifth item, added on the coordinator's instruction. It is DIAGNOSTIC, not a fix
  mandate, and it is bounded — read the whole of it before you start, because the bound matters
  more than the finding.

  WHAT IS KNOWN, AND ITS PROVENANCE IS WEAK ON PURPOSE:
    - go vet has NEVER been run from a clean checkout on this project. Not once, by anyone.
    - There are FOUR outstanding vet findings in the server code from the last time anyone looked.
      I have never seen those four findings. I do not know what they are, I do not know which
      files they are in, and I do not know whether they still exist. TREAT "FOUR" AS UNCHECKED —
      it is a remembered figure with no command behind it, which by section 26 makes it not a
      measured field at all. If you measure five, or two, or zero, YOUR NUMBER WINS. Do not
      reconcile toward four and do not treat four as a target.

  WHAT YOU DO:
    1. Run go vet over the tree at your branch head. Paste the raw output, in full, however long.
    2. Report the count you actually got, WITH THE COMMAND THAT PRODUCED IT, and beside it the
       POPULATION it ran over — how many packages vet actually loaded and analysed.
    3. Say explicitly whether it ran from a clean checkout or from a tree with an untracked
       web/dist present. This matters and it is the whole reason nobody has a clean number: a
       clean checkout of this repo does not build, and go vet fails with it. IF VET CANNOT RUN
       CLEAN, THAT IS THE RESULT — report the failure, in full, and do not substitute a run from
       a dirty tree and present it as the clean number. A blocked measurement reported as blocked
       is worth more to me than a substituted one reported as clean.
    4. Fix ONLY vet findings that are in code this round already touches. Everything else you
       file in your report and LEAVE ALONE. Do not open a vet cleanup inside a fix round.

  If vet turns out to be clean, say so AND say what it ran over. A zero with no population beside
  it is not a result this project accepts any more.

---------------------------------------------------------------------------------------------------
## 5. *** OUT OF SCOPE — AND ONE OF THEM IS STRUCK, WHICH IS NOT THE SAME THING ***

### 5.1 STRUCK, NOT OMITTED: test-xss-r8's section 15.8 REMEDY VEHICLE

  *** THE VEHICLE PROPOSED IN test-xss-r8 SECTION 15.8 IS STRUCK. DO NOT USE IT. ***

  I am naming it as struck rather than leaving it out, deliberately, because a fix leg reading the
  r8 test report will otherwise reach for it — it is the most specific, most actionable-looking
  remedy in that document, and it is wrong.

  WHY IT IS STRUCK, MEASURED BY ME, IN NO LEG'S REPORT: the 15.8 vehicle TESTS THE WRONG FUNCTION.
  It exercises getCapabilities in web/src/capabilities.ts. getCapabilities ALREADY CONTAINED BOTH
  CONJUNCTS BEFORE r8 — the platform check and the writable check — so it was never the defective
  surface. The defect and the r8 fix both live in isCollectionWritable in ft-app.ts. The 15.8
  vehicle is therefore GREEN ON THE DEFECT IT IS PROPOSED FOR, in both directions, always.

  THE CONDITION ATTACHED TO 15.8 IN THAT REPORT STILL GOVERNS, VERBATIM. The vehicle is struck;
  the condition is not. Satisfy the condition through item A's pin, against isCollectionWritable.

  This is the sharpest instance yet of a class worth carrying into your own work:
  *** WHEN THE SUBJECT OF A TEST IS INACCESSIBLE, THE PROPOSED VEHICLE DRIFTS TO WHATEVER IS
      EXPORTED NEARBY, AND THE SUBSTITUTION IS INVISIBLE PRECISELY BECAUSE THE DIAGNOSIS IS RIGHT.
      IT SURVIVES REVIEW BY ANYONE WHO REVIEWS THE ARGUMENT INSTEAD OF THE CODE. ***
  If you find yourself testing a neighbour of the thing you mean to test, say so out loud.

### 5.2 SIMPLY OUT — do not action, do not scope, do not "while I am here"
  - audit F8
  - audit F4
  - OP-2 in its WIDE FORM  (the narrow form is not in scope either this round)
  - review O-1, O-2, O-3, O-4

  If you believe one of these is genuinely blocking, MESSAGE ME AND STOP. Do not decide it
  yourself and do not fold it in quietly. Scope creep in a fix round is how r6 and r7 became
  unmergeable.

---------------------------------------------------------------------------------------------------
## 6. FIGURES YOU MAY HAVE INHERITED THAT ARE WRONG

  *** 545 IS WITHDRAWN IN ALL THREE OF ITS COORDINATES. Do not carry it forward. ***

  The r8 suite result is 546 PASS LINES over 544 DISTINCT TEST NAMES, rc=0, 1149 RUN lines.
  The gap is two colliding names: TestGetUser and TestListUsers, each declared twice.

  RULING, PROJECT-WIDE, AND IT BINDS ANYTHING YOU ADD THIS ROUND:
  *** NO CI GATE ON THIS PROJECT MAY KEY ON A BARE TEST NAME. ***
  A bare-name gate lets a GREEN on one test MASK a RED on its namesake. If you add a gate, key it
  on package plus name, or on an absolute total, and say which.

  A COUNT OF OUTPUT LINES FROM A COUNTING INSTRUMENT IS NOT A COUNT OF WHAT IT COUNTED. I published
  546 as a test count earlier tonight and it is a line count. Check your own units the same way.

## 7. MERGE GATES — NOT YOUR ACCEPTANCE CRITERIA, BUT KNOW THEM

  - REBASE ONTO cc92735 IS A MERGE-GATE. r8 is 67 ahead / 12 behind and forked at 7a0f220.
    Do the rebase as the LAST step, after your work is committed, so a conflict never contaminates
    the measurement of your own change.
  - r6 and r7 remain DO NOT MERGE.
  - A clean checkout of this repo does NOT build: go build, go test and go vet all fail without an
    untracked web/dist. If a Go gate goes green for you, RECORD WHICH ROOT AND WHICH DIST it ran
    against. Every green build this project has recorded is suspect on exactly this axis.

## 8. HARD PROHIBITIONS — these are not style preferences

  - DO NOT PUSH. Not to any remote, not ever, not "just the branch". I am the only agent who pushes.
  - NO BULK CAPTURE INTO GIT. No git add -A, no git add ., no git add -u, no git commit -a, no
    git stash -u, no glob or directory pathspec.
    *** IF YOU CANNOT NAME EVERY FILE THE COMMAND WILL TOUCH BEFORE YOU RUN IT, DO NOT RUN IT. ***
  - THE DURABILITY FREEZE WAS LIFTED SHORTLY BEFORE YOU WERE DISPATCHED. Builds, tests, commits
    and worktree operations are all permitted. Two things survive the lift and they are permanent
    hygiene, not freeze:
      (a) THE BULK-CAPTURE PROHIBITION IMMEDIATELY ABOVE. Permanent. It survives regardless of
          anything else that changes. The reason is concrete: there is an untracked, unignored
          file elsewhere on this shared filesystem holding a live credential, inside a tree whose
          git object store is shared with the repository that can publish it. ONE BULK ADD IN THE
          WRONG DIRECTORY STAGES A LIVE CREDENTIAL INTO A PUSHABLE REPOSITORY. You are not working
          in that tree, and that is exactly why this reads as abstract to you. It is not.
      (b) NO CREDENTIAL VALUE IS EVER A COMMAND-LINE ARGUMENT. Not in a grep pattern, not in an
          echo, not in a test fixture invocation. Arguments are world-readable on this host.
    Beyond your own tree, still leave other people's trees alone: no prune, gc, repack or reflog
    expiry anywhere, and do not tidy any worktree registration directory however stale it looks.
    Other legs' evidence lives in those.
  - DO NOT MODIFY .gitignore this round.
  - A GitHub PAT is in cleartext in some remote URLs on this host. If you print a remote, redact
    with:  sed -E 's#//[^@]*@#//REDACTED@#g'
    DO NOT scrub it from config files, DO NOT hash it, DO NOT test it. It is live and unrotated and
    only rotation changes the exposure. Scrubbing two of its copies is a receipt, not a fix.
  - BACKTICKS IN A scion message BODY EXECUTE. Write your report to a file with a QUOTED heredoc
    and send it with the file's contents. Never paste a code sample straight into a message.

---------------------------------------------------------------------------------------------------
## 8.5 HOW A NEGATIVE RESULT MUST BE REPORTED — ADDED BEFORE DISPATCH, AND IT BINDS EVERY FIGURE

  Overnight this project established, across six distinct instruments, that its verification kept
  coming back CLEAN because the instruments were broken and not because the code was good. Every
  one of the six failed toward clean. That is not a coincidence and it is not bad luck: a broken
  instrument almost always fails silent, and silence reads as a pass. So:

  1. *** A ZERO IS MEANINGLESS WITHOUT THE POPULATION IT WAS MEASURED OVER. ***
     "No occurrences found" is not a result. "No occurrences found across 214 files matched by
     <command>" is a result. Every zero you report this round carries its denominator.

  2. *** ANY PER-ITEM SKIP MUST STATE THE MAGNITUDE OF WHAT IT SKIPPED, IN THE SAME UNITS AS WHAT
         IT EXAMINED. *** If your scan skipped binaries, say how many and how many bytes. If a
     test matrix omitted rows, say how many rows and out of what. A skip reported without its
     size is indistinguishable from no skip at all, and it is the reader who pays.

  3. A GREEN TEST RUN MUST STATE WHAT IT ACTUALLY COVERED. "make test passes" is not a claim about
     your change unless you also say that your change is inside the set it ran. See section 7 on
     which root and which dist.

  4. IF AN INSTRUMENT YOU RELY ON HAS NEVER BEEN OBSERVED PRODUCING A NON-EMPTY RESULT IN THIS
     TREE, SAY SO. An unexercised instrument returning empty is not evidence. This is the same
     property section 3 demands of your test, applied to your tooling.

  5. Declare the tools you scan with BY NAME AND VERSION, and declare them FROM INSIDE the script
     that does the scanning, not from your interactive shell. I learned this the expensive way
     tonight: on this host `grep` typed interactively is a SHELL FUNCTION resolving to one program,
     and `grep` inside a script file is a DIFFERENT PROGRAM WITH DIFFERENT BEHAVIOUR — same PATH,
     same name, different answers. A tool declaration measured in the wrong shell is a false
     statement made in perfectly good faith.

---------------------------------------------------------------------------------------------------
## 9. DELIVERABLES — NAME THE ARTEFACT, BECAUSE IMPLICIT DELIVERABLES DO NOT GET WRITTEN

  1. Code + tests committed on branch url-scheme-validation-r9, based on 901670e.
  2. A report at:  /scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r9-fix.md
     containing, at minimum:
       - the PASTED RED OUTPUT from section 3. Without this the round is not accepted.
       - the typechecker output for item D.
       - the RAW go vet OUTPUT for item E, in full, with the command shown, the package
         population it analysed, and whether the tree was clean or had an untracked web/dist.
         If vet could not run, the failure output IS the deliverable — paste it.
       - per item: what you changed, and how you know it works.
       - EVERY MEASURED FIGURE PASTED FROM THE OUTPUT OF A COMMAND, WITH THE COMMAND SHOWN.
       - every figure tagged MEASURED / DERIVED / UNCHECKED. If you did not check it, say UNCHECKED;
         "not independently checked" appears zero times in my own 10,362-line record and that is a
         defect in my marking, not evidence that everything was checked.
       - a list of every error you found IN THIS BRIEF. Nineteen consecutive rounds have found
         errors in my briefs, several of them material, and two were suggested fixes of mine that
         were actively wrong. FINDING MY ERRORS IS PART OF THE JOB, NOT A FAVOUR.
  3. A PROJECT LOG ENTRY in .design/project-log/. This is a required step, not an optional one.
  4. Message me when done. Reach me at: farmtable-em-task-state-model-v2

  YOU MUST WRITE THE REPORT AT THE PATH IN (2), WRITE THE PROJECT LOG ENTRY IN (3), AND THEN MARK
  THE TASK COMPLETE.

## 10. IF YOU GET STUCK

  Message me and STOP. Do not proceed on an assumption. If this brief asks for two things that
  cannot both be satisfied, SAY SO AND STOP — I have shipped a jointly-unsatisfiable brief before
  and the leg that refused it was right to.
