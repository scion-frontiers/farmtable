package store

import (
	"context"
	"database/sql"
	"testing"

	entsql "entgo.io/ent/dialect/sql"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/predicate"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

func TestStartupMigration_StaleReplayDoesNotOverwritePostMigrationClaim(t *testing.T) {
	ctx := context.Background()
	s, dbPath := newMigrationTestStore(t, ctx)
	defer s.Close()

	collID := createMigrationTestCollection(t, ctx, s)
	created, err := s.CreateTask(ctx, CreateTaskParams{
		Title:        "stale ready task",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageAccepted,
		NativeLabel:  "ready",
	})
	if err != nil {
		t.Fatalf("creating task: %v", err)
	}
	setPersistedTaskStateForMigrationTest(t, dbPath, created.ID, "open", "ready")

	staleTasks := queryOldPersistedTaskStatesForMigrationTest(t, ctx, s.client)
	if err := migratePersistedTaskStates(ctx, s.client, staleTasks); err != nil {
		t.Fatalf("first migration: %v", err)
	}
	if _, err := s.ClaimTask(ctx, created.ID, uuid.New(), ""); err != nil {
		t.Fatalf("claiming migrated task: %v", err)
	}

	if err := migratePersistedTaskStates(ctx, s.client, staleTasks); err != nil {
		t.Fatalf("stale replay migration: %v", err)
	}

	got, err := s.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.Stage != task.StageWorking || got.Phase != task.PhaseInProgress {
		t.Fatalf("stale replay moved task to %s/%s, want in_progress/working", got.Phase, got.Stage)
	}
	if notes := countMigrationNotesForTask(t, dbPath, created.ID); notes != 1 {
		t.Fatalf("migration notes = %d, want 1", notes)
	}
}

func TestStartupMigration_ConditionalWriteNotesOnlyActuallyUpdatedRows(t *testing.T) {
	ctx := context.Background()
	s, dbPath := newMigrationTestStore(t, ctx)
	defer s.Close()

	collID := createMigrationTestCollection(t, ctx, s)
	updated, err := s.CreateTask(ctx, CreateTaskParams{
		Title:        "still old at write time",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageAccepted,
		NativeLabel:  "ready",
	})
	if err != nil {
		t.Fatalf("creating updated task: %v", err)
	}
	skipped, err := s.CreateTask(ctx, CreateTaskParams{
		Title:        "changed before stale write",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageAccepted,
		NativeLabel:  "ready",
	})
	if err != nil {
		t.Fatalf("creating skipped task: %v", err)
	}
	setPersistedTaskStateForMigrationTest(t, dbPath, updated.ID, "open", "ready")
	setPersistedTaskStateForMigrationTest(t, dbPath, skipped.ID, "open", "ready")

	staleTasks := queryOldPersistedTaskStatesForMigrationTest(t, ctx, s.client)
	setPersistedTaskStateForMigrationTest(t, dbPath, skipped.ID, "in_progress", "working")

	if err := migratePersistedTaskStates(ctx, s.client, staleTasks); err != nil {
		t.Fatalf("stale migration: %v", err)
	}

	gotUpdated, err := s.GetTask(ctx, updated.ID)
	if err != nil {
		t.Fatalf("GetTask updated: %v", err)
	}
	if gotUpdated.Stage != task.StageAccepted || gotUpdated.Phase != task.PhaseOpen {
		t.Fatalf("updated task state = %s/%s, want open/accepted", gotUpdated.Phase, gotUpdated.Stage)
	}
	gotSkipped, err := s.GetTask(ctx, skipped.ID)
	if err != nil {
		t.Fatalf("GetTask skipped: %v", err)
	}
	if gotSkipped.Stage != task.StageWorking || gotSkipped.Phase != task.PhaseInProgress {
		t.Fatalf("skipped task state = %s/%s, want in_progress/working", gotSkipped.Phase, gotSkipped.Stage)
	}
	if notes := countMigrationNotesForTask(t, dbPath, updated.ID); notes != 1 {
		t.Fatalf("updated task migration notes = %d, want 1", notes)
	}
	if notes := countMigrationNotesForTask(t, dbPath, skipped.ID); notes != 0 {
		t.Fatalf("skipped task migration notes = %d, want 0", notes)
	}
}

func TestStartupMigration_DoesNotDuplicateExistingMigrationNote(t *testing.T) {
	ctx := context.Background()
	s, dbPath := newMigrationTestStore(t, ctx)
	defer s.Close()

	collID := createMigrationTestCollection(t, ctx, s)
	created, err := s.CreateTask(ctx, CreateTaskParams{
		Title:        "old row with existing note",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageAccepted,
		NativeLabel:  "ready",
	})
	if err != nil {
		t.Fatalf("creating task: %v", err)
	}
	setPersistedTaskStateForMigrationTest(t, dbPath, created.ID, "open", "ready")
	if _, err := s.client.Change.Create().
		SetTaskID(created.ID).
		SetAuthorID(uuid.Nil).
		SetFieldName(taskStateMigrationField).
		SetOldValue(`{"stage":"ready"}`).
		SetNewValue(`{"stage":"accepted","reason":"existing"}`).
		Save(ctx); err != nil {
		t.Fatalf("creating existing migration note: %v", err)
	}

	if err := migratePersistedTaskState(ctx, s.client, nil, "sqlite3"); err != nil {
		t.Fatalf("migration: %v", err)
	}

	got, err := s.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.Stage != task.StageAccepted || got.Phase != task.PhaseOpen {
		t.Fatalf("task state = %s/%s, want open/accepted", got.Phase, got.Stage)
	}
	if notes := countMigrationNotesForTask(t, dbPath, created.ID); notes != 1 {
		t.Fatalf("migration notes = %d, want existing single note", notes)
	}
}

func newMigrationTestStore(t *testing.T, ctx context.Context) (*EntStore, string) {
	t.Helper()
	dbPath := t.TempDir() + "/farmtable.db"
	s, err := NewEntStore(ctx, StoreOptions{
		Dialect: "sqlite3",
		DSN:     dbPath + "?_fk=1",
		Migrate: true,
	})
	if err != nil {
		t.Fatalf("creating store: %v", err)
	}
	return s, dbPath
}

func createMigrationTestCollection(t *testing.T, ctx context.Context, s *EntStore) uuid.UUID {
	t.Helper()
	c, err := s.CreateCollection(ctx, CreateCollectionParams{
		Name:     "migration-test",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}
	return c.ID
}

func queryOldPersistedTaskStatesForMigrationTest(t *testing.T, ctx context.Context, client *ent.Client) []*ent.Task {
	t.Helper()
	tasks, err := client.Task.Query().
		Where(predicate.Task(func(s *entsql.Selector) {
			s.Where(entsql.In(s.C(task.FieldStage), oldPersistedTaskStageValues()...))
		})).
		WithSourceRelationships().
		WithTargetRelationships().
		All(ctx)
	if err != nil {
		t.Fatalf("querying old persisted task states: %v", err)
	}
	return tasks
}

func setPersistedTaskStateForMigrationTest(t *testing.T, dbPath string, id uuid.UUID, phase, stage string) {
	t.Helper()
	db, err := sql.Open("sqlite3", dbPath+"?_fk=1")
	if err != nil {
		t.Fatalf("opening sqlite db: %v", err)
	}
	defer db.Close()
	if _, err := db.Exec(`UPDATE tasks SET phase = ?, stage = ?, hold_reason = NULL WHERE id = ?`, phase, stage, id.String()); err != nil {
		t.Fatalf("setting persisted task state %s/%s for %s: %v", phase, stage, id, err)
	}
}

func countMigrationNotesForTask(t *testing.T, dbPath string, id uuid.UUID) int {
	t.Helper()
	db, err := sql.Open("sqlite3", dbPath+"?_fk=1")
	if err != nil {
		t.Fatalf("opening sqlite db: %v", err)
	}
	defer db.Close()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM changes WHERE task_id = ? AND field_name = ?`, id.String(), taskStateMigrationField).Scan(&count); err != nil {
		t.Fatalf("counting migration notes for %s: %v", id, err)
	}
	return count
}
