import { TaskStore } from '../store/task-store.js';
import {
  RelationshipType,
  TaskHoldReason,
  TaskStage,
  Platform,
  type Task,
  type User,
} from '../gen/types.js';
import { isReady } from './task-ready.js';
<<<<<<< 439b309
import { assertEqual } from '../util/assertions.js';
=======
import { phaseForStage } from '../gen/service.js';
>>>>>>> e64138c


const now = new Date('2026-07-27T00:00:00.000Z').toISOString();

const assignee: User = {
  id: 'user-1',
  name: 'Assigned User',
  type: 1,
  status: 1,
};

/**
 * `phase` is DERIVED via the real `phaseForStage`, never hand-written.
 *
 * `isReady()` does not read `phase` today, so a hand-written projection is not
 * wrong yet — but this is the unit test for readiness, and the moment `isReady`
 * starts trusting the server's phase projection, a hand-maintained oracle here
 * becomes an independent and silently-wrong model of production.
 */
function task(overrides: Partial<Task> = {}): Task {
  const stage = overrides.stage ?? TaskStage.ACCEPTED;
  return {
    id: 'task-1',
    name: 'Task',
    phase: phaseForStage(stage),
    assignees: [],
    collectionId: 'collection-1',
    relationships: [],
    labels: [],
    customFields: [],
    platform: Platform.FARMTABLE,
    createdAt: now,
    version: '1',
    ...overrides,
    stage,
  };
}

function storeWith(...tasks: Task[]): TaskStore {
  const store = new TaskStore();
  for (const item of tasks) {
    store.upsert(item);
  }
  // Matches `test/helpers/fixtures.ts`. Without it the store is still in its
  // pre-snapshot state, which is not the state production reads from, so the
  // fallback branch exercised here would not be the one users hit.
  store.snapshotComplete();
  return store;
}

function run(): void {
  assertEqual(
    isReady(task({ assignees: [assignee] }), storeWith()),
    false,
    'fallback excludes assigned accepted tasks',
  );

  assertEqual(
    isReady(
      task({
        assignees: [assignee],
        availability: { available: true, reasons: [] },
      }),
      storeWith(),
    ),
    true,
    'explicit availability remains authoritative when present',
  );

  assertEqual(
    isReady(
      task({
        availability: { available: false, reasons: [] },
      }),
      storeWith(),
    ),
    false,
    'explicit unavailable availability remains authoritative when present',
  );

  assertEqual(
    isReady(task(), storeWith()),
    true,
    'fallback keeps unassigned accepted tasks eligible',
  );

  assertEqual(
    isReady(
      task({
        holdReason: TaskHoldReason.WAITING_FOR_INPUT,
      }),
      storeWith(),
    ),
    false,
    'fallback excludes held accepted tasks',
  );

  assertEqual(
    isReady(
      task({
        startDate: new Date(Date.now() + 60_000).toISOString(),
      }),
      storeWith(),
    ),
    false,
    'fallback excludes future-start accepted tasks',
  );

  assertEqual(
    isReady(
      task({
        stage: TaskStage.WORKING,
      }),
      storeWith(),
    ),
    false,
    'fallback excludes non-open tasks',
  );

  assertEqual(
    isReady(
      task({
        stage: TaskStage.TRIAGE,
      }),
      storeWith(),
    ),
    false,
    'fallback excludes non-accepted open tasks',
  );

  assertEqual(
    isReady(
      task({
        stage: TaskStage.COMPLETED,
      }),
      storeWith(),
    ),
    false,
    'fallback excludes terminal tasks',
  );

  assertEqual(
    isReady(
      task({
        relationships: [{
          type: RelationshipType.BLOCKED_BY,
          targetTaskId: 'blocker-1',
        }],
      }),
      storeWith(task({ id: 'blocker-1', stage: TaskStage.WORKING })),
    ),
    false,
    'fallback still excludes tasks with incomplete blockers',
  );

  console.log('task-ready tests passed');
}

run();
