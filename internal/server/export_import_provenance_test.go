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
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
	// Backdate the COLLECTION too, and to a different instant. A historical
	// import legitimately carries one. This is load-bearing for the assertions
	// below: if every payload timestamp were "now", an implementation that
	// stamped provenance from the payload would be indistinguishable from one
	// that used the server clock, and the ingestion-time assertion would pass
	// vacuously.
	claimedCollectionCreated := time.Date(2018, 6, 7, 8, 9, 10, 0, time.UTC)
	doc["collection"].(map[string]interface{})["created_at"] = claimedCollectionCreated

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
	for _, claimed := range []struct {
		what string
		when time.Time
	}{
		{"the forged change row's created_at", backdated},
		{"the collection's created_at", claimedCollectionCreated},
	} {
		if got.Equal(claimed.when) {
			t.Fatalf("provenance created_at was taken from the payload (%s = %s); the ingestion stamp must come from the server clock, or backdating stays undetectable",
				claimed.what, claimed.when)
		}
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
	if s, _ := detail["imported_at"].(string); s == "" {
		t.Fatalf("provenance imported_at missing: %v", detail)
	}
	// The two timestamps must sit SIDE BY SIDE and be distinguishable. Recording
	// only the server's stamp would lose what the payload asserted; recording
	// only the payload's would be the defect itself.
	wantClaim := claimedCollectionCreated.Format(time.RFC3339Nano)
	if detail["claimed_collection_created_at"] != wantClaim {
		t.Fatalf("provenance claimed_collection_created_at = %v, want the payload's own claim %s preserved alongside the server stamp",
			detail["claimed_collection_created_at"], wantClaim)
	}
	if detail["imported_at"] == detail["claimed_collection_created_at"] {
		t.Fatalf("the claimed and actual timestamps are identical (%v); they must be distinguishable", detail["imported_at"])
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

// TestRPC_ImportCollection_RefusesImportWithoutIdentity is a CANARY, not an
// edge case.
//
// What it protects: this whole change exists because absent information was
// being treated as good enough. The remedy must not repeat that habit inside
// itself. If ImportCollection ever again accepts an import it cannot attribute
// — recording "", "unknown", "system" or the zero UUID and carrying on — the
// provenance stamp becomes authoritative-looking while naming nobody, which is
// worse than having no stamp at all. That failure would be invisible in every
// other test in this file, because they all supply an identity.
//
// RequireIdentity has two absent-identity outcomes and this pins BOTH:
//   - open-access mode, where it returns (uuid.Nil, nil) and no error;
//   - enforced mode with no usable identity, where it returns an error.
func TestRPC_ImportCollection_RefusesImportWithoutIdentity(t *testing.T) {
	_, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	doc := minimalImportDoc("no identity", nil,
		[]map[string]interface{}{importTaskDoc(uuid.New().String())}, nil, nil, nil)
	data, _ := json.Marshal(doc)
	svc := server.NewFarmTableService(s, "test")

	// ATTRIBUTION. Only the first subcase is evidence for the control this
	// branch adds. Deleting the `importerID == uuid.Nil` refusal turns that one
	// RED and leaves the other two GREEN, because they exercise RequireIdentity
	// error behaviour that already existed at 43bd206. Green under both
	// hypotheses is not evidence, so the other two are labelled for what they
	// actually are: regression guards on the base, kept because the branch's
	// claim is that BOTH absent-identity outcomes are loud, and a future change
	// to RequireIdentity could silently break the half this branch did not add.
	cases := []struct {
		name string
		ctx  context.Context
		// wantCode is the gRPC code this subcase must produce.
		wantCode codes.Code
		// newControl marks the subcase that this branch's refusal is
		// responsible for. Exactly one subcase may set it.
		newControl bool
	}{
		{
			// THE NEW CONTROL. No auth interceptor configured, so
			// RequireIdentity returns (uuid.Nil, nil). The nil error is exactly
			// what makes this the dangerous case — nothing signals that anything
			// is missing, and before this branch the import proceeded.
			name:       "open access mode yields nil identity and no error",
			ctx:        context.Background(),
			wantCode:   codes.FailedPrecondition,
			newControl: true,
		},
		{
			// BASE REGRESSION GUARD (passes with or without this branch's
			// control): auth enforced but the identity is the zero value.
			name:     "auth enforced with zero identity",
			ctx:      server.ContextWithAuthEnforced(server.ContextWithUserID(context.Background(), uuid.Nil)),
			wantCode: codes.Unauthenticated,
		},
		{
			// BASE REGRESSION GUARD: auth enforced with no identity in the
			// context at all.
			name:     "auth enforced with no identity present",
			ctx:      server.ContextWithAuthEnforced(context.Background()),
			wantCode: codes.Unauthenticated,
		},
	}
	newControls := 0
	for _, tc := range cases {
		if tc.newControl {
			newControls++
		}
	}
	if newControls != 1 {
		t.Fatalf("this test claims %d subcases as evidence for the new refusal; exactly 1 is honest", newControls)
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			before, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Limit: 200})
			if err != nil {
				t.Fatalf("ListCollections: %v", err)
			}

			_, err = svc.ImportCollection(tc.ctx, &pb.ImportCollectionRequest{Data: data})
			if err == nil {
				t.Fatalf("CANARY: an import with no establishable caller was ACCEPTED. " +
					"Absent identity must fail loudly, never be recorded as a placeholder and carried on.")
			}
			if got := status.Code(err); got != tc.wantCode {
				t.Fatalf("CANARY: error code = %s, want %s (err: %v)", got, tc.wantCode, err)
			}

			after, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Limit: 200})
			if err != nil {
				t.Fatalf("ListCollections: %v", err)
			}
			if len(after) != len(before) {
				t.Fatalf("CANARY: the refused import still wrote a collection (%d -> %d)", len(before), len(after))
			}
		})
	}
}

// TestRPC_ImportCollection_ProvenanceNeverNamesAPlaceholder is the second half
// of the canary: it asserts on the RECORD rather than on the refusal, so that a
// future change which reintroduces a degraded stamp by some other route is
// caught even if the refusal above is bypassed.
func TestRPC_ImportCollection_ProvenanceNeverNamesAPlaceholder(t *testing.T) {
	_, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	importer, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Real Importer", Email: strPtr("real-importer@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	doc := minimalImportDoc("placeholder check", nil,
		[]map[string]interface{}{importTaskDoc(uuid.New().String())}, nil, nil, nil)
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
	provs := provenanceRows(rows)
	if len(provs) != 1 {
		t.Fatalf("provenance rows = %d, want 1", len(provs))
	}

	if provs[0].AuthorID == uuid.Nil {
		t.Fatalf("CANARY: provenance row author is the zero UUID")
	}
	var detail map[string]interface{}
	if err := json.Unmarshal([]byte(provs[0].NewValue), &detail); err != nil {
		t.Fatalf("provenance new_value is not JSON (%q): %v", provs[0].NewValue, err)
	}
	got, _ := detail["imported_by"].(string)
	for _, placeholder := range []string{"", "unknown", "system", "anonymous", uuid.Nil.String()} {
		if got == placeholder {
			t.Fatalf("CANARY: imported_by = %q, a placeholder standing in for an unknown actor", got)
		}
	}
	if got != importer.ID.String() {
		t.Fatalf("imported_by = %q, want the real importer %s", got, importer.ID)
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

// payloadChanges filters out the server-authored rows an import writes, so that
// assertions about what a document contributed stay assertions about the
// payload. It deliberately keys off the reserved prefix rather than the single
// provenance field name, so any future server-authored row is covered too.
func payloadChanges(changes []*ent.Change) []*ent.Change {
	out := make([]*ent.Change, 0, len(changes))
	for _, c := range changes {
		if strings.HasPrefix(c.FieldName, wantServerFieldPrefix) {
			continue
		}
		out = append(out, c)
	}
	return out
}

// TestRPC_ExportCollection_CarriesImportProvenance pins the export side of the
// provenance record.
//
// Provenance rows are deliberately NOT stripped from exports. They are audit
// content: an operator reading an export of a collection that arrived by import
// should be able to see that it arrived by import, and who performed it. An
// earlier draft of this fix did strip them, on the theory that their author
// might be absent from users[] — that was only ever possible for the nil-UUID
// author written in open-access mode, and import now refuses an unidentifiable
// caller outright, so the case cannot arise. This test pins both halves of what
// replaced it: the row is exported, and the document stays self-consistent.
func TestRPC_ExportCollection_CarriesImportProvenance(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	first, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "First Importer", Email: strPtr("first@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser first: %v", err)
	}
	second, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "Second Importer", Email: strPtr("second@example.com"),
		Type: "human", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateUser second: %v", err)
	}

	taskID := uuid.New().String()
	doc := minimalImportDoc("origin", nil, []map[string]interface{}{importTaskDoc(taskID)}, nil, nil, nil)
	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("marshal doc: %v", err)
	}

	svc := server.NewFarmTableService(s, "test")
	firstImport, err := svc.ImportCollection(authedImportCtx(first.ID), &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("first ImportCollection: %v", err)
	}

	exported, err := client.ExportCollection(ctx, &pb.ExportCollectionRequest{
		Id: firstImport.GetCollectionId(), IncludeChanges: true,
	})
	if err != nil {
		t.Fatalf("ExportCollection: %v", err)
	}
	var exportedDoc testExportDoc
	if err := json.Unmarshal(exported.GetData(), &exportedDoc); err != nil {
		t.Fatalf("unmarshal export: %v", err)
	}

	var exportedProv map[string]interface{}
	for _, c := range exportedDoc.Changes {
		if c["field_name"] == wantProvenanceField {
			exportedProv = c
		}
	}
	if exportedProv == nil {
		t.Fatalf("the export of an imported collection does not disclose that it was imported; changes = %+v", exportedDoc.Changes)
	}
	if exportedProv["author_id"] != first.ID.String() {
		t.Fatalf("exported provenance author_id = %v, want the real importer %s", exportedProv["author_id"], first.ID)
	}

	// Self-consistency: every change author must appear in users[], or the
	// document cannot survive its own import validation.
	found := false
	for _, u := range exportedDoc.Users {
		if u["id"] == first.ID.String() {
			found = true
		}
	}
	if !found {
		t.Fatalf("provenance author %s is absent from the exported users[]; the document is not self-consistent", first.ID)
	}

	// Re-import as a DIFFERENT principal. The exported provenance row must be
	// dropped rather than trusted, and replaced by one naming the new importer.
	secondImport, err := svc.ImportCollection(authedImportCtx(second.ID), &pb.ImportCollectionRequest{
		Data: exported.GetData(), Name: strPtr("restored"),
	})
	if err != nil {
		t.Fatalf("re-import of an export containing provenance failed: %v", err)
	}
	var warned bool
	for _, w := range secondImport.GetWarnings() {
		if strings.Contains(w, wantServerFieldPrefix) {
			warned = true
		}
	}
	if !warned {
		t.Fatalf("re-import silently dropped the exported provenance row; warnings = %v", secondImport.GetWarnings())
	}

	tasks, err := s.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{
		CollectionID: uuid.MustParse(secondImport.GetCollectionId()),
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
	provs := provenanceRows(rows)
	if len(provs) != 1 {
		t.Fatalf("provenance rows after re-import = %d, want exactly 1; the payload's copy must not have survived alongside the new one", len(provs))
	}
	if provs[0].AuthorID != second.ID {
		t.Fatalf("re-imported provenance names %s, want the principal who actually performed THIS import (%s)", provs[0].AuthorID, second.ID)
	}
}

// openAccessCauses returns every cause value the wiring can produce, plus an
// unrecognised one. The unrecognised value is deliberate: it stands in for a
// future wiring site that sets a cause this code has never heard of.
func openAccessCauses() []struct {
	name  string
	cause server.OpenAccessCause
} {
	return []struct {
		name  string
		cause server.OpenAccessCause
	}{
		{"unspecified", server.OpenAccessCauseUnspecified},
		{"deliberate", server.OpenAccessCauseDeliberate},
		{"missing token", server.OpenAccessCauseMissingToken},
		{"unrecognised", server.OpenAccessCause("something-nobody-has-written-yet")},
	}
}

// TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause is the guard on
// the diagnostic plumbing itself.
//
// OpenAccessCause exists so a refusal can name the knob that caused it. The
// danger in adding it is that a value plumbed in at wiring time acquires
// authority it was never meant to have — that some cause, now or later, becomes
// a reason to let the import through. This pins the invariant: the cause selects
// WORDS, never an OUTCOME. A caller with no id is refused identically under every
// value, including one this code does not recognise.
func TestRPC_ImportCollection_RefusalDoesNotDependOnOpenAccessCause(t *testing.T) {
	_, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	doc := minimalImportDoc("cause invariance", nil,
		[]map[string]interface{}{importTaskDoc(uuid.New().String())}, nil, nil, nil)
	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("marshal doc: %v", err)
	}

	for _, tc := range openAccessCauses() {
		t.Run(tc.name, func(t *testing.T) {
			svc := server.NewFarmTableService(s, "test", server.WithOpenAccessCause(tc.cause))

			before, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Limit: 200})
			if err != nil {
				t.Fatalf("ListCollections: %v", err)
			}

			_, err = svc.ImportCollection(context.Background(), &pb.ImportCollectionRequest{Data: data})
			if err == nil {
				t.Fatalf("CANARY: cause %q let an unattributable import THROUGH. "+
					"OpenAccessCause is diagnostic text; it must never decide whether a request is refused.", tc.cause)
			}
			if got := status.Code(err); got != codes.FailedPrecondition {
				t.Fatalf("CANARY: cause %q changed the refusal code to %s, want %s; the cause must not affect the outcome",
					tc.cause, got, codes.FailedPrecondition)
			}

			after, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Limit: 200})
			if err != nil {
				t.Fatalf("ListCollections: %v", err)
			}
			if len(after) != len(before) {
				t.Fatalf("CANARY: cause %q wrote a collection on a refused import (%d -> %d)", tc.cause, len(before), len(after))
			}
		})
	}
}

// TestRPC_ImportCollection_RefusalMessageNamesTheCause pins the wording, which
// is the entire user-facing surface of this change. An operator who hits this
// refusal has no other signal to work from, so the message must say what was
// refused, why, and which knob to turn — and must not imply that local tooling
// is broken, because the embedded CLI is never open-access.
func TestRPC_ImportCollection_RefusalMessageNamesTheCause(t *testing.T) {
	_, s, cleanup := newExportImportTestServer(t)
	defer cleanup()

	doc := minimalImportDoc("wording", nil,
		[]map[string]interface{}{importTaskDoc(uuid.New().String())}, nil, nil, nil)
	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("marshal doc: %v", err)
	}

	cases := []struct {
		name     string
		cause    server.OpenAccessCause
		wantAll  []string
		wantNone []string
	}{
		{
			name:  "deliberate names the open-access switch",
			cause: server.OpenAccessCauseDeliberate,
			// Must name the knob actually responsible, and must NOT tell the
			// operator to set a token as if that alone were the problem.
			wantAll:  []string{"FARMTABLE_OPEN_ACCESS"},
			wantNone: []string{"FARMTABLE_TOKEN is not set"},
		},
		{
			name:     "missing token names the token variable",
			cause:    server.OpenAccessCauseMissingToken,
			wantAll:  []string{"FARMTABLE_TOKEN"},
			wantNone: []string{"FARMTABLE_OPEN_ACCESS=1"},
		},
		{
			name:  "unspecified still gives actionable guidance",
			cause: server.OpenAccessCauseUnspecified,
			// No knob is known, so it must not guess at one, but it must still
			// tell the operator what to do.
			wantAll:  []string{"FARMTABLE_TOKEN"},
			wantNone: []string{"FARMTABLE_OPEN_ACCESS=1"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := server.NewFarmTableService(s, "test", server.WithOpenAccessCause(tc.cause))
			_, err := svc.ImportCollection(context.Background(), &pb.ImportCollectionRequest{Data: data})
			if err == nil {
				t.Fatalf("import was accepted without an identity")
			}
			msg := status.Convert(err).Message()

			// Properties every refusal must have, whatever the cause.
			for _, want := range []string{
				"cannot import",                // says what was refused
				"cannot identify the caller",   // says why
				"refused rather than recorded", // says it did not silently happen
				"Only collection import is affected",
				"embedded `ft` CLI is unaffected", // does not scare local CLI users
			} {
				if !strings.Contains(msg, want) {
					t.Fatalf("cause %q: refusal message is missing %q, so the operator cannot act on it.\nmessage: %s",
						tc.cause, want, msg)
				}
			}

			for _, want := range tc.wantAll {
				if !strings.Contains(msg, want) {
					t.Fatalf("cause %q: message does not name %q.\nmessage: %s", tc.cause, want, msg)
				}
			}
			for _, unwanted := range tc.wantNone {
				if strings.Contains(msg, unwanted) {
					t.Fatalf("cause %q: message wrongly blames %q.\nmessage: %s", tc.cause, unwanted, msg)
				}
			}
		})
	}
}
