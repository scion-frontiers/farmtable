# Brief: Unrecognised user type must mean NO access. Decided by the user. Build the fix.

## READ THIS FIRST - CONSTRAINTS

1. **NO BUILD TOKEN. DO NOT BUILD, TEST, VET, OR RUN ANYTHING.** The build token is held
   by another leg. The host locked up on 2026-07-28 from concurrent Go builds. You write
   the patch and the test plan; you REQUEST THE TOKEN FROM THE COORDINATOR when the patch
   is complete, and you wait. An unbuilt correct patch is the deliverable. A built one is
   not available to you yet.
2. **REQUIRED READING before you design anything:**
   /scion-volumes/scratchpad/projects/farmtable/em-tooling/_STANDING-RULES-2026-07-29.md
   It is the artefact of record for this fleet's methodology. If anything in it conflicts
   with this brief, THIS BRIEF WINS - tell the coordinator about the conflict.
3. **No git gc, no git prune,** anywhere. Measured blast radius 57 commits / 256 objects.
4. **Do not touch /workspace/farmtable-em-verify195.**
5. **Do not contact the eng-manager and do not contact the user.** Coordinator only.
6. **zsh apparatus, verified here tonight:** `${PIPESTATUS[0]}` is EMPTY in this shell -
   the array is `$pipestatus`, 1-INDEXED. A guard using PIPESTATUS renders `EXIT=` and is
   UNARMED WHILE LOOKING ARMED. And UNQUOTED GLOBS ABORT THE COMMAND - quote every one.
   If you install any exit-code guard, prove it fires by making something fail on purpose
   and reporting the DIGIT. A guard never observed firing is not a control.
   **AMENDED 02:5xZ BY ME, THE AUTHOR - THE TWO LINES ABOVE ARE TRUE AND NOT SUFFICIENT, AND
   I AM LEAVING THEM RATHER THAN QUIETLY REPLACING THEM SO YOU CAN SEE THE GAP.**
   Another leg tonight did exactly what those lines demand: it made things fail on purpose,
   observed 7, 1 and 0, reported the digits - and adopted a guard that still fails open.
   **A GUARD PROVEN TO FIRE WAS PROVEN TO FIRE IN THE ARRANGEMENT USED FOR THE PROOF, AND
   THE PROOF ARRANGEMENT IS ALWAYS THE SIMPLEST ONE: pipeline, capture, print.** Real use is
   never that. Put ANY command between the pipeline and the capture - even an echo - and
   `pipestatus` is reset to THAT command's success, so the read returns 0 rather than
   nothing. It does not go absent; **IT GOES WRONG WHILE LOOKING RIGHT**, and the output
   reads `EXIT=0`.
   **THE OPERATIVE RULE IS A SENTENCE, NOT A FORM: CAPTURE IMMEDIATELY AFTER THE PIPELINE,
   WITH NOTHING IN BETWEEN THAT RUNS. PRINT AFTERWARDS, FREELY.** Pure assignment is safe.
   So: still prove your guard fires, AND prove it in the shape you actually use, not in the
   two-line shape that makes proving easy.

## The decision, already made. You are not being asked to evaluate it.

This is live in production. It was escalated to the product owner and he ruled. Verbatim:

  "yes. A. any unrecognized type is a pretty severe bug. these can be suddenly blocked."

What that means, and these are constraints, not suggestions:
- **Unrecognised user type => NO permissions. Deny.** Not reduced permissions, not default
  permissions, not the permissions of some fallback type. None.
- **"Everywhere."** Option A was explicitly the everywhere option, as against a narrower
  option that validated only where untrusted data enters. He chose everywhere.
- **SUDDEN BLOCKING IS ACCEPTABLE AND INTENDED.** I told him the cost was that live
  accounts with unrecognised types would lose access immediately, possibly including
  operator accounts, and that it would need an account audit first. He waived it: an
  unrecognised type IS ITSELF THE BUG. **So do NOT build a migration ramp, a grace period,
  a grandfather list, or a warn-then-enforce phase.** Do not soften this. If you find
  yourself designing a transition, you have overridden the ruling.
- **BUT IT MUST BE DISCOVERABLE.** He called it a severe bug, and a bug you cannot find is
  worse than one you can. Every rejection must log loudly enough that an operator can
  identify the affected account and the offending value. Silent denial replaces an
  invisible escalation with an invisible outage - that is a lateral move, not a fix.

## What to fix

The condition to be established: **an empty or unrecognised permission set must never be
readable as permission for everything.**

Relayed context, which you MUST verify yourself rather than adopt - it reached me through
two hands and line numbers drift:
- `DefaultScopesForUserType` has a default branch returning nil.
- The scope check treats an empty list as satisfied - reportedly `if len(scopes) == 0 {
  return nil }` around `scopes.go:83-85`.
- A second, independent path reaches wildcard from the same nil, reportedly around
  `cli/token.go:158-161`.
- The user type is a plain string in the schema with no enum constraint.
- Unrecognised types render as AGENT in the UI, which is why this was invisible.

**THE TRAP, AND IT IS THE WHOLE DESIGN PROBLEM.** An empty scope list may mean two
different things in this codebase: "this principal HOLDS no scopes" and "this endpoint
REQUIRES no scopes." Those are opposite in effect and may share one representation. If they
do, you cannot fix this by changing what empty means - you would break every endpoint that
legitimately requires nothing. **Establish which sense each site uses BEFORE you change
any of them, and say so in your report with citations.** If the two senses are conflated in
one type, separating them IS the fix and the nil-default is only its most visible symptom.

Also: fixing only the two known paths is enumerating doors. The user chose the room. Anchor
on the invariant if the code permits it, and if it does not, say why and enumerate with an
explicit argument that the population is bounded.

## Deliverables

1. `/scion-volumes/scratchpad/projects/farmtable/reports/scopedeny-93.md` containing: the
   commit SHA; the two-senses analysis with citations; the fix design; every call site
   changed and why; what you did NOT change and why; and a NOT REACHED section with a
   falsifier for each unmeasured bound.
2. The patch itself, committed on a branch off canonical. Do not merge. Do not push.
3. A TEST PLAN naming the specific tests to add - including, mandatorily, a test that a
   LEGITIMATE caller still succeeds. The failure mode of this fix is over-denial, and a
   suite that only proves illegitimate callers are refused cannot detect it.
4. When 1-3 are done, MESSAGE THE COORDINATOR TO REQUEST THE BUILD TOKEN. Do not build
   before you have it in hand.

## Direct contact

Coordinator, agent name "coordinator", via scion message. Not the eng-manager, not the
user. If the ruling above seems to you to be the wrong fix, SAY SO TO THE COORDINATOR
rather than quietly implementing something else - a disagreement voiced is useful and a
substitution made silently is the failure mode this whole project has been fighting.

## Termination

You MUST produce the report, the committed patch, and the test plan, then request the build
token, then mark the task complete.
