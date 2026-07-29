# BRIEF: ts-diff-r8 - the TypeScript half of the r8 build differential

## 0. WHY YOU EXIST, IN ONE PARAGRAPH

A review leg measured that the r8 round's ONLY executable production change is THREE LINES OF
TYPESCRIPT. Everything else added in the round is comment, doc, or Go test code. The build
differential that was supposed to clear the round ran go build, go vet and go test. GO
TYPECHECKS NO TYPESCRIPT. So the round's entire executable production delta has been read by
humans and compiled by nothing. You are going to compile it.

Worse, and this is my fault, not the round's: I placed a 70-byte stub at web/dist/index.html in
both build clones so the Go embed directive would resolve. That stub is EXACTLY what guarantees
the TypeScript build step never needs to run. My shortcut is the direct cause of the gap you are
closing. You do not need to be delicate about that; it is on the record already.

## 1. THE MEASUREMENT

Two arms, and they are commits, not trees:

    BASE arm : e4e3d13
    HEAD arm : 901670e

On each arm, in a throwaway clone, run all three and record all three:

    npm ci
    npx tsc --noEmit
    npm test

Record for every single run: the arm, the command, the EXIT CODE, and the error/failure count
with the raw output pasted, not summarised. Per section 26 a measured field is pasted from the
output of a command with the command shown.

## 2. HOW TO BUILD THE TREES. THE OBVIOUS WAYS ARE PROHIBITED.

  a. Work OUTSIDE /workspace. Use /tmp, which is per-container and disposable.

  b. Create the clone with GIT CLONE FROM A LOCAL PATH:
         git clone /workspace/farmtable /tmp/tsdiff/<name>
     DO NOT clone from the network remote. The remote URL carries a live credential in
     cleartext and cloning from it writes that credential into a fresh config file. This is a
     standing project rule and it is not negotiable.

  c. DO NOT use cp -a, rsync, tar or mv on a working tree or a .git directory. Filesystem-level
     copies of a tree or object store are PROHIBITED OUTRIGHT, with no exceptions and no gating.

  d. After cloning, verify the new config carries no credential before you do anything else, and
     paste the result:
         git -C <clone> remote -v
         grep -c -E 'github_pat_|ghp_' <clone>/.git/config || true
     Note that grep -c PRINTS 0 AND EXITS 1 when clean, so the `|| true` is required. Never
     write `|| echo 0` - that manufactures a zero when the command fails for any other reason.

  e. DO NOT CREATE web/dist. Not by npm run build, not by a stub, not by mkdir. If something you
     run creates it as a side effect, SAY SO EXPLICITLY AND SAY WHICH COMMAND DID IT. The
     absence of that directory is a live finding in this project and manufacturing it destroys
     the evidence. This is the single most important instruction in this brief.

  f. Announce your trees AT CREATION, not at completion: path, source path, commit, and owner.

## 3. THE RUN SCHEDULE. THE OBVIOUS SCHEDULE IS WRONG.

Do NOT run all of one arm and then all of the other. Do NOT re-run an arm because you did not
like its answer.

    a. FIX THE NUMBER OF RUNS PER ARM IN ADVANCE and state the number before you start.
    b. INTERLEAVE: base, head, base, head. At least three pairs.
    c. RE-RUN BOTH ARMS OR NEITHER. Never just the one that disagreed.
    d. REPORT EVERY INDIVIDUAL RUN. Not a summary, not a modal result.
    e. IF THE ARMS SPLIT ACROSS YOUR FIXED SCHEDULE, THE SPLIT IS THE RESULT. Report it as a
       split. It is NOT grounds for another round, and it is not a failed experiment.

Clause (e) is the one you will want to violate. The reason for all of this: re-running only the
arm that disagreed has the stopping rule "halt when the arms agree", which converges on a pass
and cannot report a real regression distinguishably from noise. A 5-of-6 result reported
honestly is worth more to me than a 6-of-6 I cannot check.

There is a load-sensitive flake on this project - about five tests, roughly 4.5%, and the rate
rises with concurrent builds from other legs which you CANNOT SEE FROM INSIDE YOUR CONTAINER. It
is in internal/server, which is Go, so it should not touch you. If you see instability in the
web suite, that is a NEW observation and I want it named as such rather than attributed to the
known flake.

## 4. WHAT A RESULT MEANS, AND WHAT IT DOES NOT

  A GREEN ON BOTH ARMS does not mean the round is safe. It means the three executable lines
  typecheck and the web suite passes. Say that, in those words, and do not let it be read wider.

  A RED ON THE HEAD ARM ONLY is the finding this task exists to look for.

  A RED ON BOTH ARMS is a PRE-EXISTING defect, not this round's. Say so plainly and do not
  attribute it to the diff.

  IF npm ci CANNOT COMPLETE - no network, lockfile mismatch, anything - THAT IS THE RESULT.
  Report the failure in full, with its exit code and output. Do not substitute a run from a
  differently-provisioned tree and present it as the clean number. A blocked measurement
  reported as blocked is worth more to me than a substituted one reported as clean. You will not
  be judged on getting a green.

## 5. A ZERO IS MEANINGLESS WITHOUT ITS POPULATION

If you report that the web suite passed, state HOW MANY tests ran. If a step skipped anything,
state the MAGNITUDE of what it skipped in the same units as what it examined. If you did not run
something, say "not run", never "clean". Tag every figure MEASURED, DERIVED, or UNCHECKED, and
tag anything you are carrying from this brief as UNCHECKED until you have run it yourself -
INCLUDING the three-executable-lines figure and the two commit SHAs above. If your numbers
disagree with mine, YOUR NUMBER WINS and I want the disagreement called out, not reconciled.

## 6. PROHIBITIONS

  - NO PUSH. Ever, under any circumstance.
  - NO BULK STAGING ANYWHERE. No git add -A, no git add ., no git add -u, no git add with a glob
    or a directory, no git stash -u/-a, no git commit -a, no pathspec broader than one file. If
    you cannot name every file a command will touch before you run it, do not run it. One bulk
    add in the wrong directory stages a live credential into a pushable repository.
  - NO CREDENTIAL VALUE IS EVER A COMMAND-LINE ARGUMENT.
  - DO NOT ENTER, BUILD IN, OR MODIFY ANY TREE UNDER /workspace. Read-only, and only if you must.
    Several review trees under there are deliberately unbuilt and a build inside one destroys
    the property that makes it useful.
  - DO NOT create web/dist. Repeated because it is the one that matters.

## 7. DELIVERABLES - ALL THREE ARE REQUIRED

  1. A report at reports/ts-diff-r8.md containing: your announced trees, the credential
     verification output, your pre-declared run count, EVERY individual run with arm, command,
     exit code and raw output, and a plainly-worded conclusion that states its own population.
  2. A project log entry under .design/project-log/. Do not skip this. Write it even if the
     result is boring.
  3. A message back to me summarising the outcome in a few lines.

If you hit something this brief did not anticipate, or a rule here cannot be satisfied, SAY SO
AND STOP rather than working around it. Nothing in this brief is load-bearing until you have
measured it, including the parts I have stated confidently.

YOU MUST WRITE reports/ts-diff-r8.md AND THE PROJECT LOG ENTRY, AND THEN MARK THE TASK COMPLETE.

## 8. THE SHARED-PATHWAY QUESTION - ASK IT BEFORE YOU RUN, ANSWER IT IN THE REPORT

Interleaving is not mainly a defence against noise. It is a defence against a confound that
SHARES A CAUSAL PATHWAY WITH THE INTERVENTION, and in that case A WIDE SEPARATION BETWEEN THE
ARMS IS NOT EVIDENCE - IT IS EXACTLY WHAT SUCH A CONFOUND PRODUCES. Do not reason "the arms were
10-0, load could never manufacture that." That inference is backwards.

So before you run anything, answer this in writing, in the report:

    IS THERE ANYTHING THAT WOULD MAKE THE HEAD ARM FAIL FOR A REASON OTHER THAN THE DIFF?

Candidates specific to you, none of which I have checked: npm ci reaching the network and
getting a different answer on the two arms; a lockfile that resolves differently at the two
commits; a cache warmed by the first arm and reused by the second; wall-clock or ordering
effects in the web suite. If any of these share a pathway with what you are measuring, say so
and interleave harder rather than trusting a clean separation.

Also answer this one-liner, which I am asking every leg: DID ANY ARM OF YOUR COMPARISON RUN
BEFORE 12:33Z AND ANY OTHER ARM AFTER IT? Build rationing was lifted at 12:33Z and several
agents began building at once. That is the largest load discontinuity of the day and any
sequential comparison straddling it is exposed. For you the answer should be "no, everything ran
after", but state it rather than leaving it inferred.

## 9. A SECOND MEASUREMENT, CHEAP, BECAUSE YOU ARE THE ONLY ONE WHO CAN TAKE IT

You will be holding something nobody else on this project currently has: A GENUINELY CLEAN
CHECKOUT, OUTSIDE /workspace, THAT YOU ARE ALLOWED TO BUILD IN.

An audit leg needed the following verified and correctly refused to do it, because verifying it
would have required either building in its own audit tree or making a filesystem copy of a
working tree, and both are prohibited. It reported the rule conflict instead of working around
it, which was the right call. You are not under either constraint, so please close it.

In the BASE-arm clone, before or after your TypeScript work, run these three and paste the raw
output and exit code of each:

    go build ./...
    go vet ./...
    go test ./...

The claim to be checked - treat it as UNCHECKED, it is a relay, and YOUR NUMBERS WIN:

    go build ./...  is said to exit 1 with: assets.go:5:12: pattern all:web/dist: no matching
                    files found
    go vet ./...    is said to exit 1 with a byte-identical error
    go test ./...   is said to fail setup for exactly 4 packages: farmtable (root),
                    cmd/farmtable-server, cmd/ft, internal/cli

If you measure a different set of packages, a different count, or a different error, SAY SO
LOUDLY. If it all builds fine, that is an even more important result and I want it in the first
line of your report. Report the package list you actually observe, do not tick off mine.

DO NOT FIX IT. Do not create web/dist, do not run npm run build to make it pass, do not add a
stub. I already made that mistake in two other trees and it is the reason this task exists.
