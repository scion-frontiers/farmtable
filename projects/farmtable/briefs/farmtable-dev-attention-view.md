# dev-attention-view — close contract §10's "attention view" requirement

## Context

Phase 2 of the task-state-model web UI (= contract §13 **Phase 3**, web UI).
Phase 1 is merged, deployed and LIVE — do not touch it. Go code is out of scope.

Contract §10 lists as a **required** web-phase change:

> attention view for dependents blocked by unsuccessful terminal prerequisites.

We currently ship a card badge (`ft-task-card.ts:215`, "Needs attention") and an
inspector callout (`ft-inspector-relationships.ts:221`). Both tell you a task
needs attention **once you are already looking at it**. There is no way to
*find* the set. The round-3 code review flagged this (M-1) and we agreed the
contract line is not satisfied.

**Why this is not cosmetic polish, and why it is worth doing properly.**
Contract §11 states: *"cancelled and wont_fix do not automatically unblock
dependents."* So dependents of an abandoned prerequisite are **permanently
stranded by design** — nothing will ever unblock them and no automatic process
will surface them. The attention view is the designed remedy for a trap the
contract deliberately creates. Without it those tasks are discoverable only by
chance. Please build it as a real workflow affordance, not a checkbox.

Your workspace is `/workspace/farmtable-attention-view`, branch
`attention-view`, based on `task-state-web-ui-v2` **after the r4 fixes have
landed** (the manager will confirm the exact base commit when dispatching).

**Sequencing note, so you understand the constraint you inherited:** this work
was deliberately held back rather than run in parallel with r4, because both
need `ft-app.ts` and r4's change there (the H-2 write-error delivery fix) is
delicate. r4 is already merged into your base. Do not revert or rework anything
from it — if you believe an r4 change is wrong, report it, do not "fix" it.

---

## The good news: the hard part already exists

`attentionBlockers(task, store)` at `web/src/util/task-state-utils.ts:186` is a
real, exported, already-consumed predicate:

```ts
export function attentionBlockers(task: Task, store: TaskStore): Task[] {
  if (!hasAvailabilityReason(task, AvailabilityReason.BLOCKED_BY_DEPENDENCY)) return [];
  // ...collects BLOCKED_BY blockers whose stage isUnsuccessfulTerminalStage
}
```

**Use it. Do not re-implement it.** This workstream has removed thirteen
self-built test oracles and rejected a fourteenth; a local re-derivation of
"what counts as needing attention" would be the fifteenth, and this one would be
in production code. Ownership restricts writes, never reads — import the real
symbol everywhere, in production and in tests.

Note it short-circuits on `BLOCKED_BY_DEPENDENCY`, so attention tasks are a
strict **subset** of dependency-blocked tasks. That shapes the design below.

---

## Design direction (reason about it, don't just take it)

The filter plumbing is `matchesTaskFilters` in `web/src/components/task-filters.ts:15`,
called from `ft-app.ts:384`, `ft-app.ts:672` and `ft-kanban-view.ts`.

Two things to weigh:

1. **`AvailabilityFilter` is already a union type** —
   `'available' | 'unavailable' | AvailabilityReason` (`task-state-utils.ts:12`).
   Because attention is a refinement of `BLOCKED_BY_DEPENDENCY`, extending that
   union (e.g. adding `'attention'`) fits the existing shape and avoids adding a
   **seventh positional parameter** to `matchesTaskFilters`, which already takes
   six and is at the limit of what is readable.
2. **`attentionBlockers` needs the `store`; `matchesTaskFilters` does not
   currently receive one.** That is the one genuine friction point. Resolve it
   deliberately — thread the store through, or have callers precompute the
   attention set and pass membership. **State your choice and your reasoning in
   the report.** Either is defensible; an unexamined choice is not.

I am not mandating the mechanism. I am mandating that you pick one for a stated
reason and that you do not bolt on a seventh positional boolean without
considering the union.

### Scope of the affordance

Minimum: a filter the user can actually reach in the UI (chip/dropdown,
consistent with the existing hold-reason and availability filters — follow the
established pattern in `ft-filter-chips.ts`, do not invent a new interaction).

Check whether `ft-dashboard-view.ts` has a tile pattern; if it does and it is a
natural fit, a count tile is a strong addition because it makes stranded work
visible **without the user first suspecting it exists** — which is the actual
problem. Use judgement; if it does not fit cleanly, the filter alone satisfies
the contract line. Say what you decided.

### User-visible copy

Any new user-visible string must be added to the vocabulary anchor at
`web/test/vocabulary.contract.test.ts` — that is the **only** place such strings
belong as literals, and binding tests derive from the constant everywhere else.
Round 3 found the anchor's "only place" claim had already been violated twice,
so do not add a third violation.

---

## Acceptance criteria

- A user can find every task blocked by an unsuccessful terminal prerequisite,
  through a normal UI affordance, without knowing in advance that any exist.
- Production and tests both bind to the real `attentionBlockers`. No local
  re-implementation anywhere.
- **Real mutation tests.** Break the filter predicate, paste the ACTUAL failing
  output, restore, confirm green. Then a second mutation: make
  `attentionBlockers` return `[]` unconditionally and show the new tests fail.
  A claim of "verified" without pasted output will be sent back — this is the
  standing bar on this workstream.
- **A test proving the affordance is reachable and correct end-to-end**, not
  just that the predicate works: with a fixture containing one attention task,
  one ordinary dependency-blocked task (blocker still open), and one unrelated
  task, applying the filter shows exactly the first. The middle case is the one
  that matters — it is the near-miss that a sloppy implementation gets wrong.
- No regression to r4's fixes. Re-run the three mutants r4 was required to kill
  (`CMP-02`, `F3-05`, `RANK-09`) and confirm they are still dead.
- Full gate green, run and pasted: `npm test`, `npx tsc --noEmit`,
  `npx tsc -p tsconfig.test.json --noEmit`, `npm run build`,
  `npm audit --audit-level=low`.

  **Note on the `find dist -name '*.map' | wc -l` gate.** Run it and report the
  **truthful** number, whatever it is. On *this* branch it should be **0**:
  your base carries commit `b35f36e` ("stop shipping production sourcemaps"),
  which sets `sourcemap: false`, and I have verified `b35f36e` is an ancestor of
  your base `6d8ea23`. So 0 is the expected and correct result here.

  If you get `1`, do **not** edit `vite.config.ts` to force a 0 — stop and
  report it, because it would mean the sourcemap fix did not survive a merge and
  that is a real finding I need to know about immediately.

  Context so you can interpret this correctly: `sourcemap: true` is still live on
  `origin/main`, and `dist/` is embedded into the Go binary via
  `//go:embed all:web/dist`, so production currently serves a source map. That is
  tracked as GitHub **#196** and resolves when the Phase 2 line reaches main. It
  is **not** your problem — it is only explained here so that a `0` on your
  branch and a known exposure in production do not look contradictory.

## Deliverables — all required

1. Commits on branch `attention-view`.
2. A project log entry at `.design/project-log/attention-view.md` with a
   "Not done, and why" section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-attention-view.md`
   covering: the mechanism you chose and why, the store-threading decision, the
   dashboard-tile decision, both mutations with real output, and anything found
   but not fixed.

**Do not push.** Commit locally; the manager pushes.

If you find that closing this cleanly requires changing shared filter
architecture more than described above, stop and report before doing it — that
is a scope decision I need to make, not you.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
