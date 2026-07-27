import { describe, expect, it } from 'vitest';
import '../src/components/kanban/ft-kanban-column.js';
import '../src/components/kanban/ft-task-card.js';
import '../src/components/ready-queue/ft-ready-queue-view.js';
import { TaskPriority, TaskStage, type Task } from '../src/gen/types.js';
import { compareAcceptedQueueOrder } from '../src/util/task-state-utils.js';
import { mount, queryAllDeep } from './helpers/dom.js';
import { storeWith, task } from './helpers/fixtures.js';

const AVAILABLE = { available: true, reasons: [] };

/**
 * Deliberately mixed inputs: two priority bands separated only by rank, two
 * tasks separated only by created-at, and two separated only by id.
 *
 * FINDING H-1. `f-normal-2b` is listed BEFORE `e-normal-2a` on purpose, and
 * must stay that way. They tie on priority, rank and created-at, so only the
 * comparator's last resort — `id` — can order them, and `Array.prototype.sort`
 * is stable: with the pair listed in id order, a comparator that returned `0`
 * for the tie produced exactly the same output as the real one, and all three
 * tests below passed with the tiebreak deleted. Listing them in reverse id
 * order is what makes the tiebreak load-bearing. Do not "tidy" this back into
 * alphabetical order.
 */
const MIXED: Task[] = [
  task({ id: 'g-no-priority', name: 'G', priority: TaskPriority.UNSPECIFIED, availability: AVAILABLE }),
  task({ id: 'f-normal-2b', name: 'F', priority: TaskPriority.NORMAL, rank: 2, createdAt: '2026-03-01T00:00:00.000Z', availability: AVAILABLE }),
  task({ id: 'c-high-late', name: 'C', priority: TaskPriority.HIGH, createdAt: '2026-06-01T00:00:00.000Z', availability: AVAILABLE }),
  task({ id: 'a-urgent-rank5', name: 'A', priority: TaskPriority.URGENT, rank: 5, availability: AVAILABLE }),
  task({ id: 'e-normal-2a', name: 'E', priority: TaskPriority.NORMAL, rank: 2, createdAt: '2026-03-01T00:00:00.000Z', availability: AVAILABLE }),
  task({ id: 'd-high-early', name: 'D', priority: TaskPriority.HIGH, createdAt: '2025-01-01T00:00:00.000Z', availability: AVAILABLE }),
  task({ id: 'b-urgent-rank1', name: 'B', priority: TaskPriority.URGENT, rank: 1, availability: AVAILABLE }),
];

/** Priority band, then rank, then created-at, then id. */
const EXPECTED_ORDER = ['B', 'A', 'D', 'C', 'E', 'F', 'G'];

describe('compareAcceptedQueueOrder — expectation baseline', () => {
  it('orders the mixed fixture by priority, rank, created-at, then id', () => {
    const sorted = [...MIXED].sort(compareAcceptedQueueOrder).map((item) => item.name);

    expect(sorted).toEqual(EXPECTED_ORDER);
  });
});

describe('ft-kanban-column — rendered ordering', () => {
  it('renders cards in accepted-queue order, not input order', async () => {
    const column = await mount<HTMLElement>('ft-kanban-column', {
      stage: TaskStage.ACCEPTED,
      label: 'Accepted',
      tasks: MIXED,
      store: storeWith(...MIXED),
      totalCount: MIXED.length,
    });

    const rendered = queryAllDeep<HTMLElement & { task: Task }>(column, 'ft-task-card').map(
      (card) => card.task.name,
    );

    expect(rendered).toEqual(EXPECTED_ORDER);
  });

  it('re-sorts when the task list changes', async () => {
    const first = task({ id: 'first', name: 'First', priority: TaskPriority.LOW });
    const second = task({ id: 'second', name: 'Second', priority: TaskPriority.URGENT });
    const column = await mount<HTMLElement>('ft-kanban-column', {
      stage: TaskStage.ACCEPTED,
      label: 'Accepted',
      tasks: [first],
      store: storeWith(first, second),
      totalCount: 1,
    });

    (column as HTMLElement & { tasks: Task[] }).tasks = [first, second];
    await (column as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    await (column as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const rendered = queryAllDeep<HTMLElement & { task: Task }>(column, 'ft-task-card').map(
      (card) => card.task.name,
    );

    expect(rendered).toEqual(['Second', 'First']);
  });
});

describe('ft-ready-queue-view — rendered ordering', () => {
  it('renders available rows in accepted-queue order', async () => {
    const view = await mount<HTMLElement>('ft-ready-queue-view', { store: storeWith(...MIXED) });

    const rendered = queryAllDeep<HTMLElement>(view, '.queue-row .task-title').map((cell) =>
      (cell.textContent ?? '').trim(),
    );

    expect(rendered).toEqual(EXPECTED_ORDER);
  });

  /**
   * L-4. `MIXED.length` was the wrong yardstick: the header count and the rows
   * are both derived from the same array, so the assertion structurally could
   * not detect a header that disagreed with what is on screen — and it silently
   * assumed every fixture task is queue-eligible, which is not a property of
   * `MIXED`. The count is now checked against the ROWS ACTUALLY RENDERED, plus
   * a literal so a change in either direction has to be deliberate.
   */
  it('counts the rendered rows in its header', async () => {
    const view = await mount<HTMLElement>('ft-ready-queue-view', { store: storeWith(...MIXED) });

    const rows = queryAllDeep<HTMLElement>(view, '.queue-row');
    const header = queryAllDeep<HTMLElement>(view, '.queue-header')[0];

    expect(rows).toHaveLength(EXPECTED_ORDER.length);
    expect((header.textContent ?? '').trim()).toBe(`Available Queue (${rows.length})`);
  });

  /**
   * The discriminating half of L-4. Every task in `MIXED` is queue-eligible, so
   * "count the rendered rows", "count the fixture" and "count the whole store"
   * all give the same number against that fixture — a header wired to the store
   * would pass the test above. This store holds tasks the queue filters out, so
   * the three counts differ and only the right one passes.
   */
  it('counts only the rows it renders, not every task in the store', async () => {
    const hidden = [
      task({ id: 'z-unavailable', name: 'Z', availability: { available: false, reasons: [] } }),
      // No `availability` at all, so the conservative local fallback applies and
      // a non-accepted stage keeps it out of the queue.
      task({ id: 'y-triage', name: 'Y', stage: TaskStage.TRIAGE }),
    ];
    const view = await mount<HTMLElement>('ft-ready-queue-view', {
      store: storeWith(...MIXED, ...hidden),
    });

    const rows = queryAllDeep<HTMLElement>(view, '.queue-row');
    const header = queryAllDeep<HTMLElement>(view, '.queue-header')[0];

    expect(rows, 'the hidden fixtures must actually be filtered out').toHaveLength(
      EXPECTED_ORDER.length,
    );
    expect((header.textContent ?? '').trim()).toBe(
      `Available Queue (${EXPECTED_ORDER.length})`,
    );
  });

  /**
   * Characterisation, discovered while building the fixture above. `isReady()`
   * treats server-reported availability as authoritative and returns before it
   * ever looks at `stage`, so a COMPLETED task the server calls available is
   * rendered in the Available Queue. That is the documented precedence rule
   * rather than a bug, but it means "queue membership" is a server claim and
   * the client applies no stage sanity check on top of it.
   */
  it('renders a closed task the server still reports as available (server availability wins over stage)', async () => {
    const view = await mount<HTMLElement>('ft-ready-queue-view', {
      store: storeWith(
        ...MIXED,
        task({ id: 'x-done', name: 'X', stage: TaskStage.COMPLETED, availability: AVAILABLE }),
      ),
    });

    const rows = queryAllDeep<HTMLElement>(view, '.queue-row');

    expect(rows).toHaveLength(EXPECTED_ORDER.length + 1);
  });
});
