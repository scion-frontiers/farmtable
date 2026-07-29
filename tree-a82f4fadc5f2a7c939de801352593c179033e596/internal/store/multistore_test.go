package store_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

// newMultiStoreSetup creates a MultiStore with a primary and a platform
// store (both SQLite in-memory), plus a collection registered to the
// platform store. Returns the MultiStore, both underlying stores, the
// primary collection ID, the platform collection ID, and a cleanup func.
func newMultiStoreSetup(t *testing.T) (
	ms *store.MultiStore,
	primary *store.EntStore,
	platform *store.EntStore,
	primaryCollID uuid.UUID,
	platformCollID uuid.UUID,
	cleanup func(),
) {
	t.Helper()

	primary, cleanPrimary := testutil.NewTestStore(t)
	platform, cleanPlatform := testutil.NewTestStore(t)

	// Create a collection in the primary store.
	pc, err := primary.CreateCollection(context.Background(), store.CreateCollectionParams{
		Name:     "primary-coll",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("creating primary collection: %v", err)
	}
	primaryCollID = pc.ID

	// Create a collection in the platform store (simulate external platform).
	plc, err := platform.CreateCollection(context.Background(), store.CreateCollectionParams{
		Name:     "platform-coll",
		Platform: "github",
	})
	if err != nil {
		t.Fatalf("creating platform collection: %v", err)
	}
	platformCollID = plc.ID

	ms = store.NewMultiStore(primary)
	ms.RegisterPlatform(platformCollID, platform)

	cleanup = func() {
		cleanPlatform()
		cleanPrimary()
	}
	return
}

// ── Interface Satisfaction ──

func TestMultiStore_ImplementsStore(t *testing.T) {
	var _ store.Store = (*store.MultiStore)(nil)
}

// ── Task Routing ──

func TestMultiStore_CreateTask_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Platform task",
		Description:  "routed to platform",
		CollectionID: platCollID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if created.Title != "Platform task" {
		t.Errorf("title = %q, want %q", created.Title, "Platform task")
	}

	// Verify the task exists in the platform store directly.
	got, err := platform.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("platform.GetTask: %v", err)
	}
	if got.Title != "Platform task" {
		t.Errorf("platform task title = %q, want %q", got.Title, "Platform task")
	}
}

func TestMultiStore_CreateTask_RoutesToPrimary(t *testing.T) {
	ms, primary, _, primaryCollID, _, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Primary task",
		CollectionID: primaryCollID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	got, err := primary.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("primary.GetTask: %v", err)
	}
	if got.Title != "Primary task" {
		t.Errorf("title = %q, want %q", got.Title, "Primary task")
	}
}

func TestMultiStore_GetTask_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	// Create directly in platform store.
	created, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Direct platform",
		CollectionID: platCollID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("platform.CreateTask: %v", err)
	}

	// Retrieve via MultiStore.
	got, err := ms.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("ms.GetTask: %v", err)
	}
	if got.Title != "Direct platform" {
		t.Errorf("title = %q, want %q", got.Title, "Direct platform")
	}
}

func TestMultiStore_GetTask_NotFound(t *testing.T) {
	ms, _, _, _, _, cleanup := newMultiStoreSetup(t)
	defer cleanup()

	_, err := ms.GetTask(context.Background(), uuid.New())
	if err == nil {
		t.Fatal("expected error for missing task")
	}
}

func TestMultiStore_UpdateTask_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Update me",
		CollectionID: platCollID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	newTitle := "Updated via multi"
	updated, err := ms.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		Title: &newTitle,
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if updated.Title != "Updated via multi" {
		t.Errorf("title = %q, want %q", updated.Title, "Updated via multi")
	}

	// Confirm it was updated in the platform store.
	got, err := platform.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("platform.GetTask: %v", err)
	}
	if got.Title != "Updated via multi" {
		t.Errorf("platform title = %q, want %q", got.Title, "Updated via multi")
	}
}

func TestMultiStore_ClaimTask_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Claim me",
		CollectionID: platCollID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	assignee := uuid.New()
	claimed, err := ms.ClaimTask(ctx, created.ID, assignee, created.Version)
	if err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}
	if claimed.Phase != task.PhaseInProgress {
		t.Errorf("phase = %v, want %v", claimed.Phase, task.PhaseInProgress)
	}
}

func TestMultiStore_CloseTask_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Close me",
		CollectionID: platCollID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	closed, err := ms.CloseTask(ctx, created.ID, task.StageCompleted, created.Version, uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}
	if closed.Phase != task.PhaseClosed {
		t.Errorf("phase = %v, want %v", closed.Phase, task.PhaseClosed)
	}
}

func TestMultiStore_DeleteTask_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Delete me",
		CollectionID: platCollID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	if err := ms.DeleteTask(ctx, created.ID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}

	_, err = platform.GetTask(ctx, created.ID)
	if err != store.ErrNotFound {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestMultiStore_ListTasks_RoutesToPlatform(t *testing.T) {
	ms, primary, platform, primaryCollID, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	// Create tasks in both stores.
	_, err := primary.CreateTask(ctx, store.CreateTaskParams{
		Title: "Primary", CollectionID: primaryCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("primary CreateTask: %v", err)
	}
	_, err = platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Platform", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("platform CreateTask: %v", err)
	}

	// List with platform collection filter.
	tasks, total, err := ms.ListTasks(ctx, store.ListTasksParams{CollectionID: &platCollID})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(tasks) != 1 {
		t.Fatalf("len(tasks) = %d, want 1", len(tasks))
	}
	if tasks[0].Title != "Platform" {
		t.Errorf("title = %q, want %q", tasks[0].Title, "Platform")
	}
}

func TestMultiStore_ListTasks_NoCollectionUsesPrimary(t *testing.T) {
	ms, primary, _, primaryCollID, _, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	_, err := primary.CreateTask(ctx, store.CreateTaskParams{
		Title: "Unscoped", CollectionID: primaryCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	tasks, _, err := ms.ListTasks(ctx, store.ListTasksParams{})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(tasks) < 1 {
		t.Fatal("expected at least 1 task from primary")
	}
}

func TestMultiStore_ListAllTasksForCollection(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	_, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Export me", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	tasks, err := ms.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: platCollID})
	if err != nil {
		t.Fatalf("ListAllTasksForCollection: %v", err)
	}
	if len(tasks) != 1 {
		t.Errorf("len(tasks) = %d, want 1", len(tasks))
	}
}

// ── Comment Routing ──

func TestMultiStore_AddComment_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	taskInPlat, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Commentable", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	author := uuid.New()
	// Need a user in the platform store for the comment author.
	_, err = platform.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "commenter",
		Type:        "human",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	c, err := ms.AddComment(ctx, store.AddCommentParams{
		TaskID:   taskInPlat.ID,
		AuthorID: author,
		Body:     "routed comment",
	})
	if err != nil {
		t.Fatalf("AddComment: %v", err)
	}
	if c.Body != "routed comment" {
		t.Errorf("body = %q, want %q", c.Body, "routed comment")
	}

	// Confirm in platform store.
	got, err := platform.GetComment(ctx, c.ID)
	if err != nil {
		t.Fatalf("platform.GetComment: %v", err)
	}
	if got.Body != "routed comment" {
		t.Errorf("platform comment body = %q, want %q", got.Body, "routed comment")
	}
}

func TestMultiStore_GetComment_Fallback(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	taskInPlat, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "For comment", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	c, err := platform.AddComment(ctx, store.AddCommentParams{
		TaskID:   taskInPlat.ID,
		AuthorID: uuid.New(),
		Body:     "find me",
	})
	if err != nil {
		t.Fatalf("AddComment: %v", err)
	}

	// GetComment via MultiStore should find it in the platform store.
	got, err := ms.GetComment(ctx, c.ID)
	if err != nil {
		t.Fatalf("ms.GetComment: %v", err)
	}
	if got.Body != "find me" {
		t.Errorf("body = %q, want %q", got.Body, "find me")
	}
}

func TestMultiStore_ListComments_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	taskInPlat, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Comment list", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	_, err = platform.AddComment(ctx, store.AddCommentParams{
		TaskID:   taskInPlat.ID,
		AuthorID: uuid.New(),
		Body:     "one",
	})
	if err != nil {
		t.Fatalf("AddComment: %v", err)
	}

	comments, total, err := ms.ListComments(ctx, store.ListCommentsParams{TaskID: taskInPlat.ID})
	if err != nil {
		t.Fatalf("ListComments: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(comments) != 1 {
		t.Errorf("len(comments) = %d, want 1", len(comments))
	}
}

// ── Collection Operations (always primary) ──

func TestMultiStore_CollectionOps_AlwaysPrimary(t *testing.T) {
	ms, primary, _, _, _, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "new-coll",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}

	got, err := ms.GetCollection(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetCollection: %v", err)
	}
	if got.Name != "new-coll" {
		t.Errorf("name = %q, want %q", got.Name, "new-coll")
	}

	// Verify it's in primary.
	gotP, err := primary.GetCollection(ctx, created.ID)
	if err != nil {
		t.Fatalf("primary.GetCollection: %v", err)
	}
	if gotP.Name != "new-coll" {
		t.Errorf("primary name = %q, want %q", gotP.Name, "new-coll")
	}

	newName := "renamed"
	updated, err := ms.UpdateCollection(ctx, created.ID, store.UpdateCollectionParams{Name: &newName})
	if err != nil {
		t.Fatalf("UpdateCollection: %v", err)
	}
	if updated.Name != "renamed" {
		t.Errorf("updated name = %q, want %q", updated.Name, "renamed")
	}

	colls, total, err := ms.ListCollections(ctx, store.ListCollectionsParams{})
	if err != nil {
		t.Fatalf("ListCollections: %v", err)
	}
	// At least the ones we created (primary-coll + new-coll renamed).
	if total < 2 {
		t.Errorf("total = %d, want >= 2", total)
	}
	if len(colls) < 2 {
		t.Errorf("len = %d, want >= 2", len(colls))
	}
}

// ── User Operations (always primary) ──

func TestMultiStore_UserOps_AlwaysPrimary(t *testing.T) {
	ms, primary, _, _, _, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	email := "test@example.com"
	u, err := ms.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Test User",
		Email:       &email,
		Type:        "human",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	got, err := ms.GetUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if got.DisplayName != "Test User" {
		t.Errorf("name = %q, want %q", got.DisplayName, "Test User")
	}

	gotName, err := ms.GetUserByName(ctx, "Test User")
	if err != nil {
		t.Fatalf("GetUserByName: %v", err)
	}
	if gotName.ID != u.ID {
		t.Errorf("ID = %v, want %v", gotName.ID, u.ID)
	}

	gotEmail, err := ms.GetUserByEmail(ctx, email)
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if len(gotEmail) != 1 {
		t.Fatalf("len = %d, want 1", len(gotEmail))
	}

	gotIDs, err := ms.GetUsersByIDs(ctx, []uuid.UUID{u.ID})
	if err != nil {
		t.Fatalf("GetUsersByIDs: %v", err)
	}
	if len(gotIDs) != 1 {
		t.Fatalf("len = %d, want 1", len(gotIDs))
	}

	users, total, err := ms.ListUsers(ctx, store.ListUsersParams{})
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if total < 1 {
		t.Errorf("total = %d, want >= 1", total)
	}
	if len(users) < 1 {
		t.Errorf("len = %d, want >= 1", len(users))
	}

	// Verify it's in primary.
	gotPrimary, err := primary.GetUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("primary.GetUser: %v", err)
	}
	if gotPrimary.DisplayName != "Test User" {
		t.Errorf("primary name = %q, want %q", gotPrimary.DisplayName, "Test User")
	}
}

// ── Token Operations (always primary) ──

func TestMultiStore_TokenOps_AlwaysPrimary(t *testing.T) {
	ms, _, _, _, _, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	u, err := ms.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Token User",
		Type:        "human",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	tok, rawToken, err := ms.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "test-token",
	})
	if err != nil {
		t.Fatalf("CreateAPIToken: %v", err)
	}
	if rawToken == "" {
		t.Fatal("raw token should not be empty")
	}

	tokenHash := store.HashToken(rawToken)
	looked, err := ms.LookupToken(ctx, tokenHash)
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if looked.ID != tok.ID {
		t.Errorf("ID = %v, want %v", looked.ID, tok.ID)
	}

	if err := ms.UpdateTokenLastUsed(ctx, tok.ID); err != nil {
		t.Fatalf("UpdateTokenLastUsed: %v", err)
	}

	tokens, total, err := ms.ListAPITokens(ctx, store.ListAPITokensParams{})
	if err != nil {
		t.Fatalf("ListAPITokens: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(tokens) != 1 {
		t.Errorf("len = %d, want 1", len(tokens))
	}

	if err := ms.RevokeAPIToken(ctx, tok.ID); err != nil {
		t.Fatalf("RevokeAPIToken: %v", err)
	}
}

// ── Graph Queries ──

func TestMultiStore_GetReadyTasks_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	_, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Ready", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageReady, NativeLabel: "ready", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	results, total, err := ms.GetReadyTasks(ctx, store.GetReadyTasksParams{CollectionID: &platCollID})
	if err != nil {
		t.Fatalf("GetReadyTasks: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(results) != 1 {
		t.Errorf("len = %d, want 1", len(results))
	}
}

func TestMultiStore_GetBlockedTasks_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	blocker, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Blocker", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask blocker: %v", err)
	}
	_, err = platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Blocked", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
		BlockedByTaskIDs: []uuid.UUID{blocker.ID},
	})
	if err != nil {
		t.Fatalf("CreateTask blocked: %v", err)
	}

	results, total, err := ms.GetBlockedTasks(ctx, store.GetBlockedTasksParams{CollectionID: &platCollID})
	if err != nil {
		t.Fatalf("GetBlockedTasks: %v", err)
	}
	if total < 1 {
		t.Errorf("total = %d, want >= 1", total)
	}
	if len(results) < 1 {
		t.Errorf("len = %d, want >= 1", len(results))
	}
}

// ── InsertTasksAfter ──

func TestMultiStore_InsertTasksAfter_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	anchor, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Anchor", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	result, err := ms.InsertTasksAfter(ctx, store.InsertTasksAfterParams{
		AnchorTaskID: anchor.ID,
		CollectionID: platCollID,
		ActorID:      uuid.New(),
		Reason:       "test insert",
		Steps: []store.CreateTaskParams{
			{Title: "Step 1", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task"},
		},
	})
	if err != nil {
		t.Fatalf("InsertTasksAfter: %v", err)
	}
	if len(result.InsertedTasks) != 1 {
		t.Errorf("inserted = %d, want 1", len(result.InsertedTasks))
	}
}

// ── Change Routing ──

func TestMultiStore_ListChanges_RoutesToPlatform(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	created, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "Change me", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	newTitle := "Changed"
	_, err = platform.UpdateTask(ctx, created.ID, store.UpdateTaskParams{Title: &newTitle}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	changes, total, err := ms.ListChanges(ctx, store.ListChangesParams{TaskID: created.ID})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	if total < 1 {
		t.Errorf("total = %d, want >= 1", total)
	}
	if len(changes) < 1 {
		t.Errorf("len = %d, want >= 1", len(changes))
	}
}

// ── Relationship Routing ──

func TestMultiStore_ListAllRelationshipsForCollection(t *testing.T) {
	ms, _, platform, _, platCollID, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	t1, err := platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "A", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = platform.CreateTask(ctx, store.CreateTaskParams{
		Title: "B", CollectionID: platCollID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
		BlocksTaskIDs: []uuid.UUID{t1.ID},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	rels, err := ms.ListAllRelationshipsForCollection(ctx, store.ListAllRelationshipsForCollectionParams{CollectionID: platCollID})
	if err != nil {
		t.Fatalf("ListAllRelationshipsForCollection: %v", err)
	}
	if len(rels) < 1 {
		t.Errorf("len = %d, want >= 1", len(rels))
	}
}

// ── RegisterPlatform / Unregistered Falls Through ──

func TestMultiStore_UnregisteredCollection_FallsToPrimary(t *testing.T) {
	ms, primary, _, _, _, cleanup := newMultiStoreSetup(t)
	defer cleanup()
	ctx := context.Background()

	// Create a collection not registered with any platform store.
	unknownColl, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "unknown",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}

	created, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title: "Falls through", CollectionID: unknownColl.ID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	got, err := primary.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("primary.GetTask: %v", err)
	}
	if got.Title != "Falls through" {
		t.Errorf("title = %q, want %q", got.Title, "Falls through")
	}
}

// ── Close ──

func TestMultiStore_Close(t *testing.T) {
	primary, _ := testutil.NewTestStore(t)
	platform, _ := testutil.NewTestStore(t)

	ms := store.NewMultiStore(primary)
	ms.RegisterPlatform(uuid.New(), platform)

	if err := ms.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
}

// ── Lazy Platform Registration ──

// newLazySetup creates a MultiStore with a PlatformResolver that
// returns a second EntStore when the collection platform is "github".
// It creates a github-platform collection with RemoteID "owner/repo"
// and a linked account, then wires up the resolver.
func newLazySetup(t *testing.T) (
	ms *store.MultiStore,
	primary *store.EntStore,
	lazyPlatform *store.EntStore,
	collID uuid.UUID,
	resolverCalls *atomic.Int32,
	cleanup func(),
) {
	t.Helper()
	primary, cleanPrimary := testutil.NewTestStore(t)
	lazyPlatform, cleanPlatform := testutil.NewTestStore(t)

	ctx := context.Background()

	// Create a github-typed collection in the primary store.
	coll, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "gh-coll",
		Platform: "github",
		RemoteID: "myowner/myrepo",
	})
	if err != nil {
		t.Fatalf("creating github collection: %v", err)
	}
	collID = coll.ID

	// Create the same collection in the lazy platform store so task
	// operations succeed (the resolver hands back this store).
	_, err = lazyPlatform.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "gh-coll",
		Platform: "github",
	})
	if err != nil {
		t.Fatalf("creating platform collection: %v", err)
	}

	// Create a linked account for this collection.
	_, err = primary.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "github",
		AuthToken:    "ghp_testtoken123",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("creating linked account: %v", err)
	}

	resolverCalls = &atomic.Int32{}
	ms = store.NewMultiStore(primary)
	ms.SetResolver(func(platform collection.Platform, token string, remoteID string, cid uuid.UUID) (store.Store, error) {
		resolverCalls.Add(1)
		if platform != collection.PlatformGithub {
			return nil, nil
		}
		// Verify the resolver receives correct parameters.
		if token != "ghp_testtoken123" {
			t.Errorf("resolver token = %q, want %q", token, "ghp_testtoken123")
		}
		if remoteID != "myowner/myrepo" {
			t.Errorf("resolver remoteID = %q, want %q", remoteID, "myowner/myrepo")
		}
		// Return the pre-created platform store.
		return lazyPlatform, nil
	})

	cleanup = func() {
		cleanPlatform()
		cleanPrimary()
	}
	return
}

func TestMultiStore_LazyRegistration_CreatesStoreOnFirstRequest(t *testing.T) {
	ms, _, lazyPlatform, collID, resolverCalls, cleanup := newLazySetup(t)
	defer cleanup()
	ctx := context.Background()

	// Create a task via the MultiStore — this should trigger lazy resolution.
	created, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Lazy task",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if created.Title != "Lazy task" {
		t.Errorf("title = %q, want %q", created.Title, "Lazy task")
	}

	// Verify the task exists in the lazy platform store.
	got, err := lazyPlatform.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("lazyPlatform.GetTask: %v", err)
	}
	if got.Title != "Lazy task" {
		t.Errorf("platform task title = %q, want %q", got.Title, "Lazy task")
	}

	// Resolver should have been called exactly once.
	if calls := resolverCalls.Load(); calls != 1 {
		t.Errorf("resolver calls = %d, want 1", calls)
	}
}

func TestMultiStore_LazyRegistration_CachesOnSecondRequest(t *testing.T) {
	ms, _, _, collID, resolverCalls, cleanup := newLazySetup(t)
	defer cleanup()
	ctx := context.Background()

	// First request — triggers lazy resolution.
	_, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "First",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask 1: %v", err)
	}

	// Second request — should use cached store.
	_, err = ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Second",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask 2: %v", err)
	}

	// Resolver should have been called exactly once (cached on second).
	if calls := resolverCalls.Load(); calls != 1 {
		t.Errorf("resolver calls = %d, want 1 (should cache)", calls)
	}
}

func TestMultiStore_LazyRegistration_NoLinkedAccountFallsToPrimary(t *testing.T) {
	primary, cleanPrimary := testutil.NewTestStore(t)
	defer cleanPrimary()
	ctx := context.Background()

	// Create a github collection without any linked account.
	coll, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "no-link",
		Platform: "github",
		RemoteID: "owner/repo",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	resolverCalls := &atomic.Int32{}
	ms := store.NewMultiStore(primary)
	ms.SetResolver(func(platform collection.Platform, token string, remoteID string, cid uuid.UUID) (store.Store, error) {
		resolverCalls.Add(1)
		t.Error("resolver should not be called when no linked account exists")
		return nil, nil
	})

	// Creating a task should fall through to primary since there's no
	// linked account — lazy resolution doesn't call the resolver.
	created, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Primary fallback",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	// Verify it went to primary.
	got, err := primary.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("primary.GetTask: %v", err)
	}
	if got.Title != "Primary fallback" {
		t.Errorf("title = %q, want %q", got.Title, "Primary fallback")
	}

	if calls := resolverCalls.Load(); calls != 0 {
		t.Errorf("resolver calls = %d, want 0", calls)
	}
}

func TestMultiStore_LazyRegistration_FarmtableSkipsResolver(t *testing.T) {
	primary, cleanPrimary := testutil.NewTestStore(t)
	defer cleanPrimary()
	ctx := context.Background()

	// Create a farmtable-native collection.
	coll, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "native",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	resolverCalls := &atomic.Int32{}
	ms := store.NewMultiStore(primary)
	ms.SetResolver(func(platform collection.Platform, token string, remoteID string, cid uuid.UUID) (store.Store, error) {
		resolverCalls.Add(1)
		t.Error("resolver should not be called for farmtable collections")
		return nil, nil
	})

	_, err = ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Native task",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	if calls := resolverCalls.Load(); calls != 0 {
		t.Errorf("resolver calls = %d, want 0", calls)
	}
}

func TestMultiStore_LazyRegistration_UnsupportedPlatformFallsToPrimary(t *testing.T) {
	primary, cleanPrimary := testutil.NewTestStore(t)
	defer cleanPrimary()
	ctx := context.Background()

	// Create a linear-typed collection.
	coll, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "linear-coll",
		Platform: "linear",
		RemoteID: "some-linear-id",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	// Create a linked account for it.
	_, err = primary.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: coll.ID,
		Platform:     "linear",
		AuthToken:    "lin_token",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("creating linked account: %v", err)
	}

	ms := store.NewMultiStore(primary)
	ms.SetResolver(func(platform collection.Platform, token string, remoteID string, cid uuid.UUID) (store.Store, error) {
		// Only support github, return nil for everything else.
		return nil, nil
	})

	// Should fall through to primary.
	created, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Linear fallback",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	got, err := primary.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("primary.GetTask: %v", err)
	}
	if got.Title != "Linear fallback" {
		t.Errorf("title = %q, want %q", got.Title, "Linear fallback")
	}
}

func TestMultiStore_LazyRegistration_NoResolverFallsToPrimary(t *testing.T) {
	primary, cleanPrimary := testutil.NewTestStore(t)
	defer cleanPrimary()
	ctx := context.Background()

	// Create a github collection with linked account but don't set a
	// resolver — lazy resolution should be a no-op.
	coll, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "no-resolver",
		Platform: "github",
		RemoteID: "owner/repo",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}
	_, err = primary.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: coll.ID,
		Platform:     "github",
		AuthToken:    "ghp_token",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("creating linked account: %v", err)
	}

	ms := store.NewMultiStore(primary)
	// No SetResolver call.

	created, err := ms.CreateTask(ctx, store.CreateTaskParams{
		Title:        "No resolver",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	// Should have gone to primary.
	got, err := primary.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("primary.GetTask: %v", err)
	}
	if got.Title != "No resolver" {
		t.Errorf("title = %q, want %q", got.Title, "No resolver")
	}
}

func TestMultiStore_LazyRegistration_ConcurrentSafety(t *testing.T) {
	primary, cleanPrimary := testutil.NewTestStore(t)
	defer cleanPrimary()
	ctx := context.Background()

	// Create a github collection with a linked account.
	coll, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "concurrent-coll",
		Platform: "github",
		RemoteID: "owner/repo",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}
	collID := coll.ID

	_, err = primary.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "github",
		AuthToken:    "ghp_concurrent",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("creating linked account: %v", err)
	}

	// The resolver creates a fresh in-memory store each invocation so
	// the Close() in the double-check path doesn't break the winner.
	var resolverCalls atomic.Int32
	ms := store.NewMultiStore(primary)
	ms.SetResolver(func(platform collection.Platform, token string, remoteID string, cid uuid.UUID) (store.Store, error) {
		resolverCalls.Add(1)
		s, clean := testutil.NewTestStore(t)
		t.Cleanup(clean)
		return s, nil
	})

	// Launch goroutines that all trigger lazy resolution concurrently.
	const goroutines = 10
	var wg sync.WaitGroup
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _ = ms.ListTasks(ctx, store.ListTasksParams{CollectionID: &collID})
		}()
	}
	wg.Wait()

	// Resolver may be called more than once due to races, but the
	// cache should ensure the same store is used after the first
	// registration. The main assertion is no panics or data races.
	if calls := resolverCalls.Load(); calls < 1 {
		t.Errorf("resolver calls = %d, want >= 1", calls)
	}
}

func TestParseOwnerRepo(t *testing.T) {
	tests := []struct {
		input     string
		wantOwner string
		wantRepo  string
		wantOK    bool
	}{
		{"owner/repo", "owner", "repo", true},
		{"org/my-project", "org", "my-project", true},
		{"owner/repo/extra", "owner", "repo/extra", true}, // SplitN(2)
		{"noslash", "", "", false},
		{"/repo", "", "", false},
		{"owner/", "", "", false},
		{"", "", "", false},
	}
	for _, tt := range tests {
		owner, repo, ok := store.ParseOwnerRepo(tt.input)
		if ok != tt.wantOK || owner != tt.wantOwner || repo != tt.wantRepo {
			t.Errorf("ParseOwnerRepo(%q) = (%q, %q, %v), want (%q, %q, %v)",
				tt.input, owner, repo, ok, tt.wantOwner, tt.wantRepo, tt.wantOK)
		}
	}
}
