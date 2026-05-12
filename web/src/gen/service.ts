import {
  type Task,
  type Comment,
  type Change,
  type TaskEvent,
  TaskPhase,
  TaskStage,
  TaskPriority,
  TaskEventType,
  Platform,
  UserType,
  IdentityStatus,
} from './types.js';

export interface FarmTableServiceClient {
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  updateTask(id: string, fields: Partial<Task>): Promise<Task>;
  listComments(taskId: string): Promise<Comment[]>;
  listChanges(taskId: string): Promise<Change[]>;
  watchTasks(): AsyncIterable<TaskEvent>;
}

const COLLECTION_ID = '00000000-0000-0000-0000-000000000001';

const NOW = new Date().toISOString();

const MOCK_TASKS: Task[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for build, test, and deploy.',
    phase: TaskPhase.OPEN,
    stage: TaskStage.READY,
    priority: TaskPriority.HIGH,
    assignees: [{ id: 'u1', name: 'Alice', type: UserType.HUMAN, status: IdentityStatus.ACTIVE }],
    labels: ['infra'],
    relationships: [],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    version: '1',
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    name: 'Design database schema',
    description: 'Define Ent schema for tasks, users, and collections.',
    phase: TaskPhase.IN_PROGRESS,
    stage: TaskStage.WORKING,
    priority: TaskPriority.URGENT,
    assignees: [{ id: 'u2', name: 'Bob', type: UserType.HUMAN, status: IdentityStatus.ACTIVE }],
    labels: ['feature'],
    relationships: [],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    version: '2',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    name: 'Implement task CRUD API',
    description: 'gRPC endpoints for create, read, update, delete tasks.',
    phase: TaskPhase.OPEN,
    stage: TaskStage.BACKLOG,
    priority: TaskPriority.NORMAL,
    assignees: [],
    labels: ['feature'],
    relationships: [{ type: 2, targetTaskId: '10000000-0000-0000-0000-000000000002' }],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    parentTaskId: '10000000-0000-0000-0000-000000000010',
    createdAt: NOW,
    version: '1',
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    name: 'Write unit tests for store layer',
    phase: TaskPhase.OPEN,
    stage: TaskStage.TRIAGE,
    priority: TaskPriority.NORMAL,
    assignees: [],
    labels: ['test'],
    relationships: [],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    version: '1',
  },
  {
    id: '10000000-0000-0000-0000-000000000005',
    name: 'Build web dashboard UI',
    description: 'Lit + Shoelace kanban board for task visualization.',
    phase: TaskPhase.IN_PROGRESS,
    stage: TaskStage.IN_REVIEW,
    priority: TaskPriority.HIGH,
    assignees: [
      { id: 'u1', name: 'Alice', type: UserType.HUMAN, status: IdentityStatus.ACTIVE },
      { id: 'u3', name: 'Agent-7', type: UserType.AGENT, status: IdentityStatus.ACTIVE },
    ],
    labels: ['feature'],
    relationships: [],
    customFields: [],
    codeContext: {
      repo: 'farmtable/farmtable',
      branch: 'feat/web-dashboard',
      pullRequests: [{ id: 'pr-42', url: 'https://github.com/farmtable/farmtable/pull/42', status: 1 }],
      commitShas: ['abc1234'],
    },
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    parentTaskId: '10000000-0000-0000-0000-000000000010',
    createdAt: NOW,
    version: '3',
  },
  {
    id: '10000000-0000-0000-0000-000000000006',
    name: 'Fix login redirect loop',
    description: 'OAuth callback redirects back to login page indefinitely.',
    phase: TaskPhase.ON_HOLD,
    stage: TaskStage.BLOCKED,
    priority: TaskPriority.URGENT,
    assignees: [{ id: 'u2', name: 'Bob', type: UserType.HUMAN, status: IdentityStatus.ACTIVE }],
    labels: ['bug'],
    relationships: [{ type: 1, targetTaskId: '10000000-0000-0000-0000-000000000001' }],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    version: '1',
  },
  {
    id: '10000000-0000-0000-0000-000000000007',
    name: 'Add pagination to list endpoints',
    phase: TaskPhase.IN_PROGRESS,
    stage: TaskStage.IN_QA,
    priority: TaskPriority.LOW,
    assignees: [{ id: 'u3', name: 'Agent-7', type: UserType.AGENT, status: IdentityStatus.ACTIVE }],
    labels: ['feature'],
    relationships: [],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    version: '2',
  },
  {
    id: '10000000-0000-0000-0000-000000000008',
    name: 'Document API with OpenAPI spec',
    phase: TaskPhase.CLOSED,
    stage: TaskStage.COMPLETED,
    priority: TaskPriority.NORMAL,
    assignees: [{ id: 'u1', name: 'Alice', type: UserType.HUMAN, status: IdentityStatus.ACTIVE }],
    labels: ['docs'],
    relationships: [],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    closedAt: NOW,
    version: '4',
  },
  {
    id: '10000000-0000-0000-0000-000000000009',
    name: 'Refactor error handling middleware',
    phase: TaskPhase.IN_PROGRESS,
    stage: TaskStage.DEPLOYING,
    priority: TaskPriority.NORMAL,
    assignees: [{ id: 'u2', name: 'Bob', type: UserType.HUMAN, status: IdentityStatus.ACTIVE }],
    labels: ['refactor'],
    relationships: [],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    version: '2',
  },
  {
    id: '10000000-0000-0000-0000-000000000010',
    name: 'Platform MVP',
    description: 'Epic: all work needed for the initial launch.',
    type: 'epic',
    phase: TaskPhase.IN_PROGRESS,
    stage: TaskStage.WORKING,
    priority: TaskPriority.HIGH,
    assignees: [],
    labels: ['feature'],
    relationships: [],
    customFields: [],
    collectionId: COLLECTION_ID,
    platform: Platform.FARMTABLE,
    createdAt: NOW,
    version: '1',
  },
];

export class MockFarmTableClient implements FarmTableServiceClient {
  async listTasks(): Promise<Task[]> {
    return [...MOCK_TASKS];
  }

  async getTask(id: string): Promise<Task> {
    const task = MOCK_TASKS.find((t) => t.id === id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return { ...task };
  }

  async updateTask(id: string, fields: Partial<Task>): Promise<Task> {
    const task = MOCK_TASKS.find((t) => t.id === id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return { ...task, ...fields };
  }

  async listComments(): Promise<Comment[]> {
    return [];
  }

  async listChanges(): Promise<Change[]> {
    return [];
  }

  async *watchTasks(): AsyncIterable<TaskEvent> {
    let seq = 0n;
    const now = new Date().toISOString();

    for (const task of MOCK_TASKS) {
      yield {
        task,
        eventType: TaskEventType.INITIAL,
        changes: [],
        timestamp: now,
        sequence: ++seq,
      };
      await delay(50);
    }

    yield {
      task: MOCK_TASKS[0],
      eventType: TaskEventType.SNAPSHOT_COMPLETE,
      changes: [],
      timestamp: now,
      sequence: ++seq,
    };

    while (true) {
      await delay(5000);
      const randomTask = MOCK_TASKS[Math.floor(Math.random() * MOCK_TASKS.length)];
      yield {
        task: { ...randomTask, updatedAt: new Date().toISOString() },
        eventType: TaskEventType.UPDATED,
        changes: [],
        timestamp: new Date().toISOString(),
        sequence: ++seq,
      };
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
