# review-phase2 — combined review, full Phase 2 web UI line

**Reviewer:** review-phase2
**Date:** 2026-07-27
**Range:** `7a0f220..633f8f2` on `task-state-web-ui-v2` (39 commits, 73 files, +14063/−378)
**Workspace:** `/workspace` (dedicated clone)

## Pre-flight verification

All three required checks agree:

```
git branch --show-current            -> task-state-web-ui-v2
git rev-parse --short HEAD           -> 633f8f2
git log --oneline 7a0f220..633f8f2 | wc -l -> 39
git diff --name-only ... | grep -c '\.go$' -> 0
```

`node_modules` was absent; `npm ci` installed 133 packages, 0 vulnerabilities.
Working tree confirmed clean (`git status --porcelain` empty) at the end of the
review — every mutation below was reverted and verified reverted.

---

## Verdict: **REQUEST CHANGES**

Three contained defects, all fixable in well under a day. Nothing here is a
security flaw, a data-loss risk, or a correctness bug in a live path — this is
not a "the architecture is wrong" rejection. The attention view is a genuinely
good piece of work and the rank/reorder line is the strongest code in the
branch. But two mutants survive on clauses the contract requires, and the
vocabulary anchor introduced by this PR makes a claim that this PR itself
falsifies, in the very feature the anchor was written for.

---

## What I verified by execution vs. what I reasoned about

I want this separated up front, because the brief is right that it has been the
difference between real and wrong findings on this workstream.

### Verified by execution (mutation testing, 15 runs)

| ID | Mutation | Result |
|---|---|---|
| `ATT-01` | attention clause → plain dependency-blocked test | **5 dead** — reproduces dev's claim exactly |
| `RV-PARSE` | drop `'attention'` from `parseAvailabilityFilter` | **3 dead** |
| `CONTAINMENT-BREAK` | remove `attentionBlockers` short-circuit guard | **3 dead** |
| `DUP-DROP` | drop `TaskStage.DUPLICATE` from `isUnsuccessfulTerminalStage` | **0 dead — LIVE** |
| `CANCEL-DROP` | narrow predicate to `WONT_FIX` only | **14 dead** |
| `WIDEN-COMPLETED` | widen predicate to include `COMPLETED` | **3 dead** |
| `TILE-ORDER-SWAP` | swap tile's `view-change`/`filter-change` order | **3 dead** |
| `TILE-COUNT-DERIVE` | re-derive tile count from the blocked reason | **4 dead** |
| `APP-UNBIND-FILTER` | remove `@filter-change` on `<ft-dashboard-view>` | **1 dead** |
| `WF-THRESHOLD` | `writes.length > 1` → `> 0` | **0 dead — LIVE** |
| `RANKBAND-AVAIL` | scope `rankBand` by availability instead of stage | **7 dead** |
| `LANE-LABEL-DRIFT` | drift a `BOARD_COLUMNS` label off `STAGE_LABEL` | **1 dead** |

Plus two non-mutation experiments:

- **Deliberate-rename simulation** (§H-1 below): renamed
  `AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]` *and* updated the anchor
  test, exactly as the anchor's docblock instructs. Result: **407/407 green**
  with the UI internally inconsistent.
- **Transposition probe**: compiled a deliberately mis-ordered
  `matchesTaskFilters` call. Result: 2 `TS2345` errors. The dev's claim that
  transposition cannot typecheck is **correct**.

Gate re-run independently: `npm test` → 22 files / **407 tests pass**;
`tsc --noEmit` → 0; `tsc -p tsconfig.test.json --noEmit` → 0.

### Reasoned about, not executed

- Event-path analysis showing the dashboard's `filter-change` cannot be handled
  twice (`ft-dashboard-view` is not inside `ft-toolbar`'s subtree).
- That `writes.length > 1` is *semantically* correct despite being untested.
- §9 / §12 compliance, established by enum inspection + exhaustive grep rather
  than by running the UI.
- Lit's async render making the tile's two-event ordering unobservable to the
  renderer (the ordering still matters, and is tested — see `TILE-ORDER-SWAP`).

---

## Critical

None.

---

## High

### H-1 — `ft-inspector-relationships.ts:224,228,229,308` — the attention concept is worded a fifth time, in the delta, and drift is provably invisible to the suite

This is deferred item 1, and I rule it a **blocker**. Three facts moved me:

**It is in the delta, not pre-existing.** I checked: `git show 7a0f220:...` has no
`renderAttention` and no `Dependency attention needed`. The whole callout —
lines 218–258 and 302–311 — was added by this PR (`fe8e212`, refined `ccd5010`).
The "existing technical debt, out of scope" defence does not apply.

**The drift is already real, not hypothetical.** `:224` renders
`Dependency attention needed`. Every other surface driven by the *same*
`attentionBlockers()` call renders `ATTENTION.label` = `Needs attention` — the
card badge (`ft-task-card.ts:216`), the filter option (`ft-toolbar.ts:66`), the
chip (`ft-filter-chips.ts:165`), the tile (`ft-dashboard-view.ts:366,377`). The
inspector and the card badge for the same task are on screen simultaneously.
`ATTENTION`'s own docblock says the phrase exists because "a user who sees
'Needs attention' on a card has to be able to find the control that lists every
other card wearing it." The inspector breaks exactly that.

`:228–229` is worse than a synonym — it contradicts. `ATTENTION.explanation`
deliberately conveys permanence ("nothing will clear these on its own");
`An unsuccessful terminal prerequisite is still blocking this task` conveys only
that the block is *current*, which is the precise wrong implication the
`explanation` docblock says must be avoided.

**Drift on `:308` is proven test-invisible.** `:308` hardcodes
`Blocked by dependency`, a hand-written twin of
`AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]`. I renamed the constant to
`'Blocked by prerequisite'` and updated `vocabulary.contract.test.ts` — i.e. I
did exactly what the anchor's docblock tells a developer to do at that decision
point. The suite stayed **407/407 green**. The shipped result would be a chip
reading "Blocked by prerequisite" directly above an inspector panel reading
"Blocked by dependency". The test that exists (`ft-inspector-relationships.test.ts:33`
`PLAIN_BLOCKED_TITLE`) is a transcription used as a DOM locator, so it moves
with the component and never notices.

**Suggested fix** (small and contained):

```ts
// src/util/task-state-utils.ts — extend the existing ATTENTION constant
export const ATTENTION = {
  label: 'Needs attention',
  explanation: /* unchanged */,
  tileAction: 'click to list them on the board',
  /** Inspector callout heading. Same concept as `label`; longer form fits the panel. */
  calloutTitle: 'Needs attention',
  calloutBody: (n: number) =>
    n === 1
      ? 'A prerequisite was cancelled, dropped as a duplicate, or will not be fixed. ' +
        'Closing it that way does not unblock this task, so nothing will clear it on its own.'
      : `${n} prerequisites were cancelled, dropped as duplicates, or will not be fixed. ` +
        'Closing them that way does not unblock this task, so nothing will clear it on its own.',
} as const;
```

```ts
// ft-inspector-relationships.ts:224
-          Dependency attention needed
+          ${ATTENTION.calloutTitle}

// :227-229
-          ${blockers.length === 1
-            ? html`An unsuccessful terminal prerequisite is still blocking this task.`
-            : html`${blockers.length} unsuccessful terminal prerequisites are still blocking this task.`}
+          ${ATTENTION.calloutBody(blockers.length)}

// :308
-              Blocked by dependency
+              ${AVAILABILITY_REASON_LABEL[AvailabilityReason.BLOCKED_BY_DEPENDENCY]}
```

The `ATTENTION` completeness guard in `vocabulary.contract.test.ts:Object.keys()`
then forces the two new entries to be pinned, and
`ft-inspector-relationships.test.ts:32-33` should import the constants instead of
transcribing them.

---

## Medium

### M-2 — `task-state-utils.ts:176-178` — the `DUPLICATE` clause is contract-required and completely unpinned (live mutant)

`DUP-DROP` killed **zero** of 407 tests. Contract §11 (quoted in
`.design/project-log/attention-view.md:31`) covers `cancelled`, **`duplicate`**
and `wont_fix`, so this clause is required, not incidental — and it can be
deleted silently.

The cause is a **self-derived test corpus**, which is a close cousin of the
self-built-oracle class this workstream hunts. Two files build their case list
by filtering with the predicate under test:

- `test/ft-task-card.attention.test.ts:55` — `NATIVE_STAGE_OPTIONS.filter(isUnsuccessfulTerminalStage)`
- `test/ft-inspector-relationships.test.ts:30` — same

The comment at `:52-54` claims this means "widen `isUnsuccessfulTerminalStage`
and this loop covers the new stage automatically instead of going quiet." That
half is true — `WIDEN-COMPLETED` killed 3. But the construction is **asymmetric**
and the comment does not say so: *narrowing* the predicate deletes test cases
rather than failing them. The observable tell is that the suite total dropped
407 → 405 under `DUP-DROP` and rose to 409 under `WIDEN-COMPLETED`. The only
guard, `:57-61`, asserts `attentionStages.length > 0` — satisfied by 1 of 3.
`CANCELLED` survives only incidentally, because unrelated fixtures happen to use
it (14 dead).

**Suggested fix** — pin membership explicitly, next to the derived loop:

```ts
it('treats exactly the three contract §11 outcomes as unsuccessful terminal', () => {
  expect(NATIVE_STAGE_OPTIONS.filter(isUnsuccessfulTerminalStage).sort()).toEqual(
    [TaskStage.WONT_FIX, TaskStage.DUPLICATE, TaskStage.CANCELLED].sort(),
  );
});
```

### M-3 — `ft-ready-queue-view.ts:491-493` — the partial-renumber threshold is unpinned (live mutant)

`WF-THRESHOLD` (`writes.length > 1` → `> 0`) killed **zero** tests. This is the
exact distinction commit `3fb65f2` exists to make, and the doc comment at
`:463-479` spends 17 lines justifying it.

The logic is *correct* as written — I traced `ranksForMove`: `singleWrite`
returns one write and `renumber` only emits changed entries, so `> 1` is a sound
proxy for "some writes may already have landed". The gap is purely coverage, but
it is a coverage gap of the producer side of the seam. Both existing tests
(`ft-app.write-error-seam.test.ts:292` and `:314-329`) **construct the detail
object by hand** and dispatch it at `ft-app`. They prove `onWriteError` prefers
`message` over `error`; nothing proves `ft-ready-queue-view` actually attaches
`message` under the right condition and only then. A regression that always
attached it would tell a user "reload to see the saved order" after a
single-write failure where nothing was saved.

**Suggested fix** — drive the real `reorder()` and assert the emitted detail:

```ts
it('omits the partial-renumber message when only one rank was written', async () => {
  // band with usable ranks so ranksForMove takes the singleWrite path
  const detail = await captureWriteError(() => dragRow(view, 'a', onto: 'b'));
  expect(detail.message).toBeUndefined();
  expect(detail.reason).toBe('rank-change-failed');
});
```
plus the mirror case on an unranked band (which forces `renumber`, >1 write).

### M-4 — `test/attention-view.test.ts:144-152` — the "strict subset" test does not test containment

This test is the named justification for the whole `AvailabilityFilter`-union
design decision. It does not do what it says. `CONTAINMENT-BREAK` (deleting the
`hasAvailabilityReason` guard at `task-state-utils.ts:302`) killed 3 tests —
**none of them this one**.

The fixture cannot distinguish. Containment can only break for a task that has a
`BLOCKED_BY` edge to an unsuccessful-terminal blocker while *lacking* the
`BLOCKED_BY_DEPENDENCY` availability reason — a task the server already
resolved, or one that is itself terminal or held. `FIXTURE` has no such member:
`UNRELATED` has no dependency at all, so both sides agree with or without the
guard.

To be clear about what is and is not true: **the containment property does
hold** (the guard is the first statement of `attentionBlockers`, so it is
structural), and it **is** protected — by the card and inspector negative tests.
Only the test that advertises itself as the proof isn't the one doing the work.

**Suggested fix** — add a fixture member that would break containment:

```ts
/** Stranded blocker, but the server does NOT report the dependency reason. */
const RESOLVED = task({
  id: 'resolved',
  availability: { available: true, reasons: [] },
  relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: DEAD_BLOCKER.id }],
});
```

### M-5 — `ft-ready-queue-view.ts:508-516` — "All clear!" is the wrong answer under a filter

This is deferred item 3, and the dev was right to ask rather than special-case.
My ruling: **do not special-case `attention`; do fix the empty state generally**
— follow-up, not a blocker.

Reachability is real: `filtersDisabled` at `ft-toolbar.ts:282` covers `tree`,
`dashboard` and `dependencies` — **not** `ready-queue`. So the Availability
dropdown is live on the Available Queue and "Needs attention" is two clicks from
"All clear!". The dashboard tile routing to the board does not close this path.

The dev's parity argument holds — `Held` and `unavailable` behave identically —
and that is precisely why the fix should not be attention-specific. But note the
board already solves this: `ft-kanban-column.ts:400` renders
`No visible tasks match this filter.` while the queue has only the unconditional
`All clear!` / `No tasks are available to work on right now`. Two views in the
same PR, two behaviours.

**Suggested fix** (one branch, fixes Held/unavailable/attention together):

```ts
if (tasks.length === 0) {
  const filtered = this.groupFilter !== null || this.stageFilter !== null ||
    this.holdReasonFilter !== null || this.availabilityFilter !== null ||
    this.assigneeFilter !== null;
  return filtered
    ? html`<ft-empty-state icon="funnel" heading=${EMPTY.filteredHeading}
             subtitle=${EMPTY.filteredSubtitle}></ft-empty-state>`
    : html`<ft-empty-state icon="check-circle" heading="All clear!" ... >`;
}
```
(new strings anchored in `task-state-utils.ts`, per the vocabulary rule.)

---

## Low / Info

### L-1 — `test/vocabulary.contract.test.ts:23-25` — the anchor's central claim is false as written

> "It is the ONLY place these strings appear as literals, so renaming
> user-visible vocabulary fails here and nowhere else."

Every completeness guard in the file is inward-facing: `Object.keys()` checks
prove nothing is added to the six maps unpinned. Nothing proves the inverse.
Four shadow label maps duplicate anchored vocabulary in production:

| Location | Duplicates | In this delta? | Drift status |
|---|---|---|---|
| `kanban/ft-kanban-view.ts:34-45` `BOARD_COLUMNS.label` | `STAGE_LABEL` | **yes** (3 terminal lanes added) | pinned — see below |
| `ft-command-palette.ts:45-57` `STAGE_NAMES` | `STAGE_LABEL` | no | agrees |
| `tree/ft-tree-node.ts:19-30` `STAGE_LABEL` | `STAGE_LABEL` | no | **already drifted** |
| `kanban/ft-task-card.ts:24-30` `PRIORITY_LABEL` | `util/priority-utils.ts` | no | agrees |

I am not asking for those to be fixed — three of the four are untouched by this
branch. I am asking that the **claim** be corrected, since the claim is in the
delta. Either soften the docblock, or (better) make it true with the grep lint
described in L-3.

### L-2 — `tree/ft-tree-node.ts:19-30` — already-drifted stage vocabulary (out of delta, track separately)

`'Review'`, `'QA'`, `'Deploy'`, `'Done'` vs the anchor's `'In Review'`,
`'In QA'`, `'Deploying'`, `'Completed'` — four of ten disagree today. The stage
dropdown stays visible (disabled) in tree view, so a user reads "Deploying" in
the toolbar and "Deploy" on the node simultaneously.

Strictly out of scope: `git diff --name-only 7a0f220..633f8f2 -- web/src/components/tree/`
is empty. I raise it only because Phase 2 *is* the stage-vocabulary migration
and this is the one surface it missed. **Recommend a follow-up ticket, not a
change to this PR.**

### L-3 — Suggestion: make the anchor claim enforceable

A single grep-based test would retire L-1, L-2 and H-1's whole class:

```ts
it('keeps anchored vocabulary out of component source literals', () => {
  const anchored = [...Object.values(STAGE_LABEL), ...Object.values(AVAILABILITY_REASON_LABEL),
                    ...Object.values(HOLD_REASON_LABEL), ATTENTION.label];
  for (const file of walk('src/components')) {
    if (CANONICAL.has(file)) continue;
    for (const word of anchored) expect(read(file)).not.toContain(`'${word}'`);
  }
});
```

### L-4 — Info: `BOARD_COLUMNS.label` duplication is safe, contrary to first appearance

Worth recording because I initially flagged it and the evidence overturned me.
`BOARD_COLUMNS` duplicates `STAGE_LABEL` and this PR added three entries to it —
but `LANE-LABEL-DRIFT` killed `ft-kanban-view.contract.test.ts:162` ("labels
every lane with its canonical stage label"), which asserts
`column.label === STAGE_LABEL[column.stage]` for every rendered lane. The
duplication cannot drift. **Suggestion only**: deriving the label from
`STAGE_LABEL[col.stage]` would delete the field and the test together, and would
also unify `ft-kanban-column.ts:216` (`terminalLaneHint(this.label)`, sourced
from `BOARD_COLUMNS`) with `ft-kanban-view.ts:169`
(`terminalLaneToast(STAGE_LABEL[stage])`) — the same refusal currently names its
lane from two maps.

---

## Rulings on the four deferred items

**1. `ft-inspector-relationships.ts` unanchored copy — BLOCKER.**
Fix before merge. In-delta (verified against `7a0f220`), already drifted at
`:224`, semantically contradictory at `:228-229`, and drift at `:308` proven
invisible to a green 407-test suite. The fix is ~20 lines and the anchor's
completeness guard then holds it. See H-1.

**2. `matchesTaskFilters` seven positional parameters — RIGHT CALL, ship it.**
I tried to break the dev's reasoning and could not. Transposition genuinely does
not typecheck — I compiled two mis-ordered calls and got `TS2345` both times,
because TypeScript numeric enum members are not cross-assignable even though
both slots are "a number". Required-not-optional is correct for the stated
reason: the compiler located all four production call sites plus three fixtures,
and an omitted store would answer "nothing needs attention" — wrong in exactly
the collections where the feature earns its keep. Collapsing to a
`TaskFilterChangeDetail`-shaped object is the better long-term shape and the
object already exists in the same file (`task-filters.ts:8-14`), so the eventual
refactor is smaller than the dev feared — but it touches every call site and
most filter tests, and immediately before a deploy that is the wrong trade.
**Follow-up ticket, post-deploy.**

**3. "Needs attention" → "All clear!" on the Available Queue — RIGHT CALL not to
special-case; the underlying empty state should still be fixed.**
Second opinion as requested: do not add an attention branch. The queue is
correct that no attention task is available, the parity argument with
`Held`/`unavailable` is sound, and a special case would encode one filter's
semantics into a view that legitimately knows nothing about them. But the
generic defect is real and reachable in two clicks (filters are *not* disabled
on `ready-queue` — `ft-toolbar.ts:282`), and the board already has the
filtered-empty message the queue lacks. Fix the empty state generically. See
M-5. **Not a blocker.**

**4. Binding `ft-task-card`'s inline `'Needs attention'` to `ATTENTION.label` —
CORRECT scope exception.**
Purely literal→constant, it is the minimum needed to stop the anchor being false
on the day it was written, and leaving it would have been the worse choice. The
only quibble is that the same reasoning applies with more force to
`ft-inspector-relationships.ts` and was not extended there — which is H-1.

---

## Contract compliance

| § | Requirement | Status | Evidence |
|---|---|---|---|
| **§9** | `task_ready` → availability/work-queue semantics, not `stage=ready` | **SATISFIED** | `utils/task-ready.ts:12-14` treats server `availability.available` as authoritative; the local fallback is explicitly conservative. No `TaskStage.READY` exists in the enum. No user-visible "Ready" survives in `src/` (remaining hits are code comments in `ft-dependency-view.ts` and generated `farmtable.json`). UI reads "Available Queue" / "Available". |
| **§10** | attention view for dependents blocked by unsuccessful terminal prerequisites | **SATISFIED** | Filter value, toolbar option, chip, card badge, inspector callout and dashboard tile all route through the single `attentionBlockers()`. Round 3's finding is closed. Intra-band rank reorder (also §10) present and well-tested. Quality caveats H-1 / M-4 do not make the requirement unmet. |
| **§11** | `cancelled`/`wont_fix` do not auto-unblock dependents; attention view is the remedy | **SATISFIED** | `isUnsuccessfulTerminalStage` covers all three §11 outcomes including `duplicate`; `ATTENTION.explanation` names all three. `isReady`'s fallback (`task-ready.ts:28`) keeps a task blocked unless the blocker is `COMPLETED`, consistent with §11. Caveat M-2: the `duplicate` third of this is untested. |
| **§12** | a removed native value must not survive as a selectable native value | **SATISFIED** | Checked all four stage maps in production — `NATIVE_STAGE_OPTIONS` (10), `BOARD_COLUMNS` (10), `ft-command-palette.STAGE_NAMES` (10 + `UNSPECIFIED`→`''`), `ft-tree-node.STAGE_LABEL` (10). All carry exactly the ten live enum members; the enum's gaps (3, 8–11) are unreferenced anywhere. The toolbar dropdown renders from `NATIVE_STAGE_OPTIONS`. Grep for `Ready`/`Blocked`/`Backlog`/`Scheduled` as selectable vocabulary: clean. |
| **§13** | phase plan | n/a — this is the plan being executed |

**No contract line for this phase is unsatisfied.**

---

## Whole-line coherence

**r4's write-error delivery × the attention view's `@filter-change` — they
coexist correctly.** These touch disjoint paths. `@write-error` is bound on
`ft-ready-queue-view`, `ft-tree-view` and `ft-kanban-view`; `@filter-change` on
`ft-toolbar` and now `ft-dashboard-view`. The dashboard emits no writes. I also
checked the double-handling risk the new binding creates: `ft-dashboard-view`
sits in `.content > .main`, not inside `ft-toolbar`, so a `bubbles+composed`
`filter-change` crosses exactly one listener. `APP-UNBIND-FILTER` confirms the
binding is load-bearing and tested.

The tile's two-event sequence is also safe under r4's changes. `onViewChange`
and `onFilterChange` each recompute the dim overlay synchronously, so the
intermediate call after `view-change` sees stale filters — but `filter-change`
fires immediately after and recomputes with both settled, and Lit's render is
async, so no intermediate state is ever painted. The ordering still matters for
the overlay's final value and `TILE-ORDER-SWAP` pins it.

**Concepts implemented more than once.** The brief asked whether availability,
hold reasons or rank grew competing versions across rounds. They did not — those
three are single-sourced in `task-state-utils.ts` and every consumer imports
them. The duplication is entirely in **labels**, and it is pre-existing rather
than round-on-round accretion (three of the four shadow maps predate `7a0f220`).
The one the PR *added* to, `BOARD_COLUMNS`, is test-pinned (L-4). The genuinely
new duplication is H-1.

**Abstractions that aged badly.** `matchesTaskFilters` at seven parameters is
the obvious candidate and my answer is no — see deferred item 2. The abstraction
that has actually aged is `ft-empty-state`'s usage in the queue (M-5): correct
when the queue had no filters, wrong now that five filter axes can empty it.

---

## What's done well

- **`scripts/run-node-tests.mjs`** — globs rather than hardcoding, *and* fails
  loudly on a source/compiled count mismatch, with the docblock stating the
  intent: "including files that arrive from other branches at merge time." I
  confirmed the mechanism works by reading the count check at `:55-63`. This is
  a real instance of designing for a merge the author could not see, and it is
  what makes #195's test survive the merge for free.
- **`rankBand`'s docblock** (`task-state-utils.ts:228-259`) is the best comment
  in the branch: it enumerates the three reasons a task can be absent from the
  queue and explains why only one of them bears on rank. The r4 fix that scoped
  it by stage rather than availability is correct and heavily pinned —
  `RANKBAND-AVAIL` killed 7.
- **`isUsableRank`** (`rank.ts:32-34`) — catching that `Number.isSafeInteger`
  admits zero and negatives, and that `[-5, 0, 5]` would hand out `-3` below the
  documented floor, is a genuinely sharp piece of adversarial thinking.
- **The dashboard tile refuses to re-derive its own count.** `computeAttentionCount`
  calls the real `attentionBlockers()`, and `TILE-COUNT-DERIVE` proves a
  plausible re-derivation is caught (4 dead) — including an end-to-end test that
  clicks the tile through a real `ft-app` and asserts the rendered cards equal
  the advertised number. That is the right instinct applied in the right place.
- **No fifteenth self-built oracle.** I commissioned an independent sweep of all
  29 test files and helpers; the three candidates it surfaced are all DOM
  locators or component inputs fed through the real formatter, not oracles. The
  suite is now measurably cleaner than the source it tests.
- **The `WRITE_FAILURE` / `DROP_REFUSAL` split** (`task-state-utils.ts:151-163`)
  — declining to widen a constant whose precision is its reason for existing is
  the correct call, and the comment explains it better than I would have.

---

## Verification story

- **Tests reviewed:** yes. Read first, as intent. 407 tests, 22 files. Quality is
  high; the three gaps found (M-2, M-3, M-4) are all "the test that names the
  property isn't the one enforcing it," which is a much better failure mode than
  absent coverage.
- **Build verified:** yes — `tsc --noEmit` and `tsc -p tsconfig.test.json --noEmit`
  both exit 0. I did not re-run `npm run build` / the sourcemap count; the brief
  states #196 was verified on this exact branch and asked me not to re-establish it.
- **Lint/static analysis:** typecheck clean; no separate lint step in `web/`.
- **Security checked:** yes, within scope. Phase 2 changes 0 Go files. No new
  network calls, no new storage, no new `unsafeHTML` sinks. `safe-url.ts` scheme
  validation is hardened and covered by two contract suites. `npm ci` reports 0
  vulnerabilities. The `renderMarkdown` exposure is out of scope per the brief
  (already live on `origin/main`, fixed on `markdown-sanitize`); I found **no
  interaction** between it and this line — the attention view renders no
  user-authored markdown, and the tile's `title`/`aria-label` are built from
  constants plus an integer count.
- **jsdom skew with #195:** noted, not acted on, as instructed. For the record I
  agree with the direction you proposed — moving #195 to `^26` is lower risk than
  moving this branch to `^29` this late.
- **Independence:** every finding re-derived from the code. The dev report was
  read after forming the mutation plan; `ATT-01` was reproduced rather than
  accepted, and the one dev claim I actively tried to falsify (transposition
  safety) turned out to be correct.

---

## Recommended sequencing

**Before merge:** H-1, M-2, M-3. All three are small, additive, and independently
verifiable — H-1 is a constant plus three bindings; M-2 and M-3 are new tests
only. Re-run the two live mutants (`DUP-DROP`, `WF-THRESHOLD`) as the acceptance
check.

**Follow-up tickets:** M-4 (fixture), M-5 (generic filtered empty state), L-1/L-3
(anchor claim + grep lint), L-2 (`ft-tree-node` vocabulary), L-4 (derive
`BOARD_COLUMNS.label`), and the `matchesTaskFilters` object-parameter refactor.
