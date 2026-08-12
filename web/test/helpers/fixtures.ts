import {
  IdentityStatus,
  Platform,
  TaskPhase,
  TaskPriority,
  TaskStage,
  UserType,
  type Task,
  type User,
} from '../../src/gen/types.js';
import { TaskStore } from '../../src/store/task-store.js';
import type {
  CloseTaskFields,
  CreateTaskFields,
  FarmTableServiceClient,
  UpdateTaskFields,
} from '../../src/gen/service.js';
import { applyTaskUpdateFields, phaseForStage } from '../../src/gen/service.js';
import { NATIVE_STAGE_OPTIONS } from '../../src/util/task-state-utils.js';

export const TEST_COLLECTION_ID = '00000000-0000-0000-0000-0000000000c1';

export function user(id: string, name = id): User {
  return { id, name, type: UserType.HUMAN, status: IdentityStatus.ACTIVE };
}

/**
 * Build a Task with contract-valid defaults. `phase` is derived from `stage`
 * unless explicitly overridden, so fixtures cannot silently encode a
 * stage/phase combination the server would never produce.
 */
export function task(overrides: Partial<Task> & { id: string }): Task {
  const stage = overrides.stage ?? TaskStage.ACCEPTED;
  return {
    name: `Task ${overrides.id}`,
    phase: phaseForStage(stage),
    priority: TaskPriority.NORMAL,
    assignees: [],
    labels: [],
    relationships: [],
    customFields: [],
    collectionId: TEST_COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: '2026-01-01T00:00:00.000Z',
    version: '1',
    ...overrides,
    stage,
  } as Task;
}

export function storeWith(...tasks: Task[]): TaskStore {
  const store = new TaskStore();
  for (const item of tasks) store.upsert(item);
  store.snapshotComplete();
  return store;
}

export interface UpdateTaskCall {
  id: string;
  fields: UpdateTaskFields;
}

export interface CloseTaskCall {
  id: string;
  fields: CloseTaskFields;
}

/**
 * A `FarmTableServiceClient` that records every `updateTask()` call so tests
 * can assert on the exact wire payload the UI produces.
 *
 * `rejectUpdateWith` makes the next (and every subsequent) `updateTask()`
 * reject, which is how server-side transition rejections reach the UI.
 *
 * Pass the store the component reads from so `updateTask()` can answer with the
 * *whole* updated task, the way the real server does: callers reconcile their
 * optimistic state from the response, and a partial answer would silently drop
 * every field the caller did not send.
 */
export class RecordingClient implements FarmTableServiceClient {
  readonly updateTaskCalls: UpdateTaskCall[] = [];
  readonly closeTaskCalls: CloseTaskCall[] = [];
  readonly createTaskCalls: CreateTaskFields[] = [];
  rejectUpdateWith: Error | null = null;
  rejectCloseWith: Error | null = null;

  constructor(private readonly source?: TaskStore) {}

  async listCollections() {
    return [];
  }

  async getCollection(id: string): Promise<never> {
    throw new Error(`Collection not found: ${id}`);
  }

  async createCollection(): Promise<never> {
    throw new Error('not implemented');
  }

  async updateCollection(): Promise<never> {
    throw new Error('not implemented');
  }

  async exportCollection() {
    return { data: new Uint8Array(), warnings: [] };
  }

  async importCollection(): Promise<never> {
    throw new Error('not implemented');
  }

  async listTasks(): Promise<Task[]> {
    return [];
  }

  async getTask(id: string): Promise<never> {
    throw new Error(`Task not found: ${id}`);
  }

  async createTask(fields: CreateTaskFields): Promise<Task> {
    this.createTaskCalls.push(fields);
    return task({ id: 'created', name: fields.name, stage: fields.stage ?? TaskStage.TRIAGE });
  }

  async updateTask(id: string, fields: UpdateTaskFields): Promise<Task> {
    this.updateTaskCalls.push({ id, fields });
    if (this.rejectUpdateWith) throw this.rejectUpdateWith;

    const current = this.source?.getTask(id) ?? task({ id });
    const updated = applyTaskUpdateFields(current, fields);
    // The server keeps the wire-only phase projection consistent with stage.
    const echoed = { ...updated, phase: phaseForStage(updated.stage) };
    return this.updateTaskResponse ? this.updateTaskResponse(echoed, { id, fields }) : echoed;
  }

  async closeTask(id: string, fields: CloseTaskFields): Promise<Task> {
    this.closeTaskCalls.push({ id, fields });
    if (this.rejectCloseWith) throw this.rejectCloseWith;

    const stage = fields.stage ?? TaskStage.COMPLETED;
    const current = this.source?.getTask(id) ?? task({ id });
    const updated = applyTaskUpdateFields(current, {
      stage,
      version: fields.version,
    });
    return { ...updated, phase: phaseForStage(updated.stage) };
  }

  /**
   * Rewrite the response so it DIVERGES from what the caller asked for.
   *
   * By default this client echoes the optimistic write straight back, which
   * makes "the view reconciled from the server response" and "the view kept
   * its own optimistic value" indistinguishable — a component that discarded
   * the response entirely would pass every reconciliation test. A real server
   * never echoes: it bumps `version`, and it may normalise or override the
   * value (rank collisions, stage side effects, server-side clamping).
   *
   * Set this to return a modified task and the assertion becomes real: only a
   * view that actually upserts the response can show the diverged value.
   */
  updateTaskResponse: ((echoed: Task, call: UpdateTaskCall) => Task) | null = null;

  async addComment(): Promise<never> {
    throw new Error('not implemented');
  }

  async listComments() {
    return [];
  }

  async listChanges() {
    return [];
  }

  async listUsers(): Promise<User[]> {
    return [];
  }

  async *watchTasks(): AsyncIterable<never> {
    // no events
  }
}

/** Stage vocabulary removed from the native model by the task-state contract. */
export const DELETED_STAGE_LABELS = ['Ready', 'Blocked', 'Backlog', 'Scheduled'] as const;

/**
 * The native stages the contract allows (design contract §4.1).
 *
 * DERIVED from production's `NATIVE_STAGE_OPTIONS`, not a second copy of the
 * list. This helper feeds "for every stage" sweeps across the suite; when it
 * was a hand-maintained array, adding a stage to the contract would make those
 * sweeps quietly stop covering it — the suite gets less thorough without
 * getting redder, which is the worst failure mode a test helper has.
 *
 * The membership of this list is anchored in `vocabulary.contract.test.ts`.
 */
export const NATIVE_STAGES: TaskStage[] = [...NATIVE_STAGE_OPTIONS];

export const ALL_TASK_PHASES: TaskPhase[] = [
  TaskPhase.UNSPECIFIED,
  TaskPhase.OPEN,
  TaskPhase.IN_PROGRESS,
  TaskPhase.ON_HOLD,
  TaskPhase.CLOSED,
];
