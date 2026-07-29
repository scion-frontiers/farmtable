# Independent Code Review — Phase 2 Web UI, Round 3

**Reviewer:** independent code reviewer (no coordination with the parallel security/test passes)
**Branch:** `task-state-web-ui-v2` @ `49e55e9`
**Base:** `git diff origin/main...HEAD` — 69 files, +12,233 / −378
**Contract:** `design-task-state-model-contract.md` §10, §4.6
**Date:** 2026-07-27

---

## Executive Summary

The contract migration itself is done properly: phase is genuinely gone as a
control surface, the stage/hold/availability vocabulary is centralised in one
module, and the rank primitive is honestly sparse. The residual risk is
concentrated in one file — the new `reorder()` write path in
`ft-ready-queue-view.ts` — where I reproduced two defects in code added by this
branch, including one that is the *same class* as F-2 and survived the F-2 fix.

**Verdict: REQUEST CHANGES** (no Critical, two Important, both with working
reproductions). Neither is a security issue and neither blocks the contract
migration conceptually; both are in the reorder path and both are small fixes.
Downgrading them to tracked deferrals with characterisation tests — the same
treatment F-4/F-6/F-7 got — would also be an acceptable resolution for I-2, but
**not** for I-1, which I believe was closed prematurely.

---

## Answers to the four questions asked

### 1. Contract conformance (§10) — does it satisfy, or merely appear to?

Verified item by item against the diff, not the changelog:

| §10 requirement | Status | Evidence |
| --- | --- | --- |
| no native phase control | **Satisfied, structurally** | `UpdateTaskFields` now `Omit<…, 'phase' \| 'availability' \| …>` (`gen/service.ts:20`), so a phase write is a compile error, not a convention. Toolbar `PHASE_OPTIONS` replaced by Group/Stage/Hold/Availability. `grep '\.phase'` over `src/` returns only the two wire decoders. This is the strongest part of the change. |
| no native Ready column | Satisfied | `BOARD_COLUMNS` (`ft-kanban-view.ts:35-45`) has no Ready lane; the queue is a separate view labelled "Available Queue". |
| no native Blocked column as asserted stage | Satisfied | No Blocked lane; blocked-ness is a badge (`ft-task-card.ts:196-215`) and an availability reason. |
| no native Scheduled / On Hold stage group | Satisfied | The whole `ON_HOLD_STAGES` section and its CSS are deleted. |
| active/closed as UX grouping over stage | Satisfied | `TaskGroupFilter = 'active' \| 'closed'` resolved through `isClosedStage`, never through `phase`. |
| queue sorted priority → rank → stable fallback | Satisfied | `compareAcceptedQueueOrder` (`task-state-utils.ts:180`): `priorityRank` → `rank` (`undefined` → `+Infinity`, sorts last) → `createdAt` → `id`. Enum ordering checked: URGENT=1 < HIGH=2 < NORMAL=3 < LOW=4 < unspecified=99. ✅ |
| hold reason display and filters | Satisfied | Display: inspector header badge, `ft-inspector-meta` "Hold" row, card badge. Filter: toolbar `Hold` select + removable chip. |
| unavailable indicators from server-computed availability | **Satisfied with a seam** | All badges read `task.availability` only. But queue *membership* and the dashboard *Available* count read `isReady()`, which has a local heuristic fallback. See O-1. |
| attention view for dependents blocked by unsuccessful terminal prerequisites | **Partially satisfied** — see M-1 | The mechanism exists (`attentionBlockers`, inspector callout, card badge) but there is no way to *find* such tasks. |
| drag/drop reorders within a priority band | Satisfied | Cross-band drops are refused with an explanatory toast naming the destination band — the correct reading of "optional convenience". |
| terminal outcomes as lanes, held/unavailable as modifiers | Satisfied | Three terminal lanes added; they render but refuse drops, with the refusal surfaced on both the tooltip and `aria-description`. |

The one place where it *appears* to satisfy more than it does is the attention
requirement (M-1). Everything else holds up under the diff.

### 2. Rank design vs §4.6 — does it genuinely not depend on dense ranks?

**Yes, genuinely.** I read `rank.ts` looking specifically for a density
assumption and did not find one:

- Nothing derives a *position* from a rank value; ranks are only ever compared
  (`others[i-1].rank! < rank`) or bisected. There is no `rank === index * K`
  reasoning anywhere.
- `renumber()` emits `(i+1) * RANK_STEP` — sparse by construction, and returns
  only *changed* entries, so a partially-correct band is not rewritten wholesale.
- `singleWrite()` requires the untouched items to be **strictly increasing and
  in range**, not contiguous. A band of `[3, 900000, 900001]` is a valid anchor.
- Every degenerate input — unranked, float, NaN, zero, negative, beyond
  `MAX_SAFE_INTEGER` — funnels through `isUsableRank` to `renumber()`, i.e. the
  module fails *into* the invariant rather than out of it. The F-1 fix
  (`isUsableRank` requiring `>= MIN_RANK`, not just `isSafeInteger`) is the right
  shape: it fixed the *guard*, not the arithmetic, so the interior, head and
  tail branches all inherit the floor. Good instinct.
- Head-of-band exhaustion (`1024 → 512 → … → 1`) degrades to `renumber()` after
  ~10 prepends rather than emitting `0`. Correct.
- Pre-existing duplicate ranks in the band are rejected by the strictly-
  increasing check and self-heal via renumber — **except** when the duplicate
  partner is outside the band, which is exactly I-1.

Caveat, not a defect: because *all production data today is unranked*, the
**first** reorder in any band is a full renumber = one sequential RPC per task in
the band. §4.6 permits this ("if the code paths and tests acknowledge write
amplification") and the code does acknowledge it in comments — but see O-3.

### 3. The F-2 fix — is `bandFor()` the right seam?

**The seam is right; the predicate on it is wrong.**

Reading the arithmetic over the full rank scope while resolving the drop target
visually is exactly the correct decomposition, and the docstring at
`ft-ready-queue-view.ts:286-295` states the principle precisely: *"a filter
decides what is drawn, never what the arithmetic is computed over."*

The problem is that `bandFor()` then applies `this.isReady(candidate)`
(line 303), which is itself a decision about what is drawn. F-2 was closed
against view filters only. See I-1 — reproduced.

On the specific sub-questions asked:

- **Collection switching** — the `candidate.collectionId === task.collectionId`
  predicate is correct and `collectionId` is genuinely populated
  (`grpc-client.ts:468`, proto field 14), so it is not a vacuous comparison. The
  store is cleared on switch (`ft-app.ts:973,997`), so it is defensive rather
  than load-bearing. **But** an in-flight `reorder()` survives the switch — see
  L-1.
- **Empty bands** — sound. `dragged` is always in its own band (it was rendered,
  so it passed `isReady`), `band.length === 0` is unreachable, `length === 1`
  short-circuits to `[]` via the clamp.
- **Concurrent store updates** — not sound. See I-2, reproduced.

### 4. Architecture / cross-agent seams

Four agents wrote this in sequence and the joins are visible in four places:
O-1 (two competing definitions of "unavailable"), O-2 (the `write-error` detail
contract is shaped differently by each dispatcher), S-1 (`src/util/` vs
`src/utils/`), S-2 (dead `ColumnDef.phase`). None are blocking; all are cheap.

---

## Critical Issues

**None.** No security regressions in the delta. The XSS-relevant sinks are
clean: `showErrorToast` builds the toast with `document.createTextNode`
(`ft-app.ts:859-871`), `safeExternalUrl` is applied at both untrusted-href call
sites with `rel="noopener noreferrer"`, and the whole diff contains no
`innerHTML` / `unsafeHTML` / `eval` / `new Function`. The dev-only gating of the
localStorage token and the loopback-http carve-out are both inlined so Vite can
constant-fold them, and both are pinned by tests on *both* sides of the flag
(the Node runner sees the production answer, Vitest the dev answer) — that is a
better-than-usual treatment of a build-flag security control.

---

## Important Issues

### I-1 — The F-2 fix is incomplete: `bandFor()` still narrows the band, by availability

`web/src/components/ready-queue/ft-ready-queue-view.ts:296-308`

`bandFor()` was changed to read `store.allTasks` instead of `getReadyTasks()`,
which removes the *view filter* narrowing. It still applies `this.isReady()`
(line 303). A task in the same `(collection, priority)` scope that carries a
rank but is currently unavailable — held, blocked by a dependency, future start
date, or just claimed by someone five seconds ago — is invisible to the midpoint
arithmetic, and the midpoint can land exactly on its rank.

This is the F-2 failure mode verbatim. The finding text for F-2 reads
*"reordering while a filter hides part of a band writes a rank that collides
with the hidden neighbour. Duplicate ranks persist to the server."* Substitute
"a hold" for "a filter" and it is still true.

**Reproduced** (scratch test, removed after the run):

```
store: a(rank 1024), h(rank 2048, availability.available=false, reason HELD),
       c(rank 3072), d(rank 4096)      — all same collection, all NORMAL
rendered rows: [a, c, d]               — h is correctly hidden
gesture: drop d onto c

WRITES  [{"id":"d","fields":{"rank":2048}}]
h.rank  2048        d.rank  2048       ← duplicate rank persisted
```

Why the three F-2 regression tests do not catch it: every hidden-neighbour
fixture uses the `assigned()` helper
(`test/ft-ready-queue-view.rank-adversarial.test.ts:57-64`), which sets
`availability: { available: true }` specifically so the hidden task stays
`isReady`. The suite proves the *filter* narrowing is gone and is silent about
the *availability* narrowing.

Impact is bounded — §4.6 says uniqueness is not required and the comparator has
a deterministic `createdAt`/`id` fallback — but it is real and it does not
self-heal: `singleWrite`'s strictly-increasing guard only inspects members of
the band, so the colliding pair is never seen together and never renumbered.
The user-visible consequence appears in the Accepted kanban lane (now sorted by
`compareAcceptedQueueOrder`, which includes rank and shows unavailable tasks)
and again the moment the held task is released back into the queue: it and the
moved task tie, and the tie resolves on creation time rather than on where the
user dropped anything.

**Suggested fix** — scope the band by the contract's own predicate, not by
drawability:

```ts
private bandFor(task: Task): Task[] {
  const bandPriority = priorityRank(task.priority);
  // Contract §4.6 scopes rank to (collection, priority band) and says nothing
  // about availability. A held or blocked task keeps its rank and re-enters
  // the queue at it, so it must anchor the arithmetic even though it is not
  // drawn. Closed tasks are excluded: they never re-enter the queue, so their
  // ranks are dead weight.
  return this.store.allTasks
    .filter(
      (candidate) =>
        candidate.collectionId === task.collectionId &&
        priorityRank(candidate.priority) === bandPriority &&
        !isClosedStage(candidate.stage),
    )
    .sort(compareAcceptedQueueOrder);
}
```

This also *improves* the drop semantics: `targetIndex` is still resolved by id,
so the moved task still lands adjacent to the row the user aimed at, but now on
the correct side of the invisible neighbour rather than on top of it.

If the team disagrees and wants to keep the availability narrowing, that needs
to be an explicit, documented decision with a characterisation test — because
today the docstring argues against it in the same function.

### I-2 — Overlapping reorders: a failed reorder rolls back a task whose later write succeeded

`web/src/components/ready-queue/ft-ready-queue-view.ts:436-462`

`reorder()` is `async`, unguarded, and captures `originals` before its optimistic
write. Nothing prevents a second drop from starting while the first reorder's
sequential `updateTask` loop is still on the wire — the `drop` event ends the
gesture immediately, the awaits continue in the background. If the write sets
overlap and the first reorder then fails, its rollback loop
(`for (const original of originals) this.store.upsert(original)`) restores
pre-first-drag ranks over tasks the *second* reorder already persisted
successfully.

**Reproduced** (scratch test, removed after the run):

```
store: a, b, c — all unranked (i.e. today's production data)
#1: drop a onto c  -> renumber, 3 writes (c,a,b), first write held on the wire
#2: drop c onto b  -> single write b=512, resolves successfully on the server
#1's first write then fails -> full-band rollback

server b = 512        local b = undefined      ← store now contradicts the server
```

The store ends up believing `b` is unranked (so it sorts to the bottom of the
queue) while the server has it at the head. The toast for #1 does say "reload to
see the saved order", which is the only thing keeping this from being fully
silent — but that message is attached to the *failed* reorder, and the user has
no reason to connect it to the reorder that visibly succeeded.

The window is one network round-trip, and it is widest exactly where it hurts
most: the unranked-band renumber path, where N sequential RPCs are issued for a
single drag.

**Suggested fix** — the cheapest correct option is an in-flight guard reusing
the refusal channel the branch already built:

```ts
/** A reorder currently on the wire. A second drag would interleave its writes
 *  with this one's and, on failure, roll back ranks it never wrote. */
private reorderInFlight = false;

private async reorder(draggedId: string, targetTaskId: string) {
  // …existing guards…
  if (this.reorderInFlight) {
    this.reportRefusal(DROP_REFUSAL.reorderBusy);   // new constant
    return;
  }
  this.reorderInFlight = true;
  try { /* …existing body… */ } finally { this.reorderInFlight = false; }
}
```

The stricter alternative — roll back only tasks whose current rank still equals
the value this reorder optimistically wrote — is more precise but harder to
reason about; the guard is the one I would ship.

---

## Observations

### M-1 — Contract §10 "attention view": the mechanism exists, the *view* does not

`web/src/components/inspector/ft-inspector-relationships.ts:218-259`,
`web/src/components/kanban/ft-task-card.ts:194-196`

§10 requires an *attention view for dependents blocked by unsuccessful terminal
prerequisites*. What ships is a "Needs attention" tag on the card and a callout
in the inspector — both of which require you to have already found the task.
There is no filter, no dashboard tile, and no list that answers "which tasks
need attention?".

The nearest thing is the `Blocked by dependency` availability filter, which is
strictly broader — it also matches tasks blocked by perfectly healthy incomplete
prerequisites, which is the normal case and will drown the signal.

`attentionBlockers()` is already a pure, store-driven predicate, so the cheapest
close is one more entry in `AVAILABILITY_OPTIONS` (e.g. `'attention'`) handled in
`matchesTaskFilters`, plus a count on the dashboard next to "Unavailable
Reasons". I would not block the merge on this, but I would not record §10 as
fully satisfied either.

### O-1 — Two definitions of "unavailable" now coexist

- `isReady()` (`src/utils/task-ready.ts:11-33`): server availability if present,
  otherwise a local heuristic. Gates queue membership and the dashboard
  **Available** count.
- `task.availability?.available === false`: gates the card lock icon
  (`ft-task-card.ts:450`), the inspector badges, the dashboard **Unavailable**
  count (`ft-dashboard-view.ts:146`) and the reason tally.

On a snapshot without `availability` (older server, imported data, the mock
client) these disagree: the queue and the Available tile use the heuristic while
every badge and the Unavailable tile silently report zero. Both behaviours are
individually defensible and each is documented in its own file; nothing
documents the *pair*. Suggest a single exported `isUnavailable(task)` alongside
`isReady()` so the fallback policy is stated once.

### O-2 — The `write-error` detail contract is shaped differently by each dispatcher

`ft-app.ts:873-882`; `ft-ready-queue-view.ts:373, 463`; `ft-kanban-view.ts:139, 192, 219`; `ft-tree-view.ts:713`

Four dispatchers, four shapes: `{message, reason}`, `{error, reason}`,
`{error, reason, message?}`, `{error}`. `ft-app.onWriteError` short-circuits on
`message`, so:

- `reason` is never read by anything in production — it exists only for tests.
- The multi-write rank failure at `ft-ready-queue-view.ts:466-472` sets *both*
  `error` and `message`, so `showWriteError` never runs and **the server's actual
  rejection reason is discarded** — precisely on the more complex path. A
  single-write failure shows the real reason; a renumber failure shows only
  "reload to see the saved order". That asymmetry is invisible from either file
  alone.

Suggest an exported `interface WriteErrorDetail { error?: unknown; message?: string; reason?: string }`
in `util/`, with `onWriteError` rendering the message *and* the mapped error when
both are present.

### O-3 — First reorder in any band is N sequential RPCs with all-or-nothing rollback

`ft-ready-queue-view.ts:445-473`

Because production data is entirely unranked today, the very first drag in a
band takes the `renumber()` path and issues one `updateTask` per task in the
band, sequentially, awaiting each. For a band of ~200 available NORMAL-priority
tasks that is 200 serialised round trips for one gesture, with no busy state, no
cancellation, no concurrency cap, and a policy of rolling the entire band back
if any single one fails. §4.6 explicitly permits the write amplification and the
comments acknowledge it, so this is not a contract violation — but the failure
probability of the operation scales with N while the rollback is all-or-nothing,
which is the wrong combination. Suggest at minimum a disabled/busy state on the
list while a renumber is in flight (which would also subsume I-2), and consider
chunked concurrency.

### O-4 — Silent no-ops remain on two live paths, against the branch's own principle

`ft-ready-queue-view.ts:387` (`if (!dragged || !target) return;`) and `:419`
(`if (targetIndex === -1) return;`).

Both are reachable: a watch event arriving between render and drop can delete
the target or flip it to unavailable, at which point `bandFor()` no longer
contains it and the drag dies with no feedback. Every other refusal in this file
goes through `reportRefusal`; these two do not. A generic
`DROP_REFUSAL.targetChanged` would close the gap consistently.

### O-5 — Dashboard: four stat cards, two of which are overlapping subsets

`ft-dashboard-view.ts:137-157`

"Tasks by State" renders Active / Closed / Held / Unavailable as four visually
identical cards. Active + Closed = total; Held and Unavailable are overlapping
subsets of those. A user reading four equal-weight tiles will reasonably read
them as a partition. Consider separating the two subset tiles, or labelling
them.

Also: `render()` now makes four full passes over `allTasks`
(`computeStateStats`, `computePriorityStats`, `computeAvailabilityReasons`,
`computeAvailableCount` — the last calling `isReady`, which walks relationships
and does store lookups per task), with no memoisation, on every store event.
Minor, but it is a regression from two passes and the dashboard re-renders on
every watch event.

### O-6 — `Rank 1024` rendered on every queue row

`ft-ready-queue-view.ts:563`

Raw internal ordering state on the primary user surface. Is this intended
production UI or a leftover debugging affordance? If intended, it should
probably be a tooltip or a dev-only display; if not, it should go.

### O-7 — On the deferred findings (F-4 / F-6 / F-7)

Asked whether any was misjudged as deferrable. My reading:

- **F-7** (BOARD_COLUMNS duplicating `STAGE_LABEL` / `phaseForStage`) — deferral
  correct. Covered by a binding test; a refactor under a no-refactor round would
  have been the wrong call. Note that `ColumnDef.phase` is now read by nothing
  in production at all (see S-2), so the fix is probably "delete the field",
  not "derive it".
- **F-4** (dead `neutral` branch on the queue availability badge) — deferral
  correct as a *defect*, but the live consequence is that every single queue row
  renders a green "Available" badge conveying no information, since the queue
  only shows available tasks. That is a one-line deletion, not a fix.
- **F-6** (`isReady` returns server availability before checking stage) —
  deferral defensible, with one escalation the finding text does not mention:
  because queue membership also gates *drag reorder*, a server that ever marks a
  COMPLETED or TRIAGE task available lets the UI write a `rank` to it **and** lets
  it anchor other tasks' midpoint arithmetic via `bandFor()`. Still a
  server-trust question rather than a client bug, so I would keep it deferred —
  but if I-1 is fixed by switching `bandFor` to `!isClosedStage`, F-6's blast
  radius shrinks to queue membership alone, which is a nice side effect worth
  noting on the issue.

I did **not** find a case for reopening any of the three.

### S-1 — `src/util/` and `src/utils/` are both live

All three new modules land in `src/util/`; `isReady()` — arguably the single
most important predicate in the task-state model — remains alone in
`src/utils/task-ready.ts` and now imports *upward* into
`src/util/task-state-utils.ts`. Two directories one character apart, holding
halves of the same concept, is a trap for the next agent. Move `task-ready.ts`
into `util/` (or fold it into `task-state-utils.ts`) as a follow-up.

### S-2 — `ColumnDef.phase` is dead

`ft-kanban-view.ts:25, 35-45`. The field survived the removal of the on-hold
grouping and is now written by ten literals and read by nothing in `src/`. Its
new doc comment ("Display grouping for the lane only") describes a grouping that
no longer exists.

### S-3 — `aria-description` support

`ft-kanban-column.ts:376`. `aria-description` is ARIA 1.3 and support is still
uneven (notably Firefox). Given that the whole point of the M-1a fix was that
the two channels must not disagree, `aria-describedby` pointing at a visually
hidden node would be the more durable pairing with `title`. Low priority.

---

## Positive Feedback

- **The phase removal is structural, not conventional.** Excluding `phase` and
  `availability` from `UpdateTaskFields` (`gen/service.ts:20`) turns a contract
  violation into a compile error, and the comment explains exactly why
  (`applyTaskUpdateFields` spreads `...rest`). That is the difference between
  "we remembered not to write phase" and "we cannot write phase". Best decision
  in the branch.
- **`rank.ts` genuinely satisfies §4.6's density-independence clause**, and the
  F-1 fix was made in the right place — tightening `isUsableRank` rather than
  patching the interior-midpoint branch — so all three midpoint branches inherit
  the `MIN_RANK` floor instead of two of them and a comment. The module fails
  *into* its invariant on every hostile input I could construct.
- **`safe-url.ts` reasons about WHATWG normalisation properly.** The
  `0x7f000001` / `2130706433` / `127.1` / fullwidth-dot enumeration in the
  docstring is the kind of thing that is usually discovered in an incident
  report, and the userinfo rejection closes a destination-confusion vector most
  reviewers would not have flagged. Pinning both sides of the `DEV` flag by
  routing the same module through two runners is a genuinely clever way to test
  a constant-folded branch.
- **Refusals are systematically non-silent.** Accepting the drop gesture on
  refusing lanes so the `drop` event still fires, then answering with a toast,
  is the correct reading of the HTML5 DnD contract, and the comment at
  `ft-kanban-column.ts:176-183` explains it well enough that the next person
  will not "optimise" it back into a silent no-op. `DROP_REFUSAL` as a single
  exported table binding tooltip and toast to the same strings is the right
  amount of structure. My I-2/O-4 findings are gaps in coverage of this
  principle, not disagreements with it.
- **The `write-error` toast is XSS-safe by construction** (`createTextNode`,
  not `innerHTML`), and `isServerRejection`'s refusal to blame GitHub without
  positive evidence is a small thing that will save real debugging time.
- **The test infrastructure is above the bar for this codebase.** `dragTaskOnto`
  returning `false` when `dragover` did not cancel encodes the browser's actual
  rule into the helper, so the class of bug that produced F-3 cannot silently
  reappear. The `updateTaskResponse` divergence hook is the right answer to
  "echo-back tests prove nothing".

---

## Verification Story

- **Diff reviewed:** yes — full `origin/main...HEAD`, all 69 files. Confirmed
  **zero Go changes**; the only non-`web/` paths are `.design/project-log/*`.
- **Tests reviewed:** yes, as evidence about production behaviour rather than as
  a coverage audit (a test engineer is reviewing in parallel). One material gap
  found and reported: the F-2 regression fixtures are constructed so they cannot
  observe I-1.
- **Reproductions:** I-1 and I-2 were both reproduced with scratch Vitest files
  against the branch as committed. Both files were deleted; `git status` is
  clean.
- **Build / typecheck / lint / audit:** not re-run — the EM verified 362/362,
  `tsc` clean on both configs, build exit 0, zero sourcemaps, `npm audit` clean,
  and independently re-killed the F-1/F-2 mutations. I took that as given per
  the brief.
- **Security checked:** yes. No new sinks; the two URL sinks are validated; the
  toast path is text-node-based; the dev-only token fallback is correctly gated
  and dead-code-eliminated. No credential exposure in the delta.

---

## What Would Change the Verdict

Fix I-1 (one predicate in `bandFor`, plus a regression test whose hidden task is
hidden by *availability* rather than by a filter) and I-2 (an in-flight guard).
Everything else in this report is a follow-up, not a blocker. With those two
closed I would approve without reservation — the contract migration underneath
them is well executed.
