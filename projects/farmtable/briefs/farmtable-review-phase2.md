# review-phase2 — code review, full Phase 2 web UI line

Read `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-phase2-review-context.md` first. It has the range, the standing bars, the deferred items I want ruled on, and what is out of scope.

Workspace: `/workspace/farmtable-review-phase2`, branch `task-state-web-ui-v2` at `633f8f2`.

## What I want from you specifically

You are the last architectural gate before a 73-file, +14063-line change reaches production. Per-round reviews saw slices. You see the whole thing.

### 1. Whole-line coherence — the thing only you can check

Four rounds of fixes plus a feature landed on this branch, each reviewed in isolation. Look for:

- **Fixes from different rounds that interact badly.** r4's `ft-app.ts` write-error delivery change (H-2) was flagged delicate, and the attention view then added a `@filter-change` binding to `ft-app`. Do they coexist correctly?
- **Concepts implemented more than once.** The attention concept is now worded in five places and the dev anchored only some of them. Are there other duplicated concepts — availability, hold reasons, rank — where round N and round N+2 each grew their own version?
- **Abstractions that were right at round 1 and are wrong at round 4** because of what accreted on them. `matchesTaskFilters` at seven positional parameters is the obvious candidate; say whether it is now past the point where it should ship.

### 2. Contract compliance

Check the Phase 2 line against the contract's web-phase requirements — §9 (`task_ready` becomes availability/work-queue semantics, not `stage=ready`), §10 (the attention view), §11 (`cancelled`/`wont_fix` do not auto-unblock dependents — the attention view is the designed remedy for a trap §11 deliberately creates), §12 (a value removed from the native model must not survive as a selectable native value — check the UI for stale selectable stages). Contract §13 is the phase plan.

State plainly whether any contract line for this phase is unsatisfied. Round 3 found §10 unsatisfied and that is why the attention view exists; I want the same rigour applied to the rest.

### 3. Rule on the four deferred items

The shared context lists them. I want a yes/no with reasoning on each, not a restatement. Item 1 (the unanchored `ft-inspector-relationships.ts` copy, including the `'Blocked by dependency'` twin that can disagree with the constant in the same panel) is the one I most expect to be a blocker — but decide for yourself.

### 4. The attention view on its merits

Read `reports/dev-attention-view.md`, then re-derive. Particularly: is `'attention'` as a value in the `AvailabilityFilter` union genuinely right, or does it conflate "a reason a task is unavailable" with "a refinement of one such reason"? The dev's argument rests on the attention set being a strict subset of the dependency-blocked set. Verify that claim against `attentionBlockers` rather than accepting it.

## Deliverable

A report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-phase2.md` with a clear verdict, severities, `file:line` refs, and an explicit section ruling on the four deferred items.

Do not push. Do not modify production code. You MUST write the report at that exact path and then mark the task complete.
