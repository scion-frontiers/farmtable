# Brief: Ad Hoc Investigation — What Are the Extra Lines in the Tree View?

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-inv-tree-lines -b
  explore/tree-lines origin/main` (standing policy — avoids collision with
  farmtable-em-f43, which is actively modifying `ft-tree-view.ts` in its own worktree right
  now to remove these same lines).
- This is investigation only — just report back, don't fix anything (farmtable-em-f43 is
  already handling the fix in parallel).

## Context
ptone@google.com asked: "can you start an ad hoc investigator to look at the current state
and tell me what those other lines in the tree were?" — referring to non-parent-child lines
currently drawn in the Tree view canvas, which Feature 43 is in the process of removing.

## Task
1. Look at the CURRENT (pre-Feature-43) state of `ft-tree-view.ts` on `main` — read its
   edge/line-drawing logic to identify exactly what relationship type(s) it draws besides
   parent-child.
2. Cross-reference against the data model (`proto/farmtable.proto`,
   `internal/store/schema/`) to name these relationship types precisely (e.g.
   blocked-by/blocking, as introduced in Feature 25's Relationships tab — or something
   else, don't assume, verify).
3. Optionally, load a live/local collection with these relationships and take a quick
   screenshot showing the extra lines in their current (soon to be removed) state, for
   reference/comparison.

## Deliverables
1. A short, direct answer to the coordinator (via message) naming exactly what the extra
   lines represent, with a one-line explanation of why the code drew them.
2. Optionally a reference screenshot if easy to grab, saved under
   `/scion-volumes/scratchpad/projects/farmtable/reports/tree-lines-investigation/` — not
   required if it adds much time, the main deliverable is the explanation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with your findings.
- Do not message ptone@google.com directly.

## Termination
You MUST identify what the extra lines represent and message the coordinator with a clear
answer. Then signal task_completed.
