import { describe, expect, it } from 'vitest';
import '../src/components/ready-queue/ft-ready-queue-view.js';
import { TaskPriority } from '../src/gen/types.js';
import { ALL_ENABLED, GITHUB_CAPABILITIES } from '../src/capabilities.js';
import { PRIORITY_LABEL } from '../src/util/priority-utils.js';
import { DROP_REFUSAL } from '../src/util/task-state-utils.js';
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
