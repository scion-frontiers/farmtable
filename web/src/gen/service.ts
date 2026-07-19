import {
  type Task,
  type Comment,
  type Change,
  type TaskEvent,
  type User,
  TaskPhase,
  TaskStage,
  TaskPriority,
  TaskEventType,
  Platform,
  UserType,
  IdentityStatus,
} from './types.js';

export type UpdateTaskFields = Omit<Partial<Task>, 'parentTaskId' | 'dueDate' | 'startDate'> & {
  parentTaskId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
};
export interface CreateTaskFields {
  name: string;
  description?: string;
  stage?: TaskStage;
}

export interface FarmTableServiceClient {
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  createTask(fields: CreateTaskFields): Promise<Task>;
  updateTask(id: string, fields: UpdateTaskFields): Promise<Task>;
  listComments(taskId: string): Promise<Comment[]>;
  listChanges(taskId: string): Promise<Change[]>;
  watchTasks(signal?: AbortSignal): AsyncIterable<TaskEvent>;
}

const COLLECTION_ID = '00000000-0000-0000-0000-000000000001';

const NOW = new Date().toISOString();

export function phaseForStage(stage: TaskStage): TaskPhase {
  switch (stage) {
    case TaskStage.TRIAGE:
    case TaskStage.BACKLOG:
    case TaskStage.READY:
      return TaskPhase.OPEN;
    case TaskStage.WORKING:
    case TaskStage.IN_REVIEW:
    case TaskStage.IN_QA:
    case TaskStage.DEPLOYING:
      return TaskPhase.IN_PROGRESS;
    case TaskStage.BLOCKED:
    case TaskStage.WAITING_FOR_INPUT:
    case TaskStage.DEFERRED:
    case TaskStage.SCHEDULED:
      return TaskPhase.ON_HOLD;
    case TaskStage.COMPLETED:
    case TaskStage.WONT_FIX:
    case TaskStage.DUPLICATE:
    case TaskStage.CANCELLED:
      return TaskPhase.CLOSED;
    default:
      return TaskPhase.UNSPECIFIED;
  }
}

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

const MOCK_USERS: Record<string, User> = {
  u1: { id: 'u1', name: 'Alice', type: UserType.HUMAN, status: IdentityStatus.ACTIVE },
  u2: { id: 'u2', name: 'Bob', type: UserType.HUMAN, status: IdentityStatus.ACTIVE },
  u3: { id: 'u3', name: 'Agent-7', type: UserType.AGENT, status: IdentityStatus.ACTIVE },
};

const MOCK_COMMENTS: Record<string, Comment[]> = {
  '10000000-0000-0000-0000-000000000001': [
    {
      id: 'c1', taskId: '10000000-0000-0000-0000-000000000001',
      author: MOCK_USERS.u1, body: 'Should we use GitHub Actions or GitLab CI? I lean toward **GitHub Actions** since the repo is already on GitHub.',
      attachments: [], createdAt: NOW,
    },
    {
      id: 'c2', taskId: '10000000-0000-0000-0000-000000000001',
      author: MOCK_USERS.u2, body: 'Agreed. Let\'s start with a simple `build → test → deploy` pipeline.',
      attachments: [], createdAt: NOW,
    },
  ],
  '10000000-0000-0000-0000-000000000002': [
    {
      id: 'c3', taskId: '10000000-0000-0000-0000-000000000002',
      author: MOCK_USERS.u2, body: 'Schema draft is ready for review. Using Ent with SQLite for local dev and Postgres for production.',
      attachments: [], createdAt: NOW,
    },
  ],
  '10000000-0000-0000-0000-000000000005': [
    {
      id: 'c4', taskId: '10000000-0000-0000-0000-000000000005',
      author: MOCK_USERS.u3, body: 'Kanban view is functional. Working on drag-and-drop stage transitions next.',
      attachments: [], createdAt: NOW,
    },
    {
      id: 'c5', taskId: '10000000-0000-0000-0000-000000000005',
      author: MOCK_USERS.u1, body: 'Looks great! Can we also add a tree view for the hierarchy?',
      attachments: [], createdAt: NOW,
    },
    {
      id: 'c6', taskId: '10000000-0000-0000-0000-000000000005',
      author: MOCK_USERS.u3, body: 'Sure, I\'ll add that as a follow-up.\n\n- [x] Kanban board\n- [ ] Tree view\n- [ ] Inspector panel',
      attachments: [], createdAt: NOW,
    },
  ],
};

const MOCK_CHANGES: Record<string, Change[]> = {
  '10000000-0000-0000-0000-000000000002': [
    {
      id: 'ch1', taskId: '10000000-0000-0000-0000-000000000002',
      field: 'stage', oldValue: 'Ready', newValue: 'Working',
      changedBy: MOCK_USERS.u2, changedAt: NOW,
    },
    {
      id: 'ch2', taskId: '10000000-0000-0000-0000-000000000002',
      field: 'priority', oldValue: 'High', newValue: 'Urgent',
      changedBy: MOCK_USERS.u1, changedAt: NOW,
    },
  ],
  '10000000-0000-0000-0000-000000000005': [
    {
      id: 'ch3', taskId: '10000000-0000-0000-0000-000000000005',
      field: 'stage', oldValue: 'Working', newValue: 'In Review',
      changedBy: MOCK_USERS.u3, changedAt: NOW,
    },
    {
      id: 'ch4', taskId: '10000000-0000-0000-0000-000000000005',
      field: 'assignees', oldValue: 'Alice', newValue: 'Alice, Agent-7',
      changedBy: MOCK_USERS.u1, changedAt: NOW,
    },
  ],
  '10000000-0000-0000-0000-000000000006': [
    {
      id: 'ch5', taskId: '10000000-0000-0000-0000-000000000006',
      field: 'stage', oldValue: 'Working', newValue: 'Blocked',
      changedBy: MOCK_USERS.u2, changedAt: NOW,
    },
  ],
};

export class MockFarmTableClient implements FarmTableServiceClient {
  async listTasks(): Promise<Task[]> {
    return [...MOCK_TASKS];
  }

  async getTask(id: string): Promise<Task> {
    const task = MOCK_TASKS.find((t) => t.id === id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return { ...task };
  }

  async createTask(fields: CreateTaskFields): Promise<Task> {
    const stage = fields.stage ?? TaskStage.TRIAGE;
    const task: Task = {
      id: crypto.randomUUID(),
      name: fields.name,
      description: fields.description,
      phase: phaseForStage(stage),
      stage,
      priority: TaskPriority.NORMAL,
      assignees: [],
      labels: [],
      relationships: [],
      customFields: [],
      collectionId: COLLECTION_ID,
      platform: Platform.FARMTABLE,
      createdAt: new Date().toISOString(),
      version: '1',
    };
    MOCK_TASKS.unshift(task);
    return { ...task };
  }

  async updateTask(id: string, fields: UpdateTaskFields): Promise<Task> {
    const taskIndex = MOCK_TASKS.findIndex((t) => t.id === id);
    const task = MOCK_TASKS[taskIndex];
    if (!task) throw new Error(`Task not found: ${id}`);
    const { parentTaskId, dueDate, startDate, ...rest } = fields;
    const updated: Task = { ...task, ...rest };
    if (parentTaskId === null) {
      delete updated.parentTaskId;
    } else if (parentTaskId !== undefined) {
      updated.parentTaskId = parentTaskId;
    }
    if (dueDate === null) {
      delete updated.dueDate;
    } else if (dueDate !== undefined) {
      updated.dueDate = dueDate;
    }
    if (startDate === null) {
      delete updated.startDate;
    } else if (startDate !== undefined) {
      updated.startDate = startDate;
    }
    MOCK_TASKS[taskIndex] = updated;
    return updated;
  }

  async listComments(taskId: string): Promise<Comment[]> {
    await delay(300);
    return MOCK_COMMENTS[taskId] ?? [];
  }

  async listChanges(taskId: string): Promise<Change[]> {
    await delay(300);
    return MOCK_CHANGES[taskId] ?? [];
  }

  async *watchTasks(signal?: AbortSignal): AsyncIterable<TaskEvent> {
    let seq = 0n;
    const now = new Date().toISOString();

    for (const task of MOCK_TASKS) {
      if (signal?.aborted) return;
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

    while (!signal?.aborted) {
      await delay(5000);
      if (signal?.aborted) return;
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
