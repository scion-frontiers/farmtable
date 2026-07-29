# Phase 2 — intra-band rank drag-reorder

Branch: `rank-reorder` (from `task-state-web-ui-v2` @ `6c4a13f`)
Contract: §4.6 "Priority and rank", §10 "Web UI Implications"
Closes: round-2 review Important Issue #2 (Required item never implemented) and
Issue #3 (the `dragover` fix shipped with zero coverage) *for this view*.

## What shipped

- `web/src/util/rank.ts` — pure rank arithmetic, no DOM, no network, no store.
- `web/src/util/rank.test.ts` — Node-script unit tests (`npm run test:node`).
- `web/src/components/ready-queue/ft-ready-queue-view.ts` — the drag gesture,
  the optimistic write path, and the refusal paths.
- `web/test/ft-ready-queue-view.rank.test.ts` — 16 component tests.
- `web/src/components/ft-app.ts` — binding only, inside the `case 'ready-queue':`
  block: `.client`, `?readOnly`, `.capabilities`, `@write-error`.

Before this change the write half of rank did not exist. `rank` arrived on the
wire, was sorted on, and was displayed, but `gen/grpc-client.ts:253` — the line
that sets `request.rank` — had no caller anywhere in the app.

## The rank algorithm, and why

**Sparse integers with midpoint insertion, `RANK_STEP = 1024`.**

To move a task, take the midpoint of the two ranks it lands between and write
that one task. At the head of the band, claim a step below the current first
rank; at the tail, a step above the current last. Renumber the band to even
`1024, 2048, 3072…` spacing *only* when no midpoint exists.

Why not dense ranks: §4.6 permits them only "if the code paths and tests
acknowledge write amplification on reorder" and states outright that "the design
must not depend on dense ranks". Dense ranks make every reorder an O(n) write
over the band. With sparse ranks the steady-state cost of a drag is exactly one
`updateTask` call, which the tests pin (`writes a single task when the move
lands in an open gap`).

The server takes an absolute integer per task and does no re-ranking
(`internal/server/server.go:600-602`), so computing the ordering is the client's
job. Nothing in Go was touched.

### Renumbering happens in two cases, not one

1. **Gap exhaustion** — no integer strictly between the two neighbours
   (`[…5, 6…]`), or no room left below rank 1 at the head.
2. **The band is not fully ranked** — see below. This is the common case today.

## No-rank-yet data — the primary case, not an edge case

Essentially all production data has `rank === undefined`. The queue comparator
(`compareAcceptedQueueOrder`) sorts unranked tasks *last* within their band, via
`Number.POSITIVE_INFINITY`, then falls back to `created_at` then task id.

That has a consequence worth stating plainly: **a single write cannot express a
move inside a band that is not fully ranked.** If the neighbours carry no ranks,
they sort last by `created_at` no matter what rank the moved task receives, so
the order the user just dropped would not survive a reload. `singleWrite()`
therefore refuses to produce a write unless every *other* task in the band
already has a rank and those ranks are strictly increasing in display order;
otherwise the band is renumbered.

So the first drag on a virgin band writes the whole band (3 tasks in a 3-task
band), and every drag after that writes one task. That is a deliberate trade:
correctness on real data first, minimal writes as the steady state. It is
covered by `renumbers the band when no task has a rank yet`, and the pure tests
cover the partly-ranked variant too.

Non-monotonic or duplicated existing ranks are treated the same way — the stored
ranks do not express the visible order, so a midpoint against them would be
meaningless, and the band is renumbered instead.

## Partial-failure policy for the renumber case

Writes are sequential `await`s. If write *k* fails, writes `0..k-1` are already
persisted server-side.

**Policy: roll the entire band back to its pre-drag ranks locally, then raise
`write-error`.** The user sees the order they started from plus an explicit
failure message. For the multi-write case the message says the reorder failed
part way through and to reload.

The honest cost: for the tasks already written, the local store now disagrees
with the server until the next snapshot or watch event. I chose this over the
alternatives because leaving a half-applied order on screen looks like it saved,
which is the failure mode the coordinator banned; and re-fetching would need a
list entry point this view does not have (`RecordingClient.listTasks()` returns
`[]`, and the real refresh path lives in `ft-app`). The reasoning is recorded in
a comment at the `catch` block, not just here.

## Refusals

All three refusal paths raise `write-error` with `reason:
'rank-change-refused'`, the same channel `ft-kanban-view` uses, which `ft-app`
turns into a toast:

- **cross-band drop** — the optional §10 convenience, not implemented; refused
  explicitly and by name rather than silently ignored.
- **read-only board**.
- **collection without `canDragReorder`** (false for GitHub: "GitHub issues have
  no ordering").

Rows stay `draggable="true"` even when the queue will refuse, because a row that
cannot be picked up gives the user no explanation at all.

## The dragover trap

`dragover` calls `preventDefault()` on **every** row, including rows that will
be refused. A `drop` event only fires when `dragover` cancelled the event, so an
early return on a refusing row means the browser never fires `drop`, the refusal
handler never runs, and the gesture dies looking like a frozen UI. That is the
round-1 bug, in a new view.

Round 2 flagged that the kanban fix shipped untested. This view ships with five
`defaultPrevented` tests (normal row, read-only, no-capability, foreign band,
plus the `draggable` guard). I verified they bite: re-adding
`if (this.readOnly || this.capabilities?.canDragReorder === false) return;` to
`onRowDragOver` turns 2 of them red. Removing the drag feature entirely turns 15
of 16 red.

I also mutation-tested the pure module. "Always renumber" (the design §4.6
forbids) fails `a move into an open gap writes exactly one task`; dropping the
anchor check fails `a fully duplicated band is renumbered wholesale`.

## Verification

```
$ npm run build     → tsc --noEmit clean, ✓ built in 2.94s
$ npm run test:node → 4 Node test script(s) passed  ("rank tests passed")
$ npm test          → Test Files 12 passed (12), Tests 151 passed (151)
```

151 component tests, up from 135. No file outside the ownership list is
modified; `git diff --name-only 6c4a13f` lists exactly four files plus the new
test, and the `ft-app.ts` diff is 4 added lines inside the ready-queue block.

## Not done, and why

- **Cross-band drag** (drop into another priority band changes priority and
  re-ranks). Contract §10 marks it "optional convenience" and the brief put it
  out of scope. It is refused with a toast, not silently ignored.
- **Keyboard reordering.** Reorder is drag-only, so it is unavailable to
  keyboard and screen-reader users. Rows keep their existing `role="option"` /
  Enter-Space selection behaviour, which is untouched. This is a real
  accessibility gap; it was not in scope and I did not invent a shortcut for it.
  Worth a follow-up task.
- **Reordering in any other view.** Only the accepted/available queue
  (`ft-ready-queue-view`) reorders. The kanban board does not.
- **Drop-between-rows precision.** Dropping on a row takes that row's position;
  there is no "insert above vs below the midline of the hovered row" refinement.
  The result is unambiguous and matches what the drop indicator shows, but it
  cannot express "place last" by dropping under the final row — you drop *on*
  the last row instead.
- **`holdReason` write plumbing** (`grpc-client.ts:251`, also unreachable) — the
  manager is handling it separately. Untouched.
- **Reload persistence verified only at the store/client boundary,** by asserting
  the exact `updateTask` payload and reconciling from the response. I did not
  run the web UI against a live server, so "persists across a reload" is proven
  to the wire call, not end-to-end through a real backend round trip.
- **Multi-select drag** (reordering several tasks at once). Not requested.
