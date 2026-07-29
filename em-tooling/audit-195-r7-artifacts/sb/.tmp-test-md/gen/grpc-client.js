import { grpc } from '@improbable-eng/grpc-web';
import protobuf from 'protobufjs';
import farmtableDescriptor from './farmtable.json';
import { GrpcError } from '../util/grpc-error.js';
import { SortOrder, } from './types.js';
export { GrpcError } from '../util/grpc-error.js';
const SERVICE_NAME = 'farmtable.v1.FarmTableService';
const DEFAULT_COLLECTION_ID = '00000000-0000-0000-0000-000000000001';
const root = protobuf.Root.fromJSON(farmtableDescriptor);
class ProtoMessage {
    constructor(type, value = type.create()) {
        this.type = type;
        this.value = value;
    }
    serializeBinary() {
        const err = this.type.verify(this.value);
        if (err)
            throw new Error(`${this.type.fullName}: ${err}`);
        return this.type.encode(this.value).finish();
    }
    toObject() {
        return this.type.toObject(this.value, {
            defaults: false,
            longs: String,
            enums: Number,
        });
    }
}
function messageClass(typeName) {
    const type = root.lookupType(`farmtable.v1.${typeName}`);
    return class extends ProtoMessage {
        constructor(value) {
            const message = value && '$type' in value
                ? value
                : type.create(value ?? {});
            super(type, message);
        }
        static create(value) {
            return new this(value);
        }
        static deserializeBinary(bytes) {
            return new this(type.decode(bytes));
        }
    };
}
function unaryMethod(methodName, requestTypeName, responseTypeName) {
    return {
        methodName,
        service: { serviceName: SERVICE_NAME },
        requestStream: false,
        responseStream: false,
        requestType: messageClass(requestTypeName),
        responseType: messageClass(responseTypeName),
    };
}
function streamMethod(methodName, requestTypeName, responseTypeName) {
    return {
        methodName,
        service: { serviceName: SERVICE_NAME },
        requestStream: false,
        responseStream: true,
        requestType: messageClass(requestTypeName),
        responseType: messageClass(responseTypeName),
    };
}
const methods = {
    listTasks: unaryMethod('ListTasks', 'ListTasksRequest', 'ListTasksResponse'),
    getTask: unaryMethod('GetTask', 'GetTaskRequest', 'GetTaskResponse'),
    createTask: unaryMethod('CreateTask', 'CreateTaskRequest', 'Task'),
    updateTask: unaryMethod('UpdateTask', 'UpdateTaskRequest', 'Task'),
    addComment: unaryMethod('AddComment', 'AddCommentRequest', 'Comment'),
    listComments: unaryMethod('ListComments', 'ListCommentsRequest', 'ListCommentsResponse'),
    listChanges: unaryMethod('ListChanges', 'ListChangesRequest', 'ListChangesResponse'),
    listCollections: unaryMethod('ListCollections', 'ListCollectionsRequest', 'ListCollectionsResponse'),
    getCollection: unaryMethod('GetCollection', 'GetCollectionRequest', 'Collection'),
    createCollection: unaryMethod('CreateCollection', 'CreateCollectionRequest', 'Collection'),
    updateCollection: unaryMethod('UpdateCollection', 'UpdateCollectionRequest', 'Collection'),
    exportCollection: unaryMethod('ExportCollection', 'ExportCollectionRequest', 'ExportCollectionResponse'),
    importCollection: unaryMethod('ImportCollection', 'ImportCollectionRequest', 'ImportCollectionResponse'),
    listUsers: unaryMethod('ListUsers', 'ListUsersRequest', 'ListUsersResponse'),
    watchTasks: streamMethod('WatchTasks', 'WatchTasksRequest', 'TaskEvent'),
};
export class GrpcFarmTableClient {
    constructor(options = {}) {
        this.serverUrl = options.serverUrl ?? window.location.origin;
        this.token = options.token ?? '';
        this.collectionId = options.collectionId;
    }
    async listCollections() {
        const response = await this.unary(methods.listCollections, { pageSize: 200 });
        return asArray(response.items).map((item) => toCollection(asRecord(item)));
    }
    async getCollection(id) {
        const response = await this.unary(methods.getCollection, { id });
        return toCollection(response);
    }
    async createCollection(name, opts) {
        const response = await this.unary(methods.createCollection, { name, ...opts });
        return toCollection(response);
    }
    async updateCollection(id, fields) {
        const response = await this.unary(methods.updateCollection, { id, ...fields });
        return toCollection(response);
    }
    async exportCollection(id, includeChanges = false) {
        const response = await this.unary(methods.exportCollection, { id, includeChanges });
        let data;
        if (response.data instanceof Uint8Array) {
            data = response.data;
        }
        else if (typeof response.data === 'string') {
            const binary = atob(response.data);
            data = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                data[i] = binary.charCodeAt(i);
            }
        }
        else {
            data = new Uint8Array();
        }
        return {
            data,
            warnings: asArray(response.warnings).map(stringField),
        };
    }
    async importCollection(data, name, dryRun = false) {
        const request = {
            data,
            dryRun,
        };
        if (name !== undefined) {
            request.name = name;
        }
        const response = await this.unary(methods.importCollection, request);
        const statsRecord = asRecord(response.stats);
        return {
            collectionId: stringField(response.collectionId),
            stats: {
                usersMatched: numberField(statsRecord.usersMatched),
                usersCreated: numberField(statsRecord.usersCreated),
                tasks: numberField(statsRecord.tasks),
                comments: numberField(statsRecord.comments),
                relationships: numberField(statsRecord.relationships),
                changes: numberField(statsRecord.changes),
            },
            warnings: asArray(response.warnings).map(stringField),
        };
    }
    async listTasks() {
        const collectionId = await this.resolveCollectionId();
        const response = await this.unary(methods.listTasks, {
            collectionId,
            full: true,
            pageSize: 200,
        });
        return asArray(response.items).map((item) => toTask(asRecord(item)));
    }
    async getTask(id) {
        const response = await this.unary(methods.getTask, {
            id,
            includeComments: false,
            includeChanges: false,
            collectionId: await this.resolveCollectionId(),
        });
        return toTask(asRecord(response.task));
    }
    async createTask(fields) {
        const request = {
            name: fields.name,
            collectionId: await this.resolveCollectionId(),
        };
        if (fields.description !== undefined)
            request.description = fields.description;
        if (fields.stage !== undefined)
            request.stage = fields.stage;
        const response = await this.unary(methods.createTask, request);
        return toTask(response);
    }
    async updateTask(id, fields) {
        const request = { id };
        if (fields.name !== undefined)
            request.name = fields.name;
        if (fields.description !== undefined)
            request.description = fields.description;
        if (fields.acceptanceCriteria !== undefined)
            request.acceptanceCriteria = fields.acceptanceCriteria;
        if (fields.stage !== undefined)
            request.stage = fields.stage;
        if (fields.priority !== undefined)
            request.priority = fields.priority;
        if (fields.type !== undefined)
            request.type = fields.type;
        if (fields.dueDate === null) {
            request.clearDueDate = true;
        }
        else if (fields.dueDate !== undefined) {
            request.dueDate = timestampFromIso(fields.dueDate);
        }
        if (fields.startDate === null) {
            request.clearStartDate = true;
        }
        else if (fields.startDate !== undefined) {
            request.startDate = timestampFromIso(fields.startDate);
        }
        if (fields.parentTaskId === null) {
            request.clearParent = true;
        }
        else if (fields.parentTaskId !== undefined) {
            request.parentTaskId = fields.parentTaskId;
        }
        // Empty arrays are intentionally skipped — the proto treats empty repeated fields as no-ops.
        if (fields.addLabels?.length)
            request.addLabels = fields.addLabels;
        if (fields.removeLabels?.length)
            request.removeLabels = fields.removeLabels;
        if (fields.assigneeIds?.length)
            request.assigneeIds = fields.assigneeIds;
        if (fields.clearAssignees)
            request.clearAssignees = true;
        if (fields.addBlocks?.length)
            request.addBlocks = fields.addBlocks;
        if (fields.addBlockedBy?.length)
            request.addBlockedBy = fields.addBlockedBy;
        if (fields.removeRelationships?.length)
            request.removeRelationships = fields.removeRelationships;
        if (fields.version !== undefined)
            request.version = fields.version;
        const response = await this.unary(methods.updateTask, request);
        return toTask(response);
    }
    async listUsers() {
        const response = await this.unary(methods.listUsers, { pageSize: 200 });
        return asArray(response.items).map((item) => toUser(asRecord(item)));
    }
    async listComments(taskId) {
        const response = await this.unary(methods.listComments, {
            taskId,
            pageSize: 200,
            order: SortOrder.DESC,
        });
        return asArray(response.items).map((item) => toComment(asRecord(item)));
    }
    async addComment(taskId, body) {
        const response = await this.unary(methods.addComment, { taskId, body });
        return toComment(response);
    }
    async listChanges(taskId) {
        const response = await this.unary(methods.listChanges, { taskId, pageSize: 200 });
        return asArray(response.items).map((item) => toChange(asRecord(item)));
    }
    async *watchTasks(signal) {
        const collectionId = await this.resolveCollectionId();
        const queue = [];
        let notify = null;
        let done = false;
        let error = null;
        const wake = () => {
            notify?.();
            notify = null;
        };
        const request = grpc.invoke(methods.watchTasks, {
            host: this.serverUrl,
            request: messageClass('WatchTasksRequest').create({
                collectionId,
                includeInitial: true,
            }),
            metadata: this.metadata(),
            onMessage: (message) => {
                queue.push(toTaskEvent(message.toObject()));
                wake();
            },
            onEnd: (code, message) => {
                done = true;
                if (code !== grpc.Code.OK && code !== grpc.Code.Canceled) {
                    error = new GrpcError(code, message || `gRPC stream failed with code ${code}`);
                }
                wake();
            },
        });
        const abort = () => request.close();
        signal?.addEventListener('abort', abort, { once: true });
        try {
            while (!done || queue.length > 0) {
                const event = queue.shift();
                if (event) {
                    yield event;
                    continue;
                }
                if (error)
                    throw error;
                if (done)
                    break;
                await new Promise((resolve) => {
                    notify = resolve;
                });
            }
            if (error)
                throw error;
        }
        finally {
            signal?.removeEventListener('abort', abort);
            request.close();
        }
    }
    async resolveCollectionId() {
        if (this.collectionId)
            return this.collectionId;
        const response = await this.unary(methods.listCollections, { pageSize: 1 });
        const firstCollection = asArray(response.items)[0];
        this.collectionId = stringField(asRecord(firstCollection).id) || DEFAULT_COLLECTION_ID;
        return this.collectionId;
    }
    unary(methodDescriptor, request) {
        return new Promise((resolve, reject) => {
            grpc.unary(methodDescriptor, {
                host: this.serverUrl,
                request: methodDescriptor.requestType.create(request),
                metadata: this.metadata(),
                onEnd: (output) => {
                    if (output.status !== grpc.Code.OK) {
                        reject(new GrpcError(output.status, output.statusMessage || `gRPC request failed with code ${output.status}`));
                        return;
                    }
                    if (!output.message) {
                        reject(new Error(`${methodDescriptor.methodName} returned no response message`));
                        return;
                    }
                    resolve(output.message.toObject());
                },
            });
        });
    }
    metadata() {
        if (!this.token)
            return undefined;
        return {
            Authorization: `Bearer ${this.token}`,
            'X-Farmtable-Token': this.token,
        };
    }
}
export function createGrpcFarmTableClient() {
    return createGrpcFarmTableClientWithOptions();
}
export function createGrpcFarmTableClientWithOptions(options = {}) {
    const globalConfig = window;
    const params = new URLSearchParams(window.location.search);
    // Token resolution: window global > localStorage fallback (dev/testing).
    // URL ?token= parameter has been removed for security — tokens in URLs
    // leak in browser history, server logs, and referrer headers.
    // The primary auth path is now session cookies (POST /api/auth/session).
    const token = globalConfig.FARMTABLE_TOKEN ?? localStorage.getItem('farmtable.token') ?? '';
    const storedCollectionId = options.readStoredCollectionId === false
        ? undefined
        : globalConfig.FARMTABLE_COLLECTION_ID ?? localStorage.getItem('farmtable.collectionId') ?? undefined;
    const urlCollectionId = params.get('collection') ?? undefined;
    // Precedence: explicit option > URL ?collection= param > stored global/localStorage.
    const collectionId = options.collectionId === null
        ? undefined
        : options.collectionId ?? urlCollectionId ?? storedCollectionId;
    return new GrpcFarmTableClient({
        serverUrl: globalConfig.FARMTABLE_SERVER_URL ?? window.location.origin,
        token,
        collectionId,
    });
}
function toTask(record) {
    return {
        id: stringField(record.id),
        name: stringField(record.name),
        description: optionalString(record.description),
        acceptanceCriteria: optionalString(record.acceptanceCriteria),
        phase: numberField(record.phase),
        stage: numberField(record.stage),
        nativeStatus: optionalString(record.nativeStatus),
        type: optionalString(record.type),
        priority: optionalNumber(record.priority),
        assignees: asArray(record.assignees).map((item) => toUser(asRecord(item))),
        creator: record.creator ? toUser(asRecord(record.creator)) : undefined,
        startDate: timestampToIso(record.startDate),
        dueDate: timestampToIso(record.dueDate),
        collectionId: stringField(record.collectionId),
        parentTaskId: optionalString(record.parentTaskId),
        relationships: asArray(record.relationships).map((item) => toRelationship(asRecord(item))),
        labels: asArray(record.labels).map(stringField),
        customFields: asArray(record.customFields).map((item) => toCustomFieldValue(asRecord(item))),
        codeContext: record.codeContext ? toCodeContext(asRecord(record.codeContext)) : undefined,
        remoteId: optionalString(record.remoteId),
        remoteUrl: optionalString(record.remoteUrl),
        remoteData: record.remoteData ? structToRecord(asRecord(record.remoteData)) : undefined,
        platform: numberField(record.platform),
        createdAt: timestampToIso(record.createdAt) ?? '',
        updatedAt: timestampToIso(record.updatedAt),
        closedAt: timestampToIso(record.closedAt),
        version: stringField(record.version),
    };
}
function toCollection(record) {
    return {
        id: stringField(record.id),
        name: stringField(record.name),
        description: optionalString(record.description),
        platform: numberField(record.platform),
        remoteId: optionalString(record.remoteId),
        workspaceId: optionalString(record.workspaceId),
        linkedAccountId: optionalString(record.linkedAccountId),
        statusMappings: asArray(record.statusMappings).map((item) => toStatusMapping(asRecord(item))),
        customFieldDefinitions: asArray(record.customFieldDefinitions).map((item) => toCustomFieldDefinition(asRecord(item))),
        remoteData: record.remoteData ? structToRecord(asRecord(record.remoteData)) : undefined,
        createdAt: timestampToIso(record.createdAt) ?? '',
        updatedAt: timestampToIso(record.updatedAt),
    };
}
function toStatusMapping(record) {
    return {
        nativeStatus: stringField(record.nativeStatus),
        phase: numberField(record.phase),
        stage: numberField(record.stage),
    };
}
function toCustomFieldDefinition(record) {
    return {
        fieldId: stringField(record.fieldId),
        fieldName: stringField(record.fieldName),
        fieldType: numberField(record.fieldType),
        required: Boolean(record.required),
    };
}
function toUser(record) {
    return {
        id: stringField(record.id),
        name: stringField(record.name),
        email: optionalString(record.email),
        type: numberField(record.type),
        status: numberField(record.status),
        remoteId: optionalString(record.remoteId),
        platform: optionalNumber(record.platform),
    };
}
function toRelationship(record) {
    return {
        type: numberField(record.type),
        targetTaskId: stringField(record.targetTaskId),
    };
}
function toCustomFieldValue(record) {
    return {
        fieldId: stringField(record.fieldId),
        fieldName: stringField(record.fieldName),
        fieldType: numberField(record.fieldType),
        value: protoValueToJson(record.value),
    };
}
function toCodeContext(record) {
    return {
        repo: optionalString(record.repo),
        branch: optionalString(record.branch),
        pullRequests: asArray(record.pullRequests).map((item) => toPullRequest(asRecord(item))),
        ciStatus: optionalNumber(record.ciStatus),
        commitShas: asArray(record.commitShas).map(stringField),
    };
}
function toPullRequest(record) {
    return {
        id: stringField(record.id),
        url: stringField(record.url),
        status: numberField(record.status),
    };
}
function toComment(record) {
    return {
        id: stringField(record.id),
        taskId: stringField(record.taskId),
        author: toUser(asRecord(record.author)),
        body: stringField(record.body),
        attachments: asArray(record.attachments).map((item) => toAttachment(asRecord(item))),
        createdAt: timestampToIso(record.createdAt) ?? '',
        updatedAt: timestampToIso(record.updatedAt),
        remoteId: optionalString(record.remoteId),
    };
}
function toAttachment(record) {
    return {
        id: stringField(record.id),
        filename: stringField(record.filename),
        url: stringField(record.url),
        contentType: optionalString(record.contentType),
        sizeBytes: optionalNumber(record.sizeBytes),
    };
}
function toChange(record) {
    return {
        id: stringField(record.id),
        taskId: stringField(record.taskId),
        field: stringField(record.field),
        oldValue: protoValueToJson(record.oldValue),
        newValue: protoValueToJson(record.newValue),
        changedBy: toUser(asRecord(record.changedBy)),
        changedAt: timestampToIso(record.changedAt) ?? '',
        reason: optionalString(record.reason),
    };
}
function toTaskEvent(record) {
    return {
        eventType: numberField(record.eventType),
        task: record.task ? toTask(asRecord(record.task)) : emptyTask(),
        changes: asArray(record.changes).map((item) => toChange(asRecord(item))),
        timestamp: timestampToIso(record.timestamp) ?? '',
        sequence: BigInt(stringField(record.sequence) || '0'),
    };
}
function emptyTask() {
    return {
        id: '',
        name: '',
        phase: 0,
        stage: 0,
        assignees: [],
        collectionId: '',
        relationships: [],
        labels: [],
        customFields: [],
        platform: 0,
        createdAt: '',
        version: '',
    };
}
function timestampFromIso(value) {
    const ms = Date.parse(value);
    if (Number.isNaN(ms))
        return undefined;
    return {
        seconds: Math.floor(ms / 1000),
        nanos: (ms % 1000) * 1_000_000,
    };
}
function timestampToIso(value) {
    const record = asRecord(value);
    if (!record.seconds && !record.nanos)
        return undefined;
    const seconds = Number(record.seconds ?? 0);
    const nanos = Number(record.nanos ?? 0);
    return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}
function structToRecord(record) {
    const fields = asRecord(record.fields);
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, protoValueToJson(value)]));
}
function protoValueToJson(value) {
    if (value === undefined || value === null)
        return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    const record = asRecord(value);
    if ('nullValue' in record)
        return null;
    if ('numberValue' in record)
        return numberField(record.numberValue);
    if ('stringValue' in record)
        return stringField(record.stringValue);
    if ('boolValue' in record)
        return Boolean(record.boolValue);
    if ('structValue' in record)
        return structToRecord(asRecord(record.structValue));
    if ('listValue' in record) {
        return asArray(asRecord(record.listValue).values).map(protoValueToJson);
    }
    return record;
}
function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    return value;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function stringField(value) {
    return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}
function optionalString(value) {
    const str = stringField(value);
    return str === '' ? undefined : str;
}
function numberField(value) {
    return typeof value === 'number' ? value : Number(value ?? 0);
}
function optionalNumber(value) {
    return value === undefined || value === null ? undefined : numberField(value);
}
//# sourceMappingURL=grpc-client.js.map