# Dev Report — Attention View (`attention-view`)

Date: 2026-07-27
Branch: `attention-view` (confirmed with `git branch --show-current` before any
other command)
Base: `6d8ea23 Merge fixes-r4: Phase 2 web UI round-4 fix pass`
Brief: `briefs/farmtable-dev-attention-view.md` + the four scope rulings
Project log: `.design/project-log/attention-view.md`

**Not pushed.** Two commits sit locally on `attention-view`.

| Commit | Scope |
| --- | --- |
| `3fb65f2` | Ruling 1: `WRITE_FAILURE` anchor for the partial-renumber message |
| `f228e72` | Contract §10 attention view |

r4's work was left alone. Nothing in the base was reverted or reworked.

---

## 1. Gate — run, with output

```
$ npm test
 Test Files  22 passed (22)
      Tests  407 passed (407)
```
(plus `4 Node test script(s) passed.` from `test:node`, which runs first)

```
$ npx tsc --noEmit
exit=0
$ npx tsc -p tsconfig.test.json --noEmit
exit=0
```

```
$ npm run build
vite v6.4.3 building for production...
✓ 344 modules transformed.
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-DATgx8W6.css   36.32 kB │ gzip:   6.53 kB
dist/assets/index-C5s18i7R.js   844.38 kB │ gzip: 215.27 kB
✓ built in 2.79s
```

```
$ find dist -name '*.map' | wc -l
0
```

**0, truthfully** — `dist/` was deleted before the build, so this is a count of
freshly produced artefacts, not leftovers. `b35f36e`'s `sourcemap: false` is in
this branch's ancestry as the brief said. `vite.config.ts` was not touched.

```
$ npm audit --audit-level=low
found 0 vulnerabilities
```

Test count 382 → 407. Nothing weakened, skipped or deleted; `git diff` on the
existing test files is additive apart from the two literal→constant bindings
described in §7.

> Environment note: `node_modules` was absent on first run and `npm test` died
> with `Cannot find module '.../typescript/bin/tsc'`. `npm ci` fixed it (133
> packages, 0 vulnerabilities) and the base was then confirmed green at 382
> before any edit.

---

## 2. Mechanism chosen, and why

**`'attention'` is a value in the `AvailabilityFilter` union, not a seventh
filter.**

```ts
export type AvailabilityFilter = 'available' | 'unavailable' | 'attention' | AvailabilityReason;
```

The brief asked me to weigh this against a new parameter. The deciding fact is
containment, and it is a property of the existing predicate rather than a
convenience:

```ts
export function attentionBlockers(task: Task, store: TaskStore): Task[] {
  if (!hasAvailabilityReason(task, AvailabilityReason.BLOCKED_BY_DEPENDENCY)) return [];
  ...
```

The attention set is a **strict subset** of the dependency-blocked set. It is a
refinement of a value the Availability control already offers, so it belongs in
that control — the dropdown lists it one line under `Blocked by dependency`, the
reason it narrows. A separate control would also have implied the two combine,
which is meaningless: attention ∩ any other availability reason is either
attention or empty.

The subset relation is asserted, with both sides computed by production, so it
cannot rot silently if `isUnsuccessfulTerminalStage` is ever widened:

```ts
it('returns a strict subset of the dependency-blocked filter', () => { ... });
```

`ft-toolbar.parseAvailabilityFilter` had to learn the new string; without that it
returns `Number('attention')` → `NaN`, a filter that silently matches nothing.
There is a test for exactly that (`emits the attention refinement as a string,
not as a parsed number`).

---

## 3. Store threading — the decision, and what I rejected

**`matchesTaskFilters()` takes `store: TaskStore` as a required seventh
positional parameter.**

The brief flagged the 7th-positional-parameter smell. I think the smell is real
but misdiagnosed here: the store is not a seventh *filter*, it is the resolution
context one filter value needs. "Blocked by an unsuccessful terminal
prerequisite" is a fact about the task's *blockers*, and only the store turns a
relationship's `targetTaskId` into the blocker's stage. That is stated in the
function's doc comment so the next reader does not have to re-derive it.

Rejected:

1. **Caller-precomputed `Set<string>` of attention ids.** Three call sites
   (`ft-kanban-view.matchesFilters`, `ft-ready-queue-view.getReadyTasks`,
   `ft-app` twice) would each need the loop — three chances to diverge — and the
   set can go stale between `render()` and `isTaskVisibleInCurrentView()`.
2. **Optional `store?: TaskStore`.** A caller that forgot it would silently
   answer "nothing needs attention": a wrong answer indistinguishable from a
   right one, and invisible in exactly the collections where the feature
   matters. Required means the compiler finds every call site — it found all
   four, plus the three fixtures in `src/util/task-state-utils.test.ts`.
3. **Collapse the six filter params into a `TaskFilterChangeDetail`-shaped
   object.** Genuinely cleaner and probably the right long-term shape. It is
   also a change to shared filter architecture, which the brief told me to stop
   and report before making, and unwarranted churn immediately before a deploy.
   **Reported here as a follow-up, not done.**

Transposition risk is nil: every other parameter is `string | number | null`, so
a swapped argument does not typecheck.

---

## 4. Dashboard tile — decided yes

`ft-dashboard-view` already had the precedent: the Available card is a
`role="link"` `.stat-card` that dispatches `view-change`. The attention tile
copies it and adds a `filter-change`. Decisions inside that:

- **Conditional on count > 0**, matching the existing "Unavailable Reasons"
  section which also hides at zero. A permanent `0` would be noise on every
  healthy collection's dashboard. The concept stays discoverable because the
  Availability dropdown lists it unconditionally. When the tile *does* appear it
  appears unprompted — which is the point, since §11 guarantees nothing else
  will ever raise these tasks.
- **Destination is the board, not the Available Queue.** Attention tasks are
  dependency-blocked by definition; the queue would show none of them.
- **Clears every other filter.** The tile advertises a count; a stage or
  assignee filter left active would show fewer tasks than the number just
  clicked.
- **`view-change` before `filter-change`**, so the shell is already on a view
  that renders unavailable tasks when the filter arrives. Test asserts the
  order.
- **Count computed by `attentionBlockers()`**, never re-derived — otherwise the
  tile could disagree with the set the filter then shows. There is a test that
  clicks the tile through a real `ft-app` and asserts the rendered cards equal
  the number the tile displayed.
- Keyboard: Enter and Space, `preventDefault()` on both (Space would otherwise
  scroll the page); `aria-label` = `"Needs attention: 1 — click to list them on
  the board"`; `title` = the §11 explanation, which the two-word label cannot
  carry.

`ft-app` gained one binding — `@filter-change` on `<ft-dashboard-view>` — using
the same handler the toolbar's event already used, so the tile route cannot
drift from the manual route.

---

## 5. Mutation 1 (ATT-01) — break the filter predicate

The mutation is the sloppy implementation the brief predicted: the attention
clause reduced to the plain dependency-blocked test.

```diff
-  if (availabilityFilter === 'attention' && attentionBlockers(task, store).length === 0) {
+  if (availabilityFilter === 'attention' && !hasAvailabilityReason(task, AvailabilityReason.BLOCKED_BY_DEPENDENCY)) {
     return false;
   }
```

Actual output (`npx vitest run`, trimmed to the failures; 5 of 407 failed):

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/attention-view.test.ts > attention filter — matchesTaskFilters > drops the task whose prerequisite is still open, despite the identical availability payload
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ test/attention-view.test.ts:131:30
    129|   it('drops the task whose prerequisite is still open, despite the ide…
    130|     expect(WAITING.availability).toEqual(STRANDED.availability);
    131|     expect(matches(WAITING)).toBe(false);
       |                              ^
    132|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  test/attention-view.test.ts > attention filter — matchesTaskFilters > returns a strict subset of the dependency-blocked filter
AssertionError: expected [ 'stranded', 'waiting' ] to deeply equal [ 'stranded' ]

- Expected
+ Received

  [
    "stranded",
+   "waiting",
  ]

 ❯ test/attention-view.test.ts:151:40

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  test/attention-view.test.ts > attention filter — the board shows exactly the attention set > renders only the stranded task once the attention filter is applied
AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]

- Expected
+ Received

  [
    "Stranded behind a cancelled prerequisite",
+   "Waiting on work still in progress",
  ]

 ❯ test/attention-view.test.ts:184:30

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  test/attention-view.test.ts > attention view — reachable end to end from the toolbar > lists exactly the stranded task after choosing Needs attention in the toolbar
AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]

- Expected
+ Received

  [
    "Stranded behind a cancelled prerequisite",
+   "Waiting on work still in progress",
  ]

 ❯ test/attention-view.test.ts:250:29

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  test/attention-view.test.ts > attention view — the tile lands the user on the set it counted > clicking the tile navigates to the board showing exactly the counted tasks
AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]
 ❯ test/attention-view.test.ts:426:29

 Test Files  1 failed | 21 passed (22)
      Tests  5 failed | 402 passed (407)
```

The named failure is exactly the near-miss case: `"Waiting on work still in
progress"` leaks into every level — predicate, board, toolbar route, tile route.

Restored (`git checkout -- web/src/components/task-filters.ts`) and re-run:

```
 Test Files  22 passed (22)
      Tests  407 passed (407)
```

---

## 6. Mutation 2 (ATT-02) — `attentionBlockers` returns `[]`

```diff
 export function attentionBlockers(task: Task, store: TaskStore): Task[] {
+  return [];
   if (!hasAvailabilityReason(task, AvailabilityReason.BLOCKED_BY_DEPENDENCY)) return [];
```

Actual output — **26 failed across three files**, so the new tests are wired to
the real predicate and the pre-existing badge/inspector tests still are too:

```
 ❯ test/ft-inspector-relationships.test.ts (38 tests | 9 failed) 503ms
   × ft-inspector-relationships — dependency attention callout > warns that a Won't Fix prerequisite is still blocking the task
   × ... (8 more)
 ❯ test/attention-view.test.ts (17 tests | 13 failed) 724ms
   × attention filter — matchesTaskFilters > is built on a fixture the real predicate splits one-from-two
   × attention filter — matchesTaskFilters > keeps the task whose prerequisite was cancelled
   × attention filter — matchesTaskFilters > returns a strict subset of the dependency-blocked filter
   × attention filter — matchesTaskFilters > still honours the other filters alongside the attention filter
   × attention filter — the board shows exactly the attention set > renders only the stranded task once the attention filter is applied
   × attention view — reachable end to end from the toolbar > lists exactly the stranded task after choosing Needs attention in the toolbar
   × ft-dashboard-view — the needs-attention tile > counts the attention set with the real predicate, not the blocked count
   × ft-dashboard-view — the needs-attention tile > exposes the tile to the keyboard and explains itself on hover
   × ft-dashboard-view — the needs-attention tile > dispatches view-change then filter-change when clicked
   × ft-dashboard-view — the needs-attention tile > activates the tile on Enter and suppresses the default
   × ft-dashboard-view — the needs-attention tile > activates the tile on Space and suppresses the default
   × ft-dashboard-view — the needs-attention tile > ignores keys other than Enter and Space
   × attention view — the tile lands the user on the set it counted > clicking the tile navigates to the board showing exactly the counted tasks
 ❯ test/ft-task-card.attention.test.ts (16 tests | 4 failed) 151ms
   × ft-task-card — needs-attention badge > shows "Needs attention" when blocked by a WONT_FIX prerequisite
   × ft-task-card — needs-attention badge > shows "Needs attention" when blocked by a DUPLICATE prerequisite
   × ft-task-card — needs-attention badge > shows "Needs attention" when blocked by a CANCELLED prerequisite
   × ft-task-card — needs-attention badge > shows the badge when any one of several blockers is unsuccessfully terminal

 Test Files  3 failed | 19 passed (22)
      Tests  26 failed | 381 passed (407)
```

First failure in detail:

```
 FAIL  test/attention-view.test.ts > attention filter — matchesTaskFilters > is built on a fixture the real predicate splits one-from-two
AssertionError: expected [] to deeply equal [ 'stranded' ]

- Expected
+ Received

- [
-   "stranded",
- ]
+ []

 ❯ test/attention-view.test.ts:117:40
    115|     const attention = store.allTasks.filter((t) => attentionBlockers(t…
    116|
    117|     expect(attention.map((t) => t.id)).toEqual([STRANDED.id]);
       |                                        ^
    118|     expect(attentionBlockers(WAITING, store)).toEqual([]);
```

Note the tile tests fail here too — including the aria-label and keyboard ones —
because the tile is conditional on the count, so a dead predicate removes it
entirely. That is the intended coupling: no attention set, no tile.

Restored (`git checkout -- web/src/util/task-state-utils.ts`) and re-run:

```
 Test Files  22 passed (22)
      Tests  407 passed (407)
```

### r4's three mutants, re-run and still dead

| Mutant | Mutation applied | Result |
| --- | --- | --- |
| **CMP-02** | `return a.id.localeCompare(b.id)` → `return 0` in `compareAcceptedQueueOrder` | **Dead.** `src/util/rank.test.js` aborts: `Error: the comparator must order a full rank/created_at tie by id, so a band listed in reverse id order is NOT in display order`. Vitest half also red: 3 failures in `queue-ordering.test.ts` (`orders the mixed fixture by priority, rank, created-at, then id`; `renders cards in accepted-queue order, not input order`; `renders available rows in accepted-queue order`). |
| **F3-05** | `composed: true` → `false` in `ft-ready-queue-view.reportRefusal` | **Dead.** `1 failed | 406 passed` — `ft-app — a real refused gesture reaches the user as a toast > lets the refusal escape the shadow boundary to a listener outside the app`. |
| **RANK-09** | tail branch `Number.isSafeInteger(candidate) ? candidate : null` → `candidate` | **Dead.** `src/util/rank.test.js`: `Error: M-3: tail past MAX_SAFE_INTEGER (rank 9007199254742016 must be a positive safe integer): expected true, got false`. |

All three restored via `git checkout`; suite green after each.

---

## 7. Reachability test — the three-task fixture

`test/attention-view.test.ts` is built on one fixture used by every level:

| Task | Availability payload | Blocker stage | In the attention set? |
| --- | --- | --- | --- |
| `STRANDED` | `{available:false, reasons:[BLOCKED_BY_DEPENDENCY]}` | `CANCELLED` | **yes** |
| `WAITING` | *identical* | `WORKING` | no |
| `UNRELATED` | `{available:true, reasons:[]}` | — | no |

The middle case is asserted to be byte-identical in availability
(`expect(WAITING.availability).toEqual(STRANDED.availability)`) so the only thing
distinguishing it is the blocker's stage. There is also a fixture guard — `is
built on a fixture the real predicate splits one-from-two` — so if the fixture
ever stopped exercising the distinction the suite goes red rather than quiet.

The affordance is proven end-to-end twice, both through a real mounted `ft-app`
(gRPC client mocked at the module boundary, as the seam test does):

1. **Toolbar route** — drive the real `<sl-select placeholder="Availability">` to
   `attention` and read the board. Live wires: option rendered → parser returns a
   string not `NaN` → `filter-change` reaches `ft-app` → `ft-app` forwards filter
   *and* store → `matchesTaskFilters` consults the real predicate. Asserts the
   board renders exactly `[STRANDED]` after asserting it rendered all five
   before, so the narrowing is a real narrowing.
2. **Tile route** — mount at `?view=dashboard`, read the count off the tile,
   click it, assert the app switched to the board and the rendered cards equal
   both `[STRANDED]` and the count that was displayed.

Plus the chip (`Availability: Needs attention`) at both unit and app level.

`attentionBlockers()` is used everywhere and re-implemented nowhere: there is no
copy of the "unsuccessful terminal blocker" walk in production or in the tests.
The only test-side derivation is `store.allTasks.filter(t =>
attentionBlockers(t, store).length > 0)`, which calls the real function.

One test-mechanics note that cost time and is worth recording: `ft-app` refers to
`ft-toolbar`, `ft-kanban-column` and `ft-task-card` by tag name only —
`src/index.ts` is what imports them in the real build. Without explicit
registration imports in the test file, those render as inert unknown elements
and every card assertion silently sees zero. Commented in the file.

---

## 8. Found but not fixed

1. **`ft-inspector-relationships.ts` has unanchored user-visible copy** —
   verified:
   ```
   src/.../ft-inspector-relationships.ts:224:          Dependency attention needed
   src/.../ft-inspector-relationships.ts:228:            ? html`An unsuccessful terminal prerequisite is still blocking this task.`
   src/.../ft-inspector-relationships.ts:229:            : html`${blockers.length} unsuccessful terminal prerequisites are still blocking this task.`}
   src/.../ft-inspector-relationships.ts:308:              Blocked by dependency
   test/ft-inspector-relationships.test.ts:32:const ATTENTION_TITLE = 'Dependency attention needed';
   test/ft-inspector-relationships.test.ts:33:const PLAIN_BLOCKED_TITLE = 'Blocked by dependency';
   test/ft-inspector-relationships.test.ts:453:      expect(clean(block)).toContain('An unsuccessful terminal prerequisite is still blocking this task.');
   ```
   Exactly ruling 1's defect class, one component over — and `'Blocked by
   dependency'` at line 308 is a hand-written twin of
   `AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]`, so those two can now
   disagree in the same panel. It is also the *fifth* place the attention concept
   is worded. **Out of my scope, so reported, not fixed.** It is the obvious next
   anchor pass and it is small.
2. **The six-parameter filter signature.** See §3, alternative 3.
3. **Selecting `Needs attention` on the Available Queue shows "All clear!"** —
   attention tasks are unavailable by definition, so the queue correctly lists
   none. Identical to today's behaviour for `unavailable` or `Held`, so not a
   regression, and the tile routes to the board specifically so the affordance
   never lands a user there. Special-casing one availability value in the queue's
   empty state would be a new inconsistency, not a fix. Flagging it in case the
   reviewers want a different call.
4. **Scope judgement I made and want visible:** `ft-task-card.ts` held its own
   inline `'Needs attention'` and `test/ft-task-card.attention.test.ts` held a
   local `ATTENTION_BADGE = 'Needs attention'`. Both now read `ATTENTION.label`.
   Strictly this is a file outside "the attention view feature plus item 1", but
   leaving a duplicate of the exact string I was anchoring would have made the
   anchor's "only place these strings appear as literals" claim false on the day
   it was written. The edit is purely literal → constant with no behaviour
   change. (I briefly added `title=${ATTENTION.explanation}` to that badge and
   reverted it, to keep the edit mechanical.)
5. **No r4 change was found to be wrong.** Nothing to report under that heading.

## 9. Rulings — compliance

| Ruling | Status |
| --- | --- |
| 1. `WRITE_FAILURE` as a sibling constant, `DROP_REFUSAL` not widened, test bound to it | Done, commit `3fb65f2`. Completeness guard added so a second failure message cannot slip in unpinned. |
| 2. Do not change how `ft-app` listens for `write-error` | Untouched. `composed: true` and both tests stand; F3-05 re-verified dead against them. |
| 3. Do not act on the oracle / `rankBand` coupling | Not touched. |
| 4. Scope = the attention view + item 1 | Held, with the single disclosed exception in §8.4. |
| Do not push | Not pushed. Two local commits. |
