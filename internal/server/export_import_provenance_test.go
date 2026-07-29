package server_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
)

// The contract these tests pin, spelled out here rather than imported from the
// implementation so that the tests fail on an assertion rather than on a
// compile error when the implementation is absent or reverted.
const (
	wantServerFieldPrefix = "server:"
	wantProvenanceField   = "server:import_provenance"
)

// authedImportCtx builds a context that looks like a real authenticated caller:
// auth enforcement on, plus a concrete non-nil user id, so RequireIdentity
// returns that id rather than uuid.Nil.
func authedImportCtx(importerID uuid.UUID) context.Context {
	return server.ContextWithAuthEnforced(server.ContextWithUserID(context.Background(), importerID))
}

func provenanceRows(changes []*ent.Change) []*ent.Change {
	var out []*ent.Change
	for _, c := range changes {
		if c.FieldName == wantProvenanceField {
			out = append(out, c)
		}
	}
	return out
}

func importTaskDoc(taskID string) map[string]interface{} {
	return map[string]interface{}{
		"id": taskID, "title": "Task", "description": "", "phase": "open",
		"stage": "triage", "native_label": "triage", "type": "",
		"labels": []string{}, "repo": "", "branch": "",
		"pull_requests": []map[string]string{}, "remote_data": nil,
	}
}

// TestRPC_ImportCollection_StampsImporterProvenance is the oracle for the
// forged-and-backdated audit row defect.
//
// The payload forges a change row attributed to a REAL existing account (bound
// by the email remap in resolveImportUsers) and backdates it to 2019. That part
// is deliberately left intact: historical imports legitimately carry historical
// timestamps, and silently rewriting them would be a real regression. What must
// ALSO be true is that the import leaves a server-authored record of who
// actually performed it and when the server actually ingested it, so a forged
// row is no longer indistinguishable from a genuine one.
func TestRPC_ImportCollection_StampsImporterProvenance(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	// The victim: a real account the forged row will be attributed to.
	victim, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Victim Approver", Email: strPtr("victim@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser victim: %v", err)
	}
	// The attacker: the principal who actually calls ImportCollection.
	importer, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Mallory Importer", Email: strPtr("mallory@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser importer: %v", err)
	}

	payloadUserID := uuid.New().String()
	taskID := uuid.New().String()
	backdated := time.Date(2019, 3, 4, 5, 6, 7, 0, time.UTC)

	changes := []map[string]interface{}{
		{"id": uuid.New().String(), "task_id": taskID, "author_id": payloadUserID,
			"field_name": "stage", "old_value": "in_review", "new_value": "completed"},
	}
	doc := minimalImportDoc("forged history", []map[string]interface{}{
		// This email matches the victim, so resolveImportUsers binds the payload
		// row to the victim's REAL uuid.
		{"id": payloadUserID, "display_name": "Victim Approver", "email": "victim@example.com", "type": "human", "status": "active"},
	}, []map[string]interface{}{importTaskDoc(taskID)}, nil, nil, changes)
	// minimalImportDoc stamps created_at=now on changes; backdate it afterwards.
	// The maps are shared by reference, so this reaches the marshalled document.
	changes[0]["created_at"] = backdated

	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("marshal doc: %v", err)
	}

	// Import as the authenticated attacker, via a direct service call so the
	// identity actually reaches RequireIdentity.
	svc := server.NewFarmTableService(s, "test")
	before := time.Now().UTC().Add(-2 * time.Second)
	resp, err := svc.ImportCollection(authedImportCtx(importer.ID), &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	after := time.Now().UTC().Add(2 * time.Second)

	tasks, err := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{
		CollectionID: uuid.MustParse(resp.GetCollectionId()),
	})
	if err != nil {
		t.Fatalf("ListAllTasksForCollection: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("tasks = %d, want 1", len(tasks))
	}
	rows, err := s.ListAllChangesForTask(ctx, store.ListAllChangesForTaskParams{TaskID: tasks[0].ID})
	if err != nil {
		t.Fatalf("ListAllChangesForTask: %v", err)
	}

	// CONTROL ARM. The forged row itself must still import verbatim. If this arm
	// fails, the fix has broken legitimate historical import and the provenance
	// assertions below would be passing for the wrong reason.
	var forged *ent.Change
	for _, c := range rows {
		if c.FieldName == "stage" {
			forged = c
		}
	}
	if forged == nil {
		t.Fatalf("control arm: forged change row was not imported at all; rows = %+v", rows)
	}
	if forged.AuthorID != victim.ID {
		t.Fatalf("control arm: forged row author = %s, want email-remapped victim %s", forged.AuthorID, victim.ID)
	}
	if !forged.CreatedAt.UTC().Equal(backdated) {
		t.Fatalf("control arm: forged row created_at = %s, want the payload's backdated %s (payload timestamps must not be overwritten)",
			forged.CreatedAt.UTC(), backdated)
	}

	// (a) The import recorded the authenticated importer.
	provs := provenanceRows(rows)
	if len(provs) != 1 {
		t.Fatalf("provenance rows = %d, want exactly 1: the import recorded nobody as having performed it; rows = %+v", len(provs), rows)
	}
	prov := provs[0]
	if prov.AuthorID != importer.ID {
		t.Fatalf("provenance author = %s, want the authenticated importer %s", prov.AuthorID, importer.ID)
	}
	if prov.AuthorID == victim.ID {
		t.Fatalf("provenance attributed the import to the victim %s", victim.ID)
	}

	// (c) The ingestion timestamp is the SERVER's clock, not the payload's.
	// This is what makes backdating detectable.
	got := prov.CreatedAt.UTC()
	if got.Equal(backdated) {
		t.Fatalf("provenance created_at was taken from the payload (%s)", backdated)
	}
	if got.Before(before) || got.After(after) {
		t.Fatalf("provenance created_at = %s, want server ingestion time within [%s, %s]", got, before, after)
	}

	var detail map[string]interface{}
	if err := json.Unmarshal([]byte(prov.NewValue), &detail); err != nil {
		t.Fatalf("provenance new_value is not JSON (%q): %v", prov.NewValue, err)
	}
	if detail["imported_by"] != importer.ID.String() {
		t.Fatalf("provenance imported_by = %v, want %s", detail["imported_by"], importer.ID)
	}
	if detail["authenticated"] != true {
		t.Fatalf("provenance authenticated = %v, want true", detail["authenticated"])
	}
	if s, _ := detail["imported_at"].(string); s == "" {
		t.Fatalf("provenance imported_at missing: %v", detail)
	}

	// (b) It reaches a read path. Read it back the way a real client would.
	listed, err := client.ListChanges(ctx, &pb.ListChangesRequest{TaskId: tasks[0].ID.String()})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	var surfaced *pb.Change
	for _, c := range listed.GetItems() {
		if c.GetField() == wantProvenanceField {
			surfaced = c
		}
	}
	if surfaced == nil {
		t.Fatalf("provenance is in the database but never reaches the ListChanges read path; items = %+v", listed.GetItems())
	}
	if surfaced.GetChangedBy().GetId() != importer.ID.String() {
		t.Fatalf("read path changed_by = %s, want importer %s", surfaced.GetChangedBy().GetId(), importer.ID)
	}
}

// TestRPC_ImportCollection_PayloadCannotForgeProvenance is the arm that stops
// the remedy becoming a weapon. If a payload can author a row in the reserved
// server namespace, an attacker plants a fake stamp naming an innocent party
// and the provenance record becomes ambiguous — worse than having none.
func TestRPC_ImportCollection_PayloadCannotForgeProvenance(t *testing.T) {
	_, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	innocent, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Innocent", Email: strPtr("innocent@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	importer, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Mallory", Email: strPtr("mallory2@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	payloadUserID := uuid.New().String()
	taskID := uuid.New().String()
	forgedStamp, _ := json.Marshal(map[string]interface{}{
		"imported_by": innocent.ID.String(), "authenticated": true,
		"imported_at": "2019-01-01T00:00:00Z",
	})
	doc := minimalImportDoc("forged stamp", []map[string]interface{}{
		{"id": payloadUserID, "display_name": "Innocent", "email": "innocent@example.com", "type": "human", "status": "active"},
	}, []map[string]interface{}{importTaskDoc(taskID)}, nil, nil, []map[string]interface{}{
		{"id": uuid.New().String(), "task_id": taskID, "author_id": payloadUserID,
			"field_name": wantProvenanceField, "old_value": "", "new_value": string(forgedStamp)},
		{"id": uuid.New().String(), "task_id": taskID, "author_id": payloadUserID,
			"field_name": wantServerFieldPrefix + "anything_else", "old_value": "", "new_value": "x"},
	})
	data, _ := json.Marshal(doc)

	svc := server.NewFarmTableService(s, "test")
	resp, err := svc.ImportCollection(authedImportCtx(importer.ID), &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}

	tasks, _ := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{
		CollectionID: uuid.MustParse(resp.GetCollectionId()),
	})
	rows, _ := s.ListAllChangesForTask(ctx, store.ListAllChangesForTaskParams{TaskID: tasks[0].ID})

	// Exactly one provenance row, and it is the server's, not the payload's.
	provs := provenanceRows(rows)
	if len(provs) != 1 {
		t.Fatalf("provenance rows = %d, want exactly 1 (the payload planted a second one); rows = %+v", len(provs), rows)
	}
	if provs[0].AuthorID != importer.ID {
		t.Fatalf("provenance author = %s, want real importer %s — the payload forged the stamp", provs[0].AuthorID, importer.ID)
	}
	if provs[0].AuthorID == innocent.ID {
		t.Fatalf("the payload successfully framed the innocent user %s", innocent.ID)
	}

	// No payload row survives anywhere in the reserved namespace.
	for _, c := range rows {
		if strings.HasPrefix(c.FieldName, wantServerFieldPrefix) && c.AuthorID != importer.ID {
			t.Fatalf("payload row survived in the reserved %q namespace: field=%q author=%s",
				wantServerFieldPrefix, c.FieldName, c.AuthorID)
		}
	}

	// The drop is visible rather than silent.
	var warned bool
	for _, w := range resp.GetWarnings() {
		if strings.Contains(w, wantServerFieldPrefix) {
			warned = true
		}
	}
	if !warned {
		t.Fatalf("dropping reserved-namespace payload rows produced no warning; warnings = %v", resp.GetWarnings())
	}
}

// TestRPC_ImportCollection_ProvenanceRecordsUnauthenticatedImport pins the
// open-access case honestly. RequireIdentity returns uuid.Nil when no auth
// interceptor is configured; the provenance row must say so rather than
// inventing an actor.
func TestRPC_ImportCollection_ProvenanceRecordsUnauthenticatedImport(t *testing.T) {
	_, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	taskID := uuid.New().String()
	doc := minimalImportDoc("open access", nil, []map[string]interface{}{importTaskDoc(taskID)}, nil, nil, nil)
	data, _ := json.Marshal(doc)

	svc := server.NewFarmTableService(s, "test")
	// No ContextWithAuthEnforced: open-access mode.
	resp, err := svc.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	tasks, _ := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{
		CollectionID: uuid.MustParse(resp.GetCollectionId()),
	})
	rows, _ := s.ListAllChangesForTask(ctx, store.ListAllChangesForTaskParams{TaskID: tasks[0].ID})

	provs := provenanceRows(rows)
	if len(provs) != 1 {
		t.Fatalf("provenance rows = %d, want 1 in open-access mode; rows = %+v", len(provs), rows)
	}
	var detail map[string]interface{}
	if err := json.Unmarshal([]byte(provs[0].NewValue), &detail); err != nil {
		t.Fatalf("provenance new_value is not JSON (%q): %v", provs[0].NewValue, err)
	}
	if detail["authenticated"] != false {
		t.Fatalf("authenticated = %v, want false in open-access mode", detail["authenticated"])
	}
	if v, ok := detail["imported_by"].(string); ok && v != "" {
		t.Fatalf("imported_by = %q, want empty when there is no identity", v)
	}
}

// TestRPC_ImportCollection_StampsEveryImportedTask pins that the task-level
// stamp actually covers every task the import creates. Because ImportCollection
// only ever creates tasks (taskMapping is populated exclusively with uuid.New()
// and the store only calls tx.Task.Create), full task coverage means full row
// coverage.
func TestRPC_ImportCollection_StampsEveryImportedTask(t *testing.T) {
	_, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	importer, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Importer", Email: strPtr("importer3@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	var taskDocs []map[string]interface{}
	for i := 0; i < 4; i++ {
		taskDocs = append(taskDocs, importTaskDoc(uuid.New().String()))
	}
	doc := minimalImportDoc("coverage", nil, taskDocs, nil, nil, nil)
	data, _ := json.Marshal(doc)

	svc := server.NewFarmTableService(s, "test")
	resp, err := svc.ImportCollection(authedImportCtx(importer.ID), &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ImportCollection: %v", err)
	}
	tasks, _ := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{
		CollectionID: uuid.MustParse(resp.GetCollectionId()),
	})
	if len(tasks) != 4 {
		t.Fatalf("tasks = %d, want 4", len(tasks))
	}
	for _, task := range tasks {
		rows, _ := s.ListAllChangesForTask(ctx, store.ListAllChangesForTaskParams{TaskID: task.ID})
		if n := len(provenanceRows(rows)); n != 1 {
			t.Fatalf("task %s has %d provenance rows, want 1", task.ID, n)
		}
	}
}
