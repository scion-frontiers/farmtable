# Phase 2 Web UI — Attention View (attention-view)

Date: 2026-07-27
Branch: `attention-view`
Base: `6d8ea23 Merge fixes-r4: Phase 2 web UI round-4 fix pass`
Input: `briefs/farmtable-dev-attention-view.md` + manager scope rulings
Full report: `reports/dev-attention-view.md`

TypeScript/Lit only. No Go changes. Phase 1 untouched.

## Commits

| Commit | Scope |
| --- | --- |
| `3fb65f2` | Ruling 1: `WRITE_FAILURE` anchor for the partial-renumber message |
| `f228e72` | Contract §10 attention view: filter, chip, dashboard tile, tests |

## Gate

`npm test` 407 passed (22 vitest files + 4 Node scripts) · `npx tsc --noEmit`
clean · `npx tsc -p tsconfig.test.json --noEmit` clean · `npm run build` ok ·
`find dist -name '*.map' | wc -l` → **0** · `npm audit --audit-level=low` → 0
vulnerabilities.

Test count 382 → 407. Nothing weakened or deleted.

---

## The problem contract §10 names

Contract §11 states that closing a prerequisite as `cancelled`, `duplicate` or
`wont_fix` does **not** automatically unblock its dependents. The dependent
keeps its `BLOCKED_BY_DEPENDENCY` availability reason forever, and no process
will ever clear it. These tasks are stranded by design.

Before this change the UI could tell you a task was stranded — the card badge
and the inspector callout both do, via `attentionBlockers()` — but only once you
were already looking at that task. There was no way to ask "which of my tasks
are in this state?", which is the only question a user actually has. §10 calls
that the attention view.

## Mechanism: a value in `AvailabilityFilter`, not a new filter

`'attention'` was added to the `AvailabilityFilter` union rather than becoming a
sixth filter with its own control.

The reason is containment, not convenience. `attentionBlockers()` returns `[]`
unless the task carries `AvailabilityReason.BLOCKED_BY_DEPENDENCY`, so the
attention set is a **strict subset** of the dependency-blocked set — a
refinement of an availability reason the control already offers, not a new axis
of selection. The dropdown lists it directly under `Blocked by dependency`, the
reason it narrows. A test asserts the subset relation with both sides computed
by production, so the claim cannot rot.

Adding a separate control would also have implied the two could be combined,
which is meaningless: attention ∩ any other availability reason is either
attention or empty.

## Store threading: a required seventh parameter

`matchesTaskFilters()` now takes `store: TaskStore` as a **required** seventh
positional parameter. It is documented in the function's doc comment as a
resolution context, not a filter: "blocked by an unsuccessful terminal
prerequisite" is a fact about the task's *blockers*, and only the store can turn
a relationship's `targetTaskId` into the blocker's stage.

Rejected alternatives:

1. **Caller-precomputed `Set<string>` of attention ids.** Three call sites
   (`ft-kanban-view`, `ft-ready-queue-view`, `ft-app`) would each need the loop
   — three chances to diverge — and the set can go stale between `render()` and
   `isTaskVisibleInCurrentView()`.
2. **Optional `store?`.** A caller that forgot it would silently answer "nothing
   needs attention". That is a wrong answer indistinguishable from a right one,
   which is the worst shape a default can have. Required means TypeScript finds
   every call site.
3. **Collapse the six filter params into a `TaskFilterChangeDetail`-shaped
   object.** Genuinely cleaner, and the right long-term shape. It is also a
   shared-filter-architecture change, which the brief said to stop and report
   before making, and unwarranted churn immediately before a deploy. Recorded as
   a follow-up rather than done here.

The store cannot be transposed with a filter argument by accident: every other
parameter is `string | number | null` and the compiler rejects a swap.

## Dashboard tile

`ft-dashboard-view` already had the precedent — the Available card is a
`role="link"` `.stat-card` that dispatches `view-change`. The attention tile
follows it exactly, plus a `filter-change`:

- **Rendered only when the count is non-zero**, matching the existing
  "Unavailable Reasons" section. A permanent `0` would be noise on the dashboard
  of every healthy collection. The concept stays discoverable regardless,
  because the Availability dropdown always lists it. When the tile does appear
  it appears unprompted, which is the point: nothing else will ever surface
  these tasks.
- **Navigates to the board, not the Available Queue.** Attention tasks are
  dependency-blocked by definition, so the queue would show none of them.
- **Clears every other filter.** The tile advertises a count; an already-active
  stage or assignee filter would silently show fewer tasks than the number the
  user just clicked.
- `view-change` is dispatched **before** `filter-change`, so the shell has
  already switched to a view that renders unavailable tasks when the filter
  lands.
- Keyboard-activable on Enter and Space, with `preventDefault()` so Space does
  not scroll the page. `aria-label` carries the count and the action;
  `title` carries the §11 explanation, which two words cannot.

## Vocabulary

`ATTENTION` (`label`, `explanation`, `tileAction`) joins the anchor in
`vocabulary.contract.test.ts`, with a completeness guard so new attention copy
cannot be added unpinned. One phrase now reaches the user from four places —
card badge, filter option, active-filter chip, dashboard tile — and they have to
agree: a user who saw "Needs attention" on a card must recognise the control
that lists every other card wearing it.

`explanation` deliberately says the block is *permanent* ("nothing will clear
these on its own"), not merely current. That distinction is the whole feature.

## Ruling 1 — `WRITE_FAILURE`

`'Reordering the queue failed part way through — reload to see the saved
order.'` was built inline in `ft-ready-queue-view` with a hand-copied twin in
`ft-app.write-error-seam.test.ts`. It is now `WRITE_FAILURE.partialRenumber`, a
**sibling** of `DROP_REFUSAL` rather than a member: a refusal is this UI
declining a gesture before anything leaves the browser; a failure is the server
having been asked and something having gone wrong. Round 4 restored
`DROP_REFUSAL`'s precision and absorbing a failure message would have spent that
back immediately. Same completeness guard as `DROP_REFUSAL`.

## Mutation testing

Two new mutants, both killed; verbatim failing output is in the report.

- **ATT-01** — the filter predicate reduced to the plain dependency-blocked
  test (`!hasAvailabilityReason(task, BLOCKED_BY_DEPENDENCY)`), i.e. the exact
  sloppy implementation the near-miss fixture exists to catch. 5 failures, led
  by "drops the task whose prerequisite is still open".
- **ATT-02** — `attentionBlockers()` returns `[]` unconditionally. 26 failures
  across three files: the new attention tests, the pre-existing card-badge
  tests, and the inspector callout tests.

Round 4's three mutants re-run and confirmed still dead: **CMP-02** (killed by
`src/util/rank.test.js` and 3 vitest tests), **F3-05** (killed by the
`document`-listener test in the seam file), **RANK-09** (killed by the M-3
boundary case in `src/util/rank.test.js`).

---

## Not done, and why

1. **`ft-inspector-relationships.ts` holds unanchored user-visible copy** —
   `'Dependency attention needed'`, `'An unsuccessful terminal prerequisite is
   still blocking this task.'`, `'Blocked by dependency'` (a hand-written twin
   of `AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]`), all with literal
   copies in `test/ft-inspector-relationships.test.ts`. Same defect class as
   ruling 1, one component over, and it is the *fifth* place the attention
   concept is worded. Out of the scope I was given ("the attention view feature,
   plus item 1, nothing else"), so it is reported rather than fixed. It is the
   obvious next anchor pass.
2. **The six filter parameters were not collapsed into an options object.**
   Shared-filter architecture; see the store-threading section above.
3. **Selecting `Needs attention` while on the Available Queue yields the "All
   clear!" empty state.** Not a regression and not special-cased: `unavailable`
   and `Held` behave identically today, and the queue's contract is that it
   lists available work. The dashboard tile routes to the board precisely so the
   affordance never lands a user there. Special-casing one availability value in
   the queue's empty state would be a new inconsistency, not a fix.
4. **`ft-app` still binds `@write-error` on each child view element** rather
   than at its own root — manager ruling 2, explicitly out of scope.
5. **The M-1 oracle / `rankBand` coupling** — manager ruling 3, routed to the
   reviewers.

## One scope judgement to flag

`ft-task-card.ts` held its own inline `'Needs attention'` literal, and
`test/ft-task-card.attention.test.ts` held a local `ATTENTION_BADGE` copy of it.
Both now read `ATTENTION.label`. Strictly this touches a component outside "the
attention view feature", but leaving a duplicate of the exact string being
anchored would make the anchor's "only place these strings appear as literals"
claim false on the day it was written — the defect class ruling 1 asked me to
close. The edit is purely literal → constant; no behaviour changed. A `title`
attribute carrying `ATTENTION.explanation` was tried on the badge and reverted
to keep it mechanical.
