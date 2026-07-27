import { describe, expect, it } from 'vitest';
import '../src/components/ready-queue/ft-ready-queue-view.js';
import { TaskPriority, type Task } from '../src/gen/types.js';
import { ALL_ENABLED } from '../src/capabilities.js';
import { ranksForMove } from '../src/util/rank.js';
import { compareAcceptedQueueOrder } from '../src/util/task-state-utils.js';
import { dragTaskOnto, dropTaskOn, flush, mount, queryAllDeep, settle } from './helpers/dom.js';
import { collectFeedback } from './helpers/feedback.js';
import { RecordingClient, storeWith, task, user } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

/**
 * Adversarial coverage for the rank-reorder feature.
 *
 * The feature's existing tests were written alongside the implementation and
 * cover the shapes the author had in mind. These go after the ones they did
 * not: reordering under an active filter, a queue with no client attached,
 * hostile ranks arriving from the server, and reconciliation from a server
 * response that disagrees with the optimistic write.
 *
 * Where a test documents behaviour that looks wrong, it says so and names the
 * finding rather than quietly asserting the bug as if it were the contract.
 */

async function mountQueue(store: TaskStore, props: Record<string, unknown> = {}) {
  const client = new RecordingClient(store);
  const view = await mount<HTMLElement>('ft-ready-queue-view', {
    store,
    client,
    capabilities: ALL_ENABLED,
    ...props,
  });
  return { view, client };
}

function rowIds(view: Element): string[] {
  return queryAllDeep(view, '.queue-row').map((row) =>
    (row.getAttribute('aria-label') ?? '').replace('Task: ', ''),
  );
}

function rowFor(view: Element, id: string): Element {
  const row = queryAllDeep(view, '.queue-row').find(
    (candidate) => candidate.getAttribute('aria-label') === `Task: ${id}`,
  );
  if (!row) {
    throw new Error(`no queue row rendered for task ${id}; rendered: ${rowIds(view).join(', ')}`);
  }
  return row;
}


/** A collection that is not `TEST_COLLECTION_ID`, for rank-scope tests. */
const OTHER_COLLECTION_ID = '00000000-0000-0000-0000-0000000000c2';

/** A ready, assigned task — the server marks it available despite the assignee. */
function assigned(id: string, rank: number, owner: string): Task {
  return task({
    id,
    name: id,
    rank,
    assignees: [user(owner)],
    availability: { available: true, reasons: [] },
  });
}

/** Every rank currently in the store, keyed by task id, in queue order. */
function ranksInQueueOrder(store: TaskStore, ids: string[]): [string, number | undefined][] {
  return ids
    .map((id) => store.getTask(id)!)
    .sort(compareAcceptedQueueOrder)
    .map((entry) => [entry.id, entry.rank] as [string, number | undefined]);
}

describe('ft-ready-queue-view — a real drag gesture, not a synthesised drop', () => {
  /**
   * `dropTaskOn` fires a bare `drop`, which no browser would deliver unless a
   * `dragover` handler had cancelled first. Every existing reorder test uses
   * it, and `defaultPrevented` is asserted in a separate test — so the rule and
   * the drop are each covered but never in combination. That is the exact shape
   * of the round-1 silent-no-op bug, narrowed rather than closed.
   *
   * `dragTaskOnto` performs the sequence and returns `false` if the gesture was
   * swallowed at `dragover`, so a `return` placed before `preventDefault()`
   * fails here instead of quietly making the feature unreachable.
   */
  it('completes a dragover-then-drop sequence and persists the new rank', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a', rank: 1024 }),
      task({ id: 'b', name: 'b', rank: 2048 }),
      task({ id: 'c', name: 'c', rank: 3072 }),
    );
    const { view, client } = await mountQueue(store);

    const delivered = dragTaskOnto(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(delivered, 'dragover did not cancel, so a real browser would never fire the drop').toBe(true);
    expect(client.updateTaskCalls).toHaveLength(1);
    expect(rowIds(view)).toEqual(['a', 'c', 'b']);
  });

  it('completes a dragover-then-drop sequence on a wholly unranked band', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a' }),
      task({ id: 'b', name: 'b' }),
      task({ id: 'c', name: 'c' }),
    );
    const { view, client } = await mountQueue(store);

    const delivered = dragTaskOnto(rowFor(view, 'a'), 'c');
    await flush();
    await settle(view);

    expect(delivered).toBe(true);
    expect(client.updateTaskCalls.map((call) => call.id)).toEqual(['c', 'a', 'b']);
    expect(rowIds(view)).toEqual(['c', 'a', 'b']);
  });

  it('refuses a cross-band drop through a full gesture, rather than swallowing it at dragover', async () => {
    const store = storeWith(
      task({ id: 'hi', name: 'hi', priority: TaskPriority.HIGH }),
      task({ id: 'lo', name: 'lo', priority: TaskPriority.LOW }),
    );
    const { view, client } = await mountQueue(store);
    const feedback = collectFeedback(view);

    const delivered = dragTaskOnto(rowFor(view, 'lo'), 'hi');
    await flush();

    // Both halves matter: the gesture must reach the handler AND be refused
    // out loud. A view that cancelled dragover but dropped the refusal, or one
    // that refused by never cancelling, each fails exactly one of these.
    expect(delivered, 'the refusal was swallowed at dragover — the user sees a dead drag').toBe(true);
    expect(client.updateTaskCalls).toHaveLength(0);
    expect(feedback.reasons()).toContain('rank-change-refused');
  });
});

describe('ft-ready-queue-view — reconciles from the server response', () => {
  /**
   * H-3. `RecordingClient` echoes the optimistic write back by default, so
   * "the view reconciled" and "the view kept its own value and ignored the
   * response" produce identical stores. Forcing the response to diverge is the
   * only way to tell them apart: a view that dropped `store.upsert(updated)`
   * would still show 1536 here, and 777 only if it really read the response.
   */
  it('adopts a rank the server returns instead of the one it optimistically wrote', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a', rank: 1024 }),
      task({ id: 'b', name: 'b', rank: 2048 }),
      task({ id: 'c', name: 'c', rank: 3072 }),
    );
    const { view, client } = await mountQueue(store);
    client.updateTaskResponse = (echoed) => ({ ...echoed, rank: 777, version: '99' });

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls[0].fields.rank, 'the optimistic write asked for the midpoint').toBe(1536);
    expect(store.getTask('c')?.rank, 'the server response must win').toBe(777);
    expect(store.getTask('c')?.version).toBe('99');
  });

  /**
   * The version bump alone is enough to matter: optimistic concurrency depends
   * on the store holding the version the server last wrote, so a view that
   * skips reconciliation makes the *next* write fail with a stale version.
   */
  it('adopts the server version even when the rank comes back unchanged', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a', rank: 1024 }),
      task({ id: 'b', name: 'b', rank: 2048 }),
    );
    const { view, client } = await mountQueue(store);
    client.updateTaskResponse = (echoed) => ({ ...echoed, version: '42' });

    dropTaskOn(rowFor(view, 'a'), 'b');
    await flush();
    await settle(view);

    expect(store.getTask('b')?.version).toBe('42');
  });

  /**
   * Reconciliation must also hold across a renumber, where the view issues one
   * write per task in sequence. Each response is a separate reconciliation
   * point, so a view that only upserted the last one loses the others.
   */
  it('adopts the server response for every task in a renumber, not just the last', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a' }),
      task({ id: 'b', name: 'b' }),
      task({ id: 'c', name: 'c' }),
    );
    const { view, client } = await mountQueue(store);
    client.updateTaskResponse = (echoed) => ({ ...echoed, version: `srv-${echoed.id}` });

    dropTaskOn(rowFor(view, 'a'), 'c');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls.map((call) => call.id)).toEqual(['c', 'a', 'b']);
    for (const id of ['a', 'b', 'c']) {
      expect(store.getTask(id)?.version, `${id} was not reconciled`).toBe(`srv-${id}`);
    }
  });
});

describe('ft-ready-queue-view — hostile ranks from the server', () => {
  /**
   * `rank` is server data and nothing validates it client-side. `rank.ts`
   * guards with `Number.isSafeInteger`, so a float, a NaN or an unsafe
   * magnitude must fall through to a renumber that repairs the band — the
   * component must never propagate the poisoned value into a write.
   */
  const hostile: { label: string; rank: number }[] = [
    { label: 'a fractional rank', rank: 1536.5 },
    { label: 'a NaN rank', rank: Number.NaN },
    { label: 'an infinite rank', rank: Number.POSITIVE_INFINITY },
    { label: 'a rank beyond MAX_SAFE_INTEGER', rank: Number.MAX_SAFE_INTEGER + 2 },
  ];

  for (const testCase of hostile) {
    it(`repairs the band rather than writing ${testCase.label} back`, async () => {
      const store = storeWith(
        task({ id: 'a', name: 'a', rank: 1024 }),
        task({ id: 'b', name: 'b', rank: testCase.rank }),
        task({ id: 'c', name: 'c', rank: 9_000_000 }),
      );
      const { view, client } = await mountQueue(store);

      dropTaskOn(rowFor(view, 'a'), 'c');
      await flush();
      await settle(view);

      expect(client.updateTaskCalls.length, 'a poisoned band must renumber').toBeGreaterThan(1);
      for (const call of client.updateTaskCalls) {
        const written = call.fields.rank as number;
        expect(Number.isSafeInteger(written), `wrote ${written} for ${call.id}`).toBe(true);
        expect(written).toBeGreaterThanOrEqual(1);
      }
      for (const id of ['a', 'b', 'c']) {
        const rank = store.getTask(id)?.rank;
        expect(Number.isSafeInteger(rank), `${id} kept an unusable rank: ${rank}`).toBe(true);
      }
    });
  }

  /**
   * FINDING F-1, at component level. Negative and zero ranks pass
   * `Number.isSafeInteger`, so unlike the cases above they do NOT force a
   * renumber — the midpoint arithmetic runs on them and can produce a rank
   * below the `MIN_RANK = 1` that `rank.ts` documents it will never hand out.
   *
   * This asserts the CURRENT behaviour so the defect is recorded rather than
   * discovered again later. It is deliberately not fixed here: this is a test
   * pass, and the fix belongs to whoever owns `rank.ts`.
   */
  it('writes a rank below the documented minimum when the server sent negative ranks (finding F-1)', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a', rank: -5 }),
      task({ id: 'b', name: 'b', rank: 0 }),
      task({ id: 'c', name: 'c', rank: 5 }),
    );
    const { view, client } = await mountQueue(store);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls).toHaveLength(1);
    expect(client.updateTaskCalls[0].fields.rank).toBe(-3);
    // The displayed order is right, which is why an order-only assertion would
    // never have surfaced this.
    expect(rowIds(view)).toEqual(['a', 'c', 'b']);
  });
});

describe('ft-ready-queue-view — reordering while a filter hides part of the band', () => {
  /**
   * FINDING F-2, now fixed. `reorder()` used to compute midpoints over
   * `getReadyTasks()`, which has every active filter applied, so a neighbour
   * hidden by the filter was invisible to the arithmetic: dropping between two
   * visible rows could assign the moved task a rank a hidden task already held,
   * and the queue comparator then resolved that collision on `created_at`
   * rather than on where the user dropped it.
   *
   * The fix runs the arithmetic over the FULL band (`bandFor`), resolving only
   * the drop *target* visually. These tests assert the observable contract —
   * no duplicate rank persisted, the hidden neighbour keeps its place, the
   * visible order is what the user dropped — rather than the intermediate
   * maths, so they stay meaningful if the arithmetic is reworked again.
   */
  it('writes no duplicate rank when a filtered-out neighbour sits in the gap', async () => {
    const store = storeWith(
      // `availability` is set because the local readiness fallback rejects an
      // assigned task; the server is authoritative and says these are ready.
      assigned('a', 1024, 'u1'),
      assigned('h', 1536, 'u2'),
      assigned('b', 2048, 'u1'),
      assigned('c', 3072, 'u1'),
    );
    const { view, client } = await mountQueue(store, { assigneeFilter: 'u1' });

    expect(rowIds(view), 'h must be hidden for this test to mean anything').toEqual(['a', 'b', 'c']);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls).toHaveLength(1);
    const ranks = ranksInQueueOrder(store, ['a', 'h', 'b', 'c']);
    const values = ranks.map(([, rank]) => rank);
    expect(new Set(values).size, `ranks are ${JSON.stringify(ranks)}`).toBe(values.length);
    expect(store.getTask('c')?.rank).not.toBe(store.getTask('h')?.rank);
  });

  /**
   * The ordering half of the same fix, and the part a duplicate-rank assertion
   * alone would not catch: a rank can be distinct and still land on the wrong
   * side of the hidden neighbour. `h` sat between `a` and `b` before the drag
   * and must still sit between them afterwards, while the visible rows show
   * exactly the order the user dropped.
   */
  it('keeps a hidden neighbour in its relative position and honours the drop', async () => {
    const store = storeWith(
      assigned('a', 1024, 'u1'),
      assigned('h', 1536, 'u2'),
      assigned('b', 2048, 'u1'),
      assigned('c', 3072, 'u1'),
    );
    const { view } = await mountQueue(store, { assigneeFilter: 'u1' });

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    // Full band, filter ignored: `h` is still second, exactly where it was.
    expect(ranksInQueueOrder(store, ['a', 'h', 'b', 'c']).map(([id]) => id)).toEqual([
      'a',
      'h',
      'c',
      'b',
    ]);
    // And what the user actually sees is the order they dropped.
    expect(rowIds(view)).toEqual(['a', 'c', 'b']);
  });

  /**
   * The filter must change nothing about the arithmetic. Same store, same
   * gesture, once with `h` hidden and once with it visible: the persisted ranks
   * must be identical, which is the strongest single statement of the fix.
   */
  it('writes exactly the same ranks whether or not the filter hides the neighbour', async () => {
    const bandFixture = () => [
      assigned('a', 1024, 'u1'),
      assigned('h', 1536, 'u2'),
      assigned('b', 2048, 'u1'),
      assigned('c', 3072, 'u1'),
    ];

    const filteredStore = storeWith(...bandFixture());
    const filtered = await mountQueue(filteredStore, { assigneeFilter: 'u1' });
    dropTaskOn(rowFor(filtered.view, 'b'), 'c');
    await flush();
    await settle(filtered.view);

    const unfilteredStore = storeWith(...bandFixture());
    const unfiltered = await mountQueue(unfilteredStore);
    dropTaskOn(rowFor(unfiltered.view, 'b'), 'c');
    await flush();
    await settle(unfiltered.view);

    expect(filtered.client.updateTaskCalls.map((call) => ({ id: call.id, rank: call.fields.rank })))
      .toEqual(unfiltered.client.updateTaskCalls.map((call) => ({ id: call.id, rank: call.fields.rank })));
    expect(filtered.client.updateTaskCalls, 'the gesture must actually write something').not.toHaveLength(0);
  });

  /**
   * The other half of "the full band": full means the whole *rank scope*, and
   * contract §4.6 scopes rank to (collection, priority band). Widening the band
   * past the collection would be as wrong as narrowing it past the filter — a
   * foreign collection's ranks would start anchoring this one's arithmetic.
   *
   * `f` deliberately holds 1536, the midpoint this drop must produce. The
   * assertion is that the drop still writes 1536: a foreign task is not a
   * neighbour, so colliding with it is correct and stepping around it is not.
   */
  it('ignores a same-band task from another collection when computing the midpoint', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a', rank: 1024 }),
      task({ id: 'f', name: 'f', rank: 1536, collectionId: OTHER_COLLECTION_ID }),
      task({ id: 'b', name: 'b', rank: 2048 }),
      task({ id: 'c', name: 'c', rank: 3072 }),
    );
    const { view, client } = await mountQueue(store);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls.map((call) => ({ id: call.id, rank: call.fields.rank }))).toEqual([
      { id: 'c', rank: 1536 },
    ]);
    expect(store.getTask('f')?.rank, 'a foreign collection must never be renumbered').toBe(1536);
  });

  /**
   * The positive counterpart with no filter at all: the same drop must produce
   * a band whose ranks are all distinct.
   */
  it('keeps every rank distinct when no filter is hiding a neighbour', async () => {
    const store = storeWith(
      // `availability` is set because the local readiness fallback rejects an
      // assigned task; the server is authoritative and says these are ready.
      assigned('a', 1024, 'u1'),
      assigned('h', 1536, 'u2'),
      assigned('b', 2048, 'u1'),
      assigned('c', 3072, 'u1'),
    );
    const { view } = await mountQueue(store);

    expect(rowIds(view)).toEqual(['a', 'h', 'b', 'c']);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    const ranks = ranksInQueueOrder(store, ['a', 'h', 'b', 'c']);
    const values = ranks.map(([, rank]) => rank);
    expect(new Set(values).size, `ranks are ${JSON.stringify(ranks)}`).toBe(values.length);
    expect(rowIds(view)).toEqual(['a', 'h', 'c', 'b']);
  });
});

describe('ft-ready-queue-view — a queue with no client attached', () => {
  /**
   * FINDING F-3. With no `client`, `reorder()` performs the optimistic store
   * write, then returns after a `console.warn`. The row moves, nothing is
   * persisted, and the user is told nothing — the same silent-no-op class this
   * round exists to eliminate, arriving through a different door. The early
   * return also sits *after* the optimistic write, so the store is left holding
   * ranks the server has never seen.
   *
   * Asserted as current behaviour, flagged as a finding, not fixed here.
   */
  it('moves the row and mutates the store while telling the user nothing (finding F-3)', async () => {
    const store = storeWith(
      task({ id: 'a', name: 'a', rank: 1024 }),
      task({ id: 'b', name: 'b', rank: 2048 }),
      task({ id: 'c', name: 'c', rank: 3072 }),
    );
    const view = await mount<HTMLElement>('ft-ready-queue-view', {
      store,
      capabilities: ALL_ENABLED,
    });
    const feedback = collectFeedback(view);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    // The store really was changed — this is not a harmless no-op.
    expect(store.getTask('c')?.rank).toBe(1536);
    expect(rowIds(view)).toEqual(['a', 'c', 'b']);
    // And the user was told nothing at all.
    expect(feedback.sawFeedback(), feedback.describe()).toBe(false);
  });
});

describe('ft-ready-queue-view — the view and the rank module agree', () => {
  /**
   * Binds the component's writes to `ranksForMove` itself rather than to a
   * transcription of what it returns. Hardcoding 1536 in a component test
   * asserts a number; asserting against the real module asserts that the view
   * asks the module and sends what it gets back, which is the actual contract
   * between them. If the sparse-rank strategy changes, this follows it; if the
   * view starts computing ranks of its own, this breaks.
   */
  const scenarios: { label: string; band: Task[]; moved: string; onto: string }[] = [
    {
      label: 'a ranked band with an open gap',
      band: [
        task({ id: 'a', name: 'a', rank: 1024 }),
        task({ id: 'b', name: 'b', rank: 2048 }),
        task({ id: 'c', name: 'c', rank: 3072 }),
      ],
      moved: 'c',
      onto: 'b',
    },
    {
      label: 'a wholly unranked band',
      band: [task({ id: 'a', name: 'a' }), task({ id: 'b', name: 'b' }), task({ id: 'c', name: 'c' })],
      moved: 'c',
      onto: 'a',
    },
    {
      label: 'an exhausted gap',
      band: [
        task({ id: 'a', name: 'a', rank: 5 }),
        task({ id: 'b', name: 'b', rank: 6 }),
        task({ id: 'c', name: 'c', rank: 9000 }),
      ],
      moved: 'c',
      onto: 'b',
    },
  ];

  for (const scenario of scenarios) {
    it(`sends exactly the writes ranksForMove produces for ${scenario.label}`, async () => {
      const store = storeWith(...scenario.band);
      const { view, client } = await mountQueue(store);

      const visible = rowIds(view);
      const expected = ranksForMove(
        visible.map((id) => store.getTask(id)!),
        scenario.moved,
        visible.indexOf(scenario.onto),
      );
      expect(expected.length, 'the scenario must actually produce writes').toBeGreaterThan(0);

      dropTaskOn(rowFor(view, scenario.onto), scenario.moved);
      await flush();
      await settle(view);

      expect(
        client.updateTaskCalls.map((call) => ({ id: call.id, rank: call.fields.rank })),
      ).toEqual(expected);
    });
  }
});
