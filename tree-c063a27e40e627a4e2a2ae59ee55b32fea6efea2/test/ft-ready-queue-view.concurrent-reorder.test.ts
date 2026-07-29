import { describe, expect, it } from 'vitest';
import '../src/components/ready-queue/ft-ready-queue-view.js';
import { type Task } from '../src/gen/types.js';
import { ALL_ENABLED } from '../src/capabilities.js';
import { DROP_REFUSAL } from '../src/util/task-state-utils.js';
import { dropTaskOn, flush, mount, queryAllDeep, settle } from './helpers/dom.js';
import { collectFeedback } from './helpers/feedback.js';
import { RecordingClient, storeWith, task } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

/**
 * FINDING I-2 / LOW-4: two reorders in flight at once.
 *
 * `drop` returns the moment it has handed off to `reorder()`, but `reorder()`
 * keeps awaiting its writes, and nothing used to stop a second drag from
 * starting while the first was still on the wire. Two reorders then interleave
 * their writes against a band each computed from a different starting state,
 * and if the first fails its rollback restores pre-first-drag ranks over rows
 * the second already persisted — leaving the store contradicting the server
 * with nothing left to trigger a refetch.
 *
 * The view now refuses the second gesture out loud instead of racing it.
 */

/** A client whose `updateTask` blocks until the test releases it. */
class GatedClient extends RecordingClient {
  private release: (() => void) | null = null;
  private gate: Promise<void> | null = null;
  /** Runs on entry to each `updateTask`, before the gate — a mid-flight hook. */
  onUpdate: (() => void) | null = null;

  /** Make every subsequent `updateTask` hang until `open()` is called. */
  close(): void {
    this.gate = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  open(): void {
    this.release?.();
    this.gate = null;
    this.release = null;
  }

  override async updateTask(id: string, fields: { rank?: number }): Promise<Task> {
    this.onUpdate?.();
    // Start the real call first: `RecordingClient` records the call in its
    // synchronous prologue, so a test can see that the write was ISSUED while
    // the gate holds its result open. Gating before this point would make an
    // in-flight write indistinguishable from one that never happened.
    const pending = super.updateTask(id, fields);
    if (this.gate) await this.gate;
    return pending;
  }
}

const BAND: Task[] = [
  task({ id: 'a', name: 'a', rank: 1024 }),
  task({ id: 'b', name: 'b', rank: 2048 }),
  task({ id: 'c', name: 'c', rank: 3072 }),
];

async function mountQueue(store: TaskStore) {
  const client = new GatedClient(store);
  const view = await mount<HTMLElement>('ft-ready-queue-view', {
    store,
    client,
    capabilities: ALL_ENABLED,
  });
  return { view, client };
}

function rowFor(view: Element, id: string): Element {
  const row = queryAllDeep(view, '.queue-row').find(
    (candidate) => candidate.getAttribute('aria-label') === `Task: ${id}`,
  );
  if (!row) throw new Error(`no queue row rendered for ${id}`);
  return row;
}

function writes(client: RecordingClient) {
  return client.updateTaskCalls.map((call) => ({ id: call.id, rank: call.fields.rank }));
}

describe('ft-ready-queue-view — a reorder while another is still saving', () => {
  it('refuses the second gesture instead of interleaving its writes', async () => {
    const store = storeWith(...BAND);
    const { view, client } = await mountQueue(store);
    client.close();

    // First gesture: c between a and b. Its write is now hanging.
    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    expect(writes(client), 'the first reorder must be in flight').toEqual([{ id: 'c', rank: 1536 }]);

    // Second gesture, mid-flight.
    dropTaskOn(rowFor(view, 'c'), 'a');
    await flush();

    expect(writes(client), 'the second reorder must not have written anything').toEqual([
      { id: 'c', rank: 1536 },
    ]);

    client.open();
    await flush();
    await settle(view);

    expect(writes(client), 'and it must not run later either').toEqual([{ id: 'c', rank: 1536 }]);
  });

  it('tells the user why the second gesture did nothing', async () => {
    const store = storeWith(...BAND);
    const { view, client } = await mountQueue(store);
    const feedback = collectFeedback(view);
    client.close();

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    dropTaskOn(rowFor(view, 'c'), 'a');
    await flush();

    // A refusal is never a silent no-op: same channel, same vocabulary anchor
    // as every other refusal this view makes.
    expect(feedback.sawFeedback(), feedback.describe()).toBe(true);
    expect(feedback.writeErrors.map((event) => event.detail.message)).toEqual([
      DROP_REFUSAL.reorderBusy,
    ]);
    expect(feedback.reasons()).toEqual(['rank-change-refused']);

    client.open();
    await flush();
    await settle(view);
  });

  it('accepts the next gesture once the first reorder has finished', async () => {
    const store = storeWith(...BAND);
    const { view, client } = await mountQueue(store);
    client.close();

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    client.open();
    await flush();
    await settle(view);

    // The guard must be released on the way out, not left latched — otherwise
    // the first reorder of a session would be the last one the view ever ran.
    dropTaskOn(rowFor(view, 'a'), 'b');
    await flush();
    await settle(view);

    expect(writes(client)).toHaveLength(2);
  });

  it('releases the guard even when the reorder fails', async () => {
    const store = storeWith(...BAND);
    const { view, client } = await mountQueue(store);
    client.rejectUpdateWith = new Error('server said no');

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    client.rejectUpdateWith = null;
    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(writes(client)).toHaveLength(2);
  });
});

/**
 * Rollback scope. The catch block restores `rank` and nothing else.
 *
 * A whole-`Task` restore is the obvious implementation and the wrong one: the
 * writes are `await`ed, so the store can legitimately change underneath them —
 * a watch event carrying a rename, a stage change, a new `version`. Re-upserting
 * the pre-drag snapshot would silently revert all of it, undoing server state
 * this view never touched; and the stale `version` it puts back then fails the
 * *next* optimistic write with a conflict the user cannot explain.
 *
 * Restoring only `rank` keeps the blast radius equal to what the reorder
 * actually changed.
 */
describe('ft-ready-queue-view — rollback restores rank without clobbering concurrent edits', () => {
  it('keeps a rename that arrived while the failing write was on the wire', async () => {
    const store = storeWith(...BAND);
    const { view, client } = await mountQueue(store);
    client.rejectUpdateWith = new Error('server said no');
    // A watch event lands between the optimistic write and the rejection.
    client.onUpdate = () => {
      const moved = store.getTask('c')!;
      store.upsert({ ...moved, name: 'Renamed by someone else', version: '7' });
    };

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    const rolledBack = store.getTask('c')!;
    expect(rolledBack.rank, 'the rank the reorder set must be rolled back').toBe(3072);
    expect(rolledBack.name, 'the concurrent rename must survive the rollback').toBe(
      'Renamed by someone else',
    );
    expect(rolledBack.version, 'a stale version would break the next optimistic write').toBe('7');
  });

  it('still restores the rank of a task the store no longer holds a newer copy of', async () => {
    const store = storeWith(...BAND);
    const { view, client } = await mountQueue(store);
    client.rejectUpdateWith = new Error('server said no');

    dropTaskOn(rowFor(view, 'b'), 'c');
    await flush();
    await settle(view);

    expect(store.getTask('c')?.rank).toBe(3072);
  });
});
