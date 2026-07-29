# EM BRIEF: CI GREEN

## OPERATING MODE - READ FIRST
The owner has told us we are long-winded and unfocused. Reports are: STATUS /
BLOCKER / NEXT ACTION. No essays, no epistemics, no bulletins, no lesson
corpora. If a report is longer than 20 lines it is too long. Ship fixes.

## YOUR TRACK
You own ONE thing: green CI on main, from a clean clone. Nothing else.
You spawn your own devs and reviewers and run the fix-review cycle yourself.
Do not route work through the coordinator.

## KEY LOCATIONS
- repo: /workspace/farmtable  (canonical working copy; web/dist is BUILT here
  and MUST NOT be deleted)
- gate: .github/workflows/ci.yml, Makefile, scripts/ci-suite-manifest.mjs
- an agent named ci-22-setup did the audit below and is yours to command or
  retire as you see fit. Its findings are read-only analysis; nothing is fixed.

## THE FIX LIST - all confirmed by reading, none fixed
1. main is red. Diagnose, fix or revert. An agent named farmtable-mainred-fix
   was working this; check it first, do not duplicate.
2. A CLEAN CLONE CANNOT BUILD. assets.go line 5 embeds all:web/dist, which is
   not in the repo. In a pristine tree go list, go vet and go build all abort
   at exit 1 with ZERO packages. go test expands to 32 packages and 4 fail at
   setup: farmtable, cmd/farmtable-server, cmd/ft, internal/cli. The other 28
   are fine. internal/server is NOT affected. CI hides this by running the web
   build first. Decide the remedy and implement it.
3. scripts/ci-suite-manifest.mjs line 122, the expression matching vitest is
   unanchored at both ends. Any command merely containing that word is
   classified as a vitest run and takes an arm that marks EVERY test file as
   executed - it manufactures a pass. Parse the leading token of the command,
   do not regex the whole string. MERGE-BLOCKING.
4. Same file line 132 credits a path filter with executing every file whose
   path merely contains the filter substring. Anchor to a path segment or
   suffix. MERGE-BLOCKING.
5. Same file around line 149: there is no floor on the number of test files
   found. If the population is empty both guards are empty, it exits 0 and
   prints OK, despite its own header claiming it is fail-closed. Add a
   committed expected minimum and fail below it. Print the three integers
   enumerated, executed, missing in the failure message.
6. ci.yml line 169: the failure-summary expression requires a SPACE after the
   token. Go emits a TAB. It matched 0 of 31 real failure lines and has printed
   the word none under "failures, if any" on every run this repo has ever done.
   Use tab-anchored expressions and replace the trailing or-echo with an
   explicit count so an empty summary is distinguishable from a broken one.
7. ci.yml line 179: if-no-files-found is warn. If the evidence logs are absent
   the job stays green. Make it error.
8. make lint is buf lint then go vet over the whole project, so it cannot pass
   in any tree without a built frontend, and CI never invokes it. Fix it or
   delete it. Do not leave it broken and unexercised.
9. The workflow asserts web/dist EXISTS, not that it has correct content. A
   stale or stub directory satisfies both the assertion and the Go embed, and
   the gate goes green. Add a content check.
10. CI cannot see its own branches (recorded project defect). Confirm and fix.

## HOW TO FIX
Every one of these guards has never fired in this repository. For each fix,
plant a canary that makes the check go RED, confirm it goes red, remove the
canary, confirm green. A guard that has never fired is not a guard.

## CONSTRAINTS THAT STILL BIND
- Never stage with a directory or glob pathspec anywhere. Name every file.
  git add -A, git add ., git add -u, git commit -a and git stash -u are
  forbidden project-wide. This is a hard rule and it is not negotiable.
- Never print, log, commit or echo a credential value, and never run a bare
  git remote listing.
- Do not delete /workspace/farmtable/web/dist and do not create a built
  frontend in any other tree.
- Do not delete other agents without coordinator sign-off.
- Clone leg trees from the local path, never from the network remote.

## DELIVERABLES
1. Green CI on main, verified by an actual run, from a clean clone.
2. A short file at /scion-volumes/scratchpad/projects/farmtable/status-ci.md,
   under one page, listing each of the ten items as done or not done.

## DIRECT CONTACT
Owner: ptone, discord thread 1532019078519193641. Contact him only if you need
a decision he alone can make. Otherwise report to the coordinator.

You MUST get CI green on main and write status-ci.md, then mark the task
complete.
