> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Crash-Cleanup Harvest Audit

## READ THIS FIRST - CONSTRAINTS

1. **YOU MUST NOT DELETE, STOP, SUSPEND, OR RESUME ANY AGENT.** You produce a
   recommendation table. The coordinator executes. If you run any scion
   subcommand other than "list", "look", or "message", you have exceeded scope.
2. **YOU MUST NOT DELETE OR MODIFY ANY DIRECTORY UNDER /workspace.** Read only.
3. **DO NOT TOUCH /workspace/farmtable-em-verify195** at all. Not even a read
   that could change mtimes. Skip it entirely.
4. **DO NOT RUN git gc, git prune, or any destructive git command anywhere.**
   In the canonical repo /workspace/farmtable these are known-destructive with a
   measured blast radius of 57 commits / 256 objects.
5. **NO BUILDS.** No go build, no make test, no test suite, anywhere, for any
   reason. The host crashed six hours ago from concurrent Go builds. You are not
   exempt. If your analysis seems to need a build, it does not - report that
   instead.
6. **CORRECTED 2026-07-29 00:5xZ - THE ORIGINAL TEXT OF THIS CONSTRAINT WAS
   WRONG, AND IT CONTRADICTED THE BACKGROUND SECTION BELOW.** It read: "the
   label SCION_WORKSPACE_MODE=shared-plain is FALSE, each agent has a private
   clone." That was relayed from a 2-container sample and I escalated it before
   checking the denominator. THE AUDIT THIS BRIEF COMMISSIONED DISPROVED IT: of
   30 agents, 15 mount the shared project root and 15 have private clones, so
   BOTH configurations are live simultaneously.
   The true finding is narrower: the label is UNINFORMATIVE, not false - it
   reads identically whether or not the agent is actually sharing. Do not
   reason from it in either direction. Determine your own mount by reading
   .volumes[].source out of /workspace/.scion/agents/<name>/scion-agent.json.
   Note for whoever reads this next: lines 20 and 37 of the original file
   asserted private clones and shared-volume clones respectively, one screen
   apart, and neither I nor the auditor noticed until the mount table forced it.

## Background

At roughly 18:15 UTC on 2026-07-28 the VM locked up - too many agents running Go
builds and tests in parallel starved the box. The control plane force-stopped
most containers. Seventeen agents now show PHASE=error with "Exited (255) 6
hours ago".

**The central problem you are solving:** that phase field is the crash's
signature, not a work-status report. Every one of those agents shows the same
"error" for the same reason - the container was killed from outside. The roster
therefore CANNOT distinguish an agent that finished its job and was idle when
the crash came, from one that was killed mid-sentence with unharvested output.
Some were certainly complete. Evidence of completion has to come from OUTSIDE
the roster.

A second fact makes this tractable: the git clones live on the shared /workspace
volume, NOT inside the containers. Deleting a container does not destroy its
clone, its commits, or its working tree. What deletion DOES destroy is the
agent's own transcript and reasoning - anything it knew but never wrote down.

## Your task

For each stopped agent, decide: is everything it produced already durable
outside its container?

Roster of stopped agents to assess (all PHASE=error unless noted):
  audit-xss-r3, test-xss-r3, review-xss-r3, dev-xss-r3
  dev-194-r11
  audit-195-r10, test-195-r10, review-195-r10
  test-auth
  c-phase, phase-arch, flash-tree-analyst, prompt-variants-dev, tree-analyst,
  anthropic-vertex-dev, flash-decomposer-v2, gemma-decomposer-v2,
  farmtable-architect-auth, farmtable-scion-feature-request

Also assess, separately and more carefully:
  dev-xss-r4      - PHASE=suspended, not error. Deliberate, not a crash victim.
  dev-195-r10     - PHASE=running but STALLED for ~2 hours.

For each agent, establish:

1. **Its working directory.** Most map to /workspace/farmtable-<something>.
   Name the exact path. If you cannot find one, say so - do not guess.
2. **Uncommitted work.** git status --porcelain in that clone. Any modified or
   untracked file is unharvested content. Report the file list and total line
   count of the diff, not just "dirty".
3. **Unmerged commits.** Commits on its branch not reachable from the canonical
   repo at /workspace/farmtable. Report count and subject lines.
4. **Stashes.** git stash list. Stashes are easy to miss and easy to lose.
5. **Written deliverables.** Did it produce documents under the scratchpad at
   /scion-volumes/scratchpad/projects/farmtable/ (reports, design-project-log,
   learnings, notes, salvage) or .design/project-log in its clone? Give paths
   and byte sizes. A zero-byte or stub file is NOT a deliverable - check content,
   not existence.
6. **Verdict**, one of:
   - SAFE-TO-DELETE - everything durable on the shared volume, nothing pending
   - HARVEST-FIRST - has content that must be preserved before deletion; say
     exactly what and exactly where it should go
   - KEEP - still needed, or holds context that is not reconstructible from
     artifacts; justify

## Two traps specific to this audit

**The vacuous pass.** An empty git status can mean "nothing left to save" or it
can mean you ran it in the wrong directory. Before you report a clone clean,
confirm you were actually in it and that it is the right one - a clean result
from the wrong path looks identical to a clean result from the right one.
Report the path you measured alongside every clean verdict.

**Delivery is not consumption.** An agent may have written an excellent report
that nobody ever read or acted on. That still counts as durable for deletion
purposes - the file survives. But flag any deliverable that looks like it was
never picked up, because deleting the agent removes the last chance to ask it
what it meant.

## Key locations

- Canonical repo (READ ONLY, no gc, no prune): /workspace/farmtable
- Agent clones: /workspace/farmtable-*
- Shared scratchpad: /scion-volumes/scratchpad/projects/farmtable/
- Preserved refs in canonical: git for-each-ref refs/preserve/
- Active work you must not disturb. EXACT PATHS, NOT GLOBS - an earlier version
  of this brief said "farmtable-xss-r4*" and "farmtable-194-r11*", which wrongly
  swept in the two fix-leg trees and contradicted the roster above. Do not
  assess these six, which running agents are writing right now:
      /workspace/farmtable-xss-r4-review
      /workspace/farmtable-xss-r4-test
      /workspace/farmtable-xss-r4-audit
      /workspace/farmtable-194-r11-review
      /workspace/farmtable-194-r11-test
      /workspace/farmtable-194-r11-audit
- DO assess these two. No running agent is attached to either (dev-xss-r4 is
  suspended, dev-194-r11 is dead), and they hold the work currently under
  review, which makes them the most important trees in the audit:
      /workspace/farmtable-xss-r4
      /workspace/farmtable-194-r11
  Both are KEEP regardless of findings - they are the subject of open review
  rounds. For these two the deliverable is the INVENTORY, not the verdict:
  what is in them that is not in canonical.
- POLICY, NOT AN OBSERVATION, stated separately so it does not contaminate your
  measurement: /workspace/farmtable-xss-r4 will show one modified file,
  internal/server/scopes.go, roughly 6 lines. Already adjudicated - pure gofmt
  alignment in a const block, pre-existing, deliberately fenced out of r4 scope
  and deliberately left dirty. Measure and report it independently anyway
  (including your own line count), but do not classify the tree HARVEST-FIRST
  on its account. ANYTHING ELSE dirty in that tree is a genuine finding and
  should be reported loudly.

## Sharding

Twenty agents is too many for one pass. Do them in four batches of five,
writing your findings for each batch to the output file before starting the
next. If you run low on context, the file must already contain completed
batches.

## Deliverables

A single markdown file at
  /scion-volumes/scratchpad/projects/farmtable/reports/crash-cleanup-audit.md
containing, for every agent listed above, a row with: agent name, working
directory, dirty-file count, unmerged-commit count, stash count, deliverable
paths with sizes, and verdict. Follow the table with a section per
HARVEST-FIRST agent detailing what to save and where.

End the file with an explicit count: how many SAFE-TO-DELETE, how many
HARVEST-FIRST, how many KEEP. The three must sum to the number of agents you
assessed, and you must state that number.

## Direct contact

Questions you cannot resolve from the filesystem go to the coordinator, agent
name "coordinator", via scion message. Do not contact the user directly. Do not
contact the eng-manager - it is mid-round on live work.

## Termination

You MUST write the completed audit file at the path above, verify it is
non-empty and contains every agent from the roster, and then mark the task
complete.
