import { TaskStore } from '../store/task-store.js';
import {
  AvailabilityReason,
  Platform,
  RelationshipType,
  TaskHoldReason,
  TaskPhase,
  TaskPriority,
  TaskStage,
  type Task,
} from '../gen/types.js';
import { matchesTaskFilters } from '../components/task-filters.js';
import {
  attentionBlockers,
  compareAcceptedQueueOrder,
} from './task-state-utils.js';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertArray(actual: string[], expected: string[], message: string): void {
  const a = actual.join(',');
  const e = expected.join(',');
  if (a !== e) {
    throw new Error(`${message}: expected [${e}], got [${a}]`);
  }
}

const now = '2026-07-27T00:00:00.000Z';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Task',
    phase: TaskPhase.OPEN,
    stage: TaskStage.ACCEPTED,
    assignees: [],
    collectionId: 'collection-1',
    relationships: [],
    labels: [],
    customFields: [],
    platform: Platform.FARMTABLE,
    createdAt: now,
    version: '1',
    ...overrides,
  };
}

function storeWith(...tasks: Task[]): TaskStore {
  const store = new TaskStore();
  for (const item of tasks) {
    store.upsert(item);
  }
  return store;
}

function run(): void {
  const sorted = [
    task({ id: 'normal-rank-2', priority: TaskPriority.NORMAL, rank: 2, createdAt: '2026-07-27T00:00:01.000Z' }),
    task({ id: 'high-rank-9', priority: TaskPriority.HIGH, rank: 9, createdAt: '2026-07-27T00:00:01.000Z' }),
    task({ id: 'normal-rank-1', priority: TaskPriority.NORMAL, rank: 1, createdAt: '2026-07-27T00:00:03.000Z' }),
    task({ id: 'normal-unranked', priority: TaskPriority.NORMAL, createdAt: '2026-07-27T00:00:00.000Z' }),
    task({ id: 'urgent-unranked', priority: TaskPriority.URGENT, createdAt: '2026-07-27T00:00:04.000Z' }),
  ].sort(compareAcceptedQueueOrder);

  assertArray(
    sorted.map((item) => item.id),
    ['urgent-unranked', 'high-rank-9', 'normal-rank-1', 'normal-rank-2', 'normal-unranked'],
    'accepted queue order respects priority, then rank, then stable fallback',
  );

  assertEqual(
    matchesTaskFilters(
      task({ holdReason: TaskHoldReason.WAITING_FOR_INPUT }),
      'active',
      TaskStage.ACCEPTED,
      TaskHoldReason.WAITING_FOR_INPUT,
      'unavailable',
      null,
    ),
    false,
    'availability filter requires server-computed unavailable state',
  );

  assertEqual(
    matchesTaskFilters(
      task({
        holdReason: TaskHoldReason.WAITING_FOR_INPUT,
        availability: { available: false, reasons: [AvailabilityReason.HELD] },
      }),
      'active',
      TaskStage.ACCEPTED,
      TaskHoldReason.WAITING_FOR_INPUT,
      AvailabilityReason.HELD,
      null,
    ),
    true,
    'filters match active accepted held tasks by computed availability reason',
  );

  assertEqual(
    matchesTaskFilters(
      task({ stage: TaskStage.COMPLETED, phase: TaskPhase.CLOSED }),
      'active',
      null,
      null,
      null,
      null,
    ),
    false,
    'active group excludes terminal stages without using phase',
  );

  const blockedTask = task({
    id: 'dependent',
    availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: 'cancelled-blocker' }],
  });
  const blockers = attentionBlockers(
    blockedTask,
    storeWith(blockedTask, task({ id: 'cancelled-blocker', stage: TaskStage.CANCELLED, phase: TaskPhase.CLOSED })),
  );

  assertArray(
    blockers.map((item) => item.id),
    ['cancelled-blocker'],
    'attention workflow finds unsuccessful terminal prerequisites',
  );

  console.log('task-state-utils tests passed');
}

run();
