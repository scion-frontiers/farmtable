package store

import (
	"context"
	"errors"
	"time"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrConflict        = errors.New("version conflict")
	ErrAlreadyClaimed  = errors.New("task already claimed")
	ErrAlreadyClosed   = errors.New("task already closed")
	ErrInvalidArgument = errors.New("invalid argument")
)

type CreateTaskParams struct {
	Title              string
	Description        string
	CollectionID       uuid.UUID
	Phase              task.Phase
	Stage              task.Stage
	NativeLabel        string
	Type               string
	Priority           *task.Priority
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
	Title              *string
	Description        *string
	Phase              *task.Phase
	Stage              *task.Stage
	NativeLabel        *string
	Type               *string
	Priority           *task.Priority
	ClearPriority      bool
	AssigneeID         *uuid.UUID
	ClearAssignee      bool
	ParentTaskID       *uuid.UUID
	ClearParent        bool
	AcceptanceCriteria *string
	ClearAcceptance    bool
	RemoteData         map[string]any
	Version            string // required for CAS
	StartDate          *time.Time
	ClearStartDate     bool
	DueDate            *time.Time
	ClearDueDate       bool
	AddLabels          []string
	RemoveLabels       []string
	AddBlocks          []uuid.UUID
	AddBlockedBy       []uuid.UUID
	RemoveRelationships []uuid.UUID
	Repo               *string
	Branch             *string
	ClearRepo          bool
	ClearBranch        bool
	AddPullRequests    []PullRequestParam
	CIStatus           *string
	ClearCIStatus      bool
	Reason             *string
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

type Store interface {
	CreateTask(ctx context.Context, p CreateTaskParams) (*ent.Task, error)
	GetTask(ctx context.Context, id uuid.UUID) (*ent.Task, error)
	ListTasks(ctx context.Context, p ListTasksParams) ([]*ent.Task, int, error)
	UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams, actorID uuid.UUID) (*ent.Task, error)
	ClaimTask(ctx context.Context, id uuid.UUID, assigneeID uuid.UUID, version string) (*ent.Task, error)
	CloseTask(ctx context.Context, id uuid.UUID, stage task.Stage, version string, actorID uuid.UUID) (*ent.Task, error)
	CreateCollection(ctx context.Context, p CreateCollectionParams) (*ent.Collection, error)
	GetCollection(ctx context.Context, id uuid.UUID) (*ent.Collection, error)
	ListCollections(ctx context.Context, p ListCollectionsParams) ([]*ent.Collection, int, error)
	AddComment(ctx context.Context, p AddCommentParams) (*ent.Comment, error)
	GetComment(ctx context.Context, id uuid.UUID) (*ent.Comment, error)
	ListComments(ctx context.Context, p ListCommentsParams) ([]*ent.Comment, int, error)
	ListChanges(ctx context.Context, p ListChangesParams) ([]*ent.Change, int, error)
	GetReadyTasks(ctx context.Context, p GetReadyTasksParams) ([]*ReadyTaskResult, int, error)
	GetBlockedTasks(ctx context.Context, p GetBlockedTasksParams) ([]*BlockedTaskResult, int, error)

	// Users
	CreateUser(ctx context.Context, p CreateUserParams) (*ent.User, error)
	GetUser(ctx context.Context, id uuid.UUID) (*ent.User, error)
	GetUserByName(ctx context.Context, name string) (*ent.User, error)
	ListUsers(ctx context.Context, p ListUsersParams) ([]*ent.User, int, error)

	// API Tokens
	CreateAPIToken(ctx context.Context, p CreateAPITokenParams) (*ent.ApiToken, string, error)
	LookupToken(ctx context.Context, tokenHash string) (*ent.ApiToken, error)
	ListAPITokens(ctx context.Context, p ListAPITokensParams) ([]*ent.ApiToken, int, error)
	RevokeAPIToken(ctx context.Context, id uuid.UUID) error
	UpdateTokenLastUsed(ctx context.Context, id uuid.UUID) error

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
	UserID    uuid.UUID
	Name      string
	ExpiresAt *time.Time
}

type ListAPITokensParams struct {
	UserID        *uuid.UUID
	Limit         int
	LastID        string
	LastSortValue string
}
