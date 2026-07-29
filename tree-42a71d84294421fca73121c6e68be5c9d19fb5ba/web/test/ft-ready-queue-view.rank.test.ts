import { describe, expect, it } from 'vitest';
import '../src/components/ready-queue/ft-ready-queue-view.js';
import { TaskPriority } from '../src/gen/types.js';
import { ALL_ENABLED, GITHUB_CAPABILITIES } from '../src/capabilities.js';
import { PRIORITY_LABEL } from '../src/util/priority-utils.js';
import { DROP_REFUSAL, WRITE_FAILURE } from '../src/util/task-state-utils.js';
import { dragOverOn, dropTaskOn, flush, mount, queryAllDeep, settle } from './helpers/dom.js';
import { collectFeedback } from './helpers/feedback.js';
import { RecordingClient, storeWith, task } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

/**
 * Contract §10 requires drag/drop to reorder within a priority band, and
 * requires every refusal to be visible. These tests pin the wire payload, the
 * optimistic-then-reconcile write path, and the refusal paths.
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

/** Task names, in the order the queue currently renders them. */
function rowIds(view: Element): string[] {
  return queryAllDeep(view, '.queue-row').map((row) =>
    (row.getAttribute('aria-label') ?? '').replace('Task: ', ''),
  );
}

function rowFor(view: Element, id: string): Element {
  const row = queryAllDeep(view, '.queue-row').find(
    (candidate) => candidate.getAttribute('aria-label') === `Task: ${id}`,
  );
  if (!row) throw new Error(`no queue row rendered for task ${id}; rendered: ${rowIds(view).join(', ')}`);
  return row;
}

/** Three ready tasks in one band, already ranked with room between them. */
function rankedBand() {
  return storeWith(
    task({ id: 'a', name: 'a', rank: 1024 }),
    task({ id: 'b', name: 'b', rank: 2048 }),
    task({ id: 'c', name: 'c', rank: 3072 }),
  );
}

/** Three ready tasks with no ranks at all — the current state of real data. */
function unrankedBand() {
  return storeWith(
    task({ id: 'a', name: 'a' }),
    task({ id: 'b', name: 'b' }),
    task({ id: 'c', name: 'c' }),
  );
}

describe('ft-ready-queue-view — rank mutation payload', () => {
  it('sends only { rank } to updateTask', async () => {
    const { view, client } = await mountQueue(rankedBand());

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(1);
    expect(client.updateTaskCalls[0].id).toBe('c');
    expect(Object.keys(client.updateTaskCalls[0].fields)).toEqual(['rank']);
  });

  it('writes a single task when the move lands in an open gap', async () => {
    const { view, client } = await mountQueue(rankedBand());

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(1);
    expect(client.updateTaskCalls[0].fields.rank).toBe(1536);
  });

  it('renumbers the band when no task has a rank yet, still writing only { rank }', async () => {
    const { view, client } = await mountQueue(unrankedBand());

    dropTaskOn(rowFor(view, 'a'), 'c');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls.map((call) => call.id)).toEqual(['c', 'a', 'b']);
    for (const call of client.updateTaskCalls) {
      expect(Object.keys(call.fields)).toEqual(['rank']);
    }
    expect(rowIds(view)).toEqual(['c', 'a', 'b']);
  });
});

describe('ft-ready-queue-view — optimistic reorder', () => {
  it('moves the row into the drop position and persists the new rank', async () => {
    const store = rankedBand();
    const { view } = await mountQueue(store);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(rowIds(view)).toEqual(['a', 'c', 'b']);
    expect(store.getTask('c')?.rank).toBe(1536);
    expect(store.getTask('a')?.rank).toBe(1024);
    expect(store.getTask('b')?.rank).toBe(2048);
  });

  it('reorders to the head of the band', async () => {
    const store = rankedBand();
    const { view } = await mountQueue(store);

    dropTaskOn(rowFor(view, 'a'), 'c');
    await flush();
    await settle(view);

    expect(rowIds(view)).toEqual(['c', 'a', 'b']);
    expect(store.getTask('c')!.rank!).toBeLessThan(1024);
  });

  it('writes nothing when a row is dropped onto itself', async () => {
    const { view, client } = await mountQueue(rankedBand());

    dropTaskOn(rowFor(view, 'b'), 'b');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(0);
  });
});

describe('ft-ready-queue-view — server rejection', () => {
  it('rolls the order back and surfaces a visible error', async () => {
    const store = rankedBand();
    const { view, client } = await mountQueue(store);
    const feedback = collectFeedback(view);
    client.rejectUpdateWith = new Error('server said no');

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls).toHaveLength(1);
    expect(store.getTask('c')?.rank).toBe(3072);
    expect(rowIds(view)).toEqual(['a', 'b', 'c']);
    expect(feedback.sawFeedback(), feedback.describe()).toBe(true);
    expect(feedback.reasons()).toContain('rank-change-failed');
  });

  it('rolls the whole band back when a renumber fails part way through', async () => {
    const store = unrankedBand();
    const { view, client } = await mountQueue(store);
    const feedback = collectFeedback(view);
    client.rejectUpdateWith = new Error('server said no');

    dropTaskOn(rowFor(view, 'a'), 'c');
    await flush();
    await settle(view);

    for (const id of ['a', 'b', 'c']) {
      expect(store.getTask(id)?.rank, `${id} should keep its original rank`).toBeUndefined();
    }
    expect(rowIds(view)).toEqual(['a', 'b', 'c']);
    expect(feedback.sawFeedback(), feedback.describe()).toBe(true);
  });

  /**
   * The PRODUCER side of the write-error seam.
   *
   * `ft-app.write-error-seam.test.ts` proves `ft-app` prefers `message` over
   * the raw error, but it synthesises the event by hand — so nothing proved
   * the queue attaches `message` under the right condition, and only then.
   * Both halves of that distinction were free to regress on a green suite,
   * which is the half `WRITE_FAILURE.partialRenumber` exists to get right:
   * "reload to see the saved order" is a lie after a single failed write,
   * because nothing was saved.
   */
  it('attaches the partial-renumber message when a renumber wrote more than once', async () => {
    const store = unrankedBand();
    const { view, client } = await mountQueue(store);
    const feedback = collectFeedback(view);
    // Fail the SECOND write, not the first. `rejectUpdateWith` rejects from
    // call one, which leaves nothing persisted and so is not the situation
    // the message describes; this is a genuine part-way failure, with an
    // earlier rank already on the server when a later one fails.
    client.updateTaskResponse = (echoed) => {
      if (client.updateTaskCalls.length >= 2) throw new Error('server said no');
      return echoed;
    };

    dropTaskOn(rowFor(view, 'a'), 'c');
    await flush();
    await settle(view);

    // Premise: this really is the multi-write renumber path. Without this the
    // test would still pass if the drop silently became a single write.
    expect(client.updateTaskCalls.length, 'expected a renumber, not a single write')
      .toBeGreaterThan(1);

    expect(feedback.writeErrors, feedback.describe()).toHaveLength(1);
    const detail = feedback.writeErrors[0].detail;
    expect(detail.reason).toBe('rank-change-failed');
    expect(detail.message).toBe(WRITE_FAILURE.partialRenumber);
  });

  it('omits the partial-renumber message when only one rank was written', async () => {
    const store = rankedBand();
    const { view, client } = await mountQueue(store);
    const feedback = collectFeedback(view);
    client.rejectUpdateWith = new Error('server said no');

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    // Premise, stated at its real strength: one call reached the client before
    // it threw, so no EARLIER write can have landed — which is the only thing
    // the outcome assertion below depends on.
    //
    // It does NOT prove `ranksForMove` planned a single write. `rejectUpdateWith`
    // throws on call one, so the production loop aborts there and this would
    // still read 1 if three writes had been planned. Proving the planned count
    // needs a run that does not fail, since the truncation is in the loop and
    // no client-side helper can observe past it. The multi-write direction is
    // pinned by the sibling "attaches" test above, which fails the SECOND write
    // and so can legitimately assert `.toBeGreaterThan(1)`.
    expect(client.updateTaskCalls).toHaveLength(1);

    expect(feedback.writeErrors, feedback.describe()).toHaveLength(1);
    const detail = feedback.writeErrors[0].detail;
    expect(detail.reason).toBe('rank-change-failed');
    expect(detail.message, 'nothing was saved, so "reload to see the saved order" would be wrong')
      .toBeUndefined();
  });
});

describe('ft-ready-queue-view — refusals are visible, never silent', () => {
  it('refuses a cross-band drop with an explanation', async () => {
    const store = storeWith(
      task({ id: 'hi', name: 'hi', priority: TaskPriority.HIGH }),
      task({ id: 'lo', name: 'lo', priority: TaskPriority.LOW }),
    );
    const { view, client } = await mountQueue(store);
    const feedback = collectFeedback(view);

    dropTaskOn(rowFor(view, 'hi'), 'lo');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(0);
    expect(feedback.sawFeedback(), feedback.describe()).toBe(true);
    expect(feedback.reasons()).toContain('rank-change-refused');
    // Exact equality against the production constant, not a loose /priority/i
    // match: the queue half of the refusal seam now binds to `DROP_REFUSAL`
    // exactly as the board half does, so the toast and the vocabulary cannot
    // drift. The wording itself is anchored once, in the vocabulary contract.
    expect(feedback.writeErrors[0].detail.message).toBe(
      DROP_REFUSAL.crossBandToast('lo', PRIORITY_LABEL[TaskPriority.HIGH]),
    );
  });

  it('refuses reordering on a read-only queue', async () => {
    const { view, client } = await mountQueue(rankedBand(), { readOnly: true });
    const feedback = collectFeedback(view);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(0);
    expect(feedback.sawFeedback(), feedback.describe()).toBe(true);
    expect(feedback.writeErrors[0].detail.message).toBe(DROP_REFUSAL.readOnlyQueue);
  });

  it('refuses reordering when the collection cannot reorder', async () => {
    const { view, client } = await mountQueue(rankedBand(), { capabilities: GITHUB_CAPABILITIES });
    const feedback = collectFeedback(view);

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(0);
    expect(feedback.sawFeedback(), feedback.describe()).toBe(true);
    expect(feedback.reasons()).toContain('rank-change-refused');
    expect(feedback.writeErrors[0].detail.message).toBe(DROP_REFUSAL.reorderUnsupported);
  });
});

describe('ft-ready-queue-view — dragover must not block the drop', () => {
  /**
   * Regression guard for the silent no-op class of bug: a `drop` only fires if
   * `dragover` was cancelled. A refusing row that bails out of `dragover`
   * before `preventDefault()` never reaches its own refusal handler, so the
   * gesture dies silently and the UI looks frozen.
   */
  it('cancels dragover on a normal row', async () => {
    const { view } = await mountQueue(rankedBand());
    expect(dragOverOn(rowFor(view, 'b')).defaultPrevented).toBe(true);
  });

  it('cancels dragover on a read-only queue, which will refuse the drop', async () => {
    const { view } = await mountQueue(rankedBand(), { readOnly: true });
    expect(dragOverOn(rowFor(view, 'b')).defaultPrevented).toBe(true);
  });

  it('cancels dragover when the collection cannot reorder', async () => {
    const { view } = await mountQueue(rankedBand(), { capabilities: GITHUB_CAPABILITIES });
    expect(dragOverOn(rowFor(view, 'b')).defaultPrevented).toBe(true);
  });

  it('cancels dragover on a row in another priority band', async () => {
    const store = storeWith(
      task({ id: 'hi', name: 'hi', priority: TaskPriority.HIGH }),
      task({ id: 'lo', name: 'lo', priority: TaskPriority.LOW }),
    );
    const { view } = await mountQueue(store);
    expect(dragOverOn(rowFor(view, 'lo')).defaultPrevented).toBe(true);
  });

  it('keeps rows draggable so a refusing queue can still report the refusal', async () => {
    const { view } = await mountQueue(rankedBand(), { readOnly: true });
    expect(rowFor(view, 'b').getAttribute('draggable')).toBe('true');
  });
});
