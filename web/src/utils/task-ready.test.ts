import { TaskStore } from '../store/task-store.js';
import {
  RelationshipType,
  TaskPhase,
  TaskStage,
  Platform,
  type Task,
  type User,
} from '../gen/types.js';
import { isReady } from './task-ready.js';

function assertEqual(actual: boolean, expected: boolean, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const now = new Date('2026-07-27T00:00:00.000Z').toISOString();

const assignee: User = {
  id: 'user-1',
  name: 'Assigned User',
  type: 1,
  status: 1,
};

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
    isReady(task(), storeWith()),
    true,
    'fallback keeps unassigned accepted tasks eligible',
  );

  assertEqual(
    isReady(
      task({
        relationships: [{
          type: RelationshipType.BLOCKED_BY,
          targetTaskId: 'blocker-1',
        }],
      }),
      storeWith(task({ id: 'blocker-1', stage: TaskStage.WORKING, phase: TaskPhase.IN_PROGRESS })),
    ),
    false,
    'fallback still excludes tasks with incomplete blockers',
  );
}

run();
