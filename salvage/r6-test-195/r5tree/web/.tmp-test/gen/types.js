// Hand-written TypeScript types mirroring proto/farmtable.proto.
// These will be replaced by buf codegen once set up.
export var Platform;
(function (Platform) {
    Platform[Platform["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    Platform[Platform["FARMTABLE"] = 1] = "FARMTABLE";
    Platform[Platform["GITHUB"] = 2] = "GITHUB";
    Platform[Platform["LINEAR"] = 3] = "LINEAR";
    Platform[Platform["JIRA"] = 4] = "JIRA";
    Platform[Platform["ASANA"] = 5] = "ASANA";
    Platform[Platform["BEADS"] = 6] = "BEADS";
})(Platform || (Platform = {}));
export var TaskPhase;
(function (TaskPhase) {
    TaskPhase[TaskPhase["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    TaskPhase[TaskPhase["OPEN"] = 1] = "OPEN";
    TaskPhase[TaskPhase["IN_PROGRESS"] = 2] = "IN_PROGRESS";
    TaskPhase[TaskPhase["ON_HOLD"] = 3] = "ON_HOLD";
    TaskPhase[TaskPhase["CLOSED"] = 4] = "CLOSED";
})(TaskPhase || (TaskPhase = {}));
export var TaskStage;
(function (TaskStage) {
    TaskStage[TaskStage["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    // OPEN
    TaskStage[TaskStage["TRIAGE"] = 1] = "TRIAGE";
    TaskStage[TaskStage["ACCEPTED"] = 2] = "ACCEPTED";
    // IN_PROGRESS
    TaskStage[TaskStage["WORKING"] = 4] = "WORKING";
    TaskStage[TaskStage["IN_REVIEW"] = 5] = "IN_REVIEW";
    TaskStage[TaskStage["IN_QA"] = 6] = "IN_QA";
    TaskStage[TaskStage["DEPLOYING"] = 7] = "DEPLOYING";
    // CLOSED
    TaskStage[TaskStage["COMPLETED"] = 12] = "COMPLETED";
    TaskStage[TaskStage["WONT_FIX"] = 13] = "WONT_FIX";
    TaskStage[TaskStage["DUPLICATE"] = 14] = "DUPLICATE";
    TaskStage[TaskStage["CANCELLED"] = 15] = "CANCELLED";
})(TaskStage || (TaskStage = {}));
export var TaskHoldReason;
(function (TaskHoldReason) {
    TaskHoldReason[TaskHoldReason["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    TaskHoldReason[TaskHoldReason["WAITING_FOR_INPUT"] = 1] = "WAITING_FOR_INPUT";
    TaskHoldReason[TaskHoldReason["DEFERRED"] = 2] = "DEFERRED";
})(TaskHoldReason || (TaskHoldReason = {}));
export var AvailabilityReason;
(function (AvailabilityReason) {
    AvailabilityReason[AvailabilityReason["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    AvailabilityReason[AvailabilityReason["TRIAGE"] = 1] = "TRIAGE";
    AvailabilityReason[AvailabilityReason["TERMINAL"] = 2] = "TERMINAL";
    AvailabilityReason[AvailabilityReason["HELD"] = 3] = "HELD";
    AvailabilityReason[AvailabilityReason["BLOCKED_BY_DEPENDENCY"] = 4] = "BLOCKED_BY_DEPENDENCY";
    AvailabilityReason[AvailabilityReason["FUTURE_START_DATE"] = 5] = "FUTURE_START_DATE";
})(AvailabilityReason || (AvailabilityReason = {}));
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    TaskPriority[TaskPriority["URGENT"] = 1] = "URGENT";
    TaskPriority[TaskPriority["HIGH"] = 2] = "HIGH";
    TaskPriority[TaskPriority["NORMAL"] = 3] = "NORMAL";
    TaskPriority[TaskPriority["LOW"] = 4] = "LOW";
})(TaskPriority || (TaskPriority = {}));
export var RelationshipType;
(function (RelationshipType) {
    RelationshipType[RelationshipType["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    RelationshipType[RelationshipType["BLOCKS"] = 1] = "BLOCKS";
    RelationshipType[RelationshipType["BLOCKED_BY"] = 2] = "BLOCKED_BY";
    RelationshipType[RelationshipType["RELATED"] = 3] = "RELATED";
    RelationshipType[RelationshipType["DUPLICATE"] = 4] = "DUPLICATE";
})(RelationshipType || (RelationshipType = {}));
export var UserType;
(function (UserType) {
    UserType[UserType["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    UserType[UserType["HUMAN"] = 1] = "HUMAN";
    UserType[UserType["AGENT"] = 2] = "AGENT";
    UserType[UserType["SERVICE_ACCOUNT"] = 3] = "SERVICE_ACCOUNT";
})(UserType || (UserType = {}));
export var IdentityStatus;
(function (IdentityStatus) {
    IdentityStatus[IdentityStatus["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    IdentityStatus[IdentityStatus["ACTIVE"] = 1] = "ACTIVE";
    IdentityStatus[IdentityStatus["SUSPENDED"] = 2] = "SUSPENDED";
    IdentityStatus[IdentityStatus["ARCHIVED"] = 3] = "ARCHIVED";
})(IdentityStatus || (IdentityStatus = {}));
export var AuthMethod;
(function (AuthMethod) {
    AuthMethod[AuthMethod["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    AuthMethod[AuthMethod["OAUTH2_PKCE"] = 1] = "OAUTH2_PKCE";
    AuthMethod[AuthMethod["API_KEY"] = 2] = "API_KEY";
    AuthMethod[AuthMethod["PAT"] = 3] = "PAT";
    AuthMethod[AuthMethod["SERVICE_ACCOUNT"] = 4] = "SERVICE_ACCOUNT";
    AuthMethod[AuthMethod["MCP_OAUTH"] = 5] = "MCP_OAUTH";
    AuthMethod[AuthMethod["GITHUB_APP"] = 6] = "GITHUB_APP";
    AuthMethod[AuthMethod["ATLASSIAN_CONNECT"] = 7] = "ATLASSIAN_CONNECT";
    AuthMethod[AuthMethod["LOCAL_PROCESS"] = 8] = "LOCAL_PROCESS";
})(AuthMethod || (AuthMethod = {}));
export var CustomFieldType;
(function (CustomFieldType) {
    CustomFieldType[CustomFieldType["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    CustomFieldType[CustomFieldType["TEXT"] = 1] = "TEXT";
    CustomFieldType[CustomFieldType["NUMBER"] = 2] = "NUMBER";
    CustomFieldType[CustomFieldType["DATE"] = 3] = "DATE";
    CustomFieldType[CustomFieldType["SINGLE_SELECT"] = 4] = "SINGLE_SELECT";
    CustomFieldType[CustomFieldType["MULTI_SELECT"] = 5] = "MULTI_SELECT";
    CustomFieldType[CustomFieldType["USER"] = 6] = "USER";
    CustomFieldType[CustomFieldType["BOOLEAN"] = 7] = "BOOLEAN";
    CustomFieldType[CustomFieldType["URL"] = 8] = "URL";
})(CustomFieldType || (CustomFieldType = {}));
export var CIStatus;
(function (CIStatus) {
    CIStatus[CIStatus["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    CIStatus[CIStatus["PENDING"] = 1] = "PENDING";
    CIStatus[CIStatus["RUNNING"] = 2] = "RUNNING";
    CIStatus[CIStatus["PASSED"] = 3] = "PASSED";
    CIStatus[CIStatus["FAILED"] = 4] = "FAILED";
})(CIStatus || (CIStatus = {}));
export var PullRequestStatus;
(function (PullRequestStatus) {
    PullRequestStatus[PullRequestStatus["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    PullRequestStatus[PullRequestStatus["OPEN"] = 1] = "OPEN";
    PullRequestStatus[PullRequestStatus["MERGED"] = 2] = "MERGED";
    PullRequestStatus[PullRequestStatus["CLOSED"] = 3] = "CLOSED";
})(PullRequestStatus || (PullRequestStatus = {}));
export var EventType;
(function (EventType) {
    EventType[EventType["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    EventType[EventType["TASK_CREATED"] = 1] = "TASK_CREATED";
    EventType[EventType["TASK_UPDATED"] = 2] = "TASK_UPDATED";
    EventType[EventType["TASK_DELETED"] = 3] = "TASK_DELETED";
    EventType[EventType["TASK_PHASE_CHANGED"] = 4] = "TASK_PHASE_CHANGED";
    EventType[EventType["TASK_STAGE_CHANGED"] = 5] = "TASK_STAGE_CHANGED";
    EventType[EventType["TASK_ASSIGNED"] = 6] = "TASK_ASSIGNED";
    EventType[EventType["COMMENT_CREATED"] = 7] = "COMMENT_CREATED";
    EventType[EventType["COMMENT_UPDATED"] = 8] = "COMMENT_UPDATED";
})(EventType || (EventType = {}));
export var WebhookSource;
(function (WebhookSource) {
    WebhookSource[WebhookSource["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    WebhookSource[WebhookSource["NATIVE"] = 1] = "NATIVE";
    WebhookSource[WebhookSource["VIRTUAL"] = 2] = "VIRTUAL";
})(WebhookSource || (WebhookSource = {}));
export var SortField;
(function (SortField) {
    SortField[SortField["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    SortField[SortField["CREATED"] = 1] = "CREATED";
    SortField[SortField["UPDATED"] = 2] = "UPDATED";
    SortField[SortField["PRIORITY"] = 3] = "PRIORITY";
    SortField[SortField["DUE_DATE"] = 4] = "DUE_DATE";
})(SortField || (SortField = {}));
export var SortOrder;
(function (SortOrder) {
    SortOrder[SortOrder["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    SortOrder[SortOrder["ASC"] = 1] = "ASC";
    SortOrder[SortOrder["DESC"] = 2] = "DESC";
})(SortOrder || (SortOrder = {}));
export var DependencyDirection;
(function (DependencyDirection) {
    DependencyDirection[DependencyDirection["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    DependencyDirection[DependencyDirection["UP"] = 1] = "UP";
    DependencyDirection[DependencyDirection["DOWN"] = 2] = "DOWN";
    DependencyDirection[DependencyDirection["BOTH"] = 3] = "BOTH";
})(DependencyDirection || (DependencyDirection = {}));
// ── Streaming ──
export var TaskEventType;
(function (TaskEventType) {
    TaskEventType[TaskEventType["UNSPECIFIED"] = 0] = "UNSPECIFIED";
    TaskEventType[TaskEventType["INITIAL"] = 1] = "INITIAL";
    TaskEventType[TaskEventType["CREATED"] = 2] = "CREATED";
    TaskEventType[TaskEventType["UPDATED"] = 3] = "UPDATED";
    TaskEventType[TaskEventType["CLOSED"] = 4] = "CLOSED";
    TaskEventType[TaskEventType["DELETED"] = 5] = "DELETED";
    TaskEventType[TaskEventType["HEARTBEAT"] = 6] = "HEARTBEAT";
    TaskEventType[TaskEventType["SNAPSHOT_COMPLETE"] = 7] = "SNAPSHOT_COMPLETE";
})(TaskEventType || (TaskEventType = {}));
//# sourceMappingURL=types.js.map