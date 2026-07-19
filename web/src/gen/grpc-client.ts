import { grpc } from '@improbable-eng/grpc-web';
import protobuf from 'protobufjs';
import farmtableDescriptor from './farmtable.json';
import {
  type Change,
  type CodeContext,
  type Attachment,
  type Comment,
  type CustomFieldValue,
  type PullRequest,
  type Relationship,
  type Task,
  type TaskEvent,
  type User,
  SortOrder,
} from './types.js';
import type { CreateTaskFields, FarmTableServiceClient, UpdateTaskFields } from './service.js';

type ProtoRecord = Record<string, unknown>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const SERVICE_NAME = 'farmtable.v1.FarmTableService';
const DEFAULT_COLLECTION_ID = '00000000-0000-0000-0000-000000000001';

const root = protobuf.Root.fromJSON(farmtableDescriptor as protobuf.INamespace);

class ProtoMessage implements grpc.ProtobufMessage {
  constructor(
    private readonly type: protobuf.Type,
    private readonly value: protobuf.Message<ProtoRecord> = type.create(),
  ) {}

  serializeBinary(): Uint8Array {
    const err = this.type.verify(this.value);
    if (err) throw new Error(`${this.type.fullName}: ${err}`);
    return this.type.encode(this.value).finish();
  }

  toObject(): ProtoRecord {
    return this.type.toObject(this.value, {
      defaults: false,
      longs: String,
      enums: Number,
    }) as ProtoRecord;
  }
}

interface ProtoMessageConstructor extends grpc.ProtobufMessageClass<ProtoMessage> {
  create(value?: ProtoRecord): ProtoMessage;
}

function messageClass(typeName: string): ProtoMessageConstructor {
  const type = root.lookupType(`farmtable.v1.${typeName}`);

  return class extends ProtoMessage {
    constructor(value?: ProtoRecord | protobuf.Message<ProtoRecord>) {
      const message = value && '$type' in value
        ? value as protobuf.Message<ProtoRecord>
        : type.create(value ?? {});
      super(type, message);
    }

    static create(value?: ProtoRecord): ProtoMessage {
      return new this(value);
    }

    static deserializeBinary(bytes: Uint8Array): ProtoMessage {
      return new this(type.decode(bytes) as protobuf.Message<ProtoRecord>);
    }
  };
}

function unaryMethod(
  methodName: string,
  requestTypeName: string,
  responseTypeName: string,
): grpc.UnaryMethodDefinition<ProtoMessage, ProtoMessage> {
  return {
    methodName,
    service: { serviceName: SERVICE_NAME },
    requestStream: false,
    responseStream: false,
    requestType: messageClass(requestTypeName),
    responseType: messageClass(responseTypeName),
  };
}

function streamMethod(
  methodName: string,
  requestTypeName: string,
  responseTypeName: string,
): grpc.MethodDefinition<ProtoMessage, ProtoMessage> {
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
  listComments: unaryMethod('ListComments', 'ListCommentsRequest', 'ListCommentsResponse'),
  listChanges: unaryMethod('ListChanges', 'ListChangesRequest', 'ListChangesResponse'),
  listCollections: unaryMethod('ListCollections', 'ListCollectionsRequest', 'ListCollectionsResponse'),
  watchTasks: streamMethod('WatchTasks', 'WatchTasksRequest', 'TaskEvent'),
};

export interface GrpcFarmTableClientOptions {
  serverUrl?: string;
  token?: string;
  collectionId?: string;
}

export class GrpcFarmTableClient implements FarmTableServiceClient {
  private readonly serverUrl: string;
  private readonly token: string;
  private collectionId?: string;

  constructor(options: GrpcFarmTableClientOptions = {}) {
    this.serverUrl = options.serverUrl ?? window.location.origin;
    this.token = options.token ?? '';
    this.collectionId = options.collectionId;
  }

  async listTasks(): Promise<Task[]> {
    const collectionId = await this.resolveCollectionId();
    const response = await this.unary(methods.listTasks, {
      collectionId,
      full: true,
      pageSize: 200,
    });
    return asArray(response.items).map((item) => toTask(asRecord(item)));
  }

  async getTask(id: string): Promise<Task> {
    const response = await this.unary(methods.getTask, {
      id,
      includeComments: false,
      includeChanges: false,
      collectionId: await this.resolveCollectionId(),
    });
    return toTask(asRecord(response.task));
  }

  async createTask(fields: CreateTaskFields): Promise<Task> {
    const request: ProtoRecord = {
      name: fields.name,
      collectionId: await this.resolveCollectionId(),
    };

    if (fields.description !== undefined) request.description = fields.description;

    const response = await this.unary(methods.createTask, request);
    return toTask(response);
  }

  async updateTask(id: string, fields: UpdateTaskFields): Promise<Task> {
    const request: ProtoRecord = { id };

    if (fields.name !== undefined) request.name = fields.name;
    if (fields.description !== undefined) request.description = fields.description;
    if (fields.acceptanceCriteria !== undefined) request.acceptanceCriteria = fields.acceptanceCriteria;
    if (fields.stage !== undefined) request.stage = fields.stage;
    if (fields.priority !== undefined) request.priority = fields.priority;
    if (fields.type !== undefined) request.type = fields.type;
    if (fields.dueDate !== undefined) request.dueDate = timestampFromIso(fields.dueDate);
    if (fields.startDate !== undefined) request.startDate = timestampFromIso(fields.startDate);
    if (fields.parentTaskId === null) {
      request.clearParent = true;
    } else if (fields.parentTaskId !== undefined) {
      request.parentTaskId = fields.parentTaskId;
    }
    if (fields.version !== undefined) request.version = fields.version;

    const response = await this.unary(methods.updateTask, request);
    return toTask(response);
  }

  async listComments(taskId: string): Promise<Comment[]> {
    const response = await this.unary(methods.listComments, {
      taskId,
      pageSize: 200,
      order: SortOrder.DESC,
    });
    return asArray(response.items).map((item) => toComment(asRecord(item)));
  }

  async listChanges(taskId: string): Promise<Change[]> {
    const response = await this.unary(methods.listChanges, { taskId, pageSize: 200 });
    return asArray(response.items).map((item) => toChange(asRecord(item)));
  }

  async *watchTasks(signal?: AbortSignal): AsyncIterable<TaskEvent> {
    const collectionId = await this.resolveCollectionId();
    const queue: TaskEvent[] = [];
    let notify: (() => void) | null = null;
    let done = false;
    let error: Error | null = null;

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
          error = new Error(message || `gRPC stream failed with code ${code}`);
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
        if (error) throw error;
        if (done) break;
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
      }
      if (error) throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      request.close();
    }
  }

  private async resolveCollectionId(): Promise<string> {
    if (this.collectionId) return this.collectionId;

    const response = await this.unary(methods.listCollections, { pageSize: 1 });
    const firstCollection = asArray(response.items)[0];
    this.collectionId = stringField(asRecord(firstCollection).id) || DEFAULT_COLLECTION_ID;
    return this.collectionId;
  }

  private unary(methodDescriptor: grpc.UnaryMethodDefinition<ProtoMessage, ProtoMessage>, request: ProtoRecord): Promise<ProtoRecord> {
    return new Promise((resolve, reject) => {
      grpc.unary(methodDescriptor, {
        host: this.serverUrl,
        request: (methodDescriptor.requestType as ProtoMessageConstructor).create(request),
        metadata: this.metadata(),
        onEnd: (output) => {
          if (output.status !== grpc.Code.OK) {
            reject(new Error(output.statusMessage || `gRPC request failed with code ${output.status}`));
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

  private metadata(): grpc.Metadata.ConstructorArg | undefined {
    if (!this.token) return undefined;
    return { Authorization: `Bearer ${this.token}` };
  }
}

export function createGrpcFarmTableClient(): GrpcFarmTableClient {
  const globalConfig = window as Window & {
    FARMTABLE_TOKEN?: string;
    FARMTABLE_SERVER_URL?: string;
    FARMTABLE_COLLECTION_ID?: string;
  };
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? globalConfig.FARMTABLE_TOKEN ?? localStorage.getItem('farmtable.token') ?? '';
  const collectionId = params.get('collection') ?? globalConfig.FARMTABLE_COLLECTION_ID ?? localStorage.getItem('farmtable.collectionId') ?? undefined;

  return new GrpcFarmTableClient({
    serverUrl: globalConfig.FARMTABLE_SERVER_URL ?? window.location.origin,
    token,
    collectionId,
  });
}

function toTask(record: ProtoRecord): Task {
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

function toUser(record: ProtoRecord): User {
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

function toRelationship(record: ProtoRecord): Relationship {
  return {
    type: numberField(record.type),
    targetTaskId: stringField(record.targetTaskId),
  };
}

function toCustomFieldValue(record: ProtoRecord): CustomFieldValue {
  return {
    fieldId: stringField(record.fieldId),
    fieldName: stringField(record.fieldName),
    fieldType: numberField(record.fieldType),
    value: protoValueToJson(record.value),
  };
}

function toCodeContext(record: ProtoRecord): CodeContext {
  return {
    repo: optionalString(record.repo),
    branch: optionalString(record.branch),
    pullRequests: asArray(record.pullRequests).map((item) => toPullRequest(asRecord(item))),
    ciStatus: optionalNumber(record.ciStatus),
    commitShas: asArray(record.commitShas).map(stringField),
  };
}

function toPullRequest(record: ProtoRecord): PullRequest {
  return {
    id: stringField(record.id),
    url: stringField(record.url),
    status: numberField(record.status),
  };
}

function toComment(record: ProtoRecord): Comment {
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

function toAttachment(record: ProtoRecord): Attachment {
  return {
    id: stringField(record.id),
    filename: stringField(record.filename),
    url: stringField(record.url),
    contentType: optionalString(record.contentType),
    sizeBytes: optionalNumber(record.sizeBytes),
  };
}

function toChange(record: ProtoRecord): Change {
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

function toTaskEvent(record: ProtoRecord): TaskEvent {
  return {
    eventType: numberField(record.eventType),
    task: record.task ? toTask(asRecord(record.task)) : emptyTask(),
    changes: asArray(record.changes).map((item) => toChange(asRecord(item))),
    timestamp: timestampToIso(record.timestamp) ?? '',
    sequence: BigInt(stringField(record.sequence) || '0'),
  };
}

function emptyTask(): Task {
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

function timestampFromIso(value: string): ProtoRecord | undefined {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return undefined;
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}

function timestampToIso(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record.seconds && !record.nanos) return undefined;
  const seconds = Number(record.seconds ?? 0);
  const nanos = Number(record.nanos ?? 0);
  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

function structToRecord(record: ProtoRecord): Record<string, JsonValue> {
  const fields = asRecord(record.fields);
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, protoValueToJson(value)]),
  );
}

function protoValueToJson(value: unknown): JsonValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

  const record = asRecord(value);
  if ('nullValue' in record) return null;
  if ('numberValue' in record) return numberField(record.numberValue);
  if ('stringValue' in record) return stringField(record.stringValue);
  if ('boolValue' in record) return Boolean(record.boolValue);
  if ('structValue' in record) return structToRecord(asRecord(record.structValue));
  if ('listValue' in record) {
    return asArray(asRecord(record.listValue).values).map(protoValueToJson);
  }
  return record as { [key: string]: JsonValue };
}

function asRecord(value: unknown): ProtoRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ProtoRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

function optionalString(value: unknown): string | undefined {
  const str = stringField(value);
  return str === '' ? undefined : str;
}

function numberField(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function optionalNumber(value: unknown): number | undefined {
  return value === undefined || value === null ? undefined : numberField(value);
}
