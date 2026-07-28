package store

import (
	"context"
	"errors"
	"time"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrConflict        = errors.New("version conflict")
	ErrAlreadyClaimed  = errors.New("task already claimed")
	ErrAlreadyClosed   = errors.New("task already closed")
	ErrUnavailable     = errors.New("task unavailable")
	ErrInvalidArgument = errors.New("invalid argument")
	ErrNotImplemented  = errors.New("not implemented")
)

type AvailabilityReason string

const (
	AvailabilityReasonTriage              AvailabilityReason = "triage"
	AvailabilityReasonTerminal            AvailabilityReason = "terminal"
	AvailabilityReasonHeld                AvailabilityReason = "held"
	AvailabilityReasonBlockedByDependency AvailabilityReason = "blocked_by_dependency"
	AvailabilityReasonFutureStartDate     AvailabilityReason = "future_start_date"
)

type TaskAvailability struct {
	Available bool
	Reasons   []AvailabilityReason
}

func (a TaskAvailability) HasReason(reason AvailabilityReason) bool {
	for _, r := range a.Reasons {
		if r == reason {
			return true
		}
	}
	return false
}

// LifecycleStager is implemented by stores whose Task.Stage is a presentation
// value that may differ from the stage governing authorization and work
// scheduling.
//
// The GitHub pass-through store is the case that motivated this (#194). It
// deliberately demotes an OPEN issue carrying a terminal stage label to
// "accepted", because reporting live work as finished is the worse error for
// anyone reading a queue. But that demotion is a DISPLAY decision, and the same
// field was being fed to the RBAC transition table, where it silently downgraded
// the scope required to reopen a declined issue from task:accept to task:write.
//
// LifecycleStage is the un-demoted answer: the stage a decision that grants or
// withholds privilege, or that schedules work, must be evaluated against.
// Stores whose Stage field is already authoritative need not implement this;
// callers should go through the LifecycleStage helper, which falls back to
// t.Stage.
//
// This is a narrow seam, not the full display-vs-authoritative split. That
// larger refactor of IssueToPhaseStage is tracked as #203.
type LifecycleStager interface {
	LifecycleStage(ctx context.Context, t *ent.Task) task.Stage
}

// LifecycleStage returns the stage that authorization and scheduling decisions
// must use for a task, which is not always the stage the task displays. Stores
// that do not distinguish the two are answered from t.Stage.
func LifecycleStage(ctx context.Context, s Store, t *ent.Task) task.Stage {
	if stager, ok := s.(LifecycleStager); ok {
		return stager.LifecycleStage(ctx, t)
	}
	return t.Stage
}

// LabelDeltaLifecycleStager is implemented by stores whose lifecycle stage is
// STORED IN the task's labels, so that an add/remove label edit can move it.
//
// This is the write-side counterpart of LifecycleStager, and it exists because
// of the invariant that side missed (#194 round 5): if authorization reads a
// value, every write path to that value must be guarded by the same
// authorization. LifecycleStager made the authorization gate read the labels
// honestly; it did nothing about the fact that add_labels / remove_labels
// rewrite the very field it reads, guarded only by the blanket task:write.
//
// A store implements this only if a label edit can change the answer
// LifecycleStage gives. That is a stronger statement than LifecycleStager's:
// a store can have a display/lifecycle split for other reasons and still have
// labels be inert metadata. The two interfaces are therefore separate, and a
// store may implement either, both, or neither.
type LabelDeltaLifecycleStager interface {
	// LabelDeltaLifecycleStages reports the task's lifecycle stage before and
	// after applying an add/remove label delta to its current label set.
	//
	// Both endpoints must be computed the same way. Callers compare them for
	// equality to decide whether a label edit is a lifecycle transition at
	// all, so an implementation that derived "before" from one source and
	// "after" from another would report spurious transitions wherever the two
	// sources merely disagree.
	LabelDeltaLifecycleStages(ctx context.Context, t *ent.Task, addLabels, removeLabels []string) (before, after task.Stage)
}

// LabelDeltaLifecycleStages reports the lifecycle stage a task holds now and
// the one it would hold if the given label delta were applied.
//
// Stores that do not store the lifecycle stage in labels answer with the
// task's current lifecycle stage for both endpoints. That is not a stub: for a
// native Ent-backed task the stage lives in its own column, no label can forge
// it, and "a label edit induces no stage transition" is the correct answer
// rather than a missing one. Callers that gate on before != after are
// therefore a no-op on those stores by construction.
func LabelDeltaLifecycleStages(ctx context.Context, s Store, t *ent.Task, addLabels, removeLabels []string) (task.Stage, task.Stage) {
	if stager, ok := s.(LabelDeltaLifecycleStager); ok {
		return stager.LabelDeltaLifecycleStages(ctx, t, addLabels, removeLabels)
	}
	current := LifecycleStage(ctx, s, t)
	return current, current
}

type CreateTaskParams struct {
	Title              string
	Description        string
	CollectionID       uuid.UUID
	Phase              task.Phase
	Stage              task.Stage
	HoldReason         *task.HoldReason
	NativeLabel        string
	Type               string
	Priority           *task.Priority
	Rank               *int
	AssigneeID         *uuid.UUID
	ParentTaskID       *uuid.UUID
	AcceptanceCriteria *string
	RemoteData         map[string]any
	Labels             []string
	StartDate          *time.Time
	DueDate            *time.Time
	BlocksTaskIDs      []uuid.UUID
	BlockedByTaskIDs   []uuid.UUID
	Repo               string
	Branch             string
}

type UpdateTaskParams struct {
	Title               *string
	Description         *string
	Phase               *task.Phase
	Stage               *task.Stage
	HoldReason          *task.HoldReason
	ClearHoldReason     bool
	NativeLabel         *string
	Type                *string
	Priority            *task.Priority
	Rank                *int
	ClearRank           bool
	ClearPriority       bool
	AssigneeID          *uuid.UUID
	ClearAssignee       bool
	ParentTaskID        *uuid.UUID
	ClearParent         bool
	AcceptanceCriteria  *string
	ClearAcceptance     bool
	RemoteData          map[string]any
	Version             string // required for CAS
	StartDate           *time.Time
	ClearStartDate      bool
	DueDate             *time.Time
	ClearDueDate        bool
	AddLabels           []string
	RemoveLabels        []string
	AddBlocks           []uuid.UUID
	AddBlockedBy        []uuid.UUID
	RemoveRelationships []uuid.UUID
	Repo                *string
	Branch              *string
	ClearRepo           bool
	ClearBranch         bool
	AddPullRequests     []PullRequestParam
	CIStatus            *string
	ClearCIStatus       bool
	Reason              *string
}

type InsertTasksAfterParams struct {
	AnchorTaskID uuid.UUID
	Steps        []CreateTaskParams
	CollectionID uuid.UUID
	ActorID      uuid.UUID
	Reason       string
}

type InsertTasksAfterResult struct {
	InsertedTasks []*ent.Task
	AnchorTask    *ent.Task
}

type PullRequestParam struct {
	ID     string
	URL    string
	Status string
}

type ListTasksParams struct {
	CollectionID  *uuid.UUID
	Phase         *task.Phase
	Stage         *task.Stage
	AssigneeID    *uuid.UUID
	Unassigned    bool
	Priority      *task.Priority
	Type          *string
	Labels        []string
	ParentTaskID  *uuid.UUID
	SortField     string
	SortOrder     string
	Limit         int
	LastID        string
	LastSortValue string
}

type CreateCollectionParams struct {
	Name        string
	Description string
	Platform    string
	RemoteID    string
	RemoteData  map[string]any
}

type UpdateCollectionParams struct {
	Name        *string
	Description *string
	RemoteData  map[string]any
}

type ListCollectionsParams struct {
	Platform      *collection.Platform
	Limit         int
	LastID        string
	LastSortValue string
}

type AddCommentParams struct {
	TaskID   uuid.UUID
	AuthorID uuid.UUID
	Body     string
}

type ListCommentsParams struct {
	TaskID        uuid.UUID
	Limit         int
	LastID        string
	LastSortValue string
}

type ListChangesParams struct {
	TaskID        uuid.UUID
	Field         string
	Limit         int
	LastID        string
	LastSortValue string
}

type ListAllTasksForCollectionParams struct {
	CollectionID uuid.UUID
}

type ListAllCommentsForTaskParams struct {
	TaskID uuid.UUID
}

type ListAllCommentsForCollectionParams struct {
	CollectionID uuid.UUID
}

type ListAllChangesForTaskParams struct {
	TaskID uuid.UUID
}

type ListAllChangesForCollectionParams struct {
	CollectionID uuid.UUID
}

type ListAllRelationshipsForCollectionParams struct {
	CollectionID uuid.UUID
}

type ImportCollectionParams struct {
	Users         []ImportUser
	Collection    ImportCollection
	Tasks         []ImportTask
	Comments      []ImportComment
	Relationships []ImportRelationship
	Changes       []ImportChange
}

type ImportCollection struct {
	Name        string
	Description string
	Platform    collection.Platform
	RemoteData  map[string]any
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type ImportUser struct {
	ID          uuid.UUID
	DisplayName string
	Email       *string
	Type        string
	Status      string
}

type ImportTask struct {
	ID                 uuid.UUID
	Title              string
	Description        string
	Phase              task.Phase
	Stage              task.Stage
	HoldReason         *task.HoldReason
	NativeLabel        string
	Type               string
	Priority           *task.Priority
	Rank               *int
	AssigneeID         *uuid.UUID
	ParentTaskID       *uuid.UUID
	StartDate          *time.Time
	DueDate            *time.Time
	ClosedAt           *time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
	AcceptanceCriteria *string
	Labels             []string
	Repo               string
	Branch             string
	CIStatus           *task.CiStatus
	PullRequests       []map[string]string
	RemoteData         map[string]any
	Version            string
}

type ImportComment struct {
	ID        uuid.UUID
	TaskID    uuid.UUID
	AuthorID  uuid.UUID
	Body      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type ImportRelationship struct {
	ID           uuid.UUID
	SourceTaskID uuid.UUID
	TargetTaskID uuid.UUID
	Type         relationship.Type
}

type ImportChange struct {
	ID        uuid.UUID
	TaskID    uuid.UUID
	AuthorID  uuid.UUID
	FieldName string
	OldValue  string
	NewValue  string
	CreatedAt time.Time
}

type Store interface {
	CreateTask(ctx context.Context, p CreateTaskParams) (*ent.Task, error)
	InsertTasksAfter(ctx context.Context, p InsertTasksAfterParams) (*InsertTasksAfterResult, error)
	GetTask(ctx context.Context, id uuid.UUID) (*ent.Task, error)
	ListTasks(ctx context.Context, p ListTasksParams) ([]*ent.Task, int, error)
	ListAllTasksForCollection(ctx context.Context, p ListAllTasksForCollectionParams) ([]*ent.Task, error)
	UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams, actorID uuid.UUID) (*ent.Task, error)
	ClaimTask(ctx context.Context, id uuid.UUID, assigneeID uuid.UUID, version string) (*ent.Task, error)
	CloseTask(ctx context.Context, id uuid.UUID, stage task.Stage, version string, actorID uuid.UUID) (*ent.Task, error)
	DeleteTask(ctx context.Context, id uuid.UUID) error
	CreateCollection(ctx context.Context, p CreateCollectionParams) (*ent.Collection, error)
	UpdateCollection(ctx context.Context, id uuid.UUID, p UpdateCollectionParams) (*ent.Collection, error)
	GetCollection(ctx context.Context, id uuid.UUID) (*ent.Collection, error)
	ListCollections(ctx context.Context, p ListCollectionsParams) ([]*ent.Collection, int, error)
	AddComment(ctx context.Context, p AddCommentParams) (*ent.Comment, error)
	GetComment(ctx context.Context, id uuid.UUID) (*ent.Comment, error)
	ListComments(ctx context.Context, p ListCommentsParams) ([]*ent.Comment, int, error)
	ListChanges(ctx context.Context, p ListChangesParams) ([]*ent.Change, int, error)
	ListAllCommentsForTask(ctx context.Context, p ListAllCommentsForTaskParams) ([]*ent.Comment, error)
	ListAllCommentsForCollection(ctx context.Context, p ListAllCommentsForCollectionParams) ([]*ent.Comment, error)
	ListAllChangesForTask(ctx context.Context, p ListAllChangesForTaskParams) ([]*ent.Change, error)
	ListAllChangesForCollection(ctx context.Context, p ListAllChangesForCollectionParams) ([]*ent.Change, error)
	ListAllRelationshipsForCollection(ctx context.Context, p ListAllRelationshipsForCollectionParams) ([]*ent.Relationship, error)
	ImportCollection(ctx context.Context, p ImportCollectionParams) (*ent.Collection, error)
	GetReadyTasks(ctx context.Context, p GetReadyTasksParams) ([]*ReadyTaskResult, int, error)
	GetBlockedTasks(ctx context.Context, p GetBlockedTasksParams) ([]*BlockedTaskResult, int, error)

	// Users
	CreateUser(ctx context.Context, p CreateUserParams) (*ent.User, error)
	GetUser(ctx context.Context, id uuid.UUID) (*ent.User, error)
	GetUserByName(ctx context.Context, name string) (*ent.User, error)
	GetUserByEmail(ctx context.Context, email string) ([]*ent.User, error)
	GetUsersByIDs(ctx context.Context, ids []uuid.UUID) ([]*ent.User, error)
	ListUsers(ctx context.Context, p ListUsersParams) ([]*ent.User, int, error)

	// API Tokens
	CreateAPIToken(ctx context.Context, p CreateAPITokenParams) (*ent.ApiToken, string, error)
	GetAPIToken(ctx context.Context, id uuid.UUID) (*ent.ApiToken, error)
	LookupToken(ctx context.Context, tokenHash string) (*ent.ApiToken, error)
	ListAPITokens(ctx context.Context, p ListAPITokensParams) ([]*ent.ApiToken, int, error)
	UpdateAPITokenScopes(ctx context.Context, id uuid.UUID, scopes []string) (*ent.ApiToken, error)
	RevokeAPIToken(ctx context.Context, id uuid.UUID) error
	UpdateTokenLastUsed(ctx context.Context, id uuid.UUID) error

	// LinkedAccounts
	CreateLinkedAccount(ctx context.Context, p CreateLinkedAccountParams) (*ent.LinkedAccount, error)
	GetLinkedAccount(ctx context.Context, id uuid.UUID) (*ent.LinkedAccount, error)
	UpdateLinkedAccount(ctx context.Context, id uuid.UUID, p UpdateLinkedAccountParams) (*ent.LinkedAccount, error)
	DeleteLinkedAccount(ctx context.Context, id uuid.UUID) error
	ListLinkedAccounts(ctx context.Context, p ListLinkedAccountsParams) ([]*ent.LinkedAccount, int, error)

	Close() error
}

// ── Graph Query Params ──

type GetReadyTasksParams struct {
	CollectionID         *uuid.UUID
	AssigneeID           *uuid.UUID
	Unassigned           bool
	MinPriority          *task.Priority
	IncludeUnblockedOpen bool
	Limit                int
	Offset               int
}

type ReadyTaskResult struct {
	Task             *ent.Task
	BlockersResolved int
}

type GetBlockedTasksParams struct {
	CollectionID *uuid.UUID
	AssigneeID   *uuid.UUID
	Unassigned   bool
	Limit        int
	Offset       int
}

type BlockerInfoResult struct {
	TaskID uuid.UUID
	Name   string
	Phase  task.Phase
	Stage  task.Stage
}

type BlockedTaskResult struct {
	Task     *ent.Task
	Blockers []BlockerInfoResult
}

// ── User Params ──

type CreateUserParams struct {
	DisplayName string
	Email       *string
	Type        string
	Status      string
}

type ListUsersParams struct {
	Type          string
	Limit         int
	LastID        string
	LastSortValue string
}

// ── API Token Params ──

type CreateAPITokenParams struct {
	UserID        uuid.UUID
	Name          string
	ExpiresAt     *time.Time
	Scopes        []string
	CollectionIDs []uuid.UUID
}

type ListAPITokensParams struct {
	UserID        *uuid.UUID
	Limit         int
	LastID        string
	LastSortValue string
}

// ── LinkedAccount Params ──

type CreateLinkedAccountParams struct {
	CollectionID  uuid.UUID
	Platform      string
	AuthToken     string
	AuthMethod    string
	Scopes        []string
	RemoteUserID  string
	ExpiresAt     *time.Time
	RefreshToken  string
	TokenExpiry   *time.Time
	ScopesGranted []string
}

type UpdateLinkedAccountParams struct {
	AuthToken        *string
	RefreshToken     *string
	TokenExpiry      *time.Time
	ClearTokenExpiry bool
	Status           *string
	ScopesGranted    []string
	LastValidatedAt  *time.Time
}

type ListLinkedAccountsParams struct {
	CollectionID *uuid.UUID
	Platform     *string
	Status       *string
	Limit        int
	LastID       string
}
