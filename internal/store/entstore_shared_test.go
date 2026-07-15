package store_test

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

func assertBlockTargets(t *testing.T, got *ent.Task, want ...uuid.UUID) {
	t.Helper()
	targets := make([]string, 0, len(got.Edges.SourceRelationships))
	for _, rel := range got.Edges.SourceRelationships {
		targets = append(targets, rel.TargetTaskID.String())
	}
	wantStrings := make([]string, 0, len(want))
	for _, id := range want {
		wantStrings = append(wantStrings, id.String())
	}
	sort.Strings(targets)
	sort.Strings(wantStrings)
	if len(targets) != len(wantStrings) {
		t.Fatalf("block targets = %v, want %v", targets, wantStrings)
	}
	for i := range targets {
		if targets[i] != wantStrings[i] {
			t.Fatalf("block targets = %v, want %v", targets, wantStrings)
		}
	}
}

type storeFactory func(t *testing.T) (*store.EntStore, func())

func runCreateAndGetTask(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runGetTaskNotFound(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
	defer cleanup()

	_, err := s.GetTask(context.Background(), uuid.New())
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func runListTasksFilters(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runUpdateTaskCAS(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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
			Version: "1",
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

func runClaimTask(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runClaimTaskClosedTask(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runCloseTask(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runCreateTaskWithLabelsAndDates(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runUpdateTaskLabels(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runUpdateTaskDates(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runUpdateTaskRelationships(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runInsertTasksAfter(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	anchor, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Test gate 1", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask anchor: %v", err)
	}
	deploy, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Deploy", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask deploy: %v", err)
	}
	_, err = s.UpdateTask(ctx, anchor.ID, store.UpdateTaskParams{
		AddBlocks: []uuid.UUID{deploy.ID},
	}, uuid.Nil)
	if err != nil {
		t.Fatalf("wire anchor to deploy: %v", err)
	}

	normal := task.PriorityNormal
	result, err := s.InsertTasksAfter(ctx, store.InsertTasksAfterParams{
		AnchorTaskID: anchor.ID,
		CollectionID: collID,
		ActorID:      uuid.Nil,
		Reason:       "tests failed",
		Steps: []store.CreateTaskParams{
			{Title: "Rework 2", Description: "Fix failing test", Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "bug", Priority: &normal, Labels: []string{"rework"}},
			{Title: "Test gate 2", Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task", Priority: &normal},
		},
	})
	if err != nil {
		t.Fatalf("InsertTasksAfter: %v", err)
	}
	if len(result.InsertedTasks) != 2 {
		t.Fatalf("inserted tasks = %d, want 2", len(result.InsertedTasks))
	}
	if result.InsertedTasks[0].Title != "Rework 2" || result.InsertedTasks[1].Title != "Test gate 2" {
		t.Fatalf("inserted task order = [%q, %q], want [Rework 2, Test gate 2]", result.InsertedTasks[0].Title, result.InsertedTasks[1].Title)
	}

	gotAnchor, err := s.GetTask(ctx, anchor.ID)
	if err != nil {
		t.Fatalf("GetTask anchor: %v", err)
	}
	if gotAnchor.Version != "3" {
		t.Errorf("anchor version = %q, want 3", gotAnchor.Version)
	}
	assertBlockTargets(t, gotAnchor, result.InsertedTasks[0].ID)

	gotFirst, err := s.GetTask(ctx, result.InsertedTasks[0].ID)
	if err != nil {
		t.Fatalf("GetTask first inserted: %v", err)
	}
	assertBlockTargets(t, gotFirst, result.InsertedTasks[1].ID)

	gotLast, err := s.GetTask(ctx, result.InsertedTasks[1].ID)
	if err != nil {
		t.Fatalf("GetTask last inserted: %v", err)
	}
	assertBlockTargets(t, gotLast, deploy.ID)
}

func runInsertTasksAfterNoDownstream(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	anchor, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Anchor", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask anchor: %v", err)
	}

	result, err := s.InsertTasksAfter(ctx, store.InsertTasksAfterParams{
		AnchorTaskID: anchor.ID,
		CollectionID: collID,
		Steps: []store.CreateTaskParams{
			{Title: "Follow-up", Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task"},
		},
	})
	if err != nil {
		t.Fatalf("InsertTasksAfter: %v", err)
	}
	if len(result.InsertedTasks) != 1 {
		t.Fatalf("inserted tasks = %d, want 1", len(result.InsertedTasks))
	}
	gotAnchor, err := s.GetTask(ctx, anchor.ID)
	if err != nil {
		t.Fatalf("GetTask anchor: %v", err)
	}
	assertBlockTargets(t, gotAnchor, result.InsertedTasks[0].ID)
	gotInserted, err := s.GetTask(ctx, result.InsertedTasks[0].ID)
	if err != nil {
		t.Fatalf("GetTask inserted: %v", err)
	}
	assertBlockTargets(t, gotInserted)
}

func runInsertTasksAfterAnchorNotFound(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
	defer cleanup()
	collID := createTestCollection(t, s)

	_, err := s.InsertTasksAfter(context.Background(), store.InsertTasksAfterParams{
		AnchorTaskID: uuid.New(),
		CollectionID: collID,
		Steps: []store.CreateTaskParams{
			{Title: "Follow-up", Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage"},
		},
	})
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func runInsertTasksAfterEmptySteps(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
	defer cleanup()
	collID := createTestCollection(t, s)

	_, err := s.InsertTasksAfter(context.Background(), store.InsertTasksAfterParams{
		AnchorTaskID: uuid.New(),
		CollectionID: collID,
	})
	if err != store.ErrInvalidArgument {
		t.Errorf("err = %v, want ErrInvalidArgument", err)
	}
}

func runInsertTasksAfterRollsBackOnFailure(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	anchor, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Anchor", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask anchor: %v", err)
	}
	deploy, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title: "Deploy", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask deploy: %v", err)
	}
	_, err = s.UpdateTask(ctx, anchor.ID, store.UpdateTaskParams{AddBlocks: []uuid.UUID{deploy.ID}}, uuid.Nil)
	if err != nil {
		t.Fatalf("wire anchor to deploy: %v", err)
	}

	_, err = s.InsertTasksAfter(ctx, store.InsertTasksAfterParams{
		AnchorTaskID: anchor.ID,
		CollectionID: collID,
		Steps: []store.CreateTaskParams{
			{Title: "Valid intermediate", Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task"},
			{Title: "", Phase: task.PhaseOpen, Stage: task.StageTriage, NativeLabel: "triage", Type: "task"},
		},
	})
	if err == nil {
		t.Fatal("expected insert failure")
	}

	gotAnchor, err := s.GetTask(ctx, anchor.ID)
	if err != nil {
		t.Fatalf("GetTask anchor: %v", err)
	}
	assertBlockTargets(t, gotAnchor, deploy.ID)

	tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{CollectionID: &collID})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if total != 2 || len(tasks) != 2 {
		t.Fatalf("task count after rollback = total %d len %d, want 2", total, len(tasks))
	}
}

func runVersionIncrement(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runUpdateTaskChangesRecorded(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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
	}
	if !found["title"] {
		t.Error("missing change record for title")
	}
	if !found["stage"] {
		t.Error("missing change record for stage")
	}
}

func runCreateTaskWithRelationships(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runCloseTaskAlreadyClosed(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runRelationshipDuplicateIgnored(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runListTasksSort(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
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

func runDeleteTask(t *testing.T, newStore storeFactory) {
	s, cleanup := newStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Delete me",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	err = s.DeleteTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}

	_, err = s.GetTask(ctx, created.ID)
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound after delete", err)
	}

	err = s.DeleteTask(ctx, created.ID)
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound for double delete", err)
	}
}
