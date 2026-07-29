> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Git Worktree Parallelization Experiment (side experiment, not a feature)

## Critical constraints (read first)
- This is a READ-ONLY-ish experiment on repo tooling, not application code
  work. Do not touch/modify anything inside `/workspace/farmtable` itself
  (another agent, `farmtable-f21-dev`, is actively working in that exact
  directory on Feature 21 right now — do not run any command there that
  writes files or changes its checked-out branch).
- Do all your experimentation in a NEW location adjacent to
  `/workspace/farmtable`, e.g. `/workspace/farmtable-worktree-experiment/`
  (do not create it inside `/workspace/farmtable` itself).
- Clean up whatever you create by the end (delete the experimental
  worktree(s)) unless the coordinator asks you to leave one running -
  this is a feasibility test, not a new permanent artifact.

## Context
The coordinator is evaluating whether `git worktree` can let multiple
developer agents work on the same repo (`scion-frontiers/farmtable`,
currently checked out at `/workspace/farmtable`) in parallel — each on
its own branch/feature, without needing separate full clones — as a way
to increase parallelization in the eng-manager/developer feature loop.

## Task
1. From `/workspace/farmtable`, experiment with `git worktree add` to
   create one or more additional worktrees adjacent to it (e.g.
   `/workspace/farmtable-worktree-experiment/wt1` on a new throwaway
   branch off `main`).
2. Verify the new worktree is independently usable: it has its own
   working directory, can check out a different branch than
   `/workspace/farmtable`'s current branch simultaneously, can run
   `git status`/make a trivial commit on its own branch without
   affecting `/workspace/farmtable`'s working tree or index.
3. Check whether the repo's build/dev tooling (per
   `/workspace/farmtable/agents.md` and the `farmtable-dev` skill) needs
   anything worktree-specific to work correctly in the new location (e.g.
   does `npm install`/`go mod` state need to be duplicated per worktree,
   are there absolute-path assumptions anywhere that would break, does
   the web build work from the second worktree).
4. Note any gotchas: disk/setup cost per worktree (e.g. does
   `node_modules` need reinstalling per worktree, or can it be shared?),
   whether two worktrees can run dev servers concurrently without port
   conflicts, and how cleanup works (`git worktree remove`).
5. Give an explicit opinion: is this a good fit for running multiple
   `developer` agents in parallel on different features of this specific
   repo? What would the coordinator need to change in the EM/developer
   brief pattern to use this safely (e.g. brief each developer with its
   own worktree path instead of the shared `/workspace/farmtable`)?

## Deliverables
Write findings to:
`/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
covering: what you tried (commands run), what worked, what didn't, setup
cost/gotchas, and your explicit recommendation (yes/no/conditionally, and
why) on using worktrees for parallel developer agents on this repo.

## Direct contact
- Message the coordinator (`scion message coordinator "..."`) when done,
  or if you hit a blocker.
- Do not message ptone@google.com directly.

## Termination
You MUST produce the report at the path above (with cleanup done per the
constraints section) and then mark the task complete.
