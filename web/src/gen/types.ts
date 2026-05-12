// Hand-written TypeScript types mirroring proto/farmtable.proto.
// These will be replaced by buf codegen once set up.

export enum Platform {
  UNSPECIFIED = 0,
  FARMTABLE = 1,
  GITHUB = 2,
  LINEAR = 3,
  JIRA = 4,
  ASANA = 5,
  BEADS = 6,
}

export enum TaskPhase {
  UNSPECIFIED = 0,
  OPEN = 1,
  IN_PROGRESS = 2,
  ON_HOLD = 3,
  CLOSED = 4,
}

export enum TaskStage {
  UNSPECIFIED = 0,
  // OPEN
  TRIAGE = 1,
  BACKLOG = 2,
  READY = 3,
  // IN_PROGRESS
  WORKING = 4,
  IN_REVIEW = 5,
  IN_QA = 6,
  DEPLOYING = 7,
  // ON_HOLD
  BLOCKED = 8,
  WAITING_FOR_INPUT = 9,
  DEFERRED = 10,
  SCHEDULED = 11,
  // CLOSED
  COMPLETED = 12,
  WONT_FIX = 13,
  DUPLICATE = 14,
  CANCELLED = 15,
}

export enum TaskPriority {
  UNSPECIFIED = 0,
  URGENT = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
}

export enum RelationshipType {
  UNSPECIFIED = 0,
  BLOCKS = 1,
  BLOCKED_BY = 2,
  RELATED = 3,
  DUPLICATE = 4,
}

export enum UserType {
  UNSPECIFIED = 0,
  HUMAN = 1,
  AGENT = 2,
  SERVICE_ACCOUNT = 3,
}

export enum IdentityStatus {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  SUSPENDED = 2,
  ARCHIVED = 3,
}

export enum AuthMethod {
  UNSPECIFIED = 0,
  OAUTH2_PKCE = 1,
  API_KEY = 2,
  PAT = 3,
  SERVICE_ACCOUNT = 4,
  MCP_OAUTH = 5,
  GITHUB_APP = 6,
  ATLASSIAN_CONNECT = 7,
  LOCAL_PROCESS = 8,
}

export enum CustomFieldType {
  UNSPECIFIED = 0,
  TEXT = 1,
  NUMBER = 2,
  DATE = 3,
  SINGLE_SELECT = 4,
  MULTI_SELECT = 5,
  USER = 6,
  BOOLEAN = 7,
  URL = 8,
}

export enum CIStatus {
  UNSPECIFIED = 0,
  PENDING = 1,
  RUNNING = 2,
  PASSED = 3,
  FAILED = 4,
}

export enum PullRequestStatus {
  UNSPECIFIED = 0,
  OPEN = 1,
  MERGED = 2,
  CLOSED = 3,
}

export enum EventType {
  UNSPECIFIED = 0,
  TASK_CREATED = 1,
  TASK_UPDATED = 2,
  TASK_DELETED = 3,
  TASK_PHASE_CHANGED = 4,
  TASK_STAGE_CHANGED = 5,
  TASK_ASSIGNED = 6,
  COMMENT_CREATED = 7,
  COMMENT_UPDATED = 8,
}

export enum WebhookSource {
  UNSPECIFIED = 0,
  NATIVE = 1,
  VIRTUAL = 2,
}

export enum SortField {
  UNSPECIFIED = 0,
  CREATED = 1,
  UPDATED = 2,
  PRIORITY = 3,
  DUE_DATE = 4,
}

export enum SortOrder {
  UNSPECIFIED = 0,
  ASC = 1,
  DESC = 2,
}

export enum DependencyDirection {
  UNSPECIFIED = 0,
  UP = 1,
  DOWN = 2,
  BOTH = 3,
}

// ── Core messages ──

export interface User {
  id: string;
  name: string;
  email?: string;
  type: UserType;
  status: IdentityStatus;
  remoteId?: string;
  platform?: Platform;
}

export interface Relationship {
  type: RelationshipType;
  targetTaskId: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface CustomFieldValue {
  fieldId: string;
  fieldName: string;
  fieldType: CustomFieldType;
  value: unknown;
}

export interface CustomFieldDefinition {
  fieldId: string;
  fieldName: string;
  fieldType: CustomFieldType;
  required: boolean;
}

export interface PullRequest {
  id: string;
  url: string;
  status: PullRequestStatus;
}

export interface CodeContext {
  repo?: string;
  branch?: string;
  pullRequests: PullRequest[];
  ciStatus?: CIStatus;
  commitShas: string[];
}

export interface StatusMapping {
  nativeStatus: string;
  phase: TaskPhase;
  stage: TaskStage;
}

// ── Primary entities ──

export interface Task {
  id: string;
  name: string;
  description?: string;
  acceptanceCriteria?: string;
  phase: TaskPhase;
  stage: TaskStage;
  nativeStatus?: string;
  type?: string;
  priority?: TaskPriority;
  assignees: User[];
  creator?: User;
  startDate?: string;
  dueDate?: string;
  collectionId: string;
  parentTaskId?: string;
  relationships: Relationship[];
  labels: string[];
  customFields: CustomFieldValue[];
  codeContext?: CodeContext;
  remoteId?: string;
  remoteUrl?: string;
  remoteData?: Record<string, unknown>;
  platform: Platform;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  version: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  platform: Platform;
  remoteId?: string;
  workspaceId?: string;
  linkedAccountId?: string;
  statusMappings: StatusMapping[];
  customFieldDefinitions: CustomFieldDefinition[];
  remoteData?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  author: User;
  body: string;
  attachments: Attachment[];
  createdAt: string;
  updatedAt?: string;
  remoteId?: string;
}

export interface Change {
  id: string;
  taskId: string;
  field: string;
  oldValue?: unknown;
  newValue: unknown;
  changedBy: User;
  changedAt: string;
  reason?: string;
}

export interface WebhookEvent {
  id: string;
  eventType: EventType;
  taskId: string;
  changes: Change[];
  triggeredBy?: User;
  platform: Platform;
  source: WebhookSource;
  timestamp: string;
}

// ── Streaming ──

export enum TaskEventType {
  UNSPECIFIED = 0,
  INITIAL = 1,
  CREATED = 2,
  UPDATED = 3,
  CLOSED = 4,
  DELETED = 5,
  HEARTBEAT = 6,
  SNAPSHOT_COMPLETE = 7,
}

export interface TaskEvent {
  eventType: TaskEventType;
  task: Task;
  changes: Change[];
  timestamp: string;
  sequence: bigint;
}
