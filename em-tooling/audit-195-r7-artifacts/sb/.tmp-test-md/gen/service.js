import { TaskPhase, TaskStage, TaskPriority, TaskEventType, Platform, RelationshipType, UserType, IdentityStatus, } from './types.js';
export function applyTaskUpdateFields(task, fields) {
    const { parentTaskId, dueDate, startDate, addLabels, removeLabels, assigneeIds, clearAssignees, addBlocks, addBlockedBy, removeRelationships, ...rest } = fields;
    const updated = { ...task, ...rest };
    if (parentTaskId === null) {
        delete updated.parentTaskId;
    }
    else if (parentTaskId !== undefined) {
        updated.parentTaskId = parentTaskId;
    }
    if (dueDate === null) {
        delete updated.dueDate;
    }
    else if (dueDate !== undefined) {
        updated.dueDate = dueDate;
    }
    if (startDate === null) {
        delete updated.startDate;
    }
    else if (startDate !== undefined) {
        updated.startDate = startDate;
    }
    // addLabels is applied before removeLabels — order matters if both are present.
    if (addLabels !== undefined) {
        const labels = new Set(updated.labels);
        for (const label of addLabels) {
            labels.add(label);
        }
        updated.labels = [...labels];
    }
    if (removeLabels !== undefined) {
        const labelsToRemove = new Set(removeLabels);
        updated.labels = (updated.labels ?? []).filter((label) => !labelsToRemove.has(label));
    }
    if (clearAssignees) {
        updated.assignees = [];
    }
    else if (assigneeIds !== undefined) {
        const existingById = new Map(task.assignees.map((u) => [u.id, u]));
        updated.assignees = assigneeIds.map((id) => existingById.get(id) ?? {
            id,
            name: id,
            type: UserType.HUMAN,
            status: IdentityStatus.ACTIVE,
        });
    }
    // Relationship mutations — addBlocks/addBlockedBy first, then removeRelationships.
    if (addBlocks !== undefined) {
        const existing = new Set(updated.relationships
            .filter((r) => r.type === RelationshipType.BLOCKS)
            .map((r) => r.targetTaskId));
        const toAdd = addBlocks
            .filter((id) => !existing.has(id))
            .map((id) => ({ type: RelationshipType.BLOCKS, targetTaskId: id }));
        if (toAdd.length) {
            updated.relationships = [...updated.relationships, ...toAdd];
        }
    }
    if (addBlockedBy !== undefined) {
        const existing = new Set(updated.relationships
            .filter((r) => r.type === RelationshipType.BLOCKED_BY)
            .map((r) => r.targetTaskId));
        const toAdd = addBlockedBy
            .filter((id) => !existing.has(id))
            .map((id) => ({ type: RelationshipType.BLOCKED_BY, targetTaskId: id }));
        if (toAdd.length) {
            updated.relationships = [...updated.relationships, ...toAdd];
        }
    }
    if (removeRelationships !== undefined) {
        const toRemove = new Set(removeRelationships);
        updated.relationships = updated.relationships.filter((r) => !toRemove.has(r.targetTaskId));
    }
    return updated;
}
const COLLECTION_ID = '00000000-0000-0000-0000-000000000001';
const NOW = new Date().toISOString();
const MOCK_COLLECTIONS = [
    {
        id: COLLECTION_ID,
        name: 'Farm Table',
        platform: Platform.FARMTABLE,
        statusMappings: [],
        customFieldDefinitions: [],
        createdAt: NOW,
    },
];
export function phaseForStage(stage) {
    switch (stage) {
        case TaskStage.TRIAGE:
        case TaskStage.ACCEPTED:
            return TaskPhase.OPEN;
        case TaskStage.WORKING:
        case TaskStage.IN_REVIEW:
        case TaskStage.IN_QA:
        case TaskStage.DEPLOYING:
            return TaskPhase.IN_PROGRESS;
        case TaskStage.COMPLETED:
        case TaskStage.WONT_FIX:
        case TaskStage.DUPLICATE:
        case TaskStage.CANCELLED:
            return TaskPhase.CLOSED;
        default:
            return TaskPhase.UNSPECIFIED;
    }
}
const MOCK_TASKS = [
    {
        id: '10000000-0000-0000-0000-000000000001',
        name: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for build, test, and deploy.',
        phase: TaskPhase.OPEN,
        stage: TaskStage.ACCEPTED,
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
        stage: TaskStage.ACCEPTED,
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
        stage: TaskStage.ACCEPTED,
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
const MOCK_USERS = {
    u1: { id: 'u1', name: 'Alice', type: UserType.HUMAN, status: IdentityStatus.ACTIVE },
    u2: { id: 'u2', name: 'Bob', type: UserType.HUMAN, status: IdentityStatus.ACTIVE },
    u3: { id: 'u3', name: 'Agent-7', type: UserType.AGENT, status: IdentityStatus.ACTIVE },
};
const MOCK_COMMENTS = {
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
const MOCK_CHANGES = {
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
export class MockFarmTableClient {
    async listCollections() {
        return MOCK_COLLECTIONS.map((collection) => ({ ...collection }));
    }
    async getCollection(id) {
        const collection = MOCK_COLLECTIONS.find((item) => item.id === id);
        if (!collection)
            throw new Error(`Collection not found: ${id}`);
        return { ...collection };
    }
    async createCollection(name, opts) {
        const collection = {
            id: crypto.randomUUID(),
            name,
            platform: Platform.FARMTABLE,
            statusMappings: [],
            customFieldDefinitions: [],
            createdAt: new Date().toISOString(),
        };
        MOCK_COLLECTIONS.unshift(collection);
        return { ...collection };
    }
    async updateCollection(id, fields) {
        const collectionIndex = MOCK_COLLECTIONS.findIndex((item) => item.id === id);
        const collection = MOCK_COLLECTIONS[collectionIndex];
        if (!collection)
            throw new Error(`Collection not found: ${id}`);
        const updated = { ...collection, ...fields, updatedAt: new Date().toISOString() };
        MOCK_COLLECTIONS[collectionIndex] = updated;
        return { ...updated };
    }
    async exportCollection(_id, _includeChanges) {
        return { data: new TextEncoder().encode('{}'), warnings: [] };
    }
    async importCollection(_data, _name, _dryRun) {
        return {
            collectionId: crypto.randomUUID(),
            stats: { usersMatched: 0, usersCreated: 0, tasks: 0, comments: 0, relationships: 0, changes: 0 },
            warnings: [],
        };
    }
    async listTasks() {
        return [...MOCK_TASKS];
    }
    async getTask(id) {
        const task = MOCK_TASKS.find((t) => t.id === id);
        if (!task)
            throw new Error(`Task not found: ${id}`);
        return { ...task };
    }
    async createTask(fields) {
        const stage = fields.stage ?? TaskStage.TRIAGE;
        const task = {
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
    async updateTask(id, fields) {
        const taskIndex = MOCK_TASKS.findIndex((t) => t.id === id);
        const task = MOCK_TASKS[taskIndex];
        if (!task)
            throw new Error(`Task not found: ${id}`);
        const updated = applyTaskUpdateFields(task, fields);
        MOCK_TASKS[taskIndex] = updated;
        return updated;
    }
    async listUsers() {
        return Object.values(MOCK_USERS);
    }
    async addComment(taskId, body) {
        await delay(300);
        const comment = {
            id: crypto.randomUUID(),
            taskId,
            author: MOCK_USERS.u1,
            body,
            attachments: [],
            createdAt: new Date().toISOString(),
        };
        MOCK_COMMENTS[taskId] = [...(MOCK_COMMENTS[taskId] ?? []), comment];
        return { ...comment };
    }
    async listComments(taskId) {
        await delay(300);
        return MOCK_COMMENTS[taskId] ?? [];
    }
    async listChanges(taskId) {
        await delay(300);
        return MOCK_CHANGES[taskId] ?? [];
    }
    async *watchTasks(signal) {
        let seq = 0n;
        const now = new Date().toISOString();
        for (const task of MOCK_TASKS) {
            if (signal?.aborted)
                return;
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
            if (signal?.aborted)
                return;
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
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=service.js.map