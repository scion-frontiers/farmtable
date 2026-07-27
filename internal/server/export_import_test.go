package server_test

import (
	"context"
	"encoding/json"
	"net"
	"reflect"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

type testExportDoc struct {
	FormatVersion int                      `json:"format_version"`
	ExportedAt    time.Time                `json:"exported_at"`
	Generator     string                   `json:"generator"`
	Collection    map[string]interface{}   `json:"collection"`
	Users         []map[string]interface{} `json:"users"`
	Tasks         []map[string]interface{} `json:"tasks"`
	Comments      []map[string]interface{} `json:"comments"`
	Relationships []map[string]interface{} `json:"relationships"`
	Changes       []map[string]interface{} `json:"changes"`
}

func assertJSONMapEqual(t *testing.T, name string, got, want map[string]interface{}) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s payload = %#v, want %#v", name, got, want)
	}
}

func newExportImportTestServer(t *testing.T) (pb.FarmTableServiceClient, *store.EntStore, func()) {
	t.Helper()
	s, storeCleanup := testutil.NewTestStore(t)
	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(
		grpc.MaxRecvMsgSize(64<<20),
		grpc.MaxSendMsgSize(64<<20),
	)
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "test"))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(64<<20),
			grpc.MaxCallSendMsgSize(64<<20),
		),
	)
	if err != nil {
		srv.Stop()
		storeCleanup()
		t.Fatalf("dialing bufconn: %v", err)
	}

	return pb.NewFarmTableServiceClient(conn), s, func() {
		conn.Close()
		srv.Stop()
		storeCleanup()
	}
}

func TestRPC_ExportImportCollection_RoundTrip(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	alice, err := s.CreateUser(ctx, store.CreateUserParams{DisplayName: "Alice", Email: strPtr("alice@example.com"), Type: "human", Status: "active"})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	coll, err := client.CreateCollection(ctx, &pb.CreateCollectionRequest{Name: "source"})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	high := pb.TaskPriority_TASK_PRIORITY_HIGH
	parent, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: coll.GetId(),
		Name:         "Parent",
		Description:  strPtr("parent description"),
		Priority:     &high,
		AssigneeIds:  []string{alice.ID.String()},
		Labels:       []string{"backend", "export"},
	})
	if err != nil {
		t.Fatalf("CreateTask parent: %v", err)
	}
	child, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: coll.GetId(),
		Name:         "Child",
		ParentTaskId: strPtr(parent.GetId()),
	})
	if err != nil {
		t.Fatalf("CreateTask child: %v", err)
	}
	if _, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{Id: parent.GetId(), Version: strPtr(parent.GetVersion()), AddBlocks: []string{child.GetId()}}); err != nil {
		t.Fatalf("UpdateTask AddBlocks: %v", err)
	}
	if _, err := s.UpdateTask(ctx, uuid.MustParse(parent.GetId()), store.UpdateTaskParams{
		AcceptanceCriteria: strPtr("done means exported changes survive"),
	}, alice.ID); err != nil {
		t.Fatalf("UpdateTask acceptance criteria: %v", err)
	}
	if _, err := s.AddComment(ctx, store.AddCommentParams{TaskID: uuid.MustParse(parent.GetId()), AuthorID: alice.ID, Body: "Looks ready"}); err != nil {
		t.Fatalf("AddComment: %v", err)
	}

	exported, err := client.ExportCollection(ctx, &pb.ExportCollectionRequest{Id: coll.GetId(), IncludeChanges: true})
	if err != nil {
		t.Fatalf("ExportCollection: %v", err)
	}
	var exportedDoc testExportDoc
	if err := json.Unmarshal(exported.GetData(), &exportedDoc); err != nil {
		t.Fatalf("unmarshal export: %v", err)
	}
	if len(exportedDoc.Changes) != 1 {
		t.Fatalf("exported changes = %d, want 1", len(exportedDoc.Changes))
	}
	originalChangeID := exportedDoc.Changes[0]["id"].(string)
	imported, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: exported.GetData(), Name: strPtr("restored")})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	if imported.GetCollectionId() == "" || imported.GetCollectionId() == coll.GetId() {
		t.Fatalf("collection_id = %q, want new non-empty id", imported.GetCollectionId())
	}
	if imported.GetStats().GetTasks() != 2 || imported.GetStats().GetComments() != 1 || imported.GetStats().GetRelationships() != 1 {
		t.Fatalf("stats = %+v, want 2 tasks, 1 comment, 1 relationship", imported.GetStats())
	}
	if imported.GetStats().GetChanges() != 1 {
		t.Fatalf("changes = %d, want 1", imported.GetStats().GetChanges())
	}
	if imported.GetStats().GetUsersMatched() != 1 {
		t.Fatalf("users_matched = %d, want 1", imported.GetStats().GetUsersMatched())
	}

	tasks, err := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: uuid.MustParse(imported.GetCollectionId())})
	if err != nil {
		t.Fatalf("ListAllTasksForCollection: %v", err)
	}
	if len(tasks) != 2 {
		t.Fatalf("imported task count = %d, want 2", len(tasks))
	}
	byTitle := map[string]*ent.Task{}
	for _, importedTask := range tasks {
		if importedTask.ID.String() == parent.GetId() || importedTask.ID.String() == child.GetId() {
			t.Fatalf("import preserved original task UUID %s", importedTask.ID)
		}
		if importedTask.Version != "1" {
			t.Fatalf("task %s version = %q, want 1", importedTask.Title, importedTask.Version)
		}
		byTitle[importedTask.Title] = importedTask
	}
	if byTitle["Parent"].AssigneeID == nil || *byTitle["Parent"].AssigneeID != alice.ID {
		t.Fatalf("parent assignee = %v, want %s", byTitle["Parent"].AssigneeID, alice.ID)
	}
	if byTitle["Child"].ParentTaskID == nil || *byTitle["Child"].ParentTaskID != byTitle["Parent"].ID {
		t.Fatalf("child parent = %v, want %s", byTitle["Child"].ParentTaskID, byTitle["Parent"].ID)
	}
	comments, err := s.ListAllCommentsForTask(ctx, store.ListAllCommentsForTaskParams{TaskID: byTitle["Parent"].ID})
	if err != nil {
		t.Fatalf("ListAllCommentsForTask: %v", err)
	}
	if len(comments) != 1 || comments[0].Body != "Looks ready" || comments[0].AuthorID != alice.ID {
		t.Fatalf("imported comments = %+v, want one Alice comment", comments)
	}
	changes, err := s.ListAllChangesForTask(ctx, store.ListAllChangesForTaskParams{TaskID: byTitle["Parent"].ID})
	if err != nil {
		t.Fatalf("ListAllChangesForTask: %v", err)
	}
	if len(changes) != 1 || changes[0].FieldName != "acceptance_criteria" || changes[0].AuthorID != alice.ID {
		t.Fatalf("imported changes = %+v, want one Alice acceptance_criteria change", changes)
	}
	if changes[0].ID.String() == originalChangeID {
		t.Fatalf("change id was not remapped: %s", changes[0].ID)
	}
	rels, err := s.ListAllRelationshipsForCollection(ctx, store.ListAllRelationshipsForCollectionParams{CollectionID: uuid.MustParse(imported.GetCollectionId())})
	if err != nil {
		t.Fatalf("ListAllRelationshipsForCollection: %v", err)
	}
	if len(rels) != 1 || rels[0].SourceTaskID != byTitle["Parent"].ID || rels[0].TargetTaskID != byTitle["Child"].ID {
		t.Fatalf("imported relationships = %+v, want Parent blocks Child", rels)
	}
}

func TestRPC_ExportCollection_DropsCrossCollectionRelationships(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collA, _ := client.CreateCollection(ctx, &pb.CreateCollectionRequest{Name: "A"})
	collB, _ := client.CreateCollection(ctx, &pb.CreateCollectionRequest{Name: "B"})
	taskA, _ := client.CreateTask(ctx, &pb.CreateTaskRequest{CollectionId: collA.GetId(), Name: "A"})
	taskB, _ := client.CreateTask(ctx, &pb.CreateTaskRequest{CollectionId: collB.GetId(), Name: "B"})
	if _, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{Id: taskA.GetId(), Version: strPtr(taskA.GetVersion()), AddBlocks: []string{taskB.GetId()}}); err != nil {
		t.Fatalf("UpdateTask AddBlocks: %v", err)
	}

	exported, err := client.ExportCollection(ctx, &pb.ExportCollectionRequest{Id: collA.GetId()})
	if err != nil {
		t.Fatalf("ExportCollection: %v", err)
	}
	if len(exported.GetWarnings()) != 1 {
		t.Fatalf("warnings = %v, want one warning", exported.GetWarnings())
	}
	var doc testExportDoc
	if err := json.Unmarshal(exported.GetData(), &doc); err != nil {
		t.Fatalf("unmarshal export: %v", err)
	}
	if doc.Users == nil {
		t.Fatal("users = nil, want empty array")
	}
	if len(doc.Relationships) != 0 {
		t.Fatalf("relationships exported = %d, want 0", len(doc.Relationships))
	}
}

func TestRPC_ImportCollection_MatchesUserByEmail(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	existing, err := s.CreateUser(ctx, store.CreateUserParams{DisplayName: "Existing Alice", Email: strPtr("alice@example.com"), Type: "human", Status: "active"})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	userID := uuid.New().String()
	taskID := uuid.New().String()
	commentID := uuid.New().String()
	doc := minimalImportDoc("email match", []map[string]interface{}{
		{"id": userID, "display_name": "Export Alice", "email": "alice@example.com", "type": "human", "status": "active"},
	}, []map[string]interface{}{
		{"id": taskID, "title": "Task", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
	}, []map[string]interface{}{
		{"id": commentID, "task_id": taskID, "author_id": userID, "body": "from export"},
	}, nil, nil)
	data, _ := json.Marshal(doc)

	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	if resp.GetStats().GetUsersMatched() != 1 || resp.GetStats().GetUsersCreated() != 0 {
		t.Fatalf("stats = %+v, want one matched user", resp.GetStats())
	}
	tasks, _ := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: uuid.MustParse(resp.GetCollectionId())})
	comments, _ := s.ListAllCommentsForTask(ctx, store.ListAllCommentsForTaskParams{TaskID: tasks[0].ID})
	if len(comments) != 1 || comments[0].AuthorID != existing.ID {
		t.Fatalf("comment author = %+v, want existing user %s", comments, existing.ID)
	}
}

func TestRPC_ImportCollection_DryRunDoesNotCreateCollection(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	userID := uuid.New().String()
	taskID := uuid.New().String()
	doc := minimalImportDoc("dry run", []map[string]interface{}{
		{"id": userID, "display_name": "Dry Run User", "email": "dryrun@example.com", "type": "human", "status": "active"},
	}, []map[string]interface{}{
		{"id": taskID, "title": "Task", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "assignee_id": userID, "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
	}, nil, nil, nil)
	data, _ := json.Marshal(doc)

	before, _ := client.ListCollections(ctx, &pb.ListCollectionsRequest{PageSize: 200})
	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data, DryRun: true})
	if err != nil {
		t.Fatalf("ImportCollection dry-run: %v", err)
	}
	after, _ := client.ListCollections(ctx, &pb.ListCollectionsRequest{PageSize: 200})
	if resp.GetCollectionId() != "" {
		t.Fatalf("collection_id = %q, want empty for dry-run", resp.GetCollectionId())
	}
	if resp.GetStats().GetTasks() != 1 {
		t.Fatalf("tasks = %d, want 1", resp.GetStats().GetTasks())
	}
	if resp.GetStats().GetUsersCreated() != 1 {
		t.Fatalf("users_created = %d, want 1", resp.GetStats().GetUsersCreated())
	}
	if len(resp.GetWarnings()) != 1 || resp.GetWarnings()[0] != "Would create 1 new users" {
		t.Fatalf("warnings = %v, want dry-run would-create warning", resp.GetWarnings())
	}
	if before.GetTotalCount() != after.GetTotalCount() {
		t.Fatalf("collection count changed from %d to %d during dry-run", before.GetTotalCount(), after.GetTotalCount())
	}
}

func TestRPC_ImportCollection_MigratesOldTaskStatesWithNotes(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()
	now := time.Now().UTC()
	future := now.Add(24 * time.Hour)

	ids := map[string]string{
		"ready":             uuid.New().String(),
		"blocked_with":      uuid.New().String(),
		"blocker":           uuid.New().String(),
		"blocked_without":   uuid.New().String(),
		"scheduled_with":    uuid.New().String(),
		"scheduled_without": uuid.New().String(),
		"deferred_future":   uuid.New().String(),
		"adapter_blocked":   uuid.New().String(),
	}
	taskDoc := func(key, stage string, start *time.Time, nativeLabel string) map[string]interface{} {
		return map[string]interface{}{
			"id": ids[key], "title": key, "description": "", "phase": "open", "stage": stage,
			"native_label": nativeLabel, "type": "", "labels": []string{}, "repo": "", "branch": "",
			"pull_requests": []map[string]string{}, "remote_data": map[string]interface{}{},
			"start_date": start,
		}
	}
	tasks := []map[string]interface{}{
		taskDoc("ready", "ready", nil, "ready"),
		taskDoc("blocker", "accepted", nil, "accepted"),
		taskDoc("blocked_with", "blocked", nil, "blocked"),
		taskDoc("blocked_without", "blocked", nil, "blocked"),
		taskDoc("scheduled_with", "scheduled", &future, "scheduled"),
		taskDoc("scheduled_without", "scheduled", nil, "scheduled"),
		taskDoc("deferred_future", "deferred", &future, "deferred"),
		taskDoc("adapter_blocked", "blocked", nil, "beads:blocked"),
	}
	doc := minimalImportDoc("old states", nil, tasks, nil, []map[string]interface{}{
		{"id": uuid.New().String(), "source_task_id": ids["blocked_with"], "target_task_id": ids["blocker"], "type": "blocked_by"},
	}, nil)
	data, _ := json.Marshal(doc)

	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	collID := uuid.MustParse(resp.GetCollectionId())
	imported, err := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: collID})
	if err != nil {
		t.Fatalf("ListAllTasksForCollection: %v", err)
	}
	byTitle := map[string]*ent.Task{}
	for _, tsk := range imported {
		byTitle[tsk.Title] = tsk
		if tsk.Stage.String() != "accepted" {
			t.Fatalf("%s stage = %q, want accepted", tsk.Title, tsk.Stage)
		}
	}
	if byTitle["blocked_without"].HoldReason == nil || byTitle["blocked_without"].HoldReason.String() != "waiting_for_input" {
		t.Fatalf("blocked_without hold_reason = %v, want waiting_for_input", byTitle["blocked_without"].HoldReason)
	}
	if byTitle["scheduled_without"].HoldReason == nil || byTitle["scheduled_without"].HoldReason.String() != "deferred" {
		t.Fatalf("scheduled_without hold_reason = %v, want deferred", byTitle["scheduled_without"].HoldReason)
	}
	if byTitle["deferred_future"].HoldReason != nil {
		t.Fatalf("deferred_future hold_reason = %v, want nil because future start_date is concrete scheduling", byTitle["deferred_future"].HoldReason)
	}

	wantNotes := map[string]struct {
		old map[string]interface{}
		new map[string]interface{}
	}{
		"ready": {
			old: map[string]interface{}{"phase": "open", "stage": "ready", "native_label": "ready", "start_date": nil, "has_blocker": false},
			new: map[string]interface{}{"stage": "accepted", "reason": "old_ready_stage_to_accepted"},
		},
		"blocked_with": {
			old: map[string]interface{}{"phase": "open", "stage": "blocked", "native_label": "blocked", "start_date": nil, "has_blocker": true},
			new: map[string]interface{}{"stage": "accepted", "reason": "old_blocked_stage_with_blocker_to_dependency_availability"},
		},
		"blocked_without": {
			old: map[string]interface{}{"phase": "open", "stage": "blocked", "native_label": "blocked", "start_date": nil, "has_blocker": false},
			new: map[string]interface{}{"stage": "accepted", "hold_reason": "waiting_for_input", "reason": "old_blocked_stage_without_blocker_to_waiting_for_input"},
		},
		"scheduled_with": {
			old: map[string]interface{}{"phase": "open", "stage": "scheduled", "native_label": "scheduled", "start_date": future.Format(time.RFC3339Nano), "has_blocker": false},
			new: map[string]interface{}{"stage": "accepted", "reason": "old_scheduled_stage_with_start_date"},
		},
		"scheduled_without": {
			old: map[string]interface{}{"phase": "open", "stage": "scheduled", "native_label": "scheduled", "start_date": nil, "has_blocker": false},
			new: map[string]interface{}{"stage": "accepted", "hold_reason": "deferred", "reason": "old_scheduled_stage_without_start_date_to_deferred"},
		},
		"deferred_future": {
			old: map[string]interface{}{"phase": "open", "stage": "deferred", "native_label": "deferred", "start_date": future.Format(time.RFC3339Nano), "has_blocker": false},
			new: map[string]interface{}{"stage": "accepted", "reason": "old_deferred_stage_future_start_date_cleared_hold"},
		},
		"adapter_blocked": {
			old: map[string]interface{}{"phase": "open", "stage": "blocked", "native_label": "beads:blocked", "start_date": nil, "has_blocker": false},
			new: map[string]interface{}{"stage": "accepted", "hold_reason": "waiting_for_input", "reason": "old_blocked_stage_without_blocker_to_waiting_for_input"},
		},
	}
	seenNotes := map[string]bool{}
	for _, tsk := range imported {
		changes, err := s.ListAllChangesForTask(ctx, store.ListAllChangesForTaskParams{TaskID: tsk.ID})
		if err != nil {
			t.Fatalf("ListAllChangesForTask: %v", err)
		}
		for _, change := range changes {
			if change.FieldName == "task_state_migration" {
				if !json.Valid([]byte(change.OldValue)) || !json.Valid([]byte(change.NewValue)) {
					t.Fatalf("migration note for %s is not compact JSON: old=%q new=%q", tsk.Title, change.OldValue, change.NewValue)
				}
				want, ok := wantNotes[tsk.Title]
				if !ok {
					t.Fatalf("unexpected migration note for %s", tsk.Title)
				}
				var oldPayload, newPayload map[string]interface{}
				if err := json.Unmarshal([]byte(change.OldValue), &oldPayload); err != nil {
					t.Fatalf("old payload for %s: %v", tsk.Title, err)
				}
				if err := json.Unmarshal([]byte(change.NewValue), &newPayload); err != nil {
					t.Fatalf("new payload for %s: %v", tsk.Title, err)
				}
				assertJSONMapEqual(t, tsk.Title+".old", oldPayload, want.old)
				assertJSONMapEqual(t, tsk.Title+".new", newPayload, want.new)
				seenNotes[tsk.Title] = true
			}
		}
	}
	if len(seenNotes) != len(wantNotes) {
		t.Fatalf("migration notes = %d, want %d: seen=%v", len(seenNotes), len(wantNotes), seenNotes)
	}
}

func TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	for _, removed := range []string{"backlog", "ready", "blocked", "waiting_for_input", "deferred", "scheduled"} {
		t.Run(removed, func(t *testing.T) {
			doc := minimalImportDoc("v2 reject "+removed, nil, []map[string]interface{}{
				{
					"id": uuid.New().String(), "title": removed, "description": "", "phase": "open", "stage": removed,
					"native_label": removed, "type": "", "labels": []string{}, "repo": "", "branch": "",
					"pull_requests": []map[string]string{}, "remote_data": map[string]interface{}{},
				},
			}, nil, nil, nil)
			doc["format_version"] = 2
			data, _ := json.Marshal(doc)

			_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
			if status.Code(err) != codes.InvalidArgument {
				t.Fatalf("ImportCollection err = %v, want InvalidArgument", err)
			}
		})
	}
}

func TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()
	future := time.Now().UTC().Add(24 * time.Hour)

	tests := []struct {
		name       string
		stage      string
		holdReason string
		startDate  *time.Time
	}{
		{"hold on triage", "triage", "waiting_for_input", nil},
		{"hold on terminal", "completed", "waiting_for_input", nil},
		{"deferred future start", "accepted", "deferred", &future},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskDoc := map[string]interface{}{
				"id": uuid.New().String(), "title": tt.name, "description": "", "phase": "open", "stage": tt.stage,
				"hold_reason": tt.holdReason, "native_label": tt.stage, "type": "", "labels": []string{},
				"repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": map[string]interface{}{},
				"start_date": tt.startDate,
			}
			if tt.stage == "completed" {
				taskDoc["phase"] = "closed"
				taskDoc["closed_at"] = time.Now().UTC()
			}
			doc := minimalImportDoc("v2 invalid hold "+tt.name, nil, []map[string]interface{}{taskDoc}, nil, nil, nil)
			doc["format_version"] = 2
			data, _ := json.Marshal(doc)

			_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
			if status.Code(err) != codes.InvalidArgument {
				t.Fatalf("ImportCollection err = %v, want InvalidArgument", err)
			}
		})
	}
}

func TestRPC_ImportCollection_CreatesUsersAtomically(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	userID := uuid.New().String()
	taskA := uuid.New().String()
	taskB := uuid.New().String()
	relA := uuid.New().String()
	relB := uuid.New().String()
	doc := minimalImportDoc("rollback", []map[string]interface{}{
		{"id": userID, "display_name": "Rollback User", "email": "rollback@example.com", "type": "human", "status": "active"},
	}, []map[string]interface{}{
		{"id": taskA, "title": "A", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "assignee_id": userID, "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
		{"id": taskB, "title": "B", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
	}, nil, []map[string]interface{}{
		{"id": relA, "source_task_id": taskA, "target_task_id": taskB, "type": "blocks"},
		{"id": relB, "source_task_id": taskA, "target_task_id": taskB, "type": "blocks"},
	}, nil)
	data, _ := json.Marshal(doc)

	_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	assertCode(t, err, codes.Internal)
	users, err := s.GetUserByEmail(ctx, "rollback@example.com")
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if len(users) != 0 {
		t.Fatalf("users with rollback email = %d, want 0 after failed import", len(users))
	}
}

func TestRPC_ImportCollection_ImportsChanges(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	userID := uuid.New().String()
	taskID := uuid.New().String()
	changeID := uuid.New().String()
	doc := minimalImportDoc("changes", []map[string]interface{}{
		{"id": userID, "display_name": "Change Author", "email": "change@example.com", "type": "human", "status": "active"},
	}, []map[string]interface{}{
		{"id": taskID, "title": "Task", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
	}, nil, nil, []map[string]interface{}{
		{"id": changeID, "task_id": taskID, "author_id": userID, "field_name": "title", "old_value": "Old", "new_value": "Task"},
	})
	data, _ := json.Marshal(doc)

	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	if resp.GetStats().GetChanges() != 1 || resp.GetStats().GetUsersCreated() != 1 {
		t.Fatalf("stats = %+v, want one change and one created user", resp.GetStats())
	}
	tasks, _ := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: uuid.MustParse(resp.GetCollectionId())})
	changes, err := s.ListAllChangesForTask(ctx, store.ListAllChangesForTaskParams{TaskID: tasks[0].ID})
	if err != nil {
		t.Fatalf("ListAllChangesForTask: %v", err)
	}
	if len(changes) != 1 || changes[0].FieldName != "title" || changes[0].OldValue != "Old" || changes[0].NewValue != "Task" {
		t.Fatalf("changes = %+v, want imported title change", changes)
	}
	if changes[0].ID.String() == changeID {
		t.Fatalf("change id was not remapped: %s", changes[0].ID)
	}
}

func TestRPC_ImportCollection_AmbiguousEmailCreatesNewUser(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	first, _ := s.CreateUser(ctx, store.CreateUserParams{DisplayName: "One", Email: strPtr("ambiguous@example.com"), Type: "human", Status: "active"})
	second, _ := s.CreateUser(ctx, store.CreateUserParams{DisplayName: "Two", Email: strPtr("ambiguous@example.com"), Type: "human", Status: "active"})
	userID := uuid.New().String()
	taskID := uuid.New().String()
	commentID := uuid.New().String()
	doc := minimalImportDoc("ambiguous email", []map[string]interface{}{
		{"id": userID, "display_name": "Imported", "email": "ambiguous@example.com", "type": "human", "status": "active"},
	}, []map[string]interface{}{
		{"id": taskID, "title": "Task", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
	}, []map[string]interface{}{
		{"id": commentID, "task_id": taskID, "author_id": userID, "body": "ambiguous"},
	}, nil, nil)
	data, _ := json.Marshal(doc)

	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	if resp.GetStats().GetUsersMatched() != 0 || resp.GetStats().GetUsersCreated() != 1 {
		t.Fatalf("stats = %+v, want one newly created user", resp.GetStats())
	}
	tasks, _ := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: uuid.MustParse(resp.GetCollectionId())})
	comments, _ := s.ListAllCommentsForTask(ctx, store.ListAllCommentsForTaskParams{TaskID: tasks[0].ID})
	if len(comments) != 1 {
		t.Fatalf("comments = %d, want 1", len(comments))
	}
	if comments[0].AuthorID == first.ID || comments[0].AuthorID == second.ID {
		t.Fatalf("ambiguous email reused existing user %s", comments[0].AuthorID)
	}
	users, _ := s.GetUserByEmail(ctx, "ambiguous@example.com")
	if len(users) != 3 {
		t.Fatalf("users with ambiguous email = %d, want 3", len(users))
	}
}

func TestRPC_ImportCollection_RejectsParentCycle(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	taskA := uuid.New().String()
	taskB := uuid.New().String()
	doc := minimalImportDoc("cycle", nil, []map[string]interface{}{
		{"id": taskA, "title": "A", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "parent_task_id": taskB, "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
		{"id": taskB, "title": "B", "description": "", "phase": "open", "stage": "triage", "native_label": "triage", "type": "", "parent_task_id": taskA, "labels": []string{}, "repo": "", "branch": "", "pull_requests": []map[string]string{}, "remote_data": nil},
	}, nil, nil, nil)
	data, _ := json.Marshal(doc)

	_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	assertCode(t, err, codes.InvalidArgument)
}

func TestRPC_ImportExportCollection_Errors(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: []byte("{not json")})
	assertCode(t, err, codes.InvalidArgument)

	data, _ := json.Marshal(map[string]interface{}{"format_version": 99, "generator": "farmtable", "collection": map[string]interface{}{"platform": "farmtable"}})
	_, err = client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	assertCode(t, err, codes.InvalidArgument)

	external, err := s.CreateCollection(ctx, store.CreateCollectionParams{Name: "external", Platform: string(collection.PlatformGithub)})
	if err != nil {
		t.Fatalf("CreateCollection external: %v", err)
	}
	_, err = client.ExportCollection(ctx, &pb.ExportCollectionRequest{Id: external.ID.String()})
	assertCode(t, err, codes.FailedPrecondition)

	nonFarmtableDoc := minimalImportDoc("external", nil, nil, nil, nil, nil)
	nonFarmtableDoc["collection"].(map[string]interface{})["platform"] = "github"
	data, _ = json.Marshal(nonFarmtableDoc)
	_, err = client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	assertCode(t, err, codes.FailedPrecondition)

	unknownFieldDoc := minimalImportDoc("unknown", nil, nil, nil, nil, nil)
	unknownFieldDoc["taks"] = []map[string]interface{}{}
	data, _ = json.Marshal(unknownFieldDoc)
	_, err = client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	assertCode(t, err, codes.InvalidArgument)
}

func minimalImportDoc(name string, users, tasks, comments, relationships, changes []map[string]interface{}) map[string]interface{} {
	now := time.Now().UTC()
	if users == nil {
		users = []map[string]interface{}{}
	}
	if tasks == nil {
		tasks = []map[string]interface{}{}
	}
	if comments == nil {
		comments = []map[string]interface{}{}
	}
	if relationships == nil {
		relationships = []map[string]interface{}{}
	}
	if changes == nil {
		changes = []map[string]interface{}{}
	}
	for _, task := range tasks {
		task["created_at"] = now
		task["updated_at"] = now
	}
	for _, comment := range comments {
		comment["created_at"] = now
		comment["updated_at"] = now
	}
	for _, change := range changes {
		change["created_at"] = now
	}
	return map[string]interface{}{
		"format_version": 1,
		"exported_at":    now,
		"generator":      "farmtable",
		"collection": map[string]interface{}{
			"id":          uuid.New().String(),
			"name":        name,
			"description": "",
			"platform":    "farmtable",
			"created_at":  now,
			"updated_at":  now,
		},
		"users":         users,
		"tasks":         tasks,
		"comments":      comments,
		"relationships": relationships,
		"changes":       changes,
	}
}

func TestRPC_ImportCollection_BeadsJSONL(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	jsonl := `{"_type":"issue","id":"epic-1","title":"Epic Task","description":"An epic","status":"open","priority":0,"issue_type":"epic","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-02T00:00:00Z"}
{"_type":"issue","id":"task-1","title":"Child Task","description":"A task under the epic","status":"in_progress","priority":2,"issue_type":"task","assignee":"Alice","started_at":"2026-01-03T00:00:00Z","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-03T00:00:00Z","dependencies":[{"issue_id":"task-1","depends_on_id":"epic-1","type":"parent-child","created_at":"2026-01-01T00:00:00Z","created_by":"root","metadata":"{}"}]}
{"_type":"issue","id":"task-2","title":"Blocked Task","description":"Blocked by task-1","status":"closed","priority":1,"issue_type":"bug","closed_at":"2026-01-05T00:00:00Z","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-05T00:00:00Z","dependencies":[{"issue_id":"task-2","depends_on_id":"epic-1","type":"parent-child","created_at":"2026-01-01T00:00:00Z","created_by":"root","metadata":"{}"},{"issue_id":"task-2","depends_on_id":"task-1","type":"blocks","created_at":"2026-01-01T00:00:00Z","created_by":"root","metadata":"{}"}],"comments":[{"id":"c1","issue_id":"task-2","author":"Bob","text":"Fixed it","created_at":"2026-01-04T00:00:00Z"}]}`

	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{
		Data: []byte(jsonl),
		Name: strPtr("Beads Test"),
	})
	if err != nil {
		t.Fatalf("ImportCollection Beads: %v", err)
	}
	if resp.GetCollectionId() == "" {
		t.Fatal("collection_id is empty")
	}
	if resp.GetStats().GetTasks() != 3 {
		t.Fatalf("tasks = %d, want 3", resp.GetStats().GetTasks())
	}
	if resp.GetStats().GetComments() != 1 {
		t.Fatalf("comments = %d, want 1", resp.GetStats().GetComments())
	}
	if resp.GetStats().GetRelationships() != 1 {
		t.Fatalf("relationships = %d, want 1 (blocks)", resp.GetStats().GetRelationships())
	}

	// Verify imported tasks.
	tasks, err := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: uuid.MustParse(resp.GetCollectionId())})
	if err != nil {
		t.Fatalf("ListAllTasksForCollection: %v", err)
	}
	if len(tasks) != 3 {
		t.Fatalf("imported tasks = %d, want 3", len(tasks))
	}
	byTitle := map[string]*ent.Task{}
	for _, task := range tasks {
		byTitle[task.Title] = task
	}

	// Verify epic.
	epic := byTitle["Epic Task"]
	if epic == nil {
		t.Fatal("missing epic task")
	}
	if epic.Type != "epic" {
		t.Errorf("epic type = %q, want %q", epic.Type, "epic")
	}
	if epic.Priority == nil || string(*epic.Priority) != "urgent" {
		t.Errorf("epic priority = %v, want urgent", epic.Priority)
	}

	// Verify child task has parent set.
	child := byTitle["Child Task"]
	if child == nil {
		t.Fatal("missing child task")
	}
	if child.ParentTaskID == nil || *child.ParentTaskID != epic.ID {
		t.Errorf("child parent = %v, want %s", child.ParentTaskID, epic.ID)
	}
	if string(child.Phase) != "in_progress" {
		t.Errorf("child phase = %q, want %q", child.Phase, "in_progress")
	}
	if string(child.Stage) != "working" {
		t.Errorf("child stage = %q, want %q", child.Stage, "working")
	}

	// Verify blocked task has correct status mapping.
	blocked := byTitle["Blocked Task"]
	if blocked == nil {
		t.Fatal("missing blocked task")
	}
	if string(blocked.Phase) != "closed" {
		t.Errorf("blocked phase = %q, want %q", blocked.Phase, "closed")
	}
	if blocked.ClosedAt == nil {
		t.Error("blocked closed_at is nil, want non-nil")
	}
	if blocked.Type != "bug" {
		t.Errorf("blocked type = %q, want %q", blocked.Type, "bug")
	}

	// Verify comment was imported.
	comments, err := s.ListAllCommentsForTask(ctx, store.ListAllCommentsForTaskParams{TaskID: blocked.ID})
	if err != nil {
		t.Fatalf("ListAllCommentsForTask: %v", err)
	}
	if len(comments) != 1 || comments[0].Body != "Fixed it" {
		t.Fatalf("comments = %+v, want one 'Fixed it' comment", comments)
	}

	// Verify relationships.
	rels, err := s.ListAllRelationshipsForCollection(ctx, store.ListAllRelationshipsForCollectionParams{CollectionID: uuid.MustParse(resp.GetCollectionId())})
	if err != nil {
		t.Fatalf("ListAllRelationshipsForCollection: %v", err)
	}
	if len(rels) != 1 {
		t.Fatalf("relationships = %d, want 1", len(rels))
	}
}

func TestRPC_ImportCollection_BeadsJSONL_DryRun(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	jsonl := `{"_type":"issue","id":"test-1","title":"Test Issue","status":"open","priority":2,"issue_type":"task","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-02T00:00:00Z"}`

	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{
		Data:   []byte(jsonl),
		Name:   strPtr("Dry Run Beads"),
		DryRun: true,
	})
	if err != nil {
		t.Fatalf("ImportCollection dry-run: %v", err)
	}
	if resp.GetCollectionId() != "" {
		t.Fatalf("collection_id = %q, want empty for dry-run", resp.GetCollectionId())
	}
	if resp.GetStats().GetTasks() != 1 {
		t.Fatalf("tasks = %d, want 1", resp.GetStats().GetTasks())
	}
}

func TestRPC_ImportCollection_UnsupportedFormat(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{
		Data: []byte("this is not json or jsonl"),
		Name: strPtr("Bad Format"),
	})
	assertCode(t, err, codes.InvalidArgument)
}

func assertCode(t *testing.T, err error, code codes.Code) {
	t.Helper()
	if err == nil {
		t.Fatalf("error = nil, want %s", code)
	}
	if got := status.Code(err); got != code {
		t.Fatalf("code = %s, want %s; err=%v", got, code, err)
	}
}
