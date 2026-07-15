package store_test

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

func createTestCollection(t *testing.T, s *store.EntStore) uuid.UUID {
	t.Helper()
	c, err := s.CreateCollection(context.Background(), store.CreateCollectionParams{
		Name:     "test",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}
	return c.ID
}

func TestCreateAndGetTask(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Test task",
		Description:  "A test",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if created.Title != "Test task" {
		t.Errorf("title = %q, want %q", created.Title, "Test task")
	}
	if created.Version != "1" {
		t.Errorf("version = %q, want %q", created.Version, "1")
	}

	got, err := s.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %v, want %v", got.ID, created.ID)
	}
	if got.Title != created.Title {
		t.Errorf("title = %q, want %q", got.Title, created.Title)
	}
	if got.Phase != task.PhaseOpen {
		t.Errorf("phase = %v, want %v", got.Phase, task.PhaseOpen)
	}
}

func TestGetTask_NotFound(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	_, err := s.GetTask(context.Background(), uuid.New())
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestListTasks_Filters(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	coll2, err := s.CreateCollection(ctx, store.CreateCollectionParams{Name: "other", Platform: "farmtable"})
	if err != nil {
		t.Fatalf("creating collection 2: %v", err)
	}
	collID2 := coll2.ID

	for i, tc := range []struct {
		title string
		coll  uuid.UUID
		phase task.Phase
		stage task.Stage
	}{
		{"open-triage", collID, task.PhaseOpen, task.StageTriage},
		{"open-backlog", collID, task.PhaseOpen, task.StageBacklog},
		{"in-progress-working", collID, task.PhaseInProgress, task.StageWorking},
		{"other-coll", collID2, task.PhaseOpen, task.StageTriage},
	} {
		_, err := s.CreateTask(ctx, store.CreateTaskParams{
			Title:        tc.title,
			CollectionID: tc.coll,
			Phase:        tc.phase,
			Stage:        tc.stage,
			NativeLabel:  string(tc.stage),
		})
		if err != nil {
			t.Fatalf("creating task %d: %v", i, err)
		}
	}

	t.Run("filter by collection", func(t *testing.T) {
		tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{CollectionID: &collID})
		if err != nil {
			t.Fatalf("ListTasks: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		if len(tasks) != 3 {
			t.Errorf("len(tasks) = %d, want 3", len(tasks))
		}
	})

	t.Run("filter by phase", func(t *testing.T) {
		phase := task.PhaseOpen
		tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{Phase: &phase})
		if err != nil {
			t.Fatalf("ListTasks: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		if len(tasks) != 3 {
			t.Errorf("len(tasks) = %d, want 3", len(tasks))
		}
	})

	t.Run("filter by stage", func(t *testing.T) {
		stage := task.StageWorking
		tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{Stage: &stage})
		if err != nil {
			t.Fatalf("ListTasks: %v", err)
		}
		if total != 1 {
			t.Errorf("total = %d, want 1", total)
		}
		if len(tasks) != 1 {
			t.Errorf("len(tasks) = %d, want 1", len(tasks))
		}
	})

	t.Run("filter by collection and phase", func(t *testing.T) {
		phase := task.PhaseOpen
		tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{
			CollectionID: &collID,
			Phase:        &phase,
		})
		if err != nil {
			t.Fatalf("ListTasks: %v", err)
		}
		if total != 2 {
			t.Errorf("total = %d, want 2", total)
		}
		if len(tasks) != 2 {
			t.Errorf("len(tasks) = %d, want 2", len(tasks))
		}
	})
}

func TestUpdateTask_CAS(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "CAS test",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	t.Run("correct version succeeds", func(t *testing.T) {
		newTitle := "Updated title"
		updated, err := s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
			Title:   &newTitle,
			Version: created.Version,
		}, uuid.Nil)
		if err != nil {
			t.Fatalf("UpdateTask: %v", err)
		}
		if updated.Title != "Updated title" {
			t.Errorf("title = %q, want %q", updated.Title, "Updated title")
		}
		if updated.Version != "2" {
			t.Errorf("version = %q, want %q", updated.Version, "2")
		}
	})

	t.Run("wrong version returns conflict", func(t *testing.T) {
		newTitle := "Should fail"
		_, err := s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
			Title:   &newTitle,
			Version: "1", // stale version
		}, uuid.Nil)
		if err != store.ErrConflict {
			t.Errorf("err = %v, want ErrConflict", err)
		}
	})

	t.Run("empty version does unconditional update", func(t *testing.T) {
		newTitle := "Unconditional"
		updated, err := s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
			Title: &newTitle,
		}, uuid.Nil)
		if err != nil {
			t.Fatalf("UpdateTask without version: %v", err)
		}
		if updated.Title != "Unconditional" {
			t.Errorf("title = %q, want %q", updated.Title, "Unconditional")
		}
		if updated.Version != "3" {
			t.Errorf("version = %q, want %q", updated.Version, "3")
		}
	})
}

func TestClaimTask(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Claim me",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	assignee := uuid.New()
	claimed, err := s.ClaimTask(ctx, created.ID, assignee, created.Version)
	if err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}
	if claimed.AssigneeID == nil || *claimed.AssigneeID != assignee {
		t.Errorf("assignee = %v, want %v", claimed.AssigneeID, assignee)
	}
	if claimed.Phase != task.PhaseInProgress {
		t.Errorf("phase = %v, want %v", claimed.Phase, task.PhaseInProgress)
	}
	if claimed.Stage != task.StageWorking {
		t.Errorf("stage = %v, want %v", claimed.Stage, task.StageWorking)
	}

	t.Run("already claimed returns error", func(t *testing.T) {
		_, err := s.ClaimTask(ctx, created.ID, uuid.New(), "")
		if err != store.ErrAlreadyClaimed {
			t.Errorf("err = %v, want ErrAlreadyClaimed", err)
		}
	})
}

func TestClaimTask_ClosedTask(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Close then claim",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	_, err = s.CloseTask(ctx, created.ID, task.StageCompleted, created.Version, uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	_, err = s.ClaimTask(ctx, created.ID, uuid.New(), "")
	if err != store.ErrAlreadyClosed {
		t.Errorf("err = %v, want ErrAlreadyClosed", err)
	}
}

func TestVersionIncrement_WithoutHook(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Version test",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if created.Version != "1" {
		t.Fatalf("initial version = %q, want %q", created.Version, "1")
	}

	newTitle := "v2"
	updated, err := s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		Title:   &newTitle,
		Version: "1",
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if updated.Version != "2" {
		t.Errorf("version after update = %q, want %q", updated.Version, "2")
	}

	claimed, err := s.ClaimTask(ctx, updated.ID, uuid.New(), "")
	if err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}
	if claimed.Version != "3" {
		t.Errorf("version after claim = %q, want %q", claimed.Version, "3")
	}

	closed, err := s.CloseTask(ctx, created.ID, task.StageCompleted, "", uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}
	if closed.Version != "4" {
		t.Errorf("version after close = %q, want %q", closed.Version, "4")
	}
}

func TestCloseTask(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)

	t.Run("close with valid stage", func(t *testing.T) {
		created, err := s.CreateTask(ctx, store.CreateTaskParams{
			Title:        "Close me",
			CollectionID: collID,
			Phase:        task.PhaseOpen,
			Stage:        task.StageTriage,
			NativeLabel:  "triage",
		})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}

		closed, err := s.CloseTask(ctx, created.ID, task.StageCompleted, created.Version, uuid.Nil)
		if err != nil {
			t.Fatalf("CloseTask: %v", err)
		}
		if closed.Phase != task.PhaseClosed {
			t.Errorf("phase = %v, want %v", closed.Phase, task.PhaseClosed)
		}
		if closed.Stage != task.StageCompleted {
			t.Errorf("stage = %v, want %v", closed.Stage, task.StageCompleted)
		}
		if closed.ClosedAt == nil {
			t.Error("closed_at should be set")
		}
	})

	t.Run("close with wont_fix", func(t *testing.T) {
		created, err := s.CreateTask(ctx, store.CreateTaskParams{
			Title:        "Won't fix",
			CollectionID: collID,
			Phase:        task.PhaseOpen,
			Stage:        task.StageTriage,
			NativeLabel:  "triage",
		})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}

		closed, err := s.CloseTask(ctx, created.ID, task.StageWontFix, created.Version, uuid.Nil)
		if err != nil {
			t.Fatalf("CloseTask: %v", err)
		}
		if closed.Stage != task.StageWontFix {
			t.Errorf("stage = %v, want %v", closed.Stage, task.StageWontFix)
		}
	})

	t.Run("close with invalid stage returns error", func(t *testing.T) {
		created, err := s.CreateTask(ctx, store.CreateTaskParams{
			Title:        "Bad close",
			CollectionID: collID,
			Phase:        task.PhaseOpen,
			Stage:        task.StageTriage,
			NativeLabel:  "triage",
		})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}

		_, err = s.CloseTask(ctx, created.ID, task.StageWorking, created.Version, uuid.Nil)
		if err == nil {
			t.Fatal("expected error for invalid close stage")
		}
	})
}

func TestCreateTask_WithLabelsAndDates(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	start := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	due := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)

	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task with labels and dates",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Labels:       []string{"backend", "urgent"},
		StartDate:    &start,
		DueDate:      &due,
		Repo:         "farmtable-io/farmtable",
		Branch:       "feature/wave1",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	got, err := s.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if len(got.Labels) != 2 {
		t.Errorf("labels count = %d, want 2", len(got.Labels))
	}
	if got.StartDate == nil || !got.StartDate.Equal(start) {
		t.Errorf("start_date = %v, want %v", got.StartDate, start)
	}
	if got.DueDate == nil || !got.DueDate.Equal(due) {
		t.Errorf("due_date = %v, want %v", got.DueDate, due)
	}
	if got.Repo != "farmtable-io/farmtable" {
		t.Errorf("repo = %q, want %q", got.Repo, "farmtable-io/farmtable")
	}
	if got.Branch != "feature/wave1" {
		t.Errorf("branch = %q, want %q", got.Branch, "feature/wave1")
	}
}

func TestUpdateTask_Labels(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Label test",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Labels:       []string{"alpha", "beta"},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	updated, err := s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		AddLabels:    []string{"gamma"},
		RemoveLabels: []string{"alpha"},
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	labels := updated.Labels
	sort.Strings(labels)
	if len(labels) != 2 {
		t.Fatalf("labels count = %d, want 2", len(labels))
	}
	if labels[0] != "beta" || labels[1] != "gamma" {
		t.Errorf("labels = %v, want [beta gamma]", labels)
	}
}

func TestUpdateTask_Dates(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	start := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Date test",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		StartDate:    &start,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if created.StartDate == nil {
		t.Fatal("start_date should be set after create")
	}

	due := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	updated, err := s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		DueDate:        &due,
		ClearStartDate: true,
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if updated.StartDate != nil {
		t.Error("start_date should be cleared")
	}
	if updated.DueDate == nil || !updated.DueDate.Equal(due) {
		t.Errorf("due_date = %v, want %v", updated.DueDate, due)
	}

	cleared, err := s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		ClearDueDate: true,
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask clear due: %v", err)
	}
	if cleared.DueDate != nil {
		t.Error("due_date should be cleared")
	}
}

func TestUpdateTask_Relationships(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	t1, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Blocker", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask t1: %v", err)
	}
	t2, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Blocked", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask t2: %v", err)
	}

	_, err = s.UpdateTask(ctx, t1.ID, store.UpdateTaskParams{
		AddBlocks: []uuid.UUID{t2.ID},
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask add blocks: %v", err)
	}

	got, err := s.GetTask(ctx, t1.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if len(got.Edges.SourceRelationships) != 1 {
		t.Fatalf("source_relationships count = %d, want 1", len(got.Edges.SourceRelationships))
	}
	if got.Edges.SourceRelationships[0].TargetTaskID != t2.ID {
		t.Errorf("target_task_id = %v, want %v", got.Edges.SourceRelationships[0].TargetTaskID, t2.ID)
	}

	_, err = s.UpdateTask(ctx, t1.ID, store.UpdateTaskParams{
		RemoveRelationships: []uuid.UUID{t2.ID},
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask remove relationship: %v", err)
	}

	got2, err := s.GetTask(ctx, t1.ID)
	if err != nil {
		t.Fatalf("GetTask after remove: %v", err)
	}
	if len(got2.Edges.SourceRelationships) != 0 {
		t.Errorf("source_relationships count = %d, want 0", len(got2.Edges.SourceRelationships))
	}
}

func TestInsertTasksAfter(t *testing.T) {
	runInsertTasksAfter(t, testutil.NewTestStore)
}

func TestInsertTasksAfter_NoDownstream(t *testing.T) {
	runInsertTasksAfterNoDownstream(t, testutil.NewTestStore)
}

func TestInsertTasksAfter_AnchorNotFound(t *testing.T) {
	runInsertTasksAfterAnchorNotFound(t, testutil.NewTestStore)
}

func TestInsertTasksAfter_EmptySteps(t *testing.T) {
	runInsertTasksAfterEmptySteps(t, testutil.NewTestStore)
}

func TestInsertTasksAfter_RollsBackOnFailure(t *testing.T) {
	runInsertTasksAfterRollsBackOnFailure(t, testutil.NewTestStore)
}

func TestListTasks_FilterByPriority(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	high := task.PriorityHigh
	low := task.PriorityLow

	_, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "High", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Priority: &high,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Low", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Priority: &low,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{Priority: &high})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(tasks) != 1 {
		t.Fatalf("len(tasks) = %d, want 1", len(tasks))
	}
	if tasks[0].Title != "High" {
		t.Errorf("title = %q, want %q", tasks[0].Title, "High")
	}
}

func TestListTasks_FilterByType(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	_, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Bug", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "bug",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Feature", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "feature",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	bugType := "bug"
	tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{Type: &bugType})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(tasks) != 1 {
		t.Fatalf("len(tasks) = %d, want 1", len(tasks))
	}
	if tasks[0].Title != "Bug" {
		t.Errorf("title = %q, want %q", tasks[0].Title, "Bug")
	}
}

func TestListTasks_FilterByLabels(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	_, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "AB", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
		Labels: []string{"alpha", "beta"},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "A only", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
		Labels: []string{"alpha"},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "No labels", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	tasks, _, err := s.ListTasks(ctx, store.ListTasksParams{Labels: []string{"alpha", "beta"}})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("len(tasks) = %d, want 1 (AND semantics)", len(tasks))
	}
	if tasks[0].Title != "AB" {
		t.Errorf("title = %q, want %q", tasks[0].Title, "AB")
	}
}

func TestListTasks_FilterByParent(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	parent, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Parent", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Child", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
		ParentTaskID: &parent.ID,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Orphan", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{ParentTaskID: &parent.ID})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(tasks) != 1 {
		t.Fatalf("len(tasks) = %d, want 1", len(tasks))
	}
	if tasks[0].Title != "Child" {
		t.Errorf("title = %q, want %q", tasks[0].Title, "Child")
	}
}

func TestListTasks_Sort(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)

	_, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "First", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Second", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	t.Run("created asc", func(t *testing.T) {
		tasks, _, err := s.ListTasks(ctx, store.ListTasksParams{
			CollectionID: &collID,
			SortField:    "created",
			SortOrder:    "asc",
		})
		if err != nil {
			t.Fatalf("ListTasks: %v", err)
		}
		if len(tasks) < 2 {
			t.Fatalf("len(tasks) = %d, want >= 2", len(tasks))
		}
		if tasks[0].Title != "First" {
			t.Errorf("first task = %q, want %q", tasks[0].Title, "First")
		}
	})

	t.Run("created desc", func(t *testing.T) {
		tasks, _, err := s.ListTasks(ctx, store.ListTasksParams{
			CollectionID: &collID,
			SortField:    "created",
			SortOrder:    "desc",
		})
		if err != nil {
			t.Fatalf("ListTasks: %v", err)
		}
		if len(tasks) < 2 {
			t.Fatalf("len(tasks) = %d, want >= 2", len(tasks))
		}
		if tasks[0].Title != "Second" {
			t.Errorf("first task = %q, want %q", tasks[0].Title, "Second")
		}
	})
}

func TestUpdateTask_ChangesRecorded(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Original",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	newTitle := "Updated"
	newStage := task.StageBacklog
	_, err = s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		Title: &newTitle,
		Stage: &newStage,
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	changes, total, err := s.ListChanges(ctx, store.ListChangesParams{TaskID: created.ID})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	if total < 2 {
		t.Fatalf("total changes = %d, want >= 2", total)
	}

	found := map[string]bool{}
	for _, c := range changes {
		found[c.FieldName] = true
		switch c.FieldName {
		case "title":
			if c.OldValue != "Original" || c.NewValue != "Updated" {
				t.Errorf("title change: old=%q new=%q", c.OldValue, c.NewValue)
			}
		case "stage":
			if c.OldValue != string(task.StageTriage) || c.NewValue != string(task.StageBacklog) {
				t.Errorf("stage change: old=%q new=%q", c.OldValue, c.NewValue)
			}
		}
		if c.AuthorID != uuid.Nil {
			t.Errorf("author_id = %v, want Nil for UpdateTask", c.AuthorID)
		}
	}
	if !found["title"] {
		t.Error("missing change record for title")
	}
	if !found["stage"] {
		t.Error("missing change record for stage")
	}
}

func TestClaimTask_ChangesRecorded(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Claim changes",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	assignee := uuid.New()
	_, err = s.ClaimTask(ctx, created.ID, assignee, "")
	if err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}

	changes, total, err := s.ListChanges(ctx, store.ListChangesParams{TaskID: created.ID})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	if total < 3 {
		t.Fatalf("total changes = %d, want >= 3 (phase, stage, assignee_id)", total)
	}

	found := map[string]bool{}
	for _, c := range changes {
		found[c.FieldName] = true
		switch c.FieldName {
		case "phase":
			if c.OldValue != string(task.PhaseOpen) || c.NewValue != string(task.PhaseInProgress) {
				t.Errorf("phase change: old=%q new=%q", c.OldValue, c.NewValue)
			}
		case "stage":
			if c.OldValue != string(task.StageTriage) || c.NewValue != string(task.StageWorking) {
				t.Errorf("stage change: old=%q new=%q", c.OldValue, c.NewValue)
			}
		case "assignee_id":
			if c.OldValue != "" || c.NewValue != assignee.String() {
				t.Errorf("assignee change: old=%q new=%q", c.OldValue, c.NewValue)
			}
		}
		if c.AuthorID != assignee {
			t.Errorf("author_id = %v, want %v for ClaimTask", c.AuthorID, assignee)
		}
	}
	if !found["phase"] {
		t.Error("missing change record for phase")
	}
	if !found["stage"] {
		t.Error("missing change record for stage")
	}
	if !found["assignee_id"] {
		t.Error("missing change record for assignee_id")
	}
}

func TestCloseTask_ChangesRecorded(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Close changes",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	_, err = s.CloseTask(ctx, created.ID, task.StageCompleted, "", uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	changes, total, err := s.ListChanges(ctx, store.ListChangesParams{TaskID: created.ID})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	if total < 3 {
		t.Fatalf("total changes = %d, want >= 3 (phase, stage, closed_at)", total)
	}

	found := map[string]bool{}
	for _, c := range changes {
		found[c.FieldName] = true
		switch c.FieldName {
		case "phase":
			if c.OldValue != string(task.PhaseOpen) || c.NewValue != string(task.PhaseClosed) {
				t.Errorf("phase change: old=%q new=%q", c.OldValue, c.NewValue)
			}
		case "stage":
			if c.OldValue != string(task.StageTriage) || c.NewValue != string(task.StageCompleted) {
				t.Errorf("stage change: old=%q new=%q", c.OldValue, c.NewValue)
			}
		case "closed_at":
			if c.OldValue != "" {
				t.Errorf("closed_at old = %q, want empty", c.OldValue)
			}
			if c.NewValue == "" {
				t.Error("closed_at new should not be empty")
			}
		}
		if c.AuthorID != uuid.Nil {
			t.Errorf("author_id = %v, want Nil for CloseTask", c.AuthorID)
		}
	}
	if !found["phase"] {
		t.Error("missing change record for phase")
	}
	if !found["stage"] {
		t.Error("missing change record for stage")
	}
	if !found["closed_at"] {
		t.Error("missing change record for closed_at")
	}
}

func TestListChanges_FieldFilter(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Filter test",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	newTitle := "Changed"
	newStage := task.StageBacklog
	_, err = s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		Title: &newTitle,
		Stage: &newStage,
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	changes, total, err := s.ListChanges(ctx, store.ListChangesParams{
		TaskID: created.ID,
		Field:  "title",
	})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(changes) != 1 {
		t.Fatalf("len(changes) = %d, want 1", len(changes))
	}
	if changes[0].FieldName != "title" {
		t.Errorf("field_name = %q, want %q", changes[0].FieldName, "title")
	}
}

func TestCreateTask_WithRelationships(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	target, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Target", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask target: %v", err)
	}

	source, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:         "Source",
		CollectionID:  collID,
		Phase:         task.PhaseOpen,
		Stage:         task.StageTriage,
		NativeLabel:   "triage",
		BlocksTaskIDs: []uuid.UUID{target.ID},
	})
	if err != nil {
		t.Fatalf("CreateTask source: %v", err)
	}

	got, err := s.GetTask(ctx, source.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if len(got.Edges.SourceRelationships) != 1 {
		t.Fatalf("source_relationships = %d, want 1", len(got.Edges.SourceRelationships))
	}
	if got.Edges.SourceRelationships[0].TargetTaskID != target.ID {
		t.Errorf("target_task_id = %v, want %v", got.Edges.SourceRelationships[0].TargetTaskID, target.ID)
	}
}

func TestCloseTask_AlreadyClosed(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Close twice",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	_, err = s.CloseTask(ctx, created.ID, task.StageCompleted, created.Version, uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	_, err = s.CloseTask(ctx, created.ID, task.StageCancelled, "", uuid.Nil)
	if err != store.ErrAlreadyClosed {
		t.Errorf("err = %v, want ErrAlreadyClosed", err)
	}
}

func TestRelationship_DuplicateIgnored(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	t1, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "A", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	t2, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "B", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	_, err = s.UpdateTask(ctx, t1.ID, store.UpdateTaskParams{
		AddBlocks: []uuid.UUID{t2.ID},
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("first AddBlocks: %v", err)
	}

	_, err = s.UpdateTask(ctx, t1.ID, store.UpdateTaskParams{
		AddBlocks: []uuid.UUID{t2.ID},
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("duplicate AddBlocks should not error: %v", err)
	}

	got, err := s.GetTask(ctx, t1.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if len(got.Edges.SourceRelationships) != 1 {
		t.Errorf("source_relationships = %d, want 1 (duplicate should be ignored)", len(got.Edges.SourceRelationships))
	}
}

func TestUpdateTask_LabelsChangeRecorded(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Label audit",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Labels:       []string{"alpha"},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	_, err = s.UpdateTask(ctx, created.ID, store.UpdateTaskParams{
		AddLabels: []string{"beta"},
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	changes, _, err := s.ListChanges(ctx, store.ListChangesParams{
		TaskID: created.ID,
		Field:  "labels",
	})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	if len(changes) != 1 {
		t.Fatalf("expected 1 labels change, got %d", len(changes))
	}
	if changes[0].OldValue == changes[0].NewValue {
		t.Error("old and new label values should differ")
	}
}

func TestListTasks_DefaultSort(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	_, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "First", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Second", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	tasks, _, err := s.ListTasks(ctx, store.ListTasksParams{CollectionID: &collID})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(tasks) < 2 {
		t.Fatalf("expected >= 2 tasks, got %d", len(tasks))
	}
	if tasks[0].CreatedAt.After(tasks[1].CreatedAt) {
		t.Error("default sort should be created_at ASC")
	}
}
