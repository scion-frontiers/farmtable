import { beforeAll, describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-changes.js';
import { MockFarmTableClient } from '../src/gen/service.js';
import type { FarmTableServiceClient } from '../src/gen/service.js';
import type { Change, Task } from '../src/gen/types.js';
import { IdentityStatus, TaskHoldReason, TaskStage, UserType } from '../src/gen/types.js';
import { HOLD_REASON_LABEL, STAGE_LABEL } from '../src/util/task-state-utils.js';
import { flush, mount, queryAllDeep, queryDeep, settle } from './helpers/dom.js';
import { DELETED_STAGE_LABELS } from './helpers/fixtures.js';

/**
 * The stage vocabulary a user is allowed to read anywhere in the UI. Imported,
 * never re-listed here: a local copy would pass even if production renamed a
 * stage, which is the exact defect these vocabulary tests exist to catch.
 */
const VALID_STAGE_LABELS = Object.values(STAGE_LABEL);

const ALICE = { id: 'u1', name: 'Alice', type: UserType.HUMAN, status: IdentityStatus.ACTIVE };

/** A client that answers `listChanges()` immediately with a fixed history. */
function changesClient(changes: Change[]): FarmTableServiceClient {
  return { listChanges: async () => changes } as unknown as FarmTableServiceClient;
}

/**
 * Mount the change-history section and expand it so changes are fetched.
 *
 * The expand is dispatched by hand because the Shoelace stand-in does not open
 * itself, and the wait is microtask-based: the client passed in here resolves
 * synchronously, so there is nothing to sleep for. (Sleeping out
 * `MockFarmTableClient`'s artificial 300ms `listChanges` delay once per mounted
 * task is what made this file the slowest in the suite.)
 */
async function mountChanges(taskId: string, client: FarmTableServiceClient) {
  const element = await mount<HTMLElement>('ft-inspector-changes', { taskId, client });
  const details = queryDeep<HTMLElement>(element, 'sl-details');
  if (!details) throw new Error('ft-inspector-changes rendered no sl-details section');
  details.dispatchEvent(new CustomEvent('sl-show', { bubbles: true, composed: true }));
  await flush();
  await settle(element);
  return element;
}

interface RenderedEntry {
  field: string;
  values: string;
}

function renderedEntries(element: Element): RenderedEntry[] {
  return queryAllDeep<HTMLElement>(element, '.entry').map((entry) => ({
    field: (entry.querySelector('.field-name')?.textContent ?? '').trim(),
    values: (entry.querySelector('.entry-values')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

/** The individual stage names either side of the `old → new` arrow. */
function stageWords(values: string): string[] {
  return values
    .split('→')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '—');
}

/** What one mock task's change history actually rendered. */
interface TaskHistory {
  taskId: string;
  /** The changes the real mock client reports for this task. */
  fixture: Change[];
  entries: RenderedEntry[];
}

describe('ft-inspector-changes — deleted stage vocabulary', () => {
  let tasks: Task[];
  let histories: TaskHistory[];
  /** Every rendered entry, across every mock task, in task order. */
  let allEntries: RenderedEntry[];
  let allFixtureChanges: Change[];

  /**
   * Mount every mock task's history ONCE and keep the extracted text.
   *
   * Each test used to remount all ten tasks and sleep 400ms per mount to outlast
   * the mock client's 300ms `listChanges` delay — ~4s per test. The histories are
   * read-only vocabulary evidence, so one shared render serves every assertion.
   */
  beforeAll(async () => {
    const client = new MockFarmTableClient();
    tasks = await client.listTasks();
    // One parallel round-trip through the real mock client: the data under test
    // is still production mock data, only the serial waiting is gone.
    const fixtures = await Promise.all(tasks.map((task) => client.listChanges(task.id)));

    histories = [];
    for (const [index, task] of tasks.entries()) {
      const fixture = fixtures[index];
      const element = await mountChanges(task.id, changesClient(fixture));
      histories.push({ taskId: task.id, fixture, entries: renderedEntries(element) });
      element.remove();
    }
    allEntries = histories.flatMap((history) => history.entries);
    allFixtureChanges = fixtures.flat();
  });

  it('renders one change entry per recorded change for every mock task', () => {
    // Pins the iteration count of every loop below. Without this, a component
    // that rendered an empty list would make every vocabulary assertion vacuous:
    // zero entries cannot contain a deleted stage label.
    expect(histories).toHaveLength(tasks.length);
    expect(tasks.length).toBeGreaterThan(0);
    expect(allFixtureChanges.length).toBeGreaterThan(0);
    expect(allEntries).toHaveLength(allFixtureChanges.length);

    for (const history of histories) {
      expect(history.entries, `task ${history.taskId} entry count`).toHaveLength(history.fixture.length);
    }
  });

  it('renders the field name and both values of every recorded change', () => {
    expect(allEntries).toHaveLength(allFixtureChanges.length);

    for (const [index, change] of allFixtureChanges.entries()) {
      const entry = allEntries[index];
      // Positive counterpart to the "not.toContain" lints further down: proves
      // the same fixture really does put readable text on screen, so a negative
      // assertion passing means "absent", not "nothing rendered at all".
      expect(entry.field, `change ${change.id} field name`).toBe(change.field);
      expect(entry.values, `change ${change.id} new value`).toContain(String(change.newValue));
      if (change.oldValue != null) {
        expect(entry.values, `change ${change.id} old value`).toContain(String(change.oldValue));
        expect(entry.values, `change ${change.id} old→new arrow`).toContain('→');
      }
    }
  });

  it('renders exactly the stage labels the stage vocabulary defines, in change order', () => {
    const stageEntries = allEntries.filter((entry) => entry.field === 'stage');
    const stageFixtures = allFixtureChanges.filter((change) => change.field === 'stage');
    expect(stageFixtures.length).toBeGreaterThan(0);
    expect(stageEntries).toHaveLength(stageFixtures.length);

    const renderedWords = stageEntries.flatMap((entry) => stageWords(entry.values));
    // Exact, ordered, and expressed through the production label map: renaming a
    // stage in STAGE_LABEL without updating the rendered history fails here.
    // Mock order: task ...002 "Accepted → Working", task ...005 "Working → In Review".
    expect(renderedWords).toEqual([
      STAGE_LABEL[TaskStage.ACCEPTED],
      STAGE_LABEL[TaskStage.WORKING],
      STAGE_LABEL[TaskStage.WORKING],
      STAGE_LABEL[TaskStage.IN_REVIEW],
    ]);
  });

  it('renders only valid native stage labels as stage change values', () => {
    const stageEntries = allEntries.filter((entry) => entry.field === 'stage');
    expect(stageEntries).toHaveLength(
      allFixtureChanges.filter((change) => change.field === 'stage').length,
    );
    expect(stageEntries.length).toBeGreaterThan(0);

    const renderedWords = stageEntries.flatMap((entry) => stageWords(entry.values));
    // Four words: two per stage change. Pinned so the membership loop below can
    // never run zero times.
    expect(renderedWords).toHaveLength(stageEntries.length * 2);

    for (const word of renderedWords) {
      expect(VALID_STAGE_LABELS, `stage change value "${word}"`).toContain(word);
    }
  });

  it('renders no deleted stage vocabulary for any mock task change history', () => {
    const stageEntries = allEntries.filter((entry) => entry.field === 'stage');
    expect(stageEntries).toHaveLength(
      allFixtureChanges.filter((change) => change.field === 'stage').length,
    );
    expect(stageEntries.length).toBeGreaterThan(0);
    // The retired vocabulary is a fixed list; if it shrinks to nothing the loop
    // below stops proving anything.
    expect(DELETED_STAGE_LABELS).toHaveLength(4);

    for (const entry of stageEntries) {
      const words = stageWords(entry.values);
      // Positive first: this entry rendered real stage text, so the negatives
      // that follow are statements about content, not about an empty render.
      expect(words.length, `stage entry "${entry.values}" rendered no values`).toBeGreaterThan(0);
      for (const word of words) expect(VALID_STAGE_LABELS).toContain(word);

      for (const deleted of DELETED_STAGE_LABELS) {
        expect(words, `change history renders deleted stage "${deleted}"`).not.toContain(deleted);
      }
    }
  });

  it('would surface a deleted stage label if one were ever rendered', async () => {
    // Guards the guard: if `.entry` / `.field-name` / `.entry-values` selectors
    // or the arrow split ever drift, `renderedEntries()` silently returns nothing
    // and every "no deleted vocabulary" assertion above passes for free. This
    // feeds the component a history that DOES contain retired vocabulary and
    // requires the detector to see it.
    const element = await mountChanges(
      'task-legacy',
      changesClient([
        {
          id: 'ch-legacy',
          taskId: 'task-legacy',
          field: 'stage',
          oldValue: DELETED_STAGE_LABELS[0],
          newValue: STAGE_LABEL[TaskStage.WORKING],
          changedBy: ALICE,
          changedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );

    const entries = renderedEntries(element);
    expect(entries).toHaveLength(1);
    const words = stageWords(entries[0].values);
    expect(words).toEqual([DELETED_STAGE_LABELS[0], STAGE_LABEL[TaskStage.WORKING]]);
  });

  it('still renders hold-reason vocabulary from the mock history, which remains valid', () => {
    const holdEntries = allEntries.filter((entry) => entry.field === 'hold_reason');
    expect(holdEntries).toHaveLength(
      allFixtureChanges.filter((change) => change.field === 'hold_reason').length,
    );
    expect(holdEntries.length).toBeGreaterThan(0);

    for (const entry of holdEntries) {
      // Hold reasons were NOT deleted by the task-state contract, so this
      // vocabulary must still reach the user verbatim from HOLD_REASON_LABEL.
      expect(entry.values).toContain(HOLD_REASON_LABEL[TaskHoldReason.WAITING_FOR_INPUT]);
    }
  });

  it('renders both hold reasons across an old→new hold-reason change', async () => {
    const element = await mountChanges(
      'task-hold',
      changesClient([
        {
          id: 'ch-hold',
          taskId: 'task-hold',
          field: 'hold_reason',
          oldValue: HOLD_REASON_LABEL[TaskHoldReason.DEFERRED],
          newValue: HOLD_REASON_LABEL[TaskHoldReason.WAITING_FOR_INPUT],
          changedBy: ALICE,
          changedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );

    const entries = renderedEntries(element);
    expect(entries).toHaveLength(1);
    expect(entries[0].field).toBe('hold_reason');
    expect(entries[0].values).toContain(HOLD_REASON_LABEL[TaskHoldReason.DEFERRED]);
    expect(entries[0].values).toContain(HOLD_REASON_LABEL[TaskHoldReason.WAITING_FOR_INPUT]);
  });
});
